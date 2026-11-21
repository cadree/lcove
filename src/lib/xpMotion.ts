import { xpBar } from "./noviQuests.ts";

/** Ease used by the XP count-up. 0 and 1 stay put. */
export function easeOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}

export function countAt(from: number, to: number, t: number): number {
  return Math.round(from + (to - from) * easeOutCubic(t));
}

export const XP_COUNT_MS = 680;

export interface XpReadout {
  xp: number;
  level: number;
  into: number;
  span: number;
  ratio: number;
}

/**
 * Level and bar for the XP currently on screen.
 * The integer is what the label shows, so the level cannot flip ahead of it.
 * Bands come from xpBar, the client copy of public.xp_level.
 */
export function readoutAt(displayedXp: number): XpReadout {
  const rounded = Math.round(displayedXp);
  const xp = Number.isFinite(rounded) ? Math.max(0, rounded) : 0;
  const bar = xpBar(xp);
  return { xp, level: bar.level, into: bar.into, span: bar.span, ratio: bar.ratio };
}
