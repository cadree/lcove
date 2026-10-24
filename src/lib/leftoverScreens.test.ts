import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("leftover screens", () => {
  it("drops click instructions from project badges", () => {
    const detail = source("components/projects/ProjectDetail.tsx");
    assert.equal(detail.includes("Click to Apply"), false);
    assert.equal(detail.includes("Click to open"), false);
    assert.match(detail, /'Apply'/);
  });

  it("gives the auth and landing heroes a heading", () => {
    const auth = source("pages/Auth.tsx");
    assert.match(auth, /\{getTitle\(\) \|\| getSubtitle\(\)\}/);
    assert.match(auth, /<motion\.h1/);
    const hero = source("components/landing/LandingHero.tsx");
    assert.match(hero, /<h1[^>]*>\s*<EtherWordmark/);
    assert.match(hero, /HERO_TAGLINE/);
    assert.match(hero, /Familcy access/);
  });

  it("gives a denied account its own page", () => {
    const app = source("App.tsx");
    const denied = source("pages/Denied.tsx");
    assert.match(app, /<Route path="\/denied" element={<Denied \/>} \/>/);
    assert.match(denied, /This account was not approved/);
    assert.match(denied, /Go home/);
    assert.match(denied, /Sign out/);
    assert.equal(/no longer available/i.test(denied), false);
  });

  it("moves a pipeline contact from a menu and keeps drag", () => {
    const pipeline = source("pages/Pipeline.tsx");
    assert.match(pipeline, /aria-label=\{`Move \$\{item\.name\}`\}/);
    assert.match(pipeline, /DropdownMenuItem/);
    assert.match(pipeline, /\bdraggable\b/);
  });
});
