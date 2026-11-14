import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { facebookShareUrl, fileSharePlan, nativeSharePlan, smsShareHref } from "./shareLink.ts";

describe("free share actions", () => {
  it("builds an sms link with the url and does not call a gateway", () => {
    const href = smsShareHref("https://etherbylcove.com/profile/maya", "Listen");
    const body = decodeURIComponent(href.slice(href.indexOf("body=") + 5));
    assert.equal(href.startsWith("sms:?&body="), true);
    assert.equal(body.includes("https://etherbylcove.com/profile/maya"), true);
    assert.equal(body.includes("Listen"), true);
    assert.equal(href.includes("twilio"), false);
  });

  it("uses the Facebook web sharer and does not open the app scheme", () => {
    const href = facebookShareUrl("https://etherbylcove.com/e/night");
    assert.equal(href.startsWith("https://www.facebook.com/sharer/sharer.php?u="), true);
    assert.equal(href.includes("fb://"), false);
    assert.equal(decodeURIComponent(href.slice(href.indexOf("u=") + 2)), "https://etherbylcove.com/e/night");
  });

  it("shares a real file through the web sheet, then Capacitor, then a download", () => {
    assert.equal(fileSharePlan({ canShareFiles: true, nativePlatform: true, pluginAvailable: true }), "web-file");
    assert.equal(fileSharePlan({ canShareFiles: false, nativePlatform: true, pluginAvailable: true }), "capacitor");
    assert.equal(fileSharePlan({ canShareFiles: false, nativePlatform: true, pluginAvailable: false }), "download");
    assert.equal(fileSharePlan({ canShareFiles: false, nativePlatform: false, pluginAvailable: false }), "download");
  });

  it("prefers the Capacitor share plugin in the app and the web sheet in Safari", () => {
    assert.equal(nativeSharePlan({ nativePlatform: true, pluginAvailable: true, webShare: true }), "capacitor");
    assert.equal(nativeSharePlan({ nativePlatform: true, pluginAvailable: false, webShare: true }), "web");
    assert.equal(nativeSharePlan({ nativePlatform: false, pluginAvailable: false, webShare: true }), "web");
    assert.equal(nativeSharePlan({ nativePlatform: false, pluginAvailable: false, webShare: false }), "unavailable");
  });
});
