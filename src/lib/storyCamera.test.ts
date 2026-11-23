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
} from "./storyCamera.ts";

describe("story camera constraints", () => {
  it("asks for a portrait rear camera first, then relaxes", () => {
    const attempts = storyCameraConstraints("environment");
    assert.equal(attempts.length, 4);
    const first = attempts[0]?.video;
    assert.ok(first && typeof first === "object");
    assert.deepEqual(first.facingMode, { ideal: "environment" });
    assert.deepEqual(first.width, { ideal: 1080 });
    assert.deepEqual(first.height, { ideal: 1920 });
    assert.equal(attempts[0]?.audio, false);
    assert.deepEqual(attempts[3], { video: true, audio: false });
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
