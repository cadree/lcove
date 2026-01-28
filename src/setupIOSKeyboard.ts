import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";

export function setupIOSKeyboard() {
  if (Capacitor.getPlatform() === "ios") {
    Keyboard.setAccessoryBarVisible({ isVisible: false });
    Keyboard.setResizeMode({ mode: "body" });
  }
}


