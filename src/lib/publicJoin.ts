import { WAITLIST_MODE } from "../config/launch.ts";

/** Public Join actions. Sign in is not this path. */
export function publicJoinPath(search = "", waitlistMode = WAITLIST_MODE): string {
  if (!waitlistMode) return "/auth?tab=join";
  const incoming = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const next = new URLSearchParams();
  const src = incoming.get("src")?.trim();
  const ref = incoming.get("ref")?.trim();
  if (src) next.set("src", src);
  if (ref) next.set("ref", ref);
  const query = next.toString();
  return query ? `/waitlist?${query}` : "/waitlist";
}
