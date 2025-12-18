import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music, Play, Pause, Volume2, VolumeX, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

// Icons for music services
const SpotifyIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const AppleMusicIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03c.525 0 1.048-.034 1.57-.1.823-.106 1.597-.35 2.296-.81.84-.553 1.472-1.287 1.88-2.208.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.785-.56-2.075-1.44-.313-.952.078-1.996 1.042-2.44.31-.143.644-.222.986-.298.424-.096.852-.168 1.273-.265.317-.073.544-.257.61-.596.014-.064.02-.13.02-.195v-3.43a.49.49 0 00-.04-.18c-.05-.12-.15-.184-.288-.17-.127.013-.25.04-.373.066l-4.68 1.015c-.035.008-.07.017-.104.028-.147.047-.207.132-.212.283-.003.053-.002.106-.002.16v6.212c0 .203-.01.406-.037.607-.07.49-.25.933-.59 1.3-.398.43-.897.652-1.475.728-.334.044-.67.054-1.003.026-.76-.063-1.418-.38-1.87-.99-.443-.596-.537-1.272-.373-1.984.17-.736.65-1.243 1.323-1.55.32-.146.664-.21 1.01-.27.474-.08.95-.15 1.42-.24.313-.06.535-.22.623-.536.026-.095.035-.197.035-.297V8.08c0-.083.006-.17.024-.25.062-.26.2-.4.47-.454.085-.017.17-.026.257-.04l5.373-1.14c.173-.037.348-.07.523-.1.094-.016.184.014.267.056.06.03.1.08.122.147.014.047.02.097.02.148v3.667h-.002z"/>
  </svg>
);

interface ProfileMusicPlayerProps {
  musicUrl: string | null;
  previewUrl?: string | null;
  title?: string | null;
  artist?: string | null;
  albumArtUrl?: string | null;
  albumName?: string | null;
  source?: 'spotify' | 'apple_music' | 'upload' | null;
  externalId?: string | null;
  autoPlay?: boolean;
}

