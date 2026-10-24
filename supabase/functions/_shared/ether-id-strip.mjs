import { walletReviewValue, walletStatus } from "./ether-id-pass-json.mjs";
import { NUANCE } from "./ether-id-palette.mjs";

const STRIP_PT = { width: 375, height: 123 };

const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  6: ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ",": ["00000", "00000", "00000", "00000", "00110", "00100", "01000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "@": ["01110", "10001", "10111", "10101", "10111", "10000", "01110"],
};

const hex = (value) => Number.parseInt(value.slice(1), 16);
const rgba = (value, alpha = 255) => (((hex(value) << 8) | (alpha & 255)) >>> 0);

const INK = rgba(NUANCE.bg);
const BONE = rgba(NUANCE.bone);
const BONE_DIM = rgba(NUANCE.boneDim);
const FAINT = rgba(NUANCE.faint);
const BUBBLE = rgba(NUANCE.bubble);
const ALERT = rgba(NUANCE.alert);

async function loadImageScript() {
  try {
    return await import("imagescript");
  } catch {
    return await import("npm:imagescript@1.3.0");
  }
}

function box(image, x, y, w, h, color) {
  const width = Math.round(w);
  const height = Math.round(h);
  if (width < 1 || height < 1) return;
  image.drawBox(Math.round(x) + 1, Math.round(y) + 1, width, height, color >>> 0);
}

function circle(image, x, y, radius, color) {
  if (radius < 0.55) return;
  image.drawCircle(Math.round(x) + 1, Math.round(y) + 1, radius, color >>> 0);
}

function mix(from, to, t) {
  const a = from >>> 0;
  const b = to >>> 0;
  const channel = (shift) => {
    const av = (a >>> shift) & 255;
    const bv = (b >>> shift) & 255;
    return Math.round(av + (bv - av) * t);
  };
  return ((channel(24) << 24) | (channel(16) << 16) | (channel(8) << 8) | channel(0)) >>> 0;
}

function textWidth(text, scale) {
  let width = 0;
  for (const ch of String(text).toUpperCase()) {
    const glyph = FONT[ch] || FONT[" "];
    width += (glyph[0].length + 1) * scale;
  }
  return Math.max(0, width - scale);
}

function drawText(image, text, x, y, scale, color) {
  let cursor = x;
  for (const ch of String(text).toUpperCase()) {
    const glyph = FONT[ch] || FONT[" "];
    for (let row = 0; row < glyph.length; row += 1) {
      for (let col = 0; col < glyph[row].length; col += 1) {
        if (glyph[row][col] !== "1") continue;
        box(image, cursor + col * scale, y + row * scale, scale, scale, color);
      }
    }
    cursor += (glyph[0].length + 1) * scale;
  }
  return cursor;
}

function fillPoly(image, points, color) {
  const ys = points.map((point) => point[1]);
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(image.height - 1, Math.ceil(Math.max(...ys)));
  for (let y = minY; y <= maxY; y += 1) {
    const xs = [];
    for (let i = 0; i < points.length; i += 1) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        const t = (y - y1) / (y2 - y1);
        xs.push(x1 + t * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const x0 = Math.max(0, Math.ceil(xs[i]));
      const x1 = Math.min(image.width - 1, Math.floor(xs[i + 1]));
      if (x1 >= x0) box(image, x0, y, x1 - x0 + 1, 1, color);
    }
  }
}

function hexagon(image, cx, cy, radius, color) {
  const points = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = -Math.PI / 2 + i * (Math.PI / 3);
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  fillPoly(image, points, color);
}

function strokeRoundRect(image, x, y, w, h, radius, color, thickness) {
  const r = Math.max(thickness, Math.min(radius, Math.floor(Math.min(w, h) / 2)));
  box(image, x + r, y, w - r * 2, thickness, color);
  box(image, x + r, y + h - thickness, w - r * 2, thickness, color);
  box(image, x, y + r, thickness, h - r * 2, color);
  box(image, x + w - thickness, y + r, thickness, h - r * 2, color);
  const corners = [
    [x + r, y + r, Math.PI, Math.PI * 1.5],
    [x + w - r, y + r, Math.PI * 1.5, Math.PI * 2],
    [x + w - r, y + h - r, 0, Math.PI / 2],
    [x + r, y + h - r, Math.PI / 2, Math.PI],
  ];
  for (const [cx, cy, a0, a1] of corners) {
    for (let i = 0; i <= 10; i += 1) {
      const angle = a0 + ((a1 - a0) * i) / 10;
      circle(
        image,
        cx + Math.cos(angle) * (r - thickness / 2),
        cy + Math.sin(angle) * (r - thickness / 2),
        thickness * 0.7,
        color,
      );
    }
  }
}

