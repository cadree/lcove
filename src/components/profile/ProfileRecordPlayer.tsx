import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface ProfileRecordPlayerProps {
  musicUrl: string | null;
  previewUrl?: string | null;
  title?: string | null;
  artist?: string | null;
  albumArtUrl?: string | null;
  source?: 'spotify' | 'apple_music' | 'upload' | null;
  externalId?: string | null;
  defaultVolume?: number;
  isOwner?: boolean;
  onVolumeChange?: (volume: number) => void;
}

export const ProfileRecordPlayer = ({
  musicUrl,
  previewUrl,
  title,
  artist,
  albumArtUrl,
  source = 'upload',
  externalId,
  defaultVolume = 0.5,
  isOwner = false,
  onVolumeChange,
}: ProfileRecordPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(defaultVolume);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);

  // Determine the actual playback URL
  const playbackUrl = source === 'upload' ? musicUrl : previewUrl;
  const isStreamingService = source === 'spotify' || source === 'apple_music';

  useEffect(() => {
    if (playbackUrl && source === 'upload') {
      audioRef.current = new Audio(playbackUrl);
      audioRef.current.loop = true;
      audioRef.current.volume = defaultVolume;

      return () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
      };
    }
  }, [playbackUrl, source, defaultVolume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
    if (isStreamingService) {
      setShowEmbed(true);
      return;
    }

    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
    if (isOwner && onVolumeChange) {
      onVolumeChange(newVolume);
    }
  };

  if (!musicUrl && !previewUrl) return null;

  // Spotify embed view
  if (showEmbed && source === 'spotify' && externalId) {
    return (
      <div className="w-full rounded-xl overflow-hidden mb-6">
        <iframe
          src={`https://open.spotify.com/embed/track/${externalId}?utm_source=generator&theme=0`}
          width="100%"
          height="152"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="rounded-xl"
        />
      </div>
    );
  }

  // Apple Music embed
  if (showEmbed && source === 'apple_music' && previewUrl) {
    return (
      <div className="w-full rounded-xl overflow-hidden mb-6">
        <iframe
          src={previewUrl}
          width="100%"
          height="175"
          frameBorder="0"
          allow="autoplay *; encrypted-media *; fullscreen *"
          sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
          className="rounded-xl"
        />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="glass-strong rounded-xl p-4 mb-6"
    >
      <div className="flex items-center gap-4">
        {/* Spinning Record */}
        <div className="relative">
          <motion.div
            animate={{ rotate: isPlaying ? 360 : 0 }}
            transition={{
              duration: 3,
              repeat: isPlaying ? Infinity : 0,
              ease: "linear",
            }}
            className="relative w-20 h-20 sm:w-24 sm:h-24"
          >
            {/* Vinyl Record */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 shadow-xl">
              {/* Grooves */}
              <div className="absolute inset-2 rounded-full border border-zinc-700/50" />
              <div className="absolute inset-4 rounded-full border border-zinc-700/30" />
              <div className="absolute inset-6 rounded-full border border-zinc-700/20" />
              
              {/* Center Label */}
              <div className="absolute inset-0 m-auto w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-zinc-600">
                {albumArtUrl ? (
                  <img
                    src={albumArtUrl}
                    alt="Album art"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-primary/30 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-zinc-400" />
                  </div>
                )}
              </div>
            </div>
            
            {/* Shine effect */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
          </motion.div>
          
          {/* Playing indicator glow */}
          {isPlaying && (
            <motion.div
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -inset-2 rounded-full bg-primary/20 blur-xl -z-10"
            />
          )}
        </div>

        {/* Track Info & Controls */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate text-sm sm:text-base">
            {title || 'Now Playing'}
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">
            {artist || 'Unknown Artist'}
          </p>
          
          {/* Controls */}
          <div className="flex items-center gap-2 mt-3">
            <Button
              size="icon"
              variant="ghost"
              onClick={togglePlay}
              className="h-9 w-9 rounded-full bg-primary/10 hover:bg-primary/20"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 text-primary" />
              ) : (
                <Play className="w-4 h-4 text-primary ml-0.5" />
              )}
            </Button>

            {/* Volume Control */}
            {source === 'upload' && (
              <div 
                className="flex items-center gap-2"
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
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
                
                <AnimatePresence>
                  {(showVolumeSlider || isOwner) && (
                    <motion.div
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 80, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <Slider
                        value={[isMuted ? 0 : volume]}
                        max={1}
                        step={0.05}
                        onValueChange={handleVolumeChange}
                        className="w-20"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Streaming link */}
            {isStreamingService && (
              <Button
                size="sm"
                variant="ghost"
                onClick={togglePlay}
                className="text-xs text-muted-foreground"
              >
                Open Player
              </Button>
            )}
          </div>
          
          {isOwner && source === 'upload' && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Adjust volume visitors will hear
            </p>
          )}
        </div>
      </div>
      
      {/* Visualizer bars when playing */}
      {isPlaying && source === 'upload' && (
        <div className="flex items-end justify-center gap-1 h-4 mt-3">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="w-1 bg-primary/60 rounded-full"
              animate={{
                height: [4, 12, 6, 16, 8][i % 5],
              }}
              transition={{
                duration: 0.4,
                repeat: Infinity,
                repeatType: "reverse",
                delay: i * 0.05,
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
};
