// Proves event email auth on ether-staging only.
// Reads project keys from PROOF_API_KEYS_FILE. Does not print those keys.
//
//   STAGING_PROJECT_REF=vjdrihmriufkameqngfg \
//   STAGING_URL=https://vjdrihmriufkameqngfg.supabase.co \
//   SUPABASE_ACCESS_TOKEN=... \
//   PROOF_API_KEYS_FILE=/tmp/keys.json \
//   node scripts/prove-event-email-auth.mjs

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const PROD_REF = "aykopqinnnssxdhxqruo";
const STAGING_REF = "vjdrihmriufkameqngfg";
const ref = process.env.STAGING_PROJECT_REF || "";
const baseUrl = (process.env.STAGING_URL || `https://${ref}.supabase.co`).replace(/\/$/, "");

if (ref !== STAGING_REF || baseUrl.includes(PROD_REF) || !baseUrl.endsWith(`${STAGING_REF}.supabase.co`)) {
  console.error("prove-event-email-auth: refusing to run outside ether-staging");
  process.exit(1);
}

const runId = randomBytes(4).toString("hex");
const hostEmail = `host-proof-${runId}@staging.ether.test`;
const guestEmail = `guest-proof-${runId}@staging.ether.test`;
const guestApikeyEmail = `guest-apikey-proof-${runId}@staging.ether.test`;
const inviteEmail = `invite-proof-${runId}@staging.ether.test`;
const bulkEmail = `bulk-proof-${runId}@staging.ether.test`;
const forgedEmail = `forged-proof-${runId}@staging.ether.test`;
const secretProofEmail = `secret-proof-${runId}@staging.ether.test`;
const legacyProofEmail = `legacy-service-proof-${runId}@staging.ether.test`;
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
  return {
    publishable: [...new Set(publishable)],
    secrets: [...new Set(secrets)],
  };
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
  return { status: response.status, json, text: redact(text).slice(0, 600) };
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

async function sql(query) {
  const token = process.env.SUPABASE_ACCESS_TOKEN || "";
  if (!token) return { status: 0, json: null, text: "no access token" };
  return request(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: { query },
  });
}

const summary = {
  ref,
  runId,
  checks: [],
};
const failures = [];

function check(name, ok, detail) {
  summary.checks.push({ name, ok, detail });
  if (!ok) failures.push(`${name}: ${detail}`);
}

let secretKey = "";
let publishableKey = "";
let userId = "";
let eventId = "";

