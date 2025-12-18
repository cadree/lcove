import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Music, Trash2, Plus, X, Loader2 } from "lucide-react";
import { useMusicProfile, MusicTrack, MusicAlbum } from "@/hooks/useMusicProfile";
import { toast } from "sonner";

interface ConnectMusicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ConnectMusicDialog = ({ open, onOpenChange }: ConnectMusicDialogProps) => {
  const { musicProfile, saveMusicProfile, deleteMusicProfile, isOwner } = useMusicProfile();
  
  const [spotifyUrl, setSpotifyUrl] = useState(musicProfile?.spotify_artist_url || "");
  const [appleMusicUrl, setAppleMusicUrl] = useState(musicProfile?.apple_music_artist_url || "");
  const [displayName, setDisplayName] = useState(musicProfile?.display_name || "");
  const [artistImage, setArtistImage] = useState(musicProfile?.artist_image_url || "");
  const [genres, setGenres] = useState<string[]>(musicProfile?.genres || []);
  const [newGenre, setNewGenre] = useState("");
  const [tracks, setTracks] = useState<MusicTrack[]>(musicProfile?.top_tracks || []);
  const [albums, setAlbums] = useState<MusicAlbum[]>(musicProfile?.albums || []);
  const [latestRelease, setLatestRelease] = useState<MusicAlbum | undefined>(musicProfile?.latest_release);
  const [isSaving, setIsSaving] = useState(false);

  // Update state when profile loads
  useState(() => {
    if (musicProfile) {
      setSpotifyUrl(musicProfile.spotify_artist_url || "");
      setAppleMusicUrl(musicProfile.apple_music_artist_url || "");
      setDisplayName(musicProfile.display_name || "");
      setArtistImage(musicProfile.artist_image_url || "");
      setGenres(musicProfile.genres || []);
      setTracks(musicProfile.top_tracks || []);
      setAlbums(musicProfile.albums || []);
      setLatestRelease(musicProfile.latest_release);
    }
  });

