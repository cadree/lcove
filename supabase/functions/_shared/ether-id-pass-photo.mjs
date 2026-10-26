// Profile photo for the Ether ID pass thumbnail.
// PassKit image slots are PNG. A JPEG or PNG avatar is cover-cropped to the
// thumbnail sizes. Anything else, including HEIC, is left out so the pass
// still builds.

const MAX_BYTES = 3_000_000;
const MAX_EDGE = 2500;
const MAX_PIXELS = 4_000_000;
const TIMEOUT_MS = 2000;

const THUMBS = [
  ["thumbnail.png", 90],
  ["thumbnail@2x.png", 180],
  ["thumbnail@3x.png", 270],
];

function ensureBuffer() {
  if (typeof globalThis.Buffer !== "undefined" && typeof globalThis.Buffer.alloc === "function") return;
  globalThis.Buffer = {
    from(value) {
      return value instanceof Uint8Array ? value : Uint8Array.from(value);
    },
    alloc(size) {
      return new Uint8Array(size);
    },
  };
}

async function jpegLib() {
  ensureBuffer();
  try {
    const mod = await import("jpeg-js");
    return mod.default ?? mod;
  } catch {
    const mod = await import("npm:jpeg-js@0.4.4");
    return mod.default ?? mod;
  }
}

async function pngLib() {
  try {
    return await import("fast-png");
  } catch {
    return await import("npm:fast-png@6.4.0");
  }
}

function tooBig(width, height) {
  return width < 1 || height < 1 || width > MAX_EDGE || height > MAX_EDGE || width * height > MAX_PIXELS;
}

function pngHeaderTooBig(data) {
  if (data.length < 24) return false;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return tooBig(view.getUint32(16), view.getUint32(20));
}

function jpegHeaderTooBig(data) {
  let offset = 2;
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) return false;
    let marker = data[offset + 1];
    while (marker === 0xff && offset + 2 < data.length) {
      offset += 1;
      marker = data[offset + 1];
    }
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    if (offset + 4 > data.length) return false;
    const length = (data[offset + 2] << 8) + data[offset + 3];
    if (length < 2) return true;
    if (marker >= 0xc0 && marker <= 0xc3) {
      const height = (data[offset + 5] << 8) + data[offset + 6];
      const width = (data[offset + 7] << 8) + data[offset + 8];
      return tooBig(width, height);
    }
    offset += 2 + length;
  }
  return false;
}

function rgbaFromDecoded(image) {
  if (!image || image.depth !== 8) return null;
  const { width, height, channels } = image;
  if (tooBig(width, height)) return null;
  const pixels = image.data instanceof Uint8Array ? image.data : new Uint8Array(image.data);
  const count = width * height;
  if (channels === 4 && pixels.length >= count * 4) return { width, height, data: pixels };
  const rgba = new Uint8Array(count * 4);
  if (channels === 3 && pixels.length >= count * 3) {
    for (let i = 0; i < count; i += 1) {
      rgba[i * 4] = pixels[i * 3];
      rgba[i * 4 + 1] = pixels[i * 3 + 1];
      rgba[i * 4 + 2] = pixels[i * 3 + 2];
      rgba[i * 4 + 3] = 255;
    }
    return { width, height, data: rgba };
  }
  if (channels === 2 && pixels.length >= count * 2) {
    for (let i = 0; i < count; i += 1) {
      const gray = pixels[i * 2];
      rgba[i * 4] = gray;
      rgba[i * 4 + 1] = gray;
      rgba[i * 4 + 2] = gray;
      rgba[i * 4 + 3] = pixels[i * 2 + 1];
    }
    return { width, height, data: rgba };
  }
  if (channels === 1 && pixels.length >= count) {
    for (let i = 0; i < count; i += 1) {
      const gray = pixels[i];
      rgba[i * 4] = gray;
      rgba[i * 4 + 1] = gray;
      rgba[i * 4 + 2] = gray;
      rgba[i * 4 + 3] = 255;
    }
    return { width, height, data: rgba };
  }
  return null;
}

