import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { storyVideoCrop } from "./storyVideo.ts";

describe("story video crop", () => {
  it("cuts the 9:16 frame the preview showed from a 3:4 recording", () => {
    const crop = storyVideoCrop(1440, 1920);
    assert.equal(crop.height, 1920);
    assert.equal(crop.width, 1080);
    assert.equal(crop.left, 180);
    assert.equal(crop.top, 0);
  });

  it("applies the screen zoom from the centre with even sizes", () => {
    const crop = storyVideoCrop(1080, 1920, 2);
    assert.deepEqual(crop, { left: 270, top: 480, width: 540, height: 960 });
    const odd = storyVideoCrop(641, 479, 1.3);
    assert.equal(odd.width % 2, 0);
    assert.equal(odd.height % 2, 0);
    assert.ok(odd.left + odd.width <= 641);
    assert.ok(odd.top + odd.height <= 479);
  });
});
