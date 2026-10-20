import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { APP_STORE_URL, APPLE_TEAM_ID, INSTAGRAM_URL, SLACK_URL } from "../config/launch.ts";
import {
  APP_STORE_COMING,
  HERO_TAGLINE,
  INVITE_EMAIL_LINES,
  INVITE_EMAIL_SUBJECT,
  NO_FAKE_LINE,
  QUIZ_INTRO_COPY,
  SLACK_INTRO,
  SUPPORT_LINE,
  WAITLIST_CONFIRMATION,
  WAITLIST_PRIVACY_NOTE,
  WELCOME_HOME,
} from "../content/copy.ts";
import { publicJoinPath } from "./publicJoin.ts";
import { normalizeWaitlistSrc, csvCell, waitlistInvitePath, founderInvitePath, parseWaitlistImportCsv, inviteTokenFromMetadata } from "./waitlist.ts";
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
    assert.equal(inviteTokenFromMetadata({ waitlist_invite_token: " abc " }), "abc");
    assert.equal(inviteTokenFromMetadata({}), "");
    assert.equal(inviteTokenFromMetadata(null), "");
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

  it("keeps the blog behind sign-in", () => {
    assert.equal(isKnownPath("/blog"), true);
    assert.equal(isPublicPath("/blog"), false);
    assert.equal(isKnownPath("/blog/a-post"), true);
    assert.equal(isPublicPath("/blog/a-post"), false);
  });
});

describe("campaign copy", () => {
  it("uses the campaign lines as written", () => {
    assert.equal(HERO_TAGLINE, "Real creatives. Real work.");
    assert.equal(SUPPORT_LINE, "A home for creatives where every face is real and every post is real work.");
    assert.equal(WELCOME_HOME, "Welcome home, Familcy.");
    assert.equal(NO_FAKE_LINE, "No fake people. No fake work.");
    assert.equal(WAITLIST_CONFIRMATION, "Welcome home, Familcy.");
    assert.equal(QUIZ_INTRO_COPY, SUPPORT_LINE);
    assert.equal(WAITLIST_PRIVACY_NOTE, "We use this email only to tell you when Ether opens.");
    assert.equal(SLACK_INTRO, "Introduce yourself in #start-here.");
    assert.equal(APP_STORE_COMING, "on the web now, iPhone app coming");
    assert.equal(INVITE_EMAIL_SUBJECT, "Welcome home, Familcy.");
    assert.deepEqual(INVITE_EMAIL_LINES, [
      "Real creatives. Real work.",
      "A home for creatives where every face is real and every post is real work.",
      "No fake people. No fake work.",
      "Introduce yourself in #start-here.",
    ]);
  });

  it("keeps the slack invite in one config value and hides a missing app store link", () => {
    assert.equal(INSTAGRAM_URL, "https://www.instagram.com/_familcy/");
    assert.equal(APP_STORE_URL, "");
    assert.equal(SLACK_URL.startsWith("https://join.slack.com/"), true);
    const hits: string[] = [];
    const skip = new Set(["node_modules", "dist", ".git", "coverage"]);
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (skip.has(name)) continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          walk(path);
          continue;
        }
        if (!/\.(ts|tsx|html|json|sql|md)$/.test(name)) continue;
        if (readFileSync(path, "utf8").includes(SLACK_URL)) hits.push(path);
      }
    };
    walk(".");
    assert.deepEqual(hits, ["src/config/launch.ts"]);
    const invite = readFileSync("supabase/functions/send-waitlist-invites/index.ts", "utf8");
    assert.equal(invite.includes(INVITE_EMAIL_SUBJECT), true);
    for (const line of INVITE_EMAIL_LINES) assert.equal(invite.includes(line), true);
    assert.equal(invite.includes("PLACEHOLDER"), false);
    assert.equal(invite.includes(SLACK_URL), false);
    assert.equal(readFileSync("index.html", "utf8").includes(HERO_TAGLINE), true);
    assert.equal(readFileSync("public/manifest.json", "utf8").includes(HERO_TAGLINE), true);
  });
});

describe("apple app site association", () => {
  it("uses the lovable app id and stripe return paths, served as json", () => {
    const aasaPath = "public/.well-known/apple-app-site-association";
    const jsonPath = "public/.well-known/apple-app-site-association.json";
    const aasa = readFileSync(aasaPath, "utf8");
    assert.equal(aasa, readFileSync(jsonPath, "utf8"));
    const parsed = JSON.parse(aasa);
    const detail = parsed.applinks.details[0];
    assert.equal(detail.appID, "926NTNU4M7.app.lovable.e07d9c457fd949f78f3cc7d5998be668");
    assert.equal(APPLE_TEAM_ID, "926NTNU4M7");
    assert.equal(detail.appID.startsWith(`${APPLE_TEAM_ID}.`), true);
    assert.deepEqual(detail.paths, ["/membership*", "/fund*", "*"]);
    assert.equal(aasa.includes("TEAMID"), false);
    const rules = readFileSync("public/_redirects", "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    const aasaRule = rules.findIndex((line) => line.startsWith("/.well-known/apple-app-site-association "));
    const spaRule = rules.findIndex((line) => line.startsWith("/* "));
    assert.equal(aasaRule >= 0 && spaRule > aasaRule, true);
    assert.equal(rules[aasaRule], "/.well-known/apple-app-site-association /.well-known/apple-app-site-association.json 200");
    assert.equal(/\b30[1278]\b/.test(rules[aasaRule]), false);
    const headers = readFileSync("public/_headers", "utf8");
    assert.equal(headers.includes("/.well-known/apple-app-site-association\n  Content-Type: application/json"), true);
    assert.equal(headers.includes("/.well-known/apple-app-site-association.json\n  Content-Type: application/json"), true);
  });
});