function curve(image, p0, p1, p2, p3, color, radius) {
  let last = null;
  for (let i = 0; i <= 36; i += 1) {
    const t = i / 36;
    const u = 1 - t;
    const x = u ** 3 * p0[0] + 3 * u ** 2 * t * p1[0] + 3 * u * t ** 2 * p2[0] + t ** 3 * p3[0];
    const y = u ** 3 * p0[1] + 3 * u ** 2 * t * p1[1] + 3 * u * t ** 2 * p2[1] + t ** 3 * p3[1];
    if (!last || Math.hypot(x - last[0], y - last[1]) >= Math.max(1, radius)) {
      circle(image, x, y, radius, color);
      last = [x, y];
    }
  }
}

function glow(image, cx, cy, radius, colorHex) {
  for (let i = 8; i >= 1; i -= 1) {
    const alpha = Math.round(18 + (8 - i) * 10);
    circle(image, cx, cy, radius * (i / 8), rgba(colorHex, Math.min(255, alpha)));
  }
}

function luminance(image, x, y) {
  const px = Math.max(1, Math.min(image.width, Math.round(x)));
  const py = Math.max(1, Math.min(image.height, Math.round(y)));
  const color = image.getPixelAt(px, py) >>> 0;
  const alpha = color & 255;
  if (alpha < 24) return 0;
  const r = (color >>> 24) & 255;
  const g = (color >>> 16) & 255;
  const b = (color >>> 8) & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function coverTop(image, width, height) {
  const source = image.clone();
  const scale = width / height > source.width / source.height ? width / source.width : height / source.height;
  source.scale(scale);
  const x = Math.max(0, Math.floor((source.width - width) / 2));
  const y = Math.max(0, Math.floor((source.height - height) * 0.16));
  return source.crop(x, y, Math.min(width, source.width - x), Math.min(height, source.height - y));
}

function monogram(Image, name, width, height) {
  const image = new Image(width, height);
  image.fill(BONE);
  const letter = (String(name || "E").trim()[0] || "E").toUpperCase();
  const scale = Math.max(2, Math.floor(Math.min(width, height) / 12));
  const w = textWidth(letter, scale);
  drawText(image, letter, Math.round((width - w) / 2), Math.round((height - 7 * scale) / 2), scale, INK);
  return image;
}

function halftone(image, source, originX, originY, width, height, cell) {
  const covered = coverTop(source, width, height);
  for (let y = 0; y < covered.height; y += cell) {
    const shift = (Math.floor(y / cell) % 2) * cell * 0.5;
    for (let x = -cell; x < covered.width; x += cell) {
      const raw = luminance(covered, x + shift + cell / 2, y + cell / 2);
      const stretched = Math.min(1, Math.max(0, (raw - 0.08) / 0.78));
      const darkness = Math.pow(1 - stretched, 0.72);
      const radius = Math.max(cell * 0.1, darkness * cell * 0.56);
      circle(image, originX + x + shift + cell / 2, originY + y + cell / 2, radius, INK);
    }
  }
}

function fadeBottom(image, startY, toward) {
  for (let y = Math.max(0, Math.floor(startY)); y < image.height; y += 1) {
    const t = (y - startY) / Math.max(1, image.height - startY);
    for (let x = 0; x < image.width; x += 1) {
      const current = image.getPixelAt(x + 1, y + 1);
      image.setPixelAt(x + 1, y + 1, mix(current, toward, Math.min(1, t)));
    }
  }
}

function ticks(image, x, y, width, scale, color) {
  const count = 9;
  for (let i = 0; i < count; i += 1) {
    const tx = x + (width * i) / (count - 1);
    const tall = i % 2 === 0;
    box(image, tx, y, Math.max(1, scale), (tall ? 8 : 5) * scale, color);
    if (tall) drawText(image, String(i), tx - scale, y + 10 * scale, scale, color);
  }
}

let imageScriptPromise;
function imageScript() {
  if (!imageScriptPromise) imageScriptPromise = loadImageScript();
  return imageScriptPromise;
}

let noviPromise;
export function loadNoviImage() {
  if (!noviPromise) {
    noviPromise = (async () => {
      const { Image } = await imageScript();
      const url = new URL("./novi-cutout.png", import.meta.url);
      let bytes;
      if (typeof Deno !== "undefined" && Deno.readFile) bytes = await Deno.readFile(url);
      else {
        const { readFile } = await import("node:fs/promises");
        bytes = new Uint8Array(await readFile(url));
      }
      return Image.decode(bytes);
    })();
  }
  return noviPromise;
}

async function decodePhoto(bytes) {
  if (!bytes) return null;
  try {
    const { Image } = await imageScript();
    return await Image.decode(bytes);
  } catch {
    return null;
  }
}

function strokeRect(image, x, y, w, h, color, thickness) {
  const t = Math.max(1, Math.round(thickness));
  box(image, x, y, w, t, color);
  box(image, x, y + h - t, w, t, color);
  box(image, x, y, t, h, color);
  box(image, x + w - t, y, t, h, color);
}

function flattenCommands(commands, steps) {
  const contours = [];
  let current = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  for (const cmd of commands) {
    if (cmd.type === "M") {
      if (current.length > 2) contours.push(current);
      current = [[cmd.x, cmd.y]];
      cx = cmd.x;
      cy = cmd.y;
      sx = cx;
      sy = cy;
    } else if (cmd.type === "L") {
      current.push([cmd.x, cmd.y]);
      cx = cmd.x;
      cy = cmd.y;
    } else if (cmd.type === "Q" || cmd.type === "C") {
      const x0 = cx;
      const y0 = cy;
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        const u = 1 - t;
        const x = cmd.type === "Q"
          ? u * u * x0 + 2 * u * t * cmd.x1 + t * t * cmd.x
          : u ** 3 * x0 + 3 * u ** 2 * t * cmd.x1 + 3 * u * t ** 2 * cmd.x2 + t ** 3 * cmd.x;
        const y = cmd.type === "Q"
          ? u * u * y0 + 2 * u * t * cmd.y1 + t * t * cmd.y
          : u ** 3 * y0 + 3 * u ** 2 * t * cmd.y1 + 3 * u * t ** 2 * cmd.y2 + t ** 3 * cmd.y;
        current.push([x, y]);
      }
      cx = cmd.x;
      cy = cmd.y;
    } else if (cmd.type === "Z") {
      if (current.length > 2) contours.push(current);
      current = [];
      cx = sx;
      cy = sy;
    }
  }
  if (current.length > 2) contours.push(current);
  return contours;
}

