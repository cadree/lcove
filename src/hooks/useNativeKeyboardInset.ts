import { useEffect, useState } from "react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { liveKeyboardInset } from "@/lib/liveKeyboard";

/** Native keyboard height. Web and a closed keyboard stay at 0. */
export function useNativeKeyboardInset(active = true): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!active || !Capacitor.isNativePlatform()) {
      setInset(0);
      return;
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
