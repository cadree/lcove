// Store-card strip for the Ether ID. Wallet allots 375×144 points.
// Drawn at 6× and boxed down so @3x, @2x, and @1x stay aligned.
// Fraunces for the name and mark, DM Mono for the kicker, handle, and chip.

import { FRAUNCES_LATIN, FRAUNCES_LATIN_EXT, DM_MONO } from "./ether-id-pass-fonts.mjs";
import { decodeEtherIdPhoto } from "./ether-id-pass-photo.mjs";
import { etherIdStripCopy } from "./ether-id-pass-json.mjs";

const SCALE = 6;
const WIDTH = 375 * SCALE;
const HEIGHT = 144 * SCALE;

export const STRIP_PHOTO = { x: 8, y: 8, w: 92, h: 128 };
export const STRIP_FILES = [
  { name: "strip.png", width: 375, height: 144, factor: 6 },
  { name: "strip@2x.png", width: 750, height: 288, factor: 3 },
  { name: "strip@3x.png", width: 1125, height: 432, factor: 2 },
];

const WARM = [16, 14, 12];
const INK = [8, 8, 10];
const CREAM = [236, 231, 220];
const RED = [196, 20, 45];
const HANDLE = [185, 180, 168];
const FRAME = [58, 52, 46];

let fontsPromise;

function decodeBase64(value) {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i) & 255;
  return out;
}

async function opentypeLib() {
  try {
    const mod = await import("opentype.js");
    return mod.default ?? mod;
  } catch {
    const mod = await import("npm:opentype.js@1.3.4");
    return mod.default ?? mod;
  }
}

async function pngEncode() {
  try {
    const mod = await import("fast-png");
    return mod.encode ?? mod.default?.encode;
  } catch {
    const mod = await import("npm:fast-png@6.4.0");
    return mod.encode ?? mod.default?.encode;
  }
}

function parseFont(opentype, b64) {
  const bytes = decodeBase64(b64);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return opentype.parse(buffer);
}

function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const opentype = await opentypeLib();
      return {
        serif: [parseFont(opentype, FRAUNCES_LATIN), parseFont(opentype, FRAUNCES_LATIN_EXT)],
        mono: [parseFont(opentype, DM_MONO)],
      };
    })();
  }
  return fontsPromise;
}

function pick(fonts, kind, char) {
  const list = kind === "mono" ? fonts.mono : fonts.serif;
  for (const font of list) {
    if (!font.hasChar(char)) continue;
    const glyph = font.charToGlyph(char);
    if (glyph && glyph.index !== 0) return { font, glyph };
  }
  return null;
}

function shape(fonts, kind, text, fontSize, trackingEm, color) {
  const tracking = trackingEm * fontSize;
  const run = [];
  let prev = null;
  for (const char of text) {
    const found = pick(fonts, kind, char);
    if (!found) continue;
    const scale = fontSize / found.font.unitsPerEm;
    let kern = 0;
    if (prev && prev.font === found.font) {
      kern = found.font.getKerningValue(prev.glyph, found.glyph) * scale;
    }
    run.push({
      font: found.font,
      glyph: found.glyph,
      fontSize,
      color,
      advance: found.glyph.advanceWidth * scale,
      tracking,
      kern,
    });
    prev = found;
  }
  return run;
}

function runWidth(run) {
  if (!run.length) return 0;
  let width = 0;
  for (const item of run) width += item.kern + item.advance + item.tracking;
  return width - run[run.length - 1].tracking;
}

function fit(fonts, kind, text, size, min, trackingEm, color, maxWidth) {
  let current = size;
  while (current >= min) {
    const run = shape(fonts, kind, text, current, trackingEm, color);
    if (runWidth(run) <= maxWidth) return run;
    const next = Math.round(current * 0.92);
    if (next === current) break;
    current = next;
  }
  let cut = text;
  while (cut.length > 1) {
    cut = cut.slice(0, -1).trimEnd();
    const run = shape(fonts, kind, `${cut}...`, min, trackingEm, color);
    if (runWidth(run) <= maxWidth) return run;
  }
  return shape(fonts, kind, text.slice(0, 1), min, trackingEm, color);
}

