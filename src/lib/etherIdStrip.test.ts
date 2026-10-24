import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countAlertPixels, decodePng, etherIdImages, renderEtherStrip } from "../../supabase/functions/_shared/ether-id-strip.mjs";

const card = {
  display_name: "Maya Torres",
  username: "maya",
  status: "Active",
  passion: "Photography",
  peer_review_average: 4.5,
  peer_review_count: 2,
  projects_label: "2 completed",
  member_since_label: "October 2026",
};

function pngSize(bytes: Uint8Array) {
  return [
    (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19],
    (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23],
  ];
}

describe("ether id strip", () => {
  it("renders 375 by 123 point strips and a louder ban", async () => {
    const active = await renderEtherStrip(card, { scale: 1 });
    const banned = await renderEtherStrip({ ...card, status: "Banned" }, { scale: 1 });
    assert.deepEqual(pngSize(active), [375, 123]);
    assert.deepEqual(pngSize(banned), [375, 123]);
    assert.equal(active[0], 137);
    const activeImage = await decodePng(active);
    const bannedImage = await decodePng(banned);
    assert.ok(countAlertPixels(bannedImage) > countAlertPixels(activeImage) * 5);

    let colored = 0;
    let letters = 0;
    for (let y = 86; y < 118; y += 2) {
      for (let x = 46; x < 76; x += 2) {
        const color = activeImage.getPixelAt(x, y) >>> 0;
        const r = (color >>> 24) & 255;
        const g = (color >>> 16) & 255;
        if (r > 90 && g > 40 && g < 190) colored += 1;
      }
    }
    for (let y = 16; y < 78; y += 2) {
      for (let x = 36; x < 82; x += 2) {
        const color = activeImage.getPixelAt(x, y) >>> 0;
        const r = (color >>> 24) & 255;
        const g = (color >>> 16) & 255;
        const b = (color >>> 8) & 255;
        if (r > 180 && g > 170 && b > 150) letters += 1;
      }
    }
    assert.ok(colored > 8);
    assert.ok(letters > 12);

    const images = await etherIdImages({ ...card, status: "Banned" });
    const names = images.map((file: { name: string }) => file.name);
    assert.ok(names.includes("strip.png"));
    assert.ok(names.includes("strip@2x.png"));
    assert.ok(names.includes("strip@3x.png"));
    assert.ok(names.includes("logo.png"));
    assert.ok(names.includes("icon@3x.png"));
    const strip3 = images.find((file: { name: string }) => file.name === "strip@3x.png");
    assert.deepEqual(pngSize(strip3.data), [1125, 369]);
    const strip2 = images.find((file: { name: string }) => file.name === "strip@2x.png");
    assert.deepEqual(pngSize(strip2.data), [750, 246]);
  });
});
