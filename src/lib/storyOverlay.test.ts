import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STORY_FRAME_HEIGHT,
  STORY_FRAME_WIDTH,
  STORY_TEXT_SIZES,
  burnStoryImage,
  clampOverlayCenter,
  colorLuminance,
  contrastingFill,
  coverSourceRect,
  createStoryText,
  fitStoryStage,
  canvasFont,
  drawStoryOverlays,
  fontSizeFor,
  layoutStoryText,
  pointerToNormalized,
  storyFrameSize,
  storyMaxTextWidth,
  trackedTextWidth,
  wrapText,
  type StoryDrawContext,
  type StoryTextOverlay,
} from "./storyOverlay.ts";

function measure(text: string, _font?: string): number {
  return text.length * 10;
}

function overlay(partial: Partial<StoryTextOverlay> = {}): StoryTextOverlay {
  return createStoryText({ id: "t1", text: "Hello Ether", ...partial });
}

describe("story frame geometry", () => {
  it("keeps a 9:16 even-pixel frame", () => {
    const frame = storyFrameSize(1080);
    assert.equal(frame.width, STORY_FRAME_WIDTH);
    assert.equal(frame.height, STORY_FRAME_HEIGHT);
    const odd = storyFrameSize(1081);
    assert.equal(odd.width % 2, 0);
    assert.equal(odd.height % 2, 0);
    assert.ok(Math.abs(odd.height / odd.width - STORY_FRAME_HEIGHT / STORY_FRAME_WIDTH) < 0.005);
  });

  it("crops a landscape source to cover a 9:16 frame", () => {
    const crop = coverSourceRect(1920, 1080, 1080, 1920);
    assert.equal(crop.sx, (1920 - 1080 * (1080 / 1920)) / 2);
    assert.equal(crop.sy, 0);
    assert.equal(crop.sh, 1080);
    assert.ok(Math.abs(crop.sw / crop.sh - 1080 / 1920) < 1e-6);
  });

  it("crops a tall source from the vertical center", () => {
    const crop = coverSourceRect(1080, 2400, 1080, 1920);
    assert.equal(crop.sx, 0);
    assert.equal(crop.sw, 1080);
    assert.equal(crop.sh, 1920);
    assert.equal(crop.sy, (2400 - 1920) / 2);
  });

  it("fits the largest 9:16 stage inside a box", () => {
    const tall = fitStoryStage(390, 844);
    assert.ok(Math.abs(tall.width / tall.height - STORY_FRAME_WIDTH / STORY_FRAME_HEIGHT) < 1e-6);
    assert.equal(tall.width, 390);
    const wide = fitStoryStage(800, 200);
    assert.equal(wide.height, 200);
    assert.ok(Math.abs(wide.width / wide.height - STORY_FRAME_WIDTH / STORY_FRAME_HEIGHT) < 1e-6);
  });

  it("maps a pointer on the preview into 0–1 coordinates and clamps", () => {
    const rect = { left: 100, top: 50, width: 200, height: 400 };
    assert.deepEqual(pointerToNormalized(200, 250, rect), { x: 0.5, y: 0.5 });
    assert.deepEqual(pointerToNormalized(0, 0, rect), { x: 0, y: 0 });
    assert.deepEqual(pointerToNormalized(400, 800, rect), { x: 1, y: 1 });
  });
});

