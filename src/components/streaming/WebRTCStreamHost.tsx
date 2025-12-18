import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Radio, 
  Users, 
  Settings,
  Loader2,
  AlertCircle,
  Save
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
  onEnd: () => void;
}

export const WebRTCStreamHost: React.FC<WebRTCStreamHostProps> = ({ streamId, onEnd }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const saveReplay = useSaveReplay();
  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<LocalStream | null>(null);
  const signalingRef = useRef<SignalingChannel | null>(null);
  const peersRef = useRef<Map<string, WebRTCPeer>>(new Map());

  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mediaCapabilities, setMediaCapabilities] = useState<{
    hasCamera: boolean;
    hasMicrophone: boolean;
  } | null>(null);
  const [showEndDialog, setShowEndDialog] = useState(false);

  const [previewActive, setPreviewActive] = useState(false);

  // Start camera preview immediately on mount
  useEffect(() => {
    let mounted = true;
    
    const initPreview = async () => {
      try {
        console.log('Starting camera initialization...');
        const caps = await checkMediaCapabilities();
        setMediaCapabilities(caps);
        console.log('Media capabilities:', caps);

        if (!caps.hasCamera && !caps.hasMicrophone) {
          setError('No camera or microphone found. Please connect a media device.');
          setIsLoading(false);
          return;
        }

        // Start preview immediately
        localStreamRef.current = new LocalStream();
        const stream = await localStreamRef.current.start({
          video: caps.hasCamera,
          audio: caps.hasMicrophone,
        });
        console.log('Preview stream started:', stream.id, 'tracks:', stream.getTracks().map(t => t.kind));

        if (!mounted) {
          localStreamRef.current.stop();
          return;
        }

        // Attach to video element
        if (videoRef.current) {
          await localStreamRef.current.attachToVideo(videoRef.current);
          console.log('Stream attached to video element');
        } else {
          console.warn('Video ref not available');
        }

        setPreviewActive(true);
        setIsLoading(false);
      } catch (err: any) {
        console.error('Error starting preview:', err);
        
        if (!mounted) return;
        
        if (err.name === 'NotAllowedError') {
          setError('Camera/microphone access denied. Please click "Allow" when your browser asks for permission.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera or microphone found. Please connect a media device.');
        } else if (err.name === 'NotReadableError') {
          setError('Camera/microphone is already in use by another app. Please close other apps using it.');
        } else {
          setError(err.message || 'Failed to access camera/microphone');
        }
        setIsLoading(false);
      }
    };

    initPreview();

    return () => {
      mounted = false;
      // Cleanup on unmount if not streaming
      if (localStreamRef.current) {
        localStreamRef.current.stop();
      }
    };
  }, []);

  // Go live (preview already running)
  const startStream = async () => {
    if (!user || !previewActive) return;
    
    setIsLoading(true);

    try {
      // Set up signaling channel
      signalingRef.current = new SignalingChannel(supabase, streamId, user.id);

      // Update stream status in database
      await supabase
        .from('live_streams')
        .update({ 
          is_live: true, 
          started_at: new Date().toISOString() 
        })
        .eq('id', streamId);

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
      setIsLoading(false);
    }
  };

  // Stop stream - show dialog asking to save replay
  const handleEndStream = () => {
    setShowEndDialog(true);
  };

  const stopStream = async (saveAsReplay: boolean) => {
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
        ended_at: new Date().toISOString() 
      })
      .eq('id', streamId);

    // Save replay if requested
    if (saveAsReplay) {
      await saveReplay.mutateAsync({ streamId });
    }

    setIsStreaming(false);
    setShowEndDialog(false);
    toast({ title: saveAsReplay ? 'Stream ended & replay saved!' : 'Stream ended' });
    onEnd();
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localStreamRef.current?.stop();
      signalingRef.current?.close();
      peersRef.current.forEach(peer => peer.close());
    };
  }, []);

  // All states are now handled in the main return block

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden min-h-[300px]">
      {/* Video Preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${!videoEnabled || !previewActive ? 'hidden' : ''}`}
      />

      {/* Camera not ready overlay */}
      {!previewActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-background">
          <div className="text-center">
            {isLoading ? (
              <>
                <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
                <p className="text-muted-foreground">Starting camera...</p>
                <p className="text-xs text-muted-foreground/60 mt-2">Please allow camera access when prompted</p>
              </>
            ) : error ? (
              <>
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <p className="text-destructive font-medium">{error}</p>
                <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
                  Retry
                </Button>
              </>
            ) : (
              <>
                <Video className="h-12 w-12 text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Initializing camera...</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Video disabled overlay */}
      {!videoEnabled && previewActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-background">
          <div className="text-center">
            <VideoOff className="h-16 w-16 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Camera Off</p>
          </div>
        </div>
      )}

      {/* Status badges */}
      <div className="absolute top-4 left-4 flex gap-2">
        {previewActive && !isStreaming && (
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
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/90 backdrop-blur-sm rounded-full px-4 py-2"
      >
        {!isStreaming ? (
          <Button 
            onClick={startStream} 
            className="gap-2 bg-red-500 hover:bg-red-600"
            disabled={isLoading || !previewActive}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Radio className="h-4 w-4" />
            )}
            {previewActive ? 'Go Live' : 'Loading...'}
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
              Would you like to save this stream as a replay so viewers can watch it later?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setShowEndDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => stopStream(false)}
            >
              End without saving
            </Button>
            <AlertDialogAction 
              onClick={() => stopStream(true)}
              className="bg-primary"
            >
              <Save className="h-4 w-4 mr-2" />
              Save as replay
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
