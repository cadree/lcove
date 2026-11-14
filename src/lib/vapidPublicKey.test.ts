import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ETHER_VAPID_PUBLIC_KEY, resolveVapidPublicKey } from "./vapidPublicKey.ts";

function urlBase64ToBytes(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  return new Uint8Array(Buffer.from(base64, "base64"));
}

describe("vapid public key", () => {
  it("uses the committed ether-prod key when the env var is unset", () => {
    assert.equal(resolveVapidPublicKey(undefined), ETHER_VAPID_PUBLIC_KEY);
    assert.equal(resolveVapidPublicKey(null), ETHER_VAPID_PUBLIC_KEY);
    assert.equal(resolveVapidPublicKey(""), ETHER_VAPID_PUBLIC_KEY);
    assert.equal(resolveVapidPublicKey("   "), ETHER_VAPID_PUBLIC_KEY);
  });

  it("lets a non-empty env value override the committed key", () => {
    assert.equal(resolveVapidPublicKey(" custom "), "custom");
  });

  it("decodes to an uncompressed P-256 public key", () => {
    const bytes = urlBase64ToBytes(ETHER_VAPID_PUBLIC_KEY);
    assert.equal(bytes.length, 65);
    assert.equal(bytes[0], 0x04);
  });
});
