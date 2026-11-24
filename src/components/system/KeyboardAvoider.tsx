import { useEffect } from "react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { isTextEntry, nativeKeyboardVisibleHeight, revealDelta, revealTarget, webKeyboardInset } from "@/lib/keyboardViewport";

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
    let fullHeight = window.innerHeight;
    let timer = 0;
    const handles: PluginListenerHandle[] = [];
    let disposed = false;

    const visible = () => {
      const top = viewport?.offsetTop ?? 0;
      const height = viewport?.height ?? window.innerHeight;
      // With Keyboard.resize="body" the WebView can already be smaller.
      // Use the pre-keyboard height to avoid subtracting twice.
      return { top, height: nativeKeyboardVisibleHeight(height, fullHeight, nativeKeyboard) };
    };

    let inset = 0;
    const reveal = () => {
      const focused = document.activeElement;
      if (!isTextEntry(focused)) return;
      const { top, height } = visible();
      // Sign-in style forms: keep the submit button in view with the field when both fit.
      const submit = focused.closest("form")?.querySelector<HTMLElement>('button[type="submit"]') ?? null;
      const target = () => revealTarget(focused.getBoundingClientRect(), submit?.getBoundingClientRect() ?? null, height);
      if (!revealDelta(target(), top, height)) return;
      // Keep nested scroll areas usable while the app's body is also scrollable.
      // Inner scroll areas first, then the page, measured against the part the keyboard leaves.
      focused.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
      const delta = revealDelta(target(), top, height);
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
      if (!nativeKeyboard) fullHeight = window.innerHeight;
      inset = nativeKeyboard || (viewport ? webKeyboardInset(window.innerHeight, viewport.height, viewport.offsetTop) : 0);
      root.style.setProperty("--keyboard-inset", `${inset}px`);
      root.toggleAttribute("data-keyboard-open", inset > 0);
      const focused = document.activeElement;
      // Even before a field becomes hidden, the last form controls need enough
      // scroll room. Dialogs/sheets manage their own keyboard-safe height.
      root.toggleAttribute("data-keyboard-pad", inset > 0 && isTextEntry(focused) && !focused.closest('[role="dialog"]'));
      schedule(inset > 0 ? 280 : 0);
    };

    const onFocus = (event: FocusEvent) => {
      const focused = event.target as Element;
      if (!isTextEntry(focused)) return;
      root.toggleAttribute("data-keyboard-pad", inset > 0 && !focused.closest('[role="dialog"]'));
      schedule(320);
    };

    viewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", onFocus);
    if (Capacitor.isNativePlatform()) {
      void (async () => {
        const willShow = await Keyboard.addListener("keyboardWillShow", (info) => {
          // Capture the full window height before the keyboard animates in.
          fullHeight = window.innerHeight;
          nativeKeyboard = info.keyboardHeight;
          update();
        });
        const show = await Keyboard.addListener("keyboardDidShow", (info) => {
          nativeKeyboard = info.keyboardHeight;
          update();
        });
        const hide = await Keyboard.addListener("keyboardWillHide", () => {
          nativeKeyboard = 0;
          update();
        });
        if (disposed) {
          void willShow.remove();
          void show.remove();
          void hide.remove();
        } else handles.push(willShow, show, hide);
      })().catch(() => undefined);
    }
    update();
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.clearTimeout(second);
      viewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", onFocus);
      handles.forEach((handle) => void handle.remove());
      root.style.removeProperty("--keyboard-inset");
      root.removeAttribute("data-keyboard-open");
      root.removeAttribute("data-keyboard-pad");
    };
  }, []);
  return null;
}
