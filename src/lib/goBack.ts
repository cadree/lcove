/**
 * React Router writes the in-app stack index on history.state.idx.
 * A deep link or a fresh tab has no earlier entry (missing or 0).
 */
export function historyIndex(state: unknown): number | null {
  if (!state || typeof state !== "object") return null;
  const idx = (state as { idx?: unknown }).idx;
  return typeof idx === "number" && Number.isFinite(idx) ? idx : null;
}

/** -1 pops the previous in-app screen. Otherwise the feed. */
export function backTarget(state: unknown, fallback = "/feed"): -1 | string {
  const idx = historyIndex(state);
  if (idx !== null && idx > 0) return -1;
  return fallback;
}
