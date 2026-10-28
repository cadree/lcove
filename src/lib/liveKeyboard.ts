/** Bottom inset while the native keyboard is open. */
export function liveKeyboardInset(height: number | null | undefined): number {
  if (typeof height !== "number" || !Number.isFinite(height) || height <= 0) return 0;
  return Math.round(height);
}

/**
 * Padding for the single shell that owns a bottom composer.
 * A closed keyboard returns undefined so an existing safe-area pad is left
 * alone. An open keyboard returns its height once; passing that result back
 * in yields the same padding, not a second copy.
 */
export function keyboardPaddingStyle(
  height: number | null | undefined,
): { paddingBottom: number } | undefined {
  const padding = liveKeyboardInset(height);
  if (padding <= 0) return undefined;
  return { paddingBottom: padding };
}

export interface ScrollableList {
  scrollHeight: number;
  scrollTop: number;
}

/** Keep the newest row in view when the keyboard opens. A closed keyboard leaves the list where it is. */
export function pinMessageListToEnd(
  list: ScrollableList | null | undefined,
  height: number | null | undefined,
): boolean {
  if (!list || liveKeyboardInset(height) <= 0) return false;
  list.scrollTop = list.scrollHeight;
  return true;
}
