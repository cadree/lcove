import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = "ETHER <notifications@etherbylcove.com>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyNewContentRequest {
  content_type: "project" | "event";
  content_id: string;
  title: string;
  description?: string;
  creator_name?: string;
}

const getEmailTemplate = (contentType: string, title: string, creatorName?: string) => {
  const isProject = contentType === "project";
  const color = isProject ? "#4CAF50" : "#FF9800";
  const icon = isProject ? "🚀" : "📅";
  const url = isProject ? "https://etherbylcove.com/projects" : "https://etherbylcove.com/calendar";

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
                      <span style="color: white; font-size: 24px;">${icon}</span>
                    </div>
                    <h1 style="color: #ffffff; font-size: 24px; margin: 0 0 16px; font-weight: 600;">
                      New ${isProject ? "Project" : "Event"} Posted
                    </h1>
                    <p style="color: #ffffff; font-size: 20px; font-weight: 600; margin: 0 0 10px;">
                      ${title}
                    </p>
                    ${creatorName ? `<p style="color: #a0a0a0; font-size: 14px; margin: 0 0 30px;">by ${creatorName}</p>` : ""}
                    <a href="${url}" 
                       style="display: inline-block; background: ${color}; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                      View ${isProject ? "Project" : "Event"}
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: #1f1a17; text-align: center;">
                    <p style="color: #666; font-size: 12px; margin: 0;">
                      ETHER Creative Collective
                    </p>
                    <p style="color: #555; font-size: 11px; margin: 8px 0 0;">
                      You're receiving this because you opted in to new ${isProject ? "project" : "event"} notifications.
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

    const { content_type, content_id, title, description, creator_name }: NotifyNewContentRequest = await req.json();

    console.log(`Notifying users of new ${content_type}:`, title);

    // Determine which preference column to check
    const prefColumn = content_type === "project" ? "new_projects_enabled" : "new_events_enabled";

    // Get all users who have opted in to this notification type
    const { data: optedInUsers, error: usersError } = await supabase
      .from("notification_preferences")
      .select("user_id")
      .eq(prefColumn, true);

    if (usersError) {
      console.error("Error fetching opted-in users:", usersError);
      throw usersError;
    }

    if (!optedInUsers || optedInUsers.length === 0) {
      console.log("No users opted in for this notification type");
      return new Response(
        JSON.stringify({ message: "No opted-in users", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${optedInUsers.length} users opted in for ${content_type} notifications`);

    const notificationTitle = content_type === "project" 
      ? `New Project: ${title}` 
      : `New Event: ${title}`;
    const notificationBody = description 
      ? description.substring(0, 100) + (description.length > 100 ? "..." : "")
      : `${creator_name ? `Posted by ${creator_name}` : "Check it out!"}`;
    const notificationType = content_type === "project" ? "project_invite" : "event_reminder";

    let sentCount = 0;
    const errors: string[] = [];

    // Process users in batches
    for (const { user_id } of optedInUsers) {
      try {
        // Get full preferences for this user
        const { data: prefs } = await supabase
          .from("notification_preferences")
          .select("*")
          .eq("user_id", user_id)
          .single();

        // Create in-app notification
        await supabase.from("notifications").insert({
          user_id,
          type: notificationType,
          title: notificationTitle,
          body: notificationBody,
          data: { 
            content_type,
            content_id,
            url: content_type === "project" ? "/projects" : "/calendar"
          }
        });

        // Send email if enabled
        if (prefs?.email_enabled && RESEND_API_KEY) {
          const { data: userData } = await supabase.auth.admin.getUserById(user_id);
          if (userData?.user?.email) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
              },
              body: JSON.stringify({
                from: EMAIL_FROM,
                to: [userData.user.email],
                subject: notificationTitle,
                html: getEmailTemplate(content_type, title, creator_name),
              }),
            });
          }
        }

        // Send push if enabled
        if (prefs?.push_enabled) {
          await supabase.functions.invoke("send-push-notification", {
            body: {
              user_id,
              title: notificationTitle,
              body: notificationBody,
              notification_type: notificationType,
              data: { content_id, url: content_type === "project" ? "/projects" : "/calendar" }
            }
          });
        }

        sentCount++;
      } catch (userError) {
        console.error(`Error notifying user ${user_id}:`, userError);
        errors.push(`${user_id}: ${String(userError)}`);
      }
    }

    console.log(`Notifications sent to ${sentCount}/${optedInUsers.length} users`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount, 
        total: optedInUsers.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-new-content:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
