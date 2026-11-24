import assert from "node:assert/strict";
import test from "node:test";
import { isQueryablePostId } from "./postId.ts";

test("feed interaction queries only run for uuid post ids", () => {
  assert.equal(isQueryablePostId("45d610d6-41c0-4d36-b059-147ddc15a8a9"), true);
  assert.equal(isQueryablePostId("0412aaaa-0000-4000-8000-000000000041"), true);
  assert.equal(isQueryablePostId("optimistic-1710000000000"), false);
  assert.equal(isQueryablePostId(""), false);
});
