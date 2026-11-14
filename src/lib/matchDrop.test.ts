import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchDropTarget, type MatchRect } from "./matchDrop.ts";

const port: MatchRect = { id: "port", left: 0, top: 0, right: 360, bottom: 220 };

describe("match drop target", () => {
  it("hits a card that is only partly inside the scroller", () => {
    const cards: MatchRect[] = [
      { id: "self", left: 0, top: 10, right: 148, bottom: 200 },
      { id: "partial", left: 300, top: 10, right: 448, bottom: 200 },
    ];
    assert.equal(matchDropTarget({ x: 340, y: 40 }, cards, "self", port), "partial");
  });

  it("ignores the clipped part that is outside the scroller", () => {
    const cards: MatchRect[] = [
      { id: "partial", left: 300, top: 10, right: 448, bottom: 200 },
    ];
    assert.equal(matchDropTarget({ x: 400, y: 40 }, cards, "self", port), null);
  });

  it("does not invite the card that started the drag", () => {
    const cards: MatchRect[] = [
      { id: "self", left: 0, top: 10, right: 148, bottom: 200 },
    ];
    assert.equal(matchDropTarget({ x: 20, y: 40 }, cards, "self", port), null);
  });
});
