import { useState, useRef, useEffect, useMemo } from "react";
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
import { errorMessage } from "@/lib/errorMessage";
import { ScrollArea } from "@/components/ui/scroll-area";
import { canExtractArtist, cleanMusicLinks, detectMusicPlatform, normalizeMusicUrl } from "@/lib/musicLinks";
import { createArtistExtractor } from "@/lib/artistExtract";

interface ConnectMusicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Profile name used when there is no music profile yet, so Save is never a dead end. */
  defaultName?: string | null;
}

const PLATFORM_OPTIONS = [
  { value: "spotify", label: "Spotify", placeholder: "https://open.spotify.com/artist/..." },
  { value: "apple_music", label: "Apple Music", placeholder: "https://music.apple.com/.../artist/..." },
  { value: "soundcloud", label: "SoundCloud", placeholder: "https://soundcloud.com/..." },
  { value: "youtube_music", label: "YouTube", placeholder: "https://music.youtube.com/watch?v=..." },
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

export const ConnectMusicDialog = ({ open, onOpenChange, defaultName }: ConnectMusicDialogProps) => {
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
  const [nameError, setNameError] = useState<string | null>(null);
  const [linkErrors, setLinkErrors] = useState<Record<number, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  // Latest URL asked for per row; a slower earlier answer for the same row is dropped.
  const latestRequestRef = useRef<Record<number, string>>({});
  const pastedRef = useRef<Record<number, boolean>>({});
  const extract = useMemo(
    () =>
      createArtistExtractor(async (url) =>
        supabase.functions.invoke("fetch-artist-image", { body: { url } }),
      ),
    [],
  );

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
      const fallbackName = (defaultName || "").trim();
      if (fallbackName && !looksLikeUrl(fallbackName)) setDisplayName((current) => current || fallbackName);
      userEditedRef.current = { name: false, image: false };
    }
  }, [musicProfile, defaultName]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
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

  const fetchArtistData = async (rawUrl: string, index: number) => {
    const url = normalizeMusicUrl(rawUrl);
    if (!url || !canExtractArtist(url)) return;
    const isSpotify = detectMusicPlatform(url) === "spotify";
    const isAppleMusic = detectMusicPlatform(url) === "apple_music";
    if (extractedUrlsRef.current.has(url)) return;
    latestRequestRef.current[index] = url;

    setFetchingLinkIndex(index);
    setExtractError(null);

    try {
      const outcome = await extract(url);
      // The row changed while this was loading; its newer link wins.
      if (latestRequestRef.current[index] !== url) return;

      if (!outcome.ok) {
        setExtractError({
          index,
          message: outcome.reason === "error"
            ? "Couldn't reach Spotify or Apple Music just now. Your link still saves. Add your name below."
            : "Link saved, but we couldn't read details from it. Add your name below.",
        });
        return;
      }
      const data = outcome.data;

      let appliedSomething = false;

      // Artist name — overwrite UNLESS user manually typed it
      if (data.artist_name && !userEditedRef.current.name) {
        setDisplayName(data.artist_name);
        setNameError(null);
        appliedSomething = true;
      }

      // Artist image — overwrite UNLESS user manually uploaded
      if (data.image_url && !userEditedRef.current.image) {
        setArtistImage(data.image_url);
        appliedSomething = true;
      }

      // Genres — merge unique
      if (Array.isArray(data.genres) && data.genres.length > 0) {
        setGenres((prev) => {
          const merged = Array.from(new Set([...prev, ...data.genres]));
          return merged;
        });
        appliedSomething = true;
      }

      // Top tracks — merge by name
      if (Array.isArray(data.top_tracks) && data.top_tracks.length > 0) {
        setTopTracks((prev) => {
          const existingNames = new Set(prev.map((t) => t.name?.toLowerCase()));
          const newOnes = (data.top_tracks as unknown as TrackInfo[]).filter(
            (t) => t.name && !existingNames.has(t.name.toLowerCase())
          );
          return [...prev, ...newOnes];
        });
        appliedSomething = true;
      }

      // Albums — merge by name, with fallback for /album/ URLs
      const albumsFromData: AlbumInfo[] = Array.isArray(data.albums) ? [...(data.albums as unknown as AlbumInfo[])] : [];
      if (albumsFromData.length === 0) {
        const fallback =
          (isAppleMusic && parseAppleMusicAlbumFallback(url, data.image_url)) ||
          (isSpotify && parseSpotifyAlbumFallback(url, data.image_url));
        if (fallback) {
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
        toast.success("Filled in from your link");
      } else {
        setExtractError({
          index,
          message: "Link is valid but no extra info was found. Fill in the details manually.",
        });
      }
    } finally {
      if (latestRequestRef.current[index] === url) setFetchingLinkIndex(null);
    }
  };

  const handleLinkUrlChange = (index: number, url: string) => {
    const updated = [...links];
    updated[index] = { ...updated[index], url };
    const normalized = normalizeMusicUrl(url);
    const detected = normalized ? detectMusicPlatform(normalized) : "other";
    if (detected !== "other") updated[index].platform = detected;
    setLinks(updated);
    setLinkErrors((prev) => {
      if (!(index in prev)) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });

    // One extraction path for typing and pasting. A paste goes out right away;
    // typing waits for a pause.
    if (debounceTimers.current[index]) clearTimeout(debounceTimers.current[index]);
    const pasted = pastedRef.current[index];
    pastedRef.current[index] = false;
    if (normalized && canExtractArtist(normalized)) {
      debounceTimers.current[index] = setTimeout(() => {
        fetchArtistData(normalized, index);
      }, pasted ? 0 : 500);
    } else {
      latestRequestRef.current[index] = "";
      if (fetchingLinkIndex === index) setFetchingLinkIndex(null);
    }
  };

  const handleLinkPlatformChange = (index: number, platform: string) => {
    const updated = [...links];
    updated[index] = { ...updated[index], platform };
    setLinks(updated);
  };

  const addLink = () => setLinks([...links, { platform: "spotify", url: "" }]);
  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
    setLinkErrors({});
    setExtractError(null);
    latestRequestRef.current = {};
  };

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
      toast.error(errorMessage(error, "Failed to upload image"));
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    const cleanName = displayName.trim();
    const { links: validLinks, invalid } = cleanMusicLinks(links);
    if (invalid.length > 0) {
      setLinkErrors(Object.fromEntries(invalid.map((i) => [i, "This doesn't look like a link. Paste the full address from the app's Share button."])));
      return;
    }
    if (!cleanName || looksLikeUrl(cleanName)) {
      setNameError(looksLikeUrl(cleanName) ? "Use your artist or band name here, not a link." : "Add your artist or band name so people know whose music this is.");
      nameInputRef.current?.focus();
      nameInputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    setIsSaving(true);

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
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-4 sm:p-6" data-testid="connect-music-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="w-5 h-5 text-primary" />
            Connect your music
          </DialogTitle>
          <DialogDescription>
            Paste a link from Spotify, Apple Music, SoundCloud or YouTube. Spotify and Apple Music links fill in your name and photo, and visitors get a player on your profile.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 -mx-4 px-4 sm:-mx-6 sm:px-6">
          <div className="space-y-5 py-2">
            {/* Platform Links */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Your links</Label>
                <Button variant="ghost" size="sm" onClick={addLink} className="min-h-11 text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Add link
                </Button>
              </div>

              {links.map((link, index) => (
                <div key={index} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <select
                      value={link.platform}
                      onChange={(e) => handleLinkPlatformChange(index, e.target.value)}
                      aria-label="Platform"
                      className="h-11 rounded-md border border-input bg-background px-2 text-sm w-[118px] shrink-0"
                    >
                      {PLATFORM_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <Input
                      value={link.url}
                      onChange={(e) => handleLinkUrlChange(index, e.target.value)}
                      onPaste={() => {
                        // onChange runs next with the pasted text; send it without the typing delay.
                        pastedRef.current[index] = true;
                      }}
                      inputMode="url"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-label="Music link"
                      aria-invalid={linkErrors[index] ? true : undefined}
                      placeholder={PLATFORM_OPTIONS.find(p => p.value === link.platform)?.placeholder || "Paste URL..."}
                      className="flex-1 min-w-0 h-11"
                    />
                    {links.length > 1 && (
                      <Button variant="ghost" size="icon" aria-label="Remove link" className="h-11 w-11 shrink-0" onClick={() => removeLink(index)}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  {fetchingLinkIndex === index && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Reading your link...
                    </p>
                  )}
                  {linkErrors[index] && (
                    <p role="alert" className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {linkErrors[index]}
                    </p>
                  )}
                  {extractError && extractError.index === index && (
                    <p className="text-xs text-muted-foreground flex items-start gap-1">
                      <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" /> {extractError.message}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Artist / Band Name */}
            <div className="space-y-2">
              <Label htmlFor="artist-name">Artist or band name</Label>
              <Input
                id="artist-name"
                ref={nameInputRef}
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setNameError(null);
                  userEditedRef.current.name = e.target.value.trim().length > 0;
                }}
                placeholder="Filled in from your link, or type it"
                className="h-11"
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? "artist-name-error" : undefined}
              />
              {nameError && (
                <p id="artist-name-error" role="alert" className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" /> {nameError}
                </p>
              )}
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
                    className="min-h-11"
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
                      className="min-h-11"
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
                <p className="text-xs text-muted-foreground">Filled in from a Spotify or Apple Music link, or upload one.</p>
              )}
            </div>

            {/* Extracted Genres */}
            {genres.length > 0 && (
              <div className="space-y-2">
                <Label>Genres (extracted)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {genres.map((genre, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {genre}
                      <button type="button" aria-label={`Remove ${genre}`} onClick={() => setGenres(genres.filter((_, j) => j !== i))} className="ml-1 -my-2 -mr-2 p-2">
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
        <div className="flex shrink-0 items-center justify-between gap-2 pt-2 border-t border-border/30">
          {musicProfile ? (
            <Button variant="destructive" size="sm" className="min-h-11" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-1" /> Remove
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="min-h-11" onClick={handleSave} disabled={isSaving} data-testid="connect-music-save">
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
