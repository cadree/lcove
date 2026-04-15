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
import { Music, Loader2, Upload, Trash2 } from "lucide-react";
import { useMusicProfile } from "@/hooks/useMusicProfile";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ConnectMusicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ConnectMusicDialog = ({ open, onOpenChange }: ConnectMusicDialogProps) => {
  const { user } = useAuth();
  const { musicProfile, saveMusicProfile, deleteMusicProfile } = useMusicProfile();

  const [displayName, setDisplayName] = useState("");
  const [artistImage, setArtistImage] = useState("");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [appleMusicUrl, setAppleMusicUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingImage, setIsFetchingImage] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (musicProfile) {
      setDisplayName(musicProfile.display_name || "");
      setArtistImage(musicProfile.artist_image_url || "");
      setSpotifyUrl(musicProfile.spotify_artist_url || "");
      setAppleMusicUrl(musicProfile.apple_music_artist_url || "");
    }
  }, [musicProfile]);

  const fetchArtistData = async (url: string) => {
    if (!url.trim()) return;
    const isSpotify = url.includes("open.spotify.com/artist");
    const isAppleMusic = url.includes("music.apple.com");
    if (!isSpotify && !isAppleMusic) return;

    setIsFetchingImage(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-artist-image", {
        body: { url },
      });
      if (!error && data) {
        if (data.image_url && !artistImage) setArtistImage(data.image_url);
        if (data.artist_name && !displayName) setDisplayName(data.artist_name);
      }
    } catch (e) {
      console.error("Failed to fetch artist data:", e);
    } finally {
      setIsFetchingImage(false);
    }
  };

  const handleSpotifyUrlChange = (url: string) => {
    setSpotifyUrl(url);
    if (url.includes("open.spotify.com/artist") && url.length > 30) {
      fetchArtistData(url);
    }
  };

  const handleAppleMusicUrlChange = (url: string) => {
    setAppleMusicUrl(url);
    if (url.includes("music.apple.com") && url.includes("artist") && url.length > 30) {
      fetchArtistData(url);
    }
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
    try {
      await saveMusicProfile.mutateAsync({
        display_name: displayName.trim(),
        artist_image_url: artistImage || undefined,
        spotify_artist_url: spotifyUrl || undefined,
        spotify_artist_id: spotifyUrl.match(/artist\/([a-zA-Z0-9]+)/)?.[1] || undefined,
        apple_music_artist_url: appleMusicUrl || undefined,
        apple_music_artist_id: appleMusicUrl.match(/artist\/[^/]+\/(\d+)/)?.[1] || undefined,
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
      setSpotifyUrl("");
      setAppleMusicUrl("");
      onOpenChange(false);
    } catch {
      // error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="w-5 h-5 text-primary" />
            Connect Music Profile
          </DialogTitle>
          <DialogDescription>
            Link your streaming profiles so fans can find your music.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Artist / Band Name */}
          <div className="space-y-2">
            <Label htmlFor="artist-name">Artist / Band Name *</Label>
            <Input
              id="artist-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. The Weeknd"
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
          </div>

          {/* Spotify URL */}
          <div className="space-y-2">
            <Label htmlFor="spotify-url">Spotify Artist URL</Label>
            <Input
              id="spotify-url"
              value={spotifyUrl}
              onChange={(e) => handleSpotifyUrlChange(e.target.value)}
              placeholder="https://open.spotify.com/artist/..."
            />
            {isFetchingImage && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Fetching artist info...
              </p>
            )}
          </div>

          {/* Apple Music URL */}
          <div className="space-y-2">
            <Label htmlFor="apple-music-url">Apple Music Artist URL</Label>
            <Input
              id="apple-music-url"
              value={appleMusicUrl}
              onChange={(e) => handleAppleMusicUrlChange(e.target.value)}
              placeholder="https://music.apple.com/.../artist/..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
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
