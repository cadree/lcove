import React, { useState, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Radio, Users, Loader2, WifiOff } from 'lucide-react';
import { SignalingChannel, WebRTCPeer } from '@/utils/WebRTCStream';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface WebRTCStreamViewerProps {
  streamId: string;
  hostId: string;
  isLive: boolean;
  viewerCount: number;
}

export const WebRTCStreamViewer: React.FC<WebRTCStreamViewerProps> = ({ 
  streamId, 
  hostId,
  isLive,
  viewerCount 
}) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const signalingRef = useRef<SignalingChannel | null>(null);
  const peerRef = useRef<WebRTCPeer | null>(null);

  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionState, setConnectionState] = useState<string>('connecting');
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    if (!user || !isLive) return;

    const connect = async () => {
      try {
        // Set up signaling
        signalingRef.current = new SignalingChannel(supabase, streamId, user.id);
        peerRef.current = new WebRTCPeer(signalingRef.current);

        // Handle remote stream
        peerRef.current.onRemoteStream((stream) => {
          console.log('Got remote stream');
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setHasVideo(true);
          }
          setIsConnecting(false);
          setConnectionState('connected');
        });

        // Request to join the stream
        await peerRef.current.createOffer();

      } catch (error) {
        console.error('Error connecting to stream:', error);
        setConnectionState('failed');
        setIsConnecting(false);
      }
    };

    connect();

    // Poll connection state
    const interval = setInterval(() => {
      if (peerRef.current) {
        const state = peerRef.current.getConnectionState();
        setConnectionState(state);
        if (state === 'connected') {
          setIsConnecting(false);
        }
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      peerRef.current?.close();
      signalingRef.current?.close();
    };
  }, [streamId, user, isLive]);

  if (!isLive) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-background">
        <div className="text-center">
          <WifiOff className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Stream is offline</p>
          <p className="text-sm text-muted-foreground/60">Check back when the host goes live</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black">
      {/* Video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-contain ${!hasVideo ? 'hidden' : ''}`}
      />

      {/* Connecting overlay */}
      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-background">
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <p className="text-muted-foreground">Connecting to stream...</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Using P2P WebRTC with OPUS audio
            </p>
          </div>
        </div>
      )}

      {/* No video placeholder */}
      {!isConnecting && !hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-background">
          <div className="text-center">
            <Radio className="h-16 w-16 text-primary mx-auto mb-4 animate-pulse" />
            <p className="text-muted-foreground">Audio only stream</p>
          </div>
        </div>
      )}

      {/* Status badges */}
      <div className="absolute top-4 left-4 flex gap-2">
        {isLive && (
          <Badge className="bg-red-500 animate-pulse">
            <Radio className="h-3 w-3 mr-1" />
            LIVE
          </Badge>
        )}
        <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
          <Users className="h-3 w-3 mr-1" />
          {viewerCount}
        </Badge>
        <Badge variant="outline" className="bg-background/80 backdrop-blur-sm text-xs">
          {connectionState}
        </Badge>
      </div>
    </div>
  );
};
