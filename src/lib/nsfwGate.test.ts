import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  EXPLICIT_BLOCK_MESSAGE,
  EXPLICIT_THRESHOLD,
  decideExplicit,
  hasImageMagic,
  shouldCheckImage,
} from "./nsfwGate.ts";

function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("decideExplicit", () => {
  it("blocks Porn and Hentai at the threshold", () => {
    assert.equal(EXPLICIT_THRESHOLD, 0.7);
    const porn = decideExplicit([{ className: "Porn", probability: 0.7 }]);
    const hentai = decideExplicit([{ className: "Hentai", probability: 0.91 }]);
    assert.deepEqual(porn, {
      action: "block",
      message: EXPLICIT_BLOCK_MESSAGE,
      label: "Porn",
      probability: 0.7,
    });
    assert.equal(hentai.action, "block");
    if (hentai.action === "block") assert.equal(hentai.label, "Hentai");
  });

  it("allows a score under the threshold", () => {
    assert.deepEqual(
      decideExplicit([
        { className: "Porn", probability: 0.699 },
        { className: "Hentai", probability: 0.2 },
      ]),
      { action: "allow" },
    );
  });

  it("allows Sexy, Drawing, and Neutral even when they are certain", () => {
    assert.deepEqual(
      decideExplicit([
        { className: "Sexy", probability: 0.99 },
        { className: "Drawing", probability: 0.5 },
        { className: "Neutral", probability: 1 },
      ]),
      { action: "allow" },
    );
    assert.deepEqual(decideExplicit([]), { action: "allow" });
    assert.deepEqual(decideExplicit([{ className: "Porn", probability: Number.NaN }]), { action: "allow" });
  });

  it("uses a plain message that does not name the class", () => {
    assert.equal(EXPLICIT_BLOCK_MESSAGE, "This image isn't allowed.");
    assert.equal(/porn|hentai|nsfw|nude/i.test(EXPLICIT_BLOCK_MESSAGE), false);
  });

  it("blocks on the stronger explicit class", () => {
    const decision = decideExplicit([
      { className: "Porn", probability: 0.72 },
      { className: "Hentai", probability: 0.96 },
      { className: "Sexy", probability: 0.4 },
    ]);
    assert.equal(decision.action, "block");
    if (decision.action === "block") {
      assert.equal(decision.label, "Hentai");
      assert.equal(decision.probability, 0.96);
    }
  });
});

describe("shouldCheckImage", () => {
  it("checks photos by type or extension", () => {
    assert.equal(shouldCheckImage("photo.jpg", "image/jpeg", bytes()), true);
    assert.equal(shouldCheckImage("photo.HEIC", "", bytes()), true);
    assert.equal(shouldCheckImage("cover.png", "image/png", bytes()), true);
  });

  it("checks a photo hidden behind another name", () => {
    assert.equal(shouldCheckImage("clip.mp4", "video/mp4", bytes(0xff, 0xd8, 0xff, 0xe0)), true);
    assert.equal(shouldCheckImage("notes.bin", "application/octet-stream", bytes(0x89, 0x50, 0x4e, 0x47)), true);
    const heic = bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63);
    assert.equal(hasImageMagic(heic), true);
    assert.equal(shouldCheckImage("file.bin", "", heic), true);
  });

  it("skips video, audio, and other files", () => {
    const mp4 = bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d);
    assert.equal(hasImageMagic(mp4), false);
    assert.equal(shouldCheckImage("clip.mp4", "video/mp4", mp4), false);
    assert.equal(shouldCheckImage("song.mp3", "audio/mpeg", bytes()), false);
    assert.equal(shouldCheckImage("notes.pdf", "application/pdf", bytes(0x25, 0x50, 0x44, 0x46)), false);
  });

  it("recognizes webp and gif", () => {
    const webp = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
    const gif = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
    assert.equal(hasImageMagic(webp), true);
    assert.equal(hasImageMagic(gif), true);
    assert.equal(hasImageMagic(bytes(0x47, 0x49)), false);
  });
});

describe("image check wiring", () => {
  it("loads TensorFlow from a dynamic import", () => {
    const checker = source("./nsfwImageCheck.ts");
    assert.equal(/^\s*import\s+(?!type\b).*\bfrom\s+["']nsfwjs/m.test(checker), false);
    assert.equal(/^\s*import\s+(?!type\b).*\bfrom\s+["']@tensorflow/m.test(checker), false);
    assert.equal(checker.includes("nsfwjs/models"), false);
    assert.match(checker, /import\(\s*["']nsfwjs\/core["']\s*\)/);
    assert.match(checker, /import\(\s*["']@tensorflow\/tfjs["']\s*\)/);
    assert.match(checker, /import\(\s*["']@tensorflow\/tfjs-backend-wasm["']\s*\)/);
    assert.match(checker, /\/nsfw\/mobilenet_v2\/model\.json/);
    assert.match(checker, /\/nsfw\/wasm\//);
    assert.match(checker, /allowing the upload/);
    assert.match(checker, /requestIdleCallback/);
    assert.match(checker, /input\[type="file"\]/);
    assert.match(checker, /if \(!signedIn/);
    assert.match(checker, /document\.readyState === "complete"/);
  });

  it("prefetches only after a session, off the module startup path", () => {
    const app = source("../App.tsx");
    const startup = app.split("function WarmTabs")[0];
    assert.equal(startup.includes("watchImageCheckPrefetch("), false);
    assert.match(app, /watchImageCheckPrefetch\(session != null\)/);
  });

  it("runs the image check beside the storage upload", () => {
    const client = source("./supabaseClient.ts");
    assert.match(client, /reviewImageUpload/);
    assert.match(client, /blockedImageError/);
    assert.equal(/await reviewImageUpload/.test(client), false);
    assert.match(client, /ownsThisUpload/);
    assert.match(client, /bucket\.remove\(\[path\]\)/);
    assert.match(client, /Upload removed after the image check/);
    const reviewAt = client.indexOf("const reviewPromise = reviewImageUpload");
    const uploadAt = client.indexOf("const result = await originalUpload");
    assert.ok(reviewAt > 0 && reviewAt < uploadAt);
  });
});
