import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

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

interface MassNotificationRequest {
  title: string;
  message: string;
  targetAudience: {
    type: "all" | "mindset_level" | "city";
    value?: string | number;
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
                    <div style="width: 60px; height: 60px; background: #E91E63; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                      <span style="color: white; font-size: 24px;">✦</span>
                    </div>
                    <h1 style="color: #ffffff; font-size: 24px; margin: 0 0 16px; font-weight: 600;">
                      ${title}
                    </h1>
                    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                      ${body}
                    </p>
                    <a href="https://etherbylcove.com/notifications" 
                       style="display: inline-block; background: #E91E63; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
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

// Helper to add delay between API calls to avoid rate limits
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate sender email before processing
    validateSenderEmail(EMAIL_FROM);
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Create user client to verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    console.log(`Mass notification request from user: ${user.id}`);

    // Verify admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      console.error("Admin check failed:", roleError);
      throw new Error("Access denied: Admin role required");
    }

    const { title, message, targetAudience }: MassNotificationRequest = await req.json();

    if (!title || !message) {
      throw new Error("Title and message are required");
    }

    console.log(`Sending mass notification: "${title}" to ${targetAudience.type}`);

    // Build query for target users - get phone numbers too
    let query = supabaseAdmin
      .from("profiles")
      .select("user_id, phone")
      .eq("is_suspended", false);

    if (targetAudience.type === "mindset_level" && targetAudience.value) {
      query = query.eq("mindset_level", targetAudience.value);
    } else if (targetAudience.type === "city" && targetAudience.value) {
      query = query.ilike("city", `%${targetAudience.value}%`);
    }

    const { data: targetUsers, error: usersError } = await query;

    if (usersError) {
      console.error("Error fetching target users:", usersError);
      throw new Error("Failed to fetch target users");
    }

    if (!targetUsers || targetUsers.length === 0) {
      console.log("No users match the target criteria");
      return new Response(
        JSON.stringify({ success: true, recipientCount: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${targetUsers.length} target users`);

    // Create notifications for all target users
    const notifications = targetUsers.map((u) => ({
      user_id: u.user_id,
      type: "announcement",
      title,
      body: message,
      data: { from: "admin", sent_at: new Date().toISOString() },
    }));

    // Insert notifications in batches of 100
    const batchSize = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const { error: insertError } = await supabaseAdmin
        .from("notifications")
        .insert(batch);
      
      if (insertError) {
        console.error(`Error inserting notification batch ${i / batchSize}:`, insertError);
      } else {
        insertedCount += batch.length;
      }
    }

    console.log(`Created ${insertedCount} in-app notifications`);

    // Track delivery stats
    let emailsSent = 0;
    let smsSent = 0;

    // Process emails and SMS for each user
    for (const targetUser of targetUsers) {
      try {
        // Get user preferences
        const { data: prefs } = await supabaseAdmin
          .from("notification_preferences")
          .select("email_enabled, sms_enabled")
          .eq("user_id", targetUser.user_id)
          .single();

        // Default email to enabled if no preferences
        const emailEnabled = prefs?.email_enabled !== false;
        const smsEnabled = prefs?.sms_enabled === true;

        // Send email if enabled and API key exists
        if (emailEnabled && RESEND_API_KEY) {
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(targetUser.user_id);
          
          if (userData?.user?.email) {
            try {
              // Add delay to avoid rate limits (500ms between emails)
              await delay(500);
              
              const emailResponse = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                  from: EMAIL_FROM,
                  to: [userData.user.email],
                  subject: title,
                  html: getEmailTemplate(title, message),
                }),
              });

              if (emailResponse.ok) {
                emailsSent++;
                console.log(`Email sent to ${userData.user.email}`);
              } else {
                const errorData = await emailResponse.text();
                console.error(`Failed to send email to ${userData.user.email}:`, errorData);
              }
            } catch (emailError) {
              console.error(`Email error for ${userData.user.email}:`, emailError);
            }
          }
        }

        // Send SMS if enabled and Twilio is configured
        if (smsEnabled && targetUser.phone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
          try {
            // Add delay to avoid rate limits
            await delay(200);
            
            const smsBody = `ETHER: ${title}\n\n${message.substring(0, 140)}${message.length > 140 ? '...' : ''}`;
            
            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
            const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
            
            const smsResponse = await fetch(twilioUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${twilioAuth}`,
              },
              body: new URLSearchParams({
                To: targetUser.phone,
                From: TWILIO_PHONE_NUMBER,
                Body: smsBody,
              }),
            });

            if (smsResponse.ok) {
              smsSent++;
              console.log(`SMS sent to ${targetUser.phone}`);
            } else {
              const errorData = await smsResponse.text();
              console.error(`Failed to send SMS to ${targetUser.phone}:`, errorData);
            }
          } catch (smsError) {
            console.error(`SMS error for ${targetUser.phone}:`, smsError);
          }
        }
      } catch (userError) {
        console.error(`Error processing user ${targetUser.user_id}:`, userError);
      }
    }

    console.log(`Delivery complete: ${emailsSent} emails, ${smsSent} SMS sent`);

    // Log the announcement in admin_announcements
    const { error: announcementError } = await supabaseAdmin
      .from("admin_announcements")
      .insert({
        title,
        message,
        target_audience: targetAudience,
        sent_by: user.id,
        recipient_count: insertedCount,
      });

    if (announcementError) {
      console.error("Error logging announcement:", announcementError);
    }

    // Log admin action
    await supabaseAdmin.from("admin_actions").insert({
      admin_id: user.id,
      action_type: "mass_notification",
      target_user_id: user.id,
      metadata: {
        title,
        target_audience: targetAudience,
        recipient_count: insertedCount,
        emails_sent: emailsSent,
        sms_sent: smsSent,
      },
    });

    console.log(`Mass notification complete: ${insertedCount} in-app, ${emailsSent} emails, ${smsSent} SMS`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        recipientCount: insertedCount,
        emailsSent,
        smsSent,
        message: `Sent to ${insertedCount} users (${emailsSent} emails, ${smsSent} SMS)` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error in send-mass-notification:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: errorMessage === "Unauthorized" ? 401 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
