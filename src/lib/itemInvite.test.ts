import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createHref,
  detailLine,
  itemInviteNotice,
  joinLabel,
  parseSendResult,
  parseTargets,
  pickerCopy,
  roleTag,
  rowAction,
  sendToast,
  splitTargets,
  whenLabel,
  type InviteTarget,
} from "./itemInvite.ts";
import { notificationsForTab } from "./likeNotice.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const INV = "33333333-3333-4333-8333-333333333333";

const row = (overrides: Partial<InviteTarget> = {}): InviteTarget => ({
  item_type: "event",
  item_id: A,
  title: "Gallery night",
  cover_url: null,
  starts_at: "2026-11-21T01:00:00Z",
  place: "The Mint, Charlotte",
  section: "yours",
  role: "host",
  state: "available",
  ...overrides,
});

describe("parseTargets", () => {
  it("keeps well-formed rows and cleans the rest", () => {
    const rows = parseTargets([
      { item_type: "project", item_id: A, title: "  Night Shoot ", cover_url: "javascript:alert(1)", section: "yours", role: "host", state: "invited" },
      { item_type: "event", item_id: B, title: "", cover_url: "https://x.test/c.jpg", section: "elsewhere", role: "boss", state: "weird" },
      { item_type: "post", item_id: A },
      { item_type: "event", item_id: "nope" },
      null,
    ]);
    assert.equal(rows.length, 2);
    assert.deepEqual([rows[0].title, rows[0].cover_url, rows[0].state], ["Night Shoot", null, "invited"]);
    assert.deepEqual([rows[1].title, rows[1].cover_url, rows[1].section, rows[1].role, rows[1].state], ["Untitled event", "https://x.test/c.jpg", "nearby", null, "available"]);
    assert.deepEqual(parseTargets(null), []);
  });

  it("splits yours from nearby in order", () => {
    const { yours, nearby } = splitTargets([row({ item_id: A }), row({ item_id: B, section: "nearby", role: null })]);
    assert.deepEqual([yours.map((r) => r.item_id), nearby.map((r) => r.item_id)], [[A], [B]]);
  });
});

describe("rowAction", () => {
  it("enables only available rows and shows sent after a tap", () => {
    assert.deepEqual(rowAction(row(), new Set(), "Rezza"), { label: "Invite Rezza", disabled: false, done: false });
    assert.deepEqual(rowAction(row(), new Set([A]), "Rezza"), { label: "Sent", disabled: true, done: true });
    assert.deepEqual(rowAction(row({ state: "invited" }), new Set(), "Rezza"), { label: "Invited", disabled: true, done: true });
    assert.equal(rowAction(row({ state: "member" }), new Set(), "Rezza").label, "Already in");
    assert.equal(rowAction(row({ state: "going" }), new Set(), "Rezza").label, "Going");
    assert.equal(rowAction(row({ state: "host" }), new Set(), "Rezza").label, "Their event");
    assert.equal(rowAction(row({ state: "host", item_type: "project" }), new Set(), "Rezza").label, "Their project");
  });

  it("tags the viewer's relation", () => {
    assert.equal(roleTag(row()), "Hosting");
    assert.equal(roleTag(row({ item_type: "project" })), "Yours");
    assert.equal(roleTag(row({ role: "member" })), "Member");
    assert.equal(roleTag(row({ role: "going" })), "Going");
    assert.equal(roleTag(row({ role: null })), null);
  });
});

describe("labels", () => {
  it("formats event time in the viewer's zone and project dates as days", () => {
    assert.equal(whenLabel(row(), "America/New_York"), "Fri, Nov 20 · 8:00 PM");
    assert.equal(whenLabel(row({ item_type: "project", starts_at: "2026-12-03" })), "Starts Dec 3");
    assert.equal(whenLabel(row({ starts_at: null })), null);
    assert.equal(whenLabel(row({ starts_at: "garbage" })), null);
    assert.equal(detailLine(row(), "America/New_York"), "Fri, Nov 20 · 8:00 PM · The Mint, Charlotte");
    assert.equal(detailLine(row({ starts_at: null, place: null })), "");
  });

  it("reads send results and toasts", () => {
    const sent = parseSendResult({ status: "sent", id: INV, notified: true });
    assert.deepEqual(sent, { status: "sent", id: INV, notified: true });
    assert.equal(sendToast(sent, "Rezza", "Gallery night"), "Invite sent to Rezza");
    assert.equal(sendToast(parseSendResult({ status: "already_invited", id: INV }), "Rezza", "Gallery night"), "Rezza already has an invite to Gallery night");
    assert.deepEqual(parseSendResult({ status: "already_in", state: "going" }), { status: "already_in", state: "going" });
    assert.equal(sendToast(parseSendResult({ status: "already_in" }), "Rezza", "Night Shoot"), "Rezza is already in Night Shoot");
  });

  it("names the actions per kind", () => {
    assert.equal(joinLabel("event"), "RSVP");
    assert.equal(joinLabel("project"), "Join");
    assert.equal(createHref("event"), "/calendar?action=create");
    assert.equal(createHref("project"), "/projects?action=create");
    assert.equal(pickerCopy("event", "Rezza").title, "Invite Rezza to an event");
    assert.equal(pickerCopy("project", "Rezza").nearbyHeading, "Open near you");
  });
});

describe("itemInviteNotice", () => {
  it("builds the path from ids, never from stored text", () => {
    const notice = itemInviteNotice({ type: "item_invite", data: { invite_id: INV, item_type: "project", item_id: A, path: "https://evil.test" } });
    assert.deepEqual(notice, { inviteId: INV, kind: "project", path: `/project/${A}`, answerable: true, accepted: null });
  });

  it("knows answered invites and the sender's accepted notice", () => {
    assert.equal(itemInviteNotice({ type: "item_invite", data: { invite_id: INV, item_type: "event", item_id: A, accepted: true } })?.answerable, false);
    assert.equal(itemInviteNotice({ type: "item_invite", data: { invite_id: INV, item_type: "event", item_id: A, accepted: true, answer: true } })?.answerable, false);
    assert.equal(itemInviteNotice({ type: "match", data: {} }), null);
    assert.equal(itemInviteNotice({ type: "item_invite", data: { invite_id: "x", item_type: "event", item_id: A } }), null);
    assert.equal(itemInviteNotice({ type: "item_invite", data: null }), null);
  });

  it("shows item invites under the Invites tab", () => {
    const items = [{ id: "1", type: "item_invite" }, { id: "2", type: "project_invite" }, { id: "3", type: "like" }];
    assert.deepEqual(notificationsForTab(items, "project_invite").map((i) => i.id), ["1", "2"]);
    assert.deepEqual(notificationsForTab(items, "like").map((i) => i.id), ["3"]);
  });
});
