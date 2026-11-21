/**
 * Chrome's MediaRecorder writes a WebM whose Duration is 0 or Infinity, so
 * the player scrubber has nothing to seek through. This patches that header
 * field in place, or inserts one before the first cluster when it is missing.
 * The element layout follows the WebM spec and the approach in the MIT
 * fix-webm-duration helper: Duration is a float counted in the file's scale.
 */

const DURATION_ID = [0x44, 0x89];
const SCALE_ID = [0x2a, 0xd7, 0xb1];
const INFO_ID = [0x15, 0x49, 0xa9, 0x66];
const CLUSTER_ID = [0x1f, 0x43, 0xb6, 0x75];
const DEFAULT_SCALE = 1_000_000;

interface SizeCode {
  length: number;
  value: number;
}

interface ElementHit {
  idOffset: number;
  sizeOffset: number;
  sizeLength: number;
  dataOffset: number;
  size: number;
}

function readSize(bytes: Uint8Array, offset: number): SizeCode | null {
  if (offset >= bytes.length) return null;
  const first = bytes[offset];
  if (first === 0) return null;
  let length = 1;
  let mask = 0x80;
  while (length <= 8 && (first & mask) === 0) {
    length += 1;
    mask >>= 1;
  }
  if (length > 8 || offset + length > bytes.length) return null;
  let value = first & (mask - 1);
  for (let i = 1; i < length; i += 1) value = value * 256 + bytes[offset + i];
  return { length, value };
}

function findId(bytes: Uint8Array, id: number[], from: number, to: number): number {
  const end = Math.min(to, bytes.length) - id.length;
  for (let i = from; i <= end; i += 1) {
    let match = true;
    for (let j = 0; j < id.length; j += 1) {
      if (bytes[i + j] !== id[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

function readElement(bytes: Uint8Array, id: number[], from: number, to: number): ElementHit | null {
  const idOffset = findId(bytes, id, from, to);
  if (idOffset < 0) return null;
  const sizeOffset = idOffset + id.length;
  const size = readSize(bytes, sizeOffset);
  if (!size) return null;
  const dataOffset = sizeOffset + size.length;
  if (dataOffset + size.value > bytes.length) return null;
  return { idOffset, sizeOffset, sizeLength: size.length, dataOffset, size: size.value };
}

function writeSize(value: number, length: number): Uint8Array | null {
  const max = 2 ** (7 * length) - 1;
  if (value < 0 || value > max) return null;
  const bytes = new Uint8Array(length);
  let remaining = value;
  for (let i = length - 1; i >= 1; i -= 1) {
    bytes[i] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }
  bytes[0] = remaining | (1 << (8 - length));
  return bytes;
}

function readUnsigned(bytes: Uint8Array, offset: number, size: number): number {
  let value = 0;
  const count = Math.min(size, 6);
  for (let i = 0; i < count; i += 1) value = value * 256 + bytes[offset + i];
  return value;
}

function headerLimit(bytes: Uint8Array): number {
  const cluster = findId(bytes, CLUSTER_ID, 0, bytes.length);
  if (cluster >= 0) return cluster;
  return Math.min(bytes.length, 64 * 1024);
}

function durationUnits(durationMs: number, scale: number): number {
  return (durationMs * DEFAULT_SCALE) / scale;
}

function writeFloat(view: DataView, offset: number, size: number, value: number) {
  if (size === 4) view.setFloat32(offset, value);
  else view.setFloat64(offset, value);
}

function durationElement(value: number): Uint8Array {
  const bytes = new Uint8Array(11);
  bytes[0] = DURATION_ID[0];
  bytes[1] = DURATION_ID[1];
  bytes[2] = 0x88;
  new DataView(bytes.buffer).setFloat64(3, value);
  return bytes;
}

export function readWebmDurationMs(bytes: Uint8Array): number | null {
  const limit = headerLimit(bytes);
  const scaleElement = readElement(bytes, SCALE_ID, 0, limit);
  const scale = scaleElement
    ? readUnsigned(bytes, scaleElement.dataOffset, scaleElement.size)
    : DEFAULT_SCALE;
  const duration = readElement(bytes, DURATION_ID, 0, limit);
  if (!duration || (duration.size !== 4 && duration.size !== 8)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const raw = duration.size === 4
    ? view.getFloat32(duration.dataOffset)
    : view.getFloat64(duration.dataOffset);
  if (!Number.isFinite(raw)) return raw;
  return (raw * scale) / DEFAULT_SCALE;
}

export async function fixWebmDuration(blob: Blob, durationMs: number): Promise<Blob> {
  const type = blob.type || "video/webm";
  if (!type.includes("webm") || !Number.isFinite(durationMs) || durationMs <= 0) return blob;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length < 16) return blob;
  const limit = headerLimit(bytes);
  const scaleElement = readElement(bytes, SCALE_ID, 0, limit);
  const scale = scaleElement && scaleElement.size > 0
    ? readUnsigned(bytes, scaleElement.dataOffset, scaleElement.size) || DEFAULT_SCALE
    : DEFAULT_SCALE;
  const units = durationUnits(durationMs, scale);
  const duration = readElement(bytes, DURATION_ID, 0, limit);
  if (duration && (duration.size === 4 || duration.size === 8)) {
    writeFloat(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), duration.dataOffset, duration.size, units);
    return new Blob([bytes], { type });
  }

  const info = readElement(bytes, INFO_ID, 0, limit);
  if (!info) return blob;
  const element = durationElement(units);
  const nextSize = writeSize(info.size + element.length, info.sizeLength);
  if (!nextSize) return blob;
  const inserted = new Uint8Array(bytes.length + element.length);
  const insertAt = info.dataOffset + info.size;
  inserted.set(bytes.subarray(0, insertAt), 0);
  inserted.set(element, insertAt);
  inserted.set(bytes.subarray(insertAt), insertAt + element.length);
  inserted.set(nextSize, info.sizeOffset);
  return new Blob([inserted], { type });
}
