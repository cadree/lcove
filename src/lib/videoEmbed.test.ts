import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import vm from "node:vm";
import { embedPageResponse, innerPlayerSrc } from "../../functions/embed/player.js";
import {
  NATIVE_EMBED_PAGE,
  VIDEO_EMBED_MIGRATION_FILE,
  canonicalEmbedUrl,
  embedColumnsForInsert,
  embedFromPost,
  embedPlayerSrc,
  fetchEmbedPreview,
  nativeEmbedFrameSrc,
  parseVideoEmbedUrl,
  sanitizeThumbnailUrl,
  youtubeThumbnailUrl,
} from "./videoEmbed.ts";

const YOUTUBE_ID = "aqz-KE-bpKQ";
const VIMEO_ID = "76979871";

describe("parseVideoEmbedUrl", () => {
  it("accepts YouTube watch, youtu.be, and shorts links", () => {
    assert.deepEqual(parseVideoEmbedUrl(`https://www.youtube.com/watch?v=${YOUTUBE_ID}`), {
      provider: "youtube",
      id: YOUTUBE_ID,
    });
    assert.deepEqual(parseVideoEmbedUrl(`https://youtube.com/watch?v=${YOUTUBE_ID}&list=PL123&t=12s`), {
      provider: "youtube",
      id: YOUTUBE_ID,
    });
    assert.deepEqual(parseVideoEmbedUrl(`http://m.youtube.com/watch?v=${YOUTUBE_ID}#t=4`), {
      provider: "youtube",
      id: YOUTUBE_ID,
    });
    assert.deepEqual(parseVideoEmbedUrl(`https://youtu.be/${YOUTUBE_ID}?si=abc`), {
      provider: "youtube",
      id: YOUTUBE_ID,
    });
    assert.deepEqual(parseVideoEmbedUrl(`  https://www.youtu.be/${YOUTUBE_ID}  `), {
      provider: "youtube",
      id: YOUTUBE_ID,
    });
    assert.deepEqual(parseVideoEmbedUrl(`https://www.youtube.com/shorts/${YOUTUBE_ID}`), {
      provider: "youtube",
      id: YOUTUBE_ID,
    });
    assert.deepEqual(parseVideoEmbedUrl(`https://m.youtube.com/shorts/${YOUTUBE_ID}?feature=share`), {
      provider: "youtube",
      id: YOUTUBE_ID,
    });
  });

  it("accepts Vimeo page and player links, including an unlisted hash", () => {
    assert.deepEqual(parseVideoEmbedUrl(`https://vimeo.com/${VIMEO_ID}`), {
      provider: "vimeo",
      id: VIMEO_ID,
    });
    assert.deepEqual(parseVideoEmbedUrl(`https://www.vimeo.com/${VIMEO_ID}/a1b2c3d4`), {
      provider: "vimeo",
      id: VIMEO_ID,
      hash: "a1b2c3d4",
    });
    assert.deepEqual(parseVideoEmbedUrl(`https://player.vimeo.com/video/${VIMEO_ID}`), {
      provider: "vimeo",
      id: VIMEO_ID,
    });
    assert.deepEqual(parseVideoEmbedUrl(`https://player.vimeo.com/video/${VIMEO_ID}?h=a1b2c3d4&autoplay=1`), {
      provider: "vimeo",
      id: VIMEO_ID,
      hash: "a1b2c3d4",
    });
  });

  it("rejects other hosts, embed pages, and malformed ids", () => {
    const rejected = [
      "",
      "   ",
      "not a url",
      `check this https://youtu.be/${YOUTUBE_ID}`,
      "javascript:alert(1)",
      "data:text/html,<iframe>",
      `https://user:pass@www.youtube.com/watch?v=${YOUTUBE_ID}`,
      `https://youtube.com.evil.com/watch?v=${YOUTUBE_ID}`,
      `https://evil.com/?v=${YOUTUBE_ID}`,
      `https://www.youtube.com/embed/${YOUTUBE_ID}`,
      `https://www.youtube.com/watch?v=short`,
      `https://www.youtube.com/watch?v=${YOUTUBE_ID}extra`,
      `https://youtu.be/${YOUTUBE_ID}/extra`,
      `https://www.youtube.com/shorts/${YOUTUBE_ID}/extra`,
      "https://www.youtube.com/playlist?list=PL123",
      "https://www.youtube.com/channel/UC123",
      "https://music.youtube.com/watch?v=" + YOUTUBE_ID,
      "https://www.instagram.com/reel/abc123/",
      "https://instagram.com/p/abc123/",
      `https://vimeo.com/channels/staffpicks/${VIMEO_ID}`,
      "https://vimeo.com/user123",
      "https://vimeo.com/123",
      `https://player.vimeo.com/video/${VIMEO_ID}?h=bad hash`,
      `https://player.vimeo.com/video/${VIMEO_ID}?h=../../etc`,
      "https://player.vimeo.com/video/nope",
      "ftp://vimeo.com/76979871",
    ];

    for (const value of rejected) {
      assert.equal(parseVideoEmbedUrl(value), null, value);
    }
  });
});

