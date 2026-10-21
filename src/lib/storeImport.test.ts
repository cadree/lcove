import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  importStatusMessage,
  linkCardFromOpenGraph,
  mapShopifyProducts,
  pageUrl,
  parseOpenGraph,
  shopHost,
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

  it("normalizes a store host and refuses local addresses", () => {
    assert.equal(shopHost("https://NuanceByLcove.com/collections/all"), "nuancebylcove.com");
    assert.equal(pageUrl("nuancebylcove.com"), "https://nuancebylcove.com/");
    assert.throws(() => shopHost("http://localhost/products.json"), /not a valid URL/);
    assert.throws(() => shopHost("http://127.0.0.1/products.json"), /not a valid URL/);
  });
});
