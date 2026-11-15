import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contrastRatio, parseHex } from "./contrast.ts";
import { GLOBE_PAINT, landTint, type GlobeLook, type LandTint } from "./globePaint.ts";

const MARKER = {
  cream: "#faf4ed",
  dark: "#0b0b12",
  pink: "#ff9fc8",
  cyan: "#79c3cf",
  badgeText: "#1b1520",
};

describe("landTint", () => {
  it("colors well-known places by climate", () => {
    const places: [number, number, LandTint][] = [
      [10, 25, "desert"],
      [46, 24, "desert"],
      [133, -25, "desert"],
      [-112, 33, "desert"],
      [-60, -3, "tropical"],
      [18, 0, "tropical"],
      [2, 48.8, "temperate"],
      [-75, 40, "temperate"],
      [105, 60, "boreal"],
      [-42, 72, "ice"],
      [0, -80, "ice"],
    ];
    for (const [lon, lat, tint] of places) {
      assert.equal(landTint(lon, lat), tint, `${lon},${lat}`);
    }
  });
});

describe("globe paint contrast", () => {
  const looks: GlobeLook[] = ["natural", "jewel"];

  it("keeps cream markers readable on ocean and vegetated land", () => {
    for (const look of looks) {
      const paint = GLOBE_PAINT[look];
      for (const [name, hex] of [
        ["ocean mid", paint.ocean[1]],
        ["ocean deep", paint.ocean[2]],
        ["tropical", paint.land.tropical],
        ["temperate", paint.land.temperate],
        ["boreal", paint.land.boreal],
      ] as const) {
        const ratio = contrastRatio(parseHex(MARKER.cream), parseHex(hex));
        assert.ok(ratio >= 3, `${look} cream on ${name} is ${ratio.toFixed(2)}:1`);
      }
    }
  });

  it("keeps the dark face ring readable on ice, desert and mid land", () => {
    for (const look of looks) {
      const paint = GLOBE_PAINT[look];
      for (const [name, hex] of [
        ["ice", paint.land.ice],
        ["desert", paint.land.desert],
        ["temperate", paint.land.temperate],
      ] as const) {
        const ratio = contrastRatio(parseHex(MARKER.dark), parseHex(hex));
        assert.ok(ratio >= 3, `${look} face ring on ${name} is ${ratio.toFixed(2)}:1`);
      }
    }
  });

  it("keeps the count badge and its label readable", () => {
    for (const look of looks) {
      const paint = GLOBE_PAINT[look];
      assert.ok(contrastRatio(parseHex(MARKER.badgeText), parseHex(MARKER.pink)) >= 4.5);
      for (const [name, hex] of [
        ["ice", paint.land.ice],
        ["desert", paint.land.desert],
        ["temperate", paint.land.temperate],
      ] as const) {
        const ratio = contrastRatio(parseHex(MARKER.dark), parseHex(hex));
        assert.ok(ratio >= 3, `${look} badge stroke on ${name} is ${ratio.toFixed(2)}:1`);
      }
      assert.ok(contrastRatio(parseHex(MARKER.pink), parseHex(paint.ocean[1])) >= 3);
      assert.ok(contrastRatio(parseHex(MARKER.cyan), parseHex(paint.ocean[1])) >= 3);
    }
  });
});
