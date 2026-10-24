import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionState,
  LocalAudioTrack,
  LocalVideoTrack,
  Room,
  RoomEvent,
  Track,
  VideoPreset,
  type LocalTrack,
  type RoomOptions,
} from "livekit-client";
import { motion } from "framer-motion";
import { AlertCircle, Download, Loader2, Mic, MicOff, Radio, RefreshCw, Users, Video, VideoOff, WifiOff } from "lucide-react";
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
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { errorMessage as formatError } from "@/lib/errorMessage";
import {
  cameraFailureCopy,
  requestCamera,
  stopStreamTracks,
  type CameraFailure,
} from "@/lib/cameraAccess";
import {
  LIVE_VIDEO_NOT_CONFIGURED,
  parseLiveKitTokenResponse,
  pickRecorderMimeType,
  replayContentType,
  replayFileExtension,
  type LiveKitSession,
} from "@/lib/livekitSession";
import { fixWebmDuration } from "@/lib/webmDuration";
import {
  cameraConstraintAttempts,
  captureDevice,
  liveLinkAfter,
  prepareVideoElement,
  publishPlan,
  recorderTimeslice,
  replayUploadPlan,
  saveRecordingFile,
  setAudioSession,
  tracksNeedRestart,
  type LiveLink,
} from "@/lib/livePhone";
import { REPLAY_CACHE_CONTROL, replayObjectPath } from "@/lib/replayStorage";
import { shotHostPreview } from "@/lib/shotSession";
import { LIVE_REQUEST_TIMEOUT_MS, withDeadline } from "@/lib/withDeadline";

interface WebRTCStreamHostProps {
  streamId: string;
  isLive?: boolean;
  onEnd: () => void;
  onClose: () => void;
  registerEndGuard?: (guard: (() => boolean) | null) => void;
}

type CameraState = "checking" | "idle" | "not-configured" | "requesting" | "ready" | "error" | "denied";

