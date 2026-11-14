const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^[0-9]{6,12}$/;
const VIMEO_HASH = /^[A-Za-z0-9]{4,64}$/;

const PLAYER_HOSTS = [
  "https://www.youtube-nocookie.com/embed/",
  "https://player.vimeo.com/video/",
];

/**
 * Cloudflare Pages Function for /embed/player.
 * The Capacitor app iframes this https page. The page then iframes
 * youtube-nocookie or the Vimeo player, so YouTube sees an https referrer
 * instead of capacitor://localhost (player error 153).
 * Query keys are provider, id, and optional h. Anything else is a 400.
 */
export function innerPlayerSrc(pageUrl) {
  const provider = pageUrl.searchParams.get("provider");
  const id = pageUrl.searchParams.get("id") || "";
  const hash = pageUrl.searchParams.get("h");

  if (provider === "youtube" && YOUTUBE_ID.test(id) && !hash) {
    const params = new URLSearchParams({ rel: "0", playsinline: "1" });
    if (pageUrl.protocol === "https:") params.set("origin", pageUrl.origin);
    return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
  }

  if (provider === "vimeo" && VIMEO_ID.test(id) && (!hash || VIMEO_HASH.test(hash))) {
    const params = new URLSearchParams({
      dnt: "1",
      playsinline: "1",
      title: "0",
      byline: "0",
      portrait: "0",
    });
    if (hash) params.set("h", hash);
    return `https://player.vimeo.com/video/${id}?${params.toString()}`;
  }

  return null;
}

function pageHtml(src, title) {
  const allowed = PLAYER_HOSTS.some((host) => src.startsWith(host));
  if (!allowed || /["'<>\s]/.test(src)) return null;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${title}</title>
<style>html,body{margin:0;height:100%;background:#000}iframe{position:absolute;inset:0;border:0;width:100%;height:100%}</style>
</head>
<body>
<iframe src="${src}" title="${title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
</body>
</html>`;
}

const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy":
    "default-src 'none'; style-src 'unsafe-inline'; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; base-uri 'none'; form-action 'none'",
  "x-content-type-options": "nosniff",
  "cache-control": "public, max-age=300",
};

export function embedPageResponse(pageUrl) {
  const src = innerPlayerSrc(pageUrl);
  const title = pageUrl.searchParams.get("provider") === "vimeo" ? "Vimeo video" : "YouTube video";
  const html = src ? pageHtml(src, title) : null;
  if (!html) {
    return new Response("Only a YouTube or Vimeo video can be embedded.", {
      status: 400,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "referrer-policy": "strict-origin-when-cross-origin",
        "x-content-type-options": "nosniff",
        "cache-control": "no-store",
      },
    });
  }
  return new Response(html, { status: 200, headers: HTML_HEADERS });
}

export function onRequestGet(context) {
  return embedPageResponse(new URL(context.request.url));
}