try {
  const raw = JSON.parse(readFileSync(process.env.PROOF_API_KEYS_FILE, "utf8"));
  const found = collectKeys(raw);
  const keys = classify(found);
  summary.keyClasses = {
    publishable: keys.publishable.map(prefix),
    secrets: keys.secrets.map(prefix),
  };
  summary.keyShapes = found.map((key) => ({
    name: key.name,
    type: key.type,
    prefix: prefix(key.value),
    length: key.value.length,
  }));
  if (keys.publishable.length === 0 || keys.secrets.length === 0) {
    throw new Error(`missing project keys publishable=${keys.publishable.length} secrets=${keys.secrets.length}`);
  }
  publishableKey = keys.publishable.find((key) => key.startsWith("sb_publishable_")) || keys.publishable[0];
  summary.guestKeyClass = prefix(publishableKey);

  const created = await firstWorking(keys.secrets, async (key) => {
    const result = await request(`${baseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: authHeaders(key),
      body: { email: hostEmail, password, email_confirm: true },
    });
    const id = result.json?.id || result.json?.user?.id || "";
    return { ok: result.status < 300 && id, status: result.status, text: result.text, id, key };
  });
  secretKey = created.key;
  userId = created.id;
  summary.adminKeyClass = prefix(secretKey);

  const signedIn = await firstWorking(keys.publishable, async (key) => {
    const result = await request(`${baseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: authHeaders(key),
      body: { email: hostEmail, password },
    });
    const token = result.json?.access_token || "";
    return { ok: result.status < 300 && token, status: result.status, text: result.text, token };
  });

  const event = await request(`${baseUrl}/rest/v1/events`, {
    method: "POST",
    headers: authHeaders(secretKey, { Prefer: "return=representation" }),
    body: {
      creator_id: userId,
      title: "Staging email auth proof",
      city: "Staging",
      start_date: "2026-12-01T18:00:00Z",
      event_type: "free_rsvp",
      is_public: false,
    },
  });
  eventId = event.json?.[0]?.id || event.json?.id || "";
  if (!eventId) throw new Error(`event insert ${event.status} ${event.text}`);

  async function addGuest(email) {
    const row = await request(`${baseUrl}/rest/v1/event_rsvps`, {
      method: "POST",
      headers: authHeaders(secretKey, { Prefer: "return=representation" }),
      body: {
        event_id: eventId,
        guest_email: email,
        guest_name: "Staging Guest",
        status: "going",
      },
    });
    const id = row.json?.[0]?.id || row.json?.id || "";
    if (!id) throw new Error(`rsvp insert ${row.status} ${row.text}`);
    return id;
  }

  const guestId = await addGuest(guestEmail);
  const guestApikeyId = await addGuest(guestApikeyEmail);
  const attendee = await request(`${baseUrl}/rest/v1/event_attendees`, {
    method: "POST",
    headers: authHeaders(secretKey, { Prefer: "return=representation" }),
    body: {
      event_id: eventId,
      attendee_email: bulkEmail,
      attendee_name: "Staging Bulk",
      status: "registered",
    },
  });
  if (!(attendee.json?.[0]?.id || attendee.json?.id)) {
    throw new Error(`attendee insert ${attendee.status} ${attendee.text}`);
  }

  async function callFunction(name, headers, body) {
    return request(`${baseUrl}/functions/v1/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body,
    });
  }

  const guestHeaders = {
    apikey: publishableKey,
    Authorization: `Bearer ${publishableKey}`,
  };
  const guest = await callFunction("send-rsvp-confirmation", guestHeaders, {
    event_id: eventId,
    rsvp_id: guestId,
  });
  check(
    "signed-out guest confirmation",
    guest.status >= 200 && guest.status < 300 && guest.text.includes("Unauthorized") === false,
    `status=${guest.status} body=${guest.text}`,
  );

  const guestApikey = await callFunction("send-rsvp-confirmation", { apikey: publishableKey }, {
    event_id: eventId,
    rsvp_id: guestApikeyId,
  });
  check(
    "signed-out guest confirmation with apikey only",
    guestApikey.status >= 200 && guestApikey.status < 300 && guestApikey.text.includes("Unauthorized") === false,
    `status=${guestApikey.status} body=${guestApikey.text}`,
  );

  const reminder = await callFunction("send-event-reminder", {
    apikey: publishableKey,
    Authorization: `Bearer ${signedIn.token}`,
  }, { eventId, message: "Staging proof reminder" });
  const reminderOk = reminder.status >= 200 && reminder.status < 300
    && reminder.json?.failedCount === 0
    && reminder.json?.sentCount >= 1;
  check("host email guests", reminderOk, `status=${reminder.status} body=${reminder.text}`);

  const invite = await callFunction("send-event-invite", {
    apikey: publishableKey,
    Authorization: `Bearer ${signedIn.token}`,
  }, {
    eventId,
    invitees: [{ email: inviteEmail, name: "Staging Invite" }],
  });
  const inviteFailed = invite.json?.failedCount > 0 || invite.json?.results?.some((row) => row.status === "failed");
  check(
    "host invite",
    invite.status >= 200 && invite.status < 300 && !inviteFailed && invite.json?.sentCount >= 1,
    `status=${invite.status} body=${invite.text}`,
  );

  const bulk = await callFunction("send-bulk-attendee-reminder", {
    apikey: publishableKey,
    Authorization: `Bearer ${signedIn.token}`,
  }, {
    eventId,
    title: "Staging proof",
    body: "Hello {first_name}",
    channels: { push: false, email: true, sms: false },
  });
  check(
    "host bulk reminder",
    bulk.status >= 200 && bulk.status < 300 && bulk.json?.sentCount >= 1,
    `status=${bulk.status} body=${bulk.text}`,
  );

  const sbSecret = keys.secrets.find((key) => key.startsWith("sb_secret_"));
  const legacyService = keys.secrets.find((key) => key.startsWith("eyJ"));
  const directBody = (email) => ({
    templateName: "event-reminder",
    recipientEmail: email,
    idempotencyKey: `direct-${email}`,
    templateData: {
      organizerName: "Staging",
      recipientName: "Staging Guest",
      eventTitle: "Staging email auth proof",
      eventDate: "December 1",
      eventTime: "6:00 PM",
      location: "Staging",
      eventUrl: "https://vjdrihmriufkameqngfg.supabase.co",
    },
  });
  if (!sbSecret || !legacyService) {
    check("both secret key formats present", false, `sb_secret=${Boolean(sbSecret)} legacy=${Boolean(legacyService)}`);
  } else {
    const secretAttempts = [];
    let secretQueued = false;
    for (const [mode, headers] of [
      ["both", authHeaders(sbSecret)],
      ["apikey", { apikey: sbSecret }],
      ["bearer", { Authorization: `Bearer ${sbSecret}` }],
    ]) {
      const secretCall = await callFunction("send-transactional-email", headers, directBody(`${mode}-${secretProofEmail}`));
      secretAttempts.push(`${mode}:${secretCall.status}`);
      if (secretCall.status >= 200 && secretCall.status < 300 && secretCall.json?.success === true) secretQueued = true;
    }
    check(
      "sb_secret can queue transactional email",
      secretQueued,
      secretAttempts.join(" "),
    );
    const legacyCall = await callFunction("send-transactional-email", authHeaders(legacyService), directBody(legacyProofEmail));
    check(
      "legacy service_role JWT can queue transactional email",
      legacyCall.status >= 200 && legacyCall.status < 300 && legacyCall.json?.success === true,
      `status=${legacyCall.status} body=${legacyCall.text}`,
    );
  }

  const forgedBody = {
    templateName: "event-reminder",
    recipientEmail: forgedEmail,
    templateData: { eventTitle: "nope" },
  };
  const anonymous = await callFunction("send-transactional-email", {}, forgedBody);
  const forgedJwt = await callFunction("send-transactional-email", {
    apikey: publishableKey,
    Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.sig",
  }, forgedBody);
  const forgedSecret = await callFunction("send-transactional-email", authHeaders("sb_secret_not_a_real_key"), forgedBody);
  const guestToTransactional = await callFunction("send-transactional-email", guestHeaders, forgedBody);
  check("anonymous transactional rejected", anonymous.status === 401, `status=${anonymous.status} body=${anonymous.text}`);
  check("forged jwt transactional rejected", forgedJwt.status === 401, `status=${forgedJwt.status} body=${forgedJwt.text}`);
  check("forged secret transactional rejected", forgedSecret.status === 401, `status=${forgedSecret.status} body=${forgedSecret.text}`);
  check("publishable key cannot send arbitrary email", guestToTransactional.status === 401, `status=${guestToTransactional.status} body=${guestToTransactional.text}`);

  const queried = await sql(
    `select template_name, status, recipient_email from public.email_send_log where recipient_email like '%${runId}@staging.ether.test' order by created_at desc`,
  );
  let rows = Array.isArray(queried.json) ? queried.json : queried.json?.result || queried.json?.rows;
  if (!Array.isArray(rows)) {
    const logQuery = await request(
      `${baseUrl}/rest/v1/email_send_log?select=template_name,status,recipient_email&recipient_email=like.*${runId}%40staging.ether.test`,
      { headers: authHeaders(secretKey) },
    );
    rows = Array.isArray(logQuery.json) ? logQuery.json : [];
    summary.logRead = `sql ${queried.status} ${queried.text}; rest ${logQuery.status}`;
  } else {
    summary.logRead = `sql ${queried.status}`;
  }
  summary.logRows = rows.map((row) => ({
    template: row.template_name,
    status: row.status,
    recipient: row.recipient_email,
  }));
  const templates = new Set(rows.map((row) => row.template_name));
  check(
    "email_send_log rows",
    templates.has("event-reminder") && templates.has("event-invite") && templates.has("event-bulk-attendee-reminder"),
    `templates=${[...templates].join(",") || "none"}`,
  );
  check(
    "forged call wrote no email_send_log row",
    rows.every((row) => row.recipient_email !== forgedEmail),
    `forged rows=${rows.filter((row) => row.recipient_email === forgedEmail).length}`,
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
  if (userId && secretKey) {
    const removed = await request(`${baseUrl}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: authHeaders(secretKey),
    });
    summary.userDeleted = removed.status;
  }
  const purged = await sql(
    `delete from pgmq.q_transactional_emails where message::text like '%${runId}@staging.ether.test%'`,
  );
  summary.queuePurged = purged.status;
  console.log(`PROOF_RESULT ${JSON.stringify(summary)}`);
  if (failures.length) {
    console.error(failures.map((failure) => redact(failure)).join("\n"));
    process.exitCode = 1;
  }
}