function flatten(commands, steps) {
  const contours = [];
  let points = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  const push = (fn) => {
    for (let i = 1; i <= steps; i += 1) points.push(fn(i / steps));
  };
  for (const cmd of commands) {
    if (cmd.type === "M") {
      if (points.length) contours.push(points);
      points = [[cmd.x, cmd.y]];
      sx = cx = cmd.x;
      sy = cy = cmd.y;
    } else if (cmd.type === "L") {
      points.push([cmd.x, cmd.y]);
      cx = cmd.x;
      cy = cmd.y;
    } else if (cmd.type === "Q") {
      const x0 = cx;
      const y0 = cy;
      push((t) => {
        const m = 1 - t;
        return [
          m * m * x0 + 2 * m * t * cmd.x1 + t * t * cmd.x,
          m * m * y0 + 2 * m * t * cmd.y1 + t * t * cmd.y,
        ];
      });
      cx = cmd.x;
      cy = cmd.y;
    } else if (cmd.type === "C") {
      const x0 = cx;
      const y0 = cy;
      push((t) => {
        const m = 1 - t;
        return [
          m * m * m * x0 + 3 * m * m * t * cmd.x1 + 3 * m * t * t * cmd.x2 + t * t * t * cmd.x,
          m * m * m * y0 + 3 * m * m * t * cmd.y1 + 3 * m * t * t * cmd.y2 + t * t * t * cmd.y,
        ];
      });
      cx = cmd.x;
      cy = cmd.y;
    } else if (cmd.type === "Z") {
      points.push([sx, sy]);
      contours.push(points);
      points = [];
      cx = sx;
      cy = sy;
    }
  }
  if (points.length) contours.push(points);
  return contours;
}

function drawGlyph(buf, bw, bh, glyph, fontSize, penX, penY, color) {
  const path = glyph.getPath(penX, penY, fontSize);
  const box = path.getBoundingBox();
  if (!Number.isFinite(box.x1) || !Number.isFinite(box.y1)) return;
  const steps = Math.max(6, Math.round(fontSize / 14));
  const contours = flatten(path.commands, steps);
  const edges = [];
  for (const pts of contours) {
    for (let i = 0; i < pts.length - 1; i += 1) {
      let [x0, y0] = pts[i];
      let [x1, y1] = pts[i + 1];
      if (y0 === y1) continue;
      let dir = 1;
      if (y0 > y1) {
        [x0, x1] = [x1, x0];
        [y0, y1] = [y1, y0];
        dir = -1;
      }
      edges.push({ y0, y1, x0, slope: (x1 - x0) / (y1 - y0), dir });
    }
  }
  const yStart = Math.max(0, Math.floor(box.y1));
  const yEnd = Math.min(bh - 1, Math.ceil(box.y2));
  const xMin = Math.max(0, Math.floor(box.x1) - 1);
  const xMax = Math.min(bw - 1, Math.ceil(box.x2) + 1);
  for (let y = yStart; y <= yEnd; y += 1) {
    const scan = y + 0.5;
    const hits = [];
    for (const edge of edges) {
      if (scan >= edge.y0 && scan < edge.y1) {
        hits.push({ x: edge.x0 + (scan - edge.y0) * edge.slope, dir: edge.dir });
      }
    }
    if (hits.length < 2) continue;
    hits.sort((a, b) => a.x - b.x);
    let wind = 0;
    let start = 0;
    for (const hit of hits) {
      const next = wind + hit.dir;
      if (wind === 0 && next !== 0) start = hit.x;
      else if (wind !== 0 && next === 0) {
        const from = Math.max(xMin, Math.floor(start));
        const to = Math.min(xMax, Math.floor(hit.x));
        let index = (y * bw + from) * 4;
        for (let x = from; x <= to; x += 1) {
          buf[index] = color[0];
          buf[index + 1] = color[1];
          buf[index + 2] = color[2];
          buf[index + 3] = 255;
          index += 4;
        }
      }
      wind = next;
    }
  }
}

function paintRun(buf, bw, bh, run, x, baseline) {
  let pen = x;
  for (const item of run) {
    pen += item.kern;
    drawGlyph(buf, bw, bh, item.glyph, item.fontSize, pen, baseline, item.color);
    pen += item.advance + item.tracking;
  }
}

function fillRect(buf, bw, bh, x, y, rw, rh, color) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(bw, Math.round(x + rw));
  const y1 = Math.min(bh, Math.round(y + rh));
  for (let yy = y0; yy < y1; yy += 1) {
    let index = (yy * bw + x0) * 4;
    for (let xx = x0; xx < x1; xx += 1) {
      buf[index] = color[0];
      buf[index + 1] = color[1];
      buf[index + 2] = color[2];
      buf[index + 3] = 255;
      index += 4;
    }
  }
}

