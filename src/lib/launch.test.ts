import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publicJoinPath } from "./publicJoin.ts";
import { normalizeWaitlistSrc, csvCell, waitlistInvitePath, founderInvitePath, parseWaitlistImportCsv } from "./waitlist.ts";
import { attributionFromSearch, captureSignupAttribution } from "./signupAttribution.ts";
import { shouldScrollReveal } from "./reveal.ts";
import { formatAxisDollars } from "./formatAxisDollars.ts";
import { isKnownPath, isPublicPath } from "./appRoutes.ts";

describe("publicJoinPath", () => {
  it("sends join traffic to the waitlist and keeps src and ref", () => {
    assert.equal(publicJoinPath("?src=ig&ref=abcd2345", true), "/waitlist?src=ig&ref=abcd2345");
    assert.equal(publicJoinPath("", true), "/waitlist");
  });

  it("opens the join tab when waitlist mode is off", () => {
    assert.equal(publicJoinPath("?src=ig", false), "/auth?tab=join");
  });
});

describe("normalizeWaitlistSrc", () => {
  it("keeps the allow-list and stores everything else as direct", () => {
    assert.equal(normalizeWaitlistSrc("IG"), "ig");
    assert.equal(normalizeWaitlistSrc("oct27"), "oct27");
    assert.equal(normalizeWaitlistSrc("newsletter"), "direct");
    assert.equal(normalizeWaitlistSrc(""), "direct");
    assert.equal(normalizeWaitlistSrc(null), "direct");
  });
});

describe("waitlist helpers", () => {
  it("builds a private ref link and escapes csv cells", () => {
    assert.equal(waitlistInvitePath("ab23cd45"), "/waitlist?ref=ab23cd45");
    assert.equal(founderInvitePath("tok en"), "/auth?invite=tok%20en");
    assert.equal(csvCell('say "hi", pal'), '"say ""hi"", pal"');
  });

  it("reads a waitlist import csv with an optional ig column", () => {
    const parsed = parseWaitlistImportCsv('name,email,ig\nAda Lovelace,ada@example.com,@ada\n');
    assert.equal(parsed.error, undefined);
    assert.deepEqual(parsed.rows, [{ name: "Ada Lovelace", email: "ada@example.com", ig: "@ada" }]);
  });
});

describe("signup attribution", () => {
  it("reads src and utm fields and keeps the first touch", () => {
    const first = attributionFromSearch("?src=ig&utm_source=story", "/waitlist", "2026-10-20T00:00:00.000Z");
    assert.equal(first?.src, "ig");
    assert.equal(first?.utm_source, "story");
    const storage = new Map<string, string>();
    const memory = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    };
    captureSignupAttribution("?src=ig", "/", memory, "2026-10-20T00:00:00.000Z");
    const second = captureSignupAttribution("?src=slack&utm_medium=social", "/auth", memory, "2026-10-21T00:00:00.000Z");
    assert.equal(second?.src, "ig");
    assert.equal(second?.utm_medium, undefined);
  });
});

describe("scroll reveal", () => {
  it("stays visible without an observer or when motion is reduced", () => {
    assert.equal(shouldScrollReveal({ hasIntersectionObserver: true, prefersReducedMotion: false }), true);
    assert.equal(shouldScrollReveal({ hasIntersectionObserver: false, prefersReducedMotion: false }), false);
    assert.equal(shouldScrollReveal({ hasIntersectionObserver: true, prefersReducedMotion: true }), false);
  });
});

describe("formatAxisDollars", () => {
  it("does not turn small dollars into a thousandths label", () => {
    assert.equal(formatAxisDollars(7), "$7");
    assert.equal(formatAxisDollars(0.5), "$0.50");
    assert.equal(formatAxisDollars(1500), "$1.5k");
    assert.equal(formatAxisDollars(2000), "$2k");
  });
});

describe("app routes", () => {
  it("treats the waitlist as public and unknown paths as unknown", () => {
    assert.equal(isPublicPath("/waitlist"), true);
    assert.equal(isKnownPath("/waitlist"), true);
    assert.equal(isKnownPath("/feed"), true);
    assert.equal(isKnownPath("/this-page-is-not-real"), false);
  });
});
