import cutout from "@/assets/novi-cutout.png";
import { cn } from "@/lib/utils";

/**
 * Novi hiding behind an edge. The window shows his head and shoulders from the
 * full cutout; the card clips the rest of his body.
 */
export function NoviPeek({ className }: { className?: string }) {
  return (
    <span className={cn("novi-peek", className)} aria-hidden="true">
      <img src={cutout} alt="" />
    </span>
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
