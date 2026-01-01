import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const EMAIL_FROM = "ETHER <notifications@etherbylcove.com>";

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

interface DMNotificationRequest {
  recipient_id: string;
  sender_name: string;
  message_preview?: string;
  conversation_id: string;
}

const getEmailTemplate = (senderName: string, messagePreview?: string, conversationId?: string) => {
  const messageLink = conversationId 
    ? `https://etherbylcove.com/messages?chat=${conversationId}` 
    : "https://etherbylcove.com/messages";
    
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #1a1a1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #2a2520; border-radius: 16px; overflow: hidden;">
              <tr>
                <td style="padding: 40px; text-align: center;">
                  <div style="width: 60px; height: 60px; background: #E91E63; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                    <span style="color: white; font-size: 24px;">✉</span>
                  </div>
                  <h1 style="color: #ffffff; font-size: 24px; margin: 0 0 16px; font-weight: 600;">
                    New Message from ${senderName}
                  </h1>
                  ${messagePreview ? `<p style="color: #a0a0a0; font-size: 16px; line-height: 1.6; margin: 0 0 20px; font-style: italic;">"${messagePreview}"</p>` : ''}
                  <p style="color: #a0a0a0; font-size: 14px; margin: 0 0 30px;">
                    Open the app to view and reply to this message.
                  </p>
                  <a href="${messageLink}" 
                     style="display: inline-block; background: #E91E63; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                    View Message
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 40px; background-color: #1f1a17; text-align: center;">
                  <p style="color: #666; font-size: 12px; margin: 0;">
                    ETHER Creative Collective
                  </p>
                  <p style="color: #555; font-size: 11px; margin: 8px 0 0;">
                    You received this because you have message notifications enabled.
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

interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id: string;
}

