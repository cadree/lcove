import { liveUpdateReply, MANIFEST_PATH, NO_STORE_HEADERS } from "./_shared/nativeUpdates.js";

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: NO_STORE_HEADERS });
}

async function readManifest(context) {
  const assets = context.env?.ASSETS;
  if (!assets?.fetch) return null;
  const assetUrl = new URL(MANIFEST_PATH, context.request.url);
  const response = await assets.fetch(new Request(assetUrl));
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function onRequestPost(context) {
  let body = null;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse(400, { message: "Expected a JSON object.", error: "invalid_body" });
  }
  const manifest = await readManifest(context);
  const reply = liveUpdateReply(manifest, body);
  return jsonResponse(reply.status, reply.body);
}

export function onRequestGet() {
  return jsonResponse(405, { message: "POST only.", error: "method_not_allowed" });
}
