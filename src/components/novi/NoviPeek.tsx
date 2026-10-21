import { useState } from "react";
import cutout from "@/assets/novi-cutout.png";
import { NoviGuide } from "@/components/novi/NoviGuide";
import { cn } from "@/lib/utils";

/**
 * Novi hiding behind an edge. The window shows his head and shoulders from the
 * full cutout; the card clips the rest of his body. A tap opens the quest guide.
 */
export function NoviPeek({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={cn("novi-peek", className)}
        aria-label="Open Novi's guide"
        onClick={() => setOpen(true)}
      >
        <img src={cutout} alt="" />
      </button>
      <NoviGuide open={open} onOpenChange={setOpen} />
    </>
  );
}

export function NoviCutout({ className }: { className?: string }) {
  return (
    <img
      src={cutout}
      alt=""
      className={cn("pointer-events-none object-contain drop-shadow-[0_16px_28px_rgba(255,159,200,0.4)]", className)}
    />
  );
}
