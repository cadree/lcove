import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fixWebmDuration, readWebmDurationMs } from "./webmDuration.ts";

function sizeByte(value: number): number[] {
  return [0x80 | value];
}

function infoWithDuration(durationBytes: number[]): Uint8Array {
  const scale = [0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40];
  const payload = [...scale, ...durationBytes];
  const info = [0x15, 0x49, 0xa9, 0x66, ...sizeByte(payload.length), ...payload];
  const cluster = [0x1f, 0x43, 0xb6, 0x75, 0x84, 0x44, 0x89, 0x00, 0x00];
  return Uint8Array.from([...info, ...cluster]);
}

describe("webm duration", () => {
  it("replaces a zero duration so the scrubber has a finite length", async () => {
    const header = infoWithDuration([0x44, 0x89, 0x84, 0x00, 0x00, 0x00, 0x00]);
    const fixed = new Uint8Array(await (await fixWebmDuration(new Blob([header], { type: "video/webm" }), 2500)).arrayBuffer());
    assert.equal(readWebmDurationMs(fixed), 2500);
    assert.deepEqual(Array.from(fixed.subarray(fixed.length - 4)), [0x44, 0x89, 0x00, 0x00]);
  });

  it("replaces an infinite duration", async () => {
    const header = infoWithDuration([0x44, 0x89, 0x84, 0x7f, 0x80, 0x00, 0x00]);
    const before = readWebmDurationMs(header);
    assert.equal(Number.isFinite(before), false);
    const fixed = new Uint8Array(await (await fixWebmDuration(new Blob([header], { type: "video/webm" }), 1800)).arrayBuffer());
    assert.equal(readWebmDurationMs(fixed), 1800);
  });

  it("inserts a duration when Chrome left the header without one", async () => {
    const scale = [0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40];
    const info = [0x15, 0x49, 0xa9, 0x66, ...sizeByte(scale.length), ...scale];
    const cluster = [0x1f, 0x43, 0xb6, 0x75, 0x81, 0x11];
    const header = Uint8Array.from([...info, ...cluster]);
    const fixed = new Uint8Array(await (await fixWebmDuration(new Blob([header], { type: "video/webm" }), 900)).arrayBuffer());
    assert.equal(readWebmDurationMs(fixed), 900);
    assert.equal(fixed.at(-1), 0x11);
  });

  it("leaves an mp4 recording alone", async () => {
    const blob = new Blob([Uint8Array.from([1, 2, 3, 4])], { type: "video/mp4" });
    const fixed = await fixWebmDuration(blob, 1000);
    assert.equal(fixed, blob);
  });
});
