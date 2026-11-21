import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  LIVE_VIDEO_NOT_CONFIGURED,
  isStreamRoomName,
  liveKitVideoGrant,
  readLiveKitConfig,
  signLiveKitToken,
} from "../_shared/livekit-access.mjs";
import { requestRole } from "../_shared/require-caller.ts";
import { clientRateKey, GUEST_LIMITS, watchableStream } from "../_shared/guest-consumer.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: authData } = await admin.auth.getUser(token);
    const user = authData?.user ?? null;
    const role = requestRole(req);
    if (!user && role !== "anon") return json({ error: "Unauthorized" }, 401);

    const config = readLiveKitConfig({
      LIVEKIT_URL: Deno.env.get("LIVEKIT_URL"),
      LIVEKIT_API_KEY: Deno.env.get("LIVEKIT_API_KEY"),
      LIVEKIT_API_SECRET: Deno.env.get("LIVEKIT_API_SECRET"),
    });
    if (!config) return json({ configured: false, error: LIVE_VIDEO_NOT_CONFIGURED });

    const body = await req.json().catch(() => ({}));
    const streamId = typeof body?.streamId === "string" ? body.streamId : "";
    if (!isStreamRoomName(streamId)) return json({ error: "streamId required" }, 400);

    const { data: stream, error: streamError } = await admin
      .from("live_streams")
      .select("id, host_id, is_live, replay_available, replay_url, started_at, stream_type, external_url")
      .eq("id", streamId)
      .maybeSingle();
    if (streamError || !stream?.host_id) return json({ error: "Stream not found" }, 404);
    if (!user && !watchableStream(stream)) return json({ error: "Stream not found" }, 404);

    let identity = user?.id ?? "";
    if (!user) {
      const ipKey = await clientRateKey(req.headers);
      if (ipKey) {
        const { error: quotaError } = await admin.rpc("consume_guest_quota", {
          p_action: "guest_live_ip",
          p_key: ipKey,
          p_limit: GUEST_LIMITS.liveIpPerHour,
          p_window_seconds: 3600,
        });
        if (quotaError) return json({ error: "limit reached" }, 400);
      }
      identity = `guest-${crypto.randomUUID()}`;
    }

    const video = liveKitVideoGrant(identity, stream.host_id, stream.id);
    if (!user) video.canPublish = false;
    const signed = await signLiveKitToken({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      identity,
      video,
    });

    return json({
      configured: true,
      url: config.url,
      token: signed.token,
      room: stream.id,
      canPublish: video.canPublish,
    });
  } catch (error) {
    console.error("livekit-token failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Could not start live video" }, 500);
  }
});
