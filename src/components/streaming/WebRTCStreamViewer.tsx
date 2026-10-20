import React, { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteTrack, type RemoteParticipant } from "livekit-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Radio, RefreshCw, Users, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { errorMessage } from "@/lib/errorMessage";
import { LIVE_VIDEO_NOT_CONFIGURED, parseLiveKitTokenResponse, type LiveKitSession } from "@/lib/livekitSession";

interface WebRTCStreamViewerProps {
  streamId: string;
  hostId: string;
  isLive: boolean;
  viewerCount: number;
  thumbnailUrl?: string | null;
}

async function requestLiveKitSession(streamId: string): Promise<LiveKitSession> {
  const { data, error } = await supabase.functions.invoke("livekit-token", { body: { streamId } });
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
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [hasVideo, setHasVideo] = useState(false);
  const [waitingForHost, setWaitingForHost] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
  }, []);

  const connect = useCallback(async () => {
    if (!user || !isLive) return;
    cleanup();
    setIsConnecting(true);
    setError(null);
    setHasVideo(false);
    setWaitingForHost(true);
    setNotConfigured(false);

    try {
      const session = await requestLiveKitSession(streamId);
      if (!session.configured) {
        setNotConfigured(true);
        setIsConnecting(false);
        setWaitingForHost(false);
        return;
      }

      const room = new Room();
      roomRef.current = room;

      const attachHostTrack = (track: RemoteTrack, participant: RemoteParticipant) => {
        if (participant.identity !== hostId || !videoRef.current) return;
        track.attach(videoRef.current);
        setWaitingForHost(false);
        setIsConnecting(false);
        if (track.kind === Track.Kind.Video) setHasVideo(true);
      };

      room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
        attachHostTrack(track, participant);
      });
      room.on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) => {
        track.detach();
        if (participant.identity === hostId && track.kind === Track.Kind.Video) {
          setHasVideo(false);
          setWaitingForHost(true);
        }
      });
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current === room) setWaitingForHost(true);
      });

      await room.connect(session.url, session.token);
      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => {
          if (publication.track) attachHostTrack(publication.track, participant);
        });
      });
      setIsConnecting(false);
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to connect"));
      setIsConnecting(false);
      setWaitingForHost(false);
    }
  }, [cleanup, hostId, isLive, streamId, user]);

  useEffect(() => {
    if (!isLive || !user) return;
    const timer = window.setTimeout(() => {
      void connect();
    }, 300);
    return () => {
      window.clearTimeout(timer);
      cleanup();
    };
  }, [cleanup, connect, isLive, user]);

  if (!isLive) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-background">
        <div className="text-center">
          <WifiOff className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <p className="text-muted-foreground">Stream is offline</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black">
      {thumbnailUrl && !hasVideo && (
        <img src={thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      )}
      <video ref={videoRef} autoPlay playsInline className={`h-full w-full object-contain ${hasVideo ? "" : "hidden"}`} />

      {notConfigured && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted/30 to-background/90">
          <div className="max-w-sm px-4 text-center">
            <Radio className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-medium text-foreground">Live video not configured</p>
          </div>
        </div>
      )}

      {isConnecting && !error && !notConfigured && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-background/80">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
            <p className="font-medium text-foreground">Connecting to live stream...</p>
          </div>
        </div>
      )}

      {!isConnecting && waitingForHost && !error && !notConfigured && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-background/80">
          <div className="text-center">
            <Radio className="mx-auto mb-4 h-12 w-12 animate-pulse text-primary" />
            <p className="font-medium text-foreground">Waiting for host</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-destructive/10 to-background">
          <div className="text-center">
            <WifiOff className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <p className="mb-2 font-medium text-foreground">Connection error</p>
            <p className="mb-4 text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => void connect()} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </div>
      )}

      <div className="absolute left-4 top-4 z-10 flex gap-2">
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
