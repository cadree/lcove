import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = "ETHER <notifications@etherbylcove.com>";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyApplicationAcceptedRequest {
  applicant_id: string;
  project_id: string;
  project_title: string;
  role_title: string;
}

const getEmailTemplate = (projectTitle: string, roleTitle: string) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="margin: 0; padding: 0; background-color: #1a1a1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #2a2520; border-radius: 16px; overflow: hidden;">
                <tr>
                  <td style="padding: 40px; text-align: center;">
                    <div style="width: 60px; height: 60px; background: #4CAF50; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                      <span style="color: white; font-size: 24px;">✓</span>
                    </div>
                    <h1 style="color: #ffffff; font-size: 24px; margin: 0 0 16px; font-weight: 600;">
                      Congratulations! Your Application Was Accepted
                    </h1>
                    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                      You've been accepted for the role of <strong style="color: #E91E63;">${roleTitle}</strong> on the project:
                    </p>
                    <p style="color: #ffffff; font-size: 20px; font-weight: 600; margin: 0 0 30px;">
                      ${projectTitle}
                    </p>
                    <a href="https://etherbylcove.com/projects" 
                       style="display: inline-block; background: #E91E63; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                      View Project
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: #1f1a17; text-align: center;">
                    <p style="color: #666; font-size: 12px; margin: 0;">
                      ETHER Creative Collective
                    </p>
                    <p style="color: #555; font-size: 11px; margin: 8px 0 0;">
                      You can manage your notification preferences in the app settings.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { applicant_id, project_id, project_title, role_title }: NotifyApplicationAcceptedRequest = await req.json();

    console.log("Notifying user of application acceptance:", applicant_id, "for project:", project_title);

    // Get user data
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(applicant_id);
    if (userError || !userData?.user) {
      console.error("Could not get user:", userError);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile for phone number
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone, display_name")
      .eq("user_id", applicant_id)
      .single();

    // Get notification preferences
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", applicant_id)
      .single();

    // Check if application updates are enabled (default to true)
    if (prefs?.application_updates_enabled === false) {
      console.log("Application update notifications disabled for user:", applicant_id);
      return new Response(
        JSON.stringify({ message: "Application notifications disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const notificationTitle = "Application Accepted!";
    const notificationBody = `Congratulations! You've been accepted as ${role_title} for "${project_title}"`;
    const results: { channel: string; status: string; error?: string }[] = [];

    // Create in-app notification
    const { error: notifError } = await supabase
      .from("notifications")
      .insert({
        user_id: applicant_id,
        type: "project_invite",
        title: notificationTitle,
        body: notificationBody,
        data: { project_id, role_title }
      });
    
    if (notifError) {
      console.error("Error creating notification:", notifError);
      results.push({ channel: "in_app", status: "error", error: notifError.message });
    } else {
      results.push({ channel: "in_app", status: "sent" });
    }

    // Send email if enabled
    if (prefs?.email_enabled && userData.user.email) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: [userData.user.email],
            subject: notificationTitle,
            html: getEmailTemplate(project_title, role_title),
          }),
        });

        if (emailResponse.ok) {
          console.log("Email sent successfully");
          results.push({ channel: "email", status: "sent" });
        } else {
          const errorData = await emailResponse.json();
          console.error("Email send failed:", errorData);
          results.push({ channel: "email", status: "error", error: JSON.stringify(errorData) });
        }
      } catch (emailError) {
        console.error("Email error:", emailError);
        results.push({ channel: "email", status: "error", error: String(emailError) });
      }
    }

    // Send SMS if enabled
    if (prefs?.sms_enabled && profile?.phone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
        const smsBody = `🎉 ${notificationTitle} ${notificationBody}`;
        
        const smsResponse = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
          },
          body: new URLSearchParams({
            To: profile.phone,
            From: TWILIO_PHONE_NUMBER || "",
            Body: smsBody,
          }),
        });

        if (smsResponse.ok) {
          console.log("SMS sent successfully");
          results.push({ channel: "sms", status: "sent" });
        } else {
          const errorData = await smsResponse.json();
          console.error("SMS send failed:", errorData);
          results.push({ channel: "sms", status: "error", error: JSON.stringify(errorData) });
        }
      } catch (smsError) {
        console.error("SMS error:", smsError);
        results.push({ channel: "sms", status: "error", error: String(smsError) });
      }
    }

    // Send push notification if enabled
    if (prefs?.push_enabled) {
      try {
        const pushResponse = await supabase.functions.invoke("send-push-notification", {
          body: {
            user_id: applicant_id,
            title: notificationTitle,
            body: notificationBody,
            notification_type: "project_invite",
            data: { project_id, url: "/projects" }
          }
        });

        if (pushResponse.error) {
          console.error("Push notification error:", pushResponse.error);
          results.push({ channel: "push", status: "error", error: pushResponse.error.message });
        } else {
          console.log("Push notification sent");
          results.push({ channel: "push", status: "sent" });
        }
      } catch (pushError) {
        console.error("Push error:", pushError);
        results.push({ channel: "push", status: "error", error: String(pushError) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-application-accepted:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
