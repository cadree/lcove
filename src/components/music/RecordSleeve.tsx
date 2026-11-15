import { motion, useReducedMotion } from "framer-motion";
import { Lock, Music } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecordSleeveProps {
  cover?: string | null;
  title: string;
  /** False: sealed in its sleeve. True: the record has slid out (unlocked or owner). */
  open: boolean;
  /** Spin the record while it plays. Ignored with reduced motion. */
  spinning?: boolean;
  /** Small label on the seal, e.g. the price or "Exclusive". */
  sealLabel?: string;
  className?: string;
}

/**
 * A locked release as a record in its sleeve. Sealed, the sleeve is wrapped and
 * the record is hidden; once unlocked the record slides out to the right. The
 * whole thing stays inside a square so it lines up with other covers.
 */
export const RecordSleeve = ({ cover, title, open, spinning = false, sealLabel, className }: RecordSleeveProps) => {
  const reduceMotion = useReducedMotion();
  // Sealed: sleeve centered, record hidden behind it. Open: sleeve to the left,
  // record out to the right edge. All in % of the square so cards stay equal.
  const sleeveLeft = open ? "0%" : "10%";
  const recordLeft = open ? "26%" : "13%";

  return (
    <div
      className={cn("relative aspect-square w-full select-none", className)}
      data-testid="record-sleeve"
      data-state={open ? "open" : "sealed"}
    >
      {/* Record: behind the sleeve, slides out when unlocked */}
      <motion.div
        aria-hidden
        className="absolute top-[13%] h-[74%] w-[74%] rounded-full"
        initial={false}
        animate={{ left: recordLeft }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 18, delay: open ? 0.15 : 0 }}
      >
        <motion.div
          className="h-full w-full rounded-full shadow-[0_6px_18px_rgba(0,0,0,0.45)] ring-1 ring-white/15"
          data-record-disc=""
          style={{
            background:
              "radial-gradient(circle at 50% 50%, #111113 0 17%, transparent 17.5%), repeating-radial-gradient(circle at 50% 50%, #2b2b30 0 1.2px, #141417 1.2px 2.8px)",
          }}
          animate={spinning && open && !reduceMotion ? { rotate: 360 } : { rotate: 0 }}
          transition={spinning && open && !reduceMotion ? { repeat: Infinity, ease: "linear", duration: 2.2 } : { duration: 0.4 }}
        >
          {/* Center label carries the cover art */}
          <div className="absolute left-1/2 top-1/2 h-[36%] w-[36%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border border-black/40 bg-muted">
            {cover ? <img src={cover} alt="" draggable={false} className="h-full w-full object-cover" /> : null}
            <span className="absolute left-1/2 top-1/2 h-[14%] w-[14%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
          </div>
          <span
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{ background: "conic-gradient(from 210deg, transparent 0 20%, rgba(255,255,255,0.10) 26%, transparent 32% 70%, rgba(255,255,255,0.07) 76%, transparent 82%)" }}
          />
        </motion.div>
      </motion.div>

      {/* Sleeve */}
      <motion.div
        className="absolute top-[10%] h-[80%] w-[80%] overflow-hidden rounded-[6px] bg-muted shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
        initial={false}
        animate={{ left: sleeveLeft }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 20 }}
      >
        {cover ? (
          <img src={cover} alt={title} draggable={false} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Music className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
        {/* Opening on the right edge where the record comes out */}
        <span className="pointer-events-none absolute right-0 top-0 h-full w-[3px] bg-gradient-to-l from-black/40 to-transparent" />
        {!open && (
          <>
            {/* Shrink wrap */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(115deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.22) 42%, rgba(255,255,255,0) 52%), linear-gradient(180deg, rgba(255,255,255,0.08), rgba(0,0,0,0.18))",
              }}
            />
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-medium text-amber-300 backdrop-blur-sm">
              <Lock className="h-2.5 w-2.5" />
              {sealLabel || "Sealed"}
            </span>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default RecordSleeve;
