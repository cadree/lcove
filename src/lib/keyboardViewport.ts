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

/**
 * Native iOS can either overlay the WebView or resize it. Use the smaller of
 * the visual viewport and the original window minus the native keyboard,
 * rather than subtracting the keyboard twice from a resized window.
 */
export function nativeKeyboardVisibleHeight(
  visualHeight: number,
  fullHeight: number,
  keyboardHeight: number,
): number {
  if (![visualHeight, fullHeight, keyboardHeight].every(Number.isFinite)) return 0;
  if (keyboardHeight <= 0) return Math.max(0, visualHeight);
  return Math.max(0, Math.min(visualHeight, fullHeight - keyboardHeight));
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

/** Minimum scroll needed to keep a focused input inside the usable viewport. */
export function revealDelta(
  rect: { top: number; bottom: number },
  viewportTop: number,
  viewportHeight: number,
): number {
  const margin = 20;
  if (!needsReveal(rect, viewportTop, viewportHeight, margin)) return 0;
  const upper = viewportTop + margin;
  const lower = viewportTop + viewportHeight - margin;
  // Keeping the field near its current position avoids throwing the header
  // under the iPhone status bar every time the keyboard opens.
  if (rect.bottom > lower) return Math.ceil(rect.bottom - lower);
  if (rect.top < upper) return Math.floor(rect.top - upper);
  return 0;
}

export function isTextEntry(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return !["button", "checkbox", "radio", "range", "color", "file", "submit", "reset", "image", "hidden"].includes(element.type);
}
