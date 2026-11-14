import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPTY_VIEWER_PICTURE,
  hostCameraOff,
  reduceViewerPicture,
} from "./liveViewer.ts";

describe("viewer picture", () => {
  it("treats a muted video as the host camera being off, and an unmuted video as watchable", () => {
    const muted = reduceViewerPicture(EMPTY_VIEWER_PICTURE, { type: "subscribed", kind: "video", muted: true });
    assert.equal(muted.videoMuted, true);
    assert.equal(muted.hasVideo, false);
    assert.equal(hostCameraOff(muted, "watching"), true);

    const live = reduceViewerPicture(muted, { type: "unmuted", kind: "video" });
    assert.equal(live.hasVideo, true);
    assert.equal(live.videoMuted, false);
    assert.equal(hostCameraOff(live, "watching"), false);

    const offAgain = reduceViewerPicture(live, { type: "muted", kind: "video" });
    assert.equal(hostCameraOff(offAgain, "waiting"), true);
  });

  it("shows the camera as off when audio arrives with no video, and waits while nothing has arrived", () => {
    assert.equal(hostCameraOff(EMPTY_VIEWER_PICTURE, "waiting"), false);
    assert.equal(hostCameraOff(EMPTY_VIEWER_PICTURE, "connecting"), false);
    const audioOnly = reduceViewerPicture(EMPTY_VIEWER_PICTURE, { type: "subscribed", kind: "audio", muted: false });
    assert.equal(hostCameraOff(audioOnly, "waiting"), true);
    const both = reduceViewerPicture(audioOnly, { type: "subscribed", kind: "video", muted: false });
    assert.equal(hostCameraOff(both, "watching"), false);
    const gone = reduceViewerPicture(both, { type: "unsubscribed", kind: "video" });
    assert.equal(hostCameraOff(gone, "waiting"), true);
    assert.deepEqual(reduceViewerPicture(gone, { type: "reset" }), EMPTY_VIEWER_PICTURE);
  });
});
