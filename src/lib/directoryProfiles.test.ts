import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dedupeProfilesByUserId } from "./directoryProfiles.ts";

describe("dedupeProfilesByUserId", () => {
  it("keeps one card when the same user_id is returned twice", () => {
    const rows = [
      { user_id: "maya", display_name: "Maya Torres", id: "profile-1" },
      { user_id: "maya", display_name: "Maya Torres", id: "profile-2" },
      { user_id: "other", display_name: "Alex Kim", id: "profile-3" },
    ];

    const unique = dedupeProfilesByUserId(rows);

    assert.deepEqual(
      unique.map((row) => row.id),
      ["profile-1", "profile-3"],
    );
  });

  it("preserves order and distinct users", () => {
    const rows = [
      { user_id: "a", display_name: "A" },
      { user_id: "b", display_name: "B" },
    ];
    assert.equal(dedupeProfilesByUserId(rows).length, 2);
  });
});
