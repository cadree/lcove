import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  captureCoverFrame,
  facingFromTrack,
  oppositeFacing,
  setTrackTorch,
  storyCameraConstraints,
  startStoryCamera,
  trackHasTorch,
  videoTrackFrom,
  FALLBACK_ZOOM,
  clampZoom,
  defaultZoom,
  formatZoom,
  pickStoryRecorderType,
  pinchZoom,
  recordingExtension,
  setTrackZoom,
  trackZoomRange,
  zoomCrop,
} from "./storyCamera.ts";

describe("story camera constraints", () => {
  it("asks by width only so WebKit does not crop the sensor, then relaxes", () => {
    const attempts = storyCameraConstraints("environment");
    assert.equal(attempts.length, 3);
    const first = attempts[0]?.video;
    assert.ok(first && typeof first === "object");
    assert.deepEqual(first.facingMode, { ideal: "environment" });
    assert.deepEqual(first.width, { ideal: 1920 });
    assert.equal("height" in first, false);
    assert.equal("aspectRatio" in first, false);
    assert.equal(attempts[0]?.audio, false);
    assert.deepEqual(attempts[2], { video: true, audio: false });
    assert.equal(oppositeFacing("environment"), "user");
    assert.equal(oppositeFacing("user"), "environment");
  });

  it("retries when the first portrait constraint is rejected", async () => {
    const seen: MediaStreamConstraints[] = [];
    const stream = { getTracks: () => [{ stop() {}, kind: "video" }] } as unknown as MediaStream;
    const result = await startStoryCamera({
      facing: "user",
      secure: true,
      supported: true,
      getUserMedia: async (constraints) => {
        seen.push(constraints);
        if (seen.length === 1) {
          const error = new Error("overconstrained");
          error.name = "OverconstrainedError";
          throw error;
        }
        return stream;
      },
    });
    assert.equal(result.ok, true);
    assert.equal(seen.length, 2);
  });

  it("does not request the camera when the page is insecure", async () => {
    let calls = 0;
    const result = await startStoryCamera({
      facing: "environment",
      secure: false,
      supported: true,
      getUserMedia: async () => {
        calls += 1;
        return { getTracks: () => [] } as unknown as MediaStream;
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.failure, "insecure");
    assert.equal(calls, 0);
  });
});

describe("torch and facing", () => {
  it("reports torch only when getCapabilities says it is present", () => {
    assert.equal(trackHasTorch(null), false);
    assert.equal(trackHasTorch({}), false);
    assert.equal(trackHasTorch({ getCapabilities: () => ({}) }), false);
    assert.equal(trackHasTorch({ getCapabilities: () => ({ torch: false }) }), false);
    assert.equal(trackHasTorch({ getCapabilities: () => ({ torch: true }) }), true);
    assert.equal(trackHasTorch({ getCapabilities: () => { throw new Error("ended"); } }), false);
  });

  it("applies torch through advanced constraints, then a plain constraint", async () => {
    const seen: MediaTrackConstraints[] = [];
    const ok = await setTrackTorch({
      applyConstraints: async (constraints) => {
        seen.push(constraints);
        if (seen.length === 1) throw new Error("no advanced");
      },
    }, true);
    assert.equal(ok, true);
    assert.equal(seen.length, 2);
    assert.equal(Boolean((seen[1] as { torch?: boolean }).torch), true);

    const failed = await setTrackTorch({
      applyConstraints: async () => { throw new Error("unsupported"); },
    }, false);
    assert.equal(failed, false);
  });

  it("reads facingMode from the track when it is available", () => {
    assert.equal(facingFromTrack({ getSettings: () => ({ facingMode: "user" }) }, "environment"), "user");
    assert.equal(facingFromTrack({ getSettings: () => ({}) }, "environment"), "environment");
    assert.equal(facingFromTrack(null, "user"), "user");
  });

  it("finds the video track on a stream", () => {
    const video = { kind: "video", stop() {} };
    const audio = { kind: "audio", stop() {} };
    const stream = { getTracks: () => [audio, video], getVideoTracks: () => [video] };
    assert.equal(videoTrackFrom(stream as unknown as MediaStream), video);
    assert.equal(videoTrackFrom({ getTracks: () => [] }), null);
    assert.equal(videoTrackFrom(null), null);
  });
});

describe("cover capture", () => {
  it("crops a landscape frame to 9:16 and records a mirror transform", () => {
    const draws: { mirror: boolean; crop: { sx: number; sy: number; sw: number; sh: number }; dest: { width: number; height: number } }[] = [];
    const result = captureCoverFrame(
      { videoWidth: 1920, videoHeight: 1080 },
      { width: 390, height: 844 },
      {
        mirror: true,
        createCanvas: (width, height) => {
          const canvas = { width, height } as HTMLCanvasElement;
          const ctx = {} as CanvasRenderingContext2D;
          return { canvas, ctx };
        },
        draw(_ctx, crop, dest, mirror) {
          draws.push({ mirror, crop, dest });
        },
      },
    );
    assert.equal(result.mirror, true);
    assert.equal(result.width, result.height * 9 / 16);
    assert.equal(draws.length, 1);
    assert.equal(draws[0]?.mirror, true);
    const crop = draws[0]!.crop;
    assert.ok(Math.abs(crop.sw / crop.sh - 390 / 844) < 0.02);
    assert.equal(crop.sy, 0);
    assert.ok(crop.sx > 0);
  });

  it("does not mirror a rear-camera still", () => {
    let mirrored = true;
    captureCoverFrame(
      { videoWidth: 1080, videoHeight: 1920 },
      { width: 1080, height: 1920 },
      {
        mirror: false,
        createCanvas: (width, height) => ({ canvas: { width, height } as HTMLCanvasElement, ctx: {} as CanvasRenderingContext2D }),
        draw(_ctx, _crop, _dest, mirror) { mirrored = mirror; },
      },
    );
    assert.equal(mirrored, false);
  });
});

describe("story camera zoom", () => {
  it("reads the native zoom range and ignores tracks without one", () => {
    assert.deepEqual(trackZoomRange({ getCapabilities: () => ({ zoom: { min: 0.5, max: 15, step: 0.1 } }) }), { min: 0.5, max: 15, step: 0.1 });
    assert.equal(trackZoomRange({ getCapabilities: () => ({}) }), null);
    assert.equal(trackZoomRange({ getCapabilities: () => ({ zoom: { min: 1, max: 1 } }) }), null);
    assert.equal(trackZoomRange(null), null);
  });

  it("opens at 1x even when the camera offers ultra wide or starts zoomed", () => {
    assert.equal(defaultZoom({ min: 0.5, max: 15, step: 0 }, 2), 1);
    assert.equal(defaultZoom({ min: 1, max: 10, step: 0 }, 3), 1);
    assert.equal(defaultZoom(null, 2), null);
  });

  it("follows the finger gap and clamps to the range", () => {
    const range = { min: 0.5, max: 6, step: 0 };
    assert.equal(pinchZoom(1, 100, 200, range), 2);
    assert.equal(pinchZoom(1, 100, 50, range), 0.5);
    assert.equal(pinchZoom(1, 100, 10, range), 0.5);
    assert.equal(pinchZoom(2, 100, 1000, range), 6);
    assert.equal(pinchZoom(1, 100, 50, FALLBACK_ZOOM), 1);
    assert.equal(clampZoom(1.234, { min: 1, max: 5, step: 0.5 }), 1);
    assert.equal(formatZoom(1), "1x");
    assert.equal(formatZoom(0.5), "0.5x");
    assert.equal(formatZoom(2.04), "2x");
  });

  it("applies zoom through advanced constraints", async () => {
    const seen: MediaTrackConstraints[] = [];
    const ok = await setTrackZoom({ applyConstraints: async (c) => { seen.push(c); } }, 2);
    assert.equal(ok, true);
    assert.deepEqual(seen[0], { advanced: [{ zoom: 2 }] });
    assert.equal(await setTrackZoom({ applyConstraints: async () => { throw new Error("no"); } }, 2), false);
  });

  it("crops the centre for screen zoom, and the photo uses that crop", () => {
    assert.deepEqual(zoomCrop({ sx: 0, sy: 0, sw: 900, sh: 1600 }, 2), { sx: 225, sy: 400, sw: 450, sh: 800 });
    assert.deepEqual(zoomCrop({ sx: 10, sy: 0, sw: 900, sh: 1600 }, 1), { sx: 10, sy: 0, sw: 900, sh: 1600 });
    const shot = captureCoverFrame(
      { videoWidth: 1440, videoHeight: 1920 },
      { width: 390, height: 693.33 },
      { zoom: 2, createCanvas: (width, height) => ({ canvas: { width, height } as HTMLCanvasElement, ctx: {} as CanvasRenderingContext2D }), draw: () => {} },
    );
    assert.ok(Math.abs(shot.crop.sw - 540) < 1, `width ${shot.crop.sw}`);
    assert.ok(Math.abs(shot.crop.sh - 960) < 1, `height ${shot.crop.sh}`);
    assert.ok(Math.abs(shot.crop.sx - 450) < 1);
    assert.ok(Math.abs(shot.crop.sy - 480) < 1);
  });
});

describe("story recording format", () => {
  it("prefers mp4 so every story player can show it", () => {
    assert.equal(pickStoryRecorderType((type) => type.startsWith("video/mp4")), "video/mp4;codecs=avc1.42E01E,mp4a.40.2");
    assert.equal(pickStoryRecorderType((type) => type === "video/webm"), "video/webm");
    assert.equal(pickStoryRecorderType(() => { throw new Error("unknown"); }), null);
    assert.equal(recordingExtension("video/mp4"), "mp4");
    assert.equal(recordingExtension("video/webm;codecs=vp8"), "webm");
  });
});