function paintBackground(buf) {
  const cx = WIDTH * 0.32;
  const cy = HEIGHT * 0.5;
  const rx = WIDTH * 0.42;
  const ry = HEIGHT * 0.7;
  for (let y = 0; y < HEIGHT; y += 1) {
    const dy = (y - cy) / ry;
    const dy2 = dy * dy;
    let index = y * WIDTH * 4;
    for (let x = 0; x < WIDTH; x += 1) {
      const dx = (x - cx) / rx;
      const dist = dx * dx + dy2;
      let r = WARM[0];
      let g = WARM[1];
      let b = WARM[2];
      if (dist < 1) {
        const t = (1 - dist) * (1 - dist) * 0.1;
        r += (255 - r) * t;
        g += (179 - g) * t;
        b += (209 - b) * t;
      }
      buf[index] = r;
      buf[index + 1] = g;
      buf[index + 2] = b;
      buf[index + 3] = 255;
      index += 4;
    }
  }
}

function blitCover(buf, rect, photo) {
  const sw = photo.width;
  const sh = photo.height;
  const src = photo.data;
  const scale = Math.max(rect.w / sw, rect.h / sh);
  const cropW = rect.w / scale;
  const cropH = rect.h / scale;
  const sx0 = (sw - cropW) * 0.5;
  const sy0 = (sh - cropH) * 0.2;
  const x0 = Math.max(0, Math.round(rect.x));
  const y0 = Math.max(0, Math.round(rect.y));
  const x1 = Math.min(WIDTH, Math.round(rect.x + rect.w));
  const y1 = Math.min(HEIGHT, Math.round(rect.y + rect.h));
  for (let y = y0; y < y1; y += 1) {
    const sy = Math.min(sh - 1, Math.max(0, sy0 + ((y - rect.y + 0.5) * cropH) / rect.h));
    const ys = Math.floor(sy);
    const yb = Math.min(sh - 1, ys + 1);
    const ty = sy - ys;
    for (let x = x0; x < x1; x += 1) {
      const sx = Math.min(sw - 1, Math.max(0, sx0 + ((x - rect.x + 0.5) * cropW) / rect.w));
      const xs = Math.floor(sx);
      const xb = Math.min(sw - 1, xs + 1);
      const tx = sx - xs;
      const i00 = (ys * sw + xs) * 4;
      const i10 = (ys * sw + xb) * 4;
      const i01 = (yb * sw + xs) * 4;
      const i11 = (yb * sw + xb) * 4;
      const index = (y * WIDTH + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        const top = src[i00 + c] * (1 - tx) + src[i10 + c] * tx;
        const bottom = src[i01 + c] * (1 - tx) + src[i11 + c] * tx;
        buf[index + c] = Math.round(top * (1 - ty) + bottom * ty);
      }
      buf[index + 3] = 255;
    }
  }
  const fadeFrom = Math.round(rect.y + rect.h * 0.72);
  for (let y = fadeFrom; y < y1; y += 1) {
    const t = ((y - fadeFrom) / (y1 - fadeFrom)) ** 2 * 0.5;
    for (let x = x0; x < x1; x += 1) {
      const index = (y * WIDTH + x) * 4;
      buf[index] = Math.round(buf[index] * (1 - t) + INK[0] * t);
      buf[index + 1] = Math.round(buf[index + 1] * (1 - t) + INK[1] * t);
      buf[index + 2] = Math.round(buf[index + 2] * (1 - t) + INK[2] * t);
    }
  }
}

function framePhoto(buf, rect) {
  const t = 1.4 * SCALE;
  fillRect(buf, WIDTH, HEIGHT, rect.x, rect.y, rect.w, t, FRAME);
  fillRect(buf, WIDTH, HEIGHT, rect.x, rect.y + rect.h - t, rect.w, t, FRAME);
  fillRect(buf, WIDTH, HEIGHT, rect.x, rect.y, t, rect.h, FRAME);
  fillRect(buf, WIDTH, HEIGHT, rect.x + rect.w - t, rect.y, t, rect.h, FRAME);
  const arm = 11 * SCALE;
  const thick = 1.6 * SCALE;
  fillRect(buf, WIDTH, HEIGHT, rect.x - thick * 0.3, rect.y - thick * 0.3, arm, thick, RED);
  fillRect(buf, WIDTH, HEIGHT, rect.x - thick * 0.3, rect.y - thick * 0.3, thick, arm, RED);
  fillRect(buf, WIDTH, HEIGHT, rect.x + rect.w - arm, rect.y + rect.h - thick, arm, thick, RED);
  fillRect(buf, WIDTH, HEIGHT, rect.x + rect.w - thick, rect.y + rect.h - arm, thick, arm, RED);
}

function markRedE(run) {
  let seen = 0;
  for (const item of run) {
    if (item.glyph.unicode === 69) {
      seen += 1;
      if (seen === 2) item.color = RED;
    }
  }
}

