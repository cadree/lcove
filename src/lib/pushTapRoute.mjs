// Turns a tapped push notification into an in-app route, and holds that
// route until the router can use it (a cold start delivers the tap before
// React mounts). The APNs sender puts the route at the top level as `url`
// (see buildApnsAlertPayload in supabase/functions/_shared/apns.mjs);
// Capacitor passes the whole APNs userInfo as `notification.data`.

const SAFE_HOSTS = new Set(["etherbylcove.com", "www.etherbylcove.com"]);

function inAppPath(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  if (text.startsWith("/") && !text.startsWith("//") && !text.includes("\\")) return text;
  try {
    const url = new URL(text);
    if (url.protocol === "https:" && (SAFE_HOSTS.has(url.hostname) || url.hostname.endsWith(".ether-staging.pages.dev"))) {
      return `${url.pathname}${url.search}${url.hash}` || "/";
    }
  } catch {
    // not a URL
  }
  return null;
}

/** Route for a notification's `data` (APNs userInfo or web push data), or null. */
export function pushTapPath(data) {
  if (!data || typeof data !== "object") return null;
  const nested = data.data && typeof data.data === "object" ? data.data : {};
  for (const candidate of [data.url, data.link, nested.url, nested.link]) {
    const path = inAppPath(candidate);
    if (path) return path;
  }
  return "/notifications";
}

/** Holds at most one route until a navigator attaches; later taps win. */
export function createPushTapQueue() {
  let pending = null;
  let navigate = null;
  return {
    deliver(path) {
      if (!path) return;
      if (navigate) navigate(path);
      else pending = path;
    },
    attach(fn) {
      navigate = fn;
      if (pending) {
        const path = pending;
        pending = null;
        fn(path);
      }
      return () => {
        if (navigate === fn) navigate = null;
      };
    },
  };
}
