// cspell:words mzstatic
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildReleases,
  groupCatalog,
  listenOnServices,
  moveInList,
  orderSections,
  positionsFor,
  releaseKey,
  squareCover,
  trackKey,
  validateSectionTitle,
} from "./musicCatalog.ts";

const APPLE_WIDE = "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/88/64/de/8864dea6/artwork.jpg/1200x630wp-60.jpg";

describe("listenOnServices", () => {
  it("shows each service once, in first-seen order", () => {
    const out = listenOnServices([
      { platform: "spotify", url: "https://open.spotify.com/playlist/37i9dQZF1DX4JAvHpjipBk?si=x" },
      { platform: "apple_music", url: "https://music.apple.com/us/album/alone/1732671747?i=1732671748" },
      { platform: "spotify", url: "https://open.spotify.com/track/5d2Sj3lMKJFefwU26GInQu" },
    ]);
    assert.deepEqual(out.map((s) => s.label), ["Spotify", "Apple Music"]);
    assert.equal(out[0].url, "https://open.spotify.com/playlist/37i9dQZF1DX4JAvHpjipBk");
  });
  it("prefers the artist page for a service", () => {
    const out = listenOnServices([
      { url: "https://open.spotify.com/track/5d2Sj3lMKJFefwU26GInQu" },
      { url: "https://open.spotify.com/artist/2eQjgtHQMOyXhfhXXu4HBA" },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].url, "https://open.spotify.com/artist/2eQjgtHQMOyXhfhXXu4HBA");
  });
  it("detects the service from the URL, not the saved label, and skips junk", () => {
    const out = listenOnServices([
      { platform: "spotify", url: "https://soundcloud.com/a/b" },
      { platform: "spotify", url: "not a link" },
    ]);
    assert.deepEqual(out.map((s) => s.platform), ["soundcloud"]);
  });
});

describe("buildReleases", () => {
  it("puts Spotify tracks and Apple albums in one list with square covers", () => {
    const out = buildReleases(
      [{ name: "Alone Feat A Cadre Shay T", image_url: APPLE_WIDE, apple_music_url: "https://music.apple.com/us/album/alone/1732671747?i=1732671748" }],
      [{ name: "Party With The Boys", album_image: "https://image-cdn-ak.spotifycdn.com/image/abc", spotify_url: "https://open.spotify.com/track/5d2Sj3lMKJFefwU26GInQu?si=1" }],
    );
    assert.deepEqual(out.map((r) => r.title), ["Alone Feat A Cadre Shay T", "Party With The Boys"]);
    assert.ok(out[0].cover?.endsWith("/600x600bb.jpg"));
    assert.equal(out[1].cover, "https://image-cdn-ak.spotifycdn.com/image/abc");
    assert.equal(out[1].releaseType, "Track");
  });
  it("folds a track into its album's track list instead of a second card", () => {
    const out = buildReleases(
      [{ name: "Night Drive", release_date: "2024-05-01", type: "album", spotify_url: "https://open.spotify.com/album/aaa" }],
      [
        { name: "Intro", album_name: "night drive", spotify_url: "https://open.spotify.com/track/t1" },
        { name: "Outro", album_name: "Night Drive", spotify_url: "https://open.spotify.com/track/t2" },
        { name: "Intro", album_name: "Night Drive", spotify_url: "https://open.spotify.com/track/t3" },
      ],
    );
    assert.equal(out.length, 1);
    assert.deepEqual(out[0].tracks, ["Intro", "Outro"]);
    assert.equal(out[0].year, "2024");
    assert.equal(out[0].releaseType, "Album");
  });
  it("never invents a year, album or track list", () => {
    const [only] = buildReleases([{ name: "Loose" }], []);
    assert.equal(only.year, undefined);
    assert.equal(only.album, undefined);
    assert.deepEqual(only.tracks, []);
  });
  it("drops repeats of the same link and nameless entries", () => {
    const out = buildReleases(
      [{ name: "A", spotify_url: "https://open.spotify.com/album/x?si=1" }, { name: "A again", spotify_url: "https://open.spotify.com/album/x" }, { name: " " }],
      [{ name: "" }],
    );
    assert.deepEqual(out.map((r) => r.title), ["A"]);
  });
});

