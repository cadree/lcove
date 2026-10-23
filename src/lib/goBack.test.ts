import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { backTarget, historyIndex } from "./goBack.ts";

describe("in-app back", () => {
  it("returns to the previous screen when React Router has a stack", () => {
    assert.equal(historyIndex({ idx: 2, key: "abc" }), 2);
    assert.equal(backTarget({ idx: 2 }), -1);
    assert.equal(backTarget({ idx: 1 }), -1);
  });

  it("falls back to the feed on a deep link", () => {
    assert.equal(backTarget({ idx: 0 }), "/feed");
    assert.equal(backTarget(null), "/feed");
    assert.equal(backTarget({}), "/feed");
    assert.equal(backTarget({ idx: "2" }), "/feed");
  });

  it("does not treat browser history length as an in-app screen", () => {
    assert.equal(backTarget({ idx: 0, length: 8 }), "/feed");
  });
});
