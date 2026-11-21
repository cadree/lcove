import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activeFilterCount,
  bulkActionsFor,
  chunk,
  mergeResults,
  resolveFilters,
  resultSummary,
  sameFilters,
  standing,
  undoPlan,
  type BulkResult,
} from "./adminMembers.ts";

const result = (over: Partial<BulkResult>): BulkResult => ({
  action: "suspend",
  requested: 0,
  succeeded: 0,
  failed: 0,
  errors: [],
  done: [],
  before: [],
  ...over,
});

const before = (user_id: string, over: Partial<BulkResult["before"][number]> = {}) => ({
  user_id,
  mindset_level: null,
  is_suspended: false,
  suspension_reason: null,
  deleted_at: null,
  access_status: "active",
  ...over,
});

describe("admin member filters", () => {
  it("drops empty values and the default removed mode", () => {
    assert.deepEqual(resolveFilters({ q: "  ", city: "", removed: "hide", status: "active" }), { status: "active" });
  });

  it("turns 'joined this week' into a date", () => {
    const now = new Date("2026-11-21T12:00:00Z");
    assert.deepEqual(resolveFilters({ joined_from: "__7d" }, now), { joined_from: "2026-11-14" });
  });

  it("does not count the search box as a filter", () => {
    assert.equal(activeFilterCount({ q: "ada", status: "pending", suspended: "yes" }), 2);
  });

  it("compares views by their meaning", () => {
    assert.ok(sameFilters({ removed: "hide" }, {}));
    assert.ok(!sameFilters({ status: "active" }, {}));
  });
});

describe("bulk actions", () => {
  it("splits large selections into server-sized chunks", () => {
    const ids = Array.from({ length: 1201 }, (_, i) => String(i));
    assert.deepEqual(chunk(ids).map((part) => part.length), [500, 500, 201]);
  });

  it("summarises like 'Suspended 12, 1 failed'", () => {
    assert.equal(resultSummary({ action: "suspend", succeeded: 12, failed: 1 }), "Suspended 12, 1 failed");
    assert.equal(resultSummary({ action: "remove", succeeded: 3, failed: 0 }), "Removed 3");
  });

  it("merges chunk replies", () => {
    const merged = mergeResults("remove", [
      result({ action: "remove", requested: 2, succeeded: 2, done: ["a", "b"] }),
      result({ action: "remove", requested: 1, failed: 1, errors: [{ user_id: "c", error: "nope" }] }),
    ]);
    assert.equal(merged.requested, 3);
    assert.equal(merged.succeeded, 2);
    assert.deepEqual(merged.done, ["a", "b"]);
    assert.equal(merged.errors[0].user_id, "c");
  });

  it("undoes a suspend only for people who were not already suspended", () => {
    const plan = undoPlan(result({
      action: "suspend",
      done: ["a", "b"],
      before: [before("a"), before("b", { is_suspended: true }), before("c")],
    }));
    assert.deepEqual(plan, [{ action: "unsuspend", userIds: ["a"] }]);
  });

  it("undoes a remove by restoring", () => {
    assert.deepEqual(undoPlan(result({ action: "remove", done: ["a"], before: [before("a")] })), [
      { action: "restore", userIds: ["a"] },
    ]);
  });

  it("puts each person back on their old level", () => {
    const plan = undoPlan(result({
      action: "set_level",
      done: ["a", "b", "c"],
      before: [before("a", { mindset_level: 1 }), before("b", { mindset_level: 2 }), before("c", { mindset_level: 1 })],
    }));
    assert.deepEqual(plan, [
      { action: "set_level", userIds: ["a", "c"], payload: { level: 1 } },
      { action: "set_level", userIds: ["b"], payload: { level: 2 } },
    ]);
  });

  it("cannot take back a message", () => {
    assert.deepEqual(undoPlan(result({ action: "message", done: ["a"], before: [before("a")] })), []);
  });

  it("only offers restore in the removed view", () => {
    assert.deepEqual(bulkActionsFor({ removed: "only" }), ["restore"]);
    assert.ok(bulkActionsFor({}).includes("remove"));
  });
});

describe("standing", () => {
  it("shows removed before banned or suspended", () => {
    assert.equal(standing({ deleted_at: "x", access_status: "banned", is_suspended: true }), "removed");
    assert.equal(standing({ deleted_at: null, access_status: "active", is_suspended: true }), "suspended");
    assert.equal(standing({ deleted_at: null, access_status: null, is_suspended: false }), "pending");
  });
});
