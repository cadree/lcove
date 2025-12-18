// WebRTC Streaming utilities with OPUS audio codec support

export interface StreamConfig {
  video: boolean;
  audio: boolean;
  videoConstraints?: MediaTrackConstraints;
  audioConstraints?: MediaTrackConstraints;
}

export const defaultStreamConfig: StreamConfig = {
  video: true,
  audio: true,
  videoConstraints: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  },
  audioConstraints: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000, // OPUS optimal sample rate
  },
};

export class LocalStream {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;

  async start(config: StreamConfig = defaultStreamConfig): Promise<MediaStream> {
    try {
      const constraints: MediaStreamConstraints = {
        video: config.video ? config.videoConstraints || true : false,
        audio: config.audio ? config.audioConstraints || true : false,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Local stream started:', this.stream.id);
      return this.stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }

  async attachToVideo(videoElement: HTMLVideoElement): Promise<void> {
    if (this.stream) {
      videoElement.srcObject = this.stream;
      videoElement.muted = true; // Prevent echo
      this.videoElement = videoElement;
      // Ensure playback starts
      try {
        await videoElement.play();
        console.log('Video playback started');
      } catch (err) {
        console.log('Video autoplay blocked, user interaction may be required:', err);
      }
    }
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log('Track stopped:', track.kind);
      });
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  toggleVideo(enabled: boolean) {
    if (this.stream) {
      this.stream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  toggleAudio(enabled: boolean) {
    if (this.stream) {
      this.stream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }
}

// Simple signaling channel using Supabase Realtime
export class SignalingChannel {
  private channel: any;
  private streamId: string;
  private userId: string;
  private onOfferCallback?: (offer: RTCSessionDescriptionInit, senderId: string) => void;
  private onAnswerCallback?: (answer: RTCSessionDescriptionInit, senderId: string) => void;
  private onIceCandidateCallback?: (candidate: RTCIceCandidateInit, senderId: string) => void;

  constructor(supabase: any, streamId: string, userId: string) {
    this.streamId = streamId;
    this.userId = userId;

    this.channel = supabase.channel(`stream-signaling-${streamId}`)
      .on('broadcast', { event: 'offer' }, ({ payload }: any) => {
        if (payload.senderId !== this.userId && this.onOfferCallback) {
          this.onOfferCallback(payload.offer, payload.senderId);
        }
      })
      .on('broadcast', { event: 'answer' }, ({ payload }: any) => {
        if (payload.senderId !== this.userId && this.onAnswerCallback) {
          this.onAnswerCallback(payload.answer, payload.senderId);
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, ({ payload }: any) => {
        if (payload.senderId !== this.userId && this.onIceCandidateCallback) {
          this.onIceCandidateCallback(payload.candidate, payload.senderId);
        }
      })
      .subscribe();
  }

  onOffer(callback: (offer: RTCSessionDescriptionInit, senderId: string) => void) {
    this.onOfferCallback = callback;
  }

  onAnswer(callback: (answer: RTCSessionDescriptionInit, senderId: string) => void) {
    this.onAnswerCallback = callback;
  }

  onIceCandidate(callback: (candidate: RTCIceCandidateInit, senderId: string) => void) {
    this.onIceCandidateCallback = callback;
  }

  async sendOffer(offer: RTCSessionDescriptionInit) {
    await this.channel.send({
      type: 'broadcast',
      event: 'offer',
      payload: { offer, senderId: this.userId },
    });
  }

  async sendAnswer(answer: RTCSessionDescriptionInit) {
    await this.channel.send({
      type: 'broadcast',
      event: 'answer',
      payload: { answer, senderId: this.userId },
    });
  }

  async sendIceCandidate(candidate: RTCIceCandidate) {
    await this.channel.send({
      type: 'broadcast',
      event: 'ice-candidate',
      payload: { candidate: candidate.toJSON(), senderId: this.userId },
    });
  }

  close() {
    this.channel?.unsubscribe();
  }
}

// WebRTC Peer Connection with OPUS codec preference
export class WebRTCPeer {
  private peerConnection: RTCPeerConnection;
  private signaling: SignalingChannel;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream = new MediaStream();
  private onRemoteStreamCallback?: (stream: MediaStream) => void;

  constructor(signaling: SignalingChannel) {
    this.signaling = signaling;

    // Configure ICE servers (STUN/TURN)
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    };

    this.peerConnection = new RTCPeerConnection(config);

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendIceCandidate(event.candidate);
      }
    };

    // Handle remote tracks
    this.peerConnection.ontrack = (event) => {
      console.log('Remote track received:', event.track.kind);
      this.remoteStream.addTrack(event.track);
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(this.remoteStream);
      }
    };

    // Set up signaling handlers
    this.signaling.onOffer(async (offer, senderId) => {
      console.log('Received offer from:', senderId);
      await this.handleOffer(offer);
    });

    this.signaling.onAnswer(async (answer, senderId) => {
      console.log('Received answer from:', senderId);
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    this.signaling.onIceCandidate(async (candidate, senderId) => {
      console.log('Received ICE candidate from:', senderId);
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    });
  }

  setLocalStream(stream: MediaStream) {
    this.localStream = stream;
    stream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, stream);
    });
  }

  onRemoteStream(callback: (stream: MediaStream) => void) {
    this.onRemoteStreamCallback = callback;
  }

  // Prefer OPUS codec for audio
  private preferOpusCodec(sdp: string): string {
    const lines = sdp.split('\r\n');
    const audioMLineIndex = lines.findIndex(line => line.startsWith('m=audio'));
    
    if (audioMLineIndex === -1) return sdp;

    // Find OPUS codec
    let opusPayload: string | null = null;
    for (let i = audioMLineIndex + 1; i < lines.length; i++) {
      if (lines[i].startsWith('m=')) break;
      const match = lines[i].match(/a=rtpmap:(\d+) opus/i);
      if (match) {
        opusPayload = match[1];
        break;
      }
    }

    if (!opusPayload) return sdp;

    // Move OPUS to front of audio line
    const audioLine = lines[audioMLineIndex];
    const parts = audioLine.split(' ');
    const payloads = parts.slice(3);
    const opusIndex = payloads.indexOf(opusPayload);
    
    if (opusIndex > 0) {
      payloads.splice(opusIndex, 1);
      payloads.unshift(opusPayload);
      parts.splice(3, payloads.length, ...payloads);
      lines[audioMLineIndex] = parts.join(' ');
    }

    return lines.join('\r\n');
  }

  async createOffer(): Promise<void> {
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    // Prefer OPUS codec
    if (offer.sdp) {
      offer.sdp = this.preferOpusCodec(offer.sdp);
    }

    await this.peerConnection.setLocalDescription(offer);
    await this.signaling.sendOffer(offer);
  }

  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await this.peerConnection.createAnswer();
    
    // Prefer OPUS codec
    if (answer.sdp) {
      answer.sdp = this.preferOpusCodec(answer.sdp);
    }

    await this.peerConnection.setLocalDescription(answer);
    await this.signaling.sendAnswer(answer);
  }

  getConnectionState(): RTCPeerConnectionState {
    return this.peerConnection.connectionState;
  }

  close() {
    this.peerConnection.close();
    this.signaling.close();
  }
}

// Check browser media capabilities
export const checkMediaCapabilities = async (): Promise<{
  hasCamera: boolean;
  hasMicrophone: boolean;
  cameraPermission: PermissionState | 'unknown';
  microphonePermission: PermissionState | 'unknown';
}> => {
  const result = {
    hasCamera: false,
    hasMicrophone: false,
    cameraPermission: 'unknown' as PermissionState | 'unknown',
    microphonePermission: 'unknown' as PermissionState | 'unknown',
  };

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    result.hasCamera = devices.some(d => d.kind === 'videoinput');
    result.hasMicrophone = devices.some(d => d.kind === 'audioinput');

    // Check permissions
    if (navigator.permissions) {
      try {
        const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        result.cameraPermission = cameraPermission.state;
      } catch {}

      try {
        const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        result.microphonePermission = micPermission.state;
      } catch {}
    }
  } catch (error) {
    console.error('Error checking media capabilities:', error);
  }

  return result;
};
