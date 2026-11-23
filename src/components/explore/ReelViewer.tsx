import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Play, Volume2, VolumeX, X } from "lucide-react";
import { FeedVideo } from "@/components/media/FeedVideo";
import type { BrowseReel } from "@/lib/exploreBrowse";

/**
 * Full-screen vertical reels, one per screen. FeedVideo plays only the reel
 * that is on screen and drops the source of reels far away, so memory stays flat.
 */
export function ReelViewer({ reels, start, onClose }: { reels: BrowseReel[]; start: number; onClose: () => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);

  useLayoutEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTop = start * element.clientHeight;
  }, [start]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const round = "flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur";

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Reels" className="fixed inset-0 z-[60] bg-black text-white">
      <div ref={scroller} data-testid="reel-scroller" className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain scrollbar-hide">
        {reels.map((reel) => (
          <ReelSlide key={reel.id} reel={reel} muted={muted} />
        ))}
        <div className="flex h-full snap-start snap-always flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="ether-title text-[26px]">You're all caught up</p>
          <p className="text-sm text-white/70">You've seen every reel. New ones show up here when people post them.</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => scroller.current?.scrollTo({ top: 0 })} className="mono-label min-h-11 rounded-full border border-white/40 px-4 text-[11px]">
              Watch again
            </button>
            <button type="button" onClick={onClose} className="mono-label min-h-11 rounded-full bg-white px-4 text-[11px] text-black">
              Back to Explore
            </button>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between px-3" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)" }}>
        <button type="button" onClick={onClose} aria-label="Close reels" className={`pointer-events-auto ${round}`}>
          <X className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => setMuted((value) => !value)} aria-label={muted ? "Turn sound on" : "Turn sound off"} className={`pointer-events-auto ${round}`}>
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>
    </div>,
    document.body,
  );
}

function ReelSlide({ reel, muted }: { reel: BrowseReel; muted: boolean }) {
  const progress = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState(false);

  return (
    <article data-reel-id={reel.id} className="relative h-full snap-start snap-always">
      <FeedVideo
        src={reel.mediaUrl}
        className="h-full w-full object-contain"
        preload="auto"
        playWhenVisible
        muted={muted}
        onClick={(event) => {
          const video = event.currentTarget;
          if (video.paused) void video.play().catch(() => undefined);
          else video.pause();
          setHeld(video.paused);
        }}
        onPlay={() => setHeld(false)}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          if (progress.current && video.duration) progress.current.style.transform = `scaleX(${video.currentTime / video.duration})`;
        }}
      />
      {held && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50">
            <Play className="h-7 w-7 fill-white" />
          </span>
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 px-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}>
        <Link to={`/profile/${reel.userId}`} className="flex min-h-11 items-center justify-between rounded-full bg-background/90 px-4 text-foreground">
          <span className="truncate font-body text-sm font-extrabold">{reel.name}</span>
          <span className="mono-label shrink-0 text-[9px] text-muted-foreground">Profile</span>
        </Link>
        <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-white/25">
          <div ref={progress} data-testid="reel-progress" className="h-full origin-left bg-white" style={{ transform: "scaleX(0)" }} />
        </div>
      </div>
    </article>
  );
}
