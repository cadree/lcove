import assert from "node:assert/strict";
import test from "node:test";
import { formatTime, getPlayerState } from "./musicPlayer.ts";

test("times read as m:ss and the player starts empty without a browser", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(158.7), "2:38");
  assert.equal(formatTime(NaN), "0:00");
  assert.equal(getPlayerState().track, null);
});
