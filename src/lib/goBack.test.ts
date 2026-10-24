import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { backTarget, historyIndex, isMainTabPath, parentFallback } from "./goBack.ts";

describe("in-app back", () => {
  it("returns to the previous screen when React Router has a stack", () => {
    assert.equal(historyIndex({ idx: 2, key: "abc" }), 2);
    assert.equal(backTarget({ idx: 2 }), -1);
    assert.equal(backTarget({ idx: 1 }), -1);
  });

  it("falls back to the feed on a deep link", () => {
    assert.equal(backTarget({ idx: 0 }), "/feed");
    assert.equal(backTarget(null), "/feed");
    assert.equal(backTarget({}), "/feed");
    assert.equal(backTarget({ idx: "2" }), "/feed");
  });

  it("does not treat browser history length as an in-app screen", () => {
    assert.equal(backTarget({ idx: 0, length: 8 }), "/feed");
  });

  it("uses the screen parent when a caller passes one", () => {
    assert.equal(backTarget({ idx: 0 }, "/directory"), "/directory");
    assert.equal(backTarget({ idx: 2 }, "/directory"), -1);
  });
});

describe("parent screens", () => {
  it("keeps the four tabs as roots", () => {
    assert.equal(isMainTabPath("/feed"), true);
    assert.equal(isMainTabPath("/explore"), true);
    assert.equal(isMainTabPath("/messages"), true);
    assert.equal(isMainTabPath("/profile"), true);
    assert.equal(isMainTabPath("/profile/someone"), false);
    assert.equal(isMainTabPath("/directory"), false);
  });

  it("sends a deep link to a parent that can open the screen again", () => {
    assert.equal(parentFallback("/profile/abc"), "/directory");
    assert.equal(parentFallback("/settings/booking"), "/settings");
    assert.equal(parentFallback("/settings"), "/profile");
    assert.equal(parentFallback("/blog/post"), "/blog");
    assert.equal(parentFallback("/boards/board"), "/boards");
    assert.equal(parentFallback("/cinema/manage/net"), "/cinema/network/net");
    assert.equal(parentFallback("/cinema/network/net"), "/cinema");
    assert.equal(parentFallback("/dashboard/events/evt"), "/dashboard/events");
    assert.equal(parentFallback("/dashboard/events"), "/dashboard");
    assert.equal(parentFallback("/admin/onboarding/user"), "/admin/onboarding");
    assert.equal(parentFallback("/admin/onboarding"), "/admin");
    assert.equal(parentFallback("/event/evt/confirmation"), "/event/evt");
    assert.equal(parentFallback("/event/evt"), "/calendar");
    assert.equal(parentFallback("/project/proj"), "/projects");
    assert.equal(parentFallback("/book"), "/feed");
    assert.equal(parentFallback("/book/maya"), "/");
    assert.equal(parentFallback("/quests"), "/feed");
    assert.equal(parentFallback("/privacy"), "/");
  });
});
