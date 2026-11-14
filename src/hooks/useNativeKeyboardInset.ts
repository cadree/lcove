import { useEffect, useState } from "react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { liveKeyboardInset } from "@/lib/liveKeyboard";
import { webKeyboardInset } from "@/lib/keyboardViewport";

/**
 * Keyboard height for a fixed, full-height screen with a bottom composer.
 * The iOS app reads it from the Keyboard plugin; iPhone Safari from the
 * visual viewport. A closed keyboard is 0.
 */
export function useNativeKeyboardInset(active = true): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!active) {
      setInset(0);
      return;
    }

    if (!Capacitor.isNativePlatform()) {
      const viewport = window.visualViewport;
      if (!viewport) return;
      const update = () => setInset(webKeyboardInset(window.innerHeight, viewport.height, viewport.offsetTop));
      viewport.addEventListener("resize", update);
      viewport.addEventListener("scroll", update);
      update();
      return () => {
        viewport.removeEventListener("resize", update);
        viewport.removeEventListener("scroll", update);
        setInset(0);
      };
    }

    const handles: PluginListenerHandle[] = [];
    let cancelled = false;

    const listen = async () => {
      const show = await Keyboard.addListener("keyboardWillShow", (info) => {
        setInset(liveKeyboardInset(info.keyboardHeight));
      });
      const hide = await Keyboard.addListener("keyboardWillHide", () => {
        setInset(0);
      });
      if (cancelled) {
        void show.remove();
        void hide.remove();
        return;
      }
      handles.push(show, hide);
    };

    void listen();
    return () => {
      cancelled = true;
      handles.forEach((handle) => {
        void handle.remove();
      });
      setInset(0);
    };
  }, [active]);

  return inset;
}
