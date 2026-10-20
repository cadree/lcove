/** Ease used by the XP count-up. 0 and 1 stay put. */
export function easeOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}

export function countAt(from: number, to: number, t: number): number {
  return Math.round(from + (to - from) * easeOutCubic(t));
}

export const XP_COUNT_MS = 680;
