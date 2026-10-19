import type { CSSProperties } from "react";
import wordmark from "@/assets/ether-wordmark.png";
import wordmarkLight from "@/assets/ether-wordmark-light.png";
import { cn } from "@/lib/utils";

type EtherWordmarkProps = {
  className?: string;
  alt?: string;
  style?: CSSProperties;
  /** Splash and other ink surfaces. Skips the light-mode plate. */
  plain?: boolean;
};

/** Official ETHER wordmark. The image is the word, so nearby text must not repeat it. */
export function EtherWordmark({ className, alt = "Ether", style, plain = false }: EtherWordmarkProps) {
  if (plain) {
    return (
      <img
        src={wordmark}
        alt={alt}
        style={style}
        className={cn("block h-auto w-auto max-w-full object-contain", className)}
      />
    );
  }

  return (
    <span className={cn("ether-mark", className)}>
      <img src={wordmark} alt={alt} className="ether-wordmark-dark" />
      <img src={wordmarkLight} alt={alt} className="ether-wordmark-light" />
    </span>
  );
}
