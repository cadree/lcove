import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encodeWav, previewSamples, PREVIEW_SAMPLE_RATE } from "./audioPreview.ts";

describe("encodeWav", () => {
  it("writes a 16-bit mono PCM header and clamps samples", () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 2, -2]), 22050);
    const view = new DataView(wav.buffer);
    const text = (o: number, n: number) => String.fromCharCode(...wav.slice(o, o + n));
    assert.equal(text(0, 4), "RIFF");
    assert.equal(text(8, 4), "WAVE");
    assert.equal(view.getUint16(20, true), 1);
    assert.equal(view.getUint16(22, true), 1);
    assert.equal(view.getUint32(24, true), 22050);
    assert.equal(view.getUint16(34, true), 16);
    assert.equal(view.getUint32(40, true), 10);
    assert.equal(wav.length, 54);
    assert.deepEqual([1, 2, 3, 4, 5].map((i) => view.getInt16(42 + i * 2, true)), [0, 32767, -32768, 32767, -32768]);
  });
});

describe("previewSamples", () => {
  const rate = 44100;
  const seconds = 60;
  const left = new Float32Array(rate * seconds).fill(0.5);
  const right = new Float32Array(rate * seconds).fill(-0.1);

  it("cuts 15 seconds, mixes to mono and resamples", () => {
    const out = previewSamples([left, right], rate, 30, 15);
    assert.equal(out.length, 15 * PREVIEW_SAMPLE_RATE);
    assert.ok(Math.abs(out[Math.floor(out.length / 2)] - 0.2) < 1e-6);
    assert.equal(out[0], 0); // faded in
  });

  it("never runs past the end, and restarts at 0 when the start is past the end", () => {
    assert.equal(previewSamples([left], rate, 55, 15).length, 5 * PREVIEW_SAMPLE_RATE);
    assert.equal(previewSamples([left], rate, 999, 15).length, 15 * PREVIEW_SAMPLE_RATE);
  });

  it("is about 660 KB for 15 seconds, so it uploads fast on a phone", () => {
    const wav = encodeWav(previewSamples([left], rate, 0, 15), PREVIEW_SAMPLE_RATE);
    assert.ok(wav.length < 700 * 1024);
  });

  it("returns nothing for empty audio", () => {
    assert.equal(previewSamples([], rate, 0, 15).length, 0);
  });
});
