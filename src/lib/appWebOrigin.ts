import { Capacitor } from "@capacitor/core";
import { resolvePublicWebOrigin } from "./publicWebOrigin.mjs";

/** The site to put in shared links, or null when this build has no safe one. */
export function publicWebOrigin(): string | null {
  return resolvePublicWebOrigin({
    configured: import.meta.env.VITE_PUBLIC_WEB_ORIGIN,
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    projectId: import.meta.env.VITE_SUPABASE_PROJECT_ID,
    native: Capacitor.isNativePlatform(),
    currentOrigin: typeof window === "undefined" ? undefined : window.location.origin,
  });
}
