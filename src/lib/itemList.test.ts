import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatItemList, parseItemList } from "./itemList.ts";

describe("item lists", () => {
  it("splits lines and commas and joins them back as lines", () => {
    assert.deepEqual(parseItemList("Camera, lights\nStand"), ["Camera", "lights", "Stand"]);
    assert.equal(formatItemList([" Camera ", "", "Stand"]), "Camera\nStand");
  });
});
