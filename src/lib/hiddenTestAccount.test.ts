import assert from "node:assert/strict";
import test from "node:test";
import { isHiddenTestAccount } from "./hiddenTestAccount.ts";

test("hides the App Review test account and similar labels", () => {
  assert.equal(isHiddenTestAccount("App Review Apple App Review test account"), true);
  assert.equal(isHiddenTestAccount("App Review"), true);
  assert.equal(isHiddenTestAccount("Apple test account"), true);
  assert.equal(isHiddenTestAccount("Cadre Wallace"), false);
  assert.equal(isHiddenTestAccount("Rezza"), false);
  assert.equal(isHiddenTestAccount(""), false);
  assert.equal(isHiddenTestAccount(null), false);
});
