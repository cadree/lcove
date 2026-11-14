import test from "node:test";
import assert from "node:assert/strict";
import { parseCents, equalShares, safeWebLink } from "./tripMoney.ts";
test("money parsing rejects fractional cents, exponents, negative and overflowing budgets", () => {
  assert.equal(parseCents("1500.00"), 150000);
  assert.equal(parseCents("0.01"), 1);
  for (const value of ["", "-1", "1.001", "1e3", "NaN", "1000000.01", "1,500"])
    assert.equal(parseCents(value), null);
});
test("equal splits preserve every cent and never depend on roster order", () => {
  assert.deepEqual(equalShares(200000, ["d", "b", "a", "c"]), {
    a: 50000,
    b: 50000,
    c: 50000,
    d: 50000,
  });
  assert.deepEqual(equalShares(100, ["c", "a", "b"]), { a: 34, b: 33, c: 33 });
  assert.equal(
    Object.values(equalShares(101, ["a", "b", "c"])).reduce((a, b) => a + b),
    101
  );
  assert.throws(() => equalShares(10, ["a", "a"]));
});
test("user provided links cannot execute scripts or include credentials", () => {
  assert.equal(safeWebLink("javascript:alert(1)"), undefined);
  assert.equal(safeWebLink("http://example.com"), undefined);
  assert.equal(safeWebLink("https://user:secret@example.com"), undefined);
  assert.equal(
    safeWebLink("https://example.com/receipt"),
    "https://example.com/receipt"
  );
});
