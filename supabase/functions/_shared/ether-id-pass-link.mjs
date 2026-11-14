// Short-lived Apple Wallet links. The signature is an HMAC of the user id
// and the expiry. The key is an existing function secret supplied by the caller.

export const PASS_LINK_TTL_SECONDS = 5 * 60;

const text = new TextEncoder();

function timingSafeEqual(a, b) {
  const left = text.encode(String(a));
  const right = text.encode(String(b));
  const length = Math.max(left.length, right.length);
  let diff = left.length === right.length ? 0 : 1;
  for (let i = 0; i < length; i += 1) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function hmacSha256(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    text.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, text.encode(message));
  return new Uint8Array(signature);
}

function canonical(userId, exp) {
  return `${userId}.${exp}`;
}

export async function signPassLink({ userId, exp, secret }) {
  const mac = await hmacSha256(secret, canonical(String(userId), String(exp)));
  return base64Url(mac);
}

/**
 * True only when the signature matches this user and expiry and the link
 * has not passed its expiry second. Missing, expired, tampered, and
 * other-user inputs are all false.
 */
export async function verifyPassLink({ userId, exp, sig, secret, nowSeconds }) {
  if (typeof userId !== "string" || userId.length === 0 || userId.includes(".")) return false;
  if (typeof secret !== "string" || secret.length === 0) return false;
  if (typeof sig !== "string" || sig.length === 0) return false;
  if (typeof exp !== "string" && typeof exp !== "number") return false;
  const expText = String(exp);
  if (!/^\d+$/.test(expText)) return false;
  const expiry = Number(expText);
  if (!Number.isSafeInteger(expiry)) return false;
  const expected = await signPassLink({ userId, exp: expiry, secret });
  if (!timingSafeEqual(expected, sig)) return false;
  if (typeof nowSeconds !== "number" || !Number.isFinite(nowSeconds)) return false;
  return expiry >= nowSeconds;
}

export function buildPassLink(baseUrl, { userId, exp, sig }) {
  const url = new URL(baseUrl);
  url.searchParams.set("uid", userId);
  url.searchParams.set("exp", String(exp));
  url.searchParams.set("sig", sig);
  return url.toString();
}

export function passLinkParts(link) {
  const url = new URL(link);
  return {
    userId: url.searchParams.get("uid") ?? "",
    exp: url.searchParams.get("exp") ?? "",
    sig: url.searchParams.get("sig") ?? "",
  };
}

export async function issuePassLink({
  userId,
  secret,
  nowSeconds,
  baseUrl,
  ttlSeconds = PASS_LINK_TTL_SECONDS,
}) {
  const exp = nowSeconds + ttlSeconds;
  const sig = await signPassLink({ userId, exp, secret });
  return { url: buildPassLink(baseUrl, { userId, exp, sig }), exp };
}
