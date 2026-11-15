import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanVouchNote, vouchCountLabel, vouchNoteError, wrapUpOrder, wrapUpProgress, type WrapUpMember } from "./vouches.ts";

const member = (name: string, vouched = false): WrapUpMember => ({ user_id: name, name, avatar_url: null, role: "Stylist", vouched, vouch_id: vouched ? `v-${name}` : null });

test("notes are trimmed and capped", () => {
  assert.equal(cleanVouchNote("   "), null);
  assert.equal(cleanVouchNote("  On time,\n  every time "), "On time, every time");
  assert.equal(vouchNoteError("x".repeat(280)), null);
  assert.match(vouchNoteError("x".repeat(281))!, /280/);
});

test("count label", () => {
  assert.equal(vouchCountLabel(0), "0 vouches");
  assert.equal(vouchCountLabel(1), "1 vouch");
  assert.equal(vouchCountLabel(4), "4 vouches");
});

test("wrap-up puts teammates still to vouch for first", () => {
  assert.deepEqual(wrapUpOrder([member("Theo", true), member("Rezza"), member("Ava")]).map((m) => m.name), ["Ava", "Rezza", "Theo"]);
});

test("wrap-up progress", () => {
  assert.equal(wrapUpProgress([]), null);
  assert.equal(wrapUpProgress([member("A", true), member("B")]), "You vouched for 1 of 2 teammates");
  assert.equal(wrapUpProgress([member("A", true), member("B", true)]), "You vouched for the whole team");
  assert.equal(wrapUpProgress([member("A", true)]), "You vouched for your teammate");
});
