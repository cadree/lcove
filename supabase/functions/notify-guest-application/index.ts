import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = "ETHER <notifications@etherbylcove.com>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GuestApplicationRequest {
  project_id: string;
  project_title: string;
  role_name: string;
  applicant_name: string;
  applicant_email: string;
  project_creator_id: string;
}

const getGuestConfirmationEmail = (projectTitle: string, roleName: string) => `
<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;padding:0;background-color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;padding:40px 20px;">
      <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#2a2520;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:40px;text-align:center;">
            <div style="width:60px;height:60px;background:#E91E63;border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;">
              <span style="color:white;font-size:24px;">✅</span>
            </div>
            <h1 style="color:#ffffff;font-size:24px;margin:0 0 16px;font-weight:600;">Application Received</h1>
            <p style="color:#a0a0a0;font-size:16px;line-height:1.6;margin:0 0 20px;">
              We received your application for the role of <strong style="color:#ffffff;">${roleName}</strong> on the project:
            </p>
            <p style="color:#ffffff;font-size:20px;font-weight:600;margin:0 0 20px;">${projectTitle}</p>
            <p style="color:#a0a0a0;font-size:14px;line-height:1.6;margin:0 0 30px;">
              The project creator will review it soon. You'll receive an email when there's an update.
            </p>
            <a href="https://etherbylcove.com" style="display:inline-block;background:#E91E63;color:white;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:14px;">
              Explore ETHER
            </a>
          </td></tr>
          <tr><td style="padding:20px 40px;background-color:#1f1a17;text-align:center;">
            <p style="color:#666;font-size:12px;margin:0;">ETHER Creative Collective</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

const getOwnerNotificationEmail = (projectTitle: string, roleName: string, applicantName: string, applicantEmail: string, portfolioLink: string | null, message: string | null) => `
<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;padding:0;background-color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;padding:40px 20px;">
      <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#2a2520;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:40px;text-align:center;">
            <div style="width:60px;height:60px;background:#E91E63;border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;">
              <span style="color:white;font-size:24px;">📋</span>
            </div>
            <h1 style="color:#ffffff;font-size:24px;margin:0 0 16px;font-weight:600;">New Guest Application</h1>
            <p style="color:#a0a0a0;font-size:16px;line-height:1.6;margin:0 0 10px;">
              <strong style="color:#E91E63;">${applicantName}</strong> has applied for the role of <strong style="color:#ffffff;">${roleName}</strong> on:
            </p>
            <p style="color:#ffffff;font-size:20px;font-weight:600;margin:0 0 20px;">${projectTitle}</p>
            <table width="100%" style="text-align:left;margin:0 0 20px;">
              <tr><td style="color:#666;font-size:13px;padding:6px 0;">Email</td><td style="color:#fff;font-size:13px;padding:6px 0;">${applicantEmail}</td></tr>
              ${portfolioLink ? `<tr><td style="color:#666;font-size:13px;padding:6px 0;">Portfolio</td><td style="padding:6px 0;"><a href="${portfolioLink}" style="color:#E91E63;font-size:13px;">${portfolioLink}</a></td></tr>` : ''}
              ${message ? `<tr><td style="color:#666;font-size:13px;padding:6px 0;vertical-align:top;">Message</td><td style="color:#ccc;font-size:13px;padding:6px 0;">${message}</td></tr>` : ''}
            </table>
            <a href="https://etherbylcove.com/projects" style="display:inline-block;background:#E91E63;color:white;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:14px;">
              Review Application
            </a>
          </td></tr>
          <tr><td style="padding:20px 40px;background-color:#1f1a17;text-align:center;">
            <p style="color:#666;font-size:12px;margin:0;">ETHER Creative Collective</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { project_id, project_title, role_name, applicant_name, applicant_email, project_creator_id, portfolio_link, message } = await req.json();

    const results: { channel: string; status: string; error?: string }[] = [];

    // 1. Send confirmation email to guest applicant
    if (RESEND_API_KEY && applicant_email) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: [applicant_email],
            subject: `Application Received – ${project_title}`,
            html: getGuestConfirmationEmail(project_title, role_name),
          }),
        });
        results.push({ channel: "guest_email", status: res.ok ? "sent" : "error", ...(res.ok ? {} : { error: await res.text() }) });
      } catch (e) {
        results.push({ channel: "guest_email", status: "error", error: String(e) });
      }
    }

    // 2. Notify project owner
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get owner email
    const { data: ownerData } = await supabase.auth.admin.getUserById(project_creator_id);

    if (ownerData?.user?.email && RESEND_API_KEY) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: [ownerData.user.email],
            subject: `New Guest Application – ${project_title}`,
            html: getOwnerNotificationEmail(project_title, role_name, applicant_name, applicant_email, portfolio_link, message),
          }),
        });
        results.push({ channel: "owner_email", status: res.ok ? "sent" : "error", ...(res.ok ? {} : { error: await res.text() }) });
      } catch (e) {
        results.push({ channel: "owner_email", status: "error", error: String(e) });
      }
    }

    // 3. Create in-app notification for owner
    await supabase.from("notifications").insert({
      user_id: project_creator_id,
      type: "project_application",
      title: "New Guest Application",
      body: `${applicant_name} (guest) applied for "${role_name}" on "${project_title}"`,
      data: { project_id, role_name, applicant_name, applicant_email },
    });

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-guest-application:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
