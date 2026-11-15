import assert from "node:assert/strict";
import test from "node:test";
import {
  addNudge,
  CONNECT_NUDGE_LIMIT,
  dismissNudge,
  firstName,
  icebreaker,
  markNudgeStarted,
  messageHref,
  nudgeCopy,
  nudgeFor,
  readNudges,
  travelHref,
  type ConnectNudge,
} from "./connectMoment.ts";

const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
};

const row = (over: Partial<ConnectNudge> = {}): ConnectNudge => ({
  userId: "u2",
  name: "Jordan Blake",
  avatarUrl: null,
  role: "Director",
  skills: ["Film"],
  passions: ["Cinema"],
  city: "Charlotte, NC",
  tripCity: null,
  matched: false,
  conversationId: null,
  started: false,
  at: 1,
  ...over,
});

test("icebreaker prefers a shared skill, then passion, trip, city, then role", () => {
  const person = { name: "Jordan Blake", skills: ["Film", "Photo"], passions: ["Cinema"], role: "Director", city: "Charlotte, NC", tripCity: null };
  const me = { skills: ["Photo"], passions: ["Cinema"], city: "Charlotte, NC" };
  assert.equal(icebreaker(person, me), "Hey Jordan, we both work in Photo. Want to make something together?");
  assert.equal(
    icebreaker({ ...person, skills: ["Painting"] }, me),
    "Hey Jordan, we both care about Cinema. Want to start a project around that?",
  );
  assert.equal(
    icebreaker({ ...person, skills: [], passions: [], tripCity: "Miami, FL" }, me),
    "Hey Jordan, I saw you're traveling to Miami. Want to plan something there?",
  );
  assert.equal(
    icebreaker({ ...person, skills: [], passions: [] }, me),
    "Hey Jordan, we're both in Charlotte. Want to meet up or start a project?",
  );
  assert.equal(
    icebreaker({ ...person, skills: [], passions: [], city: "Tokyo, Japan" }, me),
    "Hey Jordan, your Director work looks great. Want to team up?",
  );
  assert.equal(
    icebreaker({ name: "Jordan Blake", skills: [], passions: [] }),
    "Hey Jordan, I'd love to connect and make something together.",
  );
});

test("nudge copy and routes stay on existing pages", () => {
  assert.equal(firstName("Jordan Blake"), "Jordan");
  assert.equal(nudgeCopy({ name: "Jordan Blake", matched: false }), "You and Jordan connected, start something");
  assert.equal(nudgeCopy({ name: "Jordan Blake", matched: true }), "You and Jordan matched, start something");
  assert.equal(messageHref("chat-1"), "/messages?conversation=chat-1");
  assert.equal(travelHref({ city: "Charlotte, NC", tripCity: null }), "/travel?action=create&city=Charlotte");
  assert.equal(travelHref({ city: "Charlotte, NC", tripCity: "Miami, FL" }), "/travel?action=create&city=Miami");
});

test("nudges persist per viewer, upsert, cap, and drop after a start or dismiss", () => {
  const store = memory();
  assert.deepEqual(readNudges(store, undefined), []);
  addNudge(store, "me", row());
  addNudge(store, "me", row({ userId: "u3", name: "Avery" }));
  addNudge(store, "me", row({ name: "Jordan", matched: true, conversationId: "c1", at: 2 }));
  const mine = readNudges(store, "me");
  assert.equal(mine[0].userId, "u2");
  assert.equal(mine[0].matched, true);
  assert.equal(mine[0].conversationId, "c1");
  assert.equal(mine.length, 2);
  assert.equal(readNudges(store, "other").length, 0);
  assert.equal(nudgeFor(mine, "u2")?.name, "Jordan");
  markNudgeStarted(store, "me", "u2");
  assert.equal(nudgeFor(readNudges(store, "me"), "u2"), undefined);
  dismissNudge(store, "me", "u3");
  assert.equal(readNudges(store, "me").length, 0);
});

test("a store that throws never blocks the page, and the list stays capped", () => {
  const broken = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
  assert.deepEqual(readNudges(broken, "me"), []);
  assert.doesNotThrow(() => addNudge(broken, "me", row()));
  const store = memory();
  for (let i = 0; i < CONNECT_NUDGE_LIMIT + 3; i++) addNudge(store, "me", row({ userId: `u${i}`, name: `P${i}`, at: i }));
  assert.equal(readNudges(store, "me").length, CONNECT_NUDGE_LIMIT);
});
