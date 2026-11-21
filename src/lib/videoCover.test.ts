import { test } from "node:test";
import assert from "node:assert/strict";
import { coverSeekTime, coverSize } from "./videoCover.ts";

test("automatic cover is about one second in, or mid-clip for very short videos", () => {
  assert.equal(coverSeekTime(30), 1);
  assert.equal(coverSeekTime(2), 1);
  assert.equal(coverSeekTime(1.2), 0.6);
  assert.equal(coverSeekTime(0), 0);
  assert.equal(coverSeekTime(Number.NaN), 0);
  assert.equal(coverSeekTime(Number.POSITIVE_INFINITY), 0);
});

test("covers keep the video's shape and cap the long side", () => {
  assert.deepEqual(coverSize(1080, 1920), { width: 608, height: 1080 });
  assert.deepEqual(coverSize(3840, 2160), { width: 1080, height: 608 });
  assert.deepEqual(coverSize(640, 360), { width: 640, height: 360 });
  assert.deepEqual(coverSize(0, 0), { width: 0, height: 0 });
});
