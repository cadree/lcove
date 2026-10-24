import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AUDIO_FILE_ACCEPT, audioContentType, isAudioUpload } from "./audioFiles.ts";

describe("iOS audio picker", () => {
  it("lists extensions and MIME types without the audio wildcard", () => {
    assert.match(AUDIO_FILE_ACCEPT, /\.mp3/);
    assert.match(AUDIO_FILE_ACCEPT, /\.wav/);
    assert.match(AUDIO_FILE_ACCEPT, /\.flac/);
    assert.match(AUDIO_FILE_ACCEPT, /\.m4a/);
    assert.match(AUDIO_FILE_ACCEPT, /\.aac/);
    assert.match(AUDIO_FILE_ACCEPT, /audio\/mpeg/);
    assert.match(AUDIO_FILE_ACCEPT, /audio\/mp4/);
    assert.match(AUDIO_FILE_ACCEPT, /audio\/flac/);
    assert.match(AUDIO_FILE_ACCEPT, /audio\/aac/);
    assert.equal(AUDIO_FILE_ACCEPT.split(",").includes("audio/*"), false);
  });

  it("accepts Files picks that arrive with an empty or generic type", () => {
    assert.equal(isAudioUpload({ name: "song.mp3", type: "" }), true);
    assert.equal(isAudioUpload({ name: "song.wav", type: "application/octet-stream" }), true);
    assert.equal(isAudioUpload({ name: "song.flac", type: "" }), true);
    assert.equal(isAudioUpload({ name: "song.m4a", type: "" }), true);
    assert.equal(isAudioUpload({ name: "song.aac", type: "audio/aac" }), true);
    assert.equal(isAudioUpload({ name: "voice.mp4", type: "audio/mp4" }), true);
  });

  it("rejects video and image picks", () => {
    assert.equal(isAudioUpload({ name: "clip.mov", type: "video/quicktime" }), false);
    assert.equal(isAudioUpload({ name: "clip.mp4", type: "video/mp4" }), false);
    assert.equal(isAudioUpload({ name: "cover.jpg", type: "image/jpeg" }), false);
    assert.equal(isAudioUpload({ name: "notes.pdf", type: "application/pdf" }), false);
  });

  it("stores a concrete audio content type", () => {
    assert.equal(audioContentType({ name: "song.mp3", type: "" }), "audio/mpeg");
    assert.equal(audioContentType({ name: "song.flac", type: "application/octet-stream" }), "audio/flac");
    assert.equal(audioContentType({ name: "song.m4a", type: "" }), "audio/mp4");
    assert.equal(audioContentType({ name: "song.wav", type: "audio/wav" }), "audio/wav");
    assert.equal(audioContentType({ name: "song.aac", type: "" }), "audio/aac");
  });
});
