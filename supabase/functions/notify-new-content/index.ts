import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jwtRole, jwtSubject, requireUserOrService } from "../_shared/require-caller.ts";
import { shouldNotifyCommunity } from "../_shared/project-collaborations.mjs";

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

const getEmailTemplate = (
  contentType: string,
  listingType: string,
  title: string,
  creatorName?: string,
) => {
  const isProject = contentType === "project";
  const label = listingType === "gig" ? "Gig" : isProject ? "Project" : "Event";
  const color = isProject ? "#4CAF50" : "#FF9800";
  const icon = listingType === "gig" ? "💼" : isProject ? "🚀" : "📅";
  const url = isProject ? "https://etherbylcove.com/projects" : "https://etherbylcove.com/calendar";
  const reason = isProject
    ? `You can turn off new ${label.toLowerCase()} emails in notification settings.`
    : "You're receiving this because you opted in to new event notifications.";

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
                      New ${label} Posted
                    </h1>
                    <p style="color: #ffffff; font-size: 20px; font-weight: 600; margin: 0 0 10px;">
                      ${title}
                    </p>
                    ${creatorName ? `<p style="color: #a0a0a0; font-size: 14px; margin: 0 0 30px;">by ${creatorName}</p>` : ""}
                    <a href="${url}" 
                       style="display: inline-block; background: ${color}; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                      View ${label}
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: #1f1a17; text-align: center;">
                    <p style="color: #666; font-size: 12px; margin: 0;">
                      ETHER Creative Collective
                    </p>
                    <p style="color: #555; font-size: 11px; margin: 8px 0 0;">
                      ${reason}
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

  const denied = requireUserOrService(req, corsHeaders);
  if (denied) return denied;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { content_type, content_id, title, description, creator_name }: NotifyNewContentRequest = await req.json();

    console.log(`Notifying users of new ${content_type}:`, title);

    let listingType: "project" | "gig" | "event" = content_type === "project" ? "project" : "event";
    let creatorId: string | null = null;

    if (content_type === "project") {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id, creator_id, is_private, listing_type, title")
        .eq("id", content_id)
        .maybeSingle();

      if (projectError) throw projectError;
      if (!project) {
        return new Response(JSON.stringify({ error: "Project not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const role = jwtRole(req.headers.get("Authorization"));
      const callerId = jwtSubject(req.headers.get("Authorization"));
      if (role !== "service_role" && project.creator_id !== callerId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      creatorId = project.creator_id;
      listingType = project.listing_type === "gig" ? "gig" : "project";
      if (project.is_private) {
        return new Response(
          JSON.stringify({ message: "Private projects are not announced", sent: 0 }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const prefColumn = listingType === "gig"
      ? "new_gigs_enabled"
      : content_type === "project"
        ? "new_projects_enabled"
        : "new_events_enabled";

    const { data: preferenceRows, error: usersError } = await supabase
      .from("notification_preferences")
      .select(`user_id, push_enabled, email_enabled, ${prefColumn}`);

    if (usersError) {
      console.error("Error fetching opted-in users:", usersError);
      throw usersError;
    }

    const optedInUsers = (preferenceRows ?? []).filter((row) => {
      if (content_type !== "project") return row[prefColumn] === true;
      return shouldNotifyCommunity({
        isPrivate: false,
        isCreator: row.user_id === creatorId,
        categoryEnabled: row[prefColumn],
      });
    });

    if (optedInUsers.length === 0) {
      console.log("No users left to notify for this content");
      return new Response(
        JSON.stringify({ message: "No recipients", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${optedInUsers.length} users for ${listingType} notifications`);

    const notificationTitle = listingType === "gig"
      ? `New Gig: ${title}`
      : content_type === "project"
        ? `New Project: ${title}`
        : `New Event: ${title}`;
    const notificationBody = description 
      ? description.substring(0, 100) + (description.length > 100 ? "..." : "")
      : `${creator_name ? `Posted by ${creator_name}` : "Check it out!"}`;
    const notificationType = content_type === "project" ? "project_invite" : "event_reminder";

    let sentCount = 0;
    const errors: string[] = [];

    // Process users in batches
    for (const prefs of optedInUsers) {
      const user_id = prefs.user_id;
      try {
        // Create in-app notification
        await supabase.from("notifications").insert({
          user_id,
          type: notificationType,
          title: notificationTitle,
          body: notificationBody,
          data: { 
            content_type,
            listing_type: listingType,
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
                html: getEmailTemplate(content_type, listingType, title, creator_name),
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
