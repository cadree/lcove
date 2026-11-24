import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storePurchaseAllowed } from './storePurchase.ts';
test('iOS only permits classified physical listings and real-world rentals', () => {
  for (const type of ['product', 'service']) {
    assert.equal(storePurchaseAllowed({ type, is_digital: true }, false), false);
    assert.equal(storePurchaseAllowed({ type }, false), false);
    assert.equal(storePurchaseAllowed({ type, is_digital: false }, false), true);
    assert.equal(storePurchaseAllowed({ type, is_digital: true }, true), true);
  }
  assert.equal(storePurchaseAllowed({ type: 'rental' }, false), true);
  assert.equal(storePurchaseAllowed({ type: 'rental', is_digital: true }, false), false);
});
