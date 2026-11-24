/**
 * Stacked match deck geometry and gestures. The card in front is depth 0; up to
 * BEHIND cards sit behind it, each lifted and narrowed so its title row peeks out.
 * Only transform and opacity change, so WebKit composites the motion.
 */
export const BEHIND = 3;
/** How far each card behind peeks out above the one in front, in px. */
export const PEEK_PX = 30;
/** A horizontal drag at least this long moves one card. */
export const SWIPE_PX = 64;

export interface StackPose {
  transform: string;
  opacity: number;
  zIndex: number;
}

export function stackPose(depth: number): StackPose {
  const d = Math.max(0, Math.min(BEHIND, depth));
  return {
    transform: `translate3d(0, ${-d * PEEK_PX}px, 0) scale(${(1 - d * 0.055).toFixed(3)})`,
    opacity: d === 0 ? 1 : Math.max(0.35, 1 - d * 0.18),
    zIndex: 20 - d,
  };
}

/** Where a finished drag leaves the deck: the next card, the previous one, or the same. */
export function swipeTarget(dx: number, index: number, count: number): number {
  if (Math.abs(dx) < SWIPE_PX || count <= 0) return index;
  const next = dx < 0 ? index + 1 : index - 1;
  return Math.max(0, Math.min(count - 1, next));
}

/** A pointer move becomes a card drag only once it is clearly sideways. */
export function isSideways(dx: number, dy: number): boolean {
  return Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2;
}

/** Up to five pager dots, with the active one kept in view on long decks. */
export function pagerDots(index: number, count: number, max = 5): { start: number; dots: number[] } {
  if (count <= max) return { start: 0, dots: Array.from({ length: count }, (_, i) => i) };
  const start = Math.max(0, Math.min(count - max, index - Math.floor(max / 2)));
  return { start, dots: Array.from({ length: max }, (_, i) => start + i) };
}