function fillContours(image, contours, color) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const points of contours) {
    for (const point of points) {
      if (point[1] < minY) minY = point[1];
      if (point[1] > maxY) maxY = point[1];
    }
  }
  if (!Number.isFinite(minY)) return;
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(image.height - 1, Math.ceil(maxY));
  for (let y = y0; y <= y1; y += 1) {
    const xs = [];
    for (const points of contours) {
      for (let i = 0; i < points.length; i += 1) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
          const t = (y - y1) / (y2 - y1);
          xs.push(x1 + t * (x2 - x1));
        }
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const left = Math.max(0, Math.ceil(xs[i]));
      const right = Math.min(image.width - 1, Math.floor(xs[i + 1]));
      if (right >= left) box(image, left, y, right - left + 1, 1, color);
    }
  }
}

function downsample(Image, image, factor) {
  const width = Math.floor(image.width / factor);
  const height = Math.floor(image.height / factor);
  const out = new Image(Math.max(1, width), Math.max(1, height));
  const area = factor * factor;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      for (let dy = 0; dy < factor; dy += 1) {
        for (let dx = 0; dx < factor; dx += 1) {
          const color = image.getPixelAt(x * factor + dx + 1, y * factor + dy + 1) >>> 0;
          const px = color & 255;
          red += ((color >>> 24) & 255) * px;
          green += ((color >>> 16) & 255) * px;
          blue += ((color >>> 8) & 255) * px;
          alpha += px;
        }
      }
      const summed = Math.round(alpha / area);
      if (!summed || !alpha) continue;
      out.setPixelAt(x + 1, y + 1, (
        (Math.round(red / alpha) << 24)
        | (Math.round(green / alpha) << 16)
        | (Math.round(blue / alpha) << 8)
        | summed
      ) >>> 0);
    }
  }
  return out;
}