/** Same framing as the card photo: cover, focal point halfway across and near the top. */
function coverSquare(src, sw, sh, size) {
  const scale = Math.max(size / sw, size / sh);
  const cropW = size / scale;
  const cropH = size / scale;
  const sx0 = (sw - cropW) * 0.5;
  const sy0 = (sh - cropH) * 0.2;
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const sy = Math.min(sh - 1, Math.max(0, Math.floor(sy0 + ((y + 0.5) * cropH) / size)));
    for (let x = 0; x < size; x += 1) {
      const sx = Math.min(sw - 1, Math.max(0, Math.floor(sx0 + ((x + 0.5) * cropW) / size)));
      const from = (sy * sw + sx) * 4;
      const to = (y * size + x) * 4;
      out[to] = src[from];
      out[to + 1] = src[from + 1];
      out[to + 2] = src[from + 2];
      out[to + 3] = src[from + 3];
    }
  }
  return out;
}

async function decodePhoto(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (data.length < 8 || data.length > MAX_BYTES) return null;
  const png = data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
  const jpg = data[0] === 0xff && data[1] === 0xd8;
  if (!png && !jpg) return null;
  if (png && pngHeaderTooBig(data)) return null;
  if (jpg && jpegHeaderTooBig(data)) return null;
  try {
    if (png) {
      const { decode, convertIndexedToRgb } = await pngLib();
      const image = decode(data);
      if (image.palette) {
        const rgb = convertIndexedToRgb(image);
        const channels = image.palette[0]?.length === 4 ? 4 : 3;
        return rgbaFromDecoded({
          width: image.width,
          height: image.height,
          depth: 8,
          channels,
          data: rgb,
        });
      }
      return rgbaFromDecoded(image);
    }
    const jpeg = await jpegLib();
    const image = jpeg.decode(data, { useTArray: true, formatAsRGBA: true });
    return rgbaFromDecoded({
      width: image.width,
      height: image.height,
      depth: 8,
      channels: 4,
      data: image.data,
    });
  } catch {
    return null;
  }
}

/** PNG thumbnail files, or nothing when the bytes are not a readable JPEG or PNG. */
export async function etherIdThumbnailFiles(bytes) {
  const photo = await decodePhoto(bytes);
  if (!photo) return [];
  const { encode } = await pngLib();
  return THUMBS.map(([name, size]) => ({
    name,
    data: encode({
      width: size,
      height: size,
      data: coverSquare(photo.data, photo.width, photo.height, size),
      depth: 8,
      channels: 4,
    }),
  }));
}

function publicPhotoUrl(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
  if (host === "0.0.0.0" || host === "::1") return null;
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return null;
  const mid = /^172\.(\d+)\./.exec(host);
  if (mid && Number(mid[1]) >= 16 && Number(mid[1]) <= 31) return null;
  return url.toString();
}

/**
 * Fetch profiles.avatar_url and return thumbnail files.
 * Missing, slow, HEIC, and unreadable photos return no files.
 */
export async function fetchEtherIdThumbnail(avatarUrl, {
  fetchImpl = globalThis.fetch,
  timeoutMs = TIMEOUT_MS,
} = {}) {
  const url = publicPhotoUrl(avatarUrl);
  if (!url) return [];
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("timeout"));
    }, timeoutMs);
  });
  try {
    const response = await Promise.race([
      fetchImpl(url, { signal: controller.signal, redirect: "follow" }),
      timeout,
    ]);
    if (!response?.ok) return [];
    const declared = Number(response.headers?.get?.("content-length") || 0);
    if (Number.isFinite(declared) && declared > MAX_BYTES) return [];
    const buffer = new Uint8Array(await Promise.race([response.arrayBuffer(), timeout]));
    if (!buffer.byteLength || buffer.byteLength > MAX_BYTES) return [];
    return await etherIdThumbnailFiles(buffer);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
