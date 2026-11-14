import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveTheme } from "./themeMode.ts";

describe("resolveTheme", () => {
  it("follows the system when the choice is system", () => {
    assert.equal(resolveTheme("system", true), "dark");
    assert.equal(resolveTheme("system", false), "light");
  });

  it("keeps an explicit dark or light choice", () => {
    assert.equal(resolveTheme("dark", false), "dark");
    assert.equal(resolveTheme("light", true), "light");
  });
});
