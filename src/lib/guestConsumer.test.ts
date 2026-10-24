import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  clientRateKey,
  normalizeGuestEmail,
  normalizeGuestName,
  parseGuestCheckout,
  watchableStream,
} from "../../supabase/functions/_shared/guest-consumer.mjs";
import {
  PUBLIC_EVENT_COLUMNS,
  PUBLIC_STORE_COLUMNS,
  PUBLIC_STORE_ITEM_COLUMNS,
  PUBLIC_TICKET_TIER_COLUMNS,
} from "./consumerAccess.ts";

describe("guest consumer input", () => {
  it("keeps a name and email and drops anything else", () => {
    assert.equal(normalizeGuestName("  Ada "), "Ada");
    assert.equal(normalizeGuestName(""), "");
    assert.equal(normalizeGuestName("x".repeat(101)), "");
    assert.equal(normalizeGuestEmail(" Ada@Example.com "), "ada@example.com");
    assert.equal(normalizeGuestEmail("not-an-email"), "");
    assert.deepEqual(parseGuestCheckout({ guestName: "Ada", guestEmail: "ada@example.com", quantity: 2 }), {
      name: "Ada",
      email: "ada@example.com",
      quantity: 2,
    });
    assert.equal(parseGuestCheckout({ guestName: "Ada", guestEmail: "ada@example.com", paymentType: "credits" }), null);
    assert.equal(parseGuestCheckout({ guestName: "Ada", guestEmail: "ada@example.com", quantity: 11 }), null);
  });

  it("hashes the client address and does not keep the raw value", async () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.8, 10.0.0.1" });
    const key = await clientRateKey(headers);
    assert.equal(key.length, 32);
    assert.equal(key.includes("203.0.113.8"), false);
    assert.equal(await clientRateKey(headers), key);
    assert.equal(await clientRateKey(new Headers()), "");
  });

  it("treats a live room, a replay, and an embed as watchable", () => {
    assert.equal(watchableStream({ is_live: true }), true);
    assert.equal(watchableStream({ replay_available: true, replay_url: "https://cdn.example/replay.webm" }), true);
    assert.equal(watchableStream({ stream_type: "youtube", external_url: "https://youtu.be/abcdefghijk" }), true);
    assert.equal(watchableStream({ stream_type: "webrtc", is_live: false }), false);
    assert.equal(watchableStream(null), false);
  });
});

describe("anon column grants", () => {
  it("matches the migration grants and leaves contact fields out", () => {
    const sql = readFileSync("supabase/migrations/20261024120000_anon_consumer_access.sql", "utf8");
    const grant = (table: string) => {
      const marker = `) ON public.${table} TO anon;`;
      const end = sql.indexOf(marker);
      assert.ok(end > 0, table);
      const start = sql.lastIndexOf("GRANT SELECT (", end);
      return sql.slice(start + "GRANT SELECT (".length, end).split(",").map((column) => column.trim()).filter(Boolean);
    };
    assert.deepEqual(grant("events"), [...PUBLIC_EVENT_COLUMNS]);
    assert.deepEqual(grant("ticket_tiers"), [...PUBLIC_TICKET_TIER_COLUMNS]);
    assert.deepEqual(grant("stores"), [...PUBLIC_STORE_COLUMNS]);
    assert.deepEqual(grant("store_items"), [...PUBLIC_STORE_ITEM_COLUMNS]);
    for (const column of ["contact_email", "contact_phone", "email", "phone", "rtmp_stream_key"]) {
      assert.equal(grant("store_items").includes(column), false, column);
      assert.equal(grant("events").includes(column), false, column);
    }
    assert.match(sql, /REVOKE SELECT ON TABLE public\.profiles_public FROM anon/);
    assert.match(sql, /REVOKE ALL ON TABLE public\.posts FROM anon/);
    assert.match(sql, /REVOKE ALL ON TABLE public\.projects FROM anon/);
    const share = readFileSync("src/lib/shareLink.ts", "utf8");
    assert.match(share, /live: \(id: string\) => `\$\{SHARE_BASE_URL\}\/live\/\$\{id\}`/);
    assert.match(share, /product: \(id: string\) => `\$\{SHARE_BASE_URL\}\/product\/\$\{id\}`/);
  });
});
