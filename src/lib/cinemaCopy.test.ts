import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { CINEMA_TOOL_LABEL, CREATE_NETWORK_NAME_PLACEHOLDER } from "./cinemaCopy.ts";

const PHRASE = /cinema\s+networks?/i;
const ROOT = fileURLToPath(new URL("../", import.meta.url));

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "integrations") continue;
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path, acc);
    else if (/\.(ts|tsx|js|jsx|md|json)$/.test(name)) acc.push(path);
  }
  return acc;
}

test("Cinema tool and create-network copy do not say cinema networks", () => {
  assert.equal(CINEMA_TOOL_LABEL, "Cinema");
  assert.equal(CREATE_NETWORK_NAME_PLACEHOLDER, "My network");
  assert.equal(PHRASE.test(CINEMA_TOOL_LABEL), false);
  assert.equal(PHRASE.test(CREATE_NETWORK_NAME_PLACEHOLDER), false);
});

test("src no longer contains the phrase cinema networks", () => {
  const hits: string[] = [];
  for (const path of walk(ROOT)) {
    const text = readFileSync(path, "utf8");
    if (!PHRASE.test(text)) continue;
    const rel = relative(ROOT, path);
    // Allow this test file to mention the phrase it is guarding against.
    if (rel === "lib/cinemaCopy.test.ts") continue;
    for (const [index, line] of text.split("\n").entries()) {
      if (PHRASE.test(line)) hits.push(`${rel}:${index + 1}: ${line.trim()}`);
    }
  }
  assert.deepEqual(hits, []);
});
