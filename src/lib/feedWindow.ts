/** Newest posts loaded for the home feed. Older rows stay on the server. */
export const FEED_POST_LIMIT = 40;

/** Cards mounted at once. The rest wait for Show more so the phone is not painting the whole archive. */
export const FEED_RENDER_PAGE = 12;

export const DIRECTORY_RENDER_PAGE = 24;

export const REQUEST_DEADLINE_MS = 12_000;

export function nextRenderedCount(shown: number, total: number, page = FEED_RENDER_PAGE): number {
  const safeShown = Number.isFinite(shown) ? Math.max(0, Math.trunc(shown)) : 0;
  const safeTotal = Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : 0;
  return Math.min(safeTotal, safeShown + page);
}

/** Stagger only the first screen. A long delay list keeps the main thread scheduling motion. */
export function listEnterDelay(index: number, step = 0.04, cap = 6): number {
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.trunc(index)) : 0;
  return Math.min(safeIndex, cap) * step;
}

/** A story view from someone else must not refetch every open story on this phone. */
export function storyViewShouldRefresh(storyId: string | undefined, ownedStoryIds: ReadonlySet<string>): boolean {
  return typeof storyId === "string" && storyId.length > 0 && ownedStoryIds.has(storyId);
}
