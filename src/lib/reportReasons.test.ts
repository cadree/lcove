import assert from "node:assert/strict";
import test from "node:test";
import { isAiViolationReport, REPORT_REASONS } from "./reportReasons.ts";

test("AI-rule report reasons are the no-fake-AI violations", () => {
  assert.equal(isAiViolationReport("Fake or AI-generated person"), true);
  assert.equal(isAiViolationReport("Fully AI-generated scene passed off as real work"), true);
  assert.equal(isAiViolationReport("AI slop / spam promotion"), true);
  assert.equal(isAiViolationReport("AI-generated or fake content"), true);
  assert.equal(isAiViolationReport("Spam"), false);
  for (const reason of REPORT_REASONS) {
    assert.equal(typeof isAiViolationReport(reason), "boolean");
  }
});
