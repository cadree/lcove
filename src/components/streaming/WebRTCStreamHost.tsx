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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const hostReadyIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isStreaming, setIsStreaming] = useState(initialIsLive);
  const [cameraState, setCameraState] = useState<CameraState>('requesting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [isGoingLive, setIsGoingLive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize camera preview
  const initCamera = useCallback(async () => {
    setCameraState('requesting');
    setErrorMessage('');

    try {
      console.log('[Host] Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      
      console.log('[Host] Got media stream:', stream.id);
      localStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play();
            console.log('[Host] Video preview playing');
            setCameraState('ready');
          } catch (playErr) {
            console.log('[Host] Autoplay blocked:', playErr);
            setCameraState('ready');
          }
        };
      }
    } catch (err: any) {
      console.error('[Host] Camera init error:', err);
      
      if (err.name === 'NotAllowedError') {
        setCameraState('denied');
        setErrorMessage('Camera access was denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setCameraState('error');
        setErrorMessage('No camera or microphone found. Please connect a device.');
      } else if (err.name === 'NotReadableError') {
        setCameraState('error');
        setErrorMessage('Camera is in use by another application.');
      } else {
        setCameraState('error');
        setErrorMessage(err.message || 'Failed to access camera.');
      }
    }
  }, []);

  // ICE candidate queue per peer (for candidates received before remote description)
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // Create peer connection for a viewer
  const createPeerConnection = useCallback((viewerId: string): RTCPeerConnection => {
    console.log('[Host] Creating peer connection for viewer:', viewerId);
    
    // Initialize pending candidates queue for this viewer
    pendingCandidatesRef.current.set(viewerId, []);
    
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        // OpenRelay TURN servers for NAT traversal (free tier)
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
      ],
      iceCandidatePoolSize: 10,
    });

    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        console.log('[Host] Adding track to peer:', track.kind, track.label);
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Send ICE candidates to this specific viewer
    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        console.log('[Host] Sending ICE candidate to viewer:', viewerId);
        channelRef.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { 
            candidate: event.candidate.toJSON(), 
            senderId: user?.id,
            targetId: viewerId 
          },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[Host] Peer connection state for', viewerId, ':', pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        peersRef.current.delete(viewerId);
        pendingCandidatesRef.current.delete(viewerId);
        pc.close();
      }
    };

    return pc;
  }, [user]);

  // Broadcast host-ready signal to all waiting viewers
  const broadcastHostReady = useCallback(() => {
    if (channelRef.current && user) {
      console.log('[Host] Broadcasting host-ready signal');
      channelRef.current.send({
        type: 'broadcast',
        event: 'host-ready',
        payload: { hostId: user.id, streamId },
      });
    }
  }, [user, streamId]);

  // Setup signaling channel for host
  const setupSignaling = useCallback(() => {
    if (!user) return;
    
    console.log('[Host] Setting up signaling channel for stream:', streamId);
    
    const channel = supabase.channel(`stream-signaling-${streamId}`, {
      config: { broadcast: { self: false } }
    });
    channelRef.current = channel;

    // Listen for viewer-join requests (viewers asking if host is ready)
    channel.on('broadcast', { event: 'viewer-join' }, ({ payload }: any) => {
      console.log('[Host] Viewer asking to join:', payload.viewerId);
      // Respond with host-ready if we have the camera
      if (localStreamRef.current) {
        channel.send({
          type: 'broadcast',
          event: 'host-ready',
          payload: { hostId: user.id, streamId },
        });
      }
    });

    // Listen for offers from viewers
    channel.on('broadcast', { event: 'offer' }, async ({ payload }: any) => {
      const { offer, senderId } = payload;
      if (!senderId || senderId === user.id) return;
      
      console.log('[Host] Received offer from viewer:', senderId);
      
      try {
        // Create or get peer connection for this viewer
        let pc = peersRef.current.get(senderId);
        if (pc) {
          pc.close();
        }
        pc = createPeerConnection(senderId);
        peersRef.current.set(senderId, pc);

        // Set remote description (viewer's offer)
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Process any pending ICE candidates for this viewer
        const pendingCandidates = pendingCandidatesRef.current.get(senderId) || [];
        console.log('[Host] Processing', pendingCandidates.length, 'pending ICE candidates for viewer:', senderId);
        for (const candidate of pendingCandidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error('[Host] Error adding pending ICE candidate:', err);
          }
        }
        pendingCandidatesRef.current.set(senderId, []);
        
        // Create and send answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        console.log('[Host] Sending answer to viewer:', senderId);
        await channel.send({
          type: 'broadcast',
          event: 'answer',
          payload: { 
            answer, 
            senderId: user.id,
            targetId: senderId 
          },
        });
      } catch (err) {
        console.error('[Host] Error handling offer:', err);
      }
    });

    // Listen for ICE candidates from viewers
    channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload }: any) => {
      const { candidate, senderId, targetId } = payload;
      
      // Only process candidates meant for us (host)
      if (targetId && targetId !== user.id) return;
      if (!senderId || senderId === user.id) return;
      
      console.log('[Host] Received ICE candidate from viewer:', senderId);
      
      const pc = peersRef.current.get(senderId);
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('[Host] Error adding ICE candidate:', err);
        }
      } else {
        // Queue the candidate for later processing
        console.log('[Host] Queuing ICE candidate for viewer:', senderId);
        const pending = pendingCandidatesRef.current.get(senderId) || [];
        pending.push(candidate);
        pendingCandidatesRef.current.set(senderId, pending);
      }
    });

    channel.subscribe((status) => {
      console.log('[Host] Signaling channel status:', status);
      if (status === 'SUBSCRIBED') {
        // Broadcast that host is ready when channel is subscribed
        broadcastHostReady();
      }
    });
  }, [streamId, user, createPeerConnection, broadcastHostReady]);

  // Start recording
  const startRecording = (stream: MediaStream) => {
    recordedChunksRef.current = [];
    
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    
    let mimeType = '';
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        break;
      }
    }
    
    if (!mimeType) {
      console.warn('[Host] No supported video recording format found');
      return;
    }
    
    console.log('[Host] Starting recording with mimeType:', mimeType);
    
    try {
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
    } catch (err) {
      console.error('[Host] Failed to start recording:', err);
    }
  };

  // Stop recording and get blob
  const stopRecording = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve(recordedChunksRef.current.length > 0 
          ? new Blob(recordedChunksRef.current, { type: 'video/webm' }) 
          : null);
        return;
      }
      
      mediaRecorder.onstop = () => {
        if (recordedChunksRef.current.length > 0) {
          resolve(new Blob(recordedChunksRef.current, { type: 'video/webm' }));
        } else {
          resolve(null);
        }
      };
      
      mediaRecorder.stop();
    });
  };

  // Setup signaling channel as soon as camera is ready
  useEffect(() => {
    if (cameraState === 'ready' && localStreamRef.current && user) {
      console.log('[Host] Camera ready, setting up signaling channel early');
      setupSignaling();
    }
    
    return () => {
      // Cleanup signaling if camera state changes
      if (channelRef.current && cameraState !== 'ready') {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [cameraState, user, setupSignaling]);

  // Periodic host-ready broadcast while streaming
  useEffect(() => {
    if (isStreaming && channelRef.current) {
      console.log('[Host] Starting periodic host-ready broadcasts');
      
      // Broadcast immediately
      broadcastHostReady();
      
      // Then broadcast every 3 seconds while live
      hostReadyIntervalRef.current = setInterval(() => {
        if (channelRef.current && isStreaming) {
          console.log('[Host] Periodic host-ready broadcast');
          broadcastHostReady();
        }
      }, 3000);
    }
    
    return () => {
      if (hostReadyIntervalRef.current) {
        clearInterval(hostReadyIntervalRef.current);
        hostReadyIntervalRef.current = null;
      }
    };
  }, [isStreaming, broadcastHostReady]);

  // Go live
  const startStream = async () => {
    if (!user || cameraState !== 'ready' || !localStreamRef.current) return;
    
    setIsGoingLive(true);

    try {
      // Ensure signaling is set up (it should already be from the effect above)
      if (!channelRef.current) {
        setupSignaling();
        // Small delay to ensure channel is ready
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Start recording
      startRecording(localStreamRef.current);

      // Update stream status in database FIRST
      const { error } = await supabase
        .from('live_streams')
        .update({ 
          is_live: true, 
          started_at: new Date().toISOString() 
        })
        .eq('id', streamId);

      if (error) throw error;

      // Set streaming state - this triggers the periodic broadcast effect
      setIsStreaming(true);
      
      // Also broadcast immediately multiple times with small delays
      // to ensure all waiting viewers receive it
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          broadcastHostReady();
        }, i * 200);
      }
      
      toast({ title: 'You are now live!' });
    } catch (err: any) {
      console.error('[Host] Error going live:', err);
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
      setIsSaving(saveAsReplay);
      
      // Stop periodic host-ready broadcasts
      if (hostReadyIntervalRef.current) {
        clearInterval(hostReadyIntervalRef.current);
        hostReadyIntervalRef.current = null;
      }
      
      let replayUrl: string | null = null;
      
      if (saveAsReplay) {
        const blob = await stopRecording();
        
        if (blob && blob.size > 0 && user) {
          console.log('[Host] Uploading replay, size:', blob.size);
          
          const fileName = `replays/${user.id}/${streamId}-${Date.now()}.webm`;
          const { error: uploadError } = await supabase.storage
            .from('media')
            .upload(fileName, blob, {
              contentType: 'video/webm',
              upsert: true,
            });
          
          if (uploadError) {
            console.error('[Host] Upload error:', uploadError);
            toast({ 
              title: 'Failed to save replay', 
              description: uploadError.message,
              variant: 'destructive' 
            });
          } else {
            const { data: urlData } = supabase.storage
              .from('media')
              .getPublicUrl(fileName);
            
            replayUrl = urlData.publicUrl;
          }
        } else {
          toast({ 
            title: 'No recording data', 
            description: 'The stream was too short to save.',
            variant: 'destructive' 
          });
        }
      } else {
        await stopRecording();
      }

      // Stop local stream
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;

      // Close signaling
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      // Close all peer connections
      peersRef.current.forEach(pc => pc.close());
      peersRef.current.clear();

      // Update database
      await supabase
        .from('live_streams')
        .update({ 
          is_live: false, 
          ended_at: new Date().toISOString(),
          replay_available: saveAsReplay && !!replayUrl,
          replay_url: replayUrl,
        })
        .eq('id', streamId);

      setIsStreaming(false);
      setShowEndDialog(false);
      setIsSaving(false);
      
      if (saveAsReplay && replayUrl) {
        toast({ title: 'Stream ended & replay saved!' });
      } else {
        toast({ title: 'Stream ended' });
      }
      
      onEnd();
    } catch (err: any) {
      console.error('[Host] Error ending stream:', err);
      setIsSaving(false);
      toast({ title: 'Error ending stream', description: err.message, variant: 'destructive' });
    }
  };

  // Toggle video
  const toggleVideo = () => {
    const newState = !videoEnabled;
    localStreamRef.current?.getVideoTracks().forEach(track => {
      track.enabled = newState;
    });
    setVideoEnabled(newState);
  };

  // Toggle audio
  const toggleAudio = () => {
    const newState = !audioEnabled;
    localStreamRef.current?.getAudioTracks().forEach(track => {
      track.enabled = newState;
    });
    setAudioEnabled(newState);
  };

  // Start camera on mount
  useEffect(() => {
    initCamera();

    return () => {
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      peersRef.current.forEach(pc => pc.close());
      peersRef.current.clear();
    };
  }, [initCamera]);

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
              <Button onClick={initCamera} variant="outline" className="mt-4">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
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
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden min-h-[300px] flex flex-col">
      {/* Video Element */}
      <div className="relative flex-1 min-h-0">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${cameraState !== 'ready' || !videoEnabled ? 'opacity-0' : 'opacity-100'}`}
          style={{ transform: 'scaleX(-1)' }}
        />

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
        <div className="absolute top-3 left-3 right-3 flex gap-2 z-20">
          {cameraState === 'ready' && !isStreaming && (
            <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-xs">
              Preview
            </Badge>
          )}
          {isStreaming && (
            <Badge className="bg-red-500 animate-pulse text-xs">
              <Radio className="h-3 w-3 mr-1" />
              LIVE
            </Badge>
          )}
          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-xs">
            <Users className="h-3 w-3 mr-1" />
            {viewerCount}
          </Badge>
        </div>
      </div>

      {/* Controls - Mobile-first centered layout */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-shrink-0 px-4 py-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent"
      >
        <div className="flex flex-col items-center gap-2 w-full max-w-[280px] mx-auto">
          {/* Camera + Mic toggles */}
          {cameraState === 'ready' && (
            <div className="flex items-center justify-center gap-6">
              <Button
                variant={videoEnabled ? 'secondary' : 'destructive'}
                size="icon"
                onClick={toggleVideo}
                className="h-11 w-11 rounded-full"
              >
                {videoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </Button>

              <Button
                variant={audioEnabled ? 'secondary' : 'destructive'}
                size="icon"
                onClick={toggleAudio}
                className="h-11 w-11 rounded-full"
              >
                {audioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
            </div>
          )}

          {/* Start/End Stream button */}
          {!isStreaming ? (
            <Button 
              onClick={startStream} 
              className="w-full gap-2 bg-red-500 hover:bg-red-600 h-11 text-sm font-semibold rounded-xl"
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
            <Button
              variant="destructive"
              onClick={handleEndStream}
              className="w-full h-11 text-sm font-semibold rounded-xl"
            >
              End Stream
            </Button>
          )}
        </div>
      </motion.div>

      {/* End Stream Dialog */}
      <AlertDialog open={showEndDialog} onOpenChange={(open) => !isSaving && setShowEndDialog(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isSaving ? 'Saving replay...' : 'End your stream?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isSaving ? (
                <div className="flex items-center gap-3 py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span>Uploading your stream recording...</span>
                </div>
              ) : (
                'Would you like to save this stream as a replay so viewers can watch it later?'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!isSaving && (
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
                End & Save Replay
              </AlertDialogAction>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
