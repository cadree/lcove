export const LIVE_VIDEO_NOT_CONFIGURED = "Live video not configured";

const STREAM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readLiveKitConfig(env) {
  const url = String(env?.LIVEKIT_URL ?? "").trim();
  const apiKey = String(env?.LIVEKIT_API_KEY ?? "").trim();
  const apiSecret = String(env?.LIVEKIT_API_SECRET ?? "").trim();
  if (!url || !apiKey || !apiSecret) return null;
  return { url, apiKey, apiSecret };
}

export function isStreamRoomName(value) {
  return typeof value === "string" && STREAM_ID.test(value);
}

/** Publish only for the stream host. Everyone else can subscribe. Room name is the stream id. */
export function liveKitVideoGrant(userId, hostId, roomName) {
  const canPublish = typeof userId === "string" && userId.length > 0 && userId === hostId;
  return {
    room: roomName,
    roomJoin: true,
    canPublish,
    canSubscribe: true,
    canPublishData: false,
  };
}

/** Viewers are everyone in the room except the host. */
export function viewerCount(numParticipants) {
  const count = Number(numParticipants);
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.floor(count) - 1);
}

/** LiveKit createdAt is unix seconds and may arrive as a string. timestamptz needs ISO. */
export function liveKitEventTime(value, now = Date.now()) {
  if (value !== null && value !== undefined && String(value).trim() !== "") {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) {
      const date = new Date(seconds * 1000);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }
  return new Date(now).toISOString();
}

/**
 * Room lifecycle for live_streams. Participant events only change the viewer count.
 * Returns null when the event should not write.
 */
export function liveKitRoomUpdate(event) {
  const roomName = event?.room?.name;
  if (!isStreamRoomName(roomName)) return null;
  const kind = event?.event;
  const now = liveKitEventTime(event?.createdAt);
  const count = viewerCount(event?.room?.numParticipants);

  if (kind === "room_started") {
    return {
      streamId: roomName,
      patch: { is_live: true, started_at: now, viewer_count: count },
    };
  }
  if (kind === "room_finished") {
    return {
      streamId: roomName,
      patch: { is_live: false, ended_at: now, viewer_count: 0 },
    };
  }
  if (kind === "participant_joined" || kind === "participant_left") {
    return { streamId: roomName, patch: { viewer_count: count } };
  }
  return null;
}

function encodeJson(value) {
  return new TextEncoder().encode(JSON.stringify(value));
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacSign(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(signature);
}

function signaturesMatch(left, right) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  const length = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

async function signClaims(claims, secret) {
  const header = bytesToBase64Url(encodeJson({ alg: "HS256", typ: "JWT" }));
  const payload = bytesToBase64Url(encodeJson(claims));
  const signature = bytesToBase64Url(await hmacSign(secret, `${header}.${payload}`));
  return `${header}.${payload}.${signature}`;
}

export async function signLiveKitToken({
  apiKey,
  apiSecret,
  identity,
  video,
  ttlSeconds = 6 * 60 * 60,
  now = Date.now(),
}) {
  const claims = {
    iss: apiKey,
    sub: identity,
    nbf: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + ttlSeconds,
    video: {
      room: video.room,
      roomJoin: true,
      canPublish: video.canPublish === true,
      canSubscribe: true,
      canPublishData: false,
    },
  };
  const token = await signClaims(claims, apiSecret);
  return { token, claims };
}

export async function sha256Base64(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function verifyHs256(token, secret, now = Date.now()) {
  const parts = String(token ?? "").replace(/^Bearer\s+/i, "").trim().split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const [header, payload, signature] = parts;
  const expected = bytesToBase64Url(await hmacSign(secret, `${header}.${payload}`));
  if (!signaturesMatch(expected, signature)) throw new Error("Invalid signature");
  const claims = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
  const seconds = Math.floor(now / 1000);
  const skew = 60;
  if (typeof claims.exp === "number" && claims.exp + skew < seconds) throw new Error("Token expired");
  if (typeof claims.nbf === "number" && claims.nbf - skew > seconds) throw new Error("Token not yet valid");
  return claims;
}

export async function signLiveKitWebhook({ apiKey, apiSecret, body, now = Date.now() }) {
  const claims = {
    iss: apiKey,
    sub: "webhook",
    nbf: Math.floor(now / 1000) - 5,
    exp: Math.floor(now / 1000) + 60,
    sha256: await sha256Base64(body),
  };
  return signClaims(claims, apiSecret);
}

export async function verifyLiveKitWebhook(body, authorization, apiKey, apiSecret, now = Date.now()) {
  const claims = await verifyHs256(authorization, apiSecret, now);
  if (claims.iss !== apiKey) throw new Error("Unexpected webhook issuer");
  const digest = await sha256Base64(body);
  if (claims.sha256 !== digest) throw new Error("Webhook body does not match");
  return JSON.parse(body);
}
