import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { autoFileQuestId, dailyDecodeCopy, decryptedKey, fileCode, nextQuest, questViews, streakFromDays, studioQuest, suggestedActions, xpBar, xpLevel } from "./noviQuests.ts";

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
    assert.equal(quests.find((quest) => quest.id === "find_people")?.state, "decrypted");
    assert.equal(quests.find((quest) => quest.id === "read_book")?.state, "sealed");
    assert.equal(quests.find((quest) => quest.id === "open_studio")?.state, "sealed");
    assert.equal(nextQuest(quests)?.id, "first_post");
    assert.equal(studioQuest(quests)?.id, "open_studio");
  });

  it("files one decrypted quest per page load", () => {
    const quests = questViews({
      profileReady: true,
      postCount: 1,
      connectionCount: 1,
      bookOpened: false,
      completedProjects: 0,
      studioOpened: true,
    });
    const first = autoFileQuestId(quests);
    assert.equal(first, "enter_signal");
    assert.equal(autoFileQuestId(quests, new Set([first!])), "find_people");
  });

  it("counts a streak only on consecutive stored days", () => {
    assert.equal(streakFromDays(["2026-10-17", "2026-10-18", "2026-10-19"], "2026-10-19"), 3);
    assert.equal(streakFromDays(["2026-10-17", "2026-10-19"], "2026-10-19"), 1);
    assert.equal(streakFromDays(["2026-10-18"], "2026-10-19"), 1);
  });

  it("builds a file code from the real id", () => {
    assert.equal(fileCode("ab12-cd"), "FILE AB12");
  });

  it("says the first post earns 10 XP", () => {
    const quests = questViews({
      profileReady: true,
      postCount: 0,
      connectionCount: 0,
      bookOpened: false,
      completedProjects: 0,
    });
    const post = quests.find((quest) => quest.id === "first_post");
    assert.equal(post?.detail, "Make your first post to earn 10 XP.");
    assert.equal(post?.href, "/feed?action=create-post");
    assert.equal(decryptedKey(quests), "enter_signal");
  });

  it("suggests the next undone XP actions", () => {
    const fresh = suggestedActions(
      {
        profileReady: false,
        postCount: 0,
        connectionCount: 0,
        bookOpened: false,
        completedProjects: 0,
      },
      { dailyDone: false },
    );
    assert.equal(fresh.length, 3);
    assert.deepEqual(
      fresh.map((action) => action.id),
      ["enter_signal", "first_post", "find_people"],
    );
    assert.equal(fresh[1]?.xp, 10);
    assert.equal(fresh[1]?.href, "/feed?action=create-post");

    const partial = suggestedActions({
      profileReady: true,
      postCount: 1,
      connectionCount: 1,
      bookOpened: true,
      completedProjects: 0,
    });
    assert.equal(partial.length, 3);
    assert.equal(partial[0]?.id, "find_people");
    assert.match(partial[0]?.detail ?? "", /1 of 3 so far/);
    assert.equal(partial[1]?.id, "finish_project");
    assert.equal(partial[1]?.xp, 25);
    assert.equal(partial[2]?.id, "open_studio");

    const done = suggestedActions(
      {
        profileReady: true,
        postCount: 1,
        connectionCount: 3,
        bookOpened: true,
        completedProjects: 1,
        studioOpened: true,
      },
      { dailyDone: false, limit: 3 },
    );
    assert.deepEqual(done.map((action) => action.id), ["daily"]);
    assert.equal(done[0]?.xp, 5);
  });

  it("reports the XP the daily cap actually wrote", () => {
    assert.match(dailyDecodeCopy(false, 0), /up to 5 XP/);
    assert.match(dailyDecodeCopy(true, 0), /granted 0 XP/);
    assert.match(dailyDecodeCopy(true, 5), /5 XP is on the ledger/);
    assert.match(dailyDecodeCopy(true, 2), /2 XP is on the ledger/);
  });
});