describe("text wrapping and layout", () => {
  it("wraps on spaces and hard-breaks a long word", () => {
    assert.deepEqual(wrapText("one two three", (s) => s.length * 10, 50), ["one", "two", "three"]);
    assert.deepEqual(wrapText("xxxxxx", (s) => s.length * 10, 30), ["xxx", "xxx"]);
    assert.deepEqual(wrapText("hello\nworld", (s) => s.length * 10, 1000), ["hello", "world"]);
  });

  it("sizes type relative to the 1080-wide frame", () => {
    assert.equal(fontSizeFor("m", 1080), STORY_TEXT_SIZES.m);
    assert.equal(fontSizeFor("m", 540), STORY_TEXT_SIZES.m / 2);
    assert.match(canvasFont("display", 48), /500 48px Cinzel/);
  });

  it("lays out a centered block and keeps it on the frame", () => {
    const layout = layoutStoryText(overlay({ x: 0.5, y: 0.5, text: "Hi" }), 1080, 1920, measure);
    assert.equal(layout.lines.length, 1);
    assert.equal(layout.lines[0]?.text, "Hi");
    assert.ok(layout.left >= 0);
    assert.ok(layout.top >= 0);
    assert.ok(layout.left + layout.width <= 1080);
    assert.ok(layout.top + layout.height <= 1920);
    const center = layout.left + layout.width / 2;
    assert.ok(Math.abs(center - 540) < 1);
  });

  it("clamps a box that would sit off the top-left corner", () => {
    const next = clampOverlayCenter(overlay({ x: 0, y: 0, text: "Hello Ether" }), 1080, 1920, measure);
    assert.ok(next.x > 0);
    assert.ok(next.y > 0);
    const layout = layoutStoryText(overlay({ ...next, text: "Hello Ether" }), 1080, 1920, measure);
    assert.ok(layout.left >= 8);
    assert.ok(layout.top >= 8);
  });

  it("picks a contrasting pill fill and a shadow when there is no pill", () => {
    assert.ok(colorLuminance("#FFFFFF") > 0.5);
    assert.ok(colorLuminance("#111111") < 0.1);
    assert.match(contrastingFill("#FFFFFF"), /0,\s*0,\s*0/);
    assert.match(contrastingFill("#111111"), /255,\s*255,\s*255/);
    const plain = layoutStoryText(overlay({ pill: false }), 1080, 1920, measure);
    const pill = layoutStoryText(overlay({ pill: true, color: "#FFFFFF" }), 1080, 1920, measure);
    assert.equal(plain.shadow, true);
    assert.equal(plain.pillFill, null);
    assert.equal(pill.shadow, false);
    assert.ok(pill.pillFill);
  });
});

describe("burn-in", () => {
  it("draws only non-empty overlays and records their type", async () => {
    const fills: string[] = [];
    const texts: { text: string; x: number; y: number }[] = [];
    let font = "";
    const ctx: StoryDrawContext = {
      save() {},
      restore() {},
      translate() {},
      scale() {},
      fillRect() {},
      beginPath() {},
      fill() { fills.push(String(this.fillStyle)); },
      moveTo() {},
      arcTo() {},
      closePath() {},
      fillText(text, x, y) { texts.push({ text, x, y }); },
      measureText(text) { return { width: text.length * 10 }; },
      drawImage() {},
      get font() { return font; },
      set font(value) { font = value; },
      fillStyle: "#000",
      textAlign: "left",
      textBaseline: "alphabetic",
      shadowColor: "transparent",
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
    };
    drawStoryOverlays(
      ctx,
      [
        overlay({ text: "  " }),
        overlay({ text: "On set", x: 0.5, y: 0.4, pill: true, color: "#FFFFFF" }),
      ],
      1080,
      1920,
    );
    assert.deepEqual(texts.map((entry) => entry.text), ["On set"]);
    assert.ok(texts[0] && texts[0].x > 0 && texts[0].y > 0);
    assert.ok(fills.some((value) => /0,\s*0,\s*0/.test(value)));
  });

  it("burns a solid background and overlays into a JPEG", async () => {
    let width = 0;
    let height = 0;
    let background = "";
    const drawn: string[] = [];
    const file = await burnStoryImage({
      overlays: [overlay({ text: "Ada", pill: false })],
      background: "#C4142D",
      createCanvas: (w, h) => {
        width = w;
        height = h;
        let font = "";
        const ctx: StoryDrawContext = {
          save() {},
          restore() {},
          translate() {},
          scale() {},
          fillRect() { background = String(this.fillStyle); },
          beginPath() {},
          fill() {},
          moveTo() {},
          arcTo() {},
          closePath() {},
          fillText(text) { drawn.push(text); },
          measureText(text) { return { width: text.length * 10 }; },
          drawImage() {},
          get font() { return font; },
          set font(value) { font = value; },
          fillStyle: "#000",
          textAlign: "left",
          textBaseline: "alphabetic",
          shadowColor: "transparent",
          shadowBlur: 0,
          shadowOffsetX: 0,
          shadowOffsetY: 0,
        };
        return {
          canvas: {
            toBlob(callback, type) {
              callback(new Blob([Uint8Array.from([0xff, 0xd8, 0xff])], { type: type ?? "image/jpeg" }));
            },
          },
          ctx,
        };
      },
    });
    assert.equal(width, 1080);
    assert.equal(height, 1920);
    assert.equal(background, "#C4142D");
    assert.deepEqual(drawn, ["Ada"]);
    assert.equal(file.type, "image/jpeg");
    assert.equal(file.name, "story.jpg");
    assert.ok(file.size > 0);
  });

  it("covers a photo onto the frame before drawing type", async () => {
    const calls: string[] = [];
    const image = { width: 2000, height: 1000 } as CanvasImageSource & { width: number; height: number };
    await burnStoryImage({
      image,
      overlays: [overlay({ text: "Title" })],
      createCanvas: () => {
        let font = "";
        const ctx: StoryDrawContext = {
          save() { calls.push("save"); },
          restore() { calls.push("restore"); },
          translate() {},
          scale() {},
          fillRect() { calls.push("bg"); },
          beginPath() {},
          fill() {},
          moveTo() {},
          arcTo() {},
          closePath() {},
          fillText() { calls.push("text"); },
          measureText(text) { return { width: text.length * 10 }; },
          drawImage() { calls.push("image"); },
          get font() { return font; },
          set font(value) { font = value; },
          fillStyle: "#000",
          textAlign: "left",
          textBaseline: "alphabetic",
          shadowColor: "transparent",
          shadowBlur: 0,
          shadowOffsetX: 0,
          shadowOffsetY: 0,
        };
        return {
          canvas: {
            toBlob(callback) {
              callback(new Blob([Uint8Array.from([1, 2, 3])], { type: "image/jpeg" }));
            },
          },
          ctx,
        };
      },
    });
    assert.deepEqual(
      calls.filter((name) => name === "bg" || name === "image" || name === "text"),
      ["bg", "image", "text"],
    );
  });
});

