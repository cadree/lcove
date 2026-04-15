import { useState, useRef, useEffect, useCallback } from "react";
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
import { Music, Loader2, Upload, Trash2, Plus, X, ExternalLink } from "lucide-react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (musicProfile) {
      setDisplayName(musicProfile.display_name || "");
      setArtistImage(musicProfile.artist_image_url || "");
      setGenres(musicProfile.genres || []);
      setTopTracks(musicProfile.top_tracks || []);
      setAlbums(musicProfile.albums || []);

      // Build links from both legacy fields and platform_links
      const existingLinks: PlatformLink[] = musicProfile.platform_links || [];
      
      // If we have legacy spotify/apple urls but they're not in platform_links, add them
      if (musicProfile.spotify_artist_url && !existingLinks.some(l => l.url === musicProfile.spotify_artist_url)) {
        existingLinks.unshift({ platform: "spotify", url: musicProfile.spotify_artist_url });
      }
      if (musicProfile.apple_music_artist_url && !existingLinks.some(l => l.url === musicProfile.apple_music_artist_url)) {
        existingLinks.push({ platform: "apple_music", url: musicProfile.apple_music_artist_url });
      }
      
      setLinks(existingLinks.length > 0 ? existingLinks : [{ platform: "spotify", url: "" }]);
    } else {
      setLinks([{ platform: "spotify", url: "" }]);
    }
  }, [musicProfile]);

  const fetchArtistData = useCallback(async (url: string, index: number) => {
    if (!url.trim()) return;
    const isSpotify = url.includes("open.spotify.com/artist");
    const isAppleMusic = url.includes("music.apple.com");
    if (!isSpotify && !isAppleMusic) return;

    setFetchingLinkIndex(index);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-artist-image", {
        body: { url },
      });
      if (!error && data) {
        if (data.image_url && !artistImage) setArtistImage(data.image_url);
        if (data.artist_name && !displayName) setDisplayName(data.artist_name);
        if (data.genres?.length && genres.length === 0) setGenres(data.genres);
        if (data.top_tracks?.length && topTracks.length === 0) setTopTracks(data.top_tracks);
        if (data.albums?.length && albums.length === 0) setAlbums(data.albums);
        toast.success("Artist info extracted!");
      }
    } catch (e) {
      console.error("Failed to fetch artist data:", e);
    } finally {
      setFetchingLinkIndex(null);
    }
  }, [artistImage, displayName, genres.length, topTracks.length, albums.length]);

  const handleLinkUrlChange = (index: number, url: string) => {
    const updated = [...links];
    updated[index] = { ...updated[index], url };
    setLinks(updated);

    // Auto-detect platform
    if (url.includes("open.spotify.com")) updated[index].platform = "spotify";
    else if (url.includes("music.apple.com")) updated[index].platform = "apple_music";
    else if (url.includes("soundcloud.com")) updated[index].platform = "soundcloud";
    else if (url.includes("music.youtube.com") || url.includes("youtube.com/channel")) updated[index].platform = "youtube_music";
    else if (url.includes("tidal.com")) updated[index].platform = "tidal";
    else if (url.includes("bandcamp.com")) updated[index].platform = "bandcamp";
    setLinks([...updated]);

    // Auto-fetch for Spotify/Apple Music
    const isSpotify = url.includes("open.spotify.com/artist") && url.length > 30;
    const isAppleMusic = url.includes("music.apple.com") && url.includes("artist") && url.length > 30;
    if (isSpotify || isAppleMusic) {
      fetchArtistData(url, index);
    }
  };

  const handleLinkPlatformChange = (index: number, platform: string) => {
    const updated = [...links];
    updated[index] = { ...updated[index], platform };
    setLinks(updated);
  };

  const addLink = () => {
    setLinks([...links, { platform: "spotify", url: "" }]);
  };

  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
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
    if (!displayName.trim()) {
      toast.error("Artist / Band name is required");
      return;
    }
    setIsSaving(true);

    // Extract legacy fields from links for backward compat
    const validLinks = links.filter(l => l.url.trim());
    const spotifyLink = validLinks.find(l => l.platform === "spotify");
    const appleMusicLink = validLinks.find(l => l.platform === "apple_music");

    try {
      await saveMusicProfile.mutateAsync({
        display_name: displayName.trim(),
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
      // error handled by mutation
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
      onOpenChange(false);
    } catch {
      // error handled by mutation
    }
  };

  const getPlatformLabel = (platform: string) =>
    PLATFORM_OPTIONS.find(p => p.value === platform)?.label || platform;

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
                onChange={(e) => setDisplayName(e.target.value)}
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
                    <Button variant="ghost" size="sm" onClick={() => setArtistImage("")}>
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
            <Button onClick={handleSave} disabled={isSaving || !displayName.trim()}>
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
