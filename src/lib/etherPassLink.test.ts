import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PASS_LINK_TTL_SECONDS,
  issuePassLink,
  passLinkParts,
  signPassLink,
  verifyPassLink,
} from "../../supabase/functions/_shared/ether-id-pass-link.mjs";

const secret = "test-link-secret";
const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "22222222-2222-4222-8222-222222222222";
const exp = 1_800_000_000;
const baseUrl = "https://example.supabase.co/functions/v1/ether-id-pass";

describe("ether id pass link", () => {
  it("accepts a signature for the same user before expiry", async () => {
    const sig = await signPassLink({ userId, exp, secret });
    assert.equal(
      await verifyPassLink({ userId, exp, sig, secret, nowSeconds: exp }),
      true,
    );
    assert.equal(
      await verifyPassLink({ userId, exp: String(exp), sig, secret, nowSeconds: exp - 30 }),
      true,
    );
  });

  it("rejects an expired link", async () => {
    const sig = await signPassLink({ userId, exp, secret });
    assert.equal(
      await verifyPassLink({ userId, exp, sig, secret, nowSeconds: exp + 1 }),
      false,
    );
  });

  it("rejects a tampered signature", async () => {
    const sig = await signPassLink({ userId, exp, secret });
    const tampered = `${sig.slice(0, -1)}${sig.endsWith("a") ? "b" : "a"}`;
    assert.equal(
      await verifyPassLink({ userId, exp, sig: tampered, secret, nowSeconds: exp - 1 }),
      false,
    );
    assert.equal(
      await verifyPassLink({ userId, exp: exp + 1, sig, secret, nowSeconds: exp }),
      false,
    );
  });

  it("rejects a signature presented for a different user", async () => {
    const sig = await signPassLink({ userId, exp, secret });
    assert.equal(
      await verifyPassLink({ userId: otherUserId, exp, sig, secret, nowSeconds: exp - 1 }),
      false,
    );
  });

  it("rejects a missing signature, user, or expiry", async () => {
    const sig = await signPassLink({ userId, exp, secret });
    assert.equal(await verifyPassLink({ userId, exp, sig: "", secret, nowSeconds: exp }), false);
    assert.equal(await verifyPassLink({ userId: "", exp, sig, secret, nowSeconds: exp }), false);
    assert.equal(await verifyPassLink({ userId, exp: "", sig, secret, nowSeconds: exp }), false);
    assert.equal(await verifyPassLink({ userId, exp, sig, secret: "", nowSeconds: exp }), false);
  });

  it("issues a five-minute url that verifies for that user only", async () => {
    assert.equal(PASS_LINK_TTL_SECONDS, 300);
    const nowSeconds = 1_800_000_000;
    const issued = await issuePassLink({ userId, secret, nowSeconds, baseUrl });
    assert.equal(issued.exp, nowSeconds + 300);
    const parts = passLinkParts(issued.url);
    assert.equal(parts.userId, userId);
    assert.equal(parts.exp, String(issued.exp));
    assert.equal(
      await verifyPassLink({ ...parts, secret, nowSeconds: issued.exp }),
      true,
    );
    assert.equal(
      await verifyPassLink({ ...parts, userId: otherUserId, secret, nowSeconds: issued.exp }),
      false,
    );
    assert.equal(issued.url.startsWith(`${baseUrl}?`), true);
  });
});
