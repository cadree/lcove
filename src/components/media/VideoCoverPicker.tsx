import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { captureFrame } from "@/lib/videoCover";

export interface CoverChoice {
  file: File;
  url: string;
  source: "frame" | "upload";
}

interface Props {
  videoUrl: string;
  cover: CoverChoice | null;
  onChange: (cover: CoverChoice | null) => void;
}

/**
 * Scrub to a frame and keep it as the cover, or upload an image. With neither,
 * posting uses a frame from about one second in. The parent owns (and revokes) cover.url.
 */
export function VideoCoverPicker({ videoUrl, cover, onChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const replace = (next: CoverChoice | null) => {
    setError(null);
    onChange(next);
  };

  const useFrame = async () => {
    const video = videoRef.current;
    if (!video) return;
    setBusy(true);
    const file = await captureFrame(video);
    setBusy(false);
    if (!file) { setError("That frame couldn't be read. Try another or upload an image."); return; }
    replace({ file, url: URL.createObjectURL(file), source: "frame" });
  };

  return (
    <section aria-label="Video cover" className="file-panel space-y-3 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="mono-label text-[10px] text-muted-foreground">Cover</p>
        {cover && (
          <button type="button" className="mono-label min-h-11 px-2 text-[10px] text-muted-foreground" onClick={() => replace(null)}>
            Use automatic
          </button>
        )}
      </div>
      <div className="flex gap-3">
        <div className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-[12px] border border-border bg-black">
          {cover ? (
            <img src={cover.url} alt="Chosen cover" className="h-full w-full object-cover" />
          ) : (
            <video
              ref={videoRef}
              src={videoUrl}
              muted
              playsInline
              preload="auto"
              className="h-full w-full object-cover"
              onLoadedMetadata={(event) => {
                const length = event.currentTarget.duration;
                setDuration(Number.isFinite(length) ? length : 0);
                if (Number.isFinite(length) && length > 1) {
                  event.currentTarget.currentTime = 1;
                  setTime(1);
                }
              }}
              aria-label="Frame preview"
            />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          {!cover ? (
            <>
              <label className="block text-xs text-muted-foreground">
                Pick a frame
                <input
                  type="range"
                  min={0}
                  max={Math.max(duration, 0.1)}
                  step={0.05}
                  value={time}
                  disabled={!duration}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setTime(next);
                    if (videoRef.current) videoRef.current.currentTime = next;
                  }}
                  className="mt-1 block min-h-11 w-full accent-[hsl(var(--brand))]"
                  aria-label="Cover frame time"
                />
              </label>
              <Button type="button" size="sm" className="min-h-11 w-full" onClick={useFrame} disabled={busy || !duration}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Use this frame"}
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              {cover.source === "upload" ? "Your image is the cover." : "This frame is the cover."}
            </p>
          )}
          <Button type="button" size="sm" variant="outline" className="min-h-11 w-full" onClick={() => uploadRef.current?.click()}>
            <ImagePlus className="mr-1.5 h-4 w-4" /> Upload cover
          </Button>
          {!cover && <p className="text-[11px] leading-snug text-muted-foreground">Skip this and a frame from 1s in becomes the cover.</p>}
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (!file.type.startsWith("image/")) { setError("Choose an image for the cover."); return; }
          replace({ file, url: URL.createObjectURL(file), source: "upload" });
        }}
      />
    </section>
  );
}
