import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileCode, nextQuest, questViews, streakFromDays, xpBar, xpLevel } from "./noviQuests.ts";

describe("novi quests", () => {
  it("uses the same level bands as the XP ledger", () => {
    assert.equal(xpLevel(0), 1);
    assert.equal(xpLevel(40), 2);
    assert.equal(xpLevel(100), 3);
    assert.equal(xpLevel(200), 4);
    assert.equal(xpLevel(400), 5);
    assert.equal(xpBar(10).ratio, 10 / 40);
    assert.equal(xpBar(40).level, 2);
  });

  it("marks a quest decrypted only when the real count is met", () => {
    const quests = questViews({
      profileReady: true,
      postCount: 0,
      connectionCount: 1,
      bookOpened: false,
      completedProjects: 0,
    });
    assert.equal(quests.find((quest) => quest.id === "enter_signal")?.state, "decrypted");
    assert.equal(quests.find((quest) => quest.id === "find_people")?.state, "progress");
    assert.equal(quests.find((quest) => quest.id === "read_book")?.state, "sealed");
    assert.equal(nextQuest(quests)?.id, "first_post");
  });

  it("counts a streak only on consecutive stored days", () => {
    assert.equal(streakFromDays(["2026-10-17", "2026-10-18", "2026-10-19"], "2026-10-19"), 3);
    assert.equal(streakFromDays(["2026-10-17", "2026-10-19"], "2026-10-19"), 1);
    assert.equal(streakFromDays(["2026-10-18"], "2026-10-19"), 1);
  });

  it("builds a file code from the real id", () => {
    assert.equal(fileCode("ab12-cd"), "FILE AB12");
  });
});
