import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  closeButtonTop,
  dialogFramePadding,
  fullscreenEdgePadding,
  splitOverlayBodyClasses,
} from "./overlaySafeArea.ts";

describe("overlay safe area", () => {
  it("keeps shell chrome and moves padding onto the scroller", () => {
    const split = splitOverlayBodyClasses(
      "fixed z-50 gap-4 bg-card p-6 scrollbar-thin overflow-y-auto w-full sm:max-w-xl p-0 pb-24 sm:pb-8",
    );
    assert.match(split.shell, /\bfixed\b/);
    assert.match(split.shell, /\bw-full\b/);
    assert.match(split.shell, /\bsm:max-w-xl\b/);
    assert.doesNotMatch(split.shell, /\bp-0\b/);
    assert.match(split.body, /\bgap-4\b/);
    assert.match(split.body, /\bp-0\b/);
    assert.match(split.body, /\bpb-24\b/);
    assert.match(split.body, /\bsm:pb-8\b/);
    assert.match(split.body, /\boverflow-y-auto\b/);
  });

  it("moves the close button by the status-bar inset only when the panel is full height", () => {
    assert.equal(closeButtonTop(false), "0.75rem");
    assert.match(closeButtonTop(true), /^calc\(0\.75rem \+ env\(safe-area-inset-top/);
  });

  it("keeps the centered dialog's 1rem frame when insets are zero", () => {
    assert.equal(dialogFramePadding("top"), "max(1rem, env(safe-area-inset-top, 0px))");
    assert.equal(dialogFramePadding("bottom"), "max(1rem, env(safe-area-inset-bottom, 0px))");
  });

  it("lets an existing keyboard pad replace the home-indicator inset", () => {
    assert.equal(fullscreenEdgePadding("top", undefined), "env(safe-area-inset-top, 0px)");
    assert.equal(fullscreenEdgePadding("bottom", undefined), "env(safe-area-inset-bottom, 0px)");
    assert.equal(fullscreenEdgePadding("bottom", 320), "max(env(safe-area-inset-bottom, 0px), 320px)");
    assert.equal(
      fullscreenEdgePadding("bottom", "var(--keyboard)"),
      "max(env(safe-area-inset-bottom, 0px), var(--keyboard))",
    );
  });
});
