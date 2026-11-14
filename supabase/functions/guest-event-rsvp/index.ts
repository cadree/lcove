import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requestRole } from "../_shared/require-caller.ts";
import { clientRateKey, GUEST_LIMITS, normalizeGuestEmail, normalizeGuestName } from "../_shared/guest-consumer.mjs";
import { httpStatusForError } from "../_shared/http-error.mjs";

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
    const role = requestRole(req);
    if (role !== "anon" && role !== "authenticated") {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const eventId = typeof body?.eventId === "string" ? body.eventId : "";
    const name = normalizeGuestName(body?.guestName);
    const email = normalizeGuestEmail(body?.guestEmail);
    const phone = typeof body?.guestPhone === "string" ? body.guestPhone.trim() : "";
    const campaignId = typeof body?.campaignId === "string" && body.campaignId ? body.campaignId : null;
    const nearbyConsent = body?.nearbyConsent === true;
    if (!eventId || !name || !email) {
      return json({ error: "name and email required" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const ipKey = await clientRateKey(req.headers);
    if (ipKey) {
      const { error: ipError } = await admin.rpc("consume_guest_quota", {
        p_action: "guest_rsvp_ip",
        p_key: ipKey,
        p_limit: GUEST_LIMITS.rsvpIpPerHour,
        p_window_seconds: 3600,
      });
      if (ipError) throw new Error(ipError.message);
    }

    const { data, error } = await admin.rpc("create_guest_event_rsvp", {
      p_event_id: eventId,
      p_guest_name: name,
      p_guest_email: email,
      p_guest_phone: phone || null,
      p_campaign_id: campaignId,
      p_nearby_consent: nearbyConsent,
    });
    if (error) throw new Error(error.message);

    return json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save RSVP";
    return json({ error: message }, httpStatusForError(error));
  }
});
