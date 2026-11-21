import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanCreditRole,
  creditByline,
  creditHref,
  creditRoleError,
  groupCredits,
  postCreditLine,
  type WorkCredit,
} from "./workCredits.ts";

const credit = (over: Partial<WorkCredit>): WorkCredit => ({
  id: "c1", role: "Stylist", status: "accepted", created_at: "2026-11-15T00:00:00Z", source: "project",
  project_id: "p1", post_id: null, title: "Night Shoot", cover: null, sort_at: "2026-11-15T00:00:00Z",
  credited_by: "owner", credited_by_name: "Cadre", ...over,
});

test("roles are cleaned and length-checked like the server", () => {
  assert.equal(cleanCreditRole("  Hair   and  makeup "), "Hair and makeup");
  assert.equal(creditRoleError("   "), "Add their role");
  assert.equal(creditRoleError("x".repeat(61)), "Keep the role to 60 characters");
  assert.equal(creditRoleError(" Stylist "), null);
});

test("owners see pending and hidden credits; visitors only accepted ones", () => {
  const all = [credit({ id: "a" }), credit({ id: "p", status: "pending" }), credit({ id: "h", status: "hidden" })];
  const mine = groupCredits(all, true);
  assert.deepEqual([mine.pending.map((c) => c.id), mine.shown.map((c) => c.id), mine.hidden.map((c) => c.id)], [["p"], ["a"], ["h"]]);
  const theirs = groupCredits(all, false);
  assert.deepEqual([theirs.pending, theirs.shown.map((c) => c.id), theirs.hidden], [[], ["a"], []]);
});

test("credits open the project page or the post on its author's profile", () => {
  assert.equal(creditHref(credit({})), "/project/p1");
  assert.equal(creditHref(credit({ source: "post", project_id: null, post_id: "post9", credited_by: "u7" })), "/profile/u7?post=post9");
  assert.equal(creditHref(credit({ project_id: null })), null);
});

test("byline names whose work it was, never the person themselves", () => {
  assert.equal(creditByline(credit({}), "someone"), "Project by Cadre");
  assert.equal(creditByline(credit({ source: "post", credited_by_name: null }), "someone"), "Post by a member");
  assert.equal(creditByline(credit({ credited_by: "me" }), "me"), null);
});

test("a post's credit line lists accepted credits only", () => {
  const base = { avatar_url: null, user_id: "u" };
  assert.equal(postCreditLine([]), null);
  assert.equal(
    postCreditLine([
      { ...base, id: "1", role: "Stylist", status: "accepted", name: "Rezza" },
      { ...base, id: "2", role: "Light", status: "pending", name: "Theo" },
      { ...base, id: "3", role: "MUA", status: "accepted", name: "Jade" },
    ]),
    "With Rezza (Stylist), Jade (MUA)",
  );
});
