import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Radio, Users, Loader2, WifiOff, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface WebRTCStreamViewerProps {
  streamId: string;
  hostId: string;
  isLive: boolean;
  viewerCount: number;
  thumbnailUrl?: string | null;
}

export const WebRTCStreamViewer: React.FC<WebRTCStreamViewerProps> = ({ 
  streamId, 
  hostId,
  isLive,
  viewerCount,
  thumbnailUrl
}) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionState, setConnectionState] = useState<string>('connecting');
  const [hasVideo, setHasVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    console.log('[Viewer] Cleaning up...');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (!user || !isLive) {
      console.log('[Viewer] Cannot connect - user:', !!user, 'isLive:', isLive);
      return;
    }
    
    cleanup();
    
    setIsConnecting(true);
    setError(null);
    setConnectionState('connecting');
    setHasVideo(false);

    try {
      console.log('[Viewer] Connecting to stream:', streamId, 'Host:', hostId);
      
      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
      });
      peerConnectionRef.current = pc;

      // Handle incoming tracks from host
      pc.ontrack = (event) => {
        console.log('[Viewer] Received track:', event.track.kind);
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          videoRef.current.play().catch(err => {
            console.log('[Viewer] Autoplay blocked:', err);
          });
          setHasVideo(true);
          setIsConnecting(false);
          setConnectionState('connected');
        }
      };

      // Monitor connection state
      pc.onconnectionstatechange = () => {
        console.log('[Viewer] Connection state:', pc.connectionState);
        setConnectionState(pc.connectionState);
        
        if (pc.connectionState === 'connected') {
          setIsConnecting(false);
          setError(null);
        } else if (pc.connectionState === 'failed') {
          setError('Connection failed');
          setIsConnecting(false);
        } else if (pc.connectionState === 'disconnected') {
          // Try to reconnect after a short delay
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isLive) {
              console.log('[Viewer] Attempting reconnect...');
              connect();
            }
          }, 3000);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[Viewer] ICE state:', pc.iceConnectionState);
      };

      // Set up signaling channel
      const channel = supabase.channel(`stream-signaling-${streamId}`, {
        config: { broadcast: { self: false } }
      });
      channelRef.current = channel;

      // Listen for answer from host
      channel.on('broadcast', { event: 'answer' }, async ({ payload }: any) => {
        const { answer, senderId, targetId } = payload;
        
        // Only process answers meant for us from the host
        if (senderId !== hostId) return;
        if (targetId && targetId !== user.id) return;
        
        console.log('[Viewer] Received answer from host');
        
        try {
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('[Viewer] Set remote description');
          }
        } catch (err) {
          console.error('[Viewer] Error setting remote description:', err);
        }
      });

      // Listen for ICE candidates from host
      channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload }: any) => {
        const { candidate, senderId, targetId } = payload;
        
        // Only accept candidates from the host meant for us
        if (senderId !== hostId) return;
        if (targetId && targetId !== user.id) return;
        
        console.log('[Viewer] Received ICE candidate from host');
        
        try {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } catch (err) {
          console.error('[Viewer] Error adding ICE candidate:', err);
        }
      });

      // Subscribe to channel
      await new Promise<void>((resolve, reject) => {
        channel.subscribe((status) => {
          console.log('[Viewer] Signaling channel status:', status);
          if (status === 'SUBSCRIBED') {
            resolve();
          } else if (status === 'CHANNEL_ERROR') {
            reject(new Error('Failed to subscribe to signaling channel'));
          }
        });
      });

      // Send our ICE candidates to host
      pc.onicecandidate = (event) => {
        if (event.candidate && channelRef.current) {
          console.log('[Viewer] Sending ICE candidate to host');
          channelRef.current.send({
            type: 'broadcast',
            event: 'ice-candidate',
            payload: { 
              candidate: event.candidate.toJSON(), 
              senderId: user.id,
              targetId: hostId 
            },
          });
        }
      };

      // Add transceivers to receive video/audio
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      // Create and send offer to host
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      console.log('[Viewer] Sending offer to host');
      await channel.send({
        type: 'broadcast',
        event: 'offer',
        payload: { offer, senderId: user.id },
      });

      // Set timeout for connection
      setTimeout(() => {
        if (peerConnectionRef.current?.connectionState !== 'connected' && !hasVideo) {
          console.log('[Viewer] Connection timeout, still trying...');
        }
      }, 15000);

    } catch (err: any) {
      console.error('[Viewer] Error connecting to stream:', err);
      setError(err.message || 'Failed to connect');
      setConnectionState('failed');
      setIsConnecting(false);
    }
  }, [streamId, hostId, user, isLive, cleanup, hasVideo]);

  useEffect(() => {
    if (isLive && user) {
      // Small delay to ensure host is ready
      const timer = setTimeout(() => {
        connect();
      }, 500);
      
      return () => {
        clearTimeout(timer);
        cleanup();
      };
    }
    
    return cleanup;
  }, [isLive, user, connect, cleanup]);

  const handleRetry = () => {
    cleanup();
    connect();
  };

  if (!isLive) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-background">
        {thumbnailUrl ? (
          <div className="relative w-full h-full">
            <img 
              src={thumbnailUrl} 
              alt="Stream thumbnail" 
              className="w-full h-full object-cover opacity-50"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center bg-background/80 backdrop-blur-sm p-6 rounded-lg">
                <WifiOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-foreground font-medium">Stream is offline</p>
                <p className="text-sm text-muted-foreground">Check back when the host goes live</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <WifiOff className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Stream is offline</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black">
      {/* Thumbnail background while connecting */}
      {thumbnailUrl && isConnecting && (
        <img 
          src={thumbnailUrl} 
          alt="Stream thumbnail" 
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
      )}
      
      {/* Video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-contain ${!hasVideo ? 'hidden' : ''}`}
      />

      {/* Connecting overlay */}
      {isConnecting && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-background/80">
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <p className="text-foreground font-medium">Connecting to live stream...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Establishing connection with host
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-destructive/10 to-background">
          <div className="text-center">
            <WifiOff className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-foreground font-medium mb-2">Connection Error</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={handleRetry} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Connection
            </Button>
          </div>
        </div>
      )}

      {/* Audio only / waiting for video */}
      {!isConnecting && !hasVideo && !error && connectionState === 'connected' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-background">
          <div className="text-center">
            <Radio className="h-16 w-16 text-primary mx-auto mb-4 animate-pulse" />
            <p className="text-muted-foreground">Waiting for video...</p>
          </div>
        </div>
      )}

      {/* Status badges */}
      <div className="absolute top-4 left-4 flex gap-2 z-10">
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
        {connectionState === 'connected' && hasVideo && (
          <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/30">
            Connected
          </Badge>
        )}
      </div>
    </div>
  );
};
