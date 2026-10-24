import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REPLAY_CACHE_CONTROL, mediaObjectPath, replayObjectPath } from "./replayStorage.ts";

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

  it("gives every replay upload its own path and a one-minute cache", () => {
    const host = "11111111-1111-4111-8111-111111111111";
    const stream = "0412aaaa-0000-4000-8000-000000000041";
    const first = replayObjectPath(host, stream, "webm", "1710000000000-aaaa");
    const second = replayObjectPath(host, stream, "webm", "1710000000001-bbbb");
    assert.equal(first, `${host}/replays/${stream}-1710000000000-aaaa.webm`);
    assert.notEqual(first, second);
    assert.equal(second.startsWith(`${host}/replays/`), true);
    assert.equal(REPLAY_CACHE_CONTROL, "60");
    const publicUrl = `https://example.supabase.co/storage/v1/object/public/media/${first}`;
    assert.equal(mediaObjectPath(publicUrl), first);
  });
});
