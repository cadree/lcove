import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUDIO_BITRATE,
  CLIP_TOO_LONG_MESSAGE,
  FILE_TOO_LARGE_MESSAGE,
  IMAGE_TOO_LARGE_MESSAGE,
  MIN_SHORT_SIDE,
  MIN_VIDEO_BITRATE,
  STORAGE_LIMIT_BYTES,
  STORAGE_TARGET_BYTES,
  decideBySize,
  fileKind,
  isStorageSizeMessage,
  planVideoEncode,
} from "./storageLimit.ts";

function expectedVideoBitrate(durationSec: number): number {
  return Math.round((STORAGE_TARGET_BYTES * 8) / durationSec - AUDIO_BITRATE);
}

describe("decideBySize", () => {
  it("uploads a file at the cap untouched", () => {
    assert.deepEqual(decideBySize(STORAGE_LIMIT_BYTES, "video"), { action: "keep" });
    assert.deepEqual(decideBySize(STORAGE_LIMIT_BYTES, "image"), { action: "keep" });
    assert.deepEqual(decideBySize(1, "other"), { action: "keep" });
  });

  it("compresses only video once the file is over the cap", () => {
    assert.deepEqual(decideBySize(STORAGE_LIMIT_BYTES + 1, "video"), { action: "compress" });
  });

  it("rejects an oversized image with a plain message", () => {
    assert.deepEqual(decideBySize(STORAGE_LIMIT_BYTES + 1, "image"), {
      action: "reject",
      message: IMAGE_TOO_LARGE_MESSAGE,
    });
  });

  it("rejects any other oversized file with a plain message", () => {
    assert.deepEqual(decideBySize(STORAGE_LIMIT_BYTES + 1, "other"), {
      action: "reject",
      message: FILE_TOO_LARGE_MESSAGE,
    });
    assert.deepEqual(decideBySize(Number.NaN, "video"), {
      action: "reject",
      message: FILE_TOO_LARGE_MESSAGE,
    });
  });
});

describe("fileKind", () => {
  it("treats phone video types and extensions as video", () => {
    assert.equal(fileKind("clip.MOV", ""), "video");
    assert.equal(fileKind("clip.mov", "video/quicktime"), "video");
    assert.equal(fileKind("replay.webm", "video/webm"), "video");
  });

  it("treats photos as images and everything else as other", () => {
    assert.equal(fileKind("photo.HEIC", ""), "image");
    assert.equal(fileKind("photo.jpg", "image/jpeg"), "image");
    assert.equal(fileKind("notes.pdf", "application/pdf"), "other");
    assert.equal(fileKind("song.mp3", "audio/mpeg"), "other");
  });
});

describe("planVideoEncode", () => {
  it("keeps 4K when the size budget can feed it", () => {
    const plan = planVideoEncode({ width: 3840, height: 2160, durationSec: 10, fps: 30 });
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.equal(plan.width, 3840);
    assert.equal(plan.height, 2160);
    assert.equal(plan.resize, false);
    assert.equal(plan.videoBitrate, expectedVideoBitrate(10));
    assert.equal(plan.audioBitrate, AUDIO_BITRATE);
  });

  it("scales 4K down to 1080p and no further when the clip is longer", () => {
    const plan = planVideoEncode({ width: 3840, height: 2160, durationSec: 90, fps: 30 });
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.equal(plan.width, 1920);
    assert.equal(plan.height, 1080);
    assert.equal(plan.resize, true);
    assert.ok(Math.min(plan.width, plan.height) >= MIN_SHORT_SIDE);
    assert.ok(plan.videoBitrate >= MIN_VIDEO_BITRATE);
  });

  it("keeps portrait 4K at a portrait 1080p frame", () => {
    const plan = planVideoEncode({ width: 2160, height: 3840, durationSec: 90, fps: 30 });
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.equal(plan.width, 1080);
    assert.equal(plan.height, 1920);
    assert.ok(Math.min(plan.width, plan.height) >= MIN_SHORT_SIDE);
  });

  it("does not upscale or shrink a 720p source", () => {
    const plan = planVideoEncode({ width: 1280, height: 720, durationSec: 200, fps: 30 });
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.equal(plan.width, 1280);
    assert.equal(plan.height, 720);
    assert.equal(plan.resize, false);
  });

  it("rounds an odd 1080p frame to even pixels without dropping below 1080", () => {
    const plan = planVideoEncode({ width: 1921, height: 1081, durationSec: 10, fps: 30 });
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.equal(plan.width % 2, 0);
    assert.equal(plan.height % 2, 0);
    assert.equal(plan.width, 1920);
    assert.equal(plan.height, 1080);
  });

  it("asks for a trim when even the minimum bitrate cannot fit", () => {
    const plan = planVideoEncode({ width: 1920, height: 1080, durationSec: 400, fps: 30 });
    assert.deepEqual(plan, { ok: false, message: CLIP_TOO_LONG_MESSAGE });
    assert.match(CLIP_TOO_LONG_MESSAGE, /too long/i);
    assert.match(CLIP_TOO_LONG_MESSAGE, /trim/i);
  });
});

describe("isStorageSizeMessage", () => {
  it("recognizes the storage service size rejection", () => {
    assert.equal(isStorageSizeMessage("The object exceeded the maximum allowed size"), true);
    assert.equal(isStorageSizeMessage("Payload too large"), true);
    assert.equal(isStorageSizeMessage("nope", 413), true);
    assert.equal(isStorageSizeMessage("Bucket not found"), false);
  });
});
