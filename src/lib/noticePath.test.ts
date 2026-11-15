import assert from "node:assert/strict";
import test from "node:test";
import { noticePath } from "./noticePath.ts";

test("credit notices open the credits section", () => {
  assert.equal(noticePath({ type: "credit", data: { path: "/profile?section=credits" } }), "/profile?section=credits");
});

test("unknown types and odd paths open nothing", () => {
  assert.equal(noticePath({ type: "like", data: { path: "/profile?section=credits" } }), null);
  assert.equal(noticePath({ type: "credit", data: { path: "https://evil.example" } }), null);
  assert.equal(noticePath({ type: "credit", data: { path: "/profile?section=credits&x=1" } }), null);
  assert.equal(noticePath({ type: "credit", data: null }), null);
  assert.equal(noticePath({ type: "credit" }), null);
});
