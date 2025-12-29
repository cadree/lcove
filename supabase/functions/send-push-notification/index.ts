import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushNotificationRequest {
  user_id: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  icon?: string;
  badge?: string;
  notification_type?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
    
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.error("VAPID keys not configured");
      return new Response(
        JSON.stringify({ error: "Push notifications not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { user_id, title, body, data, icon, badge, notification_type }: PushNotificationRequest = await req.json();

    console.log(`Sending push notification to user: ${user_id}, title: ${title}, type: ${notification_type}`);

    // Check if push notifications are enabled for this user
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (!prefs?.push_enabled) {
      console.log("Push notifications disabled for user:", user_id);
      return new Response(
        JSON.stringify({ message: "Push notifications disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this specific notification type is enabled
    if (notification_type) {
      const typePreferenceMap: Record<string, string> = {
        message: "messages_enabled",
        like: "likes_enabled",
        comment: "comments_enabled",
        project_invite: "project_invites_enabled",
        event_reminder: "event_reminders_enabled",
        live_stream: "live_streams_enabled",
        admin: "admin_enabled",
      };

      const prefKey = typePreferenceMap[notification_type];
      if (prefKey && prefs[prefKey] === false) {
        console.log(`Notification type ${notification_type} disabled for user:`, user_id);
        return new Response(
          JSON.stringify({ message: `${notification_type} notifications disabled` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get all push subscriptions for this user
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("No push subscriptions found for user:", user_id);
      return new Response(
        JSON.stringify({ message: "No push subscriptions" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const notificationType = notification_type || 'general';
    
    // Build push payload with Instagram-like experience
    const payload = JSON.stringify({
      title,
      body: body || "",
      icon: icon || "/favicon.png",
      badge: badge || "/favicon.png",
      tag: `ether-${notificationType}-${Date.now()}`,
      renotify: true,
      requireInteraction: notificationType === 'message' || notificationType === 'project_invite',
      data: { 
        url: "/notifications", 
        type: notificationType,
        ...data 
      },
      vibrate: [200, 100, 200, 100, 200],
      timestamp: Date.now(),
    });

    const results: { endpoint: string; status: string; error?: string }[] = [];
    const expiredEndpoints: string[] = [];

    // Send to all subscriptions using simple POST
    // Note: For production, you should use the web-push npm package via Deno
    // This simple approach works for testing
    for (const sub of subscriptions) {
      try {
        const response = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "TTL": "86400",
            "Urgency": "normal",
          },
          body: payload,
        });

        if (response.status === 201 || response.status === 200) {
          console.log(`Push sent successfully to endpoint: ${sub.endpoint.substring(0, 50)}...`);
          results.push({ endpoint: sub.endpoint, status: "sent" });
        } else if (response.status === 410 || response.status === 404) {
          // Subscription expired or invalid
          console.log(`Subscription expired: ${sub.endpoint.substring(0, 50)}...`);
          expiredEndpoints.push(sub.endpoint);
          results.push({ endpoint: sub.endpoint, status: "expired" });
        } else {
          const errorText = await response.text();
          console.error(`Push failed: ${response.status} - ${errorText}`);
          results.push({ endpoint: sub.endpoint, status: "failed", error: `${response.status}: ${errorText}` });
        }
      } catch (error) {
        console.error(`Error sending to endpoint: ${error}`);
        results.push({ endpoint: sub.endpoint, status: "error", error: String(error) });
      }
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
      console.log(`Cleaned up ${expiredEndpoints.length} expired subscriptions`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: results.filter(r => r.status === "sent").length,
        total: subscriptions.length,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending push notification:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});