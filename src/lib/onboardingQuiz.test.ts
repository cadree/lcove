import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  QUIZ_INTRO_COPY,
  QUIZ_QUESTIONS,
  QUIZ_SEED_STORAGE_KEY,
  RED_FLAG_FAIL_THRESHOLD,
  clearQuizSeed,
  createQuizSeed,
  optionsForSeed,
  passedRedFlagCount,
  quizSeedForSession,
  scoreRedFlags,
  shuffleWithSeed,
  type ChoiceId,
  type QuizSeedStorage,
} from "./onboardingQuiz.ts";

function memoryStorage(): QuizSeedStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

describe("quiz option order", () => {
  it("keeps one seed stable and gives another seed a different order", () => {
    const question = QUIZ_QUESTIONS[0];
    const first = optionsForSeed(question, "visit-a").map((option) => option.id);
    const again = optionsForSeed(question, "visit-a").map((option) => option.id);
    assert.deepEqual(again, first);
    assert.equal(first.length, 3);
    assert.deepEqual([...first].sort(), ["A", "B", "C"]);

    const orders = new Set(
      ["visit-a", "visit-b", "visit-c", "visit-d", "visit-e", "visit-f"].map((seed) =>
        optionsForSeed(question, seed).map((option) => option.id).join(""),
      ),
    );
    assert.ok(orders.size > 1);
  });

  it("shuffles each question on its own", () => {
    const seed = "same-visit";
    const first = shuffleWithSeed(QUIZ_QUESTIONS[0].options, `${seed}:1`).map((option) => option.id).join("");
    const second = shuffleWithSeed(QUIZ_QUESTIONS[1].options, `${seed}:2`).map((option) => option.id).join("");
    const third = shuffleWithSeed(QUIZ_QUESTIONS[2].options, `${seed}:3`).map((option) => option.id).join("");
    assert.ok(new Set([first, second, third]).size > 1);
  });

  it("reuses the stored seed on refresh and replaces it for a new visit", () => {
    const storage = memoryStorage();
    const sequence = [0.1, 0.2, 0.3, 0.4, 0.9, 0.8, 0.7, 0.6];
    let cursor = 0;
    const random = () => sequence[cursor++] ?? 0.5;
    const first = quizSeedForSession(storage, random);
    const refreshed = quizSeedForSession(storage, random);
    assert.equal(refreshed, first);
    assert.equal(storage.getItem(QUIZ_SEED_STORAGE_KEY), first);
    assert.notEqual(createQuizSeed(random), first);
    clearQuizSeed(storage);
    const nextVisit = quizSeedForSession(storage, random);
    assert.notEqual(nextVisit, first);
  });
});

describe("red flag scoring", () => {
  it("fails only when red flags reach the threshold", () => {
    assert.equal(RED_FLAG_FAIL_THRESHOLD, 2);
    const none = scoreRedFlags({});
    assert.equal(none.score, 0);
    assert.equal(none.passed, true);
    assert.equal(none.level, 2);

    const one = scoreRedFlags({ 6: "A" });
    assert.equal(one.redFlags, 1);
    assert.equal(one.score, 1);
    assert.equal(one.passed, true);
    assert.equal(one.level, 2);

    assert.equal(passedRedFlagCount(0), true);
    assert.equal(passedRedFlagCount(1), true);
    assert.equal(passedRedFlagCount(2), false);
    assert.equal(passedRedFlagCount(3), false);
  });

  it("treats every non-flag option as the same score", () => {
    const letters: ChoiceId[] = ["A", "B", "C"];
    const scores = letters.map((letter) => scoreRedFlags({
      1: letter,
      2: letter,
      3: letter,
      4: letter,
      5: letter,
      7: letter,
      8: letter,
      9: letter,
      10: letter,
    }).score);
    assert.deepEqual(scores, [0, 0, 0]);
  });

  it("marks only the collaboration option that opts out of the group", () => {
    const flagged = QUIZ_QUESTIONS.flatMap((question) =>
      question.options
        .filter((option) => option.redFlag)
        .map((option) => `${question.id}:${option.id}:${option.text}`),
    );
    assert.deepEqual(flagged, [
      "6:A:I focus primarily on my own success",
    ]);
  });
});

describe("quiz intro", () => {
  it("describes scoring and has no placeholder text", () => {
    const text = `${QUIZ_INTRO_COPY.kicker}\n${QUIZ_INTRO_COPY.title}\n${QUIZ_INTRO_COPY.body}`;
    assert.equal(/placeholder/i.test(text), false);
    assert.match(QUIZ_INTRO_COPY.kicker, /10 questions/);
    assert.match(QUIZ_INTRO_COPY.body, /letter only labels a sentence/i);
    assert.match(QUIZ_INTRO_COPY.body, /two or more/i);
    assert.match(QUIZ_INTRO_COPY.body, /one does not/i);
    const screen = readFileSync(
      new URL("../components/onboarding/OnboardingQuestionnaire.tsx", import.meta.url),
      "utf8",
    );
    assert.equal(screen.includes("PLACEHOLDER"), false);
    assert.equal(/placeholder copy lives/i.test(screen), false);
    assert.equal(QUIZ_QUESTIONS.length, 10);
    assert.match(QUIZ_QUESTIONS[0].question, /challenges your beliefs/);
    for (const question of QUIZ_QUESTIONS) {
      assert.equal(question.options.length, 3);
      for (const option of question.options) {
        assert.equal(typeof option.redFlag, "boolean");
      }
    }
  });
});

describe("wallet pass button", () => {
  it("stays off the page unless wallet passes are enabled", () => {
    const source = readFileSync(new URL("../pages/PublicEventPage.tsx", import.meta.url), "utf8");
    assert.equal(/coming soon/i.test(source), false);
    assert.equal(/check back soon/i.test(source), false);
    assert.match(source, /VITE_WALLET_PASSES_ENABLED === "true"/);
    assert.equal((source.match(/walletPassesEnabled &&/g) ?? []).length, 2);
    assert.equal((source.match(/Add to Wallet/g) ?? []).length, 2);
  });
});
