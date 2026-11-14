import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { contrastRatio, hslToRgb, mix, parseHex, type Rgb } from "./contrast.ts";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../index.css"), "utf8");

function block(source: string, opener: string): string {
  const at = source.indexOf(opener);
  assert.ok(at >= 0, `missing ${opener}`);
  const start = source.indexOf("{", at);
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start + 1, i);
    }
  }
  throw new Error(`unclosed ${opener}`);
}

function tokens(source: string): Record<string, Rgb> {
  const found: Record<string, Rgb> = {};
  for (const match of source.matchAll(/--([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/g)) {
    found[match[1]] = hslToRgb(Number(match[2]), Number(match[3]), Number(match[4]));
  }
  return found;
}

function tones(source: string, lightMode: boolean): Record<string, { a: Rgb; b: Rgb }> {
  const found: Record<string, { a: Rgb; b: Rgb }> = {};
  for (const match of source.matchAll(
    /(\.light\s+)?\.world\[data-tone="([\w-]+)"\][^{]*\{[^}]*--tone-a:\s*(#[0-9a-fA-F]{6});\s*--tone-b:\s*(#[0-9a-fA-F]{6})/g,
  )) {
    if (Boolean(match[1]) !== lightMode) continue;
    found[match[2]] = { a: parseHex(match[3]), b: parseHex(match[4]) };
  }
  return found;
}

const dark = tokens(block(css, ":root,"));
const light = tokens(block(css, "\n  .light {"));
const darkTones = tones(css, false);
const lightTones = tones(css, true);
const darkGlow = Number(css.match(/\.world-glow\s*\{[^}]*opacity:\s*([\d.]+)/)?.[1]);
const lightGlow = Number(css.match(/\.light \.world-glow\s*\{\s*opacity:\s*([\d.]+)/)?.[1]);

const BODY = 4.5;
const UI = 3;

function backgrounds(base: Rgb, palette: Record<string, { a: Rgb; b: Rgb }>, opacity: number): Array<[string, Rgb]> {
  const list: Array<[string, Rgb]> = [["page", base]];
  for (const [name, tone] of Object.entries(palette)) {
    list.push([`${name} glow`, mix(base, tone.a, opacity)]);
    list.push([`${name} side glow`, mix(base, tone.b, opacity)]);
    list.push([`${name} stacked glow`, mix(mix(base, tone.a, opacity), tone.b, opacity)]);
  }
  return list;
}

function assertText(mode: string, fg: Rgb, label: string, surfaces: Array<[string, Rgb]>, minimum = BODY) {
  for (const [name, bg] of surfaces) {
    const ratio = contrastRatio(fg, bg);
    assert.ok(
      ratio >= minimum,
      `${mode} ${label} on ${name} is ${ratio.toFixed(2)}:1`,
    );
  }
}

describe("ether contrast", () => {
  it("keeps the atmosphere behind the type", () => {
    assert.match(block(css, "\n.world {"), /z-index:\s*-1/);
    assert.ok(darkGlow > 0 && darkGlow <= 0.18, `dark glow opacity ${darkGlow}`);
    assert.ok(lightGlow > 0 && lightGlow <= 0.42, `light glow opacity ${lightGlow}`);
    assert.equal(Object.keys(darkTones).length, 7);
    assert.equal(Object.keys(lightTones).length, 7);
  });

  it("holds WCAG AA for text on the page and on each glow", () => {
    for (const [mode, palette, glow, tone] of [
      ["dark", dark, darkGlow, darkTones],
      ["light", light, lightGlow, lightTones],
    ] as const) {
      const page = backgrounds(palette.background, tone, glow);
      const card = palette.card;
      const well = palette.muted;
      const solids: Array<[string, Rgb]> = [
        ...page,
        ["card", card],
        ["avatar", well],
      ];
      assertText(mode, palette.foreground, "body", solids);
      assertText(mode, palette["muted-foreground"], "muted", solids);
      assertText(mode, palette.primary, "primary", solids);
      assertText(mode, palette.brand, "brand", page);
      assertText(mode, palette.gold, "gold", [["page", palette.background], ["card", card], ["avatar", well]]);
      assertText(mode, palette.scan, "scan", [["page", palette.background], ["card", card], ["avatar", well]]);
      assertText(mode, palette["primary-foreground"], "primary label", [["primary", palette.primary]]);
    }
  });

  it("holds 3:1 for control boundaries", () => {
    for (const [mode, palette] of [
      ["dark", dark],
      ["light", light],
    ] as const) {
      for (const surface of ["background", "card", "input"] as const) {
        const ratio = contrastRatio(palette.border, palette[surface]);
        assert.ok(ratio >= UI, `${mode} border on ${surface} is ${ratio.toFixed(2)}:1`);
      }
    }
  });
});
