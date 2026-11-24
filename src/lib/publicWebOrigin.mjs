// Picks the public website origin for links the app shares off-device.
// Production stays the default. A build that talks to any other Supabase
// project must name its own site in VITE_PUBLIC_WEB_ORIGIN, so a staging
// token is never put in a production link.
import { PRODUCTION_SUPABASE_REF, supabaseProjectRef } from "./supabaseTarget.mjs";

export const PRODUCTION_WEB_ORIGIN = "https://etherbylcove.com";

function parseOrigin(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * @param {{configured?: string, supabaseUrl?: string, projectId?: string, native?: boolean, currentOrigin?: string}} input
 * @returns {string | null} null when no safe origin exists; callers must not share a link then.
 */
export function resolvePublicWebOrigin(input) {
  const { ref } = supabaseProjectRef(input.supabaseUrl, input.projectId);
  const production = !ref || ref === PRODUCTION_SUPABASE_REF;
  const configured = parseOrigin(input.configured);
  if (String(input.configured ?? "").trim() && !configured) return null;
  if (configured) {
    // A staging build may never hand out production links, and the reverse.
    if (!production && configured === PRODUCTION_WEB_ORIGIN) return null;
    if (production && configured !== PRODUCTION_WEB_ORIGIN) return null;
    return configured;
  }
  if (!input.native) return parseOrigin(input.currentOrigin);
  return production ? PRODUCTION_WEB_ORIGIN : null;
}
