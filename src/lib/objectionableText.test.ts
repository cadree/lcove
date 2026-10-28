import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { objectionableMessage } from "./objectionableText.ts";
import { digitalPurchasesAllowed, IOS_DIGITAL_PURCHASES_ENABLED, IOS_DONATIONS_ENABLED } from "./platform.ts";

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
    assert.equal(IOS_DONATIONS_ENABLED, false);
    assert.equal(digitalPurchasesAllowed(true), false);
    assert.equal(digitalPurchasesAllowed(false), true);
    assert.equal(digitalPurchasesAllowed(true, true), true);
  });

  it("uses the existing App Store bundle id and a version after 1.0 (1)", () => {
    const bundle = "app.lovable.e07d9c457fd949f78f3cc7d5998be668";
    const ids = readFileSync("src/config/nativeIds.ts", "utf8");
    const plist = readFileSync("ios/App/App/Info.plist", "utf8");
    const project = readFileSync("ios/App/App.xcodeproj/project.pbxproj", "utf8");
    assert.match(ids, new RegExp(bundle.replace(/\./g, "\\.")));
    assert.equal(plist.includes(bundle), true);
    assert.equal(plist.includes("com.etherbylcove.app"), false);
    assert.equal(project.includes(`PRODUCT_BUNDLE_IDENTIFIER = ${bundle};`), true);
    assert.equal(project.includes("com.etherbylcove.app"), false);
    assert.equal(project.includes("MARKETING_VERSION = 1.0.1;"), true);
    assert.equal(project.includes("CURRENT_PROJECT_VERSION = 2;"), true);
    assert.equal(project.includes("DEVELOPMENT_TEAM = 926NTNU4M7;"), true);
  });

  it("keeps the same banned tokens in the database filter", () => {
    const sql = readFileSync("supabase/migrations/20261020181000_app_store_readiness.sql", "utf8");
    for (const token of ["porn", "xxx", "nude", "slut", "whore", "faggot", "nigger", "nigga", "retard", "kike"]) {
      assert.match(sql, new RegExp(`'${token}'`));
    }
    assert.match(sql, /kill yourself/);
  });
});
