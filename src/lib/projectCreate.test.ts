import assert from "node:assert/strict";
import test from "node:test";
import { canCreateProject, createPayHint, filledProjectExtras, type ProjectExtras } from "./projectCreate.ts";

test("a title and an LC credits pay type are enough to create", () => {
  assert.equal(canCreateProject({ title: "Music video", projectType: "volunteer", budget: 0, roleCredits: 0 }), true);
  assert.equal(canCreateProject({ title: "  ", projectType: "volunteer", budget: 0, roleCredits: 0 }), false);
});

test("paid needs a budget; hybrid needs a budget or role XP", () => {
  assert.equal(canCreateProject({ title: "Shoot", projectType: "paid", budget: 0, roleCredits: 50 }), false);
  assert.match(createPayHint({ projectType: "paid", budget: 0, roleCredits: 0 }) ?? "", /total budget/);
  assert.equal(canCreateProject({ title: "Shoot", projectType: "paid", budget: 500, roleCredits: 0 }), true);
  assert.equal(canCreateProject({ title: "Shoot", projectType: "hybrid", budget: 0, roleCredits: 50 }), true);
  assert.equal(canCreateProject({ title: "Shoot", projectType: "hybrid", budget: 0, roleCredits: 0 }), false);
  assert.equal(canCreateProject({ title: "Shoot", projectType: "paid", budget: Number.NaN, roleCredits: 0 }), false);
});

test("the More details row counts what was filled in", () => {
  const empty: ProjectExtras = {
    isPrivate: false, hideFromCalendar: false, listingType: "project", outcomes: 0, attachments: 0,
    budgetRange: "", equipmentNeeded: " ", locationSecured: false, venue: "", propsNeeded: "",
    sponsorshipNeeded: false, vendorsNeeded: false, startDate: "", endDate: "", milestoneDates: 0,
    roles: 0, allowCustomRoles: false, deliverables: 0,
  };
  assert.equal(filledProjectExtras(empty), 0);
  assert.equal(filledProjectExtras({ ...empty, roles: 2, startDate: "2026-12-01", endDate: "2026-12-02", isPrivate: true }), 3);
});
