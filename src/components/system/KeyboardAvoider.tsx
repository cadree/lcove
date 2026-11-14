import { useEffect } from "react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { isTextEntry, needsReveal, revealDelta, webKeyboardInset } from "@/lib/keyboardViewport";

/**
 * App-wide: when the keyboard opens or a field gains focus, scroll the field
 * into the part of the screen the keyboard leaves visible. Also publishes
 * --keyboard-inset for fixed footers. Dialogs and sheets add their own
 * sizing on top (useOverlayViewport).
 */
export function KeyboardAvoider() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let nativeKeyboard = 0;
    let timer = 0;
    const handles: PluginListenerHandle[] = [];
    let disposed = false;

    const visible = () => {
      const top = viewport?.offsetTop ?? 0;
      const height = viewport?.height ?? window.innerHeight;
      // On the iOS app the WebView keeps its height; the plugin reports the keyboard.
      return { top, height: nativeKeyboard ? Math.min(height, window.innerHeight - nativeKeyboard) : height };
    };

    let inset = 0;
    const reveal = () => {
      const focused = document.activeElement;
      if (!isTextEntry(focused)) return;
      const { top, height } = visible();
      if (!needsReveal(focused.getBoundingClientRect(), top, height)) return;
      // Room below the last field, only when a field actually needs to move.
      if (inset > 0) root.setAttribute("data-keyboard-pad", "");
      // Inner scroll areas first, then the page, measured against the part the keyboard leaves.
      focused.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
      const delta = revealDelta(focused.getBoundingClientRect(), top, height);
      if (delta) window.scrollBy({ top: delta, behavior: "instant" });
    };

    let second = 0;
    // Wait for the keyboard animation, then check once more after the browser's own focus scroll settles.
    const schedule = (delay: number) => {
      window.clearTimeout(timer);
      window.clearTimeout(second);
      timer = window.setTimeout(reveal, delay);
      second = window.setTimeout(reveal, delay + 350);
    };

    const update = () => {
      inset = nativeKeyboard || (viewport ? webKeyboardInset(window.innerHeight, viewport.height, viewport.offsetTop) : 0);
      root.style.setProperty("--keyboard-inset", `${inset}px`);
      root.toggleAttribute("data-keyboard-open", inset > 0);
      if (!inset) root.removeAttribute("data-keyboard-pad");
      schedule(inset > 0 ? 280 : 0);
    };

    const onFocus = (event: FocusEvent) => {
      if (!isTextEntry(event.target as Element)) return;
      schedule(320);
    };

    viewport?.addEventListener("resize", update);
    document.addEventListener("focusin", onFocus);
    if (Capacitor.isNativePlatform()) {
      void (async () => {
        const show = await Keyboard.addListener("keyboardDidShow", (info) => {
          nativeKeyboard = info.keyboardHeight;
          update();
        });
        const hide = await Keyboard.addListener("keyboardWillHide", () => {
          nativeKeyboard = 0;
          update();
        });
        if (disposed) {
          void show.remove();
          void hide.remove();
        } else handles.push(show, hide);
      })().catch(() => undefined);
    }
    update();
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.clearTimeout(second);
      viewport?.removeEventListener("resize", update);
      document.removeEventListener("focusin", onFocus);
      handles.forEach((handle) => void handle.remove());
      root.style.removeProperty("--keyboard-inset");
      root.removeAttribute("data-keyboard-open");
      root.removeAttribute("data-keyboard-pad");
    };
  }, []);
  return null;
}
