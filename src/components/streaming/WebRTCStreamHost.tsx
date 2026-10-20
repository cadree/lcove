import React, { useCallback, useEffect, useRef, useState } from "react";
import { LocalAudioTrack, LocalVideoTrack, Room, Track } from "livekit-client";
import { motion } from "framer-motion";
import { AlertCircle, Loader2, Mic, MicOff, Radio, RefreshCw, Users, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { errorMessage as formatError } from "@/lib/errorMessage";
import {
  LIVE_VIDEO_NOT_CONFIGURED,
  parseLiveKitTokenResponse,
  pickRecorderMimeType,
  replayContentType,
  replayFileExtension,
  type LiveKitSession,
} from "@/lib/livekitSession";

interface WebRTCStreamHostProps {
  streamId: string;
  isLive?: boolean;
  onEnd: () => void;
}

type CameraState = "checking" | "not-configured" | "requesting" | "ready" | "error" | "denied";

async function requestLiveKitSession(streamId: string): Promise<LiveKitSession> {
  const { data, error } = await supabase.functions.invoke("livekit-token", { body: { streamId } });
  const parsed = parseLiveKitTokenResponse(data ?? { error: error?.message });
  if ("configured" in parsed) return parsed;
  throw new Error(parsed.error);
}

export const WebRTCStreamHost: React.FC<WebRTCStreamHostProps> = ({ streamId, isLive: initialIsLive = false, onEnd }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const roomRef = useRef<Room | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recorderMimeRef = useRef<string>("video/webm");
  const saveReplayRef = useRef(false);

  const [isStreaming, setIsStreaming] = useState(initialIsLive);
  const [cameraState, setCameraState] = useState<CameraState>("checking");
  const [errorMessage, setErrorMessage] = useState("");
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [isGoingLive, setIsGoingLive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveReplay, setSaveReplay] = useState(false);
  saveReplayRef.current = saveReplay;

  const attachPreview = useCallback((stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.play().catch(() => undefined);
  }, []);

  const initCamera = useCallback(async () => {
    setCameraState("requesting");
    setErrorMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStreamRef.current = stream;
      attachPreview(stream);
      setCameraState("ready");
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError") {
        setCameraState("denied");
        setErrorMessage("Camera access was denied. Allow the camera and microphone, then try again.");
      } else if (name === "NotFoundError") {
        setCameraState("error");
        setErrorMessage("No camera or microphone found.");
      } else if (name === "NotReadableError") {
        setCameraState("error");
        setErrorMessage("Camera is in use by another application.");
      } else {
        setCameraState("error");
        setErrorMessage(formatError(err, "Failed to access camera."));
      }
    }
  }, [attachPreview]);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const session = await requestLiveKitSession(streamId);
        if (cancelled) return;
        if (!session.configured) {
          setCameraState("not-configured");
          setErrorMessage(LIVE_VIDEO_NOT_CONFIGURED);
          return;
        }
        if (!session.canPublish) {
          setCameraState("error");
          setErrorMessage("Only the host can go live.");
          return;
        }
        await initCamera();
      } catch (err: unknown) {
        if (cancelled) return;
        setCameraState("error");
        setErrorMessage(formatError(err, "Could not start live video"));
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [initCamera, streamId]);

  const startRecording = (stream: MediaStream) => {
    recordedChunksRef.current = [];
    const mimeType = pickRecorderMimeType((type) => {
      try {
        return typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type);
      } catch {
        return false;
      }
    });
    if (!mimeType) return false;
    recorderMimeRef.current = mimeType;
    try {
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      return true;
    } catch (err) {
      console.error("[Host] Failed to start recording", err);
      return false;
    }
  };

  const stopRecording = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      const mimeType = replayContentType(recorderMimeRef.current);
      const finish = () => {
        resolve(recordedChunksRef.current.length > 0 ? new Blob(recordedChunksRef.current, { type: mimeType }) : null);
      };
      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        finish();
        return;
      }
      mediaRecorder.onstop = finish;
      mediaRecorder.stop();
    });
  };

  const releaseLocalMedia = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    roomRef.current?.disconnect();
    roomRef.current = null;
  };

  const startStream = async () => {
    if (!user || cameraState !== "ready" || !localStreamRef.current) return;
    setIsGoingLive(true);
    try {
      const session = await requestLiveKitSession(streamId);
      if (!session.configured) {
        setCameraState("not-configured");
        setErrorMessage(LIVE_VIDEO_NOT_CONFIGURED);
        return;
      }
      if (!session.canPublish) throw new Error("Only the host can go live.");

      const room = new Room();
      roomRef.current = room;
      await room.connect(session.url, session.token);

      const media = localStreamRef.current;
      const videoTrack = media.getVideoTracks()[0];
      const audioTrack = media.getAudioTracks()[0];
      if (videoTrack) {
        await room.localParticipant.publishTrack(new LocalVideoTrack(videoTrack), { source: Track.Source.Camera });
      }
      if (audioTrack) {
        await room.localParticipant.publishTrack(new LocalAudioTrack(audioTrack), { source: Track.Source.Microphone });
      }

      if (saveReplayRef.current && !startRecording(media)) {
        toast({
          title: "This browser can't save a replay",
          description: "The stream will still go live.",
        });
      }

      const { error } = await supabase
        .from("live_streams")
        .update({ is_live: true, started_at: new Date().toISOString() })
        .eq("id", streamId);
      if (error) throw error;

      setIsStreaming(true);
      toast({ title: "You are now live!" });
    } catch (err: unknown) {
      roomRef.current?.disconnect();
      roomRef.current = null;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      toast({ title: "Failed to go live", description: formatError(err), variant: "destructive" });
    } finally {
      setIsGoingLive(false);
    }
  };

  const stopStream = async (save: boolean) => {
    try {
      setIsSaving(save);
      let replayUrl: string | null = null;
      const blob = await stopRecording();

      if (save && blob && blob.size > 0 && user) {
        const extension = replayFileExtension(recorderMimeRef.current);
        const contentType = replayContentType(recorderMimeRef.current);
        const fileName = `${user.id}/replays/${streamId}-${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("media").upload(fileName, blob, {
          contentType,
          upsert: true,
        });
        if (uploadError) {
          toast({ title: "Failed to save replay", description: uploadError.message, variant: "destructive" });
        } else {
          replayUrl = supabase.storage.from("media").getPublicUrl(fileName).data.publicUrl;
        }
      } else if (save) {
        toast({ title: "No recording data", description: "The stream was too short to save.", variant: "destructive" });
      }

      releaseLocalMedia();
      await supabase
        .from("live_streams")
        .update({
          is_live: false,
          ended_at: new Date().toISOString(),
          replay_available: save && !!replayUrl,
          replay_url: replayUrl,
        })
        .eq("id", streamId);

      setIsStreaming(false);
      setShowEndDialog(false);
      setIsSaving(false);
      toast({ title: save && replayUrl ? "Stream ended and replay saved" : "Stream ended" });
      onEnd();
    } catch (err: unknown) {
      setIsSaving(false);
      toast({ title: "Error ending stream", description: formatError(err), variant: "destructive" });
    }
  };

  const stopStreamRef = useRef(stopStream);
  stopStreamRef.current = stopStream;

  useEffect(() => {
    const channel = supabase.channel(`stream-end-${streamId}`);
    channel.on("broadcast", { event: "end" }, () => {
      void stopStreamRef.current(saveReplayRef.current);
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      releaseLocalMedia();
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`stream-viewers-${streamId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stream_viewers", filter: `stream_id=eq.${streamId}` },
        async () => {
          const { count } = await supabase
            .from("stream_viewers")
            .select("*", { count: "exact", head: true })
            .eq("stream_id", streamId);
          setViewerCount(count || 0);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  const toggleVideo = () => {
    const next = !videoEnabled;
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
    setVideoEnabled(next);
  };

  const toggleAudio = () => {
    const next = !audioEnabled;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    setAudioEnabled(next);
  };

  const renderCameraContent = () => {
    if (cameraState === "checking" || cameraState === "requesting") {
      return (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br from-primary/20 to-background">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
            <p className="font-medium text-foreground">
              {cameraState === "checking" ? "Checking live video..." : "Starting camera..."}
            </p>
          </div>
        </div>
      );
    }
    if (cameraState === "not-configured") {
      return (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br from-muted/30 to-background">
          <div className="max-w-sm px-4 text-center">
            <Radio className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-medium text-foreground">Live video not configured</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Camera streaming needs LiveKit credentials before a host can go live.
            </p>
          </div>
        </div>
      );
    }
    if (cameraState === "denied" || cameraState === "error") {
      return (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br from-destructive/10 to-background">
          <div className="max-w-sm px-4 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <p className="mb-2 font-medium text-foreground">{cameraState === "denied" ? "Camera access denied" : "Camera error"}</p>
            <p className="mb-4 text-sm text-muted-foreground">{errorMessage}</p>
            <Button onClick={initCamera} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative flex h-full min-h-[300px] w-full flex-col overflow-hidden rounded-lg bg-black">
      <div className="relative min-h-0 flex-1">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-cover ${cameraState !== "ready" || !videoEnabled ? "opacity-0" : "opacity-100"}`}
          style={{ transform: "scaleX(-1)" }}
        />
        {renderCameraContent()}
        {cameraState === "ready" && !videoEnabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted/20 to-background">
            <div className="text-center">
              <VideoOff className="mx-auto mb-2 h-16 w-16 text-muted-foreground" />
              <p className="text-muted-foreground">Camera off</p>
            </div>
          </div>
        )}
        <div className="absolute left-3 right-3 top-3 z-20 flex gap-2">
          {cameraState === "ready" && !isStreaming && (
            <Badge variant="secondary" className="bg-background/80 text-xs backdrop-blur-sm">Preview</Badge>
          )}
          {isStreaming && (
            <Badge className="animate-pulse bg-red-500 text-xs">
              <Radio className="mr-1 h-3 w-3" />
              LIVE
            </Badge>
          )}
          <Badge variant="secondary" className="bg-background/80 text-xs backdrop-blur-sm">
            <Users className="mr-1 h-3 w-3" />
            {viewerCount}
          </Badge>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-shrink-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 py-3"
      >
        <div className="mx-auto flex w-full max-w-[280px] flex-col items-center gap-3">
          {cameraState === "ready" && (
            <div className="flex w-full items-center justify-between gap-3">
              <Label htmlFor="save-replay" className="text-sm text-white">Save replay</Label>
              <Switch
                id="save-replay"
                checked={saveReplay}
                onCheckedChange={setSaveReplay}
                disabled={isStreaming || isGoingLive}
                aria-label="Save replay"
              />
            </div>
          )}
          {cameraState === "ready" && (
            <div className="flex items-center justify-center gap-6">
              <Button variant={videoEnabled ? "secondary" : "destructive"} size="icon" onClick={toggleVideo} className="h-11 w-11 rounded-full" aria-label={videoEnabled ? "Turn camera off" : "Turn camera on"}>
                {videoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </Button>
              <Button variant={audioEnabled ? "secondary" : "destructive"} size="icon" onClick={toggleAudio} className="h-11 w-11 rounded-full" aria-label={audioEnabled ? "Mute microphone" : "Unmute microphone"}>
                {audioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
            </div>
          )}
          {!isStreaming ? (
            <Button onClick={startStream} className="h-11 w-full gap-2 rounded-xl bg-red-500 text-sm font-semibold hover:bg-red-600" disabled={cameraState !== "ready" || isGoingLive}>
              {isGoingLive ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
              Go Live
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => setShowEndDialog(true)} className="h-11 w-full rounded-xl text-sm font-semibold">
              End Stream
            </Button>
          )}
        </div>
      </motion.div>

      <AlertDialog open={showEndDialog} onOpenChange={(open) => !isSaving && setShowEndDialog(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isSaving ? "Saving replay..." : "End your stream?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isSaving
                ? "Uploading the recording from this browser."
                : saveReplay
                  ? "Save replay is on. Ending uploads the recording and turns the live room off."
                  : "This turns the live room off. The recording is not saved."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!isSaving && (
            <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
              <AlertDialogCancel>Keep streaming</AlertDialogCancel>
              <Button variant="destructive" onClick={() => void stopStream(saveReplay)}>
                End stream
              </Button>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
