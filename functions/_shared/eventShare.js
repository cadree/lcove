/** Event share links and crawler tags. No paid image host. */

export const EVENT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isEventUuid(value) {
  return EVENT_UUID.test(String(value || ""));
}

export function isEventSlug(value) {
  const slug = String(value || "");
  if (slug.length < 1 || slug.length > 80) return false;
  if (isEventUuid(slug)) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/** Same rules as public.slugify_event_name. */
export function slugifyEventName(title) {
  const base = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "event";
}

export function eventIsShareable(event) {
  if (!event || event.is_public !== true) return false;
  const status = String(event.status || "").toLowerCase();
  return status !== "draft" && status !== "cancelled";
}

export function eventPublicPath(event) {
  const id = event?.id || "";
  if (eventIsShareable(event) && event.slug && isEventSlug(event.slug)) return `/e/${event.slug}`;
  return id ? `/event/${id}` : "/calendar";
}

export function eventPublicUrl(event, origin = "https://etherbylcove.com") {
  const base = String(origin || "https://etherbylcove.com").replace(/\/$/, "");
  return `${base}${eventPublicPath(event)}`;
}

export function formatShareWhen(iso, timeZone) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const zone = timeZone && String(timeZone).trim() ? String(timeZone).trim() : "UTC";
  try {
    const day = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(date);
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
    return `${day} · ${time}`;
  } catch {
    return "";
  }
}

export function eventShareDescription(input) {
  const host = String(input?.hostName || input?.host_name || "Host").replace(/\s+/g, " ").trim() || "Host";
  const when = formatShareWhen(input?.startDate || input?.start_date, input?.timeZone || input?.timezone);
  const place = String(input?.venue || input?.city || "").replace(/\s+/g, " ").trim();
  const text = [host, when, place].filter(Boolean).join(" · ");
  if (text.length <= 200) return text;
  return `${text.slice(0, 197)}...`;
}

