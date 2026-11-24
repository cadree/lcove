// Public half of the ether-prod VAPID key. Safe to ship in the client.
// VITE_VAPID_PUBLIC_KEY still wins when Cloudflare (or local .env) sets it.
export const ETHER_VAPID_PUBLIC_KEY =
  // cspell:disable-next-line
  "BIq-7KXwkyNDVLRG40tkFyxffUSmvQV_YoldekRwNIrqkTsUlpHQFj1aGY60Hv7pvSBYiNhJcK0sGBwSsfAd01U";

export function resolveVapidPublicKey(fromEnv?: string | null): string {
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  return ETHER_VAPID_PUBLIC_KEY;
}
