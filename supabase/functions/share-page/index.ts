import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://etherbylcove.com";
const SITE_NAME = "ETHER";
const DEFAULT_OG_IMAGE = `${SITE_URL}/favicon.png`;
const DEFAULT_DESCRIPTION = "View on ETHER – Creative Community OS";

function buildOgHtml(
  title: string,
  description: string,
  imageUrl: string,
  canonicalUrl: string,
  redirectUrl: string
): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}"/>
  <link rel="canonical" href="${esc(canonicalUrl)}"/>

  <!-- Open Graph -->
  <meta property="og:type" content="website"/>
  <meta property="og:site_name" content="${SITE_NAME}"/>
  <meta property="og:title" content="${esc(title)}"/>
  <meta property="og:description" content="${esc(description)}"/>
  <meta property="og:image" content="${esc(imageUrl)}"/>
  <meta property="og:url" content="${esc(canonicalUrl)}"/>

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${esc(title)}"/>
  <meta name="twitter:description" content="${esc(description)}"/>
  <meta name="twitter:image" content="${esc(imageUrl)}"/>

  <!-- Redirect real users -->
  <meta http-equiv="refresh" content="0;url=${esc(redirectUrl)}"/>
</head>
<body>
  <p>Redirecting to <a href="${esc(redirectUrl)}">${esc(title)}</a>…</p>
  <script>window.location.href=${JSON.stringify(redirectUrl)};</script>
</body>
</html>`;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Path after /share-page/ e.g. /share-page/e/uuid
  const pathParts = url.pathname.replace(/^\/share-page\/?/, "").split("/").filter(Boolean);

  // Also handle when invoked via functions/v1/share-page/...
  // Deno edge functions receive the path after the function name
  const type = pathParts[0]; // e, p, u
  const id = pathParts[1];

  if (!type || !id) {
    const html = buildOgHtml(
      SITE_NAME,
      DEFAULT_DESCRIPTION,
      DEFAULT_OG_IMAGE,
      SITE_URL,
      SITE_URL
    );
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let title = SITE_NAME;
  let description = DEFAULT_DESCRIPTION;
  let imageUrl = DEFAULT_OG_IMAGE;
  let canonicalUrl = SITE_URL;
  let redirectUrl = SITE_URL;

  try {
    if (type === "e") {
      // Event
      const { data } = await supabase
        .from("events")
        .select("title, description, image_url, is_public, venue, city")
        .eq("id", id)
        .maybeSingle();

      redirectUrl = `${SITE_URL}/event/${id}`;
      canonicalUrl = redirectUrl;

      if (data && data.is_public) {
        title = data.title || SITE_NAME;
        description = data.description
          ? data.description.slice(0, 155)
          : [data.venue, data.city].filter(Boolean).join(", ") || DEFAULT_DESCRIPTION;
        if (data.image_url) imageUrl = data.image_url;
      } else {
        title = "Event on ETHER";
        description = "Sign in to view this event";
      }
    } else if (type === "p") {
      // Project
      const { data } = await supabase
        .from("projects")
        .select("title, description, cover_image_url, status")
        .eq("id", id)
        .maybeSingle();

      redirectUrl = `${SITE_URL}/project/${id}`;
      canonicalUrl = redirectUrl;

      if (data && data.status !== "draft") {
        title = data.title || SITE_NAME;
        description = data.description
          ? data.description.slice(0, 155)
          : DEFAULT_DESCRIPTION;
        if (data.cover_image_url) imageUrl = data.cover_image_url;
      } else {
        title = "Project on ETHER";
        description = "Sign in to view this project";
      }
    } else if (type === "u") {
      // Profile
      const { data } = await supabase
        .from("profiles")
        .select("display_name, bio, avatar_url")
        .eq("user_id", id)
        .maybeSingle();

      redirectUrl = `${SITE_URL}/profile/${id}`;
      canonicalUrl = redirectUrl;

      if (data && data.display_name) {
        title = `${data.display_name} on ETHER`;
        description = data.bio ? data.bio.slice(0, 155) : `View ${data.display_name}'s profile on ETHER`;
        if (data.avatar_url) imageUrl = data.avatar_url;
      } else {
        title = "Profile on ETHER";
        description = "View this creator on ETHER";
      }
    }
  } catch (err) {
    console.error("share-page error:", err);
  }

  const html = buildOgHtml(title, description, imageUrl, canonicalUrl, redirectUrl);
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
  });
});
