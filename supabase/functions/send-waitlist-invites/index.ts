import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jwtRole, jwtSubject, requireUserOrService } from "../_shared/require-caller.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = "ETHER <notifications@etherbylcove.com>";
const SITE_ORIGIN = "https://etherbylcove.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * PLACEHOLDER TEMPLATE — Cadre replaces this copy.
 * Nothing in this function calls Resend unless INVITE_EMAILS_ENABLED is exactly "true".
 */
function inviteEmailHtml(inviteUrl: string): string {
  const safeUrl = escapeHtml(inviteUrl);
  return `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:24px;background:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <p style="color:#ffffff;font-size:16px;line-height:1.5;">
          PLACEHOLDER for Cadre. This invite email is not final copy.
        </p>
        <p style="margin:24px 0;">
          <a href="${safeUrl}" style="display:inline-block;background:#FF9FC8;color:#0A0A0A;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">
            Open invite
          </a>
        </p>
        <p style="color:#888;font-size:12px;">ETHER</p>
      </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const denied = requireUserOrService(req, corsHeaders);
  if (denied) return denied;

  if (EMAIL_FROM.includes("@resend.dev")) {
    return json({ sent: false, error: "invalid sender" }, 500);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authorization = req.headers.get("Authorization");
    const role = jwtRole(authorization);
    if (role !== "service_role") {
      const userId = jwtSubject(authorization);
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const { data: allowed, error: roleError } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (roleError || allowed !== true) return json({ error: "not allowed" }, 403);
    }

    if (Deno.env.get("INVITE_EMAILS_ENABLED") !== "true") {
      return json({ sent: false });
    }

    if (!RESEND_API_KEY) {
      return json({ sent: false, error: "email not configured" }, 503);
    }

    const body = await req.json().catch(() => null) as { ids?: unknown } | null;
    const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === "string") : [];
    if (ids.length === 0 || ids.length > 100) {
      return json({ sent: false, error: "select a batch" }, 400);
    }

    const { data: invited, error: inviteError } = await supabase.rpc("invite_waitlist", { p_ids: ids });
    if (inviteError || !invited) {
      return json({ sent: false, error: "could not prepare invites" }, 500);
    }

    let allSent = true;
    for (const row of invited as { email: string; invite_token: string }[]) {
      const inviteUrl = `${SITE_ORIGIN}/auth?invite=${encodeURIComponent(row.invite_token)}`;
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [row.email],
          subject: "PLACEHOLDER for Cadre — your Ether invite",
          html: inviteEmailHtml(inviteUrl),
        }),
      });
      if (!emailResponse.ok) allSent = false;
    }

    return json({ sent: allSent });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("send-waitlist-invites failed:", message);
    return json({ sent: false, error: message }, 500);
  }
});
