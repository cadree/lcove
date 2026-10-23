// Proves host reply-to checks on ether-staging only.
// A non-host confirm is 403. The fourth verification request in an hour is 429.
// Recipients are @staging.ether.test. Does not print keys.

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const PROD_REF = "aykopqinnnssxdhxqruo";
const STAGING_REF = "vjdrihmriufkameqngfg";
const ref = process.env.STAGING_PROJECT_REF || "";
const baseUrl = (process.env.STAGING_URL || `https://${ref}.supabase.co`).replace(/\/$/, "");

if (ref !== STAGING_REF || baseUrl.includes(PROD_REF) || !baseUrl.endsWith(`${STAGING_REF}.supabase.co`)) {
  console.error("prove-host-reply: refusing to run outside ether-staging");
  process.exit(1);
}

const runId = randomBytes(4).toString("hex");
const hostEmail = `host-reply-${runId}@staging.ether.test`;
const otherEmail = `other-reply-${runId}@staging.ether.test`;
const targetEmail = `reply-to-${runId}@staging.ether.test`;
const otherTarget = `reply-other-${runId}@staging.ether.test`;
const password = randomBytes(24).toString("base64url");

function redact(value) {
  return String(value)
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "sb_[redacted]")
    .replace(/eyJ[A-Za-z0-9_-]{10,}/g, "eyJ[redacted]")
    .replace(/sbp_[A-Za-z0-9]+/g, "sbp_[redacted]");
}

function collectKeys(node, found = []) {
  if (Array.isArray(node)) {
    for (const item of node) collectKeys(item, found);
    return found;
  }
  if (!node || typeof node !== "object") return found;
  const value = ["api_key", "apiKey", "key", "value"]
    .map((field) => node[field])
    .find((item) => typeof item === "string");
  if (typeof value === "string" && value.length > 20 && (value.startsWith("sb_") || value.startsWith("eyJ"))) {
    found.push({
      name: String(node.name || node.id || ""),
      type: String(node.type || node.key_type || ""),
      value,
    });
  }
  for (const child of Object.values(node)) {
    if (child && typeof child === "object") collectKeys(child, found);
  }
  return found;
}

function classify(keys) {
  const publishable = [];
  const secrets = [];
  for (const key of keys) {
    const label = `${key.type} ${key.name}`.toLowerCase();
    if (key.value.startsWith("sb_publishable_") || label.includes("publishable") || /(^|\s)anon($|\s)/.test(label)) {
      publishable.push(key.value);
    } else if (key.value.startsWith("sb_secret_") || label.includes("secret") || label.includes("service_role") || label.includes("service role")) {
      secrets.push(key.value);
    }
  }
  return { publishable: [...new Set(publishable)], secrets: [...new Set(secrets)] };
}

function prefix(value) {
  if (value.startsWith("sb_publishable_")) return "sb_publishable";
  if (value.startsWith("sb_secret_")) return "sb_secret";
  if (value.startsWith("eyJ")) return "eyJ";
  return "other";
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: options.headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, text: redact(text).slice(0, 400) };
}

