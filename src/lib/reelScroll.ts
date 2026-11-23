/**
 * Opening position for the full-screen reel viewer.
 *
 * iOS WebKit snaps a scroll-snap container back when scrollTop is set in code
 * (WebKit bug 300086 and related), so the viewer could open on the wrong reel
 * or jitter. Turn snapping off while positioning, re-assert the position on
 * the next frame, then restore snapping, so swiping keeps its feel.
 */

export function reelStartIndex(start: number, count: number): number {
  if (!Number.isFinite(start) || count <= 0) return 0;
  return Math.min(Math.max(0, Math.trunc(start)), count - 1);
}

type Scroller = { scrollTop: number; clientHeight: number; style: { scrollSnapType: string } };
type Frame = (callback: () => void) => unknown;

/** Puts the scroller at slide `index` without letting snapping pull it back. */
export function jumpToSlide(element: Scroller, index: number, frame: Frame): void {
  const top = () => index * element.clientHeight;
  const previous = element.style.scrollSnapType;
  element.style.scrollSnapType = "none";
  element.scrollTop = top();
  frame(() => {
    element.scrollTop = top();
    frame(() => {
      element.style.scrollSnapType = previous;
    });
  });
}
