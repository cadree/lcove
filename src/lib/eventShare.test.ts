import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { describe, it } from "node:test";
import jpeg from "jpeg-js";
import {
  applyEventShareHtml,
  applyHiddenEventHtml,
  eventIsShareable,
  eventPublicPath,
  eventPublicUrl,
  eventReturnPath,
  eventShareDescription,
  fetchShareCard,
  routeEventShare,
  safeImageUrl,
  slugifyEventName,
  supabaseFromConfig,
} from "../../functions/_shared/eventShare.js";
import { decodeFlyer, encodePng, jpegSize, pngSize, renderFlyerDerivative } from "../../functions/_shared/flyerImage.js";
import { eventShareConfig } from "../../scripts/event-share-config.ts";

const SHELL = `<!doctype html><html><head>
<title>Ether</title>
<meta name="description" content="A culture of aspirations" />
<meta property="og:title" content="Ether" />
<meta property="og:description" content="A culture of aspirations" />
<meta property="og:image" content="https://etherbylcove.com/og.png" />
<meta property="og:site_name" content="ETHER" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:image" content="https://etherbylcove.com/og.png" />
<link rel="icon" type="image/png" href="/favicon-32.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
</head><body></body></html>`;

const ID = "04040404-0404-4404-8404-040404040404";

const CARD = {
  id: ID,
  slug: "listening-night",
  title: "Listening night",
  host_name: "Ada Lane",
  start_date: "2026-11-01T23:00:00.000Z",
  timezone: "America/New_York",
  venue: "The loft",
  city: "New York",
  image_url: "https://cdn.example.com/ada-flyer.jpg",
};

function portraitJpeg() {
  const width = 40;
  const height = 80;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      data[i] = x < width / 2 ? 255 : 20;
      data[i + 1] = 40;
      data[i + 2] = y < height / 2 ? 80 : 180;
      data[i + 3] = 255;
    }
  }
  return jpeg.encode({ data, width, height }, 80).data;
}

