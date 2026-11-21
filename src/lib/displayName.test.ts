import assert from "node:assert/strict";
import test from "node:test";
import { displayNameError } from "./displayName.ts";

test("a display name with a bracket says which character was rejected", () => {
  assert.equal(
    displayNameError("Ada [Lovelace]"),
    "“[”, “]” is not allowed in a name. Use letters, spaces, hyphens, or apostrophes.",
  );
  assert.equal(displayNameError("Ada Lovelace"), null);
  assert.equal(displayNameError("O'Neil-Smith"), null);
});