  const extractSpotifyId = (url: string): string | null => {
    const match = url.match(/artist\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  };

  const extractAppleMusicId = (url: string): string | null => {
    const match = url.match(/artist\/[^/]+\/(\d+)/);
    return match ? match[1] : null;
  };

  const handleAddGenre = () => {
    if (newGenre.trim() && !genres.includes(newGenre.trim())) {
      setGenres([...genres, newGenre.trim()]);
      setNewGenre("");
    }
  };

  const handleRemoveGenre = (genre: string) => {
    setGenres(genres.filter((g) => g !== genre));
  };

  const handleAddTrack = () => {
    const newTrack: MusicTrack = {
      id: crypto.randomUUID(),
      name: "",
    };
    setTracks([...tracks, newTrack]);
  };

  const handleUpdateTrack = (id: string, field: keyof MusicTrack, value: string) => {
    setTracks(tracks.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const handleRemoveTrack = (id: string) => {
    setTracks(tracks.filter((t) => t.id !== id));
  };

  const handleAddAlbum = () => {
    const newAlbum: MusicAlbum = {
      id: crypto.randomUUID(),
      name: "",
      type: "album",
    };
    setAlbums([...albums, newAlbum]);
  };

  const handleUpdateAlbum = (id: string, field: keyof MusicAlbum, value: string | number) => {
    setAlbums(albums.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
  };

  const handleRemoveAlbum = (id: string) => {
    setAlbums(albums.filter((a) => a.id !== id));
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast.error("Please enter an artist/display name");
      return;
    }

    setIsSaving(true);
    try {
      await saveMusicProfile.mutateAsync({
        spotify_artist_id: extractSpotifyId(spotifyUrl) || undefined,
        spotify_artist_url: spotifyUrl || undefined,
        apple_music_artist_id: extractAppleMusicId(appleMusicUrl) || undefined,
        apple_music_artist_url: appleMusicUrl || undefined,
        display_name: displayName,
        artist_image_url: artistImage || undefined,
        genres: genres.length > 0 ? genres : undefined,
        top_tracks: tracks.filter((t) => t.name.trim()) as any,
        albums: albums.filter((a) => a.name.trim()) as any,
        latest_release: latestRelease?.name ? (latestRelease as any) : undefined,
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to remove your music profile?")) {
      await deleteMusicProfile.mutateAsync();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[75vh] overflow-y-auto pb-24 sm:pb-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="w-5 h-5 text-primary" />
            Connect Music Profiles
          </DialogTitle>
          <DialogDescription>
            Link your Spotify and Apple Music profiles to display your music catalog.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="links" className="mt-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="links">Links</TabsTrigger>
            <TabsTrigger value="tracks">Tracks</TabsTrigger>
            <TabsTrigger value="albums">Albums</TabsTrigger>
            <TabsTrigger value="latest">Latest</TabsTrigger>
          </TabsList>

          <TabsContent value="links" className="space-y-4 mt-4">
            {/* Basic Info */}
            <div className="grid gap-4">
              <div>
                <Label htmlFor="displayName">Artist / Display Name *</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your artist name"
                />
              </div>

              <div>
                <Label htmlFor="artistImage">Artist Image URL</Label>
                <Input
                  id="artistImage"
                  value={artistImage}
                  onChange={(e) => setArtistImage(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div>
                <Label htmlFor="spotifyUrl">Spotify Artist URL</Label>
                <Input
                  id="spotifyUrl"
                  value={spotifyUrl}
                  onChange={(e) => setSpotifyUrl(e.target.value)}
                  placeholder="https://open.spotify.com/artist/..."
                />
              </div>

              <div>
                <Label htmlFor="appleMusicUrl">Apple Music Artist URL</Label>
                <Input
                  id="appleMusicUrl"
                  value={appleMusicUrl}
                  onChange={(e) => setAppleMusicUrl(e.target.value)}
                  placeholder="https://music.apple.com/artist/..."
                />
              </div>

              {/* Genres */}
              <div>
                <Label>Genres</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {genres.map((genre) => (
                    <span
                      key={genre}
                      className="px-2 py-1 bg-accent text-accent-foreground rounded-md text-sm flex items-center gap-1"
                    >
                      {genre}
                      <button onClick={() => handleRemoveGenre(genre)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newGenre}
                    onChange={(e) => setNewGenre(e.target.value)}
                    placeholder="Add a genre"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddGenre())}
                  />
                  <Button type="button" variant="outline" onClick={handleAddGenre}>
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tracks" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Add your top tracks to showcase on your profile.
            </p>
            
            <div className="space-y-3">
              {tracks.map((track) => (
                <div key={track.id} className="p-3 border border-border rounded-lg space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 grid gap-2">
                      <Input
                        placeholder="Track name"
                        value={track.name}
                        onChange={(e) => handleUpdateTrack(track.id, "name", e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Album name"
                          value={track.album_name || ""}
                          onChange={(e) => handleUpdateTrack(track.id, "album_name", e.target.value)}
                        />
                        <Input
                          placeholder="Album image URL"
                          value={track.album_image || ""}
                          onChange={(e) => handleUpdateTrack(track.id, "album_image", e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Preview URL (30s clip)"
                          value={track.preview_url || ""}
                          onChange={(e) => handleUpdateTrack(track.id, "preview_url", e.target.value)}
                        />
                        <Input
                          placeholder="Spotify/Apple Music link"
                          value={track.spotify_url || ""}
                          onChange={(e) => handleUpdateTrack(track.id, "spotify_url", e.target.value)}
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-2"
                      onClick={() => handleRemoveTrack(track.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button variant="outline" onClick={handleAddTrack} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add Track
            </Button>
          </TabsContent>

          <TabsContent value="albums" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Add your albums, EPs, and singles to your discography.
            </p>

            <div className="space-y-3">
              {albums.map((album) => (
                <div key={album.id} className="p-3 border border-border rounded-lg space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 grid gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Album name"
                          value={album.name}
                          onChange={(e) => handleUpdateAlbum(album.id, "name", e.target.value)}
                        />
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={album.type || "album"}
                          onChange={(e) => handleUpdateAlbum(album.id, "type", e.target.value)}
                        >
                          <option value="album">Album</option>
                          <option value="ep">EP</option>
                          <option value="single">Single</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Cover image URL"
                          value={album.image_url || ""}
                          onChange={(e) => handleUpdateAlbum(album.id, "image_url", e.target.value)}
                        />
                        <Input
                          type="date"
                          placeholder="Release date"
                          value={album.release_date || ""}
                          onChange={(e) => handleUpdateAlbum(album.id, "release_date", e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Spotify URL"
                          value={album.spotify_url || ""}
                          onChange={(e) => handleUpdateAlbum(album.id, "spotify_url", e.target.value)}
                        />
                        <Input
                          placeholder="Apple Music URL"
                          value={album.apple_music_url || ""}
                          onChange={(e) => handleUpdateAlbum(album.id, "apple_music_url", e.target.value)}
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-2"
                      onClick={() => handleRemoveAlbum(album.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button variant="outline" onClick={handleAddAlbum} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add Album/EP/Single
            </Button>
          </TabsContent>

          <TabsContent value="latest" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Highlight your latest release at the top of your music block.
            </p>

            <div className="p-4 border border-border rounded-lg space-y-3">
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Release Name</Label>
                    <Input
                      placeholder="Release name"
                      value={latestRelease?.name || ""}
                      onChange={(e) =>
                        setLatestRelease({ ...latestRelease, id: latestRelease?.id || crypto.randomUUID(), name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={latestRelease?.type || "album"}
                      onChange={(e) =>
                        setLatestRelease({ ...latestRelease, id: latestRelease?.id || crypto.randomUUID(), name: latestRelease?.name || "", type: e.target.value as any })
                      }
                    >
                      <option value="album">Album</option>
                      <option value="ep">EP</option>
                      <option value="single">Single</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label>Cover Image URL</Label>
                  <Input
                    placeholder="https://..."
                    value={latestRelease?.image_url || ""}
                    onChange={(e) =>
                      setLatestRelease({ ...latestRelease, id: latestRelease?.id || crypto.randomUUID(), name: latestRelease?.name || "", image_url: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Release Date</Label>
                    <Input
                      type="date"
                      value={latestRelease?.release_date || ""}
                      onChange={(e) =>
                        setLatestRelease({ ...latestRelease, id: latestRelease?.id || crypto.randomUUID(), name: latestRelease?.name || "", release_date: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Total Tracks</Label>
                    <Input
                      type="number"
                      placeholder="12"
                      value={latestRelease?.total_tracks || ""}
                      onChange={(e) =>
                        setLatestRelease({ ...latestRelease, id: latestRelease?.id || crypto.randomUUID(), name: latestRelease?.name || "", total_tracks: parseInt(e.target.value) || undefined })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Spotify URL</Label>
                    <Input
                      placeholder="https://open.spotify.com/album/..."
                      value={latestRelease?.spotify_url || ""}
                      onChange={(e) =>
                        setLatestRelease({ ...latestRelease, id: latestRelease?.id || crypto.randomUUID(), name: latestRelease?.name || "", spotify_url: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Apple Music URL</Label>
                    <Input
                      placeholder="https://music.apple.com/album/..."
                      value={latestRelease?.apple_music_url || ""}
                      onChange={(e) =>
                        setLatestRelease({ ...latestRelease, id: latestRelease?.id || crypto.randomUUID(), name: latestRelease?.name || "", apple_music_url: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t border-border mt-6">
          {musicProfile && (
            <Button variant="ghost" onClick={handleDelete} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Remove Music Profile
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Profile"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectMusicDialog;
