import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { objectionableMessage } from "./objectionableText.ts";
import { digitalPurchasesAllowed, IOS_DIGITAL_PURCHASES_ENABLED } from "./platform.ts";

describe("objectionable text", () => {
  it("allows ordinary text", () => {
    assert.equal(objectionableMessage("Looking for a portrait session in Charlotte"), null);
    assert.equal(objectionableMessage("classic lighting"), null);
  });

  it("blocks a banned token, a phrase, and simple leetspeak", () => {
    assert.ok(objectionableMessage("check this xxx"));
    assert.ok(objectionableMessage("just kill yourself"));
    assert.ok(objectionableMessage("k1ll yourself"));
    assert.equal(objectionableMessage(""), null);
  });
});

describe("iOS digital purchases", () => {
  it("stays off on iOS and on everywhere else", () => {
    assert.equal(IOS_DIGITAL_PURCHASES_ENABLED, false);
    assert.equal(digitalPurchasesAllowed(true), false);
    assert.equal(digitalPurchasesAllowed(false), true);
    assert.equal(digitalPurchasesAllowed(true, true), true);
  });

  it("keeps the same banned tokens in the database filter", () => {
    const sql = readFileSync("supabase/migrations/20261020181000_app_store_readiness.sql", "utf8");
    for (const token of ["porn", "xxx", "nude", "slut", "whore", "faggot", "nigger", "nigga", "retard", "kike"]) {
      assert.match(sql, new RegExp(`'${token}'`));
    }
    assert.match(sql, /kill yourself/);
  });
});