function renderStrip(fonts, copy, photo) {
  const buf = new Uint8Array(WIDTH * HEIGHT * 4);
  paintBackground(buf);
  const photoRect = {
    x: STRIP_PHOTO.x * SCALE,
    y: STRIP_PHOTO.y * SCALE,
    w: STRIP_PHOTO.w * SCALE,
    h: STRIP_PHOTO.h * SCALE,
  };
  if (photo) {
    blitCover(buf, photoRect, photo);
  } else {
    fillRect(buf, WIDTH, HEIGHT, photoRect.x, photoRect.y, photoRect.w, photoRect.h, INK);
    const size = photoRect.h * 0.42;
    const initials = shape(fonts, "serif", copy.initials, size, 0.04, CREAM);
    const baseline = photoRect.y + photoRect.h * 0.66;
    paintRun(buf, WIDTH, HEIGHT, initials, photoRect.x + (photoRect.w - runWidth(initials)) / 2, baseline);
  }
  framePhoto(buf, photoRect);

  const textX = photoRect.x + photoRect.w + 12 * SCALE;
  const maxW = WIDTH - 10 * SCALE - textX;
  let baseline = photoRect.y + 15 * SCALE;
  const brand = shape(fonts, "serif", "ETHER", 16 * SCALE, 0.08, CREAM);
  markRedE(brand);
  paintRun(buf, WIDTH, HEIGHT, brand, textX, baseline);

  baseline += 13 * SCALE;
  if (copy.kicker) {
    const kicker = fit(fonts, "mono", copy.kicker, 8 * SCALE, 6 * SCALE, 0.04, RED, maxW);
    paintRun(buf, WIDTH, HEIGHT, kicker, textX, baseline);
    baseline += 12 * SCALE;
  } else {
    baseline += 3 * SCALE;
  }

  for (const line of copy.nameLines) {
    const name = fit(fonts, "serif", line, 28 * SCALE, 14 * SCALE, -0.015, CREAM, maxW);
    paintRun(buf, WIDTH, HEIGHT, name, textX, baseline);
    const used = name[0]?.fontSize || 28 * SCALE;
    baseline += used * 0.9;
  }

  if (copy.handle) {
    baseline += 2 * SCALE;
    const handle = fit(fonts, "mono", copy.handle, 10 * SCALE, 7 * SCALE, 0, HANDLE, maxW);
    paintRun(buf, WIDTH, HEIGHT, handle, textX, baseline);
    baseline += 15 * SCALE;
  } else {
    baseline += 6 * SCALE;
  }

  if (copy.chip) {
    const chip = fit(fonts, "mono", copy.chip, 8.5 * SCALE, 6 * SCALE, 0.05, INK, maxW - 14 * SCALE);
    const padX = 6 * SCALE;
    const padY = 3.2 * SCALE;
    const boxW = runWidth(chip) + padX * 2;
    const boxH = (chip[0]?.fontSize || 8.5 * SCALE) + padY * 2;
    fillRect(buf, WIDTH, HEIGHT, textX, baseline - (chip[0]?.fontSize || 8.5 * SCALE) * 0.78, boxW, boxH, CREAM);
    paintRun(buf, WIDTH, HEIGHT, chip, textX + padX, baseline);
  }
  return buf;
}

function downsample(src, factor) {
  const dw = WIDTH / factor;
  const dh = HEIGHT / factor;
  const out = new Uint8Array(dw * dh * 4);
  const area = factor * factor;
  for (let y = 0; y < dh; y += 1) {
    for (let x = 0; x < dw; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      const y0 = y * factor;
      const x0 = x * factor;
      for (let sy = 0; sy < factor; sy += 1) {
        let index = ((y0 + sy) * WIDTH + x0) * 4;
        for (let sx = 0; sx < factor; sx += 1) {
          r += src[index];
          g += src[index + 1];
          b += src[index + 2];
          a += src[index + 3];
          index += 4;
        }
      }
      const dest = (y * dw + x) * 4;
      out[dest] = Math.round(r / area);
      out[dest + 1] = Math.round(g / area);
      out[dest + 2] = Math.round(b / area);
      out[dest + 3] = Math.round(a / area);
    }
  }
  return out;
}

/** Strip PNGs. A missing or unreadable avatar becomes initials on the dark plate. */
export async function etherIdStripFiles(card, avatarBytes) {
  const copy = etherIdStripCopy(card || {});
  const photo = avatarBytes ? await decodeEtherIdPhoto(avatarBytes) : null;
  const fonts = await loadFonts();
  const encode = await pngEncode();
  const canvas = renderStrip(fonts, copy, photo);
  return STRIP_FILES.map((file) => ({
    name: file.name,
    data: encode({
      width: file.width,
      height: file.height,
      data: downsample(canvas, file.factor),
      depth: 8,
      channels: 4,
    }),
  }));
}
