/**
 * React Router writes the in-app stack index on history.state.idx.
 * A deep link or a fresh tab has no earlier entry (missing or 0).
 */
export function historyIndex(state: unknown): number | null {
  if (!state || typeof state !== "object") return null;
  const idx = (state as { idx?: unknown }).idx;
  return typeof idx === "number" && Number.isFinite(idx) ? idx : null;
}

/** -1 pops the previous in-app screen. Otherwise the given parent. */
export function backTarget(state: unknown, fallback = "/feed"): -1 | string {
  const idx = historyIndex(state);
  if (idx !== null && idx > 0) return -1;
  return fallback;
}

/** Home, Explore, Messages, and your own profile. Other people's profiles are not tabs. */
const MAIN_TABS = new Set(["/feed", "/explore", "/messages", "/profile"]);

export function isMainTabPath(pathname: string): boolean {
  return MAIN_TABS.has(pathname);
}

/**
 * Where a deep link should land when this screen has no in-app history.
 * Main tabs are not given a parent; callers still receive /feed if they ask.
 */
export function parentFallback(pathname: string): string {
  if (/^\/profile\/[^/]+/.test(pathname)) return "/directory";
  if (pathname.startsWith("/settings/")) return "/settings";
  if (pathname === "/settings") return "/profile";
  if (/^\/blog\/[^/]+/.test(pathname)) return "/blog";
  if (/^\/boards\/[^/]+/.test(pathname)) return "/boards";
  const managed = pathname.match(/^\/cinema\/manage\/([^/]+)/);
  if (managed) return `/cinema/network/${managed[1]}`;
  if (pathname.startsWith("/cinema/")) return "/cinema";
  if (/^\/dashboard\/events\/[^/]+/.test(pathname)) return "/dashboard/events";
  if (pathname === "/dashboard/events") return "/dashboard";
  if (/^\/admin\/onboarding\/[^/]+/.test(pathname)) return "/admin/onboarding";
  if (pathname === "/admin/onboarding") return "/admin";
  const confirmation = pathname.match(/^\/event\/([^/]+)\/confirmation\/?$/);
  if (confirmation) return `/event/${confirmation[1]}`;
  if (pathname.startsWith("/event/")) return "/calendar";
  if (pathname.startsWith("/project/")) return "/projects";
  if (pathname === "/book") return "/feed";
  if (pathname.startsWith("/book/")) return "/";
  if (pathname.startsWith("/client/")) return "/";
  if (pathname.startsWith("/sign-contract")) return "/projects";
  if (pathname === "/portfolios") return "/profile";
  if (pathname === "/tickets") return "/profile";
  if (pathname === "/partner-portal") return "/partners";
  if (
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/guidelines" ||
    pathname === "/nuance" ||
    pathname === "/unsubscribe" ||
    pathname === "/waitlist"
  ) {
    return "/";
  }
  return "/feed";
}
