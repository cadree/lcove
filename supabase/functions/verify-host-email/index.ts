import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { httpStatusForError } from "../_shared/http-error.mjs";
import { PLATFORM_QUEUE_FROM } from "../_shared/host-email-address.mjs";
import {
  HOST_VERIFY_WINDOW_MS,
  callerMaySetEventReplyTo,
  verificationSendLimited,
} from "../_shared/host-reply-guard.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization required");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, eventId, email, code } = await req.json();
    if (!action) throw new Error("Missing action");

    if (action === "request") {
      const target = normalizeEmail(email);
      if (!/^[^\s@]+@[^\s@]+$/.test(target) || target.length > 320) throw new Error("Invalid email");

      const since = new Date(Date.now() - HOST_VERIFY_WINDOW_MS).toISOString();
      const [userAttempts, addressAttempts] = await Promise.all([
        countRecent(supabaseAdmin, "user_id", user.id, since),
        countRecent(supabaseAdmin, "email", target, since),
      ]);
      if (verificationSendLimited(userAttempts, addressAttempts)) {
        return json({ error: "Too many verification emails. Try again in an hour." }, 429);
      }

      const generated = String(Math.floor(100000 + Math.random() * 900000));
      const codeHash = await sha256(generated);
      const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const { error: insErr } = await supabaseAdmin
        .from("host_email_verifications")
        .insert({
          user_id: user.id,
          email: target,
          code_hash: codeHash,
          expires_at: expires,
        });
      if (insErr) throw new Error(insErr.message);

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) {
        console.error("verify-host-email missing RESEND_API_KEY");
        return json({ error: "Could not send verification email" }, 502);
      }

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `ETHER <${PLATFORM_QUEUE_FROM}>`,
          to: [target],
          subject: "Verify your host reply-to address",
          html: `<div style="font-family:Arial,sans-serif;padding:24px;max-width:480px;margin:0 auto;">
            <h2 style="color:#1a1a2e;">Verify your reply-to address</h2>
            <p>Enter this code in your event email settings to confirm this address can receive replies from your guests:</p>
            <div style="font-size:32px;font-weight:bold;letter-spacing:6px;background:#f4f4f4;padding:16px;text-align:center;border-radius:8px;margin:16px 0;">${generated}</div>
            <p style="color:#888;font-size:12px;">This code expires in 15 minutes.</p>
          </div>`,
        }),
      });
      if (!resendResponse.ok) {
        console.error("verify-host-email resend rejected", { status: resendResponse.status });
        return json({ error: "Could not send verification email" }, 502);
      }

      return json({ success: true });
    }

    if (action === "confirm") {
      const target = normalizeEmail(email);
      if (!target || !code || !eventId) throw new Error("Missing email, code, or eventId");

      const { data: event, error: eventError } = await supabaseAdmin
        .from("events")
        .select("id, creator_id, organization_id")
        .eq("id", eventId)
        .maybeSingle();
      if (eventError) throw new Error(eventError.message);
      if (!event) return json({ error: "Event not found" }, 404);

      const organizerRole = await organizerRoleFor(supabaseAdmin, event.organization_id, user.id);
      if (!callerMaySetEventReplyTo({
        callerId: user.id,
        creatorId: event.creator_id,
        organizationId: event.organization_id,
        organizerRole,
      })) {
        return json({ error: "Forbidden" }, 403);
      }

      const codeHash = await sha256(String(code));
      const { data: matches } = await supabaseAdmin
        .from("host_email_verifications")
        .select("id, expires_at")
        .eq("user_id", user.id)
        .eq("email", target)
        .eq("code_hash", codeHash)
        .is("verified_at", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!matches || matches.length === 0) throw new Error("Invalid code");
      if (new Date(matches[0].expires_at) < new Date()) throw new Error("Code expired");

      await supabaseAdmin
        .from("host_email_verifications")
        .update({ verified_at: new Date().toISOString() })
        .eq("id", matches[0].id);

      await supabaseAdmin
        .from("event_email_branding")
        .upsert(
          {
            event_id: eventId,
            reply_to_email: target,
            reply_to_verified_at: new Date().toISOString(),
          },
          { onConflict: "event_id" }
        );

      return json({ success: true, verified: true });
    }

    throw new Error("Unknown action");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return json({ error: errorMessage }, httpStatusForError(error));
  }
});

async function countRecent(
  supabaseAdmin: ReturnType<typeof createClient>,
  column: "user_id" | "email",
  value: string,
  since: string,
): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("host_email_verifications")
    .select("id", { count: "exact", head: true })
    .eq(column, value)
    .gte("created_at", since);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function organizerRoleFor(
  supabaseAdmin: ReturnType<typeof createClient>,
  organizationId: string | null,
  userId: string,
): Promise<string | null> {
  if (!organizationId) return null;
  const { data: member, error: memberError } = await supabaseAdmin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (memberError) throw new Error(memberError.message);
  if (member?.role === "owner" || member?.role === "admin") return member.role;

  const { data: org, error: orgError } = await supabaseAdmin
    .from("organizations")
    .select("owner_id")
    .eq("id", organizationId)
    .maybeSingle();
  if (orgError) throw new Error(orgError.message);
  if (org?.owner_id === userId) return "owner";
  return null;
}