describe("embedPlayerSrc", () => {
  it("builds only the privacy-friendly player hosts", () => {
    const youtube = embedPlayerSrc({ provider: "youtube", id: YOUTUBE_ID });
    assert.equal(
      youtube,
      `https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}?rel=0&playsinline=1`,
    );
    assert.equal(youtube?.includes("youtube.com/embed"), false);

    const vimeo = embedPlayerSrc({ provider: "vimeo", id: VIMEO_ID, hash: "a1b2c3d4" });
    assert.ok(vimeo?.startsWith(`https://player.vimeo.com/video/${VIMEO_ID}?`));
    assert.match(vimeo ?? "", /dnt=1/);
    assert.match(vimeo ?? "", /playsinline=1/);
    assert.match(vimeo ?? "", /h=a1b2c3d4/);
  });

  it("points the native app at the https wrapper and nowhere else", () => {
    const youtube = nativeEmbedFrameSrc({ provider: "youtube", id: YOUTUBE_ID });
    assert.equal(youtube, `${NATIVE_EMBED_PAGE}?provider=youtube&id=${YOUTUBE_ID}`);
    assert.equal(youtube?.startsWith("https://etherbylcove.com/embed/player?"), true);
    assert.equal(youtube?.includes("youtube.com"), false);

    const vimeo = nativeEmbedFrameSrc({ provider: "vimeo", id: VIMEO_ID, hash: "a1b2c3d4" });
    assert.equal(vimeo, `${NATIVE_EMBED_PAGE}?provider=vimeo&id=${VIMEO_ID}&h=a1b2c3d4`);
    assert.equal(nativeEmbedFrameSrc({ provider: "youtube", id: "javascript" }), null);
    assert.equal(nativeEmbedFrameSrc({ provider: "youtube", id: YOUTUBE_ID, hash: "abcd" }), null);
    assert.equal(nativeEmbedFrameSrc({ provider: "vimeo", id: VIMEO_ID, hash: "../evil" }), null);
  });

  it("refuses to turn a poisoned id into an iframe src", () => {
    assert.equal(embedPlayerSrc({ provider: "youtube", id: "javascript" }), null);
    assert.equal(embedPlayerSrc({ provider: "youtube", id: `${YOUTUBE_ID}"onload=` }), null);
    assert.equal(embedPlayerSrc({ provider: "vimeo", id: "123;drop" }), null);
    assert.equal(embedPlayerSrc({ provider: "vimeo", id: VIMEO_ID, hash: "../evil" }), null);
    assert.equal(embedPlayerSrc({ provider: "instagram" as "youtube", id: YOUTUBE_ID }), null);
  });
});

