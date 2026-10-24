import { loadShareCard, routeEventShare, shareResultResponse, supabaseFromConfig } from "./eventShare.js";
import { fetchFlyerDerivative } from "./flyerImage.js";

async function readBakedProject(context) {
  const assets = context.env?.ASSETS;
  if (!assets?.fetch) return null;
  const assetUrl = new URL("/event-share-config.json", context.request.url);
  const response = await assets.fetch(new Request(assetUrl));
  if (!response.ok) return null;
  return supabaseFromConfig(await response.json());
}

async function cachedImage(request) {
  try {
    const cache = globalThis.caches?.default;
    if (!cache) return null;
    return (await cache.match(request)) || null;
  } catch {
    return null;
  }
}

export async function onEventShareRequest(context) {
  const url = new URL(context.request.url);
  if (/\/(?:flyer\.jpg|icon\.png)$/.test(url.pathname)) {
    const hit = await cachedImage(context.request);
    if (hit) return hit;
  }
  try {
    const result = await routeEventShare(context.request, {
      loadCard: async (ref) => loadShareCard(await readBakedProject(context), ref, context),
      loadHtml: async () => {
        const assetUrl = new URL("/index.html", context.request.url);
        const response = await context.env.ASSETS.fetch(new Request(assetUrl));
        return response.text();
      },
      renderImage: (card, kind) => fetchFlyerDerivative(card.image_url, kind),
    });
    const response = shareResultResponse(result, context.request.method);
    if (!response) return context.next();
    if (result.kind === "image" && context.waitUntil) {
      try {
        const cache = globalThis.caches?.default;
        if (cache) context.waitUntil(cache.put(context.request, response.clone()));
      } catch {
        // Image caching is optional. The response still has Cache-Control.
      }
    }
    return response;
  } catch {
    return context.next();
  }
}
