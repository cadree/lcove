import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cameraConstraintAttempts,
  captureDevice,
  isIosCapture,
  liveLinkAfter,
  PHONE_CAPTURE,
  publishPlan,
  recorderTimeslice,
  replayUploadPlan,
  REPLAY_UPLOAD_LIMIT_BYTES,
  setAudioSession,
  tracksNeedRestart,
} from "./livePhone.ts";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

describe("live phone capture", () => {
  it("treats an iPhone and an iPad as a phone and keeps a desktop computer a desktop", () => {
    assert.equal(captureDevice({ userAgent: IPHONE }), "phone");
    assert.equal(isIosCapture({ userAgent: IPHONE }), true);
    assert.equal(captureDevice({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 5 }), "phone");
    assert.equal(captureDevice({ userAgent: "Mozilla/5.0 (Windows NT 10.0)", platform: "Win32", maxTouchPoints: 0 }), "desktop");
    assert.equal(isIosCapture({ userAgent: "Mozilla/5.0 (Linux; Android 14)" }), false);
  });

  it("asks the phone for the front camera at 360p and falls back when that is rejected", () => {
    const attempts = cameraConstraintAttempts("phone");
    const video = attempts[0].video;
    assert.equal(typeof video, "object");
    if (video && typeof video === "object") {
      assert.equal(video.facingMode, "user");
      assert.deepEqual(video.width, { ideal: PHONE_CAPTURE.width, max: PHONE_CAPTURE.width });
      assert.deepEqual(video.height, { ideal: PHONE_CAPTURE.height, max: PHONE_CAPTURE.height });
    }
    assert.deepEqual(attempts[1], { video: { facingMode: "user" }, audio: true });
    assert.deepEqual(attempts[2], { video: true, audio: true });
    assert.notEqual(cameraConstraintAttempts("desktop")[0], attempts[0]);
  });

  it("publishes one low simulcast layer on a phone and keeps the desktop at 720p", () => {
    const phone = publishPlan("phone");
    assert.equal(phone.videoCodec, "h264");
    assert.equal(phone.simulcast, true);
    assert.equal(phone.maxFramerate, 24);
    assert.equal(phone.layers.length, 1);
    assert.equal(phone.layers[0].height, 180);
    assert.ok(phone.maxBitrate < publishPlan("desktop").maxBitrate);
    assert.equal(publishPlan("desktop").videoCodec, "vp8");
    assert.equal(publishPlan("desktop").layers.length, 2);
  });

  it("sets the audio session only when the browser has one", () => {
    const session = { type: "auto" };
    assert.equal(setAudioSession({ audioSession: session }, "play-and-record"), true);
    assert.equal(session.type, "play-and-record");
    assert.equal(setAudioSession(undefined, "playback"), false);
  });

  it("does not pass a timeslice to an mp4 recorder", () => {
    assert.equal(recorderTimeslice("video/mp4"), undefined);
    assert.equal(recorderTimeslice("video/webm;codecs=vp8,opus"), 1000);
  });

  it("restarts the camera after the phone ends the tracks", () => {
    assert.equal(tracksNeedRestart([]), true);
    assert.equal(tracksNeedRestart([{ readyState: "ended" }]), true);
    assert.equal(tracksNeedRestart([{ readyState: "live" }]), false);
  });

  it("keeps a recording on the phone when it is over 50 MB", () => {
    assert.equal(replayUploadPlan(0).action, "keep-local");
    assert.equal(replayUploadPlan(REPLAY_UPLOAD_LIMIT_BYTES).action, "upload");
    const over = replayUploadPlan(REPLAY_UPLOAD_LIMIT_BYTES + 1);
    assert.equal(over.action, "keep-local");
    if (over.action === "keep-local") assert.match(over.message, /50 MB/);
  });

  it("shows a dropped connection while the host still means to be live", () => {
    assert.equal(liveLinkAfter("disconnected", false), "offline");
    assert.equal(liveLinkAfter("reconnecting", false), "reconnecting");
    assert.equal(liveLinkAfter("reconnected", false), "live");
    assert.equal(liveLinkAfter("disconnected", true), "ended");
  });
});
