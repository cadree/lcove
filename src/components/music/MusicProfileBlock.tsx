import { useState, useRef, forwardRef } from "react";
import { motion } from "framer-motion";
import { Music, Play, Pause, ExternalLink, Disc3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMusicProfile, MusicTrack, MusicAlbum } from "@/hooks/useMusicProfile";
import { cn } from "@/lib/utils";

interface MusicProfileBlockProps {
  userId?: string;
  onConnectClick?: () => void;
}

export const MusicProfileBlock = forwardRef<HTMLDivElement, MusicProfileBlockProps>(({ userId, onConnectClick }, ref) => {
  const { musicProfile, isLoading, isOwner } = useMusicProfile(userId);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayPause = (track: MusicTrack) => {
    if (!track.preview_url) return;

    if (playingTrackId === track.id) {
      audioRef.current?.pause();
      setPlayingTrackId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(track.preview_url);
      audioRef.current.play();
      audioRef.current.onended = () => setPlayingTrackId(null);
      setPlayingTrackId(track.id);
    }
  };

  if (isLoading) {
    return (
      <div className="glass-strong rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/4 mb-4" />
        <div className="space-y-3">
          <div className="h-16 bg-muted rounded" />
          <div className="h-16 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!musicProfile) {
    if (isOwner) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-accent/20 transition-colors"
          onClick={onConnectClick}
        >
          <Music className="w-8 h-8 text-muted-foreground mb-3" />
          <span className="text-muted-foreground font-medium">Connect Music</span>
          <span className="text-xs text-muted-foreground/60 mt-1">
            Link your Spotify or Apple Music
          </span>
        </motion.div>
      );
    }
    return null;
  }

  const hasSpotify = !!musicProfile.spotify_artist_url;
  const hasAppleMusic = !!musicProfile.apple_music_artist_url;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong rounded-xl p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {musicProfile.artist_image_url ? (
            <img
              src={musicProfile.artist_image_url}
              alt={musicProfile.display_name || "Artist"}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Music className="w-6 h-6 text-primary" />
            </div>
          )}
          <div>
            <h3 className="font-display text-lg font-medium text-foreground">
              {musicProfile.display_name || "Music"}
            </h3>
            {musicProfile.genres && musicProfile.genres.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {musicProfile.genres.slice(0, 3).join(" • ")}
              </p>
            )}
          </div>
        </div>

        {/* Platform Links */}
        <div className="flex gap-2">
          {hasSpotify && (
            <Button
              variant="glass"
              size="icon"
              className="h-8 w-8"
              onClick={() => window.open(musicProfile.spotify_artist_url, "_blank")}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
            </Button>
          )}
          {hasAppleMusic && (
            <Button
              variant="glass"
              size="icon"
              className="h-8 w-8"
              onClick={() => window.open(musicProfile.apple_music_artist_url, "_blank")}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 0 0-1.877-.726 10.496 10.496 0 0 0-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.8.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03c.525 0 1.048-.034 1.57-.1.823-.106 1.597-.35 2.296-.81.84-.553 1.472-1.287 1.88-2.208.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.8-.228-2.403-.95-.593-.71-.674-1.86.24-2.757.563-.553 1.27-.78 2.024-.86.37-.04.747-.036 1.12-.07.19-.017.378-.064.55-.155.23-.122.335-.32.34-.57l.003-4.963c0-.31-.168-.48-.478-.43-.365.06-.73.13-1.092.2-1.13.214-2.26.43-3.39.644l-1.763.334c-.328.063-.463.22-.468.555-.002.075 0 .15 0 .224l-.004 6.553c-.002.455-.057.904-.252 1.324-.3.65-.805 1.048-1.492 1.22-.344.085-.695.134-1.05.14-.905.012-1.725-.2-2.34-.916-.642-.747-.645-1.994.305-2.844.535-.48 1.183-.727 1.883-.812.43-.052.864-.034 1.295-.08.2-.022.396-.07.582-.145.215-.085.328-.26.338-.492.006-.14.002-.28.002-.42l.004-8.504c0-.182.027-.36.09-.532.11-.3.33-.46.622-.522.207-.044.418-.074.628-.106l1.203-.215c.79-.147 1.58-.293 2.37-.438l2.41-.45 1.322-.246c.17-.032.343-.052.516-.056.253-.007.413.168.413.418v.05z"/>
              </svg>
            </Button>
          )}
        </div>
      </div>

      {/* Latest Release */}
      {musicProfile.latest_release && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <Disc3 className="w-4 h-4 text-primary" />
            Latest Release
          </h4>
          <AlbumCard album={musicProfile.latest_release} />
        </div>
      )}

      {/* Top Tracks */}
      {musicProfile.top_tracks.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-foreground mb-2">Top Tracks</h4>
          <div className="space-y-2">
            {musicProfile.top_tracks.slice(0, 5).map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                isPlaying={playingTrackId === track.id}
                onPlayPause={() => handlePlayPause(track)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Albums */}
      {musicProfile.albums.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">Discography</h4>
          <div className="grid grid-cols-3 gap-2">
            {musicProfile.albums.slice(0, 6).map((album) => (
              <AlbumCard key={album.id} album={album} compact />
            ))}
          </div>
        </div>
      )}

      {/* Edit button for owner */}
      {isOwner && (
        <div className="mt-4 pt-4 border-t border-border/30">
          <Button variant="ghost" size="sm" className="w-full" onClick={onConnectClick}>
            Edit Music Profile
          </Button>
        </div>
      )}
    </motion.div>
  );
});

