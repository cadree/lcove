// cspell:words Cydonia
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseSpotifyEmbed, spotifyRef } from "../../supabase/functions/_shared/spotify-embed-meta.mjs";

// Entities trimmed from open.spotify.com/embed/<kind>/<id> pages fetched on 2026-11-14.
const entities = JSON.parse(readFileSync(new URL("./__fixtures__/spotify-embed-entities.json", import.meta.url), "utf8"));
const page = (entity: unknown) =>
  `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { state: { data: { entity } } } } })}</script></html>`;

describe("spotifyRef", () => {
  it("reads kind and id, with locale and embed prefixes", () => {
    assert.deepEqual(spotifyRef("https://open.spotify.com/track/7ouMYWpwJ422jRcDASZB7P?si=abc"), { kind: "track", id: "7ouMYWpwJ422jRcDASZB7P" });
    assert.deepEqual(spotifyRef("https://open.spotify.com/intl-de/album/4LH4d3cOWNNsVw41Gqt2kv"), { kind: "album", id: "4LH4d3cOWNNsVw41Gqt2kv" });
    assert.deepEqual(spotifyRef("https://open.spotify.com/embed/artist/3TVXtAsR1Inumwj472S9r4"), { kind: "artist", id: "3TVXtAsR1Inumwj472S9r4" });
  });
  it("refuses other hosts and kinds", () => {
    assert.equal(spotifyRef("https://evil.example/?open.spotify.com/track/7ouMYWpwJ422jRcDASZB7P"), null);
    assert.equal(spotifyRef("https://open.spotify.com/user/someone"), null);
    assert.equal(spotifyRef("not a url"), null);
  });
});

describe("parseSpotifyEmbed", () => {
  it("names the artist, not the song, for a track link", () => {
    const url = "https://open.spotify.com/track/7ouMYWpwJ422jRcDASZB7P";
    const out = parseSpotifyEmbed(page(entities.track), spotifyRef(url), { pageUrl: url });
    assert.equal(out.artist_name, "Muse");
    assert.equal(out.top_tracks[0].name, "Knights of Cydonia");
    assert.equal(out.top_tracks[0].spotify_url, url);
    assert.match(out.image_url, /^https:\/\/image-cdn-/);
  });
  it("uses the album subtitle as artist and lists its tracks", () => {
    const url = "https://open.spotify.com/album/4LH4d3cOWNNsVw41Gqt2kv";
    const out = parseSpotifyEmbed(page(entities.album), spotifyRef(url), { pageUrl: url });
    assert.equal(out.artist_name, "Pink Floyd");
    assert.equal(out.albums[0].name, "The Dark Side of the Moon");
    assert.equal(out.top_tracks[0].name, "Speak to Me");
    assert.equal(out.top_tracks[0].spotify_url, "https://open.spotify.com/track/574y1r7o2tRA009FW0LE7v");
  });
  it("uses the artist name and picks the largest image for an artist link", () => {
    const out = parseSpotifyEmbed(page(entities.artist), spotifyRef("https://open.spotify.com/artist/3TVXtAsR1Inumwj472S9r4"));
    assert.equal(out.artist_name, "Drake");
    assert.match(out.image_url, /ab6761610000e5eb/);
    assert.equal(out.top_tracks.length, 2);
  });
  it("does not invent an artist for a playlist", () => {
    const out = parseSpotifyEmbed(page({ ...entities.album, type: "playlist", subtitle: "Spotify" }), { kind: "playlist", id: "37i9dQZF1DXcBWIGoYBM5M" });
    assert.equal(out.artist_name, null);
  });
  it("returns null for a page without data", () => {
    assert.equal(parseSpotifyEmbed("<html></html>", { kind: "track", id: "x" }), null);
    assert.equal(parseSpotifyEmbed('<script id="__NEXT_DATA__" type="application/json">{bad</script>', { kind: "track", id: "x" }), null);
  });
});
