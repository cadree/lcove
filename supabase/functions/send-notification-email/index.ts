import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  user_id: string;
  notification_type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

const getEmailTemplate = (type: string, title: string, body: string) => {
  const typeColors: Record<string, string> = {
    message: "#E91E63",
    like: "#E91E63",
    comment: "#2196F3",
    project_invite: "#4CAF50",
    event_reminder: "#FF9800",
    live_stream: "#F44336",
  };

  const color = typeColors[type] || "#E91E63";

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
                    <div style="width: 60px; height: 60px; background: ${color}; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                      <span style="color: white; font-size: 24px;">✦</span>
                    </div>
                    <h1 style="color: #ffffff; font-size: 24px; margin: 0 0 16px; font-weight: 600;">
                      ${title}
                    </h1>
                    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                      ${body}
                    </p>
                    <a href="https://ether.community/notifications" 
                       style="display: inline-block; background: ${color}; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                      View in App
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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { user_id, notification_type, title, body, data }: NotificationEmailRequest = await req.json();

    console.log("Sending notification email for user:", user_id, "type:", notification_type);

    // Get user email from auth
    const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserById(user_id);
    
    if (userError || !userData?.user?.email) {
      console.error("Could not get user email:", userError);
      return new Response(
        JSON.stringify({ error: "User not found or no email" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if email notifications are enabled
    const { data: prefs } = await supabaseClient
      .from("notification_preferences")
      .select("email_enabled")
      .eq("user_id", user_id)
      .single();

    if (!prefs?.email_enabled) {
      console.log("Email notifications disabled for user:", user_id);
      return new Response(
        JSON.stringify({ message: "Email notifications disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = getEmailTemplate(notification_type, title, body);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "ETHER <notifications@resend.dev>",
        to: [userData.user.email],
        subject: title,
        html,
      }),
    });

    const emailData = await emailResponse.json();
    console.log("Email sent successfully:", emailData);

    return new Response(
      JSON.stringify({ success: true, emailId: emailData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending notification email:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
