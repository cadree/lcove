// Pure catalog import helpers. The edge function fetches; this file only parses.

const BLOCKED_HOST = /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[|.*\.local$|.*\.internal$)/i;

export function shopHost(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed) throw new Error("Store website is required");
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url;
  try {
    url = new URL(withProto);
  } catch {
    throw new Error("Store website is not a valid URL");
  }
  if (url.username || url.password) throw new Error("Store website is not a valid URL");
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Store website is not a valid URL");
  }
  const host = url.hostname.toLowerCase();
  if (!host || host.includes(":") || /^\d+\.\d+\.\d+\.\d+$/.test(host) || BLOCKED_HOST.test(host)) {
    throw new Error("Store website is not a valid URL");
  }
  return host;
}

export function pageUrl(input) {
  const host = shopHost(input);
  const withProto = /^https?:\/\//i.test(String(input).trim())
    ? String(input).trim()
    : `https://${String(input).trim()}`;
  const url = new URL(withProto);
  url.protocol = "https:";
  url.hostname = host;
  url.username = "";
  url.password = "";
  url.hash = "";
  return url.toString();
}

export function decodeHtml(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

export function stripHtml(html) {
  return decodeHtml(String(html || ""))
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) return decodeHtml(match[1]).trim();
  }
  return "";
}

export function parseOpenGraph(html, fallbackUrl) {
  const source = String(html || "");
  const titleTag = source.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = metaContent(source, "og:title") || (titleTag ? decodeHtml(titleTag[1]).trim() : "");
  const description = metaContent(source, "og:description") || metaContent(source, "description");
  let image = metaContent(source, "og:image");
  if (image && fallbackUrl) {
    try {
      image = new URL(image, fallbackUrl).toString();
    } catch {
      image = "";
    }
  }
  return {
    title: title.slice(0, 180),
    description: description.slice(0, 500),
    image,
    url: fallbackUrl,
  };
}

export function mapShopifyProducts(body, host) {
  const products = Array.isArray(body?.products) ? body.products : null;
  if (!products) return null;
  const rows = [];
  for (const product of products) {
    const handle = typeof product?.handle === "string" ? product.handle.trim() : "";
    const title = typeof product?.title === "string" ? product.title.trim() : "";
    if (!handle || !title) continue;
    const variant = Array.isArray(product.variants) ? product.variants[0] : null;
    const price = Number(variant?.price ?? 0);
    const image = Array.isArray(product.images) && product.images[0]?.src
      ? String(product.images[0].src)
      : null;
    const description = stripHtml(product.body_html || product.body || "").slice(0, 500);
    rows.push({
      type: "product",
      title: title.slice(0, 180),
      description: description || null,
      price: Number.isFinite(price) ? price : 0,
      credits_price: 0,
      currency: "USD",
      images: image ? [image] : [],
      is_active: true,
      external_source: "shopify",
      external_handle: handle.slice(0, 200),
      external_url: `https://${host}/products/${handle}`,
      shopify_product_id: product.id != null ? String(product.id) : null,
    });
  }
  return rows;
}

export function parseShopifyMeta(body) {
  const shop = body && typeof body === "object" ? (body.shop || body) : {};
  return {
    name: String(shop.name || "").trim().slice(0, 180),
    description: String(shop.description || "").trim().slice(0, 500),
  };
}

/** Fill logo, description, and cover only where the store row is still empty. */
export function emptyBrandPatch(existing, og, meta) {
  const patch = {};
  const logo = String(og?.image || "").trim();
  const description = String(og?.description || meta?.description || "").trim().slice(0, 500);
  if (!existing?.logo_url && logo) patch.logo_url = logo;
  if (!existing?.description && description) patch.description = description;
  if (!existing?.cover_image_url && logo) patch.cover_image_url = logo;
  return patch;
}

export function linkCardFromOpenGraph(og) {
  if (!og || (!og.title && !og.description && !og.image)) return null;
  let host = "store";
  try {
    host = new URL(og.url).hostname.replace(/^www\./, "");
  } catch {
    host = "store";
  }
  return {
    type: "product",
    title: (og.title || host).slice(0, 180),
    description: og.description || "Linked from the store website.",
    price: 0,
    credits_price: 0,
    currency: "USD",
    images: og.image ? [og.image] : [],
    is_active: true,
    external_source: "link",
    external_handle: "site",
    external_url: og.url,
    shopify_product_id: null,
  };
}

export function importStatusMessage(source, imported) {
  if (source === "shopify") {
    return imported > 0
      ? `Imported ${imported} product${imported === 1 ? "" : "s"} from the public Shopify catalog.`
      : "This Shopify shop published an empty product list.";
  }
  if (source === "link") {
    return "This site did not publish a Shopify product list. A link card was added from the page preview.";
  }
  return "Catalog import finished.";
}
