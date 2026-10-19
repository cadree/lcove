import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const iconFills = {
  pink: "linear-gradient(160deg, #FFD6E8 0%, #FF5FA2 100%)",
  rose: "linear-gradient(160deg, #FF9FC8 0%, #C4142D 100%)",
  red: "linear-gradient(160deg, #FF3D49 0%, #7D0610 100%)",
  cyan: "linear-gradient(160deg, #9FE0EA 0%, #1F6F7A 100%)",
  gold: "linear-gradient(160deg, #EBD2B4 0%, #9A6E4C 100%)",
  denim: "linear-gradient(160deg, #A9B8EA 0%, #3A4A8C 100%)",
  bone: "linear-gradient(160deg, #F4F0E8 0%, #B9B4A8 100%)",
  violet: "linear-gradient(160deg, #C2B8FF 0%, #5B4BE0 100%)",
  ink: "linear-gradient(160deg, #3B3540 0%, #121016 100%)",
  green: "linear-gradient(160deg, #B5DD9A 0%, #3F8F5E 100%)",
} as const;

export type IconFill = keyof typeof iconFills;

const INK_GLYPH = new Set<IconFill>(["pink", "bone", "gold"]);

interface SquircleIconProps {
  icon: LucideIcon;
  fill: IconFill;
  size?: number;
  glyph?: number;
  className?: string;
}

/** 22.5% squircle, two-stop gradient, centered line glyph, top gloss. */
export function SquircleIcon({ icon: Icon, fill, size = 40, glyph, className }: SquircleIconProps) {
  const glyphSize = glyph ?? Math.round(size * 0.55);
  return (
    <span
      className={cn("squircle-icon", className)}
      style={{
        width: size,
        height: size,
        backgroundImage: iconFills[fill],
        color: INK_GLYPH.has(fill) ? "#0A0A0A" : "#FFFFFF",
      }}
      aria-hidden="true"
    >
      <Icon size={glyphSize} strokeWidth={1.9} absoluteStrokeWidth />
    </span>
  );
}
