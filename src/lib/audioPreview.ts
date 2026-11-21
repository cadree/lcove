// Builds the short public preview for a locked track in the browser, so the full
// file never has to be public. The preview is a small mono WAV (about 660 KB for
// 15 seconds), which every browser and iOS can play.

export const PREVIEW_SAMPLE_RATE = 22050;
export const PREVIEW_SECONDS = 15;
/** Decoding needs the whole file in memory; above this, skip the preview on phones. */
export const MAX_PREVIEW_SOURCE_BYTES = 40 * 1024 * 1024;

/** 16-bit PCM mono WAV. Samples are clamped to [-1, 1]. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

/**
 * Average the channels, cut [start, start + duration) and resample to targetRate
 * with linear interpolation. A start past the end falls back to the first seconds.
 * Short fades at both ends avoid clicks.
 */
export function previewSamples(
  channels: Float32Array[],
  sourceRate: number,
  startSeconds: number,
  durationSeconds: number,
  targetRate = PREVIEW_SAMPLE_RATE,
): Float32Array {
  const length = channels[0]?.length ?? 0;
  if (!length || sourceRate <= 0) return new Float32Array(0);
  const total = length / sourceRate;
  let start = Math.max(0, startSeconds || 0);
  if (start >= total) start = 0;
  const duration = Math.max(0, Math.min(durationSeconds, total - start));
  const outLength = Math.floor(duration * targetRate);
  const out = new Float32Array(outLength);
  const ratio = sourceRate / targetRate;
  const startIndex = start * sourceRate;
  for (let i = 0; i < outLength; i++) {
    const pos = startIndex + i * ratio;
    const i0 = Math.min(length - 1, Math.floor(pos));
    const i1 = Math.min(length - 1, i0 + 1);
    const frac = pos - i0;
    let sum = 0;
    for (const channel of channels) sum += channel[i0] + (channel[i1] - channel[i0]) * frac;
    out[i] = sum / channels.length;
  }
  const fade = Math.min(Math.floor(targetRate * 0.25), Math.floor(outLength / 2));
  for (let i = 0; i < fade; i++) {
    const gain = i / fade;
    out[i] *= gain;
    out[outLength - 1 - i] *= gain;
  }
  return out;
}

type AudioContextCtor = new (options?: { sampleRate?: number }) => {
  decodeAudioData(data: ArrayBuffer): Promise<{ numberOfChannels: number; sampleRate: number; duration: number; getChannelData(i: number): Float32Array }>;
  close?: () => Promise<void>;
};

/**
 * Decode the picked file and return a WAV preview plus the track length.
 * Returns null when the browser can't decode the format or the file is too big
 * to decode safely on a phone; the upload still goes ahead without a preview.
 */
export async function makePreviewClip(
  file: Blob,
  startSeconds: number,
  durationSeconds = PREVIEW_SECONDS,
): Promise<{ blob: Blob; durationSeconds: number } | null> {
  if (file.size > MAX_PREVIEW_SOURCE_BYTES) return null;
  const w = globalThis as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  const Ctor = w.AudioContext || w.webkitAudioContext;
  if (!Ctor) return null;
  const context = new Ctor();
  try {
    const decoded = await context.decodeAudioData(await file.arrayBuffer());
    const channels: Float32Array[] = [];
    for (let i = 0; i < decoded.numberOfChannels; i++) channels.push(decoded.getChannelData(i));
    const samples = previewSamples(channels, decoded.sampleRate, startSeconds, durationSeconds);
    if (!samples.length) return null;
    const wav = encodeWav(samples, PREVIEW_SAMPLE_RATE);
    return { blob: new Blob([wav], { type: "audio/wav" }), durationSeconds: Math.round(decoded.duration) };
  } catch {
    return null;
  } finally {
    await context.close?.().catch(() => undefined);
  }
}
