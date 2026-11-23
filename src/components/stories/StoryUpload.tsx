import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type ChangeEvent } from "react";
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
  canvasToJpegFile,
  captureCoverFrame,
  facingFromTrack,
  oppositeFacing,
  setTrackTorch,
  startStoryCamera,
  stopStoryCamera,
  trackHasTorch,
  videoTrackFrom,
  type StoryFacing,
} from "@/lib/storyCamera";
import {
  burnStoryImage,
  createStoryText,
  imageFromFile,
  waitForStoryFonts,
  type StoryTextOverlay,
} from "@/lib/storyOverlay";
import { StoryEditor } from "./StoryEditor";
import { cn } from "@/lib/utils";

interface StoryUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Stage = "camera" | "editor" | "fallback";

const StoryUpload = ({ open, onOpenChange }: StoryUploadProps) => {
  const { uploadStory } = useStories();
  const videoRef = useRef<HTMLVideoElement>(null);
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

  const clearPreview = useCallback(() => {
    setPreviewUrl((previous) => {
      if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
      return null;
    });
    setSourceFile(null);
    setOverlays([]);
    setTextOnly(false);
    setBackground("#111111");
    setMediaType("photo");
  }, []);

  const stopCamera = useCallback(() => {
    wantedRef.current = false;
    const stream = streamRef.current;
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    stopStoryCamera(stream);
    setTorchOn(false);
    setTorchAvailable(false);
  }, []);

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
      const captured = captureCoverFrame(video, { width: rect.width, height: rect.height }, { mirror: front });
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
        await uploadStory.mutateAsync({ file: sourceFile, mediaType: "video" });
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
            <div className="relative h-full w-full" data-story-stage="camera">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={cn(
                  "absolute inset-0 h-full w-full object-cover",
                  facing === "user" && "-scale-x-100",
                )}
              />
              {starting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-white/80">
                  Starting camera
                </div>
              )}
              <div
                className="absolute inset-x-0 top-0 z-10 flex items-start justify-between px-3"
                style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
              >
                <ChromeButton data-story-close aria-label="Close" onClick={handleClose}>
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
              <div
                className="absolute inset-x-0 bottom-0 z-10 px-4"
                style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <ChromeButton data-story-gallery aria-label="Gallery" onClick={openGallery} className="w-auto px-3">
                    <ImageIcon className="h-5 w-5" />
                    <span className="text-xs font-semibold tracking-wide">Gallery</span>
                  </ChromeButton>
                  <button
                    type="button"
                    data-story-shutter
                    aria-label="Take photo"
                    onClick={() => void takePhoto()}
                    disabled={starting}
                    className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-white bg-transparent disabled:opacity-50"
                  >
                    <span className="h-[58px] w-[58px] rounded-full bg-white" />
                  </button>
                  <ChromeButton
                    data-story-flip
                    aria-label="Flip camera"
                    onClick={() => setFacing((current) => oppositeFacing(current))}
                  >
                    <SwitchCamera className="h-5 w-5" />
                  </ChromeButton>
                </div>
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    data-story-text
                    aria-label="Text story"
                    onClick={startTextStory}
                    className="flex h-11 items-center gap-1.5 rounded-full bg-black/35 px-4 text-sm font-semibold tracking-wide text-white ring-1 ring-white/15"
                  >
                    <Type className="h-4 w-4" />
                    Aa
                  </button>
                </div>
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
              sharing={uploadStory.isPending}
              textOnly={textOnly}
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
