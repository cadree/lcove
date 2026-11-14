function pemToDer(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** ES256 JWT for APNs token auth. The key is the .p8 from the Apple account. */
export async function signApnsJwt({ p8, keyId, teamId, nowSeconds }) {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(p8),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ alg: "ES256", kid: keyId })));
  const payload = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify({ iss: teamId, iat: nowSeconds })),
  );
  const signingInput = new TextEncoder().encode(`${header}.${payload}`);
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, signingInput),
  );
  return `${header}.${payload}.${bytesToBase64Url(signature)}`;
}

/**
 * Empty push. Wallet treats it as "this pass changed" and calls the web service.
 * Topic is the Pass Type ID.
 */
export async function pushPassUpdate({ jwt, pushToken, topic, fetchImpl = fetch }) {
  const response = await fetchImpl(`https://api.push.apple.com/3/device/${pushToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": topic,
      "apns-push-type": "background",
      "apns-priority": "5",
    },
    body: "{}",
  });
  return { ok: response.ok, status: response.status };
}

/** Production APNs for the Ether iOS app. Topic is the App Store bundle id. */
export const APNS_PRODUCTION_HOST = "https://api.push.apple.com";
export const IOS_APP_TOPIC = "app.lovable.e07d9c457fd949f78f3cc7d5998be668";

const APNS_DROP_REASONS = new Set(["BadDeviceToken", "Unregistered"]);

/** Hex device token from a push_subscriptions endpoint of `apns:<token>`. */
export function apnsDeviceToken(endpoint) {
  const value = String(endpoint ?? "");
  if (!value.startsWith("apns:")) return null;
  const token = value.slice(5).replace(/[<>\s]/g, "");
  if (!/^[0-9a-fA-F]+$/.test(token)) return null;
  return token;
}

/**
 * Same path the service worker opens when a web notification is tapped.
 * `data` is the object stored on the web push payload.
 */
export function pushOpenPath(data) {
  const notificationData = data && typeof data === "object" ? data : {};
  const notificationType = notificationData.type || "general";
  let targetPath = notificationData.url || "/notifications";
  if (notificationType === "message" && notificationData.conversation_id) {
    targetPath = `/messages?chat=${notificationData.conversation_id}`;
  } else if (notificationType === "project_invite" && notificationData.project_id) {
    targetPath = `/projects?id=${notificationData.project_id}`;
  } else if (notificationType === "live_stream" && notificationData.stream_id) {
    targetPath = `/live?stream=${notificationData.stream_id}`;
  } else if (notificationType === "event_reminder" && notificationData.event_id) {
    targetPath = `/calendar?event=${notificationData.event_id}`;
  } else if ((notificationType === "like" || notificationType === "comment") && notificationData.post_id) {
    targetPath = `/feed?post=${notificationData.post_id}`;
  }
  return String(targetPath);
}

export function buildApnsAlertPayload({ title, body, url, data, notificationType }) {
  const extra = data && typeof data === "object" && !Array.isArray(data) ? { ...data } : {};
  delete extra.aps;
  const merged = {
    url: url || "/notifications",
    type: notificationType || "general",
    ...extra,
  };
  return {
    aps: {
      alert: {
        title: String(title ?? ""),
        body: String(body ?? ""),
      },
      sound: "default",
    },
    ...merged,
    url: pushOpenPath(merged),
  };
}

/** Apple's reason string, or empty when the body is not a short reason code. */
export function apnsReason(bodyText) {
  if (!bodyText) return "";
  try {
    const parsed = JSON.parse(bodyText);
    const reason = parsed && typeof parsed.reason === "string" ? parsed.reason : "";
    return /^[A-Za-z0-9]+$/.test(reason) ? reason : "";
  } catch {
    return "";
  }
}

/** Drop the stored token when Apple says it is gone or not a real device token. */
export function apnsTokenShouldDrop(status, bodyText) {
  if (status === 410) return true;
  return APNS_DROP_REASONS.has(apnsReason(bodyText));
}

/**
 * Web rows stay on HTTPS. APNs rows are `platform = apns` or `apns:<token>`.
 * An APNs row that is not a hex token is invalid and should be deleted.
 */
export function classifyPushSubscription(platform, endpoint) {
  const value = String(endpoint ?? "");
  const kind = String(platform ?? "web");
  if (kind === "apns" || value.startsWith("apns:")) {
    const token = apnsDeviceToken(value);
    if (!token) return { channel: "apns", action: "drop" };
    return { channel: "apns", action: "send", token };
  }
  if (!value.startsWith("https://")) return { channel: "web", action: "skip" };
  return { channel: "web", action: "send" };
}

/**
 * Alert push to production APNs. `fetchImpl` is injectable so tests never call Apple.
 * Returns whether the push_subscriptions row should be deleted.
 */
export async function sendApnsAlert({
  jwt,
  deviceToken,
  topic = IOS_APP_TOPIC,
  title,
  body,
  url,
  data,
  notificationType,
  fetchImpl = fetch,
  host = APNS_PRODUCTION_HOST,
}) {
  const payload = buildApnsAlertPayload({ title, body, url, data, notificationType });
  const response = await fetchImpl(`${host}/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
    },
    body: JSON.stringify(payload),
  });
  const responseText = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    reason: apnsReason(responseText),
    drop: apnsTokenShouldDrop(response.status, responseText),
  };
}
