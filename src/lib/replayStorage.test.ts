import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mediaObjectPath } from "./replayStorage.ts";

describe("replay storage path", () => {
  it("reads the object path out of a public media URL", () => {
    const url = "http://127.0.0.1:5499/storage/v1/object/public/media/host/replays/stream-1.webm?t=1";
    assert.equal(mediaObjectPath(url), "host/replays/stream-1.webm");
  });

  it("decodes a path that contains spaces", () => {
    const url = "https://example.supabase.co/storage/v1/object/public/media/host/replays/late%20night.webm";
    assert.equal(mediaObjectPath(url), "host/replays/late night.webm");
  });

  it("ignores a URL that is not in the media bucket", () => {
    assert.equal(mediaObjectPath("https://cdn.example/replay.webm"), null);
  });
});
