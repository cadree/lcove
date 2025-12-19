import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Radio, AlertCircle } from 'lucide-react';

interface HLSPlayerProps {
  src: string;
  autoPlay?: boolean;
  muted?: boolean;
  className?: string;
  poster?: string;
  onError?: (error: Error) => void;
  onPlay?: () => void;
}

export const HLSPlayer: React.FC<HLSPlayerProps> = ({
  src,
  autoPlay = true,
  muted = false,
  className = '',
  poster,
  onError,
  onPlay,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const hlsRef = useRef<any>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let mounted = true;

    const loadVideo = async () => {
      setIsLoading(true);
      setHasError(false);

      // Check if HLS.js is needed (not Safari)
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = src;
        video.load();
        if (autoPlay) {
          try {
            await video.play();
          } catch (e) {
            console.log('Autoplay blocked, user interaction required');
          }
        }
      } else {
        // Use HLS.js for other browsers
        try {
          const Hls = (await import('hls.js')).default;
          
          if (!Hls.isSupported()) {
            setHasError(true);
            setErrorMessage('Your browser does not support HLS playback');
            return;
          }

          if (hlsRef.current) {
            hlsRef.current.destroy();
          }

          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
          });

          hlsRef.current = hls;

          hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            console.log('HLS media attached');
          });

          hls.on(Hls.Events.MANIFEST_PARSED, async () => {
            if (mounted) {
              setIsLoading(false);
              if (autoPlay) {
                try {
                  await video.play();
                } catch (e) {
                  console.log('Autoplay blocked');
                }
              }
            }
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              console.error('Fatal HLS error:', data);
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  setErrorMessage('Network error - stream may not be available');
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  setErrorMessage('Media error - trying to recover');
                  hls.recoverMediaError();
                  break;
                default:
                  setHasError(true);
                  setErrorMessage('Playback error occurred');
                  if (onError) onError(new Error(data.details));
                  break;
              }
            }
          });

          hls.loadSource(src);
          hls.attachMedia(video);
        } catch (error) {
          console.error('Error loading HLS.js:', error);
          setHasError(true);
          setErrorMessage('Failed to load video player');
        }
      }
    };

    loadVideo();

    return () => {
      mounted = false;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, autoPlay, onError]);

  const handleCanPlay = () => {
    setIsLoading(false);
  };

  const handlePlay = () => {
    if (onPlay) onPlay();
  };

  const handleError = () => {
    setHasError(true);
    setErrorMessage('Failed to load stream');
  };

  if (hasError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-muted/20 ${className}`}>
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading stream...</p>
          </div>
        </div>
      )}
      <video
        ref={videoRef}
        className="w-full h-full"
        autoPlay={autoPlay}
        muted={muted}
        playsInline
        controls
        poster={poster}
        onCanPlay={handleCanPlay}
        onPlay={handlePlay}
        onError={handleError}
      />
    </div>
  );
};
