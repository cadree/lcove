import { useEffect, useRef, useState } from "react";
import { easeOutCubic, XP_COUNT_MS } from "@/lib/xpMotion";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/** Counts toward target. Reduced motion snaps. The feed does not await this. */
export function useEasedNumber(target: number, duration = XP_COUNT_MS): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(() => (reduced ? target : 0));
  const valueRef = useRef(value);
  const started = useRef(false);

  useEffect(() => {
    if (reduced) {
      valueRef.current = target;
      setValue(target);
      return;
    }
    const from = started.current ? valueRef.current : 0;
    started.current = true;
    if (from === target) {
      valueRef.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = from + (target - from) * easeOutCubic(t);
      valueRef.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reduced, duration]);

  return reduced ? target : value;
}
