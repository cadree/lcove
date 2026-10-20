export function shouldScrollReveal(input: { hasIntersectionObserver: boolean; prefersReducedMotion: boolean }): boolean {
  return input.hasIntersectionObserver && !input.prefersReducedMotion;
}

export function scrollRevealEnabled(): boolean {
  if (typeof window === "undefined") return false;
  let prefersReducedMotion = false;
  try {
    prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    prefersReducedMotion = false;
  }
  return shouldScrollReveal({
    hasIntersectionObserver: typeof window.IntersectionObserver === "function",
    prefersReducedMotion,
  });
}

type RevealOptions = {
  delay?: number;
  duration?: number;
  y?: number;
  x?: number;
  scale?: number;
};

/** Visible immediately when motion or IntersectionObserver is unavailable. */
export function revealMotion(options: RevealOptions = {}) {
  if (!scrollRevealEnabled()) {
    return { initial: false as const };
  }
  const initial: Record<string, number> = { opacity: 0 };
  const target: Record<string, number> = { opacity: 1 };
  if (options.x != null) {
    initial.x = options.x;
    target.x = 0;
  }
  if (options.scale != null) {
    initial.scale = options.scale;
    target.scale = 1;
  }
  if (options.y != null) {
    initial.y = options.y;
    target.y = 0;
  } else if (options.x == null && options.scale == null) {
    initial.y = 20;
    target.y = 0;
  }
  return {
    initial,
    whileInView: target,
    viewport: { once: true as const },
    transition: { duration: options.duration ?? 0.5, delay: options.delay ?? 0 },
  };
}