describe("releaseKey and squareCover", () => {
  it("keys ignore tracking params but keep Apple's song id", () => {
    assert.equal(releaseKey("https://open.spotify.com/track/abc?si=1&utm_source=x"), "release:open.spotify.com/track/abc");
    assert.equal(releaseKey("https://music.apple.com/us/album/alone/1?i=2&ls=1"), "release:music.apple.com/us/album/alone/1?i=2");
    assert.equal(releaseKey("javascript:alert(1)"), null);
  });
  it("only rewrites Apple image CDN sizes", () => {
    assert.equal(squareCover("https://i.scdn.co/image/ab67"), "https://i.scdn.co/image/ab67");
    assert.equal(squareCover(undefined), undefined);
    assert.equal(squareCover("https://evil.example/x/1200x630wp.jpg"), "https://evil.example/x/1200x630wp.jpg");
  });
});

describe("sections", () => {
  const sections = [
    { id: "s2", title: "DJ Mixes", cover_url: null, position: 1, created_at: "2026-11-15T10:00:00Z" },
    { id: "s1", title: "Albums", cover_url: "https://x/c.jpg", position: 0, created_at: "2026-11-15T11:00:00Z" },
    { id: "s3", title: "Empty", cover_url: null, position: 1, created_at: "2026-11-15T12:00:00Z" },
  ];
  const items = [
    { key: "release:a", kind: "release" as const },
    { key: "release:b", kind: "release" as const },
    { key: trackKey("t1"), kind: "track" as const },
    { key: trackKey("t2"), kind: "track" as const },
  ];

  it("orders by position, then creation time", () => {
    assert.deepEqual(orderSections(sections).map((s) => s.id), ["s1", "s2", "s3"]);
  });
  it("groups placed items in order and leaves the rest under the built-in groups", () => {
    const groups = groupCatalog(items, sections, [
      { section_id: "s1", item_key: "release:b", position: 1 },
      { section_id: "s1", item_key: "track:t1", position: 0 },
      { section_id: "s2", item_key: "release:gone", position: 0 },
      { section_id: "deleted", item_key: "release:a", position: 0 },
    ]);
    assert.deepEqual(groups.map((g) => [g.id, g.keys]), [
      ["s1", ["track:t1", "release:b"]],
      ["releases", ["release:a"]],
      ["locked", ["track:t2"]],
    ]);
    assert.equal(groups[1].title, "More releases");
  });
  it("keeps empty sections for the owner only", () => {
    const visitor = groupCatalog(items, sections, []);
    assert.deepEqual(visitor.map((g) => g.id), ["releases", "locked"]);
    assert.equal(visitor[0].title, "Releases");
    const owner = groupCatalog(items, sections, [], { includeEmpty: true });
    assert.deepEqual(owner.map((g) => g.id), ["s1", "s2", "s3", "releases", "locked"]);
  });
  it("moves and renumbers", () => {
    assert.deepEqual(moveInList(["a", "b", "c"], 2, -1), ["a", "c", "b"]);
    const same = ["a", "b"];
    assert.equal(moveInList(same, 0, -1), same);
    assert.deepEqual(positionsFor(["c", "a"]), [{ id: "c", position: 0 }, { id: "a", position: 1 }]);
  });
  it("validates titles the same way the database does", () => {
    assert.deepEqual(validateSectionTitle("  DJ   Mixes "), { ok: true, title: "DJ Mixes" });
    assert.equal(validateSectionTitle("   ").ok, false);
    assert.equal(validateSectionTitle("x".repeat(61)).ok, false);
  });
});

describe("profileLinks", () => {
  it("uses saved links, else the older artist columns, and drops junk", async () => {
    const { profileLinks } = await import("./musicCatalog.ts");
    assert.deepEqual(profileLinks({ platform_links: [{ platform: "spotify", url: "x" }, { platform: "soundcloud", url: "https://soundcloud.com/a" }] }), [
      { platform: "soundcloud", url: "https://soundcloud.com/a" },
    ]);
    assert.deepEqual(profileLinks({ platform_links: [], spotify_artist_url: "https://open.spotify.com/artist/1" }), [
      { platform: "spotify", url: "https://open.spotify.com/artist/1" },
    ]);
  });
});
