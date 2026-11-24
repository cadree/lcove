import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { canDownloadMusic } from "../_shared/music-download.mjs";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { headers, status });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const authorization = req.headers.get("Authorization") || "";
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: auth, error: authError } = await client.auth.getUser(authorization.replace(/^Bearer /i, ""));
    if (authError || !auth.user) return reply({ error: "Sign in to download music" }, 401);
    const { track_id } = await req.json();
    if (typeof track_id !== "string" || !/^[a-f0-9-]{36}$/i.test(track_id)) return reply({ error: "Invalid track" }, 400);
    // Read with the caller's JWT so membership and row permissions still apply.
    const { data: track, error: trackError } = await client.from("exclusive_tracks")
      .select("id, title, access_type, allow_downloads, audio_file_path, artist_user_id").eq("id", track_id).maybeSingle();
    if (trackError) throw trackError;
    if (!track) return reply({ error: "Track not found" }, 404);
    const { data: purchases, error: purchaseError } = await client.from("exclusive_track_purchases")
      .select("track_id, buyer_user_id, payment_status, amount_cents")
      .eq("track_id", track_id).eq("buyer_user_id", auth.user.id)
      .eq("payment_status", "paid").gt("amount_cents", 0).limit(1);
    if (purchaseError) throw purchaseError;
    if (!canDownloadMusic(track, purchases?.[0], auth.user.id)) {
      return reply({ error: "Downloads require a completed purchase and the artist's permission." }, 403);
    }
    if (!track.audio_file_path || !track.audio_file_path.startsWith(`${track.artist_user_id}/`)) {
      return reply({ error: "Download unavailable for this track" }, 404);
    }
    const extension = /\.([a-z0-9]{2,5})$/i.exec(track.audio_file_path)?.[1] || "mp3";
    // eslint-disable-next-line no-control-regex -- Strip control bytes and path separators from the attachment name.
    const filename = `${track.title.replace(/[\x00-\x1f/\\]/g, "_").slice(0, 120)}.${extension}`;
    const { data, error } = await client.storage.from("music-private")
      .createSignedUrl(track.audio_file_path, 60, { download: filename });
    if (error) throw error;
    return reply({ url: data.signedUrl, filename });
  } catch (error) {
    console.error("[MUSIC-DOWNLOAD] Failed", error instanceof Error ? error.message : "Unknown error");
    return reply({ error: "Could not start the download. Try again." }, 500);
  }
});
