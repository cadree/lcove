// cspell:ignore testflight
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUNDLE_URL_PREFIX,
  LIVE_UPDATE_APP_ID,
  liveUpdateReply,
  selectLiveUpdate,
} from "../../functions/_shared/nativeUpdates.js";
import { onRequestPost } from "../../functions/native-updates.js";

const NATIVE = "202611170600";
const WEB_1 = "1.0.5-web.1";
const WEB_2 = "1.0.5-web.2";
const SUM_1 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SUM_2 = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function manifest(current: string | null, extras?: Record<string, { url: string; checksum: string }>) {
  return {
    native: {
      [NATIVE]: {
        current,
        bundles: {
          [WEB_1]: { url: `${BUNDLE_URL_PREFIX}${NATIVE}-${WEB_1}.zip`, checksum: SUM_1 },
          [WEB_2]: { url: `${BUNDLE_URL_PREFIX}${NATIVE}-${WEB_2}.zip`, checksum: SUM_2 },
          ...extras,
        },
      },
    },
  };
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    app_id: LIVE_UPDATE_APP_ID,
    version_build: NATIVE,
    version_name: "builtin",
    platform: "ios",
    ...overrides,
  };
}

describe("live update endpoint", () => {
  it("returns the current bundle when the native version matches and the app is on the built-in web layer", () => {
    const result = selectLiveUpdate(manifest(WEB_2), request({ version_name: "builtin" }));
    assert.equal(result.kind, "update");
    if (result.kind !== "update") return;
    assert.equal(result.version, WEB_2);
    assert.equal(result.url, `${BUNDLE_URL_PREFIX}${NATIVE}-${WEB_2}.zip`);
    assert.equal(result.checksum, SUM_2);
  });

  it("returns no update when the app already has the current bundle", () => {
    const result = selectLiveUpdate(manifest(WEB_2), request({ version_name: WEB_2 }));
    assert.equal(result.kind, "none");
    const reply = liveUpdateReply(manifest(WEB_2), request({ version_name: WEB_2 }));
    assert.equal(reply.status, 200);
    assert.deepEqual(reply.body, { message: "No update needed" });
    assert.equal("url" in reply.body, false);
  });

  it("returns no update when version_build does not match a native slot", () => {
    const result = selectLiveUpdate(manifest(WEB_2), request({ version_build: "202611112305" }));
    assert.equal(result.kind, "none");
  });

  it("rolls back by serving the new current bundle when that is an older web version", () => {
    const result = selectLiveUpdate(manifest(WEB_1), request({ version_name: WEB_2 }));
    assert.equal(result.kind, "update");
    if (result.kind !== "update") return;
    assert.equal(result.version, WEB_1);
    assert.equal(result.url, `${BUNDLE_URL_PREFIX}${NATIVE}-${WEB_1}.zip`);
    assert.equal(result.checksum, SUM_1);
  });

  it("returns no update when current is empty or the manifest is missing", () => {
    assert.equal(selectLiveUpdate(manifest(null), request()).kind, "none");
    assert.equal(selectLiveUpdate({ native: {} }, request()).kind, "none");
    assert.equal(selectLiveUpdate(null, request()).kind, "none");
  });

  it("ignores a different app id and a missing current file", () => {
    assert.equal(selectLiveUpdate(manifest(WEB_1), request({ app_id: "com.example.other" })).kind, "none");
    const broken = manifest(WEB_1);
    broken.native[NATIVE].bundles[WEB_1] = { url: "https://evil.example/app.zip", checksum: SUM_1 };
    assert.equal(selectLiveUpdate(broken, request()).kind, "none");
  });

  it("rejects a request with no version_build", () => {
    const reply = liveUpdateReply(manifest(WEB_1), { app_id: LIVE_UPDATE_APP_ID });
    assert.equal(reply.status, 400);
    assert.equal((reply.body as { error: string }).error, "missing_version_build");
  });

  it("accepts a root-relative bundle path and normalizes it to etherbylcove.com", () => {
    const relative = manifest(WEB_1);
    relative.native[NATIVE].bundles[WEB_1] = {
      url: `/native-updates/bundles/${NATIVE}-${WEB_1}.zip`,
      checksum: SUM_1,
    };
    const result = selectLiveUpdate(relative, request());
    assert.equal(result.kind, "update");
    if (result.kind !== "update") return;
    assert.equal(result.url, `${BUNDLE_URL_PREFIX}${NATIVE}-${WEB_1}.zip`);
  });

  // The exact body @capgo/capacitor-updater 8.54.2 POSTs from iOS
  // (CapgoUpdater.createInfoObject): version_build is CFBundleShortVersionString,
  // version_code is CFBundleVersion.
  function pluginRequest(overrides: Record<string, unknown> = {}) {
    return {
      platform: "ios",
      device_id: "00000000-0000-4000-8000-000000000000",
      app_id: LIVE_UPDATE_APP_ID,
      custom_id: "",
      version_build: "1.0.5",
      version_code: NATIVE,
      version_os: "26.1",
      version_name: "builtin",
      plugin_version: "8.54.2",
      is_emulator: false,
      is_prod: true,
      installSource: "testflight",
      defaultChannel: "",
      ...overrides,
    };
  }

  it("serves the current bundle to the plugin's real request (marketing version in version_build, build number in version_code)", () => {
    const result = selectLiveUpdate(manifest(WEB_2), pluginRequest());
    assert.equal(result.kind, "update");
    if (result.kind !== "update") return;
    assert.equal(result.version, WEB_2);
    assert.equal(result.checksum, SUM_2);
  });

  it("returns no update to the plugin once it runs the current bundle", () => {
    assert.equal(selectLiveUpdate(manifest(WEB_2), pluginRequest({ version_name: WEB_2 })).kind, "none");
  });

  it("does not fall back to version_build when the build-number slot is switched off", () => {
    const m = manifest(null) as { native: Record<string, unknown> };
    m.native["1.0.5"] = manifest(WEB_2).native[NATIVE];
    assert.equal(selectLiveUpdate(m, pluginRequest()).kind, "none");
  });

  it("ignores a different native build number", () => {
    assert.equal(selectLiveUpdate(manifest(WEB_2), pluginRequest({ version_code: "202611112305" })).kind, "none");
  });

  it("answers the plugin's POST through the Pages Function with url and sha256 checksum", async () => {
    const m = manifest(WEB_2);
    const context = {
      request: new Request("https://etherbylcove.com/native-updates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(pluginRequest()),
      }),
      env: { ASSETS: { fetch: async () => new Response(JSON.stringify(m), { status: 200 }) } },
    };
    const response = await onRequestPost(context as never);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    const body = (await response.json()) as { version: string; url: string; checksum: string };
    assert.equal(body.version, WEB_2);
    assert.equal(body.url, `${BUNDLE_URL_PREFIX}${NATIVE}-${WEB_2}.zip`);
    assert.match(body.checksum, /^[a-f0-9]{64}$/);
  });
});
