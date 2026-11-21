import { test } from "node:test";
import assert from "node:assert/strict";
import { cardName, cardTone, memberCount } from "./cityCard.ts";

test("a city always gets the same card colors, and different cities usually differ", () => {
  assert.deepEqual(cardTone("charlotte|nc"), cardTone("charlotte|nc"));
  assert.notDeepEqual(cardTone("charlotte|nc"), cardTone("tokyo|jp"));
  assert.match(cardTone("miami|fl").from, /^hsl\(\d+ 55% 42%\)$/);
});

test("card names are the city part, shortened to fit", () => {
  assert.equal(cardName("Charlotte, NC"), "Charlotte");
  assert.equal(cardName("Tokyo, Japan"), "Tokyo");
  assert.equal(cardName("San Francisco, CA"), "San Franc…");
  assert.equal(cardName("Los Angeles, CA", 12), "Los Angeles");
});

test("member counts cap at 99+", () => {
  assert.deepEqual([1, 99, 100, 5000].map(memberCount), ["1", "99", "99+", "99+"]);
});
