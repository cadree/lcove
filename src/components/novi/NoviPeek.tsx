import peek from "@/assets/novi-head-peek.png";
import cutout from "@/assets/novi-cutout.png";
import { cn } from "@/lib/utils";

export function NoviPeek({ className }: { className?: string }) {
  return (
    <img
      src={peek}
      alt=""
      className={cn("pointer-events-none h-16 w-16 object-contain drop-shadow-[0_10px_18px_rgba(255,159,200,0.45)]", className)}
    />
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
