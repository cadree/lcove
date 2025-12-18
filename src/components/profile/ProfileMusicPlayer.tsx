import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music, Play, Pause, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface ProfileMusicPlayerProps {
  musicUrl: string;
  title?: string | null;
  artist?: string | null;
  autoPlay?: boolean;
}

export const ProfileMusicPlayer = ({ 
  musicUrl, 
  title, 
  artist,
  autoPlay = false 
}: ProfileMusicPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [showPlayer, setShowPlayer] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    audioRef.current = new Audio(musicUrl);
    audioRef.current.loop = true;
    audioRef.current.volume = volume;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [musicUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-24 right-4 z-40 glass-strong rounded-2xl p-4 shadow-xl border border-border/50 w-64"
      >
        {/* Close Button */}
        <button
          onClick={() => setShowPlayer(false)}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Music Info */}
        <div className="flex items-center gap-3 mb-4">
          <div className={cn(
            "w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center transition-all",
            isPlaying && "animate-pulse"
          )}>
            <Music className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate text-foreground">
              {title || 'Now Playing'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {artist || 'Unknown Artist'}
            </p>
          </div>
        </div>

        {/* Visualizer Animation */}
        {isPlaying && (
          <div className="flex items-end justify-center gap-1 h-8 mb-3">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="w-1 bg-primary rounded-full"
                animate={{
                  height: [8, 24, 12, 32, 16][i % 5],
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
            {isPlaying ? (
              <Pause className="w-5 h-5 text-primary" />
            ) : (
              <Play className="w-5 h-5 text-primary ml-0.5" />
            )}
          </Button>

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
        </div>

        {!hasInteracted && (
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Click play to start the music
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