async function loadOpentype() {
  try {
    const mod = await import("opentype.js");
    return mod.parse ? mod : mod.default;
  } catch {
    const mod = await import("npm:opentype.js@1.3.4");
    return mod.parse ? mod : mod.default;
  }
}

async function readSharedBytes(name) {
  const url = new URL(name, import.meta.url);
  if (typeof Deno !== "undefined" && Deno.readFile) return Deno.readFile(url);
  const { readFile } = await import("node:fs/promises");
  return new Uint8Array(await readFile(url));
}

let fontPromise;
function plateFont() {
  if (!fontPromise) {
    fontPromise = (async () => {
      const opentype = await loadOpentype();
      const bytes = await readSharedBytes("./space-grotesk-700.ttf");
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      return opentype.parse(buffer);
    })();
  }
  return fontPromise;
}

function rasterText(Image, font, text, fontSize, color, tracking = 0) {
  const value = String(text || "");
  const size = Math.max(6, fontSize);
  const advance = Math.ceil(font.getAdvanceWidth(value, size, { letterSpacing: tracking }));
  const ascent = Math.ceil((font.ascender / font.unitsPerEm) * size) + 2;
  const descent = Math.ceil((-font.descender / font.unitsPerEm) * size) + 2;
  const width = Math.max(1, advance + 2);
  const height = Math.max(1, ascent + descent);
  const sample = 2;
  const path = font.getPath(value, 1, ascent, size, { letterSpacing: tracking });
  const contours = flattenCommands(path.commands, 6).map((points) => (
    points.map(([x, y]) => [x * sample, y * sample])
  ));
  const big = new Image(width * sample, height * sample);
  fillContours(big, contours, color);
  return downsample(Image, big, sample);
}

function fittedSize(font, text, maxWidth, tracking, start) {
  let size = start;
  while (size > 8 && font.getAdvanceWidth(text, size, { letterSpacing: tracking }) > maxWidth) size -= 1;
  return size;
}

async function loadQrCode() {
  try {
    const mod = await import("qrcode");
    return mod.create ? mod : mod.default;
  } catch {
    const mod = await import("npm:qrcode@1.5.4");
    return mod.create ? mod : mod.default;
  }
}

function drawQr(image, code, x, y, size, dark, light) {
  const modules = code.modules;
  const count = modules.size;
  const quiet = 2;
  const cells = count + quiet * 2;
  const cell = Math.max(1, Math.floor(size / cells));
  const drawn = cell * cells;
  const originX = Math.round(x + (size - drawn) / 2);
  const originY = Math.round(y + (size - drawn) / 2);
  box(image, Math.round(x), Math.round(y), size, size, light);
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (!modules.get(row, col)) continue;
      box(image, originX + (col + quiet) * cell, originY + (row + quiet) * cell, cell, cell, dark);
    }
  }
}

/**
 * storeCard strip. 375×123 pt at @1x, @2x, and @3x.
 * The name stays in the pass fields. This image is only the photo crop.
 */
