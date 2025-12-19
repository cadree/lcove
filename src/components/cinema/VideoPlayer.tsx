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
  Lock,
  Crown,
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
  isPreviewOnly?: boolean;
  previewDuration?: number; // in seconds, default 30
  onSubscribe?: () => void;
  networkPrice?: number;
}

const PREVIEW_DURATION_DEFAULT = 30; // 30 seconds preview

export const VideoPlayer = ({
  content,
  episodeId,
  initialProgress = 0,
  onClose,
  isPreviewOnly = false,
  previewDuration = PREVIEW_DURATION_DEFAULT,
  onSubscribe,
  networkPrice,
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
  const [showPaywall, setShowPaywall] = useState(false);
  const [previewEnded, setPreviewEnded] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  const updateProgress = useUpdateWatchProgress();

  const videoUrl = content.video_url || content.external_video_url;

  // Handle preview mode - pause and show paywall when preview time reached
  useEffect(() => {
    if (isPreviewOnly && currentTime >= previewDuration && !previewEnded) {
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
      setPreviewEnded(true);
      setShowPaywall(true);
    }
  }, [currentTime, isPreviewOnly, previewDuration, previewEnded]);

  // Save progress periodically (only if not preview mode)
  useEffect(() => {
    if (isPreviewOnly) return;
    
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
  }, [currentTime, duration, content.id, episodeId, isPreviewOnly]);

  // Save progress on unmount (only if not preview mode)
  useEffect(() => {
    return () => {
      if (isPreviewOnly) return;
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
    if (isPlaying && !showPaywall) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying, showPaywall]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showPaywall) return;
      
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
  }, [isFullscreen, showPaywall]);

  const togglePlay = () => {
    if (previewEnded && isPreviewOnly) {
      setShowPaywall(true);
      return;
    }
    
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
      let newTime = videoRef.current.currentTime + seconds;
      
      // In preview mode, don't allow seeking past preview duration
      if (isPreviewOnly) {
        newTime = Math.min(newTime, previewDuration);
      }
      
      videoRef.current.currentTime = Math.max(0, Math.min(duration, newTime));
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      let newTime = value[0];
      
      // In preview mode, don't allow seeking past preview duration
      if (isPreviewOnly) {
        newTime = Math.min(newTime, previewDuration);
      }
      
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
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

  // Calculate preview progress percentage
  const previewProgress = isPreviewOnly 
    ? Math.min((currentTime / previewDuration) * 100, 100) 
    : 0;

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black"
      onMouseMove={resetControlsTimeout}
      onClick={showPaywall ? undefined : togglePlay}
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

      {/* Preview Badge */}
      {isPreviewOnly && !showPaywall && (
        <div className="absolute top-4 left-4 z-50 flex items-center gap-2 bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-full text-sm font-medium">
          <Play className="w-3 h-3" />
          Preview: {formatTime(Math.max(0, previewDuration - currentTime))} remaining
        </div>
      )}

      {isEmbed ? (
        // External Embed (YouTube, Vimeo) - For embeds, we can't control preview
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
            className={cn(
              "w-full h-full object-contain",
              showPaywall && "blur-sm"
            )}
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            playsInline
            onContextMenu={(e) => e.preventDefault()}
            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
            onDurationChange={() => setDuration(videoRef.current?.duration || 0)}
            onLoadedMetadata={() => {
              if (videoRef.current && initialProgress > 0 && !isPreviewOnly) {
                videoRef.current.currentTime = initialProgress;
              }
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onWaiting={() => setIsBuffering(true)}
            onPlaying={() => setIsBuffering(false)}
          />

          {/* Buffering Indicator */}
          {isBuffering && !showPaywall && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {/* Paywall Overlay */}
          {showPaywall && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-40"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center max-w-md px-6">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <Lock className="w-10 h-10 text-primary" />
                </div>
                
                <h2 className="text-2xl font-display font-bold text-white mb-2">
                  Preview Ended
                </h2>
                
                <p className="text-white/70 mb-6">
                  Subscribe to this network to watch the full content and access all exclusive films and shows.
                </p>

                {networkPrice && (
                  <div className="mb-6 p-4 rounded-lg bg-white/10 border border-white/20">
                    <div className="flex items-center justify-center gap-2 text-primary">
                      <Crown className="w-5 h-5" />
                      <span className="text-lg font-semibold">${networkPrice}/month</span>
                    </div>
                    <p className="text-sm text-white/60 mt-1">
                      Unlimited access to all content
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <Button
                    size="lg"
                    className="w-full gap-2"
                    onClick={() => {
                      onSubscribe?.();
                      onClose();
                    }}
                  >
                    <Crown className="w-5 h-5" />
                    Subscribe Now
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="lg"
                    className="w-full text-white/70"
                    onClick={onClose}
                  >
                    Maybe Later
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Controls Overlay */}
          {!showPaywall && (
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
                <div className="relative">
                  <Slider
                    value={[currentTime]}
                    min={0}
                    max={isPreviewOnly ? previewDuration : (duration || 100)}
                    step={1}
                    onValueChange={handleSeek}
                    className="w-full"
                  />
                  {/* Preview limit indicator */}
                  {isPreviewOnly && duration > 0 && (
                    <div 
                      className="absolute top-0 h-full bg-primary/30 pointer-events-none rounded"
                      style={{ 
                        width: `${(previewDuration / duration) * 100}%`,
                        maxWidth: '100%'
                      }}
                    />
                  )}
                </div>

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
                      {formatTime(currentTime)} / {formatTime(isPreviewOnly ? previewDuration : duration)}
                      {isPreviewOnly && (
                        <span className="text-primary ml-2">(Preview)</span>
                      )}
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
          )}
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