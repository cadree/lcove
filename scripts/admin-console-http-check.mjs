// Real HTTP calls against a local PostgREST. The database is ether_admin_test.
// Usage: node scripts/admin-console-http-check.mjs http://127.0.0.1:54330

import crypto from "node:crypto";

const base = (process.argv[2] || "http://127.0.0.1:54330").replace(/\/$/, "");
const secret = "ether-admin-console-test-secret-ok";
const adminId = "11111111-1111-4111-8111-111111111111";
const memberId = "22222222-2222-4222-8222-222222222222";
const targetId = "33333333-3333-4333-8333-333333333333";

function jwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

const adminToken = jwt({ role: "authenticated", sub: adminId });
const memberToken = jwt({ role: "authenticated", sub: memberId });

async function call(path, { token, body, method = "POST" } = {}) {
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, text };
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

const anonStats = await call("/rpc/admin_dashboard_stats", { body: {} });
if (anonStats.status < 400) fail(`anon stats status ${anonStats.status} ${anonStats.text}`);
else console.log(`PASS anon HTTP ${anonStats.status}`);

const memberSuspend = await call("/rpc/admin_set_user_access", {
  token: memberToken,
  body: { p_user_id: targetId, p_action: "suspend", p_reason: "nope" },
});
if (memberSuspend.status < 400 || !memberSuspend.text.toLowerCase().includes("admins only")) {
  fail(`member suspend status ${memberSuspend.status} ${memberSuspend.text}`);
} else console.log(`PASS member HTTP ${memberSuspend.status}`);

const stats = await call("/rpc/admin_dashboard_stats", { token: adminToken, body: {} });
if (stats.status !== 200) fail(`admin stats status ${stats.status} ${stats.text}`);
else {
  const parsed = JSON.parse(stats.text);
  if (parsed.signups_total !== 3 || parsed.revenue_cents !== 2500 || parsed.reports_ai_open !== 1) {
    fail(`admin stats body ${stats.text}`);
  } else console.log("PASS admin HTTP stats");
}

const suspend = await call("/rpc/admin_set_user_access", {
  token: adminToken,
  body: { p_user_id: targetId, p_action: "suspend", p_reason: "http" },
});
if (suspend.status !== 204 && suspend.status !== 200) fail(`admin suspend status ${suspend.status} ${suspend.text}`);
else console.log(`PASS admin HTTP suspend ${suspend.status}`);

const hide = await call("/rpc/admin_moderate_content", {
  token: adminToken,
  body: {
    p_kind: "post",
    p_id: "01999999-0000-4000-8000-000000000010",
    p_action: "hide",
    p_reason: "http",
    p_confirm: null,
  },
});
if (hide.status !== 204 && hide.status !== 200) fail(`admin hide status ${hide.status} ${hide.text}`);
else console.log(`PASS admin HTTP hide ${hide.status}`);

const hidden = await call("/posts?id=eq.01999999-0000-4000-8000-000000000010&select=id", { method: "GET" });
if (hidden.status !== 200) fail(`anon post read ${hidden.status} ${hidden.text}`);
else {
  const rows = JSON.parse(hidden.text);
  if (rows.length !== 0) fail(`anon saw hidden post ${hidden.text}`);
  else console.log("PASS anon HTTP does not see the hidden post");
}

const message = await call("/rpc/admin_message_user", {
  token: adminToken,
  body: { p_user_id: memberId, p_title: "HTTP notice", p_body: "From the check" },
});
if (message.status !== 200) fail(`admin message status ${message.status} ${message.text}`);
else console.log("PASS admin HTTP message");

if (process.exitCode) process.exit(process.exitCode);
