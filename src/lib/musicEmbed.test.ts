import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appleMusicEmbedSrc, spotifyEmbedSrc } from "./musicEmbed.ts";

describe("music embeds", () => {
  it("embeds a Spotify album instead of forcing a track id", () => {
    assert.equal(
      spotifyEmbedSrc({
        pageUrl: "https://open.spotify.com/album/album123",
        externalId: "album123",
      }),
      "https://open.spotify.com/embed/album/album123",
    );
  });

  it("turns an Apple Music page into the embed host", () => {
    assert.equal(
      appleMusicEmbedSrc({
        pageUrl: "https://music.apple.com/us/album/song-name/1234567890?i=1234567891",
      }),
      "https://embed.music.apple.com/us/album/1234567890?i=1234567891",
    );
  });

  it("keeps an embed URL that was already saved", () => {
    const saved = "https://embed.music.apple.com/us/album/123?i=456";
    assert.equal(appleMusicEmbedSrc({ previewUrl: saved }), saved);
  });
});
