import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { walletButtonVisible } from "./etherId.ts";
import {
  CARD_INTRO_ADD_WALLET,
  CARD_INTRO_GOT_IT,
  CARD_INTRO_KEEP_HANDY_LINE,
  CARD_INTRO_POINTS,
  CARD_INTRO_REVEAL_MS,
  CARD_INTRO_TITLE,
  CARD_INTRO_VIEW_CARD,
  CARD_INTRO_WALLET_LINE,
  cardIntroAction,
  hasSeenCardIntro,
  markCardIntroSeen,
  shouldAutoShowCardIntro,
} from "./cardIntro.ts";

const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
};

test("the intro shows once after card setup, per member", () => {
  const store = memory();
  assert.equal(shouldAutoShowCardIntro(store, { userId: "u1", setupMode: true, cardRegistered: false }), false);
  assert.equal(shouldAutoShowCardIntro(store, { userId: "u1", setupMode: false, cardRegistered: true }), false);
  assert.equal(shouldAutoShowCardIntro(store, { userId: undefined, setupMode: true, cardRegistered: true }), false);
  assert.equal(shouldAutoShowCardIntro(store, { userId: "u1", setupMode: true, cardRegistered: true }), true);
  markCardIntroSeen(store, "u1");
  assert.equal(hasSeenCardIntro(store, "u1"), true);
  assert.equal(shouldAutoShowCardIntro(store, { userId: "u1", setupMode: true, cardRegistered: true }), false);
  assert.equal(shouldAutoShowCardIntro(store, { userId: "u2", setupMode: true, cardRegistered: true }), true);
});

test("a storage that throws never blocks the page", () => {
  const broken = {
    getItem: () => { throw new Error("denied"); },
    setItem: () => { throw new Error("denied"); },
  };
  assert.equal(hasSeenCardIntro(broken, "u1"), false);
  assert.equal(shouldAutoShowCardIntro(broken, { userId: "u1", setupMode: true, cardRegistered: true }), true);
  assert.doesNotThrow(() => markCardIntroSeen(broken, "u1"));
});

test("the closing action follows the same wallet flag as the page", () => {
  assert.equal(cardIntroAction(walletButtonVisible(true)), "wallet");
  assert.equal(cardIntroAction(walletButtonVisible(false)), "keep-handy");
  assert.equal(cardIntroAction(walletButtonVisible(undefined)), "keep-handy");
  assert.equal(CARD_INTRO_WALLET_LINE, "Add it to your Wallet so it's always on you.");
  assert.equal(CARD_INTRO_KEEP_HANDY_LINE, "Keep it handy. Your card is here whenever you need it.");
  assert.equal(CARD_INTRO_ADD_WALLET, "Add to Apple Wallet");
  assert.equal(CARD_INTRO_VIEW_CARD, "View your card");
  assert.equal(CARD_INTRO_GOT_IT, "Got it");
});

test("the copy stays short and does not invent partners, numbers, or council wording", () => {
  assert.equal(CARD_INTRO_TITLE, "Your ETHER Card");
  assert.equal(CARD_INTRO_POINTS.length, 3);
  assert.deepEqual(CARD_INTRO_POINTS.map((point) => point.heading), [
    "Community perks",
    "Who you are, fast",
    "It grows with the community",
  ]);
  const text = [CARD_INTRO_TITLE, ...CARD_INTRO_POINTS.flatMap((point) => [point.heading, point.body]), CARD_INTRO_WALLET_LINE, CARD_INTRO_KEEP_HANDY_LINE].join("\n");
  assert.doesNotMatch(text, /council/i);
  assert.doesNotMatch(text, /\d/);
  assert.doesNotMatch(text, /algorithm|anti-?ai|no ai/i);
  assert.match(text, /studios and businesses/);
  assert.match(text, /reviews, projects you've worked on, events you've hosted and your portfolio/);
});

test("the reveal duration stays in sync with the CSS and is skipped for reduced motion", () => {
  const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
  assert.equal(CARD_INTRO_REVEAL_MS, 1200);
  assert.match(css, /\.ether-id-spin\.is-revealing\s*\{[^}]*animation:\s*ether-id-reveal 1\.2s/);
  assert.match(css, /@keyframes ether-id-reveal/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.ether-id-spin \{[\s\S]*animation: none !important;/);
});
