import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";

/** Keeps reduced-motion on for every screen without putting framer-motion in the entry chunk. */
export default function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
