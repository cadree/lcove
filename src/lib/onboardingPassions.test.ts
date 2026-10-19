import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildUserPassionInserts, mergePassions, parsePassionTokens } from "./onboardingPassions.ts";

describe("parsePassionTokens", () => {
  it("splits on commas and keeps each tag", () => {
    assert.deepEqual(parsePassionTokens("Photography, Portraits, Street Photography"), [
      "Photography",
      "Portraits",
      "Street Photography",
    ]);
  });
});

describe("mergePassions", () => {
  it("adds every tag from one comma-separated entry", () => {
    const result = mergePassions([], "Photography, Portraits, Street Photography");
    assert.deepEqual(result.passions, ["Photography", "Portraits", "Street Photography"]);
    assert.equal(result.error, null);
  });

  it("keeps earlier tags when adds happen before React re-renders", () => {
    const first = mergePassions([], "Photography");
    const second = mergePassions(first.passions, "Portraits");
    const third = mergePassions(second.passions, "Street Photography");
    assert.deepEqual(third.passions, ["Photography", "Portraits", "Street Photography"]);
  });
});

describe("buildUserPassionInserts", () => {
  it("links seeded names and stores the rest as custom passions", () => {
    const rows = buildUserPassionInserts(
      "user-1",
      ["Photography", "Portraits", "Street Photography"],
      [{ id: "passion-photo", name: "Photography" }],
    );

    assert.deepEqual(rows, [
      { user_id: "user-1", passion_id: "passion-photo", custom_name: null },
      { user_id: "user-1", passion_id: null, custom_name: "Portraits" },
      { user_id: "user-1", passion_id: null, custom_name: "Street Photography" },
    ]);
  });
});