describe("stored embeds and thumbnails", () => {
  it("rebuilds a player only from checked columns", () => {
    assert.deepEqual(embedFromPost({ embed_provider: "youtube", embed_video_id: YOUTUBE_ID }), {
      provider: "youtube",
      id: YOUTUBE_ID,
    });
    assert.equal(embedFromPost({ embed_provider: "instagram", embed_video_id: YOUTUBE_ID }), null);
    assert.equal(embedFromPost({ embed_provider: "youtube", embed_video_id: "nope" }), null);
    assert.equal(embedFromPost({ embed_provider: "youtube", embed_video_id: YOUTUBE_ID, embed_hash: "x" }), null);
    assert.equal(embedFromPost({ embed_provider: "vimeo", embed_video_id: VIMEO_ID, embed_hash: "<script>" }), null);
  });

  it("keeps thumbnails on the free image hosts", () => {
    assert.equal(sanitizeThumbnailUrl(youtubeThumbnailUrl(YOUTUBE_ID)), youtubeThumbnailUrl(YOUTUBE_ID));
    assert.equal(sanitizeThumbnailUrl("https://i.vimeocdn.com/video/123_640.jpg"), "https://i.vimeocdn.com/video/123_640.jpg");
    assert.equal(sanitizeThumbnailUrl("https://evil.example/track.jpg"), null);
    assert.equal(sanitizeThumbnailUrl("http://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg"), null);
    assert.equal(sanitizeThumbnailUrl("javascript:alert(1)"), null);
  });

  it("stores a validated embed and drops a foreign thumbnail", () => {
    const columns = embedColumnsForInsert({
      provider: "youtube",
      id: YOUTUBE_ID,
      thumbnailUrl: "https://evil.example/x.jpg",
      title: "  Big Buck Bunny  ",
    });
    assert.equal(columns.media_url, null);
    assert.equal(columns.media_type, "video");
    assert.equal(columns.embed_provider, "youtube");
    assert.equal(columns.embed_thumbnail_url, youtubeThumbnailUrl(YOUTUBE_ID));
    assert.equal(columns.embed_title, "Big Buck Bunny");
    assert.equal(embedPlayerSrc(embedFromPost(columns)!), embedPlayerSrc({ provider: "youtube", id: YOUTUBE_ID }));
  });

  it("refuses to insert an unsupported draft", () => {
    assert.throws(() => embedColumnsForInsert({
      provider: "youtube",
      id: "not-an-id",
      thumbnailUrl: null,
      title: null,
    }));
  });
});

describe("fetchEmbedPreview", () => {
  it("uses a free oEmbed response and ignores a thumbnail from another host", async () => {
    let requested = "";
    const preview = await fetchEmbedPreview(
      { provider: "youtube", id: YOUTUBE_ID },
      async (input) => {
        requested = String(input);
        return new Response(JSON.stringify({
          title: "Big Buck Bunny",
          author_name: "Blender",
          thumbnail_url: "https://evil.example/pixel.gif",
        }), { status: 200 });
      },
    );
    assert.match(requested, /^https:\/\/www\.youtube\.com\/oembed\?format=json&url=/);
    assert.ok(requested.includes(encodeURIComponent(canonicalEmbedUrl({ provider: "youtube", id: YOUTUBE_ID }))));
    assert.equal(preview.title, "Big Buck Bunny");
    assert.equal(preview.authorName, "Blender");
    assert.equal(preview.thumbnailUrl, youtubeThumbnailUrl(YOUTUBE_ID));
  });

  it("keeps a Vimeo thumbnail from i.vimeocdn.com and falls back when the request fails", async () => {
    const ok = await fetchEmbedPreview(
      { provider: "vimeo", id: VIMEO_ID },
      async () => new Response(JSON.stringify({
        title: "Sample",
        thumbnail_url: "https://i.vimeocdn.com/video/452001751_640.jpg",
      }), { status: 200 }),
    );
    assert.equal(ok.thumbnailUrl, "https://i.vimeocdn.com/video/452001751_640.jpg");

    const failed = await fetchEmbedPreview(
      { provider: "vimeo", id: VIMEO_ID },
      async () => {
        throw new Error("offline");
      },
    );
    assert.equal(failed.thumbnailUrl, null);
    assert.equal(failed.title, null);
  });
});

