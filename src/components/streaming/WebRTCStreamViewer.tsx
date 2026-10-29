import React, { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteParticipant, type RemoteTrack } from "livekit-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Radio, RefreshCw, Users, VideoOff, Volume2, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/errorMessage";
import { LIVE_VIDEO_NOT_CONFIGURED, nextTokenRefreshDelay, parseLiveKitTokenResponse, type LiveKitSession } from "@/lib/livekitSession";
import { prepareVideoElement, setAudioSession } from "@/lib/livePhone";
import {
  EMPTY_VIEWER_PICTURE,
  hostCameraOff,
  reduceViewerPicture,
  type ViewerPictureEvent,
  type ViewerPictureState,
} from "@/lib/liveViewer";
import { shotViewerPreview } from "@/lib/shotSession";
import { LIVE_REQUEST_TIMEOUT_MS, withDeadline } from "@/lib/withDeadline";

interface WebRTCStreamViewerProps {
  streamId: string;
  hostId: string;
  isLive: boolean;
  viewerCount: number;
  thumbnailUrl?: string | null;
}

type ViewerPhase = "connecting" | "waiting" | "watching" | "reconnecting" | "offline" | "not-configured";

async function requestLiveKitSession(streamId: string): Promise<LiveKitSession> {
  if (shotViewerPreview()) return { configured: false, error: LIVE_VIDEO_NOT_CONFIGURED };
  const invoke = supabase.functions.invoke("livekit-token", { body: { streamId } });
  const { data, error } = await withDeadline(
    invoke,
    LIVE_REQUEST_TIMEOUT_MS,
    "Live video did not respond. Try again.",
  );
  const parsed = parseLiveKitTokenResponse(data ?? { error: error?.message });
  if ("configured" in parsed) return parsed;
  throw new Error(parsed.error);
}

