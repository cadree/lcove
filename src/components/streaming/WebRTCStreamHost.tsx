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
  const localStreamRef = useRef<LocalStream | null>(null);
  const signalingRef = useRef<SignalingChannel | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

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

  // Start recording
  const startRecording = (stream: MediaStream) => {
    recordedChunksRef.current = [];
    
    // Determine best supported mime type
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];
    
    let mimeType = '';
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        break;
      }
    }
    
    if (!mimeType) {
      console.warn('No supported video recording format found');
      return;
    }
    
    console.log('Starting recording with mimeType:', mimeType);
    
    try {
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          console.log('Recorded chunk:', event.data.size, 'bytes');
        }
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
      };
      
      mediaRecorder.start(1000); // Capture in 1-second chunks
      mediaRecorderRef.current = mediaRecorder;
      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  // Stop recording and get blob
  const stopRecording = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        console.log('No active recording to stop');
        resolve(recordedChunksRef.current.length > 0 
          ? new Blob(recordedChunksRef.current, { type: 'video/webm' }) 
          : null);
        return;
      }
      
      mediaRecorder.onstop = () => {
        console.log('Recording stopped, chunks:', recordedChunksRef.current.length);
        if (recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          console.log('Created blob:', blob.size, 'bytes');
          resolve(blob);
        } else {
          resolve(null);
        }
      };
      
      mediaRecorder.stop();
    });
  };

  // Handle incoming viewer connections
  const setupHostSignaling = useCallback(() => {
    if (!signalingRef.current || !localStreamRef.current) return;
    
    const stream = localStreamRef.current.getStream();
    if (!stream) return;
    
    console.log('Setting up host signaling to accept viewer connections...');
    
    // When a viewer sends an offer, create a peer connection and respond
    signalingRef.current.onOffer(async (offer, viewerId) => {
      console.log('Received offer from viewer:', viewerId);
      
      // Create a peer connection for this viewer
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      
      // Add our local stream tracks to the connection
      stream.getTracks().forEach(track => {
        console.log('Adding track to peer:', track.kind);
        peerConnection.addTrack(track, stream);
      });
      
      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && signalingRef.current) {
          signalingRef.current.sendIceCandidate(event.candidate);
        }
      };
      
      peerConnection.onconnectionstatechange = () => {
        console.log('Peer connection state:', peerConnection.connectionState);
      };
      
      // Set the remote offer and create answer
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      // Send answer back
      if (signalingRef.current) {
        await signalingRef.current.sendAnswer(answer);
      }
      
      // Store peer connection
      peersRef.current.set(viewerId, peerConnection as any);
      console.log('Answered viewer:', viewerId, 'Total peers:', peersRef.current.size);
    });
    
    // Handle ICE candidates from viewers
    signalingRef.current.onIceCandidate(async (candidate, viewerId) => {
      console.log('Received ICE candidate from viewer:', viewerId);
      const peer = peersRef.current.get(viewerId);
      if (peer) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    });
  }, []);

  // Go live
  const startStream = async () => {
    if (!user || cameraState !== 'ready') return;
    
    setIsGoingLive(true);

    try {
      // Set up signaling channel
      signalingRef.current = new SignalingChannel(supabase, streamId, user.id);

      // Get the media stream and start recording
      const stream = localStreamRef.current?.getStream();
      if (stream) {
        startRecording(stream);
      }
      
      // Setup signaling to handle incoming viewer connections
      setupHostSignaling();

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
      setIsSaving(saveAsReplay);
      
      let replayUrl: string | null = null;
      
      // Stop recording and upload if saving replay
      if (saveAsReplay) {
        const blob = await stopRecording();
        
        if (blob && blob.size > 0 && user) {
          console.log('Uploading replay, size:', blob.size);
          
          // Upload to Supabase storage
          const fileName = `replays/${user.id}/${streamId}-${Date.now()}.webm`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('media')
            .upload(fileName, blob, {
              contentType: 'video/webm',
              upsert: true,
            });
          
          if (uploadError) {
            console.error('Upload error:', uploadError);
            toast({ 
              title: 'Failed to save replay', 
              description: uploadError.message,
              variant: 'destructive' 
            });
          } else {
            console.log('Upload successful:', uploadData);
            // Get public URL
            const { data: urlData } = supabase.storage
              .from('media')
              .getPublicUrl(fileName);
            
            replayUrl = urlData.publicUrl;
            console.log('Replay URL:', replayUrl);
          }
        } else {
          console.log('No recording data to save');
          toast({ 
            title: 'No recording data', 
            description: 'The stream was too short to save.',
            variant: 'destructive' 
          });
        }
      } else {
        // Just stop recording without saving
        await stopRecording();
      }

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
          replay_available: saveAsReplay && !!replayUrl,
          replay_url: replayUrl,
        })
        .eq('id', streamId);

      setIsStreaming(false);
      setShowEndDialog(false);
      setIsSaving(false);
      
      if (saveAsReplay && replayUrl) {
        toast({ title: 'Stream ended & replay saved!' });
      } else if (saveAsReplay) {
        toast({ title: 'Stream ended', description: 'Replay could not be saved.' });
      } else {
        toast({ title: 'Stream ended' });
      }
      
      onEnd();
    } catch (err: any) {
      console.error('Error ending stream:', err);
      setIsSaving(false);
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
                  <span>Uploading your stream recording. This may take a moment...</span>
                </div>
              ) : (
                <>
                  Would you like to save this stream as a replay so viewers can watch it later?
                  <br /><br />
                  <span className="text-xs text-muted-foreground">
                    Your stream will be saved and available for playback.
                  </span>
                </>
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
