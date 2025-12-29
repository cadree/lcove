import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMAIL_FROM = "ETHER Admin <notifications@etherbylcove.com>";

// Validate sender email - block @resend.dev domain
const validateSenderEmail = (from: string): void => {
  if (from.includes("@resend.dev")) {
    throw new Error("Invalid sender domain: @resend.dev is not allowed. Use verified domain @etherbylcove.com");
  }
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendMessageRequest {
  target_user_id: string;
  title: string;
  message: string;
  delivery_methods: {
    email: boolean;
    sms: boolean;
    dm: boolean;
  };
}

const getEmailTemplate = (title: string, body: string) => {
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
                    <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #E91E63, #FF5722); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                      <span style="color: white; font-size: 24px;">✦</span>
                    </div>
                    <h1 style="color: #ffffff; font-size: 24px; margin: 0 0 16px; font-weight: 600;">
                      ${title}
                    </h1>
                    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6; margin: 0 0 30px; white-space: pre-wrap;">
                      ${body}
                    </p>
                    <a href="https://etherbylcove.com" 
                       style="display: inline-block; background: linear-gradient(135deg, #E91E63, #FF5722); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                      Open ETHER
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: #1f1a17; text-align: center;">
                    <p style="color: #666; font-size: 12px; margin: 0;">
                      ETHER Creative Collective
                    </p>
                    <p style="color: #555; font-size: 11px; margin: 8px 0 0;">
                      This message was sent by an administrator.
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
    // Validate sender email before processing
    validateSenderEmail(EMAIL_FROM);
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get auth header and verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: adminRole } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!adminRole) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { target_user_id, title, message, delivery_methods }: SendMessageRequest = await req.json();

    console.log("Sending individual message to:", target_user_id, "methods:", delivery_methods);

    // Get target user details
    const { data: targetUser, error: userError } = await supabaseClient.auth.admin.getUserById(target_user_id);
    
    if (userError || !targetUser?.user) {
      return new Response(
        JSON.stringify({ error: "Target user not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile for phone number
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("phone, display_name")
      .eq("user_id", target_user_id)
      .single();

    const results = {
      email: { sent: false, error: null as string | null },
      sms: { sent: false, error: null as string | null },
      dm: { sent: false, error: null as string | null },
    };

    // Send Email
    if (delivery_methods.email && targetUser.user.email) {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        try {
          const html = getEmailTemplate(title, message);
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: EMAIL_FROM,
              to: [targetUser.user.email],
              subject: title,
              html,
            }),
          });

          if (emailResponse.ok) {
            results.email.sent = true;
            console.log("Email sent successfully to:", targetUser.user.email);
          } else {
            const emailError = await emailResponse.text();
            results.email.error = emailError;
            console.error("Email error:", emailError);
          }
        } catch (e) {
          results.email.error = e instanceof Error ? e.message : "Unknown error";
          console.error("Email exception:", e);
        }
      } else {
        results.email.error = "RESEND_API_KEY not configured";
      }
    }

    // Send SMS
    if (delivery_methods.sms && profile?.phone) {
      const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
      const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
      const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

      if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
        try {
          // Format phone number - ensure it has country code
          let phoneNumber = profile.phone.replace(/\D/g, "");
          if (!phoneNumber.startsWith("1") && phoneNumber.length === 10) {
            phoneNumber = "1" + phoneNumber; // Add US country code
          }
          if (!phoneNumber.startsWith("+")) {
            phoneNumber = "+" + phoneNumber;
          }

          const smsBody = `ETHER: ${title}\n\n${message}`;
          
          const twilioResponse = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
              },
              body: new URLSearchParams({
                To: phoneNumber,
                From: TWILIO_PHONE_NUMBER,
                Body: smsBody.substring(0, 1600), // Twilio limit
              }),
            }
          );

          if (twilioResponse.ok) {
            results.sms.sent = true;
            console.log("SMS sent successfully to:", phoneNumber);
          } else {
            const smsError = await twilioResponse.text();
            results.sms.error = smsError;
            console.error("SMS error:", smsError);
          }
        } catch (e) {
          results.sms.error = e instanceof Error ? e.message : "Unknown error";
          console.error("SMS exception:", e);
        }
      } else {
        results.sms.error = "Twilio credentials not configured";
      }
    } else if (delivery_methods.sms && !profile?.phone) {
      results.sms.error = "User has no phone number";
    }

    // Send DM (in-app message)
    if (delivery_methods.dm) {
      try {
        // Create a notification for the user
        const { error: notifError } = await supabaseClient
          .from("notifications")
          .insert({
            user_id: target_user_id,
            type: "message",
            title: title,
            body: message,
            data: { from_admin: true },
          });

        if (notifError) {
          results.dm.error = notifError.message;
          console.error("DM notification error:", notifError);
        } else {
          results.dm.sent = true;
          console.log("DM notification created for:", target_user_id);
        }
      } catch (e) {
        results.dm.error = e instanceof Error ? e.message : "Unknown error";
        console.error("DM exception:", e);
      }
    }

    // Log admin action
    await supabaseClient.from("admin_actions").insert({
      admin_id: user.id,
      target_user_id: target_user_id,
      action_type: "individual_message",
      metadata: {
        title,
        delivery_methods,
        results,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending individual message:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
