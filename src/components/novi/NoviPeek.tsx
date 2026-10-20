import cutout from "@/assets/novi-cutout.png";
import { cn } from "@/lib/utils";

function NoviBody() {
  return (
    <span className="novi-bob">
      <span className="novi-glance">
        <img src={cutout} alt="" />
        <span className="novi-lid novi-lid-left" />
        <span className="novi-lid novi-lid-right" />
      </span>
    </span>
  );
}

/**
 * Novi hiding behind an edge. The window shows his head and shoulders from the
 * full cutout; the card clips the rest of his body.
 */
export function NoviPeek({
  className,
  onPress,
  label = "Ask Novi",
}: {
  className?: string;
  onPress?: () => void;
  label?: string;
}) {
  if (!onPress) {
    return (
      <span className={cn("novi-peek novi-alive", className)} aria-hidden="true">
        <NoviBody />
      </span>
    );
  }

  return (
    <button
      type="button"
      className={cn("novi-peek novi-alive novi-press", className)}
      onClick={onPress}
      aria-label={label}
    >
      <NoviBody />
    </button>
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
