import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commitNumber } from './numberInput.ts';

test('number drafts commit without truthy fallbacks', () => {
  assert.equal(commitNumber('0', 14, 0, undefined, true), 0);
  assert.equal(commitNumber('', 14, 0, undefined, true), 14);
  assert.equal(commitNumber('1', 5, 5), 5);
  assert.equal(commitNumber('125', 1, 1, 10), 10);
  assert.equal(commitNumber('2.75', 0), 2.75);
  assert.equal(commitNumber('2.75', 1, 1, undefined, true), 2);
  assert.equal(commitNumber('Infinity', 7), 7);
});
