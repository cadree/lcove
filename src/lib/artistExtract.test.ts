import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createArtistExtractor } from "./artistExtract.ts";

const noSleep = async () => {};
const URL_A = "https://open.spotify.com/track/7ouMYWpwJ422jRcDASZB7P";

describe("createArtistExtractor", () => {
  it("sends one request when paste and typing ask for the same link at once", async () => {
    let calls = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const extract = createArtistExtractor(async () => {
      calls++;
      await gate;
      return { data: { artist_name: "Muse" }, error: null };
    }, { sleep: noSleep });
    const first = extract(URL_A);
    const second = extract(URL_A);
    release();
    const [a, b] = await Promise.all([first, second]);
    assert.equal(calls, 1);
    assert.equal(a.ok, true);
    assert.equal(b.data?.artist_name, "Muse");
  });

  it("retries once after an error (cold start, dropped connection)", async () => {
    let calls = 0;
    const extract = createArtistExtractor(async () => {
      calls++;
      if (calls === 1) return { data: null, error: new Error("FunctionsFetchError") };
      return { data: { artist_name: "Muse", image_url: "https://img" }, error: null };
    }, { sleep: noSleep });
    const out = await extract(URL_A);
    assert.equal(calls, 2);
    assert.equal(out.ok, true);
  });

  it("gives up after the retry and says so instead of hanging", async () => {
    let calls = 0;
    const extract = createArtistExtractor(async () => {
      calls++;
      throw new Error("network");
    }, { sleep: noSleep });
    assert.deepEqual(await extract(URL_A), { ok: false, reason: "error" });
    assert.equal(calls, 2);
  });

  it("times out a request that never answers", async () => {
    const extract = createArtistExtractor(() => new Promise(() => {}), { sleep: noSleep, timeoutMs: 5 });
    assert.deepEqual(await extract(URL_A), { ok: false, reason: "error" });
  });

  it("treats an error body or an empty answer as unusable", async () => {
    const errBody = createArtistExtractor(async () => ({ data: { error: "URL must be a Spotify or Apple Music URL" }, error: null }), { sleep: noSleep });
    assert.equal((await errBody(URL_A)).reason, "error");
    const empty = createArtistExtractor(async () => ({ data: { image_url: null, artist_name: null, genres: [], top_tracks: [], albums: [] }, error: null }), { sleep: noSleep });
    assert.equal((await empty(URL_A)).reason, "empty");
  });

  it("asks again for the same link after the first answer settles", async () => {
    let calls = 0;
    const extract = createArtistExtractor(async () => { calls++; return { data: { artist_name: "Muse" }, error: null }; }, { sleep: noSleep });
    await extract(URL_A);
    await extract(URL_A);
    assert.equal(calls, 2);
  });
});
