/**
 * Rules for the Capacitor shell. Kept free of plugin imports so tests can
 * run them in Node.
 *
 * The iOS WebView loads `capacitor://localhost` (no `server.url`). The scheme
 * handler serves `dist/index.html` for that URL. Relative bundle URLs need a
 * root `<base href>` so the same build still works when a web visitor refreshes
 * a nested route such as `/dashboard/events/123`.
 */
export const CAPACITOR_LOCAL_ORIGIN = "capacitor://localhost";

/** Document URLs the iOS shell actually uses for the bundled index. */
export const CAPACITOR_DOCUMENT_URLS = [
  "capacitor://localhost",
  "capacitor://localhost/",
  "capacitor://localhost/index.html",
] as const;

/**
 * Native backstop. `SplashScreen.hide()` dismisses the bear earlier, on first
 * paint. This only matters when that call never runs.
 */
export const NATIVE_SPLASH_BACKSTOP_MS = 4000;

/**
 * The iOS plugin ignores hide() until the splash view is marked visible.
 * These retries do not wait on auth or any other request.
 */
export const NATIVE_SPLASH_RETRY_MS = [300, 2500] as const;

export function allowsWebServiceWorker(isNative: boolean): boolean {
  return !isNative;
}

/** Resolve `href` the way a document with `<base href>` would. */
export function resolveBundledUrl(documentUrl: string, href: string, baseHref = "/"): URL {
  const base = new URL(baseHref, documentUrl);
  return new URL(href, base);
}

export function bundledPathname(documentUrl: string, href: string, baseHref = "/"): string {
  const resolved = resolveBundledUrl(documentUrl, href, baseHref);
  if (resolved.protocol !== "capacitor:" || resolved.hostname !== "localhost") {
    throw new Error(`${href} from ${documentUrl} resolved to ${resolved.href}`);
  }
  return resolved.pathname;
}

const TAG = /<(script|link)\b([^>]*)>/gi;
const HREF = /\b(?:src|href)\s*=\s*["']([^"']+)["']/i;
const REL = /\brel\s*=\s*["']([^"']+)["']/i;

export interface HtmlAssetRef {
  tag: "script" | "link";
  href: string;
  rel: string;
}

/** Local script and link URLs from a built index.html. Skips https and data URLs. */
export function localAssetRefs(html: string): HtmlAssetRef[] {
  const refs: HtmlAssetRef[] = [];
  for (const match of html.matchAll(TAG)) {
    const tag = match[1].toLowerCase() as "script" | "link";
    const attrs = match[2] ?? "";
    const hrefMatch = attrs.match(HREF);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    if (/^(https?:|data:|blob:|mailto:)/i.test(href) || href.startsWith("#")) continue;
    const rel = attrs.match(REL)?.[1]?.toLowerCase() ?? "";
    refs.push({ tag, href, rel });
  }
  return refs;
}

export function baseHrefFromHtml(html: string): string | null {
  const match = html.match(/<base\b[^>]*\bhref\s*=\s*["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

/** JS and CSS emitted by Vite. These must be relative, not root-absolute. */
export function isBundledModuleHref(ref: HtmlAssetRef): boolean {
  if (ref.tag === "script") return true;
  return ref.rel.split(/\s+/).includes("stylesheet") || ref.rel.split(/\s+/).includes("modulepreload");
}

export function isRelativeBundleHref(href: string): boolean {
  return href.startsWith("./") || href.startsWith("assets/");
}
