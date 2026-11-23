import { useEffect, type RefObject } from "react";

/**
 * Keep two-finger gestures on this element instead of zooming the page.
 * The app allows page zoom for accessibility, so the camera and the story
 * editor opt out where they handle pinch themselves. iOS needs the WebKit
 * gesture events and a non-passive touchmove for this.
 */
export function useBlockPagePinch(ref: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    const node = ref.current;
    if (!node || !active) return;
    const stop = (event: Event) => event.preventDefault();
    const onTouch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    node.addEventListener("gesturestart", stop);
    node.addEventListener("gesturechange", stop);
    node.addEventListener("touchstart", onTouch, { passive: false });
    node.addEventListener("touchmove", onTouch, { passive: false });
    return () => {
      node.removeEventListener("gesturestart", stop);
      node.removeEventListener("gesturechange", stop);
      node.removeEventListener("touchstart", onTouch);
      node.removeEventListener("touchmove", onTouch);
    };
  }, [ref, active]);
}
