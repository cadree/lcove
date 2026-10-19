export type ScreenTone = "blood" | "crimson" | "cyan" | "pink" | "denim" | "gold" | "flare";

/** Per-screen gradient tone. Quest log shares the neo-gold wash with credits. */
export function toneForPath(pathname: string): ScreenTone {
  const path = pathname.split("?")[0] || "/";

  if (
    path === "/" ||
    path === "/landing" ||
    path.startsWith("/auth") ||
    path.startsWith("/onboarding") ||
    path.startsWith("/locked")
  ) {
    return "blood";
  }

  if (path === "/home" || path.startsWith("/feed") || path.startsWith("/notifications")) return "crimson";

  if (
    path.startsWith("/explore") ||
    path.startsWith("/directory") ||
    path.startsWith("/portfolios") ||
    path.startsWith("/community") ||
    path.startsWith("/collectives") ||
    path.startsWith("/mall") ||
    path.startsWith("/store") ||
    path.startsWith("/nuance") ||
    path.startsWith("/brand-partners") ||
    path.startsWith("/live") ||
    path.startsWith("/cinema") ||
    path.startsWith("/event") ||
    path.startsWith("/calendar") ||
    path.startsWith("/projects") ||
    path.startsWith("/boards") ||
    path.startsWith("/booking")
  ) {
    return "cyan";
  }

  if (
    path.startsWith("/profile") ||
    path.startsWith("/settings") ||
    path.startsWith("/book") ||
    path.startsWith("/blog")
  ) {
    return "pink";
  }

  if (path.startsWith("/messages")) return "denim";

  if (path.startsWith("/wallet") || path.startsWith("/fund") || path.startsWith("/membership") || path.startsWith("/quests")) {
    return "gold";
  }

  return "crimson";
}
