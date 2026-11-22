import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUNDLE_URL_PREFIX,
  LIVE_UPDATE_APP_ID,
  liveUpdateReply,
  selectLiveUpdate,
} from "../../functions/_shared/nativeUpdates.js";

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
});
