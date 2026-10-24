import jpeg from "jpeg-js";
import pngjs from "pngjs";
import { Buffer } from "node:buffer";
import { safeImageUrl } from "./eventShare.js";

if (typeof globalThis.Buffer === "undefined") globalThis.Buffer = Buffer;

const PNG = pngjs.PNG;

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
export const ICON_SIZE = 180;
const MAX_PIXELS = 20_000_000;
const MAX_BYTES = 8_000_000;

export function coverCrop(src, sw, sh, dw, dh) {
  const scale = Math.max(dw / sw, dh / sh);
  const cropW = dw / scale;
  const cropH = dh / scale;
  const sx0 = (sw - cropW) / 2;
  const sy0 = (sh - cropH) / 2;
  const out = new Uint8Array(dw * dh * 4);
  for (let y = 0; y < dh; y += 1) {
    const sy = Math.min(sh - 1, Math.max(0, Math.floor(sy0 + ((y + 0.5) * cropH) / dh)));
    for (let x = 0; x < dw; x += 1) {
      const sx = Math.min(sw - 1, Math.max(0, Math.floor(sx0 + ((x + 0.5) * cropW) / dw)));
      const from = (sy * sw + sx) * 4;
      const to = (y * dw + x) * 4;
      out[to] = src[from];
      out[to + 1] = src[from + 1];
      out[to + 2] = src[from + 2];
      out[to + 3] = 255;
    }
  }
  return out;
}

function asBuffer(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

export function decodeFlyer(bytes, contentType = "") {
  try {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (!data.length || data.length > MAX_BYTES) return null;
    const type = String(contentType || "").toLowerCase();
    const png = data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
    const jpg = data[0] === 0xff && data[1] === 0xd8;
    if (png || type.includes("png")) {
      const image = PNG.sync.read(asBuffer(data));
      if (!image.width || !image.height || image.width * image.height > MAX_PIXELS) return null;
      return { width: image.width, height: image.height, data: image.data };
    }
    if (jpg || type.includes("jpeg") || type.includes("jpg")) {
      const image = jpeg.decode(asBuffer(data), { useTArray: true, formatAsRGBA: true });
      if (!image.width || !image.height || image.width * image.height > MAX_PIXELS) return null;
      return { width: image.width, height: image.height, data: image.data };
    }
    return null;
  } catch {
    return null;
  }
}

export function encodeJpeg(rgba, width, height, quality = 82) {
  return jpeg.encode({ data: rgba, width, height }, quality).data;
}

export function encodePng(rgba, width, height) {
  const png = new PNG({ width, height });
  const source = rgba instanceof Uint8Array ? rgba : new Uint8Array(rgba);
  png.data.set(source.subarray(0, width * height * 4));
  return PNG.sync.write(png);
}

export function renderFlyerDerivative(bytes, contentType, kind) {
  const decoded = decodeFlyer(bytes, contentType);
  if (!decoded) return null;
  if (kind === "icon") {
    const rgba = coverCrop(decoded.data, decoded.width, decoded.height, ICON_SIZE, ICON_SIZE);
    return { bytes: encodePng(rgba, ICON_SIZE, ICON_SIZE), contentType: "image/png", width: ICON_SIZE, height: ICON_SIZE };
  }
  const rgba = coverCrop(decoded.data, decoded.width, decoded.height, OG_WIDTH, OG_HEIGHT);
  return { bytes: encodeJpeg(rgba, OG_WIDTH, OG_HEIGHT), contentType: "image/jpeg", width: OG_WIDTH, height: OG_HEIGHT };
}

export async function fetchFlyerDerivative(imageUrl, kind, fetchImpl = fetch) {
  const source = safeImageUrl(imageUrl);
  if (!source) return null;
  try {
    const response = await fetchImpl(source, { redirect: "follow" });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return renderFlyerDerivative(bytes, response.headers.get("content-type") || "", kind);
  } catch {
    return null;
  }
}

export function pngSize(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (data.length < 24 || data[0] !== 0x89) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

export function jpegSize(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (data[0] !== 0xff || data[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < data.length) {
    if (data[offset] !== 0xff) return null;
    const marker = data[offset + 1];
    const length = (data[offset + 2] << 8) + data[offset + 3];
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: (data[offset + 5] << 8) + data[offset + 6], width: (data[offset + 7] << 8) + data[offset + 8] };
    }
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}
