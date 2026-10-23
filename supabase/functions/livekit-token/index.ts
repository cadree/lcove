import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  LIVE_VIDEO_NOT_CONFIGURED,
  isStreamRoomName,
  liveKitVideoGrant,
  readLiveKitConfig,
  signLiveKitToken,
} from "../_shared/livekit-access.mjs";

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
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

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
      .select("id, host_id")
      .eq("id", streamId)
      .maybeSingle();
    if (streamError || !stream?.host_id) return json({ error: "Stream not found" }, 404);

    const video = liveKitVideoGrant(user.id, stream.host_id, stream.id);
    const signed = await signLiveKitToken({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      identity: user.id,
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
