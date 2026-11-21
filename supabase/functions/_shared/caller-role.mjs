/**
 * Role of an edge-function caller.
 *
 * Legacy anon and service_role keys are JWTs. The new publishable and secret
 * keys (sb_publishable_... and sb_secret_...) are not, so reading `role` from
 * a JWT payload misses them. Both forms are accepted here.
 *
 * A secret or publishable key counts only when it exactly matches a key this
 * project was given. A prefix is not enough: a guessed sb_secret_ string must
 * not become service_role. User session JWTs are recognized by their
 * authenticated role claim. verify_jwt still checks that signature before the
 * handler runs. A service_role or anon claim on a token that is not one of
 * the project keys is ignored.
 */

export function stripBearer(value) {
  if (typeof value !== "string") return "";
  return value.replace(/^Bearer\s+/i, "").trim();
}

export function namedKeyValues(raw) {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    return Object.values(parsed).filter((value) => typeof value === "string" && value.length > 0);
  } catch {
    return [];
  }
}

export function decodeJwtPayload(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const json = atob(padded + pad);
    const payload = JSON.parse(json);
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

function timingSafeEqual(a, b) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  const length = Math.max(left.length, right.length);
  let diff = left.length === right.length ? 0 : 1;
  for (let i = 0; i < length; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

function matchesAny(token, keys) {
  let matched = 0;
  const list = Array.isArray(keys) ? keys : [];
  for (const key of list) {
    if (typeof key !== "string" || key.length === 0) continue;
    matched |= timingSafeEqual(token, key) ? 1 : 0;
  }
  return matched === 1;
}

export function credentialRole(credential, keys) {
  const token = stripBearer(credential);
  if (!token) return null;
  if (matchesAny(token, keys?.secrets)) return "service_role";
  if (matchesAny(token, keys?.publishable)) return "anon";
  // A real JWT reached this process only after verify_jwt checked its signature.
  // Legacy anon and service_role keys are such JWTs, including when the function
  // env now holds the new sb_ key and the legacy JWT is a different string.
  // New keys are not JWTs, so a guessed sb_secret_ string cannot take this path.
  const role = decodeJwtPayload(token)?.role;
  if (role === "authenticated" || role === "anon" || role === "service_role") return role;
  return null;
}

/**
 * Authorization wins when it identifies a caller, so a signed-in user's JWT
 * stays "authenticated" even though apikey carries the publishable key.
 * When Authorization is empty, the apikey header is the caller. That is how
 * current clients send sb_publishable_ and sb_secret_ keys.
 */
export function resolveCallerRole(authorization, apiKey, keys) {
  const fromAuthorization = credentialRole(authorization, keys);
  if (fromAuthorization) return fromAuthorization;
  const authToken = stripBearer(authorization);
  const apiToken = stripBearer(apiKey);
  if (!apiToken || apiToken === authToken) return null;
  return credentialRole(apiToken, keys);
}
