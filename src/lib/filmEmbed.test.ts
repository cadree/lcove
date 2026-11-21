import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filmEmbedSrc, isDirectFilm } from "./filmEmbed.ts";

describe("film embeds", () => {
  it("embeds youtube and vimeo and leaves a locked file alone", () => {
    assert.equal(filmEmbedSrc("https://youtu.be/abcdefghijk"), "https://www.youtube.com/embed/abcdefghijk");
    assert.equal(filmEmbedSrc("https://vimeo.com/12345"), "https://player.vimeo.com/video/12345");
    assert.equal(filmEmbedSrc("https://files.example/reel.mp4"), null);
    assert.equal(isDirectFilm("https://files.example/reel.webm?token=1"), true);
  });
});
