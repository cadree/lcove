import assert from "node:assert/strict";
import test from "node:test";
import {
  EMAIL_CONFIRMED_TITLE,
  FAMILCY_GLOSS,
  FAMILCY_WELCOME,
  HERO_LEAD,
  HERO_SUB,
  LCOVE_GLOSS,
  LCOVE_GREETING,
  OATH_CTA,
  OATH_KICKER,
  OATH_LINES,
  OATH_MISSION,
  OG_DESCRIPTION,
  PENDING_BODY,
  PENDING_TITLE,
  PENDING_WELCOME,
  VERIFY_SIGNAL_TITLE,
} from "./copy.ts";

const all = [
  HERO_LEAD,
  HERO_SUB,
  OG_DESCRIPTION,
  LCOVE_GREETING,
  LCOVE_GLOSS,
  FAMILCY_WELCOME,
  FAMILCY_GLOSS,
  OATH_MISSION,
  ...OATH_LINES,
  OATH_KICKER,
  OATH_CTA,
  PENDING_TITLE,
  PENDING_WELCOME,
  PENDING_BODY,
  VERIFY_SIGNAL_TITLE,
  EMAIL_CONFIRMED_TITLE,
].join("\n");

test("new funnel copy keeps Cadre's lines and is not anti-AI", () => {
  assert.match(HERO_LEAD, /Ether is a culture of aspirations/);
  assert.match(HERO_SUB, /Real people, not bots/);
  assert.match(HERO_SUB, /Real work, not AI slop/);
  assert.match(HERO_SUB, /No algorithm/);
  assert.match(OG_DESCRIPTION, /real people and no algorithms/i);
  assert.equal(VERIFY_SIGNAL_TITLE, "Verify your email");
  assert.equal(OATH_KICKER, "The oath to enter");
  assert.equal(OATH_CTA, "I'm in");
  assert.equal(OATH_MISSION, "A path for genuine creatives to follow their passions.");
  assert.equal(LCOVE_GREETING, "Lcove");
  assert.match(LCOVE_GLOSS, /loo-so-ve/i);
  assert.match(LCOVE_GLOSS, /love, hello, goodbye/i);
  assert.equal(FAMILCY_WELCOME, "Welcome to the Familcy");
  assert.equal(PENDING_WELCOME, FAMILCY_WELCOME);
  assert.match(FAMILCY_GLOSS, /fam-li-see/i);
  assert.equal(PENDING_TITLE, "Awaiting verification");
  assert.match(PENDING_BODY, /A real person will review your application before you're let in\./);
  assert.match(OATH_LINES.join("\n"), /open mindset that allows growth/i);
  assert.match(OATH_LINES.join("\n"), /No negative energy into the community/);
  assert.match(OATH_LINES.join("\n"), /Harmony in your self-interest/);
  assert.match(OATH_LINES.join("\n"), /Support your peers' work first/);
  assert.match(OATH_LINES.join("\n"), /culture be your asset/);
  assert.match(OATH_LINES.join("\n"), /connections can change someone's life/);
  assert.match(OATH_LINES.join("\n"), /Value yourself, value your peers/);
  assert.match(OATH_LINES.join("\n"), /Nourish trust and genuine energy/);
  assert.match(OATH_LINES.join("\n"), /Real people, not bots/);
  assert.match(OATH_LINES.join("\n"), /Real work, not AI slop/);
  assert.equal(/no fake AI/i.test(all), false);
  assert.equal(/generative AI/i.test(all), false);
  assert.equal(/anti-?AI/i.test(all), false);
  assert.equal(/looneycoons/i.test(all), false);
  assert.equal(/\bLC\b/.test(all), false);
  assert.equal(/3 tier|tier mindset/i.test(all), false);
});
