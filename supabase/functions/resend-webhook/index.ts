import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// Resend signs webhooks with Svix. Unsigned requests are ignored.

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function verifySvix(secret: string, id: string, timestamp: string, body: string, signature: string): Promise<boolean> {
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 60 * 5) return false;
  const raw = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const keyBytes = Uint8Array.from(atob(raw), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(signed)));
  return signature.split(" ").some((part) => {
    const value = part.startsWith("v1,") ? part.slice(3) : part;
    return timingSafeEqual(value, expected);
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) {
    return new Response(JSON.stringify({ error: "RESEND_WEBHOOK_SECRET is not set" }), { status: 503 });
  }

  const body = await req.text();
  const id = req.headers.get("svix-id") || "";
  const timestamp = req.headers.get("svix-timestamp") || "";
  const signature = req.headers.get("svix-signature") || "";
  const verified = await verifySvix(secret, id, timestamp, body, signature);
  if (!verified) return new Response(JSON.stringify({ error: "invalid signature" }), { status: 401 });

  const payload = JSON.parse(body) as { type?: string; data?: { email_id?: string } };
  const emailId = payload.data?.email_id;
  const kind = payload.type === "email.delivered"
    ? "delivered"
    : payload.type === "email.opened"
      ? "open"
      : payload.type === "email.clicked"
        ? "click"
        : payload.type === "email.bounced" || payload.type === "email.complained"
          ? "bounce"
          : null;

  if (!emailId || !kind) return new Response(JSON.stringify({ ignored: true }));

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const { data, error } = await admin.rpc("record_notification_engagement", {
    p_token: emailId,
    p_kind: kind,
  });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data ?? { ok: true }));
});
