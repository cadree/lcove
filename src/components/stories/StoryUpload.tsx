import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Image as ImageIcon, SwitchCamera, Type, X, Zap, ZapOff } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStories } from "@/hooks/useStories";
import { cameraFailureCopy, type CameraFailure } from "@/lib/cameraAccess";
import { errorMessage } from "@/lib/errorMessage";
import {
  FALLBACK_ZOOM,
  STORY_HOLD_TO_RECORD_MS,
  STORY_MAX_RECORD_MS,
  canvasToJpegFile,
  captureCoverFrame,
  defaultZoom,
  facingFromTrack,
  formatZoom,
  oppositeFacing,
  pickStoryRecorderType,
  pinchZoom,
  recordingExtension,
  setTrackTorch,
  setTrackZoom,
  shutterRelease,
  startStoryCamera,
  stopStoryCamera,
  trackHasTorch,
  trackZoom,
  trackZoomRange,
  videoTrackFrom,
  type ShutterPhase,
  type StoryFacing,
  type ZoomRange,
} from "@/lib/storyCamera";
import {
  burnStoryImage,
  createStoryText,
  fitStoryStage,
  imageFromFile,
  waitForStoryFonts,
  type StoryTextOverlay,
} from "@/lib/storyOverlay";
import { burnStoryVideo } from "@/lib/storyVideo";
import { useBlockPagePinch } from "@/hooks/useBlockPagePinch";
import { StoryEditor } from "./StoryEditor";
import { cn } from "@/lib/utils";

interface StoryUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Stage = "camera" | "editor" | "fallback";

/** How a clip recorded in the composer was framed, so the saved file matches the preview. */
interface RecordedClip {
  mirror: boolean;
  zoom: number;
}

/** Room under the camera frame for the Aa row and the hint. */
const CAMERA_FOOTER_PX = 64;