export async function renderEtherStrip(card, { scale = 1, photo = null, novi = null } = {}) {
  const { Image } = await imageScript();
  const font = await plateFont();
  const s = scale;
  const width = STRIP_PT.width * s;
  const height = STRIP_PT.height * s;
  const image = new Image(width, height);
  const banned = walletStatus(card.status) === "BANNED";
  const edge = banned ? ALERT : BUBBLE;
  image.fill(banned ? rgba("#140406") : rgba("#101014"));
  const railW = Math.round(118 * s);
  box(image, 0, 0, railW, height, banned ? rgba("#2a1218") : rgba("#24242c"));
  box(image, 0, 0, width, Math.max(1, Math.round(2 * s)), rgba("#ffffff", 42));

  const photoX = railW + Math.round(6 * s);
  const photoY = Math.round(7 * s);
  const photoW = width - photoX - Math.round(7 * s);
  const photoH = height - photoY * 2;
  const portrait = (await decodePhoto(photo)) || monogram(Image, card.display_name, photoW, photoH);
  const covered = coverTop(portrait, photoW, photoH);
  if (covered.width !== photoW || covered.height !== photoH) covered.resize(photoW, photoH);
  image.composite(covered, photoX, photoY);

  const noviSource = novi || await loadNoviImage();
  const noviH = Math.round(30 * s);
  const noviW = Math.max(1, Math.round(noviH * (noviSource.width / noviSource.height)));
  const noviX = Math.round((railW - noviW) / 2);
  const noviY = height - noviH - Math.round(8 * s);
  glow(image, noviX + noviW * 0.5, noviY + noviH * 0.48, 14 * s, banned ? NUANCE.alert : NUANCE.bubble);
  const mark = noviSource.clone();
  mark.resize(noviW, noviH);
  image.composite(mark, noviX, noviY);

  if (banned) {
    const bandH = Math.max(14, Math.round(16 * s));
    const bandY = Math.round(photoY + (photoH - bandH) / 2);
    box(image, photoX, bandY, photoW, bandH, rgba(NUANCE.alert, 235));
    const labelSize = fittedSize(font, "BANNED", photoW - 16 * s, 0.16, Math.round(11 * s));
    const label = rasterText(Image, font, "BANNED", labelSize, rgba("#ffffff"), 0.16);
    image.composite(
      label,
      Math.round(photoX + (photoW - label.width) / 2),
      Math.round(bandY + (bandH - label.height) / 2),
    );
  }

  const inset = Math.round(2 * s);
  const thick = Math.max(2, Math.round(2 * s));
  strokeRect(image, inset, inset, width - inset * 2, height - inset * 2, edge, thick);
  strokeRect(image, photoX, photoY, photoW, photoH, edge, Math.max(1, Math.round(s)));
  box(image, railW, photoY, Math.max(1, Math.round(s)), photoH, edge);

  const tracking = 0.16;
  const wordMax = noviY - Math.round(12 * s);
  const wordSize = fittedSize(font, "FAMILCY", wordMax, tracking, Math.round(15 * s));
  const word = rasterText(Image, font, "FAMILCY", wordSize, BONE, tracking);
  word.rotate(90);
  const wordX = Math.round((railW - word.width) / 2);
  const wordY = Math.round((noviY - word.height) / 2);
  image.composite(word, Math.max(inset + thick, wordX), Math.max(inset + thick, wordY));
  return image.encode();
}

function iconImage(Image, size, banned) {
  const image = new Image(size, size);
  image.fill(banned ? rgba(NUANCE.bgBanned) : INK);
  const scale = Math.max(1, Math.floor(size / 11));
  const w = textWidth("E", scale);
  drawText(image, "E", Math.round((size - w) / 2), Math.round((size - 7 * scale) / 2) - scale, scale, BONE);
  box(image, Math.round(size * 0.18), Math.round(size * 0.78), Math.round(size * 0.64), Math.max(2, Math.round(size * 0.08)), banned ? ALERT : BUBBLE);
  return image;
}

function logoImage(Image, width, height, banned) {
  const image = new Image(width, height);
  image.fill(0);
  const scale = Math.max(1, Math.floor(height / 9));
  const w = textWidth("ETHER", scale);
  const x = Math.max(0, Math.round((width - w) / 2));
  const y = Math.max(0, Math.round((height - 7 * scale) / 2) - scale);
  drawText(image, "ETHER", x, y, scale, BONE);
  box(image, x, y + 7 * scale + scale, w, Math.max(1, Math.round(scale * 0.45)), banned ? ALERT : BUBBLE);
  return image;
}

