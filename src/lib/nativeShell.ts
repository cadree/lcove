import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { NATIVE_SPLASH_RETRY_MS, allowsWebServiceWorker } from "@/lib/nativeShellPolicy";

/**
 * Dismiss the native splash. Safe to call more than once. Does not wait on
 * Supabase, the session, or any other request — a failed fetch must not leave
 * the bear on screen. The iOS plugin drops a hide() that arrives before the
 * splash view is visible, so bootNativeShell retries.
 */
export function hideNativeSplash(): void {
  if (!Capacitor.isNativePlatform()) return;
  SplashScreen.hide({ fadeOutDuration: 150 }).catch((error: unknown) => {
    console.warn("[nativeShell] splash hide failed", error);
  });
}

export function bootNativeShell(): void {
  if (!Capacitor.isNativePlatform()) return;

  hideNativeSplash();
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => requestAnimationFrame(hideNativeSplash));
  }
  for (const delay of NATIVE_SPLASH_RETRY_MS) {
    window.setTimeout(hideNativeSplash, delay);
  }

  if (allowsWebServiceWorker(true)) return;
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch((error: unknown) => {
      console.warn("[nativeShell] service worker unregister failed", error);
    });
}
