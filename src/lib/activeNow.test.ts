import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectPresenceUserIds, selectActiveNow, shouldPublishPresence } from "./activeNow.ts";

describe("selectActiveNow", () => {
  const profiles = [
    { user_id: "cadre", display_name: "Cadre Wallace", avatar_url: "cadre.png" },
    { user_id: "jordan", display_name: "Jordan Reyes", avatar_url: null },
    { user_id: "kofi", display_name: "  Kofi Mensah  ", avatar_url: "kofi.png" },
  ];

  it("includes every other present user, with or without a direct chat", () => {
    const conversations = [
      { type: "direct", otherUserId: "cadre" },
      { type: "group", otherUserId: "jordan" },
    ];

    const selected = selectActiveNow({
      onlineUserIds: ["me", "cadre", "jordan", "kofi", "cadre"],
      selfId: "me",
      profiles,
    });

    assert.deepEqual(
      selected.map((person) => person.userId),
      ["cadre", "jordan", "kofi"],
    );
    assert.equal(conversations.some((conversation) => conversation.otherUserId === "kofi"), false);
    assert.equal(conversations.find((conversation) => conversation.otherUserId === "jordan")?.type, "group");
    assert.deepEqual(selected[0], {
      userId: "cadre",
      displayName: "Cadre Wallace",
      avatarUrl: "cadre.png",
    });
    assert.equal(selected[1].avatarUrl, null);
    assert.equal(selected[2].displayName, "Kofi Mensah");
  });

  it("is empty only when nobody else is present", () => {
    assert.deepEqual(selectActiveNow({ onlineUserIds: [], selfId: "me" }), []);
    assert.deepEqual(selectActiveNow({ onlineUserIds: ["me"], selfId: "me" }), []);
  });

  it("still lists someone whose profile has not loaded", () => {
    const selected = selectActiveNow({
      onlineUserIds: ["new-member"],
      selfId: "me",
      profiles: [{ user_id: "new-member", display_name: "   ", avatar_url: null }],
    });
    assert.deepEqual(selected, [{ userId: "new-member", displayName: "User", avatarUrl: null }]);
  });

  it("lets a later profile replace an earlier name for the same user", () => {
    const selected = selectActiveNow({
      onlineUserIds: ["cadre"],
      selfId: "me",
      profiles: [
        { user_id: "cadre", display_name: "Cadre", avatar_url: null },
        { user_id: "cadre", display_name: "Cadre Wallace", avatar_url: "cadre.png" },
      ],
    });
    assert.equal(selected[0].displayName, "Cadre Wallace");
    assert.equal(selected[0].avatarUrl, "cadre.png");
  });
});

describe("collectPresenceUserIds", () => {
  it("reads user ids from presence payloads and falls back to the presence key", () => {
    const ids = collectPresenceUserIds({
      me: [{ user_id: "me", online_at: "2026-10-26T12:00:00.000Z" }],
      jordan: [{}],
      skip: [{ user_id: "" }],
    });
    assert.deepEqual(ids, ["me", "jordan", "skip"]);
  });
});

describe("shouldPublishPresence", () => {
  const base = {
    userId: "me",
    shotSession: false,
    nativePlatform: false,
    nativeActive: null as boolean | null,
    documentVisible: true,
  };

  it("joins a visible web tab and drops when the tab is hidden", () => {
    assert.equal(shouldPublishPresence(base), true);
    assert.equal(shouldPublishPresence({ ...base, documentVisible: false }), false);
  });

  it("joins the native app only while Capacitor reports it active", () => {
    assert.equal(shouldPublishPresence({ ...base, nativePlatform: true, nativeActive: null }), false);
    assert.equal(
      shouldPublishPresence({ ...base, nativePlatform: true, nativeActive: true, documentVisible: false }),
      true,
    );
    assert.equal(
      shouldPublishPresence({ ...base, nativePlatform: true, nativeActive: false, documentVisible: true }),
      false,
    );
  });

  it("does not publish a signed-out or screenshot session", () => {
    assert.equal(shouldPublishPresence({ ...base, userId: null }), false);
    assert.equal(shouldPublishPresence({ ...base, shotSession: true }), false);
  });
});
