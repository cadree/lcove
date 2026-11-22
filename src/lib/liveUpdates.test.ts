import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Capacitor } from "@capacitor/core";
import { notifyLiveUpdateReady } from "./liveUpdates.ts";

describe("notifyLiveUpdateReady", () => {
  it("is a no-op off a native device, so web and unit tests do not load the updater", async () => {
    assert.equal(Capacitor.isNativePlatform(), false);
    await notifyLiveUpdateReady();
  });
});
