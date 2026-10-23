import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const PIXEL = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
  (char) => char.charCodeAt(0),
);

function safeDestination(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const allowed = host === "etherbylcove.com" || host.endsWith(".etherbylcove.com") || host === "localhost" || host === "127.0.0.1";
    if ((url.protocol === "https:" || url.protocol === "http:") && allowed) return url.toString();
  } catch {
    return fallback;
  }
  return fallback;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("k");
  const kind = url.searchParams.get("e") === "click" ? "click" : "open";
  const fallback = "https://etherbylcove.com";

  if (token) {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data } = await admin.rpc("record_notification_engagement", {
      p_token: token,
      p_kind: kind,
    });
    if (kind === "click") {
      const stored = data && typeof data === "object" && "url" in data ? String(data.url || "") : "";
      const target = safeDestination(url.searchParams.get("u") || stored, fallback);
      return Response.redirect(target, 302);
    }
  }

  return new Response(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  });
});
