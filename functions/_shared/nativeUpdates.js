/**
 * Self-hosted live-update check for the iOS app.
 * The Pages Function at /native-updates POSTs here. Only a bundle built
 * for the caller's native version_build is returned. Rollback is changing
 * `current` in /native-updates/manifest.json.
 */
export const PUBLIC_ORIGIN = "https://etherbylcove.com";
export const LIVE_UPDATE_APP_ID = "app.lovable.e07d9c457fd949f78f3cc7d5998be668";
export const MANIFEST_PATH = "/native-updates/manifest.json";
export const BUNDLE_URL_PREFIX = `${PUBLIC_ORIGIN}/native-updates/bundles/`;

const SHA256 = /^[a-f0-9]{64}$/i;

export function readUpdateRequest(body) {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid_body", message: "Expected a JSON object." };
  }
  const appId = typeof body.app_id === "string" ? body.app_id.trim() : "";
  const versionBuild = typeof body.version_build === "string" ? body.version_build.trim() : "";
  const versionName = typeof body.version_name === "string" ? body.version_name.trim() : "";
  if (!versionBuild) {
    return { ok: false, error: "missing_version_build", message: "version_build is required." };
  }
  return { ok: true, appId, versionBuild, versionName };
}

export function resolveBundleUrl(url) {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/native-updates/bundles/")) return `${PUBLIC_ORIGIN}${trimmed}`;
  if (trimmed.startsWith(BUNDLE_URL_PREFIX) && !trimmed.includes("..")) return trimmed;
  return null;
}

export function readCurrentBundle(manifest, versionBuild) {
  if (manifest == null || typeof manifest !== "object" || Array.isArray(manifest)) return null;
  const native = manifest.native;
  if (native == null || typeof native !== "object") return null;
  const slot = native[versionBuild];
  if (slot == null || typeof slot !== "object") return null;
  const current = typeof slot.current === "string" ? slot.current.trim() : "";
  if (!current) return null;
  const bundles = slot.bundles;
  if (bundles == null || typeof bundles !== "object") return null;
  const entry = bundles[current];
  if (entry == null || typeof entry !== "object") return null;
  const checksum = typeof entry.checksum === "string" ? entry.checksum.trim().toLowerCase() : "";
  const url = resolveBundleUrl(entry.url);
  if (!url || !SHA256.test(checksum)) return null;
  return { version: current, url, checksum };
}

/**
 * Decide what the updater plugin should receive.
 * kind "update" includes url+checksum so the plugin installs that bundle,
 * including a rollback to an older web version.
 * kind "none" has no url, so the plugin stays on the current bundle.
 * kind "error" is a bad request or a broken manifest entry.
 */
export function selectLiveUpdate(manifest, body) {
  const request = readUpdateRequest(body);
  if (!request.ok) {
    return { kind: "error", error: request.error, message: request.message };
  }
  if (request.appId && request.appId !== LIVE_UPDATE_APP_ID) {
    return { kind: "none", message: "No update needed" };
  }
  const bundle = readCurrentBundle(manifest, request.versionBuild);
  if (!bundle) {
    return { kind: "none", message: "No update needed" };
  }
  if (request.versionName && request.versionName === bundle.version) {
    return { kind: "none", message: "No update needed" };
  }
  return { kind: "update", version: bundle.version, url: bundle.url, checksum: bundle.checksum };
}

export function liveUpdateReply(manifest, body) {
  const result = selectLiveUpdate(manifest, body);
  if (result.kind === "update") {
    return {
      status: 200,
      body: { version: result.version, url: result.url, checksum: result.checksum },
    };
  }
  if (result.kind === "error") {
    return {
      status: 400,
      body: { message: result.message, error: result.error },
    };
  }
  return { status: 200, body: { message: result.message } };
}

export const NO_STORE_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};
