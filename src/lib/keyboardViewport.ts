/** Below this the change is Safari's toolbar collapsing, not a keyboard. */
export const MIN_KEYBOARD_PX = 120;

/**
 * Keyboard height in a browser, from the visual viewport. iOS Safari keeps
 * the layout viewport full height and shrinks (and may scroll) the visual one.
 */
export function webKeyboardInset(innerHeight: number, viewportHeight: number, viewportTop: number): number {
  if (![innerHeight, viewportHeight, viewportTop].every(Number.isFinite)) return 0;
  const covered = Math.round(innerHeight - viewportHeight - Math.max(0, viewportTop));
  return covered >= MIN_KEYBOARD_PX ? covered : 0;
}

/** True when a focused field sits under the keyboard or above the visible area. */
export function needsReveal(
  rect: { top: number; bottom: number },
  viewportTop: number,
  viewportHeight: number,
  margin = 8,
): boolean {
  return rect.bottom > viewportTop + viewportHeight - margin || rect.top < viewportTop + margin;
}

/** Window scroll that puts the field a little above the middle of the visible area. */
export function revealDelta(
  rect: { top: number; bottom: number },
  viewportTop: number,
  viewportHeight: number,
): number {
  if (!needsReveal(rect, viewportTop, viewportHeight)) return 0;
  return Math.round((rect.top + rect.bottom) / 2 - (viewportTop + viewportHeight * 0.45));
}

export function isTextEntry(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return !["button", "checkbox", "radio", "range", "color", "file", "submit", "reset", "image", "hidden"].includes(element.type);
}