function staticPlayerFrame(search, origin) {
  const html = readFileSync(new URL("../../public/embed/player.html", import.meta.url), "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  const frames = [];
  const context = {
    URLSearchParams,
    window: {
      location: {
        search,
        protocol: new URL(origin).protocol,
        origin: new URL(origin).origin,
      },
    },
    document: {
      createElement() {
        return {
          allow: "",
          allowFullscreen: false,
          referrerPolicy: "",
          src: "",
          title: "",
          setAttribute() {},
        };
      },
      body: {
        appendChild(frame) {
          frames.push(frame);
        },
      },
    },
  };
  vm.runInNewContext(script, context);
  return frames[0] ?? null;
}

describe("https embed wrapper", () => {
  it("keeps the migration filename off the timestamp used by content report reasons", () => {
    assert.equal(VIDEO_EMBED_MIGRATION_FILE, "supabase/migrations/20261020230000_post_video_embeds.sql");
    assert.equal(existsSync(new URL(`../../${VIDEO_EMBED_MIGRATION_FILE}`, import.meta.url)), true);
    assert.equal(existsSync(new URL("../../supabase/migrations/20261020120000_post_video_embeds.sql", import.meta.url)), false);
  });

  it("serves only a youtube-nocookie or Vimeo player from the https page", async () => {
    const page = new URL(`${NATIVE_EMBED_PAGE}?provider=youtube&id=${YOUTUBE_ID}`);
    const response = embedPageResponse(page);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
    const html = await response.text();
    const src = innerPlayerSrc(page);
    assert.equal(src, `https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}?rel=0&playsinline=1&origin=https%3A%2F%2Fetherbylcove.com`);
    assert.match(html, new RegExp(`src="${src?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
    assert.equal(html.includes("<script"), false);
    assert.equal(staticPlayerFrame(`?provider=youtube&id=${YOUTUBE_ID}`, "https://etherbylcove.com").src, src);

    const vimeoPage = new URL(`${NATIVE_EMBED_PAGE}?provider=vimeo&id=${VIMEO_ID}&h=a1b2c3d4`);
    assert.equal(
      innerPlayerSrc(vimeoPage),
      embedPlayerSrc({ provider: "vimeo", id: VIMEO_ID, hash: "a1b2c3d4" }),
    );
    assert.equal(staticPlayerFrame(`?provider=vimeo&id=${VIMEO_ID}&h=a1b2c3d4`, "https://etherbylcove.com").src, innerPlayerSrc(vimeoPage));
  });

  it("rejects hosts and ids that are not YouTube or Vimeo", async () => {
    const rejected = [
      `${NATIVE_EMBED_PAGE}?provider=instagram&id=${YOUTUBE_ID}`,
      `${NATIVE_EMBED_PAGE}?provider=youtube&id=short`,
      `${NATIVE_EMBED_PAGE}?provider=youtube&id=${YOUTUBE_ID}&h=abcd`,
      `${NATIVE_EMBED_PAGE}?provider=youtube&id=${YOUTUBE_ID}%22onload=`,
      `${NATIVE_EMBED_PAGE}?url=https://evil.example/embed`,
      `${NATIVE_EMBED_PAGE}?provider=vimeo&id=123`,
      `${NATIVE_EMBED_PAGE}?provider=vimeo&id=${VIMEO_ID}&h=../evil`,
    ];
    for (const value of rejected) {
      const response = embedPageResponse(new URL(value));
      assert.equal(response.status, 400, value);
      assert.equal(await response.text(), "Only a YouTube or Vimeo video can be embedded.");
      assert.equal(staticPlayerFrame(new URL(value).search, "https://etherbylcove.com"), null);
    }
  });
});
