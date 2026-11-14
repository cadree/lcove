import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { abortAfter } from "./requestDeadline.ts";

describe("request deadline", () => {
  it("returns a signal that can abort a hung request", async () => {
    const signal = abortAfter(30);
    assert.equal(signal.aborted, false);
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(signal.aborted, true);
  });
});