// Send push notification using the centralized push function
async function sendPushNotification(
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string,
  senderName: string,
  messagePreview: string | undefined,
  conversationId: string
): Promise<{ success: boolean; result: string }> {
  try {
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get all push subscriptions for this user
    const { data: subscriptions, error: subError } = await supabaseClient
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, user_id")
      .eq("user_id", userId);

    if (subError) {
      console.error("Error fetching push subscriptions:", subError);
      return { success: false, result: "error_fetching_subscriptions" };
    }

    const subs = subscriptions as PushSubscription[] | null;
    
    if (!subs || subs.length === 0) {
      console.log("No push subscriptions found for user");
      return { success: false, result: "no_subscriptions" };
    }

    console.log(`Found ${subscriptions.length} push subscriptions for user`);

    // Build push payload
    const pushPayload = JSON.stringify({
      title: senderName,
      body: messagePreview || "Sent you a message",
      icon: "/favicon.png",
      badge: "/favicon.png",
      tag: `ether-message-${conversationId}`,
      renotify: true,
      requireInteraction: true,
      data: { 
        url: `/messages?chat=${conversationId}`,
        type: "message",
        conversation_id: conversationId,
        sender_name: senderName,
      },
      vibrate: [200, 100, 200],
      timestamp: Date.now(),
    });

    let sentCount = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subs) {
      try {
        const response = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "TTL": "86400",
            "Urgency": "high",
          },
          body: pushPayload,
        });

        if (response.status === 201 || response.status === 200) {
          console.log(`Push sent to: ${sub.endpoint.substring(0, 50)}...`);
          sentCount++;
        } else if (response.status === 410 || response.status === 404) {
          console.log(`Subscription expired: ${sub.endpoint.substring(0, 50)}...`);
          expiredEndpoints.push(sub.endpoint);
        } else {
          const errorText = await response.text();
          console.error(`Push failed: ${response.status} - ${errorText}`);
        }
      } catch (pushError) {
        console.error(`Error sending push: ${pushError}`);
      }
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabaseClient
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
      console.log(`Cleaned up ${expiredEndpoints.length} expired subscriptions`);
    }

    if (sentCount > 0) {
      return { success: true, result: `sent_${sentCount}` };
    }
    return { success: false, result: "failed" };
  } catch (error) {
    console.error("Error with push notifications:", error);
    return { success: false, result: "error" };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate sender email before processing
    validateSenderEmail(EMAIL_FROM);
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { recipient_id, sender_name, message_preview, conversation_id }: DMNotificationRequest = await req.json();

    console.log(`Processing DM notification for recipient: ${recipient_id} from sender: ${sender_name}, conversation: ${conversation_id}`);

    // Get recipient's notification preferences
    const { data: preferences, error: prefError } = await supabase
      .from("notification_preferences")
      .select("email_enabled, sms_enabled, push_enabled, messages_enabled")
      .eq("user_id", recipient_id)
      .single();

    if (prefError && prefError.code !== "PGRST116") {
      console.error("Error fetching preferences:", prefError);
      // Don't throw - continue with defaults if we can't fetch preferences
    }

    // Check if messages notifications are enabled (default to TRUE if no prefs exist)
    const messagesEnabled = preferences?.messages_enabled ?? true;
    if (!messagesEnabled) {
      console.log("Messages notifications disabled for user");
      return new Response(JSON.stringify({ success: true, message: "Notifications disabled" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Default to enabled for email/push if no preferences exist
    const emailEnabled = preferences?.email_enabled ?? true;
    const smsEnabled = preferences?.sms_enabled ?? false;
    const pushEnabled = preferences?.push_enabled ?? true;

    const results: { email?: string; sms?: string; push?: string } = {};

    // Send PUSH notification if enabled (priority notification method)
    if (pushEnabled) {
      const pushResult = await sendPushNotification(
        supabaseUrl,
        supabaseServiceKey,
        recipient_id,
        sender_name,
        message_preview,
        conversation_id
      );
      results.push = pushResult.result;
      console.log(`Push notification result: ${pushResult.result}`);
    } else {
      console.log("Push notifications disabled for user");
      results.push = "disabled";
    }

    // Send email notification if enabled
    if (emailEnabled) {
      try {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey) {
          // Get recipient email
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(recipient_id);
          
          if (userError) {
            console.error("Error fetching user:", userError);
            results.email = "error_fetching_user";
          } else if (userData?.user?.email) {
            const recipientEmail = userData.user.email;
            console.log(`Sending email notification to: ${recipientEmail}`);
            
            const resend = new Resend(resendApiKey);
            const html = getEmailTemplate(sender_name, message_preview, conversation_id);
            
            const emailResponse = await resend.emails.send({
              from: EMAIL_FROM,
              to: [recipientEmail],
              subject: `New message from ${sender_name}`,
              html,
            });

            console.log("Email sent to", recipientEmail, ":", emailResponse);
            results.email = "sent";
          } else {
            console.log("No email found for user");
            results.email = "no_email";
          }
        } else {
          console.log("RESEND_API_KEY not configured");
          results.email = "not_configured";
        }
      } catch (emailError) {
        console.error("Error sending email:", emailError);
        results.email = "failed";
      }
    } else {
      results.email = "disabled";
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
            results.sms = "error_fetching_profile";
          } else if (profile?.phone) {
            const smsBody = message_preview 
              ? `ETHER: New message from ${sender_name}: "${message_preview.substring(0, 100)}${message_preview.length > 100 ? '...' : ''}"`
              : `ETHER: New message from ${sender_name}. Open the app to view.`;

            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
            
            // Format phone number with country code if not present
            let formattedPhone = profile.phone.replace(/\D/g, ''); // Remove non-digits
            console.log(`Original phone: ${profile.phone}, stripped: ${formattedPhone}`);
            
            if (!formattedPhone.startsWith('1') && formattedPhone.length === 10) {
              formattedPhone = '1' + formattedPhone; // Add US country code
            }
            if (!formattedPhone.startsWith('+')) {
              formattedPhone = '+' + formattedPhone;
            }
            
            console.log(`Sending SMS to formatted phone: ${formattedPhone}`);
            
            const formData = new URLSearchParams();
            formData.append("To", formattedPhone);
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

            const smsResponseData = await smsResponse.text();
            console.log(`SMS API response (${smsResponse.status}):`, smsResponseData);

            if (smsResponse.ok) {
              console.log(`SMS sent successfully to ${formattedPhone}`);
              results.sms = "sent";
            } else {
              console.error("SMS send failed:", smsResponseData);
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
    } else {
      results.sms = "disabled";
    }

    console.log("DM notification results:", results);

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
