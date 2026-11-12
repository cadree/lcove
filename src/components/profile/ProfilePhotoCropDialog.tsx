import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  cropGeometry,
  panAfterDrag,
} from "@/lib/avatarCrop";
import { cropToJpegFile } from "@/lib/avatarCropFile";

type ProfilePhotoCropDialogProps = {
  open: boolean;
  imageUrl: string | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (file: File) => void;
  onCropError: (error: unknown) => void;
  onImageError: (imageUrl: string) => void;
};

export function ProfilePhotoCropDialog({
  open,
  imageUrl,
  saving,
  onCancel,
  onSave,
  onCropError,
  onImageError,
}: ProfilePhotoCropDialogProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);
  const [frameSize, setFrameSize] = useState(0);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [photo, setPhoto] = useState<{ url: string; width: number; height: number } | null>(null);
  const [baking, setBaking] = useState(false);

  useEffect(() => {
    setZoom(MIN_ZOOM);
    setPanX(0);
    setPanY(0);
    setBaking(false);
    dragRef.current = null;
  }, [imageUrl]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !open) return;
    const measure = () => {
      const side = Math.round(frame.clientWidth);
      if (side > 0) setFrameSize(side);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [open, imageUrl]);

  const natural = photo && photo.url === imageUrl ? photo : null;
  const geometry = natural && frameSize > 0
    ? cropGeometry({
        imageWidth: natural.width,
        imageHeight: natural.height,
        frameSize,
        zoom,
        panX,
        panY,
      })
    : null;
  const busy = saving || baking;

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const save = async () => {
    const image = imageRef.current;
    if (!image || !geometry || busy) return;
    setBaking(true);
    try {
      const file = await cropToJpegFile(image, geometry);
      onSave(file);
    } catch (error) {
      onCropError(error);
    } finally {
      setBaking(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle>Frame your photo</DialogTitle>
          <DialogDescription>
            Drag the photo under the square and zoom. Cancel keeps your current photo.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={frameRef}
          className="relative mx-auto aspect-square w-full max-w-[320px] touch-none select-none overflow-hidden bg-muted"
          style={{ touchAction: "none" }}
          aria-label="Drag to frame your photo"
          onPointerDown={(event) => {
            if (!natural || frameSize <= 0 || busy) return;
            if (event.pointerType === "mouse" && event.button !== 0) return;
            dragRef.current = {
              pointerId: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              panX,
              panY,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId || !natural || frameSize <= 0) return;
            const next = panAfterDrag({
              imageWidth: natural.width,
              imageHeight: natural.height,
              frameSize,
              zoom,
              panX: drag.panX,
              panY: drag.panY,
              deltaX: event.clientX - drag.x,
              deltaY: event.clientY - drag.y,
            });
            setPanX(next.panX);
            setPanY(next.panY);
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {imageUrl ? (
            <img
              ref={imageRef}
              src={imageUrl}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={
                geometry
                  ? {
                      width: geometry.displayWidth,
                      height: geometry.displayHeight,
                      left: geometry.left,
                      top: geometry.top,
                    }
                  : { visibility: "hidden" }
              }
              onLoad={(event) => {
                const img = event.currentTarget;
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                  setPhoto({ url: imageUrl, width: img.naturalWidth, height: img.naturalHeight });
                  return;
                }
                onImageError(imageUrl);
              }}
              onError={() => onImageError(imageUrl)}
            />
          ) : null}
          {!geometry ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : null}
        </div>

        <label className="block text-sm text-muted-foreground">
          Zoom
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={!natural || busy}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="mt-2 min-h-11 w-full accent-primary"
          />
        </label>

        <div className="flex gap-3">
          <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" className="min-h-11 flex-1" onClick={() => void save()} disabled={!geometry || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
