import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

serve(async (req) => {
  const url = new URL(req.url);
  const logId = url.searchParams.get("log_id");
  const to = url.searchParams.get("to") || "https://etherbylcove.com";
  try {
    if (logId) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      const nowIso = new Date().toISOString();
      await admin.from("notification_logs")
        .update({ status: "clicked", clicked_at: nowIso, opened_at: nowIso })
        .eq("id", logId);
    }
  } catch (_) {}
  // Validate destination is http(s)
  let dest = to;
  try {
    const u = new URL(to);
    if (u.protocol !== "https:" && u.protocol !== "http:") dest = "https://etherbylcove.com";
  } catch {
    dest = "https://etherbylcove.com";
  }
  return new Response(null, {
    status: 302,
    headers: { Location: dest, "Cache-Control": "no-store" },
  });
});
