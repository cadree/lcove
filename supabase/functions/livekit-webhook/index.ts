import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  LIVE_VIDEO_NOT_CONFIGURED,
  liveKitRoomUpdate,
  readLiveKitConfig,
  verifyLiveKitWebhook,
} from "../_shared/livekit-access.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const config = readLiveKitConfig({
    LIVEKIT_URL: Deno.env.get("LIVEKIT_URL"),
    LIVEKIT_API_KEY: Deno.env.get("LIVEKIT_API_KEY"),
    LIVEKIT_API_SECRET: Deno.env.get("LIVEKIT_API_SECRET"),
  });
  if (!config) return json({ configured: false, error: LIVE_VIDEO_NOT_CONFIGURED });

  const body = await req.text();
  let event: { event?: string; room?: { name?: string; numParticipants?: number } };
  try {
    event = await verifyLiveKitWebhook(
      body,
      req.headers.get("Authorization"),
      config.apiKey,
      config.apiSecret,
    );
  } catch (error) {
    console.error("livekit-webhook rejected", error instanceof Error ? error.message : "unknown");
    return json({ error: "Unauthorized" }, 401);
  }

  const update = liveKitRoomUpdate(event);
  if (!update) return json({ ok: true, ignored: true });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  if (update.patch.started_at) {
    const { data: existing } = await admin
      .from("live_streams")
      .select("started_at")
      .eq("id", update.streamId)
      .maybeSingle();
    if (existing?.started_at) delete update.patch.started_at;
  }

  const { error } = await admin.from("live_streams").update(update.patch).eq("id", update.streamId);
  if (error) {
    console.error("livekit-webhook update failed", error.message);
    return json({ error: "Could not update the stream" }, 500);
  }

  return json({ ok: true });
});