describe("WYSIWYG wrap and scale", () => {
  it("adds tracking between characters and not on a single glyph", () => {
    assert.equal(trackedTextWidth("ABCD", 100, 100, "sans"), 103);
    assert.equal(trackedTextWidth("A", 50, 100, "sans"), 50);
    assert.equal(trackedTextWidth("", 50, 100, "sans"), 0);
    assert.equal(trackedTextWidth("AB", 80, 100, "display"), 88);
  });

  it("wraps the same lines at 390, 320, and 1080 when metrics scale with the frame", () => {
    const medium = overlay({ text: "On set tonight", size: "m", font: "sans", pill: true });
    const long = overlay({
      text: "Tonight we stay on set until the last light leaves the lot",
      size: "m",
      font: "sans",
      pill: true,
    });
    const linear = (frameWidth: number) => (text: string, _font?: string) =>
      text.length * 32 * (frameWidth / 1080);

    for (const item of [medium, long]) {
      const output = layoutStoryText(item, 1080, 1920, linear(1080));
      for (const previewWidth of [390, 320]) {
        const previewHeight = previewWidth * (1920 / 1080);
        const preview = layoutStoryText(item, previewWidth, previewHeight, linear(previewWidth));
        assert.deepEqual(
          preview.lines.map((line) => line.text),
          output.lines.map((line) => line.text),
        );
        assert.ok(Math.abs(preview.left / previewWidth - output.left / 1080) < 0.02);
        assert.ok(Math.abs(preview.fontSize / previewWidth - output.fontSize / 1080) < 1e-9);
        assert.equal(preview.pillFill, output.pillFill);
        assert.ok(Math.abs(storyMaxTextWidth(previewWidth) / previewWidth - storyMaxTextWidth(1080) / 1080) < 1e-9);
      }
    }

    assert.equal(layoutStoryText(medium, 1080, 1920, linear(1080)).lines.length, 1);
    assert.ok(layoutStoryText(long, 1080, 1920, linear(1080)).lines.length >= 2);
  });
});
