import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { eventId, format: flyerFormat = "story" } = await req.json();
    if (!eventId) throw new Error("Missing eventId");

    // Check cache
    const { data: cached } = await supabaseAdmin
      .from("event_flyers")
      .select("flyer_url")
      .eq("event_id", eventId)
      .eq("format", flyerFormat)
      .maybeSingle();

    if (cached?.flyer_url) {
      return new Response(JSON.stringify({ flyer_url: cached.flyer_url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch event data
    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id, title, start_date, end_date, venue, city, state, image_url, description")
      .eq("id", eventId)
      .single();

    if (eventError || !event) throw new Error("Event not found");

    const eventDate = new Date(event.start_date);
    const dateStr = eventDate.toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
    const timeStr = eventDate.toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit",
    });
    const location = [event.venue, event.city, event.state].filter(Boolean).join(", ") || "Location TBA";
    const eventUrl = `https://etherbylcove.com/event/${eventId}`;

    // Determine dimensions
    const isStory = flyerFormat === "story";
    const width = isStory ? 1080 : 1200;
    const height = isStory ? 1920 : 630;

    // Generate SVG flyer
    const bgImageTag = event.image_url
      ? `<image href="${event.image_url}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" />`
      : "";

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="overlay" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.1)"/>
      <stop offset="40%" stop-color="rgba(0,0,0,0.3)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.85)"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#e91e8c"/>
      <stop offset="100%" stop-color="#ff6b6b"/>
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="#0f0f1a"/>
  ${bgImageTag}
  <rect width="${width}" height="${height}" fill="url(#overlay)"/>
  
  <!-- Accent bar -->
  <rect x="${isStory ? 80 : 60}" y="${isStory ? 1300 : 280}" width="60" height="4" fill="url(#accent)" rx="2"/>
  
  <!-- Title -->
  <text x="${isStory ? 80 : 60}" y="${isStory ? 1380 : 340}" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="${isStory ? 72 : 36}" font-weight="800" letter-spacing="-1">
    ${escSvg(event.title.length > 40 ? event.title.slice(0, 40) + "…" : event.title)}
  </text>
  
  <!-- Date -->
  <text x="${isStory ? 80 : 60}" y="${isStory ? 1460 : 390}" fill="rgba(255,255,255,0.9)" font-family="system-ui, sans-serif" font-size="${isStory ? 36 : 20}" font-weight="500">
    📅  ${escSvg(dateStr)} at ${escSvg(timeStr)}
  </text>
  
  <!-- Location -->
  <text x="${isStory ? 80 : 60}" y="${isStory ? 1520 : 430}" fill="rgba(255,255,255,0.8)" font-family="system-ui, sans-serif" font-size="${isStory ? 32 : 18}" font-weight="400">
    📍  ${escSvg(location.length > 50 ? location.slice(0, 50) + "…" : location)}
  </text>
  
  <!-- RSVP CTA -->
  <rect x="${isStory ? 80 : 60}" y="${isStory ? 1600 : 470}" width="${isStory ? 400 : 220}" height="${isStory ? 70 : 45}" rx="${isStory ? 35 : 22}" fill="url(#accent)"/>
  <text x="${isStory ? 280 : 170}" y="${isStory ? 1645 : 498}" fill="white" font-family="system-ui, sans-serif" font-size="${isStory ? 28 : 16}" font-weight="700" text-anchor="middle">
    RSVP NOW
  </text>
  
  <!-- Branding -->
  <text x="${isStory ? 80 : 60}" y="${isStory ? 1760 : 600}" fill="rgba(255,255,255,0.5)" font-family="system-ui, sans-serif" font-size="${isStory ? 24 : 14}" font-weight="600" letter-spacing="3">
    ETHER by lcove
  </text>
  
  <!-- URL -->
  <text x="${isStory ? 80 : 60}" y="${isStory ? 1800 : 620}" fill="rgba(255,255,255,0.4)" font-family="system-ui, sans-serif" font-size="${isStory ? 20 : 12}">
    etherbylcove.com/event/${eventId.slice(0, 8)}…
  </text>
</svg>`;

    // Convert SVG to PNG using resvg-wasm (Deno compatible)
    // For now, return the SVG as data URL which can be rendered client-side
    const svgBase64 = btoa(unescape(encodeURIComponent(svg)));
    const flyerDataUrl = `data:image/svg+xml;base64,${svgBase64}`;

    // Store in media bucket as SVG
    const filePath = `event-flyers/${eventId}-${flyerFormat}.svg`;
    const svgBlob = new Blob([svg], { type: "image/svg+xml" });
    
    const { error: uploadError } = await supabaseAdmin.storage
      .from("media")
      .upload(filePath, svgBlob, { contentType: "image/svg+xml", upsert: true });

    let flyerUrl = flyerDataUrl;
    if (!uploadError) {
      const { data: publicUrl } = supabaseAdmin.storage.from("media").getPublicUrl(filePath);
      flyerUrl = publicUrl.publicUrl;

      // Cache in event_flyers table (upsert)
      await supabaseAdmin.from("event_flyers").upsert({
        event_id: eventId,
        flyer_url: flyerUrl,
        format: flyerFormat,
      }, { onConflict: "event_id" });
    }

    return new Response(JSON.stringify({ flyer_url: flyerUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[GENERATE-EVENT-FLYER] ERROR:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

function escSvg(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
