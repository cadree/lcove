import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { giftNoticeLabel } from "./giftNotice.ts";

describe("gift notices", () => {
  it("names the person and the gift without a price", () => {
    assert.equal(giftNoticeLabel("Maya", "rose"), "Maya sent a Rose");
    assert.equal(giftNoticeLabel("Maya", "star"), "Maya sent a Star");
    assert.equal(giftNoticeLabel("Maya", "crown"), "Maya sent a Crown");
    assert.equal(giftNoticeLabel("  ", "rose"), "Someone sent a Rose");
    assert.equal(giftNoticeLabel("Maya", "rose").includes("$"), false);
  });
});
