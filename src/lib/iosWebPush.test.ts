import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { iosPushNeedsHomeScreen, type IosPushEnvironment } from "./iosWebPush.ts";

const iphone: IosPushEnvironment = {
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
  platform: "iPhone",
  maxTouchPoints: 5,
  standalone: false,
  displayMode: "browser",
  nativeIosApp: false,
};

describe("iOS web push", () => {
  it("asks for the Home Screen app in a Safari tab", () => {
    assert.equal(iosPushNeedsHomeScreen(iphone), true);
  });

  it("lets the installed app subscribe", () => {
    assert.equal(iosPushNeedsHomeScreen({ ...iphone, standalone: true, displayMode: "standalone" }), false);
    assert.equal(iosPushNeedsHomeScreen({ ...iphone, displayMode: "standalone" }), false);
  });

  it("leaves desktop browsers on the normal push path", () => {
    assert.equal(
      iosPushNeedsHomeScreen({
        ...iphone,
        userAgent: "Mozilla/5.0 Chrome/120.0.0.0",
        platform: "MacIntel",
        maxTouchPoints: 0,
      }),
      false,
    );
  });

  it("does not treat the native iOS app as a Safari tab", () => {
    assert.equal(iosPushNeedsHomeScreen({ ...iphone, nativeIosApp: true }), false);
  });
});
