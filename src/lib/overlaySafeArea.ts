/** Safe-area insets are 0 on desktop and in a normal browser window. */
export const SAFE_TOP = "env(safe-area-inset-top, 0px)";
export const SAFE_RIGHT = "env(safe-area-inset-right, 0px)";
export const SAFE_BOTTOM = "env(safe-area-inset-bottom, 0px)";
export const SAFE_LEFT = "env(safe-area-inset-left, 0px)";

export type OverlaySide = "top" | "right" | "bottom" | "left";

const BODY_TOKEN =
  /^(?:!|(?:sm|md|lg|xl|2xl):)*(?:p|px|py|pt|pb|pl|pr|gap|space-y|space-x|overflow(?:-[xy])?|overscroll(?:-[xy])?|scrollbar)-/;

/**
 * Design padding and scroll behavior stay on the inner scroller.
 * Width, color, and position stay on the fixed shell so a caller's `p-0`
 * cannot wipe the safe-area inset.
 */
export function splitOverlayBodyClasses(className: string | undefined): { shell: string; body: string } {
  const shell: string[] = [];
  const body: string[] = [];
  for (const token of (className ?? "").split(/\s+/)) {
    if (!token) continue;
    if (BODY_TOKEN.test(token)) body.push(token);
    else shell.push(token);
  }
  return { shell: shell.join(" "), body: body.join(" ") };
}

export function sheetPadsTop(side: OverlaySide): boolean {
  return side !== "bottom";
}

export function sheetPadsBottom(side: OverlaySide): boolean {
  return side !== "top";
}

/** Move a `top-3` control down by the status-bar inset. Desktop stays at 0.75rem. */
export function closeButtonTop(clearStatusBar: boolean): string {
  if (!clearStatusBar) return "0.75rem";
  return `calc(0.75rem + ${SAFE_TOP})`;
}

/** Centered dialog frame. Matches the old `p-4` when every inset is 0. */
export function dialogFramePadding(edge: "top" | "right" | "bottom" | "left"): string {
  const safe = edge === "top" ? SAFE_TOP : edge === "bottom" ? SAFE_BOTTOM : edge === "left" ? SAFE_LEFT : SAFE_RIGHT;
  return `max(1rem, ${safe})`;
}

/** Full-screen dialog padding. A caller keyboard pad wins over the home-indicator inset. */
export function fullscreenEdgePadding(
  edge: "top" | "right" | "bottom" | "left",
  caller: string | number | undefined,
): string {
  const safe = edge === "top" ? SAFE_TOP : edge === "bottom" ? SAFE_BOTTOM : edge === "left" ? SAFE_LEFT : SAFE_RIGHT;
  if (edge !== "bottom" || caller == null || caller === "") return safe;
  const length = typeof caller === "number" ? `${caller}px` : String(caller);
  return `max(${safe}, ${length})`;
}
