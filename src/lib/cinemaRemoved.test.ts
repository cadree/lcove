import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "integrations") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, acc);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) acc.push(path);
  }
  return acc;
}

test("Cinema screens are gone", () => {
  for (const file of ["pages/Cinema.tsx", "pages/NetworkPage.tsx", "pages/NetworkManage.tsx", "components/cinema"]) {
    assert.equal(existsSync(join(ROOT, file)), false, file);
  }
});

test("nothing links to /cinema except the redirect for old links", () => {
  const hits = walk(ROOT)
    .map((path) => ({ rel: relative(ROOT, path), text: readFileSync(path, "utf8") }))
    .filter(({ rel, text }) => rel !== "App.tsx" && rel !== "lib/appRoutes.ts" && /["'`]\/cinema/.test(text))
    .map(({ rel }) => rel);
  assert.deepEqual(hits, []);
  assert.match(readFileSync(join(ROOT, "App.tsx"), "utf8"), /path="\/cinema\/\*" element={<Navigate to="\/explore" replace \/>}/);
});
