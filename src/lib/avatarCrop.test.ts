import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AVATAR_MAX_SIDE,
  MAX_ZOOM,
  MIN_ZOOM,
  avatarOutputSide,
  clampPan,
  clampZoom,
  cropGeometry,
  panAfterDrag,
} from "./avatarCrop.ts";

const EPS = 1e-6;

function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < EPS, `${actual} !== ${expected}`);
}

describe("cropGeometry", () => {
  it("centers a landscape photo on the shorter side", () => {
    const crop = cropGeometry({
      imageWidth: 400,
      imageHeight: 200,
      frameSize: 200,
      zoom: 1,
      panX: 0,
      panY: 0,
    });
    close(crop.size, 200);
    close(crop.x, 100);
    close(crop.y, 0);
    close(crop.left, -100);
    close(crop.top, 0);
  });

  it("centers a portrait photo on the shorter side", () => {
    const crop = cropGeometry({
      imageWidth: 100,
      imageHeight: 300,
      frameSize: 100,
      zoom: 1,
      panX: 0,
      panY: 0,
    });
    close(crop.size, 100);
    close(crop.x, 0);
    close(crop.y, 100);
  });

  it("keeps a square photo whole at the minimum zoom", () => {
    const crop = cropGeometry({
      imageWidth: 800,
      imageHeight: 800,
      frameSize: 320,
      zoom: 1,
      panX: 0,
      panY: 0,
    });
    close(crop.size, 800);
    close(crop.x, 0);
    close(crop.y, 0);
    close(crop.offsetX, 0);
    close(crop.offsetY, 0);
  });

  it("zooms in by shrinking the source square around the center", () => {
    const crop = cropGeometry({
      imageWidth: 400,
      imageHeight: 200,
      frameSize: 200,
      zoom: 2,
      panX: 0,
      panY: 0,
    });
    close(crop.size, 100);
    close(crop.x, 150);
    close(crop.y, 50);
  });

  it("moves the square toward the left of the photo when the photo is dragged right", () => {
    const crop = cropGeometry({
      imageWidth: 400,
      imageHeight: 200,
      frameSize: 200,
      zoom: 1,
      panX: 1,
      panY: 0,
    });
    close(crop.x, 0);
    close(crop.y, 0);
    close(crop.offsetX, 100);
  });

  it("moves the square toward the bottom of a portrait photo when the photo is dragged up", () => {
    const crop = cropGeometry({
      imageWidth: 100,
      imageHeight: 300,
      frameSize: 100,
      zoom: 1,
      panX: 0,
      panY: -1,
    });
    close(crop.x, 0);
    close(crop.y, 200);
    close(crop.offsetY, -100);
  });

  it("keeps the photo covering the frame and the square inside the photo", () => {
    const samples = [
      { imageWidth: 1, imageHeight: 1, frameSize: 10, zoom: 1, panX: 0, panY: 0 },
      { imageWidth: 5000, imageHeight: 100, frameSize: 320, zoom: 3, panX: -1, panY: 1 },
      { imageWidth: 240, imageHeight: 900, frameSize: 280, zoom: 1.5, panX: 0.4, panY: -0.8 },
      { imageWidth: 1024, imageHeight: 1024, frameSize: 256, zoom: 2.25, panX: 1, panY: -1 },
    ];
    for (const sample of samples) {
      const crop = cropGeometry(sample);
      assert.ok(crop.x >= -EPS);
      assert.ok(crop.y >= -EPS);
      assert.ok(crop.x + crop.size <= sample.imageWidth + EPS);
      assert.ok(crop.y + crop.size <= sample.imageHeight + EPS);
      assert.ok(crop.left <= EPS);
      assert.ok(crop.top <= EPS);
      assert.ok(crop.left + crop.displayWidth >= sample.frameSize - EPS);
      assert.ok(crop.top + crop.displayHeight >= sample.frameSize - EPS);
      close(crop.left + crop.x * (sample.frameSize / crop.size), 0);
      close(crop.top + crop.y * (sample.frameSize / crop.size), 0);
    }
  });

  it("clamps zoom and ignores a pan that is not a real number", () => {
    const crop = cropGeometry({
      imageWidth: 0,
      imageHeight: -5,
      frameSize: 0,
      zoom: Number.NaN,
      panX: Number.POSITIVE_INFINITY,
      panY: 8,
    });
    assert.equal(crop.zoom, MIN_ZOOM);
    assert.equal(crop.panX, 0);
    assert.equal(crop.panY, 1);
    close(crop.size, 1);
  });
});

describe("panAfterDrag", () => {
  const base = {
    imageWidth: 400,
    imageHeight: 200,
    frameSize: 200,
    zoom: 1,
    panX: 0,
    panY: 0,
  };

  it("turns a drag into a pan and stops at the edge", () => {
    const nudged = panAfterDrag({ ...base, deltaX: 50, deltaY: 0 });
    close(nudged.panX, 0.5);
    close(nudged.panY, 0);

    const past = panAfterDrag({ ...base, deltaX: 1000, deltaY: -20 });
    close(past.panX, 1);
    close(past.panY, 0);
  });

  it("leaves a covered edge alone when that axis cannot move", () => {
    const square = panAfterDrag({
      imageWidth: 200,
      imageHeight: 200,
      frameSize: 200,
      zoom: 1,
      panX: 0.2,
      panY: -0.4,
      deltaX: 40,
      deltaY: -30,
    });
    close(square.panX, 0);
    close(square.panY, 0);
  });

  it("keeps the same pan fraction when only the zoom changes", () => {
    const dragged = panAfterDrag({ ...base, zoom: 2, panX: 0, panY: 0, deltaX: 150, deltaY: 50 });
    const wide = cropGeometry({ ...base, zoom: 2, panX: dragged.panX, panY: dragged.panY });
    const tighter = cropGeometry({ ...base, zoom: 3, panX: dragged.panX, panY: dragged.panY });
    close(wide.panX, tighter.panX);
    close(wide.panY, tighter.panY);
    assert.ok(tighter.size < wide.size);
  });
});

describe("avatarOutputSide", () => {
  it("caps the saved side at 1024 and does not enlarge a smaller crop", () => {
    assert.equal(AVATAR_MAX_SIDE, 1024);
    assert.equal(avatarOutputSide(4000), 1024);
    assert.equal(avatarOutputSide(1024), 1024);
    assert.equal(avatarOutputSide(1024.6), 1024);
    assert.equal(avatarOutputSide(800.4), 800);
    assert.equal(avatarOutputSide(10.2), 10);
    assert.equal(avatarOutputSide(0.2), 1);
    assert.equal(avatarOutputSide(Number.NaN), 1);
    assert.equal(avatarOutputSide(500, 256), 256);
  });
});

describe("clampZoom", () => {
  it("stays between the minimum cover and the maximum zoom", () => {
    assert.equal(clampZoom(0), MIN_ZOOM);
    assert.equal(clampZoom(1), 1);
    assert.equal(clampZoom(2.5), 2.5);
    assert.equal(clampZoom(9), MAX_ZOOM);
    assert.equal(clampZoom(Number.POSITIVE_INFINITY), MIN_ZOOM);
    assert.equal(clampPan(-2), -1);
    assert.equal(clampPan(0.25), 0.25);
    assert.equal(clampPan(Number.NaN), 0);
  });
});
