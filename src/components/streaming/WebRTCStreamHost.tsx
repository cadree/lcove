import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Radio, 
  Users, 
  Loader2,
  AlertCircle,
  Save,
  RefreshCw
} from 'lucide-react';
import { LocalStream, SignalingChannel, WebRTCPeer, checkMediaCapabilities } from '@/utils/WebRTCStream';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useSaveReplay } from '@/hooks/useLiveStreams';
import { motion } from 'framer-motion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface WebRTCStreamHostProps {
  streamId: string;
  isLive?: boolean;
  onEnd: () => void;
}

type CameraState = 'requesting' | 'ready' | 'error' | 'denied';

export const WebRTCStreamHost: React.FC<WebRTCStreamHostProps> = ({ streamId, isLive: initialIsLive = false, onEnd }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const saveReplay = useSaveReplay();
  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<LocalStream | null>(null);
  const signalingRef = useRef<SignalingChannel | null>(null);
  const peersRef = useRef<Map<string, WebRTCPeer>>(new Map());

  const [isStreaming, setIsStreaming] = useState(initialIsLive);
  const [cameraState, setCameraState] = useState<CameraState>('requesting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [isGoingLive, setIsGoingLive] = useState(false);

  // Initialize camera preview
  const initCamera = useCallback(async () => {
    setCameraState('requesting');
    setErrorMessage('');

    try {
      console.log('Checking media capabilities...');
      const caps = await checkMediaCapabilities();
      console.log('Media capabilities:', caps);

      if (!caps.hasCamera && !caps.hasMicrophone) {
        setCameraState('error');
        setErrorMessage('No camera or microphone found. Please connect a media device.');
        return;
      }

      console.log('Requesting camera access...');
      localStreamRef.current = new LocalStream();
      const stream = await localStreamRef.current.start({
        video: caps.hasCamera,
        audio: caps.hasMicrophone,
      });
      console.log('Got media stream:', stream.id, 'tracks:', stream.getTracks().map(t => `${t.kind}:${t.label}`));

      // Attach to video element
      if (videoRef.current) {
        console.log('Attaching stream to video element...');
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = async () => {
          console.log('Video metadata loaded, attempting play...');
          try {
            await videoRef.current?.play();
            console.log('Video playing successfully');
            setCameraState('ready');
          } catch (playErr) {
            console.log('Autoplay blocked, will show play button:', playErr);
            setCameraState('ready'); // Still ready, just need user interaction
          }
        };
      } else {
        console.error('Video ref not available');
        setCameraState('error');
        setErrorMessage('Video element not ready. Please try again.');
      }
    } catch (err: any) {
      console.error('Camera init error:', err);
      
      if (err.name === 'NotAllowedError') {
        setCameraState('denied');
        setErrorMessage('Camera access was denied. Please allow camera access in your browser settings and try again.');
      } else if (err.name === 'NotFoundError') {
        setCameraState('error');
        setErrorMessage('No camera or microphone found. Please connect a device.');
      } else if (err.name === 'NotReadableError') {
        setCameraState('error');
        setErrorMessage('Camera is in use by another application. Please close other apps using the camera.');
      } else if (err.name === 'OverconstrainedError') {
        setCameraState('error');
        setErrorMessage('Camera does not support the required settings. Try a different camera.');
      } else {
        setCameraState('error');
        setErrorMessage(err.message || 'Failed to access camera. Please check your settings.');
      }
    }
  }, []);

  // Start camera on mount
  useEffect(() => {
    initCamera();

    return () => {
      // Cleanup on unmount
      if (localStreamRef.current) {
        localStreamRef.current.stop();
        localStreamRef.current = null;
      }
      if (signalingRef.current) {
        signalingRef.current.close();
        signalingRef.current = null;
      }
      peersRef.current.forEach(peer => peer.close());
      peersRef.current.clear();
    };
  }, [initCamera]);

  // Go live
  const startStream = async () => {
    if (!user || cameraState !== 'ready') return;
    
    setIsGoingLive(true);

    try {
      // Set up signaling channel
      signalingRef.current = new SignalingChannel(supabase, streamId, user.id);

      // Update stream status in database
      const { error } = await supabase
        .from('live_streams')
        .update({ 
          is_live: true, 
          started_at: new Date().toISOString() 
        })
        .eq('id', streamId);

      if (error) throw error;

      setIsStreaming(true);
      toast({ title: 'You are now live!' });
    } catch (err: any) {
      console.error('Error going live:', err);
      toast({ 
        title: 'Failed to go live', 
        description: err.message,
        variant: 'destructive' 
      });
    } finally {
      setIsGoingLive(false);
    }
  };

  // End stream confirmation
  const handleEndStream = () => {
    setShowEndDialog(true);
  };

  // Stop stream
  const stopStream = async (saveAsReplay: boolean) => {
    try {
      // Stop local stream
      localStreamRef.current?.stop();
      localStreamRef.current = null;

      // Close signaling
      signalingRef.current?.close();
      signalingRef.current = null;

      // Close all peer connections
      peersRef.current.forEach(peer => peer.close());
      peersRef.current.clear();

      // Update database
      await supabase
        .from('live_streams')
        .update({ 
          is_live: false, 
          ended_at: new Date().toISOString(),
          replay_available: saveAsReplay,
        })
        .eq('id', streamId);

      setIsStreaming(false);
      setShowEndDialog(false);
      toast({ title: saveAsReplay ? 'Stream ended & marked for replay!' : 'Stream ended' });
      onEnd();
    } catch (err: any) {
      console.error('Error ending stream:', err);
      toast({ title: 'Error ending stream', description: err.message, variant: 'destructive' });
    }
  };

  // Toggle video
  const toggleVideo = () => {
    const newState = !videoEnabled;
    localStreamRef.current?.toggleVideo(newState);
    setVideoEnabled(newState);
  };

  // Toggle audio
  const toggleAudio = () => {
    const newState = !audioEnabled;
    localStreamRef.current?.toggleAudio(newState);
    setAudioEnabled(newState);
  };

  // Subscribe to viewer count changes
  useEffect(() => {
    const channel = supabase
      .channel(`stream-viewers-${streamId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stream_viewers', filter: `stream_id=eq.${streamId}` },
        async () => {
          const { count } = await supabase
            .from('stream_viewers')
            .select('*', { count: 'exact', head: true })
            .eq('stream_id', streamId);
          setViewerCount(count || 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  const renderCameraContent = () => {
    switch (cameraState) {
      case 'requesting':
        return (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-background z-10">
            <div className="text-center">
              <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
              <p className="text-foreground font-medium">Starting camera...</p>
              <p className="text-xs text-muted-foreground mt-2">Please allow camera access when prompted</p>
            </div>
          </div>
        );
      
      case 'denied':
        return (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-destructive/10 to-background z-10">
            <div className="text-center max-w-sm px-4">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-foreground font-medium mb-2">Camera Access Denied</p>
              <p className="text-sm text-muted-foreground mb-4">{errorMessage}</p>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  1. Click the camera icon in your browser's address bar<br/>
                  2. Select "Allow" for camera and microphone<br/>
                  3. Click the button below to try again
                </p>
                <Button onClick={initCamera} variant="outline" className="mt-4">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        );
      
      case 'error':
        return (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-destructive/10 to-background z-10">
            <div className="text-center max-w-sm px-4">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-foreground font-medium mb-2">Camera Error</p>
              <p className="text-sm text-muted-foreground mb-4">{errorMessage}</p>
              <Button onClick={initCamera} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden min-h-[300px]">
      {/* Video Element - always rendered */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${cameraState !== 'ready' || !videoEnabled ? 'opacity-0' : 'opacity-100'}`}
        style={{ transform: 'scaleX(-1)' }} // Mirror for self-view
      />

      {/* Camera state overlays */}
      {renderCameraContent()}

      {/* Video disabled overlay */}
      {cameraState === 'ready' && !videoEnabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted/20 to-background">
          <div className="text-center">
            <VideoOff className="h-16 w-16 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Camera Off</p>
          </div>
        </div>
      )}

      {/* Status badges */}
      <div className="absolute top-4 left-4 flex gap-2 z-20">
        {cameraState === 'ready' && !isStreaming && (
          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
            Preview
          </Badge>
        )}
        {isStreaming && (
          <Badge className="bg-red-500 animate-pulse">
            <Radio className="h-3 w-3 mr-1" />
            LIVE
          </Badge>
        )}
        <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
          <Users className="h-3 w-3 mr-1" />
          {viewerCount}
        </Badge>
      </div>

      {/* Controls */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/90 backdrop-blur-sm rounded-full px-4 py-2 z-20"
      >
        {!isStreaming ? (
          <Button 
            onClick={startStream} 
            className="gap-2 bg-red-500 hover:bg-red-600"
            disabled={cameraState !== 'ready' || isGoingLive}
          >
            {isGoingLive ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Radio className="h-4 w-4" />
            )}
            Go Live
          </Button>
        ) : (
          <>
            <Button
              variant={videoEnabled ? 'secondary' : 'destructive'}
              size="icon"
              onClick={toggleVideo}
            >
              {videoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </Button>

            <Button
              variant={audioEnabled ? 'secondary' : 'destructive'}
              size="icon"
              onClick={toggleAudio}
            >
              {audioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </Button>

            <Button
              variant="destructive"
              onClick={handleEndStream}
            >
              End Stream
            </Button>
          </>
        )}
      </motion.div>

      {/* End Stream Dialog */}
      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End your stream?</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to mark this stream as replayable so viewers can watch it later?
              <br /><br />
              <span className="text-xs text-muted-foreground">
                Note: For full replay functionality, you would need to record the stream externally.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setShowEndDialog(false)}>
              Keep Streaming
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => stopStream(false)}
            >
              End (No Replay)
            </Button>
            <AlertDialogAction 
              onClick={() => stopStream(true)}
              className="bg-primary"
            >
              <Save className="h-4 w-4 mr-2" />
              End & Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