export const WebRTCStreamViewer: React.FC<WebRTCStreamViewerProps> = ({
  streamId,
  hostId,
  isLive,
  viewerCount,
  thumbnailUrl,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLMediaElement[]>([]);
  const attemptRef = useRef(0);
  const tokenTimerRef = useRef<number | null>(null);
  const connectRef = useRef<() => Promise<void>>(async () => undefined);
  const [phase, setPhase] = useState<ViewerPhase>("connecting");

  const clearTokenTimer = () => {
    if (tokenTimerRef.current !== null) window.clearTimeout(tokenTimerRef.current);
    tokenTimerRef.current = null;
  };

  const armTokenRefresh = (token: string) => {
    clearTokenTimer();
    const delay = nextTokenRefreshDelay(token);
    if (delay === null) return;
    tokenTimerRef.current = window.setTimeout(() => {
      void connectRef.current();
    }, delay);
  };
  const [picture, setPicture] = useState<ViewerPictureState>(EMPTY_VIEWER_PICTURE);
  const [needsSound, setNeedsSound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const releaseAudio = () => {
    for (const element of audioRef.current) {
      element.pause();
      element.srcObject = null;
      element.remove();
    }
    audioRef.current = [];
  };

  const disconnectRoom = useCallback(() => {
    releaseAudio();
    const room = roomRef.current;
    roomRef.current = null;
    room?.disconnect();
  }, []);

  const unlockSound = useCallback(async () => {
    const room = roomRef.current;
    const video = videoRef.current;
    setAudioSession(navigator, "playback");
    try {
      await room?.startAudio();
    } catch {
      /* The tap below still tries the element. */
    }
    if (video) {
      video.muted = false;
      await video.play().catch(() => undefined);
    }
    for (const element of audioRef.current) {
      element.muted = false;
      await element.play().catch(() => undefined);
    }
    setNeedsSound(false);
  }, []);

  const connect = useCallback(async () => {
    if (!isLive) return;
    const attempt = ++attemptRef.current;
    clearTokenTimer();
    disconnectRoom();
    const still = () => attempt === attemptRef.current;
    setPhase("connecting");
    setError(null);
    setPicture(EMPTY_VIEWER_PICTURE);
    setNeedsSound(false);
    setAudioSession(navigator, "playback");

    try {
      const session = await requestLiveKitSession(streamId);
      if (!still()) return;
      if (!session.configured) {
        setPhase("not-configured");
        return;
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        disconnectOnPageLeave: false,
        webAudioMix: false,
      });
      roomRef.current = room;

      const notePicture = (event: ViewerPictureEvent) => {
        setPicture((current) => reduceViewerPicture(current, event));
      };

      const bindRemoteVideo = (video: HTMLVideoElement) => {
        prepareVideoElement(video, "remote");
        video.defaultMuted = true;
        video.muted = true;
        video.setAttribute("muted", "");
        video.play().catch(() => setNeedsSound(true));
      };

      const attachHostTrack = (track: RemoteTrack, participant: RemoteParticipant) => {
        if (participant.identity !== hostId || !still()) return;
        if (track.kind === Track.Kind.Video && videoRef.current) {
          const video = videoRef.current;
          const muted = track.isMuted;
          prepareVideoElement(video, "remote");
          video.muted = true;
          track.attach(video);
          bindRemoteVideo(video);
          notePicture({ type: "subscribed", kind: "video", muted });
          if (!muted) {
            setPhase("watching");
            window.setTimeout(() => {
              if (still() && videoRef.current === video) bindRemoteVideo(video);
            }, 0);
          }
        }
        if (track.kind === Track.Kind.Audio) {
          const element = track.attach();
          element.autoplay = true;
          element.setAttribute("playsinline", "true");
          audioRef.current.push(element);
          notePicture({ type: "subscribed", kind: "audio", muted: track.isMuted });
          element.play().then(() => setNeedsSound(false)).catch(() => setNeedsSound(true));
        }
      };

      room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
        attachHostTrack(track, participant);
      });
      room.on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) => {
        track.detach();
        if (participant.identity !== hostId || !still()) return;
        if (track.kind === Track.Kind.Video) {
          notePicture({ type: "unsubscribed", kind: "video" });
          setPhase("waiting");
        }
        if (track.kind === Track.Kind.Audio) notePicture({ type: "unsubscribed", kind: "audio" });
      });
      room.on(RoomEvent.TrackMuted, (publication, participant) => {
        if (participant.identity !== hostId || !still()) return;
        if (publication.kind === Track.Kind.Video) notePicture({ type: "muted", kind: "video" });
      });
      room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
        if (participant.identity !== hostId || !still()) return;
        if (publication.kind !== Track.Kind.Video) return;
        const video = videoRef.current;
        if (video && publication.track) {
          prepareVideoElement(video, "remote");
          video.muted = true;
          publication.track.attach(video);
          bindRemoteVideo(video);
        }
        notePicture({ type: "unmuted", kind: "video" });
        setPhase("watching");
      });
      room.on(RoomEvent.Reconnecting, () => {
        if (still()) setPhase("reconnecting");
      });
      room.on(RoomEvent.Reconnected, () => {
        if (still()) setPhase((current) => (current === "reconnecting" ? "watching" : current));
      });
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current !== room || !still()) return;
        window.setTimeout(() => {
          if (roomRef.current === room && still()) void connectRef.current();
        }, 1000);
      });

      await withDeadline(
        room.connect(session.url, session.token),
        LIVE_REQUEST_TIMEOUT_MS,
        "Could not join the live room. Try again.",
      );
      if (!still()) {
        room.disconnect();
        return;
      }
      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => {
          if (publication.track) {
            attachHostTrack(publication.track, participant);
            return;
          }
          publication.setSubscribed(true);
          if (participant.identity === hostId && publication.kind === Track.Kind.Video && publication.isMuted && still()) {
            notePicture({ type: "muted", kind: "video" });
          }
        });
      });
      if (still()) {
        armTokenRefresh(session.token);
        setPhase((current) => (current === "connecting" ? "waiting" : current));
      }
    } catch (err: unknown) {
      if (!still()) return;
      setError(errorMessage(err, "Failed to connect"));
      setPhase("offline");
    }
  }, [disconnectRoom, hostId, isLive, streamId]);
  connectRef.current = connect;

  useEffect(() => {
    if (!isLive) return;
    const timer = window.setTimeout(() => {
      void connect();
    }, 300);
    return () => {
      window.clearTimeout(timer);
      clearTokenTimer();
      attemptRef.current += 1;
      disconnectRoom();
    };
  }, [connect, disconnectRoom, isLive]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !isLive) return;
      const room = roomRef.current;
      if (!room || room.state === "disconnected") void connect();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [connect, isLive]);

  if (!isLive) {
    return (
      <div data-testid="stream-ended" className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-background">
        <div className="text-center">
          <WifiOff className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <p className="text-muted-foreground">This stream has ended</p>
        </div>
      </div>
    );
  }

  const showWaiting = phase === "waiting" || phase === "connecting" || phase === "reconnecting";
  const cameraOff = hostCameraOff(picture, phase);

  return (
    <div className="relative h-full min-h-[34vh] w-full bg-black">
      {thumbnailUrl && !picture.hasVideo && (
        <img src={thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      )}
      <video
        ref={videoRef}
        data-testid="viewer-video"
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-contain"
      />

      {phase === "not-configured" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted/30 to-background/90">
          <div className="max-w-sm px-4 text-center">
            <Radio className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-medium text-foreground">Live video not configured</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Camera streaming needs LiveKit credentials before anyone can watch.
            </p>
            <Button type="button" onClick={() => void connect()} variant="outline" size="sm" className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          </div>
        </div>
      )}

      {cameraOff && (
        <div data-testid="host-camera-off" className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br from-muted/40 to-background/90">
          <div className="px-4 text-center">
            <VideoOff className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-medium text-foreground">Host camera is off</p>
          </div>
        </div>
      )}

      {showWaiting && !error && !cameraOff && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-background/80">
          <div className="text-center">
            {phase === "waiting" ? (
              <Radio className="mx-auto mb-4 h-12 w-12 animate-pulse text-primary" />
            ) : (
              <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
            )}
            <p className="font-medium text-foreground">
              {phase === "waiting" ? "Waiting for host" : phase === "reconnecting" ? "Reconnecting…" : "Connecting to live stream..."}
            </p>
          </div>
        </div>
      )}

      {phase === "offline" && (
        <div data-testid="connection-dropped" className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-destructive/10 to-background">
          <div className="px-4 text-center">
            <WifiOff className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <p className="mb-2 font-medium text-foreground">Connection dropped</p>
            <p className="mb-4 text-sm text-muted-foreground">{error || "The network dropped. Try again."}</p>
            <Button onClick={() => void connect()} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {needsSound && phase === "watching" && (
        <Button
          type="button"
          data-testid="tap-for-sound"
          className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2"
          onClick={() => void unlockSound()}
        >
          <Volume2 className="mr-2 h-4 w-4" />
          Tap for sound
        </Button>
      )}

      <div className="absolute left-4 top-3 z-10 flex gap-2">
        <Badge className="animate-pulse bg-red-500">
          <Radio className="mr-1 h-3 w-3" />
          LIVE
        </Badge>
        <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
          <Users className="mr-1 h-3 w-3" />
          {viewerCount}
        </Badge>
      </div>
    </div>
  );
};
