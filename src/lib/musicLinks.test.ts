import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canExtractArtist, cleanMusicLinks, detectMusicPlatform, featuredEmbed, musicEmbedFor, normalizeMusicUrl } from "./musicLinks.ts";

describe("normalizeMusicUrl", () => {
  it("adds https, drops share tracking and the hash", () => {
    assert.equal(normalizeMusicUrl("open.spotify.com/track/7ouMYWpwJ422jRcDASZB7P?si=abc123"), "https://open.spotify.com/track/7ouMYWpwJ422jRcDASZB7P");
    assert.equal(normalizeMusicUrl(" https://music.apple.com/us/album/x/123?i=456&ls=1#top "), "https://music.apple.com/us/album/x/123?i=456");
  });
  it("pulls the link out of share-sheet text", () => {
    assert.equal(normalizeMusicUrl("Listen to this https://soundcloud.com/artist/song?utm_source=clipboard"), "https://soundcloud.com/artist/song");
  });
  it("refuses junk and non-web schemes", () => {
    assert.equal(normalizeMusicUrl("my band"), null);
    assert.equal(normalizeMusicUrl("javascript:alert(1)"), null);
    assert.equal(normalizeMusicUrl("https://user:pw@open.spotify.com/x"), null);
    assert.equal(normalizeMusicUrl(""), null);
  });
});

describe("detectMusicPlatform", () => {
  it("matches hosts, not substrings", () => {
    assert.equal(detectMusicPlatform("https://open.spotify.com/artist/x"), "spotify");
    assert.equal(detectMusicPlatform("https://music.apple.com/us/artist/x/1"), "apple_music");
    assert.equal(detectMusicPlatform("https://m.soundcloud.com/a"), "soundcloud");
    assert.equal(detectMusicPlatform("https://music.youtube.com/watch?v=dQw4w9WgXcQ"), "youtube_music");
    assert.equal(detectMusicPlatform("https://someone.bandcamp.com/album/a"), "bandcamp");
    assert.equal(detectMusicPlatform("https://evil.example/open.spotify.com"), "other");
  });
  it("only Spotify and Apple Music links can fill in the artist", () => {
    assert.equal(canExtractArtist("https://open.spotify.com/track/7ouMYWpwJ422jRcDASZB7P"), true);
    assert.equal(canExtractArtist("https://soundcloud.com/a/b"), false);
  });
});

describe("musicEmbedFor", () => {
  it("Spotify: compact player for tracks, tall for the rest", () => {
    assert.deepEqual(musicEmbedFor("https://open.spotify.com/track/7ouMYWpwJ422jRcDASZB7P?si=x"), {
      platform: "spotify", src: "https://open.spotify.com/embed/track/7ouMYWpwJ422jRcDASZB7P?theme=0", height: 152, title: "Spotify track",
    });
    assert.equal(musicEmbedFor("https://open.spotify.com/intl-fr/artist/3TVXtAsR1Inumwj472S9r4")?.height, 352);
    assert.equal(musicEmbedFor("https://open.spotify.com/user/abc"), null);
  });
  it("Apple Music: albums, songs and playlists embed; artist pages don't", () => {
    assert.equal(musicEmbedFor("https://music.apple.com/us/album/the-album/1440806041")?.src, "https://embed.music.apple.com/us/album/1440806041");
    assert.equal(musicEmbedFor("https://music.apple.com/us/album/the-album/1440806041?i=1440806768")?.height, 175);
    assert.equal(musicEmbedFor("https://music.apple.com/us/playlist/today/pl.f4d106fed2bd41149aaacabb233eb5eb")?.height, 450);
    assert.equal(musicEmbedFor("https://music.apple.com/us/artist/drake/271256"), null);
  });
  it("SoundCloud: official widget for the cleaned URL", () => {
    const embed = musicEmbedFor("https://soundcloud.com/artist/song?si=1");
    assert.ok(embed?.src.startsWith("https://w.soundcloud.com/player/?"));
    assert.equal(new URL(embed!.src).searchParams.get("url"), "https://soundcloud.com/artist/song");
    assert.equal(embed?.height, 166);
    assert.equal(musicEmbedFor("https://soundcloud.com/artist")?.height, 300);
    assert.equal(musicEmbedFor("https://on.soundcloud.com/abc"), null);
  });
  it("YouTube and YouTube Music: privacy player on web, wrapper page in the app", () => {
    assert.match(musicEmbedFor("https://music.youtube.com/watch?v=dQw4w9WgXcQ")!.src, /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
    assert.match(musicEmbedFor("https://youtu.be/dQw4w9WgXcQ", { native: true })!.src, /^https:\/\/etherbylcove\.com\/embed\/player\?/);
    assert.equal(musicEmbedFor("https://music.youtube.com/channel/UC123"), null);
  });
  it("Tidal and Bandcamp fall back to link buttons", () => {
    assert.equal(musicEmbedFor("https://tidal.com/browse/artist/1"), null);
    assert.equal(musicEmbedFor("https://a.bandcamp.com/album/b"), null);
  });
});

describe("cleanMusicLinks / featuredEmbed", () => {
  it("cleans, dedupes, fixes the platform and reports bad rows", () => {
    const { links, invalid } = cleanMusicLinks([
      { platform: "other", url: "open.spotify.com/artist/3TVXtAsR1Inumwj472S9r4?si=1" },
      { platform: "spotify", url: "https://open.spotify.com/artist/3TVXtAsR1Inumwj472S9r4" },
      { platform: "spotify", url: "" },
      { platform: "other", url: "my band name" },
      { platform: "other", url: "https://mysite.example/music" },
    ]);
    assert.deepEqual(links, [
      { platform: "spotify", url: "https://open.spotify.com/artist/3TVXtAsR1Inumwj472S9r4" },
      { platform: "other", url: "https://mysite.example/music" },
    ]);
    assert.deepEqual(invalid, [3]);
  });
  it("leads with Spotify, then Apple Music, SoundCloud, YouTube", () => {
    const embed = featuredEmbed([
      { platform: "soundcloud", url: "https://soundcloud.com/a/b" },
      { platform: "apple_music", url: "https://music.apple.com/us/artist/x/1" },
      { platform: "spotify", url: "https://open.spotify.com/album/4LH4d3cOWNNsVw41Gqt2kv" },
    ]);
    assert.equal(embed?.platform, "spotify");
    assert.equal(featuredEmbed([{ platform: "apple_music", url: "https://music.apple.com/us/artist/x/1" }, { platform: "soundcloud", url: "https://soundcloud.com/a/b" }])?.platform, "soundcloud");
    assert.equal(featuredEmbed([{ platform: "tidal", url: "https://tidal.com/browse/artist/1" }]), null);
  });
});
