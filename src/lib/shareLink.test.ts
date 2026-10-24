import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nativeSharePlan, smsShareHref } from "./shareLink.ts";

describe("free share actions", () => {
  it("builds an sms link with the url and does not call a gateway", () => {
    const href = smsShareHref("https://etherbylcove.com/profile/maya", "Listen");
    const body = decodeURIComponent(href.slice(href.indexOf("body=") + 5));
    assert.equal(href.startsWith("sms:?&body="), true);
    assert.equal(body.includes("https://etherbylcove.com/profile/maya"), true);
    assert.equal(body.includes("Listen"), true);
    assert.equal(href.includes("twilio"), false);
  });

  it("prefers the Capacitor share plugin in the app and the web sheet in Safari", () => {
    assert.equal(nativeSharePlan({ nativePlatform: true, pluginAvailable: true, webShare: true }), "capacitor");
    assert.equal(nativeSharePlan({ nativePlatform: true, pluginAvailable: false, webShare: true }), "web");
    assert.equal(nativeSharePlan({ nativePlatform: false, pluginAvailable: false, webShare: true }), "web");
    assert.equal(nativeSharePlan({ nativePlatform: false, pluginAvailable: false, webShare: false }), "unavailable");
  });
});