export async function etherIdImages(card, options = {}) {
  const { Image } = await imageScript();
  const banned = walletStatus(card.status) === "BANNED";
  const strips = await Promise.all([1, 2, 3].map(async (scale) => ({
    name: scale === 1 ? "strip.png" : `strip@${scale}x.png`,
    data: await renderEtherStrip(card, { ...options, scale }),
  })));
  const icons = [1, 2, 3].map((scale) => ({
    name: scale === 1 ? "icon.png" : `icon@${scale}x.png`,
    data: null,
    scale,
    kind: "icon",
  }));
  const logos = [1, 2, 3].map((scale) => ({
    name: scale === 1 ? "logo.png" : `logo@${scale}x.png`,
    data: null,
    scale,
    kind: "logo",
  }));
  const files = [];
  for (const file of [...icons, ...logos]) {
    const image = file.kind === "icon"
      ? iconImage(Image, 29 * file.scale, banned)
      : logoImage(Image, 160 * file.scale, 50 * file.scale, banned);
    files.push({ name: file.name, data: await image.encode() });
  }
  return [...files, ...strips];
}

export async function renderWalletPreview(card, { strip, photo = null, verifyUrl = "" } = {}) {
  const { Image } = await imageScript();
  const font = await plateFont();
  const banned = walletStatus(card.status) === "BANNED";
  const ground = banned ? rgba(NUANCE.bgBanned) : INK;
  const label = banned ? ALERT : BUBBLE;
  const width = 820;
  const height = 1040;
  const image = new Image(width, height);
  image.fill(rgba("#000000"));
  const passX = 35;
  const passY = 36;
  const passW = 750;
  box(image, passX, passY, passW, 968, ground);

  const title = rasterText(Image, font, "ETHER", 28, BONE, 0.12);
  image.composite(title, passX + 28, passY + 22);
  const status = walletStatus(card.status);
  const statusPlate = rasterText(Image, font, status, 18, label, 0.14);
  image.composite(statusPlate, passX + passW - 28 - statusPlate.width, passY + 28);
  box(image, passX + 24, passY + 70, passW - 48, 3, label);

  const stripImage = strip ? await Image.decode(strip) : await Image.decode(await renderEtherStrip(card, { scale: 2, photo }));
  image.composite(stripImage, passX, passY + 78);

  const rows = [
    ["USERNAME", card.username ? `@${String(card.username).replace(/^@+/, "")}` : "NO USERNAME"],
    ["PASSION", card.passion || "—"],
    ["REVIEWS", walletReviewValue(card)],
    ["PROJECTS", card.projects_label || "0 completed"],
    ["JOINED", card.member_since_label || "—"],
  ];
  if (card.birthday_label) rows.push(["BIRTHDAY", card.birthday_label]);
  rows.forEach((row, index) => {
    const y = passY + 352 + index * 48;
    const name = rasterText(Image, font, row[0], 14, label, 0.12);
    const value = rasterText(Image, font, row[1], 16, BONE, 0.02);
    image.composite(name, passX + 28, y);
    image.composite(value, passX + 230, y);
  });

  const codeSize = 176;
  const codeX = passX + Math.round((passW - codeSize) / 2);
  const codeY = passY + 680;
  const qr = await loadQrCode();
  const message = verifyUrl || "https://etherbylcove.com/id";
  drawQr(image, qr.create(message, { errorCorrectionLevel: "M" }), codeX, codeY, codeSize, rgba("#141416"), BONE);
  const verify = rasterText(Image, font, "VERIFY", 13, BONE_DIM, 0.18);
  image.composite(verify, Math.round(passX + (passW - verify.width) / 2), codeY + codeSize + 12);
  return image.encode();
}

export function countAlertPixels(image) {
  let count = 0;
  for (let y = 1; y <= image.height; y += 2) {
    for (let x = 1; x <= image.width; x += 2) {
      const color = image.getPixelAt(x, y) >>> 0;
      const r = (color >>> 24) & 255;
      const g = (color >>> 16) & 255;
      const b = (color >>> 8) & 255;
      if (r > 200 && g < 100 && b < 120) count += 1;
    }
  }
  return count;
}

export async function decodePng(bytes) {
  const { Image } = await imageScript();
  return Image.decode(bytes);
}
