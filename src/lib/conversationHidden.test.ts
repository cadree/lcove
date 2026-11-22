import assert from "node:assert/strict";
import test from "node:test";
import { isHiddenForMe } from "./conversationHidden.ts";

test("a chat that was never hidden always shows", () => {
  assert.equal(isHiddenForMe(null, null), false);
  assert.equal(isHiddenForMe(undefined, "2026-11-21T10:00:00Z"), false);
});

test("a hidden chat with no messages stays hidden", () => {
  assert.equal(isHiddenForMe("2026-11-21T10:00:00Z", null), true);
});

test("a hidden chat stays hidden until a newer message arrives", () => {
  assert.equal(isHiddenForMe("2026-11-21T10:00:00Z", "2026-11-21T09:59:59Z"), true);
  assert.equal(isHiddenForMe("2026-11-21T10:00:00Z", "2026-11-21T10:00:00Z"), true);
  assert.equal(isHiddenForMe("2026-11-21T10:00:00Z", "2026-11-21T10:00:01Z"), false);
});
