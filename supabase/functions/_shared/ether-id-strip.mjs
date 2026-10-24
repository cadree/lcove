import { personnelName, walletReviewValue, walletStatus } from "./ether-id-pass-json.mjs";
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
const SCAN = rgba(NUANCE.scan);
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
  image.fill(INK);
  const letter = (String(name || "E").trim()[0] || "E").toUpperCase();
  const scale = Math.max(2, Math.floor(Math.min(width, height) / 12));
  const w = textWidth(letter, scale);
  drawText(image, letter, Math.round((width - w) / 2), Math.round((height - 7 * scale) / 2), scale, BONE);
  return image;
}

function halftone(image, source, originX, originY, width, height, cell, banned) {
  const covered = coverTop(source, width, height);
  for (let y = 0; y < covered.height; y += cell) {
    for (let x = 0; x < covered.width; x += cell) {
      const raw = luminance(covered, x + cell / 2, y + cell / 2);
      const light = Math.pow(Math.min(1, raw * 2.2), 0.5);
      const radius = Math.max(light * cell * 0.5, raw > 0.035 ? cell * 0.22 : 0);
      if (radius < 0.45) continue;
      let color = BONE;
      if (banned && light < 0.45) color = ALERT;
      else if (light > 0.78) color = SCAN;
      else if (light < 0.42) color = BUBBLE;
      circle(image, originX + x + cell / 2, originY + y + cell / 2, radius, color);
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

/**
 * storeCard strip. 375×123 pt at @1x, @2x, and @3x.
 * Apple draws the member name on the lower part of this image.
 */
export async function renderEtherStrip(card, { scale = 1, photo = null, novi = null } = {}) {
  const { Image } = await imageScript();
  const s = scale;
  const width = STRIP_PT.width * s;
  const height = STRIP_PT.height * s;
  const image = new Image(width, height);
  const banned = walletStatus(card.status) === "BANNED";
  const ground = banned ? rgba(NUANCE.bgBanned) : INK;
  image.fill(ground);

  const photoX = 7 * s;
  const photoY = 7 * s;
  const photoW = 112 * s;
  const photoH = height - 14 * s;
  const portrait = (await decodePhoto(photo)) || monogram(Image, card.display_name, photoW, photoH);
  halftone(image, portrait, photoX, photoY, photoW, photoH, Math.max(2, 3 * s), banned);
  fadeBottom(image, height * 0.7, ground);

  const noviSource = novi || await loadNoviImage();
  const noviH = 74 * s;
  const noviW = Math.max(1, Math.round(noviH * (noviSource.width / noviSource.height)));
  const noviX = width - noviW - 8 * s;
  const noviY = 6 * s;
  const mark = noviSource.clone();
  mark.resize(noviW, noviH);
  const glowColor = banned ? NUANCE.alert : NUANCE.bubble;
  glow(image, noviX + noviW * 0.5, noviY + noviH * 0.42, 34 * s, glowColor);
  if (!banned) glow(image, noviX + noviW * 0.2, noviY + noviH * 0.7, 16 * s, NUANCE.scan);
  image.composite(mark, noviX, noviY);

  const frame = banned ? ALERT : BONE;
  const glowFrame = banned ? rgba(NUANCE.alert, 150) : rgba(NUANCE.bubble, 140);
  strokeRoundRect(image, 5 * s, 5 * s, 116 * s, height - 10 * s, 10 * s, glowFrame, Math.max(2, 2 * s));
  strokeRoundRect(image, 5 * s, 5 * s, 116 * s, height - 10 * s, 10 * s, frame, Math.max(1, s));
  strokeRoundRect(image, 128 * s, 6 * s, width - 136 * s, 76 * s, 10 * s, glowFrame, Math.max(2, 2 * s));
  strokeRoundRect(image, 128 * s, 6 * s, width - 136 * s, 76 * s, 10 * s, frame, Math.max(1, s));
  curve(
    image,
    [118 * s, 36 * s],
    [124 * s, 58 * s],
    [122 * s, 28 * s],
    [132 * s, 58 * s],
    glowFrame,
    Math.max(1.4, 1.6 * s),
  );
  curve(
    image,
    [118 * s, 36 * s],
    [124 * s, 58 * s],
    [122 * s, 28 * s],
    [132 * s, 58 * s],
    frame,
    Math.max(0.8, s * 0.7),
  );

  const wordScale = 4 * s;
  drawText(image, "ETHER", 136 * s, 12 * s, wordScale, BONE);

  const hexY = 50 * s;
  const hexes = [
    [148 * s, hexY, 7 * s, rgba(NUANCE.faint, 230)],
    [162 * s, hexY + 6 * s, 5 * s, rgba(NUANCE.boneDim, 180)],
    [136 * s, hexY + 8 * s, 4 * s, rgba(NUANCE.scan, banned ? 80 : 200)],
    [174 * s, hexY - 4 * s, 3.5 * s, rgba(NUANCE.bubble, banned ? 90 : 210)],
    [186 * s, hexY + 7 * s, 4 * s, FAINT],
  ];
  for (const [hx, hy, hr, color] of hexes) hexagon(image, hx, hy, hr, color);

  if (banned) {
    drawText(image, "BANNED", 136 * s, 62 * s, 3 * s, ALERT);
    box(image, 136 * s, 84 * s, textWidth("BANNED", 3 * s), Math.max(1, s), ALERT);
  } else {
    ticks(image, 140 * s, 64 * s, 150 * s, Math.max(1, s), BONE_DIM);
  }

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

export async function renderWalletPreview(card, { strip, photo = null } = {}) {
  const { Image } = await imageScript();
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

  drawText(image, "ETHER", passX + 28, passY + 28, 4, BONE);
  const status = walletStatus(card.status);
  drawText(image, status, passX + passW - 28 - textWidth(status, 3), passY + 34, 3, label);

  const stripImage = strip ? await Image.decode(strip) : await Image.decode(await renderEtherStrip(card, { scale: 2, photo }));
  image.composite(stripImage, passX, passY + 78);
  const name = personnelName(card.display_name);
  const nameScale = name.length > 16 ? 4 : 5;
  drawText(image, name, passX + 28, passY + 78 + 246 - 8 - 7 * nameScale, nameScale, BONE);

  const rows = [
    ["USERNAME", card.username ? `@${String(card.username).replace(/^@+/, "")}` : "NO USERNAME"],
    ["PASSION", card.passion || "—"],
    ["REVIEWS", walletReviewValue(card)],
    ["PROJECTS", card.projects_label || "0 completed"],
    ["JOINED", card.member_since_label || "—"],
  ];
  if (card.birthday_label) rows.push(["BIRTHDAY", card.birthday_label]);
  rows.forEach((row, index) => {
    const y = passY + 360 + index * 52;
    drawText(image, row[0], passX + 28, y, 2, label);
    drawText(image, row[1], passX + 210, y, 2, BONE);
  });

  const codeY = passY + 760;
  box(image, passX + (passW - 180) / 2, codeY, 180, 180, BONE);
  box(image, passX + (passW - 180) / 2 + 16, codeY + 16, 148, 148, INK);
  drawText(image, "QR", passX + (passW - textWidth("QR", 4)) / 2, codeY + 70, 4, BONE);
  const verify = "VERIFY";
  drawText(image, verify, passX + (passW - textWidth(verify, 2)) / 2, codeY + 192, 2, BONE_DIM);
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
