import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { liveKeyboardInset } from "./liveKeyboard.ts";

describe("live keyboard inset", () => {
  it("pads the live sheet by the keyboard height and ignores a closed keyboard", () => {
    assert.equal(liveKeyboardInset(320), 320);
    assert.equal(liveKeyboardInset(320.6), 321);
    assert.equal(liveKeyboardInset(0), 0);
    assert.equal(liveKeyboardInset(-40), 0);
    assert.equal(liveKeyboardInset(Number.NaN), 0);
    assert.equal(liveKeyboardInset(undefined), 0);
  });
});
