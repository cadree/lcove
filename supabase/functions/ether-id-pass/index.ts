import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getBearerUser } from "../_shared/require-caller.ts";
import { missingWalletSecrets, walletConfigured, PUSH_SECRET_NAME, matchEtherIdRoute } from "../_shared/ether-id-config.mjs";
import { etherIdPassJson } from "../_shared/ether-id-pass-json.mjs";
import { issuePassLink, passLinkParts, verifyPassLink } from "../_shared/ether-id-pass-link.mjs";
import { buildPkpass, passImages } from "../_shared/pkpass.mjs";
import { pushPassUpdate, signApnsJwt } from "../_shared/apns.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ether-id-push-secret",
};

const SITE = "https://etherbylcove.com";

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

function envMap() {
  const names = [
    "APPLE_PASS_TYPE_ID",
    "APPLE_TEAM_ID",
    "APPLE_PASS_CERT_PEM",
    "APPLE_PASS_KEY_PEM",
    "APPLE_WWDR_CERT_PEM",
    "APPLE_APNS_KEY_P8",
    "APPLE_APNS_KEY_ID",
    PUSH_SECRET_NAME,
    "ETHER_PUBLIC_SITE_URL",
    "SUPABASE_URL",
  ];
  const env: Record<string, string> = {};
  for (const name of names) env[name] = Deno.env.get(name) ?? "";
  return env;
}

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(url, key, { auth: { persistSession: false } });
}

function userClient(authorization: string) {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
}

function applePassToken(req: Request) {
  const header = req.headers.get("Authorization") ?? "";
  const match = header.match(/^ApplePass\s+(\S+)$/i);
  return match?.[1] ?? "";
}

function timingSafeEqual(a: string, b: string) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  const length = Math.max(left.length, right.length);
  let diff = left.length === right.length ? 0 : 1;
  for (let i = 0; i < length; i += 1) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

async function signedPass(card: Record<string, unknown>, passRow: {
  serial_number: string;
  authentication_token: string;
  pass_type_identifier: string;
}) {
  const env = envMap();
  const site = (env.ETHER_PUBLIC_SITE_URL || SITE).replace(/\/$/, "");
  const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/$/, "");
  const pass = etherIdPassJson(card, {
    passTypeIdentifier: passRow.pass_type_identifier,
    serialNumber: passRow.serial_number,
    teamIdentifier: env.APPLE_TEAM_ID.trim(),
    verifyUrl: `${site}${card.verify_path}`,
    webServiceURL: `${supabaseUrl}/functions/v1/ether-id-pass`,
    authenticationToken: passRow.authentication_token,
  });
  const bytes = await buildPkpass(
    [
      { name: "pass.json", data: JSON.stringify(pass) },
      ...passImages(),
    ],
    {
      certPem: env.APPLE_PASS_CERT_PEM,
      keyPem: env.APPLE_PASS_KEY_PEM,
      wwdrPem: env.APPLE_WWDR_CERT_PEM,
    },
  );
  return bytes;
}

function pkpass(bytes: Uint8Array) {
  return new Response(bytes, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": "attachment; filename=\"ether-id.pkpass\"",
      "Cache-Control": "no-store",
    },
  });
}

function unauthorized() {
  return new Response(null, { status: 401, headers: corsHeaders });
}

