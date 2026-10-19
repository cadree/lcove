import { NATIVE_APP_ID } from "../config/nativeIds.ts";

const WEB_HOSTS = new Set(["etherbylcove.com", "www.etherbylcove.com"]);

/**
 * Custom-scheme redirect Supabase Auth must allow.
 * `/auth?confirmed=1` becomes `com.etherbylcove.app://auth?confirmed=1`.
 */
export function nativeAuthRedirect(appId: string, path = "/"): string {
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  if (withSlash === "/") return `${appId}://`;
  return `${appId}://${withSlash.slice(1)}`;
}

export function nativeAuthRedirectUrl(path = "/"): string {
  return nativeAuthRedirect(NATIVE_APP_ID, path);
}

/**
 * In-app path for an https universal link or a non-auth custom-scheme link.
 * Auth callbacks (tokens, codes, errors) are not routed here.
 */
export function appPathFromIncomingUrl(url: string, appId: string = NATIVE_APP_ID): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol === "https:" && WEB_HOSTS.has(parsed.hostname)) {
    return `${parsed.pathname || "/"}${parsed.search}`;
  }

  if (parsed.protocol === `${appId}:`) {
    const host = parsed.hostname;
    if (!host || host === "auth") return null;
    const rest = parsed.pathname === "/" ? "" : parsed.pathname;
    return `/${host}${rest}${parsed.search}`;
  }

  return null;
}
