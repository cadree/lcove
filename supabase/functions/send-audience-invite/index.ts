import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: any) =>
  console.log(`[SEND-AUDIENCE-INVITE] ${s}${d ? " - " + JSON.stringify(d) : ""}`);

interface Body {
  eventId?: string;
  title: string;
  body: string;
  channels?: { push?: boolean; email?: boolean; sms?: boolean };
  filter: {
    cities?: string[];
    states?: string[];
    countries?: string[];
    interests?: string[];
    passions?: string[];
    genders?: string[];
    age_min?: number | null;
    age_max?: number | null;
    active_only?: boolean;
  };
  lookalike?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization required");
    const { data: { user }, error: ue } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (ue || !user) throw new Error("Not authenticated");

    const body: Body = await req.json();
    if (!body.title || !body.body) throw new Error("Missing fields");

    let filter = { ...body.filter };

    // Lookalike: union with interests/passions of current attendees of this event
    if (body.lookalike && body.eventId) {
      const { data: attendees } = await admin.from("event_attendees")
        .select("attendee_user_id").eq("event_id", body.eventId)
        .not("attendee_user_id", "is", null).limit(500);
      const userIds = (attendees || []).map(a => a.attendee_user_id).filter(Boolean) as string[];
      if (userIds.length > 0) {
        const { data: profiles } = await admin.from("profiles")
          .select("interests").in("user_id", userIds);
        const interestSet = new Set<string>(filter.interests || []);
        (profiles || []).forEach(p => (p.interests || []).forEach((i: string) => interestSet.add(i)));
        filter.interests = Array.from(interestSet);
      }
    }

    // Resolve audience: replicate get_audience_estimate logic but return user_ids
    const currentYear = new Date().getFullYear();
    let q = admin.from("profiles").select("user_id, display_name, phone, last_active_at, interests, gender, birth_year, city, city_key, region_state, region_country").eq("access_status", "active");
    if (filter.cities?.length) q = q.in("city_key", filter.cities.map(c => c.toLowerCase()));
    if (filter.states?.length) q = q.in("region_state", filter.states);
    if (filter.countries?.length) q = q.in("region_country", filter.countries);
    if (filter.genders?.length) q = q.in("gender", filter.genders);
    if (filter.interests?.length) q = q.overlaps("interests", filter.interests);
    if (filter.active_only) q = q.gte("last_active_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const { data: profilesRaw } = await q.limit(5000);
    let profiles = profilesRaw || [];

    if (filter.age_min != null) profiles = profiles.filter(p => !p.birth_year || (currentYear - p.birth_year) >= filter.age_min!);
    if (filter.age_max != null) profiles = profiles.filter(p => !p.birth_year || (currentYear - p.birth_year) <= filter.age_max!);

    if (filter.passions?.length) {
      const { data: ups } = await admin.from("user_passions").select("user_id, passions(name)").in("user_id", profiles.map(p => p.user_id));
      const matchedIds = new Set((ups || []).filter((u: any) => filter.passions!.includes(u.passions?.name)).map((u: any) => u.user_id));
      profiles = profiles.filter(p => matchedIds.has(p.user_id));
    }

    const channels = body.channels || { push: true, email: true, sms: false };
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const eventUrl = body.eventId ? `https://etherbylcove.com/event/${body.eventId}` : "https://etherbylcove.com";

    const { data: campaign } = await admin.from("notification_campaigns").insert({
      host_user_id: user.id,
      event_id: body.eventId || null,
      type: "invite",
      title: body.title, body: body.body,
      channels: Object.entries(channels).filter(([_, v]) => v).map(([k]) => k),
      audience_filter: filter,
      recipient_count: profiles.length,
    }).select().single();

    let sentCount = 0;
    for (const p of profiles) {
      const firstName = (p.display_name || "there").split(" ")[0];
      const finalTitle = body.title.replaceAll("{first_name}", firstName);
      const finalBody = body.body.replaceAll("{first_name}", firstName);

      const logRow = (channel: string, status: string, error?: string) =>
        admin.from("notification_logs").insert({
          campaign_id: campaign?.id || null,
          host_user_id: user.id, user_id: p.user_id,
          event_id: body.eventId || null, type: "invite", channel, status,
          error_message: error || null,
          sent_at: status === "sent" ? new Date().toISOString() : null,
        });

      // In-app
      await admin.from("notifications").insert({
        user_id: p.user_id, type: "audience_invite",
        title: finalTitle, body: finalBody,
        data: { event_id: body.eventId || null },
      });
      await logRow("in_app", "sent");

      // Push
      if (channels.push) {
        try {
          await admin.functions.invoke("send-push-notification", {
            body: { user_id: p.user_id, title: finalTitle, body: finalBody, url: body.eventId ? `/event/${body.eventId}` : "/" },
          });
          await logRow("push", "sent");
          sentCount++;
        } catch (e) { await logRow("push", "failed", String(e)); }
      }

      // Email
      if (channels.email && resendKey) {
        const { data: u } = await admin.auth.admin.getUserById(p.user_id);
        const email = u?.user?.email;
        if (email) {
          try {
            const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <h1 style="color:#1a1a2e;">${finalTitle}</h1>
              <p style="color:#555;line-height:1.6;">${finalBody.replace(/\n/g, "<br/>")}</p>
              <a href="${eventUrl}" style="display:inline-block;background:#e91e8c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;">Check it out</a>
            </div>`;
            const r = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ from: "notifications@etherbylcove.com", to: [email], subject: finalTitle, html }),
            });
            if (r.ok) { await logRow("email", "sent"); sentCount++; }
            else await logRow("email", "failed", `${r.status}`);
          } catch (e) { await logRow("email", "failed", String(e)); }
        }
      }

      await new Promise(r => setTimeout(r, 60));
    }

    if (campaign?.id) {
      await admin.from("notification_campaigns").update({ sent_count: sentCount }).eq("id", campaign.id);
    }

    log("Done", { audience: profiles.length, sentCount });
    return new Response(JSON.stringify({ success: true, recipientCount: profiles.length, sentCount, campaignId: campaign?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
