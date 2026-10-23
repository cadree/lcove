import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ApplicationServer, importVapidKeys, Urgency, type ExportedVapidKeys } from "jsr:@negrel/webpush";
import { getBearerUser, jwtRole, requireUserOrService } from "../_shared/require-caller.ts";
import { noticeForUser } from "../_shared/notification-auth.mjs";
import { httpStatusForError } from "../_shared/http-error.mjs";

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

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** web-push prints raw base64url keys. @negrel/webpush imports JWK. */
async function loadVapidKeys(publicKey: string, privateKey: string) {
  const pub = publicKey.trim();
  const priv = privateKey.trim();
  if (pub.startsWith("{") && priv.startsWith("{")) {
    return importVapidKeys({
      publicKey: JSON.parse(pub),
      privateKey: JSON.parse(priv),
    } as ExportedVapidKeys);
  }
  const publicBytes = base64UrlToBytes(pub);
  const privateBytes = base64UrlToBytes(priv);
  if (publicBytes.length !== 65 || publicBytes[0] !== 4 || privateBytes.length !== 32) {
    throw new Error("VAPID keys must be the base64url pair from `npx web-push generate-vapid-keys`");
  }
  const x = bytesToBase64Url(publicBytes.slice(1, 33));
  const y = bytesToBase64Url(publicBytes.slice(33, 65));
  const d = bytesToBase64Url(privateBytes);
  return importVapidKeys({
    publicKey: { kty: "EC", crv: "P-256", x, y },
    privateKey: { kty: "EC", crv: "P-256", x, y, d },
  });
}

function logStep(step: string, details?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${step}`, details ? JSON.stringify(details) : "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const denied = requireUserOrService(req, corsHeaders);
  if (denied) return denied;

  try {
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
    const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:push@ether.local";

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      logStep("ERROR: VAPID keys not configured");
      return new Response(
        JSON.stringify({ error: "Push notifications not configured - VAPID keys missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const vapidKeys = await loadVapidKeys(VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    const appServer = await ApplicationServer.new({
      contactInformation: VAPID_SUBJECT,
      vapidKeys,
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const requestBody: PushNotificationRequest = await req.json();
    const { user_id, notification_type } = requestBody;
    let { title, body, url, data, icon, badge } = requestBody;

    const role = jwtRole(req.headers.get("Authorization"));
    if (role !== "service_role") {
      const callerId = await getBearerUser(req.headers.get("Authorization"), supabase);
      const notice = await noticeForUser(supabase, {
        callerId,
        recipientId: user_id,
        notificationType: notification_type,
        data,
      });
      if (!notice.ok) {
        return new Response(JSON.stringify({ error: notice.error }), {
          status: notice.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      title = notice.title;
      body = notice.body;
      data = notice.data;
      url = undefined;
      icon = undefined;
      badge = undefined;
    }

    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: "user_id and title are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Processing push notification", { user_id, title, notification_type });

    const { data: prefs, error: prefsError } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (prefsError) throw prefsError;

    const pushEnabled = prefs?.push_enabled ?? true;
    if (!pushEnabled) {
      return new Response(
        JSON.stringify({ message: "Push notifications disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (notification_type && prefs) {
      const typePreferenceMap: Record<string, string> = {
        message: "messages_enabled",
        like: "likes_enabled",
        comment: "comments_enabled",
        follow: "follows_enabled",
        project_invite: "project_invites_enabled",
        event_reminder: "event_reminders_enabled",
        live_stream: "live_streams_enabled",
        admin: "admin_enabled",
      };
      const prefKey = typePreferenceMap[notification_type];
      if (prefKey && prefs[prefKey] === false) {
        return new Response(
          JSON.stringify({ message: `${notification_type} notifications disabled` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (subError) throw subError;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No push subscriptions", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const notificationType = notification_type || "general";
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
    });

    const results: { endpoint: string; status: string; error?: string }[] = [];
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions) {
      const endpoint = String(sub.endpoint ?? "");
      const platform = String(sub.platform ?? "web");
      if (platform === "apns" || !endpoint.startsWith("https://")) {
        results.push({ endpoint, status: "skipped" });
        continue;
      }

      try {
        const subscription = appServer.subscribe({
          endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        });
        await subscription.pushTextMessage(payload, { ttl: 86400, urgency: Urgency.High });
        results.push({ endpoint, status: "sent" });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 410 || status === 404) {
          expiredEndpoints.push(endpoint);
          results.push({ endpoint, status: "expired" });
        } else {
          logStep("Push failed", { endpoint: endpoint.slice(0, 50), error: message });
          results.push({ endpoint, status: "failed", error: message });
        }
      }
    }

    if (expiredEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }

    const successCount = results.filter((result) => result.status === "sent").length;
    return new Response(
      JSON.stringify({
        success: successCount > 0,
        sent: successCount,
        total: subscriptions.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR in send-push-notification", { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: httpStatusForError(error), headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
