import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { keyboardPaddingStyle, liveKeyboardInset, pinMessageListToEnd } from "./liveKeyboard.ts";

describe("live keyboard inset", () => {
  it("pads by the keyboard height and ignores a closed keyboard", () => {
    assert.equal(liveKeyboardInset(320), 320);
    assert.equal(liveKeyboardInset(320.6), 321);
    assert.equal(liveKeyboardInset(0), 0);
    assert.equal(liveKeyboardInset(-40), 0);
    assert.equal(liveKeyboardInset(Number.NaN), 0);
    assert.equal(liveKeyboardInset(undefined), 0);
    assert.equal(liveKeyboardInset(null), 0);
  });

  it("applies the keyboard height once and leaves closed-keyboard padding alone", () => {
    assert.equal(keyboardPaddingStyle(0), undefined);
    assert.equal(keyboardPaddingStyle(undefined), undefined);
    assert.deepEqual(keyboardPaddingStyle(336), { paddingBottom: 336 });
    assert.deepEqual(keyboardPaddingStyle(336.2), { paddingBottom: 336 });

    const once = keyboardPaddingStyle(320);
    const twice = keyboardPaddingStyle(once?.paddingBottom);
    assert.deepEqual(twice, { paddingBottom: 320 });
    assert.notEqual(twice?.paddingBottom, 640);
  });

  it("pins the message list to the newest row only while the keyboard is open", () => {
    const open = { scrollHeight: 800, scrollTop: 120 };
    assert.equal(pinMessageListToEnd(open, 300), true);
    assert.equal(open.scrollTop, 800);
    assert.equal(pinMessageListToEnd(open, 300), true);
    assert.equal(open.scrollTop, 800);

    const closed = { scrollHeight: 800, scrollTop: 120 };
    assert.equal(pinMessageListToEnd(closed, 0), false);
    assert.equal(closed.scrollTop, 120);
    assert.equal(pinMessageListToEnd(null, 300), false);
  });
});
