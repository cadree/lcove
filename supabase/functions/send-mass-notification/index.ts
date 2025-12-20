import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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
                    <a href="https://ether.community/notifications" 
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Build query for target users
    let query = supabaseAdmin
      .from("profiles")
      .select("user_id")
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

    console.log(`Created ${insertedCount} notifications`);

    // Send emails to users who have email notifications enabled
    let emailsSent = 0;
    
    if (RESEND_API_KEY) {
      console.log("Sending emails to users...");
      
      // Get users with email preferences and their emails
      for (const targetUser of targetUsers) {
        try {
          // Check if user has email notifications enabled
          const { data: prefs } = await supabaseAdmin
            .from("notification_preferences")
            .select("email_enabled")
            .eq("user_id", targetUser.user_id)
            .single();

          // Default to enabled if no preferences set
          const emailEnabled = prefs?.email_enabled !== false;

          if (emailEnabled) {
            // Get user email from auth
            const { data: userData, error: userFetchError } = await supabaseAdmin.auth.admin.getUserById(targetUser.user_id);
            
            if (userFetchError || !userData?.user?.email) {
              console.log(`Could not get email for user ${targetUser.user_id}`);
              continue;
            }

            const html = getEmailTemplate(title, message);

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

            if (emailResponse.ok) {
              emailsSent++;
            } else {
              const errorData = await emailResponse.text();
              console.error(`Failed to send email to ${userData.user.email}:`, errorData);
            }
          }
        } catch (emailError) {
          console.error(`Error sending email to user ${targetUser.user_id}:`, emailError);
        }
      }
      
      console.log(`Sent ${emailsSent} emails`);
    } else {
      console.log("RESEND_API_KEY not configured, skipping email notifications");
    }

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
      target_user_id: user.id, // Self-reference for mass actions
      metadata: {
        title,
        target_audience: targetAudience,
        recipient_count: insertedCount,
        emails_sent: emailsSent,
      },
    });

    console.log(`Mass notification sent successfully to ${insertedCount} users, ${emailsSent} emails sent`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        recipientCount: insertedCount,
        emailsSent,
        message: `Notification sent to ${insertedCount} users (${emailsSent} emails)` 
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
