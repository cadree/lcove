/** 9:16 story frame and text overlays that burn into a still. */

export const STORY_FRAME_WIDTH = 1080;
export const STORY_FRAME_HEIGHT = 1920;

export type StoryTextSize = "s" | "m" | "l";
export type StoryTextFont = "sans" | "serif" | "display";

export const STORY_TEXT_SIZES: Record<StoryTextSize, number> = {
  s: 36,
  m: 58,
  l: 88,
};

export const STORY_TEXT_FONTS: Record<StoryTextFont, string> = {
  sans: 'Archivo, "Helvetica Neue", system-ui, sans-serif',
  serif: "Fraunces, Georgia, serif",
  display: "Cinzel, Georgia, serif",
};

export const STORY_TEXT_FONT_WEIGHT: Record<StoryTextFont, string> = {
  sans: "650",
  serif: "600",
  display: "500",
};

export const STORY_TEXT_TRACKING: Record<StoryTextFont, number> = {
  sans: 0.01,
  serif: 0,
  display: 0.08,
};

export const STORY_TEXT_COLORS = [
  "#FFFFFF",
  "#111111",
  "#F5E6C8",
  "#C4142D",
  "#2B4C7E",
  "#E8A0BF",
] as const;

export const STORY_BACKGROUNDS = ["#111111", "#F4F0E8", "#1C1C22", "#C4142D"] as const;

export interface StoryTextOverlay {
  id: string;
  text: string;
  /** Horizontal center of the block, 0–1 of the frame. */
  x: number;
  /** Vertical center of the block, 0–1 of the frame. */
  y: number;
  size: StoryTextSize;
  color: string;
  font: StoryTextFont;
  pill: boolean;
}