export function flyerVersion(imageUrl) {
  let hash = 5381;
  const value = String(imageUrl || "");
  for (let i = 0; i < value.length; i += 1) hash = ((hash * 33) ^ value.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

export function eventReturnPath(value) {
  if (!value || typeof value !== "string") return null;
  let path = value.trim();
  if (!path) return null;
  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path.includes("://")) return null;
  const pathname = path.split("?")[0].split("#")[0];
  if (pathname.startsWith("/e/") || pathname.startsWith("/event/")) return path;
  return null;
}

export const EVENT_RETURN_KEY = "ether-event-return";

export function rememberEventReturn(value) {
  const path = eventReturnPath(value);
  if (!path || typeof sessionStorage === "undefined") return null;
  sessionStorage.setItem(EVENT_RETURN_KEY, path);
  return path;
}

export function takeEventReturn() {
  if (typeof sessionStorage === "undefined") return null;
  const path = eventReturnPath(sessionStorage.getItem(EVENT_RETURN_KEY));
  if (path) sessionStorage.removeItem(EVENT_RETURN_KEY);
  return path;
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function upsertMeta(html, attr, key, content) {
  const tag = `<meta ${attr}="${key}" content="${escapeHtml(content)}" />`;
  const pattern = new RegExp(`<meta\\s+[^>]*${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`, "i");
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace("</head>", `    ${tag}\n  </head>`);
}

function stripMeta(html, attr, key) {
  const pattern = new RegExp(`\\s*<meta\\s+[^>]*${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`, "gi");
  return html.replace(pattern, "");
}

export function safeImageUrl(value) {
  if (!value || typeof value !== "string") return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return null;
  if (host === "0.0.0.0" || host === "::1" || host === "metadata.google.internal") return null;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return null;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return null;
  if (/\/flyer\.jpg$/.test(url.pathname) || /\/icon\.png$/.test(url.pathname)) return null;
  return url.toString();
}

export function applyHiddenEventHtml(html) {
  return upsertMeta(html, "name", "robots", "noindex, nofollow");
}

export function applyEventShareHtml(html, card, origin) {
  const title = String(card.title || "Event").replace(/\s+/g, " ").trim() || "Event";
  const host = String(card.host_name || card.hostName || "Host").replace(/\s+/g, " ").trim() || "Host";
  const description = eventShareDescription({ ...card, hostName: host });
  const base = String(origin || "https://etherbylcove.com").replace(/\/$/, "");
  const canonical = `${base}/e/${card.slug}`;
  const version = flyerVersion(card.image_url);
  const image = card.image_url ? `${canonical}/flyer.jpg?v=${version}` : "";
  const icon = card.image_url ? `${canonical}/icon.png?v=${version}` : "";
  let next = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  next = upsertMeta(next, "name", "description", description);
  next = upsertMeta(next, "name", "robots", "index, follow");
  next = upsertMeta(next, "property", "og:title", title);
  next = upsertMeta(next, "property", "og:description", description);
  next = upsertMeta(next, "property", "og:type", "website");
  next = upsertMeta(next, "property", "og:url", canonical);
  next = upsertMeta(next, "property", "og:site_name", host);
  next = upsertMeta(next, "name", "twitter:card", "summary_large_image");
  next = upsertMeta(next, "name", "twitter:title", title);
  next = upsertMeta(next, "name", "twitter:description", description);
  if (image) {
    next = upsertMeta(next, "property", "og:image", image);
    next = upsertMeta(next, "property", "og:image:secure_url", image);
    next = upsertMeta(next, "property", "og:image:type", "image/jpeg");
    next = upsertMeta(next, "property", "og:image:width", "1200");
    next = upsertMeta(next, "property", "og:image:height", "630");
    next = upsertMeta(next, "property", "og:image:alt", title);
    next = upsertMeta(next, "name", "twitter:image", image);
    next = upsertMeta(next, "name", "twitter:image:alt", title);
    next = next.replace(/\s*<link rel="icon"[^>]*>/gi, "");
    next = next.replace(/\s*<link rel="apple-touch-icon"[^>]*>/gi, "");
    next = next.replace(
      "</head>",
      `    <link rel="icon" type="image/png" href="${escapeHtml(icon)}" sizes="180x180" />\n    <link rel="apple-touch-icon" href="${escapeHtml(icon)}" />\n  </head>`,
    );
  } else {
    next = stripMeta(next, "property", "og:image");
    next = stripMeta(next, "property", "og:image:width");
    next = stripMeta(next, "property", "og:image:height");
    next = stripMeta(next, "name", "twitter:image");
  }
  if (/<link rel="canonical"[^>]*>/i.test(next)) {
    next = next.replace(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonical)}" />`);
  } else {
    next = next.replace("</head>", `    <link rel="canonical" href="${escapeHtml(canonical)}" />\n  </head>`);
  }
  return next;
}

const SHARE_CACHE = "public, max-age=300";
const HIDDEN_CACHE = "public, max-age=60";

async function serveRef(url, ref, rest, deps, legacy) {
  if (rest && rest !== "flyer.jpg" && rest !== "icon.png" && rest.split("/").some((part) => part.includes("."))) {
    return { kind: "passthrough" };
  }
  const loaded = await deps.loadCard(ref);
  if (!loaded?.configured) return { kind: "passthrough" };
  const card = loaded.card;
  if (legacy && card?.slug && isEventSlug(card.slug)) {
    const dest = new URL(`/e/${card.slug}${rest ? `/${rest}` : ""}`, url.origin);
    dest.search = url.search;
    return { kind: "redirect", status: 301, location: dest.toString(), cache: "public, max-age=3600" };
  }
  if (!card) {
    if (rest === "flyer.jpg" || rest === "icon.png") return { kind: "empty", status: 404 };
    const html = applyHiddenEventHtml(await deps.loadHtml());
    return { kind: "html", status: 200, html, cache: HIDDEN_CACHE, robots: true };
  }
  if (rest === "flyer.jpg" || rest === "icon.png") {
    const kind = rest === "icon.png" ? "icon" : "flyer";
    const image = await deps.renderImage(card, kind);
    if (image?.bytes) {
      return {
        kind: "image",
        status: 200,
        bytes: image.bytes,
        contentType: image.contentType,
        cache: "public, max-age=86400",
      };
    }
    const fallback = safeImageUrl(card.image_url);
    if (fallback) return { kind: "redirect", status: 302, location: fallback, cache: "public, max-age=300" };
    return { kind: "empty", status: 404 };
  }
  const html = applyEventShareHtml(await deps.loadHtml(), card, url.origin);
  return { kind: "html", status: 200, html, cache: SHARE_CACHE, robots: false };
}

export async function routeEventShare(request, deps) {
  const url = new URL(request.url);
  const method = String(request.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return { kind: "passthrough" };
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "e" && parts[0] !== "event") return { kind: "passthrough" };
  let ref = "";
  try {
    ref = decodeURIComponent(parts[1] || "");
  } catch {
    return { kind: "passthrough" };
  }
  if (!ref || ref.includes("/") || ref.includes("\\") || ref.includes("..")) return { kind: "passthrough" };
  const rest = parts.slice(2).join("/");
  if (parts[0] === "event" || isEventUuid(ref)) {
    if (!isEventUuid(ref)) return { kind: "passthrough" };
    return serveRef(url, ref, rest, deps, true);
  }
  const slug = ref.toLowerCase();
  if (!isEventSlug(slug)) return { kind: "passthrough" };
  if (slug !== ref) {
    const dest = new URL(`/e/${slug}${rest ? `/${rest}` : ""}`, url.origin);
    dest.search = url.search;
    return { kind: "redirect", status: 301, location: dest.toString(), cache: "public, max-age=3600" };
  }
  return serveRef(url, slug, rest, deps, false);
}

export function shareResultResponse(result, method = "GET") {
  if (!result || result.kind === "passthrough") return null;
  const headers = new Headers();
  if (result.cache) headers.set("cache-control", result.cache);
  if (result.kind === "redirect") {
    headers.set("location", result.location);
    return new Response(null, { status: result.status || 301, headers });
  }
  if (result.kind === "empty") {
    headers.set("cache-control", "no-store");
    headers.set("x-robots-tag", "noindex");
    return new Response(null, { status: result.status || 404, headers });
  }
  if (result.kind === "html") {
    headers.set("content-type", "text/html; charset=utf-8");
    if (result.robots) headers.set("x-robots-tag", "noindex, nofollow");
    const body = String(method).toUpperCase() === "HEAD" ? null : result.html;
    return new Response(body, { status: 200, headers });
  }
  if (result.kind === "image") {
    headers.set("content-type", result.contentType || "application/octet-stream");
    headers.set("x-content-type-options", "nosniff");
    const body = String(method).toUpperCase() === "HEAD" ? null : result.bytes;
    return new Response(body, { status: 200, headers });
  }
  return null;
}

export function supabaseEnv(env) {
  const source = env || {};
  const url = String(source.SUPABASE_URL || source.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = String(source.SUPABASE_ANON_KEY || source.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!url || !key) return null;
  return { url, key };
}

export async function fetchShareCard(env, ref, fetchImpl = fetch) {
  const target = supabaseEnv(env);
  if (!target) return { configured: false, card: null };
  let response;
  try {
    response = await fetchImpl(`${target.url}/rest/v1/rpc/public_event_share`, {
      method: "POST",
      headers: {
        apikey: target.key,
        authorization: `Bearer ${target.key}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ p_ref: ref }),
    });
  } catch {
    return { configured: false, card: null };
  }
  if (!response.ok) return { configured: false, card: null };
  let body;
  try {
    body = await response.json();
  } catch {
    return { configured: false, card: null };
  }
  const row = Array.isArray(body) ? body[0] : body;
  if (!row || typeof row !== "object" || !row.slug || !row.title) return { configured: true, card: null };
  return { configured: true, card: row };
}

function cardCacheRequest(ref) {
  return new Request(`https://ether.internal/event-share/${encodeURIComponent(ref)}`);
}

export async function loadShareCard(env, ref, context) {
  try {
    const cache = globalThis.caches?.default;
    if (cache) {
      const hit = await cache.match(cardCacheRequest(ref));
      if (hit) {
        const stored = await hit.json();
        return { configured: true, card: stored?.card || null };
      }
    }
  } catch {
    // The cache API is a Cloudflare runtime. Tests and local node skip it.
  }
  const loaded = await fetchShareCard(env, ref);
  if (loaded.configured) {
    try {
      const cache = globalThis.caches?.default;
      const waitUntil = context?.waitUntil?.bind(context);
      if (cache && waitUntil) {
        const stored = new Response(JSON.stringify({ card: loaded.card }), {
          headers: { "cache-control": loaded.card ? SHARE_CACHE : HIDDEN_CACHE, "content-type": "application/json" },
        });
        waitUntil(cache.put(cardCacheRequest(ref), stored));
      }
    } catch {
      // Caching is optional.
    }
  }
  return loaded;
}
