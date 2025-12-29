import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DMNotificationRequest {
  recipient_id: string;
  sender_name: string;
  message_preview?: string;
  conversation_id: string;
}

const getEmailTemplate = (senderName: string, messagePreview?: string) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h1 style="color: #111827; font-size: 24px; margin: 0 0 16px 0;">New Message from ${senderName}</h1>
        ${messagePreview ? `<p style="color: #6b7280; font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">"${messagePreview}"</p>` : ''}
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px 0;">Open the app to view and reply to this message.</p>
        <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 16px;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">You received this because you have message notifications enabled.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { recipient_id, sender_name, message_preview, conversation_id }: DMNotificationRequest = await req.json();

    console.log(`Processing DM notification for recipient: ${recipient_id} from sender: ${sender_name}`);

    // Get recipient's notification preferences
    const { data: preferences, error: prefError } = await supabase
      .from("notification_preferences")
      .select("email_enabled, sms_enabled, messages_enabled")
      .eq("user_id", recipient_id)
      .single();

    if (prefError && prefError.code !== "PGRST116") {
      console.error("Error fetching preferences:", prefError);
      throw prefError;
    }

    // Check if messages notifications are enabled
    const messagesEnabled = preferences?.messages_enabled ?? true;
    if (!messagesEnabled) {
      console.log("Messages notifications disabled for user");
      return new Response(JSON.stringify({ success: true, message: "Notifications disabled" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const emailEnabled = preferences?.email_enabled ?? false;
    const smsEnabled = preferences?.sms_enabled ?? false;

    const results: { email?: string; sms?: string } = {};

    // Send email notification if enabled
    if (emailEnabled) {
      try {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey) {
          // Get recipient email
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(recipient_id);
          
          if (userError) {
            console.error("Error fetching user:", userError);
          } else if (userData?.user?.email) {
            const resend = new Resend(resendApiKey);
            const html = getEmailTemplate(sender_name, message_preview);
            
            const emailResponse = await resend.emails.send({
              from: "LCOVE <notifications@resend.dev>",
              to: [userData.user.email],
              subject: `New message from ${sender_name}`,
              html,
            });

            console.log("Email sent:", emailResponse);
            results.email = "sent";
          }
        } else {
          console.log("RESEND_API_KEY not configured");
          results.email = "not_configured";
        }
      } catch (emailError) {
        console.error("Error sending email:", emailError);
        results.email = "failed";
      }
    }

    // Send SMS notification if enabled
    if (smsEnabled) {
      try {
        const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

        if (twilioSid && twilioAuthToken && twilioPhone) {
          // Get recipient phone from profile
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("phone")
            .eq("user_id", recipient_id)
            .single();

          if (profileError) {
            console.error("Error fetching profile:", profileError);
          } else if (profile?.phone) {
            const smsBody = message_preview 
              ? `New message from ${sender_name}: "${message_preview.substring(0, 100)}${message_preview.length > 100 ? '...' : ''}"`
              : `New message from ${sender_name}. Open the app to view.`;

            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
            
            const formData = new URLSearchParams();
            formData.append("To", profile.phone);
            formData.append("From", twilioPhone);
            formData.append("Body", smsBody);

            const smsResponse = await fetch(twilioUrl, {
              method: "POST",
              headers: {
                "Authorization": "Basic " + btoa(`${twilioSid}:${twilioAuthToken}`),
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: formData.toString(),
            });

            if (smsResponse.ok) {
              console.log("SMS sent successfully");
              results.sms = "sent";
            } else {
              const errorText = await smsResponse.text();
              console.error("SMS send failed:", errorText);
              results.sms = "failed";
            }
          } else {
            console.log("No phone number for user");
            results.sms = "no_phone";
          }
        } else {
          console.log("Twilio not configured");
          results.sms = "not_configured";
        }
      } catch (smsError) {
        console.error("Error sending SMS:", smsError);
        results.sms = "failed";
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-dm-notification function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
