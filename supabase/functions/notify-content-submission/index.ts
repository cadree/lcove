import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
const EMAIL_FROM = "ETHER <notifications@etherbylcove.com>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifySubmissionRequest {
  network_id: string;
  network_name: string;
  submission_title: string;
  submitter_name: string;
  content_type: string;
}

const getEmailTemplate = (networkName: string, submissionTitle: string, submitterName: string, contentType: string) => {
  const typeLabel = contentType === 'tv_show' ? 'TV Show' : contentType === 'short_film' ? 'Short Film' : 'Feature Film';
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="margin: 0; padding: 0; background-color: #080808; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #080808; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1612; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
                <tr>
                  <td style="padding: 40px; text-align: center;">
                    <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #e85d8c, #d14a77); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                      <span style="color: white; font-size: 24px;">🎬</span>
                    </div>
                    <h1 style="color: #ffffff; font-size: 24px; margin: 0 0 8px; font-weight: 600;">
                      New Content Submission
                    </h1>
                    <p style="color: #a0a0a0; font-size: 14px; margin: 0 0 24px;">
                      for ${networkName}
                    </p>
                    <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: left;">
                      <p style="color: #e85d8c; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">
                        ${typeLabel}
                      </p>
                      <p style="color: #ffffff; font-size: 20px; font-weight: 600; margin: 0 0 8px;">
                        ${submissionTitle}
                      </p>
                      <p style="color: #888; font-size: 14px; margin: 0;">
                        Submitted by ${submitterName}
                      </p>
                    </div>
                    <a href="https://etherbylcove.com/cinema" 
                       style="display: inline-block; background: linear-gradient(135deg, #e85d8c, #d14a77); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                      Review Submission
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: #12100e; text-align: center;">
                    <p style="color: #666; font-size: 12px; margin: 0;">
                      LC Cinema • ETHER Creative Collective
                    </p>
                    <p style="color: #555; font-size: 11px; margin: 8px 0 0;">
                      You're receiving this because you own the "${networkName}" network.
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

const sendSMS = async (to: string, message: string) => {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.log("Twilio credentials not configured, skipping SMS");
    return false;
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        },
        body: new URLSearchParams({
          To: to,
          From: TWILIO_PHONE_NUMBER,
          Body: message,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Twilio SMS error:", error);
      return false;
    }

    console.log("SMS sent successfully to", to);
    return true;
  } catch (error) {
    console.error("SMS send error:", error);
    return false;
  }
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

    const { network_id, network_name, submission_title, submitter_name, content_type }: NotifySubmissionRequest = await req.json();

    console.log(`Notifying owner of network ${network_id} about new submission: ${submission_title}`);

    // Get the network owner
    const { data: network, error: networkError } = await supabase
      .from("networks")
      .select("owner_id")
      .eq("id", network_id)
      .single();

    if (networkError || !network) {
      console.error("Error fetching network:", networkError);
      throw new Error("Network not found");
    }

    const ownerId = network.owner_id;

    // Get owner's notification preferences
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", ownerId)
      .single();

    // Get owner's profile for name and phone
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, phone")
      .eq("id", ownerId)
      .single();

    // Get owner's email
    const { data: userData } = await supabase.auth.admin.getUserById(ownerId);

    const notificationTitle = `New Submission: ${submission_title}`;
    const notificationBody = `${submitter_name} submitted a ${content_type.replace('_', ' ')} to ${network_name}`;

    // 1. Create in-app notification
    await supabase.from("notifications").insert({
      user_id: ownerId,
      type: "project_invite",
      title: notificationTitle,
      body: notificationBody,
      data: {
        network_id,
        submission_title,
        submitter_name,
        url: `/cinema/manage/${network_id}`,
      },
    });
    console.log("In-app notification created");

    // 2. Send email if enabled
    if (prefs?.email_enabled !== false && RESEND_API_KEY && userData?.user?.email) {
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
            html: getEmailTemplate(network_name, submission_title, submitter_name, content_type),
          }),
        });

        if (emailResponse.ok) {
          console.log("Email sent successfully to", userData.user.email);
        } else {
          const emailError = await emailResponse.text();
          console.error("Email send error:", emailError);
        }
      } catch (emailErr) {
        console.error("Email error:", emailErr);
      }
    }

    // 3. Send SMS if enabled and phone exists
    if (prefs?.sms_enabled && profile?.phone) {
      const smsMessage = `LC Cinema: New submission "${submission_title}" by ${submitter_name} to your network "${network_name}". Review it in the app.`;
      await sendSMS(profile.phone, smsMessage);
    }

    // 4. Send push notification if enabled
    if (prefs?.push_enabled !== false) {
      try {
        await supabase.functions.invoke("send-push-notification", {
          body: {
            user_id: ownerId,
            title: notificationTitle,
            body: notificationBody,
            notification_type: "project_invite",
            data: {
              network_id,
              url: `/cinema/manage/${network_id}`,
            },
          },
        });
        console.log("Push notification sent");
      } catch (pushErr) {
        console.error("Push notification error:", pushErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Owner notified successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-content-submission:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
