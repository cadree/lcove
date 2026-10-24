import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Buffer } from "node:buffer";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { httpStatusForError } from "../_shared/http-error.mjs";
import { getBearerUser } from "../_shared/require-caller.ts";
import { appleWalletConfigured, appleWalletEnv } from "../_shared/wallet-config.mjs";
import { issueWalletPass, parseWalletPassBody } from "../_shared/wallet-pass.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeSecret(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.includes("BEGIN")) return trimmed;
  const decoded = Buffer.from(trimmed, "base64").toString("utf8");
  return decoded.includes("BEGIN") ? decoded : trimmed;
}

async function unlockKey(pem: string) {
  const passphrase = Deno.env.get("APPLE_PASS_KEY_PASSPHRASE") || "";
  if (!passphrase || !pem.includes("ENCRYPTED")) return pem;
  const imported = await import("npm:node-forge@1.3.1");
  const forge = imported.default ?? imported;
  const key = forge.pki.decryptRsaPrivateKey(pem, passphrase);
  if (!key) throw new Error("Could not sign the pass");
  return forge.pki.privateKeyToPem(key);
}

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

async function loadTicketRows(
  admin: ReturnType<typeof serviceClient>,
  ticketId: string | null,
  orderId: string | null,
) {
  const attendees: Record<string, unknown>[] = [];
  const orders: Record<string, unknown>[] = [];
  const rsvps: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];
  const hosts: Record<string, unknown>[] = [];

  const pushAttendee = (row: Record<string, unknown> | null) => {
    if (!row?.id) return;
    if (!attendees.some((existing) => existing.id === row.id)) attendees.push(row);
  };

  if (ticketId) {
    const { data, error } = await admin.from("event_attendees").select("*").eq("id", ticketId).maybeSingle();
    if (error) throw new Error("Could not load the ticket");
    pushAttendee(data);
  }
  if (orderId) {
    const { data, error } = await admin.from("ticket_orders").select("*").eq("id", orderId).maybeSingle();
    if (error) throw new Error("Could not load the ticket");
    if (data) orders.push(data);
    const people = await admin.from("event_attendees").select("*").eq("order_id", orderId);
    if (people.error) throw new Error("Could not load the ticket");
    for (const row of people.data || []) pushAttendee(row);
  }

  const missingOrders = [...new Set(attendees.map((row) => row.order_id).filter(Boolean))]
    .filter((id) => !orders.some((order) => order.id === id));
  if (missingOrders.length > 0) {
    const { data, error } = await admin.from("ticket_orders").select("*").in("id", missingOrders);
    if (error) throw new Error("Could not load the ticket");
    orders.push(...(data || []));
  }

  const rsvpIds = [...new Set(attendees.map((row) => row.rsvp_id).filter(Boolean))];
  if (rsvpIds.length > 0) {
    const { data, error } = await admin.from("event_rsvps").select("id, event_id, user_id, status").in("id", rsvpIds);
    if (error) throw new Error("Could not load the ticket");
    rsvps.push(...(data || []));
  }

  const eventIds = [...new Set(attendees.map((row) => row.event_id).filter(Boolean))];
  if (eventIds.length > 0) {
    const { data, error } = await admin
      .from("events")
      .select("id, title, start_date, venue, address, city, state, timezone, creator_id, hide_address")
      .in("id", eventIds);
    if (error) throw new Error("Could not load the ticket");
    events.push(...(data || []));
    const secrets = await admin.from("event_secrets").select("event_id, private_address").in("event_id", eventIds);
    if (secrets.error) throw new Error("Could not load the ticket");
    for (const event of events) {
      const secret = (secrets.data || []).find((row) => row.event_id === event.id);
      if (secret?.private_address) event.private_address = secret.private_address;
    }
  }

  const creatorIds = [...new Set(events.map((row) => row.creator_id).filter(Boolean))];
  if (creatorIds.length > 0) {
    const creators = await admin.from("consumer_creators").select("user_id, display_name").in("user_id", creatorIds);
    if (creators.error) throw new Error("Could not load the ticket");
    hosts.push(...(creators.data || []));
    const missingHosts = creatorIds.filter((id) => !hosts.some((host) => host.user_id === id && host.display_name));
    if (missingHosts.length > 0) {
      const profiles = await admin.from("profiles").select("user_id, display_name").in("user_id", missingHosts);
      if (profiles.error) throw new Error("Could not load the ticket");
      for (const profile of profiles.data || []) {
        if (!hosts.some((host) => host.user_id === profile.user_id && host.display_name)) hosts.push(profile);
      }
    }
  }

  return { attendees, orders, rsvps, events, hosts };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const env = appleWalletEnv();
    const configured = appleWalletConfigured(env);
    const parsed = parseWalletPassBody(body);
    if (parsed.probe || !configured) {
      return json({ configured });
    }
    if (parsed.error) return json({ error: parsed.error }, 400);

    const admin = serviceClient();
    const callerId = await getBearerUser(req.headers.get("Authorization"), admin);
    if (!callerId) return json({ error: "Unauthorized" }, 401);

    const rows = await loadTicketRows(admin, parsed.ticketId, parsed.orderId);
    const issued = await issueWalletPass({
      callerId,
      body,
      rows,
      configured: true,
      certs: {
        certPem: decodeSecret(env.APPLE_PASS_CERT || ""),
        keyPem: await unlockKey(decodeSecret(env.APPLE_PASS_KEY || "")),
        wwdrPem: decodeSecret(env.APPLE_WWDR_CERT || ""),
      },
      passTypeIdentifier: (env.APPLE_PASS_TYPE_ID || "").trim(),
      teamIdentifier: (env.APPLE_TEAM_ID || "").trim(),
    });
    return json(issued.body, issued.status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not sign the pass";
    console.error(`[generate-wallet-pass] ${message}`);
    return json({ error: message === "Could not load the ticket" ? message : "Could not sign the pass" }, httpStatusForError(error));
  }
});