MusicProfileBlock.displayName = "MusicProfileBlock";

interface TrackRowProps {
  track: MusicTrack;
  isPlaying: boolean;
  onPlayPause: () => void;
}

const TrackRow = ({ track, isPlaying, onPlayPause }: TrackRowProps) => {
  const hasPreview = !!track.preview_url;

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/10 transition-colors group">
      {/* Album Art / Play Button */}
      <button
        onClick={onPlayPause}
        disabled={!hasPreview}
        className={cn(
          "w-10 h-10 rounded-md flex-shrink-0 flex items-center justify-center transition-all",
          hasPreview ? "cursor-pointer" : "cursor-default",
          track.album_image ? "" : "bg-muted"
        )}
        style={track.album_image ? { backgroundImage: `url(${track.album_image})`, backgroundSize: "cover" } : {}}
      >
        {hasPreview && (
          <div className={cn(
            "w-full h-full rounded-md flex items-center justify-center transition-opacity",
            isPlaying ? "bg-primary/80" : "bg-background/60 opacity-0 group-hover:opacity-100"
          )}>
            {isPlaying ? (
              <Pause className="w-4 h-4 text-primary-foreground" />
            ) : (
              <Play className="w-4 h-4 text-foreground" />
            )}
          </div>
        )}
      </button>

      {/* Track Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{track.name}</p>
        {track.album_name && (
          <p className="text-xs text-muted-foreground truncate">{track.album_name}</p>
        )}
      </div>

      {/* External Links */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {track.spotify_url && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => window.open(track.spotify_url, "_blank")}
          >
            <ExternalLink className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
};

interface AlbumCardProps {
  album: MusicAlbum;
  compact?: boolean;
}

const AlbumCard = ({ album, compact }: AlbumCardProps) => {
  const openLink = () => {
    const url = album.spotify_url || album.apple_music_url;
    if (url) window.open(url, "_blank");
  };

  if (compact) {
    return (
      <button
        onClick={openLink}
        className="group text-left"
      >
        <div
          className="aspect-square rounded-lg bg-muted mb-1 overflow-hidden"
          style={album.image_url ? { backgroundImage: `url(${album.image_url})`, backgroundSize: "cover" } : {}}
        >
          {!album.image_url && (
            <div className="w-full h-full flex items-center justify-center">
              <Disc3 className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
        </div>
        <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
          {album.name}
        </p>
        {album.release_date && (
          <p className="text-[10px] text-muted-foreground">
            {new Date(album.release_date).getFullYear()}
          </p>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={openLink}
      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/10 transition-colors w-full text-left group"
    >
      <div
        className="w-16 h-16 rounded-lg bg-muted flex-shrink-0 overflow-hidden"
        style={album.image_url ? { backgroundImage: `url(${album.image_url})`, backgroundSize: "cover" } : {}}
      >
        {!album.image_url && (
          <div className="w-full h-full flex items-center justify-center">
            <Disc3 className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
          {album.name}
        </p>
        <p className="text-sm text-muted-foreground">
          {album.type?.charAt(0).toUpperCase()}{album.type?.slice(1)} • {album.release_date ? new Date(album.release_date).getFullYear() : ""}
        </p>
        {album.total_tracks && (
          <p className="text-xs text-muted-foreground/70">{album.total_tracks} tracks</p>
        )}
      </div>
      <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
};

export default MusicProfileBlock;
