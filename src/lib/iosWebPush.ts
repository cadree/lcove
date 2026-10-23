export interface IosPushEnvironment {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  /** iOS Safari `navigator.standalone` when launched from the Home Screen. */
  standalone: boolean;
  displayMode: string;
  nativeIosApp: boolean;
}

export function isIosBrowser(env: IosPushEnvironment): boolean {
  if (env.nativeIosApp) return false;
  if (/iPad|iPhone|iPod/i.test(env.userAgent || "")) return true;
  return env.platform === "MacIntel" && env.maxTouchPoints > 1;
}

export function isInstalledWebApp(env: IosPushEnvironment): boolean {
  if (env.standalone) return true;
  return env.displayMode === "standalone" || env.displayMode === "fullscreen";
}

/** Plain Safari cannot subscribe. The Home Screen app (iOS 16.4+) can. */
export function iosPushNeedsHomeScreen(env: IosPushEnvironment): boolean {
  return isIosBrowser(env) && !isInstalledWebApp(env);
}

export function readIosPushEnvironment(nativeIosApp: boolean): IosPushEnvironment {
  const nav = navigator as Navigator & { standalone?: boolean };
  const standaloneMode = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const fullscreenMode = window.matchMedia?.("(display-mode: fullscreen)").matches ?? false;
  return {
    userAgent: nav.userAgent || "",
    platform: nav.platform || "",
    maxTouchPoints: nav.maxTouchPoints || 0,
    standalone: nav.standalone === true,
    displayMode: standaloneMode ? "standalone" : fullscreenMode ? "fullscreen" : "browser",
    nativeIosApp,
  };
}
