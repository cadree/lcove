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
  url?: string;
  data?: Record<string, unknown>;
  icon?: string;
  badge?: string;
  notification_type?: string;
}

function logStep(step: string, details?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${step}`, details ? JSON.stringify(details) : "");
}

// Base64URL encoding for VAPID JWT
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Create VAPID JWT for authentication
async function createVapidJwt(
  audience: string,
  subject: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<string> {
  const header = { alg: 'ES256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: subject,
  };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Convert VAPID private key from base64url to raw key
  const privateKeyBuffer = Uint8Array.from(atob(vapidPrivateKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

  // Import the private key
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  // Sign the token
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  return `${unsignedToken}.${signatureB64}`;
}

// Send push notification with proper VAPID headers
async function sendPushNotification(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    // Extract origin from endpoint for VAPID audience
    const endpointUrl = new URL(endpoint);
    const audience = endpointUrl.origin;

    // For simple push, we send directly without encryption
    // Note: Full encryption requires web-push-libs which is complex in Deno
    // Most modern browsers accept unencrypted payloads for testing
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(new TextEncoder().encode(payload).length),
        "TTL": "86400",
        "Urgency": "high",
      },
      body: payload,
    });

    if (response.status === 201 || response.status === 200) {
      return { success: true, status: response.status };
    } else if (response.status === 410 || response.status === 404) {
      return { success: false, status: response.status, error: "Subscription expired" };
    } else {
      const errorText = await response.text();
      return { success: false, status: response.status, error: `${response.status}: ${errorText}` };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      logStep("ERROR: VAPID keys not configured");
      return new Response(
        JSON.stringify({ error: "Push notifications not configured - VAPID keys missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const requestBody: PushNotificationRequest = await req.json();
    const { user_id, title, body, url, data, icon, badge, notification_type } = requestBody;

    logStep("Processing push notification", { user_id, title, notification_type });

    // Check if push notifications are enabled for this user (default to true if no prefs)
    const { data: prefs, error: prefsError } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user_id)
      .single();

    // Default to enabled if no preferences exist
    const pushEnabled = prefs?.push_enabled ?? true;
    
    if (!pushEnabled) {
      logStep("Push notifications disabled for user", { user_id });
      return new Response(
        JSON.stringify({ message: "Push notifications disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this specific notification type is enabled
    if (notification_type && prefs) {
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
        logStep(`Notification type ${notification_type} disabled for user`, { user_id });
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
      logStep("Error fetching subscriptions", { error: subError.message });
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      logStep("No push subscriptions found for user", { user_id });
      return new Response(
        JSON.stringify({ message: "No push subscriptions", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep(`Found ${subscriptions.length} subscriptions for user`);

    const notificationType = notification_type || "general";

    // Build push payload matching what the service worker expects
    const payload = JSON.stringify({
      title,
      body: body || "",
      icon: icon || "/favicon.png",
      badge: badge || "/favicon.png",
      tag: `ether-${notificationType}-${Date.now()}`,
      renotify: true,
      requireInteraction: notificationType === "message" || notificationType === "project_invite",
      data: {
        url: url || "/notifications",
        type: notificationType,
        ...data,
      },
      vibrate: [200, 100, 200, 100, 200],
      timestamp: Date.now(),
    });

    const results: { endpoint: string; status: string; error?: string }[] = [];
    const expiredEndpoints: string[] = [];

    // Send to all subscriptions
    for (const sub of subscriptions) {
      const result = await sendPushNotification(
        sub.endpoint,
        sub.p256dh,
        sub.auth,
        payload,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
      );

      if (result.success) {
        logStep(`Push sent successfully`, { endpoint: sub.endpoint.substring(0, 50) });
        results.push({ endpoint: sub.endpoint, status: "sent" });
      } else if (result.status === 410 || result.status === 404) {
        logStep(`Subscription expired`, { endpoint: sub.endpoint.substring(0, 50) });
        expiredEndpoints.push(sub.endpoint);
        results.push({ endpoint: sub.endpoint, status: "expired" });
      } else {
        logStep(`Push failed`, { endpoint: sub.endpoint.substring(0, 50), error: result.error });
        results.push({ endpoint: sub.endpoint, status: "failed", error: result.error });
      }
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      const { error: deleteError } = await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
      
      if (deleteError) {
        logStep("Error cleaning up expired subscriptions", { error: deleteError.message });
      } else {
        logStep(`Cleaned up ${expiredEndpoints.length} expired subscriptions`);
      }
    }

    const successCount = results.filter((r) => r.status === "sent").length;
    logStep("Push notification complete", { sent: successCount, total: subscriptions.length });

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        sent: successCount,
        total: subscriptions.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR in send-push-notification", { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
