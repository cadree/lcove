/**
 * Caller checks for edge functions.
 * Supabase verify_jwt only proves the bearer token was signed by this project.
 * The public anon key is such a token, so functions that must not be world-callable
 * also reject role "anon" here. Server-to-server calls use the service_role JWT
 * or the x-internal-secret header (cron).
 */

function decodeJwtPayload(authorization: string | null): Record<string, unknown> | null {
  if (!authorization) return null;
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded);
    const payload = JSON.parse(json);
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

export function jwtRole(authorization: string | null): string | null {
  const payload = decodeJwtPayload(authorization);
  const role = payload?.role;
  return typeof role === "string" ? role : null;
}

export function jwtSubject(authorization: string | null): string | null {
  const payload = decodeJwtPayload(authorization);
  const sub = payload?.sub;
  return typeof sub === "string" ? sub : null;
}

function unauthorized(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Logged-in user or another edge function using the service role key. */
export function requireUserOrService(
  req: Request,
  corsHeaders: Record<string, string>,
): Response | null {
  const role = jwtRole(req.headers.get("Authorization"));
  if (role === "authenticated" || role === "service_role") return null;
  return unauthorized(corsHeaders);
}

function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  const length = Math.max(left.length, right.length);
  let diff = left.length === right.length ? 0 : 1;
  for (let i = 0; i < length; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Cron and other server jobs. Fail closed when INTERNAL_FUNCTION_SECRET is unset.
 * The secret is never logged.
 */
export function requireInternalSecret(
  req: Request,
  corsHeaders: Record<string, string>,
): Response | null {
  const expected = Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "";
  const provided = req.headers.get("x-internal-secret") ?? "";
  if (!expected || !timingSafeEqual(provided, expected)) {
    return unauthorized(corsHeaders);
  }
  return null;
}
