import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import { readoutAt } from "../../lib/xpMotion.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

async function loadHero() {
  const outfile = join(root, "node_modules/.cache/quest-hero-render.mjs");
  mkdirSync(join(root, "node_modules/.cache"), { recursive: true });
  await build({
    absWorkingDir: root,
    entryPoints: ["src/components/novi/QuestHero.tsx"],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    jsx: "automatic",
    alias: { "@": join(root, "src") },
    external: ["react", "react/jsx-runtime"],
  });
  return import(`${pathToFileURL(outfile).href}?t=${Date.now()}`) as Promise<{
    QuestHero: (props: { displayedXp: number }) => ReturnType<typeof createElement>;
  }>;
}

function heroHtml(Hero: (props: { displayedXp: number }) => ReturnType<typeof createElement>, displayedXp: number) {
  return renderToStaticMarkup(createElement(Hero, { displayedXp }));
}

describe("quests hero", () => {
  it("renders level, title, and bar from the displayed XP", async () => {
    const { QuestHero } = await loadHero();
    const at39 = heroHtml(QuestHero, 39);
    const at40 = heroHtml(QuestHero, 40);
    const at48 = heroHtml(QuestHero, 48);

    assert.match(at39, />Level 1</);
    assert.doesNotMatch(at39, /Level 2/);
    assert.match(at39, />39 XP</);
    assert.match(at39, />39\/40</);
    assert.match(at39, />Creator</);

    assert.match(at40, />Level 2</);
    assert.match(at40, />40 XP</);
    assert.match(at40, />0\/60</);

    assert.match(at48, />Level 2</);
    assert.doesNotMatch(at48, /Level 1/);
    assert.match(at48, />48 XP</);
    assert.match(at48, />8\/60</);

    for (const xp of [39, 40, 48]) {
      const view = readoutAt(xp);
      const html = heroHtml(QuestHero, xp);
      assert.deepEqual(html.match(/Level \d+/g), [`Level ${view.level}`]);
      assert.match(html, new RegExp(`>${view.xp} XP<`));
      assert.match(html, new RegExp(`>${view.into}/${view.span}<`));
    }
  });
});
