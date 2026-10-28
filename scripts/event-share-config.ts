/** Public Supabase values written into dist/event-share-config.json at build time. */

export function eventShareConfig(env: Record<string, string | undefined> = {}) {
  return {
    url: String(env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, ""),
    key: String(env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim(),
  };
}

export function eventShareConfigJson(env: Record<string, string | undefined> = {}) {
  return `${JSON.stringify(eventShareConfig(env))}\n`;
}
