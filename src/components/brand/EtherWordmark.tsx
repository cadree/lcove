import type { CSSProperties } from "react";
import wordmark from "@/assets/ether-wordmark.webp";
import { cn } from "@/lib/utils";

type EtherWordmarkProps = {
  className?: string;
  alt?: string;
  style?: CSSProperties;
};

/** Official neon ETHER wordmark. The image is the word, so nearby text must not repeat it. */
export function EtherWordmark({ className, alt = "Ether", style }: EtherWordmarkProps) {
  return (
    <img
      src={wordmark}
      alt={alt}
      style={style}
      className={cn("block h-auto w-auto max-w-full object-contain", className)}
    />
  );
}
