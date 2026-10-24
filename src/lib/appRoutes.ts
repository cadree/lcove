const PUBLIC_EXACT = new Set([
  "/",
  "/landing",
  "/auth",
  "/onboarding",
  "/locked",
  "/admin/onboarding",
  "/denied",
  "/admin",
  "/fund",
  "/unsubscribe",
  "/privacy",
  "/terms",
  "/guidelines",
  "/community",
  "/nuance",
  "/waitlist",
]);

const APP_EXACT = new Set([
  "/feed",
  "/explore",
  "/directory",
  "/projects",
  "/calendar",
  "/events",
  "/profile",
  "/blog",
  "/settings",
  "/tickets",
  "/messages",
  "/notifications",
  "/wallet",
  "/store",
  "/mall",
  "/membership",
  "/live",
  "/book",
  "/quests",
  "/cinema",
  "/partners",
  "/pipeline",
  "/today",
  "/boards",
  "/portfolios",
  "/brand-partners",
  "/partner-portal",
  "/collectives",
  "/dashboard",
  "/home",
]);

const PREFIXES = [
  "/admin/",
  "/event/",
  "/project/",
  "/book/",
  "/client/",
  "/sign-contract",
  "/profile/",
  "/blog/",
  "/cinema/",
  "/boards/",
  "/dashboard/",
  "/settings/",
];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return (
    pathname.startsWith("/admin/onboarding") ||
    pathname.startsWith("/event/") ||
    pathname.startsWith("/project/") ||
    pathname.startsWith("/book/") ||
    pathname.startsWith("/sign-contract") ||
    pathname.startsWith("/client/")
  );
}

export function isKnownPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname) || APP_EXACT.has(pathname)) return true;
  return PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export const SITEMAP_PATHS = [
  "/",
  "/waitlist",
  "/auth",
  "/fund",
  "/nuance",
  "/community",
  "/guidelines",
  "/privacy",
  "/terms",
] as const;
