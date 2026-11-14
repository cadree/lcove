import { test } from "node:test";
import assert from "node:assert/strict";
import { dropStage, endOfStage, moveLocally, TOUCH_HOLD_MS, TOUCH_TOLERANCE_PX } from "./pipelineDrag.ts";

const items = [
  { id: "a", stage_id: "lead", sort_order: 0 },
  { id: "b", stage_id: "lead", sort_order: 1 },
  { id: "c", stage_id: "won", sort_order: 4 },
];
const stages = ["lead", "contacted", "won"];

test("dropping on a column or on a card in it picks that column", () => {
  assert.equal(dropStage("a", "contacted", items, stages), "contacted");
  assert.equal(dropStage("a", "c", items, stages), "won");
});

test("dropping in place, on nothing, or with an unknown card changes nothing", () => {
  assert.equal(dropStage("a", "lead", items, stages), null);
  assert.equal(dropStage("a", "b", items, stages), null);
  assert.equal(dropStage("a", null, items, stages), null);
  assert.equal(dropStage("zzz", "won", items, stages), null);
  assert.equal(dropStage("a", "ghost", items, stages), null);
});

test("moved cards go to the bottom of the target column", () => {
  assert.equal(endOfStage(items, "won"), 5);
  assert.equal(endOfStage(items, "contacted"), 0);
  const moved = moveLocally(items, "a", "won", 5);
  assert.deepEqual(moved.find((i) => i.id === "a"), { id: "a", stage_id: "won", sort_order: 5 });
  assert.equal(items[0].stage_id, "lead");
});

test("touch drag needs a deliberate hold so vertical scrolling still works", () => {
  assert.ok(TOUCH_HOLD_MS >= 150 && TOUCH_HOLD_MS <= 400);
  assert.ok(TOUCH_TOLERANCE_PX >= 5);
});
