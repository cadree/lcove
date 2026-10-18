import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePosts } from "@/hooks/usePosts";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

type Step = "pick" | "crop" | "caption" | "share";

const FRAME = 260;

interface CreateShareFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function bakeSquareCrop(src: string, scale: number, offsetX: number, offsetY: number) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the photo"));
    img.src = src;
  });

  const size = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not crop the photo");

  const base = Math.max(FRAME / image.naturalWidth, FRAME / image.naturalHeight);
  const drawW = image.naturalWidth * base * scale;
  const drawH = image.naturalHeight * base * scale;
  const left = (FRAME - drawW) / 2 + offsetX;
  const top = (FRAME - drawH) / 2 + offsetY;
  const ratio = size / FRAME;
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(image, left * ratio, top * ratio, drawW * ratio, drawH * ratio);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("Could not crop the photo");
  return new File([blob], "post.jpg", { type: "image/jpeg" });
}

export function CreateShareFlow({ open, onOpenChange }: CreateShareFlowProps) {
  const { user } = useAuth();
  const { createPost } = usePosts();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const [step, setStep] = useState<Step>("pick");
  const [preview, setPreview] = useState<string | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [croppedUrl, setCroppedUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep("pick");
    setPreview(null);
    setCroppedFile(null);
    setCroppedUrl(null);
    setCaption("");
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setNatural(null);
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const onPick = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        setNatural({ w: img.naturalWidth, h: img.naturalHeight });
        setPreview(src);
        setScale(1);
        setOffset({ x: 0, y: 0 });
        setStep("crop");
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const goToCaption = async () => {
    if (!preview) {
      setStep("caption");
      return;
    }
    try {
      setError(null);
      const file = await bakeSquareCrop(preview, scale, offset.x, offset.y);
      setCroppedFile(file);
      setCroppedUrl(URL.createObjectURL(file));
      setStep("caption");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not crop the photo");
    }
  };

  const share = async () => {
    if (!caption.trim() && !croppedFile) return;
    await createPost.mutateAsync({
      content: caption.trim() || undefined,
      file: croppedFile || undefined,
      mediaType: croppedFile ? "photo" : "text",
    });
    handleOpenChange(false);
  };

  const stepLabel = { pick: "Pick", crop: "Crop", caption: "Caption", share: "Share" }[step];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md rounded-[2px] border border-border bg-background p-0 gap-0">
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <p className="eyebrow">{stepLabel}</p>
          <DialogTitle className="ether-title text-3xl font-medium text-left">Create</DialogTitle>
        </div>

        <div className="px-5 py-5">
          {!user && <p className="text-sm text-muted-foreground">Sign in to share a post.</p>}

          {user && step === "pick" && (
            <div className="space-y-3">
              <Button className="w-full min-h-11" onClick={() => fileInputRef.current?.click()}>
                Choose a photo
              </Button>
              <Button variant="outline" className="w-full min-h-11" onClick={() => setStep("caption")}>
                Caption only
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  onPick(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </div>
          )}

          {user && step === "crop" && preview && (
            <div className="space-y-4">
              <div
                className="relative mx-auto overflow-hidden bg-muted touch-none"
                style={{ width: FRAME, maxWidth: "100%", height: FRAME }}
                onPointerDown={(event) => {
                  dragRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
                  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  const drag = dragRef.current;
                  if (!drag) return;
                  setOffset({
                    x: drag.ox + event.clientX - drag.x,
                    y: drag.oy + event.clientY - drag.y,
                  });
                }}
                onPointerUp={() => {
                  dragRef.current = null;
                }}
              >
                {natural && (
                  <img
                    src={preview}
                    alt=""
                    draggable={false}
                    className="absolute max-w-none select-none"
                    style={{
                      width: natural.w * Math.max(FRAME / natural.w, FRAME / natural.h) * scale,
                      height: natural.h * Math.max(FRAME / natural.w, FRAME / natural.h) * scale,
                      left: (FRAME - natural.w * Math.max(FRAME / natural.w, FRAME / natural.h) * scale) / 2 + offset.x,
                      top: (FRAME - natural.h * Math.max(FRAME / natural.w, FRAME / natural.h) * scale) / 2 + offset.y,
                    }}
                  />
                )}
              </div>
              <label className="block text-sm text-muted-foreground">
                Zoom
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={scale}
                  onChange={(event) => setScale(Number(event.target.value))}
                  className="mt-2 w-full min-h-11"
                />
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button variant="outline" className="min-h-11 flex-1" onClick={() => setStep("pick")}>
                  Back
                </Button>
                <Button className="min-h-11 flex-1" onClick={goToCaption}>
                  Next
                </Button>
              </div>
            </div>
          )}

          {user && step === "caption" && (
            <div className="space-y-4">
              {croppedUrl && (
                <img src={croppedUrl} alt="" className="media-frame aspect-square w-full object-cover" />
              )}
              <Textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="Write a caption"
                className="min-h-28 rounded-[2px]"
                maxLength={2200}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="min-h-11 flex-1"
                  onClick={() => setStep(preview ? "crop" : "pick")}
                >
                  Back
                </Button>
                <Button
                  className="min-h-11 flex-1"
                  disabled={!caption.trim() && !croppedFile}
                  onClick={() => setStep("share")}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {user && step === "share" && (
            <div className="space-y-4">
              {croppedUrl && (
                <img src={croppedUrl} alt="" className="media-frame aspect-square w-full object-cover" />
              )}
              {caption.trim() && <p className="text-sm text-foreground whitespace-pre-wrap">{caption}</p>}
              <div className="flex gap-2">
                <Button variant="outline" className="min-h-11 flex-1" onClick={() => setStep("caption")}>
                  Back
                </Button>
                <Button className="min-h-11 flex-1" onClick={share} disabled={createPost.isPending}>
                  {createPost.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Share"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