describe("event share links", () => {
  it("slugifies a name the same way the migration does", () => {
    assert.equal(slugifyEventName("Listening night"), "listening-night");
    assert.equal(slugifyEventName("  Ada's 21+ loft!!! "), "ada-s-21-loft");
    assert.equal(slugifyEventName("@@@"), "event");
    assert.equal(slugifyEventName("a".repeat(80)).length, 60);
  });

  it("keeps a shareable slug URL and leaves hidden events on the uuid path", () => {
    const published = { id: ID, slug: "listening-night", is_public: true, status: "published" };
    assert.equal(eventIsShareable(published), true);
    assert.equal(eventIsShareable({ ...published, status: null }), true);
    assert.equal(eventIsShareable({ ...published, status: "draft" }), false);
    assert.equal(eventIsShareable({ ...published, status: "cancelled" }), false);
    assert.equal(eventIsShareable({ ...published, is_public: false }), false);
    assert.equal(eventPublicPath(published), "/e/listening-night");
    assert.equal(eventPublicUrl(published), "https://etherbylcove.com/e/listening-night");
    assert.equal(eventPublicPath({ ...published, is_public: false }), `/event/${ID}`);
    assert.equal(eventPublicPath({ ...published, slug: null }), `/event/${ID}`);
  });

  it("describes the host, the date and time, and the venue", () => {
    const text = eventShareDescription(CARD);
    assert.match(text, /Ada Lane/);
    assert.match(text, /Nov/);
    assert.match(text, /\d:\d{2}/);
    assert.match(text, /The loft/);
    assert.equal(text.includes("Ether"), false);
  });

  it("injects crawler tags and a square flyer icon", () => {
    const html = applyEventShareHtml(SHELL, CARD, "https://etherbylcove.com");
    assert.match(html, /<title>Listening night<\/title>/);
    assert.match(html, /property="og:title" content="Listening night"/);
    assert.match(html, /property="og:description" content="Ada Lane · [^"]+ · The loft"/);
    assert.match(html, /property="og:site_name" content="Ada Lane"/);
    assert.match(html, /name="twitter:card" content="summary_large_image"/);
    assert.match(html, /property="og:image" content="https:\/\/etherbylcove\.com\/e\/listening-night\/flyer\.jpg\?v=/);
    assert.match(html, /property="og:image:width" content="1200"/);
    assert.match(html, /property="og:image:height" content="630"/);
    assert.match(html, /rel="icon"[^>]+href="https:\/\/etherbylcove\.com\/e\/listening-night\/icon\.png\?v=/);
    assert.match(html, /rel="apple-touch-icon" href="https:\/\/etherbylcove\.com\/e\/listening-night\/icon\.png\?v=/);
    assert.equal(html.includes("og.png"), false);
    assert.equal(html.includes(">Ether<"), false);
  });

  it("does not put a hidden event's name, venue, or flyer in the shell", () => {
    const html = applyHiddenEventHtml(SHELL);
    assert.match(html, /name="robots" content="noindex, nofollow"/);
    assert.match(html, /<title>Ether<\/title>/);
    assert.equal(html.includes("Listening night"), false);
    assert.equal(html.includes("The loft"), false);
    assert.equal(html.includes("Ada Lane"), false);
    assert.equal(html.includes("flyer.jpg"), false);
  });

  it("rejects open redirects and only remembers event paths", () => {
    assert.equal(eventReturnPath("/e/listening-night/tickets?tier=ga"), "/e/listening-night/tickets?tier=ga");
    assert.equal(eventReturnPath("/event/04040404-0404-4404-8404-040404040404"), `/event/${ID}`);
    assert.equal(eventReturnPath("https://evil.example/e/x"), null);
    assert.equal(eventReturnPath("//evil.example"), null);
    assert.equal(eventReturnPath("/feed"), null);
    assert.equal(eventReturnPath("/\\e\\x"), null);
  });

  it("blocks private and self-referential image hosts", () => {
    assert.equal(safeImageUrl("https://cdn.example.com/ada.jpg"), "https://cdn.example.com/ada.jpg");
    assert.equal(safeImageUrl("http://cdn.example.com/ada.jpg"), null);
    assert.equal(safeImageUrl("https://127.0.0.1/ada.jpg"), null);
    assert.equal(safeImageUrl("https://10.0.0.8/ada.jpg"), null);
    assert.equal(safeImageUrl("https://169.254.169.254/latest"), null);
    assert.equal(safeImageUrl("https://cdn.example.com/e/listening-night/flyer.jpg"), null);
    assert.equal(safeImageUrl("https://cdn.example.com/icon.png"), null);
  });

  it("redirects the old uuid URL and hides a missing card", async () => {
    const published = await routeEventShare(new Request(`https://etherbylcove.com/event/${ID}`), {
      loadCard: async () => ({ configured: true, card: CARD }),
      loadHtml: async () => SHELL,
      renderImage: async () => null,
    });
    assert.equal(published.kind, "redirect");
    assert.equal(published.status, 301);
    assert.equal(published.location, "https://etherbylcove.com/e/listening-night");

    const page = await routeEventShare(new Request("https://etherbylcove.com/e/listening-night"), {
      loadCard: async () => ({ configured: true, card: CARD }),
      loadHtml: async () => SHELL,
      renderImage: async () => ({ bytes: new Uint8Array([1]), contentType: "image/jpeg" }),
    });
    assert.equal(page.kind, "html");
    assert.match(page.html, /og:title" content="Listening night"/);

    const hidden = await routeEventShare(new Request("https://etherbylcove.com/e/secret-draft"), {
      loadCard: async () => ({ configured: true, card: null }),
      loadHtml: async () => SHELL,
      renderImage: async () => null,
    });
    assert.equal(hidden.kind, "html");
    assert.equal(hidden.html.includes("secret-draft"), false);
    assert.equal(hidden.html.includes("Listening night"), false);
    assert.match(hidden.html, /noindex, nofollow/);

    const image = await routeEventShare(new Request("https://etherbylcove.com/e/secret-draft/flyer.jpg"), {
      loadCard: async () => ({ configured: true, card: null }),
      loadHtml: async () => SHELL,
      renderImage: async () => null,
    });
    assert.equal(image.kind, "empty");
    assert.equal(image.status, 404);

    const passthrough = await routeEventShare(new Request("https://etherbylcove.com/feed"), {
      loadCard: async () => { throw new Error("feed must not load a card"); },
      loadHtml: async () => SHELL,
      renderImage: async () => null,
    });
    assert.equal(passthrough.kind, "passthrough");
  });

  it("crops the flyer to the card and the icon", () => {
    const source = portraitJpeg();
    const card = renderFlyerDerivative(source, "image/jpeg", "flyer");
    const icon = renderFlyerDerivative(source, "image/jpeg", "icon");
    assert.deepEqual(jpegSize(card.bytes), { width: 1200, height: 630 });
    assert.equal(card.contentType, "image/jpeg");
    assert.deepEqual(pngSize(icon.bytes), { width: 180, height: 180 });
    assert.equal(icon.contentType, "image/png");
    const tiny = new Uint8Array(8 * 8 * 4).fill(255);
    const decoded = decodeFlyer(encodePng(tiny, 8, 8), "image/png");
    assert.equal(decoded?.width, 8);
    assert.equal(decoded?.height, 8);
  });

  it("calls the public project baked at build time", async () => {
    assert.deepEqual(eventShareConfig({ VITE_SUPABASE_URL: "https://example.supabase.co/", VITE_SUPABASE_PUBLISHABLE_KEY: "anon-public" }), {
      url: "https://example.supabase.co",
      key: "anon-public",
    });
    assert.equal(supabaseFromConfig(null), null);
    assert.equal(supabaseFromConfig({ url: "", key: "anon-public" }), null);
    const calls = [];
    const result = await fetchShareCard(
      { url: "https://example.supabase.co", key: "anon-public" },
      "listening-night",
      async (url, init) => {
        calls.push({ url, apikey: init.headers.apikey });
        return new Response(JSON.stringify([CARD]), { status: 200 });
      },
    );
    assert.equal(result.configured, true);
    assert.equal(result.card.title, "Listening night");
    assert.deepEqual(calls, [{ url: "https://example.supabase.co/rest/v1/rpc/public_event_share", apikey: "anon-public" }]);
  });

  it("leaves the landing shell and the feed out of the event function", () => {
    const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    assert.match(index, /<title>Ether<\/title>/);
    assert.match(index, /og:image" content="https:\/\/etherbylcove\.com\/og\.png"/);
    assert.equal(existsSync(new URL("../../functions/_middleware.js", import.meta.url)), false);
    assert.equal(existsSync(new URL("../../wrangler.toml", import.meta.url)), false);
    const share = readFileSync(new URL("../../functions/_shared/eventShare.js", import.meta.url), "utf8");
    const request = readFileSync(new URL("../../functions/_shared/eventShareRequest.js", import.meta.url), "utf8");
    assert.equal(share.includes("VITE_SUPABASE"), false);
    assert.equal(request.includes("VITE_SUPABASE"), false);
    const sql = readFileSync(new URL("../../supabase/migrations/20261024211000_event_share_slug.sql", import.meta.url), "utf8");
    assert.match(sql, /is_public IS TRUE/);
    assert.match(sql, /'draft'/);
    assert.match(sql, /'cancelled'/);
    assert.match(sql, /search_path = public/);
    assert.equal(/pgcrypto|gen_salt|crypt\(/.test(sql), false);
  });
});
