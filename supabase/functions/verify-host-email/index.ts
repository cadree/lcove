import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
      if (!email) throw new Error("Missing email");
      const generated = String(Math.floor(100000 + Math.random() * 900000));
      const codeHash = await sha256(generated);
      const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const { error: insErr } = await supabaseAdmin
        .from("host_email_verifications")
        .insert({
          user_id: user.id,
          email: email.toLowerCase().trim(),
          code_hash: codeHash,
          expires_at: expires,
        });
      if (insErr) throw new Error(insErr.message);

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "ETHER <noreply@notify.etherbylcove.com>",
            to: [email],
            subject: "Verify your host reply-to address",
            html: `<div style="font-family:Arial,sans-serif;padding:24px;max-width:480px;margin:0 auto;">
              <h2 style="color:#1a1a2e;">Verify your reply-to address</h2>
              <p>Enter this code in your event email settings to confirm this address can receive replies from your guests:</p>
              <div style="font-size:32px;font-weight:bold;letter-spacing:6px;background:#f4f4f4;padding:16px;text-align:center;border-radius:8px;margin:16px 0;">${generated}</div>
              <p style="color:#888;font-size:12px;">This code expires in 15 minutes.</p>
            </div>`,
          }),
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "confirm") {
      if (!email || !code || !eventId) throw new Error("Missing email, code, or eventId");
      const codeHash = await sha256(code);
      const { data: matches } = await supabaseAdmin
        .from("host_email_verifications")
        .select("id, expires_at")
        .eq("user_id", user.id)
        .eq("email", email.toLowerCase().trim())
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

      // Mark branding row verified
      await supabaseAdmin
        .from("event_email_branding")
        .upsert(
          {
            event_id: eventId,
            reply_to_email: email.toLowerCase().trim(),
            reply_to_verified_at: new Date().toISOString(),
          },
          { onConflict: "event_id" }
        );

      return new Response(JSON.stringify({ success: true, verified: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unknown action");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
