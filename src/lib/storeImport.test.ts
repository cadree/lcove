import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  importStatusMessage,
  linkCardFromOpenGraph,
  mapShopifyProducts,
  pageUrl,
  emptyBrandPatch,
  parseOpenGraph,
  parseShopifyMeta,
  shopHost,
  storeFetchHeaders,
} from "../../supabase/functions/_shared/store-import.mjs";

const NUANCE_FIXTURE = {
  products: [
    {
      id: 15404207374637,
      title: "Brown Dynasty Pants",
      handle: "brown-dynasty-pants",
      body_html: "<p>Coming soon from Nuance by LCOVE.</p>",
      variants: [{ price: "180.00" }],
      images: [{ src: "https://cdn.shopify.com/s/files/product.webp" }],
    },
  ],
};

describe("shopify catalog mapping", () => {
  it("reads a public products.json payload", () => {
    const rows = mapShopifyProducts(NUANCE_FIXTURE, "nuancebylcove.com");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, "Brown Dynasty Pants");
    assert.equal(rows[0].price, 180);
    assert.equal(rows[0].external_source, "shopify");
    assert.equal(rows[0].external_url, "https://nuancebylcove.com/products/brown-dynasty-pants");
    assert.match(rows[0].description, /Nuance by LCOVE/);
    assert.equal(importStatusMessage("shopify", 1), "Imported 1 product from the public Shopify catalog.");
  });

  it("treats an empty Shopify list as Shopify, not a link card", () => {
    const rows = mapShopifyProducts({ products: [] }, "nuancebylcove.com");
    assert.deepEqual(rows, []);
    assert.match(importStatusMessage("shopify", 0), /empty product list/);
  });

  it("rejects a non-catalog payload", () => {
    assert.equal(mapShopifyProducts({ html: "<html></html>" }, "example.com"), null);
  });
});

describe("open graph fallback", () => {
  it("builds one link card from page metadata", () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Studio North" />
        <meta property="og:description" content="Rooms for photo days." />
        <meta property="og:image" content="/cover.jpg" />
      </head></html>`;
    const og = parseOpenGraph(html, "https://studionorth.example/");
    const card = linkCardFromOpenGraph(og);
    assert.equal(card.title, "Studio North");
    assert.equal(card.description, "Rooms for photo days.");
    assert.equal(card.images[0], "https://studionorth.example/cover.jpg");
    assert.equal(card.external_source, "link");
    assert.equal(card.external_handle, "site");
  });

  it("fills an empty logo and description and keeps a custom logo", () => {
    const og = parseOpenGraph(
      `<meta property="og:image" content="https://cdn.example/logo.png" /><meta property="og:description" content="A room for the work." />`,
      "https://studionorth.example/",
    );
    const meta = parseShopifyMeta({ name: "Studio North", description: "Shopify copy" });
    assert.deepEqual(emptyBrandPatch({ logo_url: null, description: null, cover_image_url: null }, og, meta), {
      logo_url: "https://cdn.example/logo.png",
      description: "A room for the work.",
      cover_image_url: "https://cdn.example/logo.png",
    });
    assert.deepEqual(emptyBrandPatch({ logo_url: "https://custom/logo.png", description: "Mine", cover_image_url: "https://custom/cover.png" }, og, meta), {});
    assert.equal(meta.name, "Studio North");
  });

  it("reads the Nuance homepage logo and Shopify meta description", () => {
    const html = `
      <meta name="description" content="Nuance by LCOVE is a Charlotte, NC streetwear and jewelry brand." />
      <meta property="og:description" content="Nuance by LCOVE is a Charlotte, NC streetwear and jewelry brand." />
      <meta property="og:image" content="https://nuancebylcove.com/cdn/shop/files/Screenshot.png?v=1777557089&width=1200" />
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Organization","name":"Nuance by LCOVE","logo":"https://nuancebylcove.com/cdn/shop/t/22/assets/lcove-symbol-bear.webp","description":"JSON-LD copy"}
      </script>`;
    const og = parseOpenGraph(html, "https://nuancebylcove.com/");
    const meta = parseShopifyMeta({
      name: "LCOVE",
      description: "The Legacy Necklace ($99) and Legacy Bracelet ($40): 316 stainless steel, waterproof.",
    });
    assert.equal(og.logo, "https://nuancebylcove.com/cdn/shop/t/22/assets/lcove-symbol-bear.webp");
    assert.match(og.image, /Screenshot\.png\?v=1777557089&width=1200/);
    assert.match(og.description, /Charlotte, NC streetwear/);
    assert.deepEqual(emptyBrandPatch({ logo_url: null, description: null, cover_image_url: null }, og, meta), {
      logo_url: "https://nuancebylcove.com/cdn/shop/t/22/assets/lcove-symbol-bear.webp",
      description: "Nuance by LCOVE is a Charlotte, NC streetwear and jewelry brand.",
      cover_image_url: "https://nuancebylcove.com/cdn/shop/files/Screenshot.png?v=1777557089&width=1200",
    });
    assert.match(storeFetchHeaders("text/html")["user-agent"], /Mozilla/);
    assert.equal(emptyBrandPatch({ logo_url: null, description: null, cover_image_url: null }, { description: "", image: "", logo: "" }, meta).description, meta.description);
  });

  it("normalizes a store host and refuses local addresses", () => {
    assert.equal(shopHost("https://NuanceByLcove.com/collections/all"), "nuancebylcove.com");
    assert.equal(pageUrl("nuancebylcove.com"), "https://nuancebylcove.com/");
    assert.throws(() => shopHost("http://localhost/products.json"), /not a valid URL/);
    assert.throws(() => shopHost("http://127.0.0.1/products.json"), /not a valid URL/);
  });
});