function linkSecret() {
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function passLinkRequested(url: URL) {
  return url.searchParams.has("uid") || url.searchParams.has("exp") || url.searchParams.has("sig");
}

async function ensureOwnerPass(authorization: string, passTypeId: string) {
  const asUser = userClient(authorization);
  const cardResult = await asUser.rpc("get_my_ether_id");
  if (cardResult.error || !cardResult.data) {
    return { error: cardResult.error?.message || "No Ether ID", status: 400 as const };
  }
  const passResult = await asUser.rpc("ensure_ether_id_pass", { p_pass_type_id: passTypeId });
  if (passResult.error || !passResult.data) {
    return { error: passResult.error?.message || "Could not open the pass", status: 400 as const };
  }
  return {
    card: cardResult.data as Record<string, unknown>,
    pass: passResult.data as {
      serial_number: string;
      authentication_token: string;
      pass_type_identifier: string;
    },
  };
}

async function passForLinkedUser(userId: string, passTypeId: string) {
  const admin = serviceClient();
  const cardResult = await admin.rpc("ether_id_card_for_service", { p_user_id: userId });
  if (cardResult.error || !cardResult.data) {
    return { error: "No Ether ID", status: 400 as const };
  }
  const existing = await admin
    .from("ether_id_passes")
    .select("serial_number, auth_token, pass_type_identifier")
    .eq("user_id", userId)
    .maybeSingle();
  const row = existing.data as {
    serial_number?: string;
    auth_token?: string;
    pass_type_identifier?: string;
  } | null;
  if (existing.error || !row?.serial_number || !row.auth_token) {
    console.log("[ETHER-ID-PASS] linked pass row unavailable");
    return { error: "Could not open the pass", status: 400 as const };
  }
  let passType = row.pass_type_identifier ?? passTypeId;
  if (passTypeId && passType !== passTypeId) {
    const updated = await admin
      .from("ether_id_passes")
      .update({ pass_type_identifier: passTypeId, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (updated.error) {
      console.log("[ETHER-ID-PASS] linked pass type update failed");
      return { error: "Could not open the pass", status: 400 as const };
    }
    passType = passTypeId;
  }
  const bytes = await signedPass(cardResult.data as Record<string, unknown>, {
    serial_number: row.serial_number,
    authentication_token: row.auth_token,
    pass_type_identifier: passType,
  });
  return { bytes };
}

async function handleSignedPassGet(req: Request, configured: boolean) {
  const parts = passLinkParts(req.url);
  const ok = await verifyPassLink({
    userId: parts.userId,
    exp: parts.exp,
    sig: parts.sig,
    secret: linkSecret(),
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!ok) return unauthorized();
  if (!configured) return json({ configured: false }, 503);
  const env = envMap();
  const loaded = await passForLinkedUser(parts.userId, env.APPLE_PASS_TYPE_ID.trim());
  if ("error" in loaded) return json({ error: loaded.error }, loaded.status);
  return pkpass(loaded.bytes);
}

async function handleApp(req: Request) {
  const env = envMap();
  const configured = walletConfigured(env);
  const url = new URL(req.url);
  if (req.method === "GET" && passLinkRequested(url)) {
    return handleSignedPassGet(req, configured);
  }

  let action = "status";
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body && typeof body.action === "string") action = body.action;
    } catch {
      action = "status";
    }
  }
  if (action === "status" || !configured) {
    if (!configured) {
      console.log(`[ETHER-ID-PASS] wallet secrets missing: ${missingWalletSecrets(env).join(", ")}`);
    }
    return json({ configured });
  }

  const authorization = req.headers.get("Authorization");
  const admin = serviceClient();
  const userId = await getBearerUser(authorization, admin);
  if (!userId) return json({ error: "Unauthorized" }, 401);

  const passTypeId = env.APPLE_PASS_TYPE_ID.trim();
  const owned = await ensureOwnerPass(authorization ?? "", passTypeId);
  if ("error" in owned) return json({ error: owned.error }, owned.status);

  if (action === "link") {
    const secret = linkSecret();
    const base = (env.SUPABASE_URL || "").replace(/\/$/, "");
    if (!secret || !base) return unauthorized();
    const issued = await issuePassLink({
      userId,
      secret,
      nowSeconds: Math.floor(Date.now() / 1000),
      baseUrl: `${base}/functions/v1/ether-id-pass`,
    });
    return json({ url: issued.url, expires_at: issued.exp });
  }

  const bytes = await signedPass(owned.card, owned.pass);
  return pkpass(bytes);
}

async function handlePush(req: Request) {
  const env = envMap();
  const expected = env[PUSH_SECRET_NAME] ?? "";
  const provided = req.headers.get("x-ether-id-push-secret") ?? "";
  if (!expected || !timingSafeEqual(provided, expected)) return json({ error: "Unauthorized" }, 401);
  if (!walletConfigured(env)) return json({ configured: false, sent: 0 });

  const admin = serviceClient();
  const pending = await admin.rpc("ether_id_pending_pushes");
  if (pending.error) return json({ error: pending.error.message }, 500);
  const rows = (pending.data ?? []) as Array<{
    queue_id: number;
    push_token: string;
    pass_type_identifier: string;
  }>;
  if (rows.length === 0) return json({ configured: true, sent: 0 });

  const jwt = await signApnsJwt({
    p8: env.APPLE_APNS_KEY_P8,
    keyId: env.APPLE_APNS_KEY_ID.trim(),
    teamId: env.APPLE_TEAM_ID.trim(),
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  const sent: number[] = [];
  for (const row of rows) {
    const result = await pushPassUpdate({
      jwt,
      pushToken: row.push_token,
      topic: row.pass_type_identifier,
    });
    if (result.ok) sent.push(row.queue_id);
    else console.log(`[ETHER-ID-PASS] apns ${result.status} for queue ${row.queue_id}`);
  }
  if (sent.length > 0) await admin.rpc("ether_id_mark_pushes", { p_ids: sent });
  return json({ configured: true, sent: sent.length, pending: rows.length });
}

async function handlePassKit(req: Request, route: ReturnType<typeof matchEtherIdRoute>) {
  const env = envMap();
  if (!walletConfigured(env)) return json({ configured: false }, 503);
  const admin = serviceClient();

  if (route.kind === "log") return json({});

  if (route.kind === "list") {
    const since = new URL(req.url).searchParams.get("passesUpdatedSince") ?? "";
    const listed = await admin.rpc("ether_id_updated_serials", {
      p_device: route.device,
      p_pass_type_id: route.passType,
      p_since: since,
    });
    if (listed.error) return json({ error: "Unauthorized" }, 401);
    const body = listed.data as { serialNumbers?: string[] };
    if (!body?.serialNumbers?.length) return new Response(null, { status: 204, headers: corsHeaders });
    return json(body);
  }

  const token = applePassToken(req);
  if (!token) return json({ error: "Unauthorized" }, 401);

  if (route.kind === "register") {
    const body = await req.json().catch(() => ({}));
    const pushToken = typeof body?.pushToken === "string" ? body.pushToken : "";
    if (!pushToken) return json({ error: "pushToken required" }, 400);
    const registered = await admin.rpc("ether_id_register_device", {
      p_serial: route.serial,
      p_auth_token: token,
      p_pass_type_id: route.passType,
      p_device: route.device,
      p_push_token: pushToken,
    });
    if (registered.error || registered.data == null) return json({ error: "Unauthorized" }, 401);
    return new Response(null, { status: registered.data ? 201 : 200, headers: corsHeaders });
  }

  if (route.kind === "unregister") {
    const removed = await admin.rpc("ether_id_unregister_device", {
      p_serial: route.serial,
      p_auth_token: token,
      p_pass_type_id: route.passType,
      p_device: route.device,
    });
    if (removed.error || removed.data == null) return json({ error: "Unauthorized" }, 401);
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (route.kind === "latest") {
    const found = await admin.rpc("ether_id_pass_by_serial", {
      p_serial: route.serial,
      p_auth_token: token,
      p_pass_type_id: route.passType,
    });
    if (found.error || !found.data) return json({ error: "Unauthorized" }, 401);
    const row = found.data as { user_id: string; updated_tag: string };
    const card = await admin.rpc("ether_id_card_for_service", { p_user_id: row.user_id });
    if (card.error || !card.data) return json({ error: "No Ether ID" }, 404);
    const bytes = await signedPass(card.data as Record<string, unknown>, {
      serial_number: route.serial,
      authentication_token: token,
      pass_type_identifier: route.passType,
    });
    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.apple.pkpass",
        "Last-Modified": new Date(Number(row.updated_tag) * 1000).toUTCString(),
      },
    });
  }

  return json({ error: "Not found" }, 404);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const route = matchEtherIdRoute(new URL(req.url).pathname, req.method);
    if (route.kind === "app") return await handleApp(req);
    if (route.kind === "push") return await handlePush(req);
    if (route.kind === "unknown") return json({ error: "Not found" }, 404);
    return await handlePassKit(req, route);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`[ETHER-ID-PASS] ${message}`);
    return json({ error: message }, 500);
  }
});
