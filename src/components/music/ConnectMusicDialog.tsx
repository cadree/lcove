import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Music, Loader2, Upload, Trash2, Plus, X, AlertCircle } from "lucide-react";
import { useMusicProfile, PlatformLink, TrackInfo, AlbumInfo } from "@/hooks/useMusicProfile";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ConnectMusicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLATFORM_OPTIONS = [
  { value: "spotify", label: "Spotify", placeholder: "https://open.spotify.com/artist/..." },
  { value: "apple_music", label: "Apple Music", placeholder: "https://music.apple.com/.../artist/..." },
  { value: "soundcloud", label: "SoundCloud", placeholder: "https://soundcloud.com/..." },
  { value: "youtube_music", label: "YouTube Music", placeholder: "https://music.youtube.com/channel/..." },
  { value: "tidal", label: "Tidal", placeholder: "https://tidal.com/browse/artist/..." },
  { value: "bandcamp", label: "Bandcamp", placeholder: "https://...bandcamp.com" },
  { value: "other", label: "Other", placeholder: "https://..." },
];

const looksLikeUrl = (s: string) => /^https?:\/\//i.test(s.trim());

// Slug → Title Case ("anybody-feat-lil-duke-gunna" → "Anybody Feat Lil Duke Gunna")
const slugToTitle = (slug: string) =>
  decodeURIComponent(slug)
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const ConnectMusicDialog = ({ open, onOpenChange }: ConnectMusicDialogProps) => {
  const { user } = useAuth();
  const { musicProfile, saveMusicProfile, deleteMusicProfile } = useMusicProfile();

  const [displayName, setDisplayName] = useState("");
  const [artistImage, setArtistImage] = useState("");
  const [links, setLinks] = useState<PlatformLink[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [topTracks, setTopTracks] = useState<TrackInfo[]>([]);
  const [albums, setAlbums] = useState<AlbumInfo[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [fetchingLinkIndex, setFetchingLinkIndex] = useState<number | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [extractError, setExtractError] = useState<{ index: number; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track which fields the USER manually edited — so extraction won't clobber them
  const userEditedRef = useRef<{ name: boolean; image: boolean }>({ name: false, image: false });
  // Debounce timers per link index
  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  // Track URLs we've already extracted to avoid re-firing
  const extractedUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (musicProfile) {
      // Heal: if display_name was corrupted with a URL, treat as empty
      const savedName = musicProfile.display_name || "";
      setDisplayName(looksLikeUrl(savedName) ? "" : savedName);
      setArtistImage(musicProfile.artist_image_url || "");
      setGenres(musicProfile.genres || []);
      setTopTracks(musicProfile.top_tracks || []);
      setAlbums(musicProfile.albums || []);

      const existingLinks: PlatformLink[] = musicProfile.platform_links || [];
      if (musicProfile.spotify_artist_url && !existingLinks.some(l => l.url === musicProfile.spotify_artist_url)) {
        existingLinks.unshift({ platform: "spotify", url: musicProfile.spotify_artist_url });
      }
      if (musicProfile.apple_music_artist_url && !existingLinks.some(l => l.url === musicProfile.apple_music_artist_url)) {
        existingLinks.push({ platform: "apple_music", url: musicProfile.apple_music_artist_url });
      }
      setLinks(existingLinks.length > 0 ? existingLinks : [{ platform: "spotify", url: "" }]);
      // Reset edit tracking when profile (re)loads
      userEditedRef.current = { name: !looksLikeUrl(savedName) && !!savedName, image: !!musicProfile.artist_image_url };
    } else {
      setLinks([{ platform: "spotify", url: "" }]);
      userEditedRef.current = { name: false, image: false };
    }
  }, [musicProfile]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  // Apple Music album/track URL fallback parser
  const parseAppleMusicAlbumFallback = (url: string, imageUrl?: string): AlbumInfo | null => {
    const m = url.match(/music\.apple\.com\/[^/]+\/album\/([^/?]+)\/(\d+)/i);
    if (!m) return null;
    return {
      name: slugToTitle(m[1]),
      image_url: imageUrl,
      apple_music_url: url,
    };
  };

  const parseSpotifyAlbumFallback = (url: string, imageUrl?: string): AlbumInfo | null => {
    const m = url.match(/open\.spotify\.com\/album\/([a-zA-Z0-9]+)/i);
    if (!m) return null;
    return {
      name: "Album",
      image_url: imageUrl,
      spotify_url: url,
    };
  };

  const parseSpotifyTrackFallback = (url: string, imageUrl?: string): TrackInfo | null => {
    const m = url.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/i);
    if (!m) return null;
    return {
      name: "Track",
      album_image: imageUrl,
      spotify_url: url,
    };
  };

  const fetchArtistData = async (url: string, index: number) => {
    if (!url.trim()) return;
    const isSpotify = url.includes("open.spotify.com/");
    const isAppleMusic = url.includes("music.apple.com/");
    if (!isSpotify && !isAppleMusic) return;
    if (extractedUrlsRef.current.has(url)) {
      console.log("[MusicExtract] skipping (already extracted):", url);
      return;
    }

    console.log("[MusicExtract] starting extraction for:", url);
    setFetchingLinkIndex(index);
    setExtractError(null);

    try {
      const { data, error } = await supabase.functions.invoke("fetch-artist-image", {
        body: { url },
      });

      console.log("[MusicExtract] raw response:", { data, error });

      if (error) {
        console.error("[MusicExtract] edge function error:", error);
        setExtractError({ index, message: "Couldn't fetch info from this link. You can fill it manually." });
        return;
      }

      if (!data) {
        setExtractError({ index, message: "No data returned from this link." });
        return;
      }

      let appliedSomething = false;

      // Artist name — overwrite UNLESS user manually typed it
      if (data.artist_name && !userEditedRef.current.name) {
        console.log("[MusicExtract] applying artist_name:", data.artist_name);
        setDisplayName(data.artist_name);
        appliedSomething = true;
      }

      // Artist image — overwrite UNLESS user manually uploaded
      if (data.image_url && !userEditedRef.current.image) {
        console.log("[MusicExtract] applying image_url:", data.image_url);
        setArtistImage(data.image_url);
        appliedSomething = true;
      }

      // Genres — merge unique
      if (Array.isArray(data.genres) && data.genres.length > 0) {
        setGenres((prev) => {
          const merged = Array.from(new Set([...prev, ...data.genres]));
          console.log("[MusicExtract] genres merged:", merged);
          return merged;
        });
        appliedSomething = true;
      }

      // Top tracks — merge by name
      if (Array.isArray(data.top_tracks) && data.top_tracks.length > 0) {
        setTopTracks((prev) => {
          const existingNames = new Set(prev.map((t) => t.name?.toLowerCase()));
          const newOnes = data.top_tracks.filter(
            (t: TrackInfo) => t.name && !existingNames.has(t.name.toLowerCase())
          );
          return [...prev, ...newOnes];
        });
        appliedSomething = true;
      }

      // Albums — merge by name, with fallback for /album/ URLs
      const albumsFromData: AlbumInfo[] = Array.isArray(data.albums) ? [...data.albums] : [];
      if (albumsFromData.length === 0) {
        const fallback =
          (isAppleMusic && parseAppleMusicAlbumFallback(url, data.image_url)) ||
          (isSpotify && parseSpotifyAlbumFallback(url, data.image_url));
        if (fallback) {
          console.log("[MusicExtract] using album fallback:", fallback);
          albumsFromData.push(fallback);
        }
      }
      if (albumsFromData.length > 0) {
        setAlbums((prev) => {
          const existingNames = new Set(prev.map((a) => a.name?.toLowerCase()));
          const newOnes = albumsFromData.filter(
            (a) => a.name && !existingNames.has(a.name.toLowerCase())
          );
          return [...prev, ...newOnes];
        });
        appliedSomething = true;
      }

      // Spotify track URL fallback
      if (isSpotify && (!data.top_tracks || data.top_tracks.length === 0)) {
        const trackFallback = parseSpotifyTrackFallback(url, data.image_url);
        if (trackFallback) {
          setTopTracks((prev) => {
            if (prev.some((t) => t.spotify_url === url)) return prev;
            return [...prev, trackFallback];
          });
          appliedSomething = true;
        }
      }

      extractedUrlsRef.current.add(url);

      if (appliedSomething) {
        toast.success("Artist info extracted!");
      } else {
        setExtractError({
          index,
          message: "Link is valid but no extra info was found. Fill in the details manually.",
        });
      }
    } catch (e) {
      console.error("[MusicExtract] exception:", e);
      setExtractError({ index, message: "Extraction failed. Please fill the fields manually." });
    } finally {
      setFetchingLinkIndex(null);
    }
  };

  const handleLinkUrlChange = (index: number, url: string) => {
    const updated = [...links];
    updated[index] = { ...updated[index], url };

    // Auto-detect platform
    if (url.includes("open.spotify.com")) updated[index].platform = "spotify";
    else if (url.includes("music.apple.com")) updated[index].platform = "apple_music";
    else if (url.includes("soundcloud.com")) updated[index].platform = "soundcloud";
    else if (url.includes("music.youtube.com") || url.includes("youtube.com/channel")) updated[index].platform = "youtube_music";
    else if (url.includes("tidal.com")) updated[index].platform = "tidal";
    else if (url.includes("bandcamp.com")) updated[index].platform = "bandcamp";
    setLinks(updated);

    // Debounced extraction
    if (debounceTimers.current[index]) clearTimeout(debounceTimers.current[index]);
    const isSpotify = url.includes("open.spotify.com/") && url.length > 30;
    const isAppleMusic = url.includes("music.apple.com/") && url.length > 30;
    if (isSpotify || isAppleMusic) {
      debounceTimers.current[index] = setTimeout(() => {
        fetchArtistData(url, index);
      }, 400);
    }
  };

  const handleLinkPlatformChange = (index: number, platform: string) => {
    const updated = [...links];
    updated[index] = { ...updated[index], platform };
    setLinks(updated);
  };

  const addLink = () => setLinks([...links, { platform: "spotify", url: "" }]);
  const removeLink = (index: number) => setLinks(links.filter((_, i) => i !== index));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setIsUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${user.id}/artist-image-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from("media").getPublicUrl(filePath);
      setArtistImage(publicUrl.publicUrl);
      userEditedRef.current.image = true;
      toast.success("Artist image uploaded!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    const cleanName = displayName.trim();
    if (!cleanName || looksLikeUrl(cleanName)) {
      toast.error("Please enter a valid Artist / Band name");
      return;
    }
    setIsSaving(true);

    const validLinks = links.filter(l => l.url.trim());
    const spotifyLink = validLinks.find(l => l.platform === "spotify");
    const appleMusicLink = validLinks.find(l => l.platform === "apple_music");

    try {
      await saveMusicProfile.mutateAsync({
        display_name: cleanName,
        artist_image_url: artistImage || undefined,
        spotify_artist_url: spotifyLink?.url || undefined,
        spotify_artist_id: spotifyLink?.url?.match(/artist\/([a-zA-Z0-9]+)/)?.[1] || undefined,
        apple_music_artist_url: appleMusicLink?.url || undefined,
        apple_music_artist_id: appleMusicLink?.url?.match(/artist\/[^/]+\/(\d+)/)?.[1] || undefined,
        genres,
        top_tracks: topTracks,
        albums,
        platform_links: validLinks,
      });
      onOpenChange(false);
    } catch {
      // handled by mutation
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMusicProfile.mutateAsync();
      setDisplayName("");
      setArtistImage("");
      setLinks([{ platform: "spotify", url: "" }]);
      setGenres([]);
      setTopTracks([]);
      setAlbums([]);
      extractedUrlsRef.current.clear();
      userEditedRef.current = { name: false, image: false };
      onOpenChange(false);
    } catch {
      // handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="w-5 h-5 text-primary" />
            Connect Music Profile
          </DialogTitle>
          <DialogDescription>
            Paste your streaming links — we'll auto-extract your artist info.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 py-2">
            {/* Artist / Band Name */}
            <div className="space-y-2">
              <Label htmlFor="artist-name">Artist / Band Name *</Label>
              <Input
                id="artist-name"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  userEditedRef.current.name = e.target.value.trim().length > 0;
                }}
                placeholder="Auto-filled from URL or type manually"
              />
            </div>

            {/* Artist Image */}
            <div className="space-y-2">
              <Label>Artist Image</Label>
              <div className="flex items-center gap-3">
                {artistImage ? (
                  <img
                    src={artistImage}
                    alt="Artist"
                    className="w-16 h-16 rounded-full object-cover border-2 border-primary/30"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <Music className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                  >
                    {isUploadingImage ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Upload Image
                  </Button>
                  {artistImage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setArtistImage("");
                        userEditedRef.current.image = false;
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
              {!artistImage && (
                <p className="text-xs text-muted-foreground">Auto-pulled from your Spotify or Apple Music link</p>
              )}
            </div>

            {/* Platform Links */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Streaming Links</Label>
                <Button variant="ghost" size="sm" onClick={addLink} className="h-7 text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Add Link
                </Button>
              </div>

              {links.map((link, index) => (
                <div key={index} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <select
                      value={link.platform}
                      onChange={(e) => handleLinkPlatformChange(index, e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-[120px]"
                    >
                      {PLATFORM_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <Input
                      value={link.url}
                      onChange={(e) => handleLinkUrlChange(index, e.target.value)}
                      onPaste={(e) => {
                        // Force immediate extraction on paste
                        const pasted = e.clipboardData.getData("text");
                        if (pasted && (pasted.includes("open.spotify.com") || pasted.includes("music.apple.com"))) {
                          if (debounceTimers.current[index]) clearTimeout(debounceTimers.current[index]);
                          setTimeout(() => fetchArtistData(pasted.trim(), index), 50);
                        }
                      }}
                      placeholder={PLATFORM_OPTIONS.find(p => p.value === link.platform)?.placeholder || "Paste URL..."}
                      className="flex-1"
                    />
                    {links.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeLink(index)}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  {fetchingLinkIndex === index && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Extracting artist info...
                    </p>
                  )}
                  {extractError && extractError.index === index && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {extractError.message}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Extracted Genres */}
            {genres.length > 0 && (
              <div className="space-y-2">
                <Label>Genres (extracted)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {genres.map((genre, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {genre}
                      <button onClick={() => setGenres(genres.filter((_, j) => j !== i))} className="ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Extracted Top Tracks */}
            {topTracks.length > 0 && (
              <div className="space-y-2">
                <Label>Top Tracks (extracted)</Label>
                <div className="space-y-1">
                  {topTracks.slice(0, 5).map((track, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm p-1.5 rounded bg-muted/50">
                      {track.album_image && (
                        <img src={track.album_image} alt="" className="w-8 h-8 rounded object-cover" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-foreground">{track.name}</p>
                        {track.album_name && (
                          <p className="text-xs text-muted-foreground truncate">{track.album_name}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {topTracks.length > 5 && (
                    <p className="text-xs text-muted-foreground">+{topTracks.length - 5} more tracks</p>
                  )}
                </div>
              </div>
            )}

            {/* Extracted Albums */}
            {albums.length > 0 && (
              <div className="space-y-2">
                <Label>Albums (extracted)</Label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {albums.slice(0, 6).map((album, i) => (
                    <div key={i} className="shrink-0 w-20 text-center">
                      {album.image_url ? (
                        <img src={album.image_url} alt={album.name} className="w-20 h-20 rounded object-cover" />
                      ) : (
                        <div className="w-20 h-20 rounded bg-muted flex items-center justify-center">
                          <Music className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <p className="text-xs mt-1 truncate text-foreground">{album.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          {musicProfile ? (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-1" /> Remove
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !displayName.trim() || looksLikeUrl(displayName)}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectMusicDialog;
