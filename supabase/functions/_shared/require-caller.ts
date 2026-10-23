/**
 * Caller checks for edge functions.
 * Supabase verify_jwt proves a legacy JWT or a user session was signed by this
 * project, and it also lets this project's sb_publishable_ and sb_secret_ keys
 * through. Those new keys are not JWTs, so the role is decided here by an
 * exact match against the keys the platform injects. Server-to-server calls
 * use a secret key. Cron uses the x-internal-secret header.
 */

import { decodeJwtPayload, namedKeyValues, resolveCallerRole } from "./caller-role.mjs";

function projectKeys() {
  return {
    secrets: [
      ...namedKeyValues(Deno.env.get("SUPABASE_SECRET_KEYS")),
      Deno.env.get("SUPABASE_SECRET_KEY") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    ],
    publishable: [
      ...namedKeyValues(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")),
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    ],
  };
}

/** Role of the bearer token, or of the apikey header when the bearer is empty. */
export function jwtRole(authorization: string | null, apiKey?: string | null): string | null {
  return resolveCallerRole(authorization, apiKey ?? null, projectKeys());
}

export function requestRole(req: Request): string | null {
  return jwtRole(req.headers.get("Authorization"), req.headers.get("apikey"));
}

export function jwtSubject(authorization: string | null): string | null {
  const token = authorization?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const sub = decodeJwtPayload(token)?.sub;
  return typeof sub === "string" ? sub : null;
}

function unauthorized(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Confirms the bearer token is a real user. The anon key and service role fail here. */
export async function getBearerUser(
  authorization: string | null,
  supabase: {
    auth: {
      getUser: (jwt: string) => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
    };
  },
): Promise<string | null> {
  if (!authorization) return null;
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) return null;
  return data.user.id;
}

/** Logged-in user or another edge function using a secret key. */
export function requireUserOrService(
  req: Request,
  corsHeaders: Record<string, string>,
): Response | null {
  const role = requestRole(req);
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
