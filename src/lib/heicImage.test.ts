import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isHeicImage, jpegStorageName } from "./heicImage.ts";

describe("isHeicImage", () => {
  it("detects HEIC and HEIF names and types", () => {
    assert.equal(isHeicImage("photo.HEIC", ""), true);
    assert.equal(isHeicImage("photo.heif", "application/octet-stream"), true);
    assert.equal(isHeicImage("IMG_1234.HEIC", "image/heic"), true);
    assert.equal(isHeicImage("download", "image/heif"), true);
    assert.equal(isHeicImage("live.heic", "image/heic-sequence"), true);
  });

  it("leaves ordinary images alone", () => {
    assert.equal(isHeicImage("photo.jpg", "image/jpeg"), false);
    assert.equal(isHeicImage("photo.JPEG", "image/jpeg"), false);
    assert.equal(isHeicImage("photo.png", "image/png"), false);
    assert.equal(isHeicImage("photo.webp", ""), false);
    assert.equal(isHeicImage("notes.pdf", "application/pdf"), false);
    assert.equal(isHeicImage("photo.heic.jpg", "image/jpeg"), false);
  });
});

describe("jpegStorageName", () => {
  it("renames a HEIC or HEIF photo to jpeg", () => {
    assert.equal(jpegStorageName("photo.HEIC"), "photo.jpg");
    assert.equal(jpegStorageName("Album/IMG.heif", "image/heif"), "Album/IMG.jpg");
    assert.equal(jpegStorageName("my.photo.HEIC", ""), "my.photo.jpg");
    assert.equal(jpegStorageName("picture", "image/heic"), "picture.jpg");
    assert.equal(jpegStorageName("uid/avatar.heic", ""), "uid/avatar.jpg");
  });

  it("keeps a non-HEIC filename", () => {
    assert.equal(jpegStorageName("photo.jpg", "image/jpeg"), "photo.jpg");
    assert.equal(jpegStorageName("photo.PNG", "image/png"), "photo.PNG");
    assert.equal(jpegStorageName("clip.mov", "video/quicktime"), "clip.mov");
  });
});
