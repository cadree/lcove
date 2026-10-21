import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CAMERA_TIMEOUT_MS,
  classifyCameraError,
  requestCamera,
  stopStreamTracks,
  type CameraStream,
} from "./cameraAccess.ts";
import { liveSheetId, liveSheetState, shouldPopLiveSheet } from "./liveSheetHistory.ts";
import { withDeadline } from "./withDeadline.ts";

function named(name: string) {
  const error = new Error(name);
  error.name = name;
  return error;
}

function fakeStream(log: string[]): CameraStream {
  return {
    getTracks: () => [
      { stop() { log.push("video"); } },
      { stop() { log.push("audio"); } },
    ],
  };
}

describe("camera access", () => {
  it("classifies every failure the camera can throw", () => {
    assert.equal(classifyCameraError(named("NotAllowedError")), "denied");
    assert.equal(classifyCameraError(named("PermissionDeniedError")), "denied");
    assert.equal(classifyCameraError(named("NotReadableError")), "in-use");
    assert.equal(classifyCameraError(named("TrackStartError")), "in-use");
    assert.equal(classifyCameraError(named("AbortError")), "in-use");
    assert.equal(classifyCameraError(named("NotFoundError")), "no-device");
    assert.equal(classifyCameraError(named("DevicesNotFoundError")), "no-device");
    assert.equal(classifyCameraError(named("OverconstrainedError")), "no-device");
    assert.equal(classifyCameraError(named("SecurityError")), "insecure");
    assert.equal(classifyCameraError(named("NotSupportedError")), "unsupported");
    assert.equal(classifyCameraError(named("TypeError")), "unsupported");
    assert.equal(classifyCameraError(named("TimeoutError")), "timeout");
    assert.equal(classifyCameraError(named("SomethingElse")), "failed");
  });

  it("does not call getUserMedia on an insecure or unsupported page", async () => {
    let calls = 0;
    const insecure = await requestCamera({
      getUserMedia: async () => {
        calls += 1;
        return fakeStream([]);
      },
      secure: false,
      supported: true,
    });
    const missing = await requestCamera({
      getUserMedia: async () => {
        calls += 1;
        return fakeStream([]);
      },
      secure: true,
      supported: false,
    });
    assert.equal(insecure.ok, false);
    assert.equal(missing.ok, false);
    if (!insecure.ok) assert.equal(insecure.failure, "insecure");
    if (!missing.ok) assert.equal(missing.failure, "unsupported");
    assert.equal(calls, 0);
    assert.equal(CAMERA_TIMEOUT_MS, 12_000);
  });

  it("returns a plain message for a denied camera", async () => {
    const result = await requestCamera({
      getUserMedia: async () => {
        throw named("NotAllowedError");
      },
      secure: true,
      supported: true,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "denied");
      assert.match(result.message, /denied/i);
      assert.match(result.title, /denied/i);
    }
  });

  it("times out a camera that never starts and stops a late stream", async () => {
    const stopped: string[] = [];
    let release: (stream: CameraStream) => void = () => {};
    const result = await requestCamera({
      getUserMedia: () => new Promise<CameraStream>((resolve) => {
        release = resolve;
      }),
      secure: true,
      supported: true,
      timeoutMs: 30,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "timeout");
      assert.match(result.message, /phone call/i);
    }
    release(fakeStream(stopped));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(stopped, ["video", "audio"]);
  });

  it("stops tracks when the sheet closes before the camera returns", async () => {
    const stopped: string[] = [];
    let wanted = true;
    const pending = requestCamera({
      getUserMedia: async () => fakeStream(stopped),
      secure: true,
      supported: true,
      timeoutMs: 1000,
      stillWanted: () => wanted,
    });
    wanted = false;
    const result = await pending;
    assert.equal(result.ok, false);
    assert.deepEqual(stopped, ["video", "audio"]);
  });

  it("stops every track on an open stream", () => {
    const stopped: string[] = [];
    stopStreamTracks(fakeStream(stopped));
    assert.deepEqual(stopped, ["video", "audio"]);
    stopStreamTracks(null);
  });
});

describe("live sheet history", () => {
  it("keeps the router index and marks the sheet", () => {
    const next = liveSheetState({ idx: 2, usr: null }, "stream-1");
    assert.equal(next.idx, 2);
    assert.equal(liveSheetId(next), "stream-1");
    assert.equal(shouldPopLiveSheet(next, "stream-1"), true);
    assert.equal(shouldPopLiveSheet(next, "other"), false);
    assert.equal(liveSheetId(null), null);
    assert.equal(shouldPopLiveSheet({}, "stream-1"), false);
  });
});

describe("withDeadline", () => {
  it("rejects when the work never settles", async () => {
    await assert.rejects(
      () => withDeadline(new Promise(() => {}), 20, "Live video did not respond. Try again."),
      /did not respond/,
    );
  });

  it("returns the value when the work finishes first", async () => {
    const value = await withDeadline(Promise.resolve("ok"), 1000, "too slow");
    assert.equal(value, "ok");
  });
});
