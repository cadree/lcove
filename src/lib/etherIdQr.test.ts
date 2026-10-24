import assert from "node:assert/strict";
import { describe, it } from "node:test";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { etherIdQr, verifyUrl } from "./etherId.ts";

describe("ether id qr", () => {
  it("scans back to the verify url", () => {
    const href = verifyUrl("https://etherbylcove.com/", "/id/v/eid1.abc.1.sig");
    const spec = etherIdQr(href);
    assert.equal(spec.value, href);
    assert.equal(spec.level, "M");
    assert.ok(spec.size >= 96);
    assert.ok(spec.marginSize >= 2);

    const qr = QRCode.create(spec.value, { errorCorrectionLevel: spec.level });
    const scale = 4;
    const quiet = spec.marginSize;
    const size = (qr.modules.size + quiet * 2) * scale;
    const data = new Uint8ClampedArray(size * size * 4);
    data.fill(255);
    for (let y = 0; y < qr.modules.size; y += 1) {
      for (let x = 0; x < qr.modules.size; x += 1) {
        if (!qr.modules.get(x, y)) continue;
        for (let py = 0; py < scale; py += 1) {
          for (let px = 0; px < scale; px += 1) {
            const sx = (x + quiet) * scale + px;
            const sy = (y + quiet) * scale + py;
            const i = (sy * size + sx) * 4;
            data[i] = 8;
            data[i + 1] = 8;
            data[i + 2] = 10;
          }
        }
      }
    }
    const code = jsQR(data, size, size);
    assert.equal(code?.data, href);
  });
});
