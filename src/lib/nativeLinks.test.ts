import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NATIVE_APP_ID } from "../config/nativeIds.ts";
import { appPathFromIncomingUrl, nativeAuthRedirect } from "./nativeLinks.ts";

describe("nativeAuthRedirect", () => {
  it("uses the bundle id as the custom URL scheme", () => {
    assert.equal(NATIVE_APP_ID, "com.etherbylcove.app");
    assert.equal(
      nativeAuthRedirect(NATIVE_APP_ID, "/auth?confirmed=1"),
      "com.etherbylcove.app://auth?confirmed=1",
    );
    assert.equal(
      nativeAuthRedirect(NATIVE_APP_ID, "/auth?reset=true"),
      "com.etherbylcove.app://auth?reset=true",
    );
    assert.equal(nativeAuthRedirect(NATIVE_APP_ID, "/"), "com.etherbylcove.app://");
  });
});

describe("appPathFromIncomingUrl", () => {
  it("maps production https links into app routes", () => {
    assert.equal(
      appPathFromIncomingUrl("https://etherbylcove.com/event/abc?ticket_success=true"),
      "/event/abc?ticket_success=true",
    );
    assert.equal(
      appPathFromIncomingUrl("https://www.etherbylcove.com/profile/user-1"),
      "/profile/user-1",
    );
  });

  it("ignores other websites and auth callbacks", () => {
    assert.equal(appPathFromIncomingUrl("https://ether-staging.pages.dev/feed"), null);
    assert.equal(appPathFromIncomingUrl("https://example.com/feed"), null);
    assert.equal(appPathFromIncomingUrl("com.etherbylcove.app://auth?code=abc"), null);
  });

  it("maps custom-scheme content links", () => {
    assert.equal(
      appPathFromIncomingUrl("com.etherbylcove.app://event/abc"),
      "/event/abc",
    );
  });
});
