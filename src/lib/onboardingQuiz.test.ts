import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  QUIZ_INTRO_COPY,
  QUIZ_QUESTIONS,
  optionsForUser,
  scoreMindsetSpread,
  shuffleWithSeed,
} from "./onboardingQuiz.ts";

describe("quiz option order", () => {
  it("shuffles per user and stays stable for that user", () => {
    const question = QUIZ_QUESTIONS[0];
    const first = optionsForUser(question, "user-a").map((option) => option.id);
    const again = optionsForUser(question, "user-a").map((option) => option.id);
    assert.deepEqual(again, first);
    assert.equal(first.length, 3);
    assert.deepEqual([...first].sort(), ["A", "B", "C"]);
  });

  it("does not keep the same order for every user", () => {
    const question = QUIZ_QUESTIONS[0];
    const orders = new Set(
      ["user-a", "user-b", "user-c", "user-d", "user-e", "user-f"].map((id) =>
        optionsForUser(question, id).map((option) => option.id).join(""),
      ),
    );
    assert.ok(orders.size > 1);
  });

  it("shuffles each question on its own", () => {
    const seed = "same-person";
    const first = shuffleWithSeed(QUIZ_QUESTIONS[0].options, `${seed}:1`).map((option) => option.id).join("");
    const second = shuffleWithSeed(QUIZ_QUESTIONS[1].options, `${seed}:2`).map((option) => option.id).join("");
    const third = shuffleWithSeed(QUIZ_QUESTIONS[2].options, `${seed}:3`).map((option) => option.id).join("");
    assert.ok(new Set([first, second, third]).size > 1);
  });
});

describe("quiz scoring", () => {
  it("does not treat one letter as the best score", () => {
    const allA = scoreMindsetSpread(Array(10).fill("A"));
    const allB = scoreMindsetSpread(Array(10).fill("B"));
    const allC = scoreMindsetSpread(Array(10).fill("C"));
    assert.equal(allA.score, allB.score);
    assert.equal(allB.score, allC.score);
    assert.equal(allC.passed, false);

    const spread = scoreMindsetSpread(["A", "B", "C", "A", "B", "C", "A", "B", "C", "A"]);
    assert.ok(spread.score > allC.score);
    assert.equal(spread.passed, true);
    assert.equal(spread.level, 2);
  });

  it("accepts more than one valid mix", () => {
    const flexibleAndSteady = scoreMindsetSpread(["A", "B", "A", "B", "A", "B", "A", "B", "A", "B"]);
    const exploratoryAndFlexible = scoreMindsetSpread(["C", "B", "C", "B", "C", "B", "C", "B", "C", "B"]);
    assert.equal(flexibleAndSteady.passed, true);
    assert.equal(exploratoryAndFlexible.passed, true);
    assert.ok(Math.abs(flexibleAndSteady.score - exploratoryAndFlexible.score) <= 1);
  });
});

describe("quiz intro placeholder", () => {
  it("marks the owner copy as a placeholder", () => {
    assert.match(QUIZ_INTRO_COPY.kicker, /PLACEHOLDER/);
    assert.match(QUIZ_INTRO_COPY.title, /PLACEHOLDER/);
    assert.match(QUIZ_INTRO_COPY.body, /PLACEHOLDER/);
    assert.equal(QUIZ_QUESTIONS.length, 10);
    assert.match(QUIZ_QUESTIONS[0].question, /challenges your beliefs/);
  });
});