function authHeaders(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function firstWorking(keys, attempt) {
  const errors = [];
  for (const key of keys) {
    const result = await attempt(key);
    if (result.ok) return result;
    errors.push(`${prefix(key)} ${result.status} ${result.text}`);
  }
  throw new Error(errors.join(" | ") || "no key worked");
}

const summary = { ref, runId, checks: [] };
const failures = [];
function check(name, ok, detail) {
  summary.checks.push({ name, ok, detail });
  if (!ok) failures.push(`${name}: ${detail}`);
}

let secretKey = "";
let publishableKey = "";
let hostId = "";
let otherId = "";
let eventId = "";

try {
  const raw = JSON.parse(readFileSync(process.env.PROOF_API_KEYS_FILE, "utf8"));
  const keys = classify(collectKeys(raw));
  if (keys.publishable.length === 0 || keys.secrets.length === 0) {
    throw new Error(`missing project keys publishable=${keys.publishable.length} secrets=${keys.secrets.length}`);
  }
  publishableKey = keys.publishable.find((key) => key.startsWith("sb_publishable_")) || keys.publishable[0];

  async function createUser(email) {
    return firstWorking(keys.secrets, async (key) => {
      const result = await request(`${baseUrl}/auth/v1/admin/users`, {
        method: "POST",
        headers: authHeaders(key),
        body: { email, password, email_confirm: true },
      });
      const id = result.json?.id || result.json?.user?.id || "";
      return { ok: result.status < 300 && id, status: result.status, text: result.text, id, key };
    });
  }

  const host = await createUser(hostEmail);
  secretKey = host.key;
  hostId = host.id;
  const other = await createUser(otherEmail);
  otherId = other.id;

  async function signIn(email) {
    return firstWorking(keys.publishable, async (key) => {
      const result = await request(`${baseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: authHeaders(key),
        body: { email, password },
      });
      const token = result.json?.access_token || "";
      return { ok: result.status < 300 && token, status: result.status, text: result.text, token };
    });
  }

  const hostSession = await signIn(hostEmail);
  const otherSession = await signIn(otherEmail);

  const event = await request(`${baseUrl}/rest/v1/events`, {
    method: "POST",
    headers: authHeaders(secretKey, { Prefer: "return=representation" }),
    body: {
      creator_id: hostId,
      title: "Staging reply-to proof",
      city: "Staging",
      start_date: "2026-12-01T18:00:00Z",
      event_type: "free_rsvp",
      is_public: false,
    },
  });
  eventId = event.json?.[0]?.id || event.json?.id || "";
  if (!eventId) throw new Error(`event insert ${event.status} ${event.text}`);

  function userHeaders(token) {
    return {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  async function callVerify(token, body) {
    return request(`${baseUrl}/functions/v1/verify-host-email`, {
      method: "POST",
      headers: userHeaders(token),
      body,
    });
  }

  const nonHost = await callVerify(otherSession.token, {
    action: "confirm",
    eventId,
    email: targetEmail,
    code: "000000",
  });
  check("non-host confirm", nonHost.status === 403, `status=${nonHost.status} body=${nonHost.text}`);

  const hostCode = await callVerify(hostSession.token, {
    action: "confirm",
    eventId,
    email: targetEmail,
    code: "000000",
  });
  check("host confirm with a bad code is not forbidden", hostCode.status === 400, `status=${hostCode.status} body=${hostCode.text}`);

  const branding = await request(
    `${baseUrl}/rest/v1/event_email_branding?event_id=eq.${eventId}&select=reply_to_email,reply_to_verified_at`,
    { headers: authHeaders(secretKey) },
  );
  const rows = Array.isArray(branding.json) ? branding.json : [];
  check("non-host did not set reply-to", rows.length === 0, `status=${branding.status} rows=${rows.length}`);

  const requestStatuses = [];
  for (let i = 0; i < 4; i += 1) {
    const sent = await callVerify(hostSession.token, { action: "request", email: targetEmail });
    requestStatuses.push(sent.status);
  }
  summary.hostRequestStatuses = requestStatuses;
  check(
    "first three verification requests are not refused",
    requestStatuses.slice(0, 3).every((status) => status !== 429),
    requestStatuses.join(","),
  );
  check("fourth verification request is refused", requestStatuses[3] === 429, requestStatuses.join(","));

  const sameAddress = await callVerify(otherSession.token, { action: "request", email: targetEmail });
  check(
    "another user is refused for the same address",
    sameAddress.status === 429,
    `status=${sameAddress.status} body=${sameAddress.text}`,
  );
  const freshAddress = await callVerify(otherSession.token, { action: "request", email: otherTarget });
  check(
    "another user can request a different address",
    freshAddress.status !== 429,
    `status=${freshAddress.status} body=${freshAddress.text}`,
  );
} catch (error) {
  failures.push(redact(error instanceof Error ? error.stack || error.message : error));
} finally {
  if (eventId && secretKey) {
    const removed = await request(`${baseUrl}/rest/v1/events?id=eq.${eventId}`, {
      method: "DELETE",
      headers: authHeaders(secretKey),
    });
    summary.eventDeleted = removed.status;
  }
  for (const email of [targetEmail, otherTarget]) {
    if (!secretKey) break;
    const removed = await request(
      `${baseUrl}/rest/v1/host_email_verifications?email=eq.${encodeURIComponent(email)}`,
      { method: "DELETE", headers: authHeaders(secretKey) },
    );
    summary[`verificationsDeleted:${email}`] = removed.status;
  }
  for (const id of [hostId, otherId]) {
    if (!id || !secretKey) continue;
    const removed = await request(`${baseUrl}/auth/v1/admin/users/${id}`, {
      method: "DELETE",
      headers: authHeaders(secretKey),
    });
    summary[`userDeleted:${id.slice(0, 8)}`] = removed.status;
  }
  console.log(`PROOF_RESULT ${JSON.stringify(summary)}`);
  if (failures.length) {
    console.error(failures.map((failure) => redact(failure)).join("\n"));
    process.exitCode = 1;
  }
}