export const ProfileMusicPlayer = ({ 
  musicUrl, 
  previewUrl,
  title, 
  artist,
  albumArtUrl,
  albumName,
  source = 'upload',
  externalId,
  autoPlay = false 
}: ProfileMusicPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [showPlayer, setShowPlayer] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showEmbed, setShowEmbed] = useState(false);

  // Determine the actual playback URL
  const playbackUrl = source === 'upload' ? musicUrl : previewUrl;
  const isStreamingService = source === 'spotify' || source === 'apple_music';

  useEffect(() => {
    if (playbackUrl && source === 'upload') {
      audioRef.current = new Audio(playbackUrl);
      audioRef.current.loop = true;
      audioRef.current.volume = volume;

      audioRef.current.addEventListener('timeupdate', () => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
        }
      });

      audioRef.current.addEventListener('loadedmetadata', () => {
        if (audioRef.current) {
          setDuration(audioRef.current.duration);
        }
      });

      return () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
      };
    }
  }, [playbackUrl, source]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
    if (isStreamingService) {
      setShowEmbed(true);
      setHasInteracted(true);
      return;
    }

    if (!audioRef.current) return;
    
    setHasInteracted(true);
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    if (value[0] > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current && source === 'upload') {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!musicUrl && !previewUrl) return null;

  if (!showPlayer) {
    return (
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-24 right-4 z-40 p-3 rounded-full bg-primary text-primary-foreground shadow-lg"
        onClick={() => setShowPlayer(true)}
      >
        <Music className="w-5 h-5" />
      </motion.button>
    );
  }

  // Spotify embed view
  if (showEmbed && source === 'spotify' && externalId) {
    return (
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-24 right-4 z-40 rounded-2xl overflow-hidden shadow-xl w-80"
      >
        <button
          onClick={() => setShowEmbed(false)}
          className="absolute top-2 right-2 z-10 p-1 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
        >
          <X className="w-4 h-4 text-white" />
        </button>
        <iframe
          src={`https://open.spotify.com/embed/track/${externalId}?utm_source=generator&theme=0`}
          width="100%"
          height="152"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="rounded-xl"
        />
      </motion.div>
    );
  }

  // Apple Music embed view
  if (showEmbed && source === 'apple_music' && previewUrl) {
    return (
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-24 right-4 z-40 rounded-2xl overflow-hidden shadow-xl w-80"
      >
        <button
          onClick={() => setShowEmbed(false)}
          className="absolute top-2 right-2 z-10 p-1 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
        >
          <X className="w-4 h-4 text-white" />
        </button>
        <iframe
          src={previewUrl}
          width="100%"
          height="175"
          frameBorder="0"
          allow="autoplay *; encrypted-media *; fullscreen *"
          sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
          className="rounded-xl"
        />
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-24 right-4 z-40 glass-strong rounded-2xl shadow-xl border border-border/50 w-72 overflow-hidden"
      >
        {/* Album Art Background Blur */}
        {albumArtUrl && (
          <div 
            className="absolute inset-0 opacity-30 blur-2xl"
            style={{ backgroundImage: `url(${albumArtUrl})`, backgroundSize: 'cover' }}
          />
        )}

        <div className="relative p-4">
          {/* Close Button */}
          <button
            onClick={() => setShowPlayer(false)}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors z-10"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* Music Info */}
          <div className="flex items-center gap-3 mb-4">
            <div className={cn(
              "w-14 h-14 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 transition-all",
              albumArtUrl ? "" : "bg-primary/20",
              isPlaying && !albumArtUrl && "animate-pulse"
            )}>
              {albumArtUrl ? (
                <img src={albumArtUrl} alt="Album art" className="w-full h-full object-cover" />
              ) : (
                <Music className="w-7 h-7 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                {source === 'spotify' && <SpotifyIcon className="w-3.5 h-3.5 text-[#1DB954]" />}
                {source === 'apple_music' && <AppleMusicIcon className="w-3.5 h-3.5 text-[#FA243C]" />}
                <p className="font-medium text-sm truncate text-foreground">
                  {title || 'Now Playing'}
                </p>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {artist || 'Unknown Artist'}
              </p>
              {albumName && (
                <p className="text-[10px] text-muted-foreground/70 truncate">
                  {albumName}
                </p>
              )}
            </div>
          </div>

          {/* Progress Bar (only for uploaded files) */}
          {source === 'upload' && duration > 0 && (
            <div className="mb-3 space-y-1">
              <Slider
                value={[currentTime]}
                max={duration}
                step={0.1}
                onValueChange={handleSeek}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {/* Visualizer Animation */}
          {isPlaying && source === 'upload' && (
            <div className="flex items-end justify-center gap-1 h-6 mb-3">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-primary rounded-full"
                  animate={{
                    height: [6, 20, 10, 26, 14][i % 5],
                  }}
                  transition={{
                    duration: 0.5,
                    repeat: Infinity,
                    repeatType: "reverse",
                    delay: i * 0.1,
                  }}
                />
              ))}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="ghost"
              onClick={togglePlay}
              className="h-10 w-10 rounded-full bg-primary/10 hover:bg-primary/20"
            >
              {isPlaying && source === 'upload' ? (
                <Pause className="w-5 h-5 text-primary" />
              ) : (
                <Play className="w-5 h-5 text-primary ml-0.5" />
              )}
            </Button>

            {source === 'upload' ? (
              <div className="flex items-center gap-2 flex-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsMuted(!isMuted)}
                  className="h-8 w-8"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.1}
                  onValueChange={handleVolumeChange}
                  className="flex-1"
                />
              </div>
            ) : (
              <a
                href={musicUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in {source === 'spotify' ? 'Spotify' : 'Apple Music'}
              </a>
            )}
          </div>

          {!hasInteracted && (
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              {isStreamingService ? 'Click play to open player' : 'Click play to start the music'}
            </p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
