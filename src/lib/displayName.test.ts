import assert from "node:assert/strict";
import test from "node:test";
import { displayNameError, prefillName } from "./displayName.ts";

test("a display name with a bracket says which character was rejected", () => {
  assert.equal(
    displayNameError("Ada [Lovelace]"),
    "“[”, “]” is not allowed in a name. Use letters, spaces, hyphens, or apostrophes.",
  );
  assert.equal(displayNameError("Ada Lovelace"), null);
  assert.equal(displayNameError("O'Neil-Smith"), null);
});

test("an email in the name field asks for a name and is never pre-filled", () => {
  assert.equal(displayNameError("jobs4someone@gmail.com"), "Use your name here, not your email.");
  assert.equal(prefillName(" someone@gmail.com "), "");
  assert.equal(prefillName(" Ada Lovelace "), "Ada Lovelace");
  assert.equal(prefillName(undefined), "");
});
