import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GET_THE_APP_STORAGE_KEY,
  getTheAppDismissed,
  isIosWebVisitor,
  markGetTheAppDismissed,
  shouldShowGetTheAppPrompt,
} from "./getTheApp.ts";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const ready = {
  storeUrl: "https://apps.apple.com/app/ether-by-lcove/id6758372010",
  signedIn: true,
  native: false,
  iosWeb: true,
  dismissed: false,
  pathname: "/feed",
} as const;

describe("getTheApp prompt", () => {
  it("recognizes iPhone, iPad, and iPadOS Safari, and not Android or desktop", () => {
    assert.equal(isIosWebVisitor({ userAgent: IPHONE }), true);
    assert.equal(isIosWebVisitor({ userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)" }), true);
    assert.equal(isIosWebVisitor({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 5 }), true);
    assert.equal(isIosWebVisitor({ userAgent: "Mozilla/5.0 (Linux; Android 14)" }), false);
    assert.equal(isIosWebVisitor({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 0 }), false);
    assert.equal(isIosWebVisitor({ userAgent: "Mozilla/5.0 (Windows NT 10.0)", platform: "Win32", maxTouchPoints: 0 }), false);
  });

  it("shows on the sign-in screen and after sign-in on iPhone web, and remembers dismissal", () => {
    assert.equal(shouldShowGetTheAppPrompt(ready), true);
    assert.equal(shouldShowGetTheAppPrompt({ ...ready, pathname: "/auth", signedIn: false }), true);
    assert.equal(shouldShowGetTheAppPrompt({ ...ready, pathname: "/auth", signedIn: true }), true);
    assert.equal(shouldShowGetTheAppPrompt({ ...ready, dismissed: true }), false);
    assert.equal(shouldShowGetTheAppPrompt({ ...ready, native: true }), false);
    assert.equal(shouldShowGetTheAppPrompt({ ...ready, iosWeb: false }), false);
    assert.equal(shouldShowGetTheAppPrompt({ ...ready, signedIn: false, pathname: "/feed" }), false);
    assert.equal(shouldShowGetTheAppPrompt({ ...ready, storeUrl: "" }), false);
    assert.equal(shouldShowGetTheAppPrompt({ ...ready, pathname: "/onboarding" }), false);
    assert.equal(shouldShowGetTheAppPrompt({ ...ready, pathname: "/welcome" }), false);
    assert.equal(shouldShowGetTheAppPrompt({ ...ready, pathname: "/pending" }), false);
    assert.equal(shouldShowGetTheAppPrompt({ ...ready, pathname: "/denied" }), false);
    assert.equal(shouldShowGetTheAppPrompt({ ...ready, pathname: "/locked" }), false);

    const storage = new Map<string, string>();
    const store = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };
    assert.equal(getTheAppDismissed(store), false);
    markGetTheAppDismissed(store);
    assert.equal(store.getItem(GET_THE_APP_STORAGE_KEY), "1");
    assert.equal(getTheAppDismissed(store), true);
  });
});