export interface TextLineBox {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StoryTextLayout {
  lines: TextLineBox[];
  font: string;
  fontSize: number;
  color: string;
  pillFill: string | null;
  shadow: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
}

export function createStoryText(partial: Partial<StoryTextOverlay> = {}): StoryTextOverlay {
  return {
    id: partial.id ?? `text-${Math.random().toString(36).slice(2, 8)}`,
    text: partial.text ?? "",
    x: partial.x ?? 0.5,
    y: partial.y ?? 0.45,
    size: partial.size ?? "m",
    color: partial.color ?? "#FFFFFF",
    font: partial.font ?? "sans",
    pill: partial.pill ?? false,
  };
}

export function fontSizeFor(size: StoryTextSize, frameWidth: number): number {
  return STORY_TEXT_SIZES[size] * (frameWidth / STORY_FRAME_WIDTH);
}

export function canvasFont(font: StoryTextFont, fontSize: number): string {
  return `${STORY_TEXT_FONT_WEIGHT[font]} ${fontSize}px ${STORY_TEXT_FONTS[font]}`;
}

/** Relative luminance of a #RRGGBB or #RGB color, or 1 when the value is unknown. */
export function colorLuminance(color: string): number {
  const hex = color.trim().replace(/^#/, "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return 1;
  const n = Number.parseInt(full, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastingFill(color: string): string {
  return colorLuminance(color) > 0.55 ? "rgba(0,0,0,0.82)" : "rgba(255,255,255,0.94)";
}

export function wrapText(text: string, measure: (line: string) => number, maxWidth: number): string[] {
  const source = text.replace(/\r\n/g, "\n");
  const lines: string[] = [];
  for (const paragraph of source.split("\n")) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (measure(next) <= maxWidth) {
        current = next;
        continue;
      }
      if (current) lines.push(current);
      if (measure(word) <= maxWidth) {
        current = word;
        continue;
      }
      let piece = "";
      for (const ch of word) {
        const trial = piece + ch;
        if (piece && measure(trial) > maxWidth) {
          lines.push(piece);
          piece = ch;
        } else {
          piece = trial;
        }
      }
      current = piece;
    }
    if (current || !lines.length) lines.push(current);
  }
  return lines.length ? lines : [""];
}

export function layoutStoryText(
  overlay: StoryTextOverlay,
  frameWidth: number,
  frameHeight: number,
  measure: (text: string, font: string) => number,
): StoryTextLayout {
  const fontSize = fontSizeFor(overlay.size, frameWidth);
  const font = canvasFont(overlay.font, fontSize);
  const lineHeight = fontSize * 1.15;
  const maxWidth = frameWidth * 0.8;
  const lines = wrapText(overlay.text, (line) => measure(line, font), maxWidth);
  const widths = lines.map((line) => (line ? measure(line, font) : 0));
  const blockWidth = Math.max(fontSize, ...widths);
  const blockHeight = Math.max(lineHeight, lines.length * lineHeight);
  const padX = overlay.pill ? fontSize * 0.5 : 0;
  const padY = overlay.pill ? fontSize * 0.22 : 0;
  const width = blockWidth + padX * 2;
  const height = blockHeight + padY * 2;
  const centerX = overlay.x * frameWidth;
  const centerY = overlay.y * frameHeight;
  let left = centerX - width / 2;
  let top = centerY - height / 2;
  const margin = Math.max(8, frameWidth * 0.03);
  left = Math.min(Math.max(left, margin), frameWidth - width - margin);
  top = Math.min(Math.max(top, margin), frameHeight - height - margin);
  const boxes: TextLineBox[] = lines.map((text, index) => {
    const lineWidth = widths[index] ?? 0;
    return {
      text,
      x: left + width / 2,
      y: top + padY + index * lineHeight,
      width: lineWidth,
      height: lineHeight,
    };
  });
  return {
    lines: boxes,
    font,
    fontSize,
    color: overlay.color,
    pillFill: overlay.pill ? contrastingFill(overlay.color) : null,
    shadow: !overlay.pill,
    left,
    top,
    width,
    height,
  };
}

/** Push the stored center so the laid-out block stays on the frame. */
export function clampOverlayCenter(
  overlay: StoryTextOverlay,
  frameWidth: number,
  frameHeight: number,
  measure: (text: string, font: string) => number,
): { x: number; y: number } {
  const layout = layoutStoryText(overlay, frameWidth, frameHeight, measure);
  return {
    x: (layout.left + layout.width / 2) / frameWidth,
    y: (layout.top + layout.height / 2) / frameHeight,
  };
}

export function pointerToNormalized(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  if (!(rect.width > 0) || !(rect.height > 0)) return { x: 0.5, y: 0.5 };
  return {
    x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
  };
}

/** Source rectangle that covers a destination the way CSS object-fit: cover does. */
export function coverSourceRect(
  srcWidth: number,
  srcHeight: number,
  destWidth: number,
  destHeight: number,
): { sx: number; sy: number; sw: number; sh: number } {
  if (!(srcWidth > 0) || !(srcHeight > 0) || !(destWidth > 0) || !(destHeight > 0)) {
    return { sx: 0, sy: 0, sw: Math.max(0, srcWidth), sh: Math.max(0, srcHeight) };
  }
  const srcRatio = srcWidth / srcHeight;
  const destRatio = destWidth / destHeight;
  if (srcRatio > destRatio) {
    const sw = srcHeight * destRatio;
    return { sx: (srcWidth - sw) / 2, sy: 0, sw, sh: srcHeight };
  }
  const sh = srcWidth / destRatio;
  return { sx: 0, sy: (srcHeight - sh) / 2, sw: srcWidth, sh };
}

export function storyFrameSize(minWidth = STORY_FRAME_WIDTH): { width: number; height: number } {
  const width = Math.max(2, Math.round(minWidth));
  const height = Math.round((width * STORY_FRAME_HEIGHT) / STORY_FRAME_WIDTH);
  return { width: width % 2 === 0 ? width : width + 1, height: height % 2 === 0 ? height : height + 1 };
}

export interface StoryDrawContext {
  canvas?: { width: number; height: number };
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  fill(): void;
  roundRect?(x: number, y: number, w: number, h: number, radii: number): void;
  moveTo(x: number, y: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void;
  closePath(): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  drawImage(
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  font: string;
  fillStyle: string;
  textAlign: string;
  textBaseline: string;
  letterSpacing?: string;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
}

function fillRoundRect(
  ctx: StoryDrawContext,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

export function drawStoryBackground(ctx: StoryDrawContext, width: number, height: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
}

export function drawCoverImage(
  ctx: StoryDrawContext,
  image: CanvasImageSource & { width: number; height: number },
  destWidth: number,
  destHeight: number,
) {
  const srcW = Number(image.width) || 0;
  const srcH = Number(image.height) || 0;
  const crop = coverSourceRect(srcW, srcH, destWidth, destHeight);
  if (!(crop.sw > 0) || !(crop.sh > 0)) return;
  ctx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, destWidth, destHeight);
}

export function drawStoryOverlays(
  ctx: StoryDrawContext,
  overlays: StoryTextOverlay[],
  frameWidth: number,
  frameHeight: number,
) {
  const measure = (text: string, font: string) => {
    const previous = ctx.font;
    ctx.font = font;
    const width = ctx.measureText(text).width;
    ctx.font = previous;
    return width;
  };
  for (const overlay of overlays) {
    if (!overlay.text.trim()) continue;
    const layout = layoutStoryText(overlay, frameWidth, frameHeight, measure);
    ctx.save();
    ctx.font = layout.font;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    if (ctx.letterSpacing !== undefined) {
      ctx.letterSpacing = `${STORY_TEXT_TRACKING[overlay.font] * layout.fontSize}px`;
    }
    if (layout.pillFill) {
      ctx.fillStyle = layout.pillFill;
      for (const line of layout.lines) {
        if (!line.text) continue;
        const padX = layout.fontSize * 0.45;
        const padY = layout.fontSize * 0.12;
        fillRoundRect(
          ctx,
          line.x - line.width / 2 - padX,
          line.y - padY,
          line.width + padX * 2,
          line.height + padY,
          (line.height + padY) / 2,
        );
      }
    }
    ctx.fillStyle = layout.color;
    if (layout.shadow) {
      const dark = colorLuminance(layout.color) <= 0.55;
      ctx.shadowColor = dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)";
      ctx.shadowBlur = layout.fontSize * 0.18;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = layout.fontSize * 0.04;
    } else {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
    for (const line of layout.lines) {
      if (!line.text) continue;
      ctx.fillText(line.text, line.x, line.y);
    }
    ctx.restore();
  }
}

export interface BurnStoryOptions {
  width?: number;
  height?: number;
  background?: string;
  image?: (CanvasImageSource & { width: number; height: number }) | null;
  overlays: StoryTextOverlay[];
  quality?: number;
  createCanvas?: (width: number, height: number) => { canvas: { toBlob?: StoryCanvas["toBlob"]; toDataURL?: (type: string, quality?: number) => string }; ctx: StoryDrawContext };
  waitForFonts?: () => Promise<void>;
}

interface StoryCanvas {
  width: number;
  height: number;
  getContext(id: "2d"): StoryDrawContext | null;
  toBlob?: (callback: (blob: Blob | null) => void, type?: string, quality?: number) => void;
  toDataURL?: (type?: string, quality?: number) => string;
}

function defaultCreateCanvas(width: number, height: number) {
  if (typeof document === "undefined") {
    throw new Error("No canvas is available to render this story.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw the story.");
  return { canvas, ctx: ctx as unknown as StoryDrawContext };
}

async function canvasToJpeg(
  canvas: { toBlob?: StoryCanvas["toBlob"]; toDataURL?: (type?: string, quality?: number) => string },
  quality: number,
): Promise<Blob> {
  if (typeof canvas.toBlob === "function") {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob!(resolve, "image/jpeg", quality));
    if (blob && blob.size > 0) return blob;
  }
  if (typeof canvas.toDataURL === "function") {
    const data = canvas.toDataURL("image/jpeg", quality);
    const match = data.match(/^data:image\/jpeg;base64,(.+)$/);
    if (match) {
      const binary = atob(match[1]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: "image/jpeg" });
    }
  }
  throw new Error("Could not save the story image.");
}

export async function burnStoryImage(options: BurnStoryOptions): Promise<File> {
  const frame = storyFrameSize(options.width ?? STORY_FRAME_WIDTH);
  const width = options.height ? frame.width : frame.width;
  const height = options.height ?? frame.height;
  if (options.waitForFonts) {
    try {
      await options.waitForFonts();
    } catch {
      // System fonts still render if a webfont is late.
    }
  }
  const create = options.createCanvas ?? defaultCreateCanvas;
  const { canvas, ctx } = create(width, height);
  drawStoryBackground(ctx, width, height, options.background ?? "#111111");
  if (options.image) drawCoverImage(ctx, options.image, width, height);
  drawStoryOverlays(ctx, options.overlays, width, height);
  const blob = await canvasToJpeg(canvas, options.quality ?? 0.92);
  return new File([blob], "story.jpg", { type: "image/jpeg" });
}

export function imageFromFile(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not open that photo."));
    };
    image.src = url;
  });
}

export async function waitForStoryFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const loads = Object.values(STORY_TEXT_FONTS).map((stack) => {
    const family = stack.split(",")[0]?.replace(/["']/g, "").trim();
    return family ? document.fonts.load(`600 48px ${family}`) : Promise.resolve([]);
  });
  await Promise.all([...loads, document.fonts.ready]);
}
