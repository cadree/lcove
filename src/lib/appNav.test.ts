import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { visibleMoreItems } from "./appNavVisibility.ts";

describe("membership navigation", () => {
  const items = [
    { id: "store", iosHidden: false },
    { id: "membership", iosHidden: true },
  ];

  it("shows membership on the web and hides it in the iOS app", () => {
    assert.ok(visibleMoreItems(items, false).some((item) => item.id === "membership"));
    assert.equal(visibleMoreItems(items, true).some((item) => item.id === "membership"), false);
    assert.ok(visibleMoreItems(items, true).some((item) => item.id === "store"));
  });
});
