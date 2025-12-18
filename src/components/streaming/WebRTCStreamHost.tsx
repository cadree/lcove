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
  AlertCircle
} from 'lucide-react';
import { LocalStream, SignalingChannel, WebRTCPeer, checkMediaCapabilities } from '@/utils/WebRTCStream';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

interface WebRTCStreamHostProps {
  streamId: string;
  onEnd: () => void;
}

export const WebRTCStreamHost: React.FC<WebRTCStreamHostProps> = ({ streamId, onEnd }) => {
  const { user } = useAuth();
  const { toast } = useToast();
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

  // Check media capabilities on mount
  useEffect(() => {
    const checkCapabilities = async () => {
      const caps = await checkMediaCapabilities();
      setMediaCapabilities(caps);
      
      if (!caps.hasCamera && !caps.hasMicrophone) {
        setError('No camera or microphone found. Please connect a media device.');
      }
      setIsLoading(false);
    };
    checkCapabilities();
  }, []);

  // Initialize stream
  const startStream = async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Start local stream
      localStreamRef.current = new LocalStream();
      const stream = await localStreamRef.current.start({
        video: mediaCapabilities?.hasCamera ?? true,
        audio: mediaCapabilities?.hasMicrophone ?? true,
      });

      // Attach to video element
      if (videoRef.current) {
        localStreamRef.current.attachToVideo(videoRef.current);
      }

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
      console.error('Error starting stream:', err);
      
      if (err.name === 'NotAllowedError') {
        setError('Camera/microphone access denied. Please allow access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera or microphone found. Please connect a media device.');
      } else {
        setError(err.message || 'Failed to start stream');
      }
      
      toast({ 
        title: 'Failed to start stream', 
        description: err.message,
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Stop stream
  const stopStream = async () => {
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

    setIsStreaming(false);
    toast({ title: 'Stream ended' });
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

  if (isLoading && !isStreaming) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Checking media devices...</p>
      </div>
    );
  }

  if (error && !isStreaming) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive font-medium">{error}</p>
        <Button onClick={() => setError(null)} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      {/* Video Preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${!videoEnabled ? 'hidden' : ''}`}
      />

      {/* Video disabled overlay */}
      {!videoEnabled && isStreaming && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-background">
          <div className="text-center">
            <VideoOff className="h-16 w-16 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Camera Off</p>
          </div>
        </div>
      )}

      {/* Status badges */}
      <div className="absolute top-4 left-4 flex gap-2">
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
            className="gap-2"
            disabled={isLoading}
          >
            {isLoading ? (
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
              onClick={stopStream}
            >
              End Stream
            </Button>
          </>
        )}
      </motion.div>
    </div>
  );
};
