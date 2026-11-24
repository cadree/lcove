import { test } from "node:test";
import assert from "node:assert/strict";
import { readNumber, toCents } from "./numberField.ts";

test("empty fields read as missing or null, never NaN or 0", () => {
  assert.deepEqual(readNumber("", { label: "Price" }), { value: null, error: "Enter price" });
  assert.deepEqual(readNumber("  ", { label: "Capacity", optional: true }), { value: null, error: null });
  assert.deepEqual(readNumber(undefined, { label: "Stock", optional: true }), { value: null, error: null });
});

test("decimals and currency text parse", () => {
  assert.deepEqual(readNumber("19.99", { label: "Price", min: 0, decimals: 2 }), { value: 19.99, error: null });
  assert.deepEqual(readNumber("$1,250.5", { label: "Budget", min: 0, decimals: 2 }), { value: 1250.5, error: null });
  assert.deepEqual(readNumber("0.1", { label: "Price", decimals: 2 }), { value: 0.1, error: null });
  assert.deepEqual(readNumber("2.005", { label: "Price", decimals: 2 }), { value: 2.0, error: null });
  assert.deepEqual(readNumber(7, { label: "Seats" }), { value: 7, error: null });
});

test("bounds and whole numbers are enforced with a readable message", () => {
  assert.deepEqual(readNumber("-5", { label: "Price", min: 0 }), { value: null, error: "Price must be at least 0" });
  assert.deepEqual(readNumber("0.5", { label: "Subscription price", min: 0.99 }), { value: null, error: "Subscription price must be at least 0.99" });
  assert.deepEqual(readNumber("25", { label: "Group size", min: 2, max: 20 }), { value: null, error: "Group size must be at most 20" });
  assert.deepEqual(readNumber("2.5", { label: "Capacity", integer: true }), { value: null, error: "Capacity must be a whole number" });
  assert.deepEqual(readNumber("abc", { label: "Amount" }), { value: null, error: "Amount must be a number" });
  assert.deepEqual(readNumber("1e400", { label: "Amount" }), { value: null, error: "Amount must be a number" });
  assert.deepEqual(readNumber("0", { label: "Quantity", min: 0 }), { value: 0, error: null });
});

test("cents avoid float drift", () => {
  assert.equal(toCents(19.99), 1999);
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.equal(toCents(1.005), 101);
  assert.equal(toCents(0), 0);
});