function thisDevice() {
  return captureDevice({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}

function roomOptions(): RoomOptions {
  const plan = publishPlan(thisDevice());
  return {
    adaptiveStream: true,
    dynacast: true,
    disconnectOnPageLeave: false,
    stopLocalTrackOnUnpublish: false,
    webAudioMix: false,
    publishDefaults: {
      simulcast: plan.simulcast,
      videoCodec: plan.videoCodec,
      degradationPreference: plan.degradationPreference,
      videoEncoding: { maxBitrate: plan.maxBitrate, maxFramerate: plan.maxFramerate },
      backupCodec: plan.videoCodec === "h264" ? false : { codec: "h264" },
    },
  };
}

async function requestLiveKitSession(streamId: string): Promise<LiveKitSession> {
  if (shotHostPreview()) return { configured: false, error: LIVE_VIDEO_NOT_CONFIGURED };
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

async function publishLocal(room: Room, media: MediaStream) {
  const plan = publishPlan(thisDevice());
  const videoTrack = media.getVideoTracks()[0];
  const audioTrack = media.getAudioTracks()[0];
  if (videoTrack) {
    const local = new LocalVideoTrack(videoTrack);
    const layers = plan.layers.map((layer) => new VideoPreset(layer.width, layer.height, layer.maxBitrate, layer.maxFramerate));
    const options = {
      source: Track.Source.Camera,
      simulcast: plan.simulcast,
      videoCodec: plan.videoCodec,
      videoEncoding: { maxBitrate: plan.maxBitrate, maxFramerate: plan.maxFramerate },
      videoSimulcastLayers: layers,
      degradationPreference: plan.degradationPreference,
      backupCodec: plan.videoCodec === "h264" ? false as const : { codec: "h264" as const },
    };
    try {
      await room.localParticipant.publishTrack(local, options);
    } catch (error) {
      if (plan.videoCodec !== "h264") throw error;
      await room.localParticipant.unpublishTrack(local, false).catch(() => undefined);
      await room.localParticipant.publishTrack(local, {
        ...options,
        videoCodec: "vp8",
        simulcast: false,
        videoSimulcastLayers: [],
        backupCodec: false,
      });
    }
  }
  if (audioTrack) {
    await room.localParticipant.publishTrack(new LocalAudioTrack(audioTrack), {
      source: Track.Source.Microphone,
    });
  }
}

async function storeReplay(userId: string, streamId: string, blob: Blob, mime: string, durationMs: number) {
  const plan = replayUploadPlan(blob.size);
  if (plan.action === "keep-local") return { replayUrl: null as string | null, note: plan.message };
  const extension = replayFileExtension(mime);
  const contentType = replayContentType(mime);
  const uploadBlob = contentType === "video/webm" ? await fixWebmDuration(blob, durationMs) : blob;
  const fileName = replayObjectPath(userId, streamId, extension);
  const file = new File([uploadBlob], `replay.${extension}`, { type: contentType });
  const { error } = await supabase.storage.from("media").upload(fileName, file, {
    contentType,
    upsert: false,
    cacheControl: REPLAY_CACHE_CONTROL,
  });
  if (error) throw error;
  return {
    replayUrl: supabase.storage.from("media").getPublicUrl(fileName).data.publicUrl,
    note: "Replay saved. Anyone can watch it from Replays.",
  };
}

export const WebRTCStreamHost: React.FC<WebRTCStreamHostProps> = ({
  streamId,
  isLive: initialIsLive = false,
  onEnd,
  onClose,
  registerEndGuard,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const roomRef = useRef<Room | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recorderMimeRef = useRef<string>("video/webm");
  const recordingStartedAtRef = useRef(0);
  const saveReplayRef = useRef(false);
  const cameraAttemptRef = useRef(0);
  const streamingRef = useRef(initialIsLive);
  const endingRef = useRef(false);
  const recoveringRef = useRef(false);
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  const [isStreaming, setIsStreaming] = useState(initialIsLive);
  const [cameraState, setCameraState] = useState<CameraState>("checking");
  const [failure, setFailure] = useState<CameraFailure | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [isGoingLive, setIsGoingLive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveReplay, setSaveReplay] = useState(false);
  const [link, setLink] = useState<LiveLink>("live");
  const [finished, setFinished] = useState(false);
  const [replayNote, setReplayNote] = useState("");
  const [localReplay, setLocalReplay] = useState<Blob | null>(null);
  saveReplayRef.current = saveReplay;
  streamingRef.current = isStreaming;

  const attachPreview = useCallback((stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) return;
    prepareVideoElement(video, "preview");
    video.srcObject = stream;
    video.play().catch(() => undefined);
  }, []);

  const showCameraFailure = useCallback((next: CameraFailure, title: string, message: string) => {
    setFailure(next);
    setCameraState(next === "denied" ? "denied" : "error");
    setErrorMessage(message || title);
  }, []);

  const initCamera = useCallback(async () => {
    const attempt = ++cameraAttemptRef.current;
    setCameraState("requesting");
    setFailure(null);
    setErrorMessage("");
    setAudioSession(navigator, "play-and-record");
    const result = await requestCamera({
      constraints: cameraConstraintAttempts(thisDevice()),
      getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
      secure: window.isSecureContext,
      supported: typeof navigator.mediaDevices?.getUserMedia === "function",
      stillWanted: () => attempt === cameraAttemptRef.current,
    });
    if (attempt !== cameraAttemptRef.current) {
      if (result.ok) stopStreamTracks(result.stream);
      return;
    }
    if (result.ok === false) {
      showCameraFailure(result.failure, result.title, result.message);
      return;
    }
    if (result.stream.getTracks().length === 0) {
      const copy = cameraFailureCopy("no-device");
      showCameraFailure("no-device", copy.title, copy.message);
      return;
    }
    localStreamRef.current = result.stream as MediaStream;
    if (!shotHostPreview()) attachPreview(result.stream as MediaStream);
    setCameraState("ready");
  }, [attachPreview, showCameraFailure]);

  const refreshLiveVideo = useCallback(async () => {
    if (shotHostPreview()) {
      setFailure(null);
      setErrorMessage("");
      setCameraState("idle");
      return;
    }
    setCameraState("checking");
    setFailure(null);
    setErrorMessage("");
    try {
      const session = await requestLiveKitSession(streamId);
      if (!session.configured) {
        setCameraState("not-configured");
        setErrorMessage("Camera streaming needs LiveKit credentials before a host can go live.");
        return;
      }
      if (!session.canPublish) {
        setCameraState("error");
        setErrorMessage("Only the host can go live.");
        return;
      }
      setCameraState("idle");
    } catch (err: unknown) {
      setCameraState("error");
      setErrorMessage(formatError(err, "Could not start live video"));
    }
  }, [streamId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (shotHostPreview()) {
        setCameraState("idle");
        return;
      }
      setCameraState("checking");
      try {
        const session = await requestLiveKitSession(streamId);
        if (cancelled) return;
        if (!session.configured) {
          setCameraState("not-configured");
          setErrorMessage("Camera streaming needs LiveKit credentials before a host can go live.");
          return;
        }
        if (!session.canPublish) {
          setCameraState("error");
          setErrorMessage("Only the host can go live.");
          return;
        }
        setCameraState("idle");
      } catch (err: unknown) {
        if (cancelled) return;
        setCameraState("error");
        setErrorMessage(formatError(err, "Could not start live video"));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [streamId]);

  const startRecording = (stream: MediaStream) => {
    recordedChunksRef.current = [];
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    const mimeType = pickRecorderMimeType((type) => {
      try {
        return typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type);
      } catch {
        return false;
      }
    });
    if (!mimeType) return false;
    recorderMimeRef.current = mimeType;
    const clone = new MediaStream(stream.getTracks().map((track) => track.clone()));
    recordingStreamRef.current = clone;
    try {
      const mediaRecorder = new MediaRecorder(clone, { mimeType });
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      const timeslice = recorderTimeslice(mimeType);
      if (timeslice) mediaRecorder.start(timeslice);
      else mediaRecorder.start();
      recordingStartedAtRef.current = Date.now();
      mediaRecorderRef.current = mediaRecorder;
      return true;
    } catch (err) {
      console.error("[Host] Failed to start recording", err);
      clone.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      return false;
    }
  };

  const stopRecording = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      const mimeType = replayContentType(recorderMimeRef.current);
      const finish = () => {
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        resolve(recordedChunksRef.current.length > 0 ? new Blob(recordedChunksRef.current, { type: mimeType }) : null);
      };
      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        finish();
        return;
      }
      mediaRecorder.onstop = finish;
      try {
        if (mediaRecorder.state === "recording" && typeof mediaRecorder.requestData === "function") {
          mediaRecorder.requestData();
        }
      } catch {
        /* Safari mp4 only delivers data on stop. */
      }
      mediaRecorder.stop();
    });
  };

  const releaseLocalMedia = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    roomRef.current?.disconnect();
    roomRef.current = null;
  };

  const bindRoom = useCallback((room: Room) => {
    room.on(RoomEvent.Reconnecting, () => {
      const next = liveLinkAfter("reconnecting", endingRef.current);
      if (next !== "ended") setLink(next);
    });
    room.on(RoomEvent.Reconnected, () => {
      const next = liveLinkAfter("reconnected", endingRef.current);
      if (next !== "ended") setLink(next);
    });
    room.on(RoomEvent.Disconnected, () => {
      const next = liveLinkAfter("disconnected", endingRef.current);
      if (next !== "ended" && streamingRef.current) setLink("offline");
    });
  }, []);

  const connectRoom = useCallback(async (media: MediaStream) => {
    const session = await requestLiveKitSession(streamId);
    if (!session.configured) {
      stopStreamTracks(media);
      localStreamRef.current = null;
      setCameraState("not-configured");
      setErrorMessage("Camera streaming needs LiveKit credentials before a host can go live.");
      return null;
    }
    if (!session.canPublish) throw new Error("Only the host can go live.");
    const room = new Room(roomOptions());
    roomRef.current = room;
    bindRoom(room);
    await withDeadline(
      room.connect(session.url, session.token),
      LIVE_REQUEST_TIMEOUT_MS,
      "Could not join the live room. Try again.",
    );
    await publishLocal(room, media);
    setLink("live");
    return room;
  }, [bindRoom, streamId]);

  const recover = useCallback(async () => {
    if (recoveringRef.current || endingRef.current || !streamingRef.current) return;
    recoveringRef.current = true;
    try {
      const media = localStreamRef.current;
      if (!media || tracksNeedRestart(media.getVideoTracks())) {
        media?.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        await initCamera();
      }
      const nextMedia = localStreamRef.current;
      const room = roomRef.current;
      if (!nextMedia) return;
      if (!room || room.state === ConnectionState.Disconnected) {
        setLink("reconnecting");
        roomRef.current?.disconnect();
        roomRef.current = null;
        await connectRoom(nextMedia);
        return;
      }
      const published = [...room.localParticipant.videoTrackPublications.values()];
      const livePublished = published.some((publication) => publication.track && !publication.track.isMuted);
      if (!livePublished) {
        for (const publication of published) {
          if (publication.track) await room.localParticipant.unpublishTrack(publication.track as LocalTrack, false);
        }
        await publishLocal(room, nextMedia);
      }
      setLink("live");
    } catch (err: unknown) {
      setLink("offline");
      setErrorMessage(formatError(err, "The network dropped."));
    } finally {
      recoveringRef.current = false;
    }
  }, [connectRoom, initCamera]);

  const startStream = async () => {
    if (!user || isGoingLive || isStreaming || finished) return;
    setAudioSession(navigator, "play-and-record");
    if (cameraState === "not-configured") {
      toast({ title: LIVE_VIDEO_NOT_CONFIGURED, variant: "destructive" });
      return;
    }
    setIsGoingLive(true);
    setLink("live");
    try {
      if (!localStreamRef.current) await initCamera();
      if (!localStreamRef.current) return;
      const room = await connectRoom(localStreamRef.current);
      if (!room) return;

      if (saveReplayRef.current && !startRecording(localStreamRef.current)) {
        toast({
          title: "This browser can't save a replay",
          description: "The stream will still go live. You can post a file to YouTube or Twitch yourself.",
        });
      }

      const { error } = await supabase
        .from("live_streams")
        .update({ is_live: true, started_at: new Date().toISOString(), ended_at: null })
        .eq("id", streamId);
      if (error) throw error;
      void queryClient.invalidateQueries({ queryKey: ["live-streams"] });
      void queryClient.invalidateQueries({ queryKey: ["stream", streamId] });

      setIsStreaming(true);
      toast({ title: "You are now live!" });
    } catch (err: unknown) {
      roomRef.current?.disconnect();
      roomRef.current = null;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      setLink("offline");
      setErrorMessage(formatError(err, "The network dropped."));
      toast({ title: "Failed to go live", description: formatError(err), variant: "destructive" });
    } finally {
      setIsGoingLive(false);
    }
  };

  const stopStream = async (save: boolean) => {
    if (endingRef.current) return;
    endingRef.current = true;
    try {
      setIsSaving(true);
      const blob = await stopRecording();
      let replayUrl: string | null = null;
      let note = save ? "Stream ended." : "Stream ended. The recording was not saved.";
      if (save && blob && blob.size > 0 && user) {
        try {
          const durationMs = recordingStartedAtRef.current ? Date.now() - recordingStartedAtRef.current : 0;
          const stored = await storeReplay(user.id, streamId, blob, recorderMimeRef.current, durationMs);
          replayUrl = stored.replayUrl;
          note = stored.note || note;
        } catch (err: unknown) {
          note = formatError(err, "The replay could not be uploaded. Save it on this phone.");
          toast({ title: "Failed to save replay", description: note, variant: "destructive" });
        }
      } else if (save) {
        note = "The stream was too short to save.";
        toast({ title: "No recording data", description: note, variant: "destructive" });
      }

      releaseLocalMedia();
      const { error } = await supabase
        .from("live_streams")
        .update({
          is_live: false,
          ended_at: new Date().toISOString(),
          replay_available: Boolean(replayUrl),
          replay_url: replayUrl,
        })
        .eq("id", streamId);
      if (error) throw error;
      void queryClient.invalidateQueries({ queryKey: ["live-streams"] });
      void queryClient.invalidateQueries({ queryKey: ["stream", streamId] });

      setLocalReplay(blob && blob.size > 0 ? blob : null);
      setReplayNote(note);
      setIsStreaming(false);
      setShowEndDialog(false);
      setFinished(true);
      setLink("live");
    } catch (err: unknown) {
      endingRef.current = false;
      toast({ title: "Error ending stream", description: formatError(err), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const stopStreamRef = useRef(stopStream);
  stopStreamRef.current = stopStream;
  const recoverRef = useRef(recover);
  recoverRef.current = recover;

  useEffect(() => {
    registerEndGuard?.(() => {
      if (streamingRef.current && !endingRef.current) {
        setShowEndDialog(true);
        return true;
      }
      return false;
    });
    return () => registerEndGuard?.(null);
  }, [registerEndGuard]);

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
    const onVisible = () => {
      if (document.visibilityState === "visible") void recoverRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    const warn = (event: BeforeUnloadEvent) => {
      if (!streamingRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
      window.removeEventListener("beforeunload", warn);
    };
  }, []);

  useEffect(() => {
    return () => {
      cameraAttemptRef.current += 1;
      const wasLive = streamingRef.current && !endingRef.current;
      const userId = userIdRef.current;
      const mime = recorderMimeRef.current;
      const recorder = mediaRecorderRef.current;
      if (wasLive && saveReplayRef.current && userId && recorder && recorder.state !== "inactive" && !shotHostPreview()) {
        recorder.onstop = () => {
          const blob = recordedChunksRef.current.length > 0
            ? new Blob(recordedChunksRef.current, { type: replayContentType(mime) })
            : null;
          if (!blob) return;
          const durationMs = recordingStartedAtRef.current ? Date.now() - recordingStartedAtRef.current : 0;
          void storeReplay(userId, streamId, blob, mime, durationMs).then((stored) => supabase
            .from("live_streams")
            .update({
              is_live: false,
              ended_at: new Date().toISOString(),
              replay_available: Boolean(stored.replayUrl),
              replay_url: stored.replayUrl,
            })
            .eq("id", streamId));
        };
        try {
          recorder.stop();
        } catch {
          /* already stopped */
        }
      } else if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          /* already stopped */
        }
      }
      releaseLocalMedia();
      if (wasLive && !shotHostPreview()) {
        void supabase
          .from("live_streams")
          .update({ is_live: false, ended_at: new Date().toISOString() })
          .eq("id", streamId);
      }
    };
  }, [streamId]);

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

  const saveToPhone = async () => {
    if (!localReplay) return;
    const extension = replayFileExtension(recorderMimeRef.current);
    try {
      await saveRecordingFile(localReplay, `ether-replay-${streamId}.${extension}`);
      toast({ title: "Recording ready on this phone" });
    } catch (err: unknown) {
      toast({ title: "Could not save the recording", description: formatError(err), variant: "destructive" });
    }
  };

  const renderCameraContent = () => {
    if (cameraState === "idle") {
      return (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br from-primary/20 to-background">
          <div className="max-w-sm px-4 text-center">
            <Radio className="mx-auto mb-4 h-12 w-12 text-primary" />
            <p className="font-medium text-foreground">Tap Go Live to start your camera</p>
          </div>
        </div>
      );
    }
    if (cameraState === "checking" || cameraState === "requesting") {
      return (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br from-primary/20 to-background px-4">
          <div className="w-full max-w-sm text-center">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
            <p className="font-medium text-foreground">
              {cameraState === "checking" ? "Checking live video..." : "Starting camera..."}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {cameraState === "checking"
                ? "This stops waiting if live video does not answer."
                : "This stops waiting if the camera stays busy."}
            </p>
            <Button type="button" variant="outline" className="mt-4" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      );
    }
    if (cameraState === "not-configured") {
      return (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br from-muted/30 to-background px-4">
          <div className="w-full max-w-sm text-center">
            <Radio className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-medium text-foreground">Live video not configured</p>
            <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button type="button" onClick={() => void refreshLiveVideo()} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>
      );
    }
    if (cameraState === "denied" || cameraState === "error") {
      const title = failure ? cameraFailureCopy(failure).title : cameraState === "denied" ? "Camera access denied" : "Camera error";
      return (
        <div data-testid={cameraState === "denied" ? "camera-denied" : "camera-error"} className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br from-destructive/10 to-background px-4">
          <div className="w-full max-w-sm text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <p className="mb-2 font-medium text-foreground">{title}</p>
            <p className="mb-4 text-sm text-muted-foreground">{errorMessage}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                onClick={() => void (failure ? initCamera() : refreshLiveVideo())}
                variant="outline"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (finished) {
    return (
      <div className="flex w-full flex-col gap-4 bg-background px-4 py-6 text-foreground" data-testid="stream-finished">
        <Radio className="h-10 w-10 text-primary" />
        <p className="text-lg font-medium">Stream ended</p>
        <p className="text-sm text-muted-foreground">{replayNote}</p>
        <p className="text-sm text-muted-foreground">
          YouTube and Twitch live restream is not turned on. Save the file and post it there.
        </p>
        {localReplay && (
          <Button type="button" data-testid="save-to-phone" onClick={() => void saveToPhone()}>
            <Download className="mr-2 h-4 w-4" />
            Save to phone
          </Button>
        )}
        <Button type="button" variant="outline" data-testid="close-finished" onClick={onEnd}>Close</Button>
      </div>
    );
  }

  return (
    <div className="relative flex w-full flex-col bg-black">
      <div className="relative aspect-video max-h-[38dvh] w-full">
        <video
          ref={videoRef}
          data-testid="host-video"
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
        {link === "offline" && cameraState === "ready" && (
          <div data-testid="connection-dropped" className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 px-4 text-center">
            <div>
              <WifiOff className="mx-auto mb-3 h-10 w-10 text-white" />
              <p className="font-medium text-white">Connection dropped</p>
              <p className="mt-1 text-sm text-white/80">{errorMessage || "The network dropped. Retry, or end the stream."}</p>
              <div className="mt-4 flex justify-center gap-2">
                <Button type="button" variant="secondary" onClick={() => void recover()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
                <Button type="button" variant="destructive" onClick={() => setShowEndDialog(true)}>
                  End stream
                </Button>
              </div>
            </div>
          </div>
        )}
        <div className="absolute left-3 right-14 top-3 z-20 flex gap-2">
          {cameraState === "ready" && !isStreaming && (
            <Badge variant="secondary" className="bg-background/80 text-xs backdrop-blur-sm">Preview</Badge>
          )}
          {isStreaming && (
            <Badge className="animate-pulse bg-red-500 text-xs" data-testid="live-badge">
              <Radio className="mr-1 h-3 w-3" />
              LIVE
            </Badge>
          )}
          {link === "reconnecting" && (
            <Badge variant="secondary" className="bg-background/80 text-xs">Reconnecting</Badge>
          )}
          <Badge variant="secondary" className="bg-background/80 text-xs backdrop-blur-sm" data-testid="viewer-count">
            <Users className="mr-1 h-3 w-3" />
            {viewerCount}
          </Badge>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-shrink-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 py-3"
      >
        <div className="mx-auto flex w-full min-w-0 max-w-full flex-col items-center gap-3">
          <div className="flex w-full items-center justify-between gap-3">
            <Label htmlFor="save-replay" className="min-w-0 flex-1 text-sm text-white">
              Save replay
              <span className="mt-0.5 block text-xs font-normal text-white/70">Uploads when you end (under 50 MB). Anyone can watch it in Replays.</span>
            </Label>
            <Switch
              id="save-replay"
              checked={saveReplay}
              onCheckedChange={setSaveReplay}
              disabled={isStreaming || isGoingLive}
              aria-label="Save replay"
            />
          </div>
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
            <Button type="button" data-testid="go-live" onClick={() => void startStream()} className="h-11 w-full gap-2 rounded-xl bg-red-500 text-sm font-semibold hover:bg-red-600" disabled={isGoingLive}>
              {isGoingLive ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
              Go Live
            </Button>
          ) : (
            <Button variant="destructive" data-testid="end-stream" onClick={() => setShowEndDialog(true)} className="h-11 w-full rounded-xl text-sm font-semibold">
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
                ? "Uploading the recording from this phone."
                : saveReplay
                  ? "Save replay is on. Ending uploads the recording when it is under 50 MB and turns the live room off. You can also save the file to this phone. YouTube and Twitch live restream is not turned on."
                  : "This turns the live room off. The recording is not saved."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!isSaving && (
            <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
              <AlertDialogCancel>Keep streaming</AlertDialogCancel>
              <Button variant="destructive" data-testid="confirm-end-stream" onClick={() => void stopStream(saveReplay)}>
                End stream
              </Button>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
