import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  X,
  SkipBack,
  SkipForward,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { NetworkContent, useUpdateWatchProgress } from '@/hooks/useCinema';
import { cn } from '@/lib/utils';

interface VideoPlayerProps {
  content: NetworkContent;
  episodeId?: string;
  initialProgress?: number;
  onClose: () => void;
}

export const VideoPlayer = ({
  content,
  episodeId,
  initialProgress = 0,
  onClose,
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  const updateProgress = useUpdateWatchProgress();

  const videoUrl = content.video_url || content.external_video_url;

  // Save progress periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentTime > 0 && duration > 0) {
        updateProgress.mutate({
          contentId: content.id,
          episodeId,
          progressSeconds: Math.floor(currentTime),
          durationSeconds: Math.floor(duration),
        });
      }
    }, 30000); // Save every 30 seconds

    return () => clearInterval(interval);
  }, [currentTime, duration, content.id, episodeId]);

  // Save progress on unmount
  useEffect(() => {
    return () => {
      if (currentTime > 0 && duration > 0) {
        updateProgress.mutate({
          contentId: content.id,
          episodeId,
          progressSeconds: Math.floor(currentTime),
          durationSeconds: Math.floor(duration),
        });
      }
    };
  }, []);

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'm':
          setIsMuted((prev) => !prev);
          break;
        case 'ArrowLeft':
          seek(-10);
          break;
        case 'ArrowRight':
          seek(10);
          break;
        case 'Escape':
          if (isFullscreen) {
            document.exitFullscreen();
          } else {
            onClose();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const seek = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(
        0,
        Math.min(duration, videoRef.current.currentTime + seconds)
      );
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Check if it's an external embed (YouTube, Vimeo, etc.)
  const isEmbed = content.external_video_url && 
    (content.external_video_url.includes('youtube.com') || 
     content.external_video_url.includes('vimeo.com') ||
     content.external_video_url.includes('youtu.be'));

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black"
      onMouseMove={resetControlsTimeout}
      onClick={togglePlay}
    >
      {/* Close Button - Always visible */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X className="w-6 h-6" />
      </Button>

      {isEmbed ? (
        // External Embed (YouTube, Vimeo)
        <iframe
          src={content.external_video_url?.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
          className="w-full h-full"
          allowFullScreen
          allow="autoplay; encrypted-media"
        />
      ) : videoUrl ? (
        // Native Video Player
        <>
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
            onDurationChange={() => setDuration(videoRef.current?.duration || 0)}
            onLoadedMetadata={() => {
              if (videoRef.current && initialProgress > 0) {
                videoRef.current.currentTime = initialProgress;
              }
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onWaiting={() => setIsBuffering(true)}
            onPlaying={() => setIsBuffering(false)}
          />

          {/* Buffering Indicator */}
          {isBuffering && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {/* Controls Overlay */}
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 transition-opacity",
              showControls ? "opacity-100" : "opacity-0"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar - Title */}
            <div className="absolute top-0 left-0 right-0 p-6">
              <h2 className="font-display text-2xl text-white">{content.title}</h2>
            </div>

            {/* Center Play Button */}
            <div className="absolute inset-0 flex items-center justify-center">
              {!isPlaying && (
                <Button
                  size="lg"
                  className="w-20 h-20 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm"
                  onClick={togglePlay}
                >
                  <Play className="w-10 h-10 text-white ml-1" />
                </Button>
              )}
            </div>

            {/* Bottom Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-6 space-y-4">
              {/* Progress Bar */}
              <Slider
                value={[currentTime]}
                min={0}
                max={duration || 100}
                step={1}
                onValueChange={handleSeek}
                className="w-full"
              />

              {/* Control Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={togglePlay}
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6" />
                    ) : (
                      <Play className="w-6 h-6" />
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={() => seek(-10)}
                  >
                    <SkipBack className="w-5 h-5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={() => seek(10)}
                  >
                    <SkipForward className="w-5 h-5" />
                  </Button>

                  {/* Volume */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/20"
                      onClick={() => {
                        setIsMuted(!isMuted);
                        if (videoRef.current) {
                          videoRef.current.muted = !isMuted;
                        }
                      }}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-5 h-5" />
                      ) : (
                        <Volume2 className="w-5 h-5" />
                      )}
                    </Button>
                    <Slider
                      value={[isMuted ? 0 : volume]}
                      min={0}
                      max={1}
                      step={0.1}
                      onValueChange={handleVolumeChange}
                      className="w-24"
                    />
                  </div>

                  {/* Time */}
                  <span className="text-white text-sm">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                  >
                    <Settings className="w-5 h-5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={toggleFullscreen}
                  >
                    {isFullscreen ? (
                      <Minimize className="w-5 h-5" />
                    ) : (
                      <Maximize className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        // No Video Available
        <div className="w-full h-full flex flex-col items-center justify-center text-white">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">{content.title}</h2>
            <p className="text-white/70">Video not available yet</p>
          </div>
        </div>
      )}
    </motion.div>
  );
};
