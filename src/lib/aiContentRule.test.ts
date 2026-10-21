import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AI_CONTENT_RULE_ALLOWED, AI_CONTENT_RULE_FORBIDDEN } from "./aiContentRule.ts";
import { REPORT_REASONS } from "./reportReasons.ts";

describe("AI content rule", () => {
  it("states what is allowed and what is not", () => {
    assert.equal(
      AI_CONTENT_RULE_ALLOWED,
      "AI is allowed as assistance in VFX, for knowledge, for admin work, and as a tool inside a graphic artist's workflow.",
    );
    assert.equal(
      AI_CONTENT_RULE_FORBIDDEN,
      "Fully fabricated generative scenes, fake or AI-generated people, promoting AI slop, and plagiarized or stolen creative work are not allowed. Graphic design is strictly monitored.",
    );
  });

  it("offers the clear report reasons and the older non-AI reasons", () => {
    assert.deepEqual(REPORT_REASONS, [
      "Harassment or abuse",
      "Spam",
      "Hate or violence",
      "Sexual content",
      "Scam or fraud",
      "Fake or AI-generated person",
      "Fully AI-generated scene passed off as real work",
      "AI slop / spam promotion",
      "Plagiarized or stolen work",
      "Other",
    ]);
  });
});