/** Mic for a recording, without ever holding the shutter hostage to a permission prompt. */
async function storyAudioTrack(timeoutMs: number): Promise<MediaStreamTrack | null> {
  if (typeof navigator === "undefined" || typeof navigator.mediaDevices?.getUserMedia !== "function") return null;
  const request = navigator.mediaDevices
    .getUserMedia({ audio: true, video: false })
    .then((stream) => stream.getAudioTracks()[0] ?? null)
    .catch(() => null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  const track = await Promise.race([request, late]);
  clearTimeout(timer);
  if (!track) {
    // A first-time prompt can answer after the clip started: release it, next clip has sound.
    void request.then((lateTrack) => lateTrack?.stop());
  }
  return track;
}

const StoryUpload = ({ open, onOpenChange }: StoryUploadProps) => {
  const { uploadStory } = useStories();
  const videoRef = useRef<HTMLVideoElement>(null);
  const zoomRangeRef = useRef<ZoomRange | null>(null);
  const zoomRef = useRef(1);
  const zoomFrameRef = useRef(0);
  const pinchPointsRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ gap: number; zoom: number } | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The shutter press in progress, keyed by touch or pointer id. */
  const pressRef = useRef<{ key: string; phase: ShutterPhase } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordFrameRef = useRef(0);
  const audioRef = useRef<MediaStreamTrack | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wantedRef = useRef(false);
  const [stage, setStage] = useState<Stage>("camera");
  const [facing, setFacing] = useState<StoryFacing>("environment");
  const [starting, setStarting] = useState(true);
  const [failure, setFailure] = useState<CameraFailure | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<"photo" | "video">("photo");
  const [background, setBackground] = useState("#111111");
  const [textOnly, setTextOnly] = useState(false);
  const [overlays, setOverlays] = useState<StoryTextOverlay[]>([]);
  const [zoomRange, setZoomRange] = useState<ZoomRange | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pinching, setPinching] = useState(false);
  const [cameraFrame, setCameraFrame] = useState(fitStoryStage(390, 693));
  const [recording, setRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [recordedClip, setRecordedClip] = useState<RecordedClip | null>(null);
  const [shareProgress, setShareProgress] = useState<number | null>(null);
  /** Screen zoom only applies when the camera cannot zoom itself. */
  const screenZoom = zoomRange ? 1 : zoom;

  const clearPreview = useCallback(() => {
    setPreviewUrl((previous) => {
      if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
      return null;
    });
    setSourceFile(null);
    setRecordedClip(null);
    setOverlays([]);
    setTextOnly(false);
    setBackground("#111111");
    setMediaType("photo");
  }, []);

  const stopRecorder = useCallback((discard: boolean) => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    cancelAnimationFrame(recordFrameRef.current);
    const recorder = recorderRef.current;
    if (recorder) {
      if (discard) recorder.ondataavailable = null;
      if (discard) recorder.onstop = null;
      if (recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          /* already stopped */
        }
      }
    }
    if (discard) {
      recorderRef.current = null;
      audioRef.current?.stop();
      audioRef.current = null;
    }
    setRecording(false);
    setRecordProgress(0);
  }, []);

  const stopCamera = useCallback(() => {
    stopRecorder(true);
    pressRef.current = null;
    wantedRef.current = false;
    const stream = streamRef.current;
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    stopStoryCamera(stream);
    setTorchOn(false);
    setTorchAvailable(false);
    zoomRangeRef.current = null;
    zoomRef.current = 1;
    pinchRef.current = null;
    pinchPointsRef.current.clear();
    setZoomRange(null);
    setZoom(1);
    setPinching(false);
  }, [stopRecorder]);

  const reset = useCallback(() => {
    stopCamera();
    clearPreview();
    setStage("camera");
    setFacing("environment");
    setFailure(null);
    setStarting(true);
  }, [clearPreview, stopCamera]);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    setStage("camera");
    setFacing("environment");
    setFailure(null);
  }, [open, reset]);

  useEffect(() => {
    if (!open || stage !== "camera") {
      stopCamera();
      return;
    }
    let cancelled = false;
    wantedRef.current = true;
    setStarting(true);
    const run = async () => {
      const result = await startStoryCamera({
        facing,
        stillWanted: () => !cancelled,
      });
      if (cancelled) {
        if (result.ok) stopStoryCamera(result.stream);
        return;
      }
      if (result.ok === false) {
        setFailure(result.failure);
        setStage("fallback");
        setStarting(false);
        return;
      }
      streamRef.current = result.stream;
      const track = videoTrackFrom(result.stream);
      setTorchAvailable(trackHasTorch(track));
      setTorchOn(false);
      const range = trackZoomRange(track);
      const current = trackZoom(track);
      const start = defaultZoom(range, current);
      if (range && start !== null && start !== current) await setTrackZoom(track, start);
      zoomRangeRef.current = range;
      zoomRef.current = start ?? 1;
      setZoomRange(range);
      setZoom(start ?? 1);
      const node = videoRef.current;
      if (node) {
        node.srcObject = result.stream;
        try {
          await node.play();
        } catch {
          /* autoplay can wait for the next gesture */
        }
      }
      setStarting(false);
    };
    void run();
    return () => {
      cancelled = true;
      wantedRef.current = false;
      stopCamera();
    };
  }, [open, stage, facing, stopCamera]);

  // Callback ref: the dialog portal mounts the camera after the first layout pass.
  const [frameHost, setFrameHost] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!frameHost) return;
    const update = () => setCameraFrame(fitStoryStage(frameHost.clientWidth, frameHost.clientHeight - CAMERA_FOOTER_PX));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frameHost);
    return () => observer.disconnect();
  }, [frameHost]);

  const [cameraStage, setCameraStage] = useState<HTMLDivElement | null>(null);
  useBlockPagePinch(cameraStage, open && stage === "camera");

  useEffect(() => () => {
    cancelAnimationFrame(zoomFrameRef.current);
    cancelAnimationFrame(recordFrameRef.current);
  }, []);

  const applyZoom = (next: number) => {
    zoomRef.current = next;
    setZoom(next);
    if (!zoomRangeRef.current) return;
    // One camera change per frame; iOS drops frames if every touchmove reconfigures it.
    cancelAnimationFrame(zoomFrameRef.current);
    zoomFrameRef.current = requestAnimationFrame(() => {
      void setTrackZoom(videoTrackFrom(streamRef.current), zoomRef.current);
    });
  };

  const onCameraPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    pinchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* synthetic events */
    }
    if (pinchPointsRef.current.size === 2) {
      const [a, b] = [...pinchPointsRef.current.values()];
      pinchRef.current = { gap: Math.hypot(b.x - a.x, b.y - a.y), zoom: zoomRef.current };
      setPinching(true);
    }
  };

  const onCameraPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pinchPointsRef.current.has(event.pointerId)) return;
    pinchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pinch = pinchRef.current;
    if (!pinch || pinchPointsRef.current.size < 2) return;
    const [a, b] = [...pinchPointsRef.current.values()];
    const gap = Math.hypot(b.x - a.x, b.y - a.y);
    applyZoom(pinchZoom(pinch.zoom, pinch.gap, gap, zoomRangeRef.current ?? FALLBACK_ZOOM));
  };

  const onCameraPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pinchPointsRef.current.delete(event.pointerId)) return;
    if (pinchPointsRef.current.size < 2) {
      pinchRef.current = null;
      setPinching(false);
    }
  };

  const resetZoom = () => {
    const range = zoomRangeRef.current;
    applyZoom(range ? defaultZoom(range, 1) ?? 1 : 1);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const openGallery = () => galleryRef.current?.click();

  const onGalleryFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const video = file.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|qt)$/i.test(file.name);
    clearPreview();
    setTextOnly(false);
    setMediaType(video ? "video" : "photo");
    setSourceFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setOverlays([]);
    setStage("editor");
  };

  const startTextStory = () => {
    clearPreview();
    const first = createStoryText({ text: "" });
    setTextOnly(true);
    setMediaType("photo");
    setBackground("#111111");
    setOverlays([first]);
    setStage("editor");
  };

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      toast.error("The camera is still starting. Try again in a moment.");
      return;
    }
    const rect = video.getBoundingClientRect();
    const track = videoTrackFrom(streamRef.current);
    const front = facingFromTrack(track, facing) === "user";
    try {
      // The video box is the 9:16 frame; a screen zoom scales it, so use the unscaled size.
      const view = { width: video.offsetWidth || rect.width, height: video.offsetHeight || rect.height };
      const captured = captureCoverFrame(video, view, { mirror: front, zoom: screenZoom });
      (window as Window & { __storyCaptureInfo?: unknown }).__storyCaptureInfo = {
        zoom: zoomRef.current,
        native: Boolean(zoomRangeRef.current),
        crop: captured.crop,
      };
      const file = await canvasToJpegFile(captured.canvas);
      clearPreview();
      setTextOnly(false);
      setMediaType("photo");
      setSourceFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setOverlays([]);
      setStage("editor");
    } catch (error) {
      toast.error(errorMessage(error, "Could not take that photo"));
    }
  };

  const finishRecording = (chunks: Blob[], mimeType: string, startedAt: number, clip: RecordedClip) => {
    recorderRef.current = null;
    audioRef.current?.stop();
    audioRef.current = null;
    const type = mimeType.split(";")[0] || "video/mp4";
    const blob = new Blob(chunks, { type });
    if (!blob.size) {
      toast.error("That clip did not record. Try holding the button again.");
      return;
    }
    const file = new File([blob], `story.${recordingExtension(type)}`, { type });
    (window as Window & { __storyRecordingInfo?: unknown }).__storyRecordingInfo = {
      size: file.size,
      type,
      ms: Math.round(performance.now() - startedAt),
      clip,
    };
    clearPreview();
    setTextOnly(false);
    setMediaType("video");
    setSourceFile(file);
    setRecordedClip(clip);
    setPreviewUrl(URL.createObjectURL(file));
    setOverlays([]);
    setStage("editor");
  };

  const startRecording = async () => {
    const press = pressRef.current;
    if (!press || press.phase !== "pressing") return;
    const track = videoTrackFrom(streamRef.current);
    // Camera not ready: stay a tap, so letting go says the camera is still starting.
    if (!track) return;
    if (typeof MediaRecorder === "undefined") {
      press.phase = "unsupported";
      toast.error("Video recording is not available on this phone yet. Tap for a photo.");
      return;
    }
    press.phase = "starting";
    setRecording(true);
    setRecordProgress(0);
    const audio = await storyAudioTrack(700);
    if (pressRef.current !== press || press.phase !== "starting") {
      // Let go while the mic was starting: that press already became a photo.
      audio?.stop();
      return;
    }
    audioRef.current = audio;
    const mimeType = pickStoryRecorderType((type) => MediaRecorder.isTypeSupported(type)) ?? "";
    const clip: RecordedClip = { mirror: facingFromTrack(track, facing) === "user", zoom: screenZoom };
    const chunks: Blob[] = [];
    const startedAt = performance.now();
    try {
      const source = new MediaStream(audio ? [track, audio] : [track]);
      const recorder = new MediaRecorder(source, mimeType ? { mimeType, videoBitsPerSecond: 6_000_000 } : undefined);
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => finishRecording(chunks, recorder.mimeType || mimeType, startedAt, clip);
      // iOS writes mp4 only on stop; a timeslice there can drop the moov box.
      if (recorder.mimeType.startsWith("video/mp4") || mimeType.startsWith("video/mp4")) recorder.start();
      else recorder.start(1000);
      recorderRef.current = recorder;
    } catch (error) {
      audio?.stop();
      audioRef.current = null;
      press.phase = "unsupported";
      setRecording(false);
      toast.error(errorMessage(error, "Could not start recording. Tap for a photo."));
      return;
    }
    press.phase = "recording";
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      setRecordProgress(Math.min(1, elapsed / STORY_MAX_RECORD_MS));
      if (elapsed >= STORY_MAX_RECORD_MS) {
        // 15s cap: the finger may still be down, so this press is over now.
        if (pressRef.current === press) pressRef.current = null;
        stopRecorder(false);
        return;
      }
      recordFrameRef.current = requestAnimationFrame(tick);
    };
    recordFrameRef.current = requestAnimationFrame(tick);
  };

  const beginShutterPress = (key: string) => {
    const stale = pressRef.current;
    if (stale) {
      // A press whose lift never arrived (a system sheet or alert took the touch) must
      // not leave the shutter dead. A new touch during a recording stops it.
      pressRef.current = null;
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
      if (stale.phase === "recording") {
        stopRecorder(false);
        return;
      }
      if (stale.phase === "starting") setRecording(false);
    }
    pressRef.current = { key, phase: "pressing" };
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      void startRecording();
    }, STORY_HOLD_TO_RECORD_MS);
  };

  const endShutterPress = (key: string, cancelled: boolean) => {
    const press = pressRef.current;
    if (!press || press.key !== key) return;
    pressRef.current = null;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    const action = shutterRelease(press.phase, cancelled);
    if (action === "stop-recording") {
      stopRecorder(false);
      return;
    }
    if (press.phase === "starting") setRecording(false);
    if (action === "photo") void takePhoto();
  };

  // Native listeners: React's touchstart is passive, and the shutter has to claim the
  // touch (preventDefault) or iOS hands it to its own tap, long-press and callout
  // gestures, which end the press with a cancel instead of a lift.
  const [shutter, setShutter] = useState<HTMLButtonElement | null>(null);
  const shutterPressRef = useRef({ begin: beginShutterPress, end: endShutterPress });
  shutterPressRef.current = { begin: beginShutterPress, end: endShutterPress };
  useEffect(() => {
    if (!shutter) return;
    const hasTouch = typeof window !== "undefined" && "ontouchstart" in window;
    const onTouchStart = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault();
      const touch = event.changedTouches[0];
      if (touch && event.touches.length === 1) shutterPressRef.current.begin(`t${touch.identifier}`);
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault();
      for (const touch of Array.from(event.changedTouches)) {
        shutterPressRef.current.end(`t${touch.identifier}`, event.type === "touchcancel");
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      // Touch goes through the touch listeners where the browser has them.
      if (event.pointerType === "touch" && hasTouch) return;
      if (event.button !== 0) return;
      const key = `p${event.pointerId}`;
      shutterPressRef.current.begin(key);
      const onUp = (up: PointerEvent) => {
        if (up.pointerId !== event.pointerId) return;
        window.removeEventListener("pointerup", onUp, true);
        window.removeEventListener("pointercancel", onUp, true);
        shutterPressRef.current.end(key, up.type === "pointercancel");
      };
      window.addEventListener("pointerup", onUp, true);
      window.addEventListener("pointercancel", onUp, true);
    };
    shutter.addEventListener("touchstart", onTouchStart, { passive: false });
    shutter.addEventListener("touchend", onTouchEnd, { passive: false });
    shutter.addEventListener("touchcancel", onTouchEnd);
    shutter.addEventListener("pointerdown", onPointerDown);
    return () => {
      shutter.removeEventListener("touchstart", onTouchStart);
      shutter.removeEventListener("touchend", onTouchEnd);
      shutter.removeEventListener("touchcancel", onTouchEnd);
      shutter.removeEventListener("pointerdown", onPointerDown);
    };
  }, [shutter]);

  const toggleTorch = async () => {
    const track = videoTrackFrom(streamRef.current);
    const next = !torchOn;
    const ok = await setTrackTorch(track, next);
    if (ok) setTorchOn(next);
    else setTorchAvailable(false);
  };

  const handleShare = async () => {
    try {
      if (mediaType === "video") {
        if (!sourceFile) return;
        let file: File = sourceFile;
        if (recordedClip) {
          const hasText = overlays.some((item) => item.text.trim());
          setShareProgress(0);
          try {
            file = await burnStoryVideo({
              file: sourceFile,
              overlays,
              mirror: recordedClip.mirror,
              zoom: recordedClip.zoom,
              onProgress: (ratio) => setShareProgress(ratio),
              waitForFonts: waitForStoryFonts,
            });
          } catch (error) {
            if (hasText) {
              toast.error(errorMessage(error, "Could not add the text to this video"));
              return;
            }
            // No text to add: the clip as recorded is still a fine story.
            file = sourceFile;
          } finally {
            setShareProgress(null);
          }
        }
        await uploadStory.mutateAsync({ file, mediaType: "video" });
        handleClose();
        return;
      }
      if (textOnly && !overlays.some((item) => item.text.trim())) return;
      let image: HTMLImageElement | null = null;
      if (sourceFile) {
        try {
          image = await imageFromFile(sourceFile);
        } catch (error) {
          toast.error(errorMessage(error, "Could not open that photo"));
          return;
        }
      }
      const file = await burnStoryImage({
        image,
        background,
        overlays,
        waitForFonts: waitForStoryFonts,
      });
      await uploadStory.mutateAsync({ file, mediaType: "photo" });
      handleClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not share that story"));
    }
  };

  const onEditorBack = () => {
    clearPreview();
    setStage(failure ? "fallback" : "camera");
  };

  const failureCopy = failure ? cameraFailureCopy(failure) : null;
  const canRetry = failure === "timeout" || failure === "in-use" || failure === "failed";

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent
        fullscreen
        hideClose
        // Full screen: nothing is "outside". A tap that lands on the backdrop while the
        // keyboard closes must not throw away the story; X and Back are the ways out.
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onFocusOutside={(event) => event.preventDefault()}
        data-story-composer=""
        className="story-composer border-0 bg-black p-0 text-white shadow-none"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Add to story</DialogTitle>
        <DialogDescription className="sr-only">
          Take a photo, choose one from your gallery, or write a text story.
        </DialogDescription>

        <div className="relative h-full w-full overflow-hidden bg-black">
          {stage === "camera" && (
            <div
              ref={setCameraStage}
              className="flex h-full w-full touch-none select-none flex-col bg-black"
              data-story-stage="camera"
              data-story-recording={recording ? "true" : "false"}
              style={{
                paddingTop: "env(safe-area-inset-top, 0px)",
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
              }}
              onPointerDown={onCameraPointerDown}
              onPointerMove={onCameraPointerMove}
              onPointerUp={onCameraPointerUp}
              onPointerCancel={onCameraPointerUp}
            >
              <div
                ref={setFrameHost}
                className="flex min-h-0 flex-1 items-start justify-center"
                style={{ paddingBottom: CAMERA_FOOTER_PX }}
              >
                <div
                  data-story-camera-frame
                  className="relative overflow-hidden rounded-[18px] bg-neutral-950"
                  style={{ width: cameraFrame.width, height: cameraFrame.height }}
                >
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{
                      transform: [
                        facing === "user" ? "scaleX(-1)" : "",
                        screenZoom > 1 ? `scale(${screenZoom})` : "",
                      ].filter(Boolean).join(" ") || undefined,
                    }}
                  />
                  {starting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-white/80">
                      Starting camera
                    </div>
                  )}
                  <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3">
                    <ChromeButton data-story-close aria-label="Close" onClick={handleClose} disabled={recording}>
                      <X className="h-5 w-5" />
                    </ChromeButton>
                    {torchAvailable ? (
                      <ChromeButton
                        data-story-flash
                        aria-label={torchOn ? "Turn flash off" : "Turn flash on"}
                        aria-pressed={torchOn}
                        onClick={() => void toggleTorch()}
                      >
                        {torchOn ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
                      </ChromeButton>
                    ) : <span className="h-11 w-11" />}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-5">
                    <div className="mb-3 flex h-8 justify-center">
                      {(pinching || Math.abs(zoom - 1) > 0.05) && (
                        <button
                          type="button"
                          data-story-zoom={zoom.toFixed(2)}
                          aria-label={`Zoom ${formatZoom(zoom)}. Tap to reset.`}
                          onClick={resetZoom}
                          className="press flex h-8 min-w-12 items-center justify-center rounded-full bg-black/45 px-3 text-xs font-semibold tabular-nums text-white ring-1 ring-white/20"
                        >
                          {formatZoom(zoom)}
                        </button>
                      )}
                      {!pinching && Math.abs(zoom - 1) <= 0.05 && <span data-story-zoom={zoom.toFixed(2)} className="sr-only">Zoom {formatZoom(zoom)}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <ChromeButton
                        data-story-gallery
                        aria-label="Gallery"
                        onClick={openGallery}
                        disabled={recording}
                        className={cn("w-auto px-3 transition-opacity", recording && "opacity-0")}
                      >
                        <ImageIcon className="h-5 w-5" />
                        <span className="text-xs font-semibold tracking-wide">Gallery</span>
                      </ChromeButton>
                      <button
                        type="button"
                        ref={setShutter}
                        data-story-shutter
                        data-press="none"
                        aria-label={recording ? "Recording. Let go to stop." : "Take photo. Hold to record video."}
                        onContextMenu={(event) => event.preventDefault()}
                        onClick={(event) => {
                          // Keyboard and screen readers have no hold: Enter or Space takes a photo.
                          if (event.detail === 0) void takePhoto();
                        }}
                        className={cn(
                          "relative flex h-[76px] w-[76px] items-center justify-center rounded-full transition-transform duration-200 ease-out [-webkit-touch-callout:none]",
                          starting && "opacity-50",
                          recording && "scale-[1.18]",
                        )}
                      >
                        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 76 76" aria-hidden="true">
                          <circle cx="38" cy="38" r="35" fill="none" stroke="white" strokeOpacity={recording ? 0.3 : 1} strokeWidth="4" />
                          {recording && (
                            <circle
                              data-story-record-progress={recordProgress.toFixed(2)}
                              cx="38"
                              cy="38"
                              r="35"
                              fill="none"
                              stroke="#E8344E"
                              strokeWidth="4"
                              strokeLinecap="round"
                              strokeDasharray={2 * Math.PI * 35}
                              strokeDashoffset={2 * Math.PI * 35 * (1 - recordProgress)}
                            />
                          )}
                        </svg>
                        <span
                          className={cn(
                            "rounded-full bg-white transition-all duration-200 ease-out",
                            recording ? "h-7 w-7 rounded-[8px] bg-[#E8344E]" : "h-[60px] w-[60px]",
                          )}
                        />
                      </button>
                      <ChromeButton
                        data-story-flip
                        aria-label="Flip camera"
                        disabled={recording}
                        onClick={() => setFacing((current) => oppositeFacing(current))}
                        className={cn("transition-opacity", recording && "opacity-0")}
                      >
                        <SwitchCamera className="h-5 w-5" />
                      </ChromeButton>
                    </div>
                  </div>
                </div>
              </div>
              <div
                className="flex shrink-0 items-center justify-center gap-3 px-4"
                style={{ height: CAMERA_FOOTER_PX, marginTop: -CAMERA_FOOTER_PX }}
              >
                {recording ? (
                  <p className="text-xs font-semibold tracking-wide text-white/80" aria-live="polite">
                    {Math.min(15, Math.floor(recordProgress * 15))}s{audioRef.current ? "" : " · no sound"}
                  </p>
                ) : (
                  <>
                    <button
                      type="button"
                      data-story-text
                      aria-label="Text story"
                      onClick={startTextStory}
                      className="flex h-11 items-center gap-1.5 rounded-full bg-white/10 px-4 text-sm font-semibold tracking-wide text-white ring-1 ring-white/15"
                    >
                      <Type className="h-4 w-4" />
                      Aa
                    </button>
                    <p className="text-xs text-white/55">Tap for photo, hold for video</p>
                  </>
                )}
              </div>
            </div>
          )}

          {stage === "fallback" && failureCopy && (
            <div
              className="flex h-full flex-col bg-black px-5 text-white"
              data-story-stage="fallback"
              style={{
                paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
                paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))",
              }}
            >
              <div className="flex justify-start">
                <ChromeButton data-story-close aria-label="Close" onClick={handleClose}>
                  <X className="h-5 w-5" />
                </ChromeButton>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <h2 className="font-display text-2xl">{failureCopy.title}</h2>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">{failureCopy.message}</p>
                <p className="mt-2 max-w-sm text-sm text-white/50">
                  You can still post a story from your gallery, or write one with text.
                </p>
                <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
                  {canRetry && (
                    <Button
                      data-story-retry
                      variant="secondary"
                      onClick={() => { setFailure(null); setStage("camera"); }}
                      className="h-12 rounded-full"
                    >
                      Try the camera again
                    </Button>
                  )}
                  <Button data-story-gallery onClick={openGallery} className="h-12 rounded-full bg-white text-black hover:bg-white/90">
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Gallery
                  </Button>
                  <Button data-story-text variant="outline" onClick={startTextStory} className="h-12 rounded-full border-white/20 bg-transparent text-white">
                    <Type className="mr-2 h-4 w-4" />
                    Text story
                  </Button>
                </div>
              </div>
            </div>
          )}

          {stage === "editor" && (
            <StoryEditor
              previewUrl={previewUrl}
              mediaType={mediaType}
              background={background}
              overlays={overlays}
              onOverlaysChange={setOverlays}
              onBackgroundChange={setBackground}
              onBack={onEditorBack}
              onShare={() => void handleShare()}
              sharing={uploadStory.isPending || shareProgress !== null}
              shareProgress={shareProgress}
              textOnly={textOnly}
              textOnVideo={recordedClip !== null}
              videoMirror={recordedClip?.mirror ?? false}
              videoZoom={recordedClip?.zoom ?? 1}
            />
          )}
        </div>

        <input
          ref={galleryRef}
          type="file"
          accept="image/*,video/*"
          data-story-gallery-input
          onChange={onGalleryFile}
          className="hidden"
        />
      </DialogContent>
    </Dialog>
  );
};

function ChromeButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full bg-black/35 text-white ring-1 ring-white/15",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export default StoryUpload;
