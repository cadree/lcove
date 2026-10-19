export type ScreenTone = "blood" | "crimson" | "cyan" | "pink" | "denim" | "gold" | "flare";

/** Per-screen gradient tone. Quest gold is reserved for a later phase. */
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

  if (path === "/home" || path.startsWith("/feed")) return "crimson";

  if (
    path.startsWith("/explore") ||
    path.startsWith("/directory") ||
    path.startsWith("/portfolios") ||
    path.startsWith("/community") ||
    path.startsWith("/collectives") ||
    path.startsWith("/mall") ||
    path.startsWith("/nuance") ||
    path.startsWith("/brand-partners") ||
    path.startsWith("/live") ||
    path.startsWith("/cinema") ||
    path.startsWith("/event")
  ) {
    return "cyan";
  }

  if (path.startsWith("/profile") || path.startsWith("/settings") || path.startsWith("/book")) {
    return "pink";
  }

  if (path.startsWith("/messages")) return "denim";

  return "crimson";
}
