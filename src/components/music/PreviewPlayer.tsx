import { useEffect, useRef, useState } from "react";
import { Play, Pause, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface PreviewPlayerProps {
  audioUrl: string;
  startSeconds?: number;
  durationSeconds?: number;
  locked?: boolean;
  className?: string;
}

/**
 * Plays a clipped preview window from a (potentially full) audio file.
 * When `locked` is true, playback is forced to start at `startSeconds` and
 * stops after `durationSeconds`. Download UI is suppressed.
 */
export const PreviewPlayer = ({
  audioUrl,
  startSeconds = 0,
  durationSeconds = 15,
  locked = true,
  className,
}: PreviewPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 - 1 within preview window

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [audioUrl]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!audioUrl) return;

    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    if (!audioRef.current) {
      const audio = new Audio(audioUrl);
      audio.preload = "metadata";
      audioRef.current = audio;
    }
    const audio = audioRef.current;

    const onLoaded = () => {
      try {
        audio.currentTime = locked ? startSeconds : 0;
      } catch {
        // ignore seek errors
      }
    };

    const onTime = () => {
      if (!locked) {
        setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
        return;
      }
      const elapsed = audio.currentTime - startSeconds;
      setProgress(Math.min(1, Math.max(0, elapsed / durationSeconds)));
      if (elapsed >= durationSeconds) {
        audio.pause();
        audio.currentTime = startSeconds;
        setIsPlaying(false);
        setProgress(0);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener("loadedmetadata", onLoaded, { once: true });
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);

    if (audio.readyState >= 1) onLoaded();
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  };

  return (
    <div
      className={cn("flex items-center gap-2 w-full", className)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        type="button"
        onClick={handleToggle}
        className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 hover:scale-105 transition-transform"
        aria-label={isPlaying ? "Pause preview" : "Play preview"}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">
            {locked ? `${durationSeconds}s preview` : "Full track"}
          </span>
          {locked && (
            <span className="flex items-center gap-1 text-[10px] text-amber-500">
              <Lock className="w-2.5 h-2.5" /> Locked
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
