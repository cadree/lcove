import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { crc32, deflateSync } from "node:zlib";
import { missingWalletSecrets, matchEtherIdRoute, walletConfigured } from "../supabase/functions/_shared/ether-id-config.mjs";
import { decodeEtherIdPhoto, etherIdThumbnailFiles, fetchEtherIdAvatar, fetchEtherIdThumbnail } from "../supabase/functions/_shared/ether-id-pass-photo.mjs";
import { etherIdStripFiles, etherIdStripTextBoxes, STRIP_FILES, STRIP_PHOTO } from "../supabase/functions/_shared/ether-id-pass-art.mjs";
import { decode as decodePng } from "fast-png";
import { etherIdPassJson, etherIdStripCopy, memberOfPass, sincePass, walletStatus } from "../supabase/functions/_shared/ether-id-pass-json.mjs";
import { buildPkpass, etherIdPassImages, etherMarkPng, solidPng } from "../supabase/functions/_shared/pkpass.mjs";
import jpeg from "jpeg-js";
import { signApnsJwt } from "../supabase/functions/_shared/apns.mjs";

const card = {
  display_name: "Maya Torres",
  username: "maya",
  status: "Banned",
  passion: "Photography",
  peer_review_label: "4.5 average · 2 reviews",
  projects_label: "2 completed",
  member_since_label: "October 2026",
  birthday_label: "March 4",
  verify_path: "/id/v/eid1.example.1.sig",
};

const meta = {
  passTypeIdentifier: "pass.com.ether.id",
  serialNumber: "eid_abc",
  teamIdentifier: "TEAM123456",
  verifyUrl: "https://etherbylcove.com/id/v/eid1.example.1.sig",
  webServiceURL: "https://example.supabase.co/functions/v1/ether-id-pass",
  authenticationToken: "a".repeat(32),
};

function fieldValues(pass) {
  const groups = ["headerFields", "primaryFields", "secondaryFields", "auxiliaryFields", "backFields"];
  return groups.flatMap((name) => (pass.storeCard[name] || []).map((field) => String(field.value)));
}

describe("wallet config", () => {
  it("lists every secret and hides the pass until they are all set", () => {
    const missing = missingWalletSecrets({});
    assert.deepEqual(missing, [
      "APPLE_PASS_TYPE_ID",
      "APPLE_TEAM_ID",
      "APPLE_PASS_CERT_PEM",
      "APPLE_PASS_KEY_PEM",
      "APPLE_WWDR_CERT_PEM",
      "APPLE_APNS_KEY_P8",
      "APPLE_APNS_KEY_ID",
    ]);
    assert.equal(walletConfigured({}), false);
    const env = Object.fromEntries(missing.map((name) => [name, "set"]));
    assert.equal(walletConfigured(env), true);
    assert.equal(walletConfigured({ ...env, APPLE_APNS_KEY_P8: "  " }), false);
  });
});

describe("pass.json", () => {
  it("puts the live status in capitals and keeps the birthday self-reported", () => {
    assert.equal(walletStatus("Banned"), "BANNED");
    assert.equal(walletStatus("Inactive"), "INACTIVE");
    const pass = etherIdPassJson(card, meta);
    assert.equal(pass.storeCard.secondaryFields.find((field) => field.key === "status").value, "BANNED");
    assert.equal(pass.storeCard.backFields.find((field) => field.key === "birthday").value, "March 4 · self-reported");
    assert.equal(pass.barcode.message.includes("11111111"), false);
    assert.equal(pass.webServiceURL.endsWith("/ether-id-pass"), true);
  });

  it("omits the birthday when the member has not opted in", () => {
    const pass = etherIdPassJson({ ...card, birthday_label: null, status: "Active" }, meta);
    assert.equal(pass.storeCard.backFields.some((field) => field.key === "birthday"), false);
    assert.equal(pass.storeCard.secondaryFields.find((field) => field.key === "status").value, "ACTIVE");
  });

  it("uses a store card so the strip can carry the card art", () => {
    assert.equal(memberOfPass(null), "LCOVE");
    assert.equal(memberOfPass(""), "LCOVE");
    assert.equal(memberOfPass("   "), "LCOVE");
    assert.equal(memberOfPass("  North Hall  "), "North Hall");
    assert.equal(sincePass({ member_since_label: "October 2026" }), "OCT 2026");
    assert.equal(sincePass({ member_since: "2026-10-04", member_since_label: "October 2026" }), "OCT 2026");
    assert.equal(sincePass({ member_since_label: "—" }), null);

    const pass = etherIdPassJson({ ...card, member_of: "  North Hall  ", city: "Los Angeles" }, meta);
    assert.equal(pass.generic, undefined);
    assert.equal(pass.logoText, undefined);
    assert.equal(pass.suppressStripShine, true);
    assert.equal(pass.foregroundColor, "rgb(236, 231, 220)");
    assert.equal(pass.backgroundColor, "rgb(16, 14, 12)");
    assert.equal(pass.labelColor, "rgb(255, 179, 209)");
    assert.equal(pass.storeCard.primaryFields, undefined);
    assert.deepEqual(pass.storeCard.secondaryFields.map((field) => field.key), ["member_of", "since", "status", "city"]);
    assert.equal(pass.storeCard.secondaryFields.find((field) => field.key === "member_of").value, "NORTH HALL");
    assert.equal(pass.storeCard.secondaryFields.find((field) => field.key === "since").value, "OCT 2026");
    assert.equal(pass.storeCard.secondaryFields.find((field) => field.key === "city").value, "LOS ANGELES");
    assert.equal(pass.storeCard.auxiliaryFields, undefined);
    assert.equal(pass.storeCard.backFields.find((field) => field.key === "reviews").value, "4.5 average · 2 reviews");
    assert.equal(pass.storeCard.backFields.find((field) => field.key === "projects").value, "2 completed");
    assert.equal(pass.passTypeIdentifier, meta.passTypeIdentifier);
    assert.equal(pass.serialNumber, meta.serialNumber);
    assert.equal(pass.authenticationToken, meta.authenticationToken);
    assert.equal(pass.webServiceURL, meta.webServiceURL);
    assert.equal(pass.barcode.format, "PKBarcodeFormatQR");
    assert.equal(pass.barcode.message, meta.verifyUrl);
    assert.equal(pass.barcode.altText, "Scan to verify");
    const copy = etherIdStripCopy({ ...card, member_of: "North Hall", city: "Los Angeles" });
    assert.deepEqual(copy.nameLines, ["TORRES,", "MAYA"]);
    assert.equal("handle" in copy, false);
    assert.equal(copy.chip, "PHOTOGRAPHY");
    assert.equal(copy.kicker, "— PHOTOGRAPHY · LOS ANGELES");
    assert.equal(copy.initials, "MT");
  });

  it("prints LCOVE when Member Of is empty and drops placeholder fields", () => {
    const pass = etherIdPassJson({
      display_name: "Cadre Wallace",
      username: "",
      status: "Active",
      passion: "   ",
      peer_review_label: "No peer reviews",
      peer_review_count: 0,
      projects_label: "0 completed",
      projects_completed: 0,
      member_since_label: "—",
      birthday_label: null,
      member_of: null,
      city: "—",
    }, meta);
    const values = fieldValues(pass);
    const copy = etherIdStripCopy({
      display_name: "Cadre Wallace",
      username: "",
      passion: "   ",
      city: "—",
    });
    assert.deepEqual(copy.nameLines, ["WALLACE,", "CADRE"]);
    assert.equal("handle" in copy, false);
    assert.equal(copy.chip, null);
    assert.equal(copy.kicker, null);
    assert.equal(copy.initials, "CW");
    assert.equal(pass.storeCard.secondaryFields.find((field) => field.key === "member_of").value, "LCOVE");
    assert.equal(pass.storeCard.secondaryFields.find((field) => field.key === "status").value, "ACTIVE");
    assert.equal(pass.storeCard.secondaryFields.some((field) => field.key === "username"), false);
    assert.equal(pass.storeCard.secondaryFields.some((field) => field.key === "passion"), false);
    assert.equal(pass.storeCard.secondaryFields.some((field) => field.key === "since"), false);
    assert.equal(pass.storeCard.secondaryFields.some((field) => field.key === "city"), false);
    assert.equal(pass.storeCard.backFields.some((field) => field.key === "since"), false);
    assert.equal(pass.storeCard.backFields.some((field) => field.key === "reviews"), false);
    assert.equal(pass.storeCard.backFields.some((field) => field.key === "projects"), false);
    assert.equal(pass.storeCard.backFields.some((field) => field.key === "verify"), true);
    for (const value of values) {
      assert.equal(/no username/i.test(value), false);
      assert.equal(/no peer reviews/i.test(value), false);
      assert.equal(/^0 completed$/i.test(value), false);
      assert.equal(value === "—", false);
    }
  });
});

describe("pass routes", () => {
  it("matches the PassKit web service paths", () => {
    const base = "/functions/v1/ether-id-pass";
    assert.equal(matchEtherIdRoute(`${base}/v1/devices/dev/registrations/pass.com.ether.id/eid_1`, "POST").kind, "register");
    assert.equal(matchEtherIdRoute(`${base}/v1/devices/dev/registrations/pass.com.ether.id`, "GET").kind, "list");
    assert.equal(matchEtherIdRoute(`${base}/v1/passes/pass.com.ether.id/eid_1`, "GET").kind, "latest");
    assert.equal(matchEtherIdRoute(`${base}/v1/log`, "POST").kind, "log");
    assert.equal(matchEtherIdRoute(`${base}/push`, "POST").kind, "push");
    assert.equal(matchEtherIdRoute(base, "POST").kind, "app");
  });
});

describe("ether id images", () => {
  it("draws a cream and red mark instead of the pink bar", () => {
    const icon = Buffer.from(etherMarkPng(29, 29));
    assert.equal(icon[0], 137);
    assert.equal(icon[1], 80);
    assert.equal(icon.includes(Buffer.from([236, 231, 220])), true);
    assert.equal(icon.includes(Buffer.from([196, 20, 45])), true);
    assert.equal(icon.includes(Buffer.from([245, 166, 207])), false);
    const names = etherIdPassImages().map((file) => file.name);
    assert.deepEqual(names, ["icon.png", "icon@2x.png", "icon@3x.png"]);
  });
});

describe("pass thumbnail", () => {
  const heic = Uint8Array.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
    0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00,
    0x6d, 0x69, 0x66, 0x31, 0x68, 0x65, 0x69, 0x63,
  ]);

  it("omits the thumbnail when the photo is missing, unreadable, or HEIC", async () => {
    let called = false;
    const fetchImpl = () => {
      called = true;
      throw new Error("should not fetch");
    };
    assert.deepEqual(await fetchEtherIdThumbnail(null, { fetchImpl }), []);
    assert.deepEqual(await fetchEtherIdThumbnail("  ", { fetchImpl }), []);
    assert.deepEqual(await fetchEtherIdThumbnail("http://example.com/a.jpg", { fetchImpl }), []);
    assert.deepEqual(await fetchEtherIdThumbnail("https://127.0.0.1/a.jpg", { fetchImpl }), []);
    assert.equal(called, false);
    assert.deepEqual(await etherIdThumbnailFiles(heic), []);
    assert.deepEqual(await etherIdThumbnailFiles(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])), []);
    assert.deepEqual(await etherIdThumbnailFiles(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])), []);
    assert.deepEqual(await fetchEtherIdThumbnail("https://cdn.example.com/a.jpg", {
      fetchImpl: async () => {
        throw new Error("down");
      },
    }), []);
    assert.deepEqual(await fetchEtherIdThumbnail("https://cdn.example.com/a.heic", {
      fetchImpl: async () => ({
        ok: true,
        headers: { get: () => null },
        arrayBuffer: async () => heic.buffer,
      }),
    }), []);
    assert.deepEqual(await fetchEtherIdThumbnail("https://cdn.example.com/a.jpg", {
      timeoutMs: 20,
      fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      }),
    }), []);
  });

  it("turns a decoded jpeg or png into pass thumbnail pngs", async () => {
    const png = await etherIdThumbnailFiles(solidPng(6, 10));
    assert.deepEqual(png.map((file) => file.name), ["thumbnail.png", "thumbnail@2x.png", "thumbnail@3x.png"]);
    assert.equal(png[0].data[0], 137);
    assert.equal(png[0].data[1], 80);
    const raw = new Uint8Array(4 * 4 * 4);
    for (let i = 0; i < raw.length; i += 4) {
      raw[i] = 20;
      raw[i + 1] = 30;
      raw[i + 2] = 40;
      raw[i + 3] = 255;
    }
    const encoded = jpeg.encode({ data: raw, width: 4, height: 4 }, 80).data;
    const fromJpeg = await etherIdThumbnailFiles(encoded);
    assert.equal(fromJpeg.length, 3);
    assert.equal(fromJpeg[0].data[0], 137);
  });
});

function pngPixel(image, x, y) {
  const i = (Math.round(y) * image.width + Math.round(x)) * image.channels;
  return [image.data[i], image.data[i + 1], image.data[i + 2]];
}

function hasPixel(image, match) {
  const { data, width, height, channels } = image;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * channels;
      if (match(data[i], data[i + 1], data[i + 2])) return true;
    }
  }
  return false;
}

function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, sum]);
}

/** RGB PNG built in the test. No fixture file is committed. */
function pngFile(width, height, rgb) {
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x += 1) {
    row[1 + x * 3] = rgb[0];
    row[2 + x * 3] = rgb[1];
    row[3 + x * 3] = rgb[2];
  }
  const raw = Buffer.alloc(row.length * height);
  for (let y = 0; y < height; y += 1) row.copy(raw, y * row.length);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 0 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngSizeHeader(width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
  ]);
}

/** Baseline JPEG with comment segments so the file is large but the image is not. */
function jpegWithComments(jpegBytes, extra) {
  const parts = [Buffer.from([0xff, 0xd8])];
  let left = extra;
  while (left > 0) {
    // jpeg-js turns each comment into a string via apply, which rejects a 64 KB segment.
    const payload = Math.min(left, 8000);
    const segment = Buffer.alloc(4 + payload);
    segment[0] = 0xff;
    segment[1] = 0xfe;
    segment.writeUInt16BE(payload + 2, 2);
    parts.push(segment);
    left -= payload;
  }
  parts.push(Buffer.from(jpegBytes.subarray(2)));
  return Buffer.concat(parts);
}

describe("ether id strip", () => {
  const cadre = {
    display_name: "Cadre Wallace",
    username: "cadre",
    passion: "creative directing",
    city: "Charlotte, NC",
  };

  it("draws photo, serif name, and the red mark, and falls back to initials", async () => {
    const raw = new Uint8Array(8 * 8 * 4);
    for (let i = 0; i < raw.length; i += 4) {
      raw[i] = 20;
      raw[i + 1] = 40;
      raw[i + 2] = 220;
      raw[i + 3] = 255;
    }
    const jpegBytes = jpeg.encode({ data: raw, width: 8, height: 8 }, 90).data;
    const withPhoto = await etherIdStripFiles(cadre, jpegBytes);
    assert.deepEqual(withPhoto.map((file) => file.name), STRIP_FILES.map((file) => file.name));
    const image = decodePng(withPhoto[2].data);
    assert.equal(image.width, 1125);
    assert.equal(image.height, 432);
    assert.equal(withPhoto[2].data[0], 137);
    assert.equal(withPhoto[2].data[1], 80);
    assert.deepEqual(pngPixel(image, 2, 2), [16, 14, 12]);
    assert.equal(decodePng(withPhoto[0].data).width, 375);
    assert.equal(decodePng(withPhoto[0].data).height, 144);
    assert.equal(decodePng(withPhoto[1].data).width, 750);
    assert.equal(decodePng(withPhoto[1].data).height, 288);
    const cx = (STRIP_PHOTO.x + STRIP_PHOTO.w / 2) * 3;
    const cy = (STRIP_PHOTO.y + STRIP_PHOTO.h / 2) * 3;
    const mid = pngPixel(image, cx, cy);
    assert.equal(mid[2] > 150 && mid[0] < 90, true);
    assert.equal(hasPixel(image, (r, g, b) => r > 160 && g < 90 && b < 100), true);
    assert.equal(hasPixel(image, (r, g, b) => r > 210 && g > 200 && b > 180), true);

    const heic = Uint8Array.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
      0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00,
    ]);
    const plain = decodePng((await etherIdStripFiles(cadre, heic))[2].data);
    const plate = pngPixel(plain, (STRIP_PHOTO.x + 8) * 3, (STRIP_PHOTO.y + 8) * 3);
    assert.equal(plate[2] < 40, true);
    assert.equal(hasPixel(plain, (r, g, b) => r > 210 && g > 200 && b > 180), true);
    const missing = decodePng((await etherIdStripFiles(cadre, null))[2].data);
    assert.equal(pngPixel(missing, (STRIP_PHOTO.x + 8) * 3, (STRIP_PHOTO.y + 8) * 3)[2] < 40, true);
  });

  it("draws a photo from a multi-megabyte screenshot and drops an image past the pixel cap", async () => {
    const png = pngFile(1179, 2556, [20, 40, 220]);
    assert.ok(png.length > 3_485_896);
    assert.ok(png.length <= 10 * 1024 * 1024);

    const fetched = await fetchEtherIdAvatar("https://cdn.example.com/avatar.png", {
      fetchImpl: async () => ({
        ok: true,
        headers: { get: (name) => (name === "content-length" ? String(png.length) : null) },
        arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
      }),
    });
    assert.equal(fetched?.byteLength, png.length);

    const cx = (STRIP_PHOTO.x + STRIP_PHOTO.w / 2) * 3;
    const cy = (STRIP_PHOTO.y + STRIP_PHOTO.h / 2) * 3;
    const withPhoto = decodePng((await etherIdStripFiles(cadre, fetched))[2].data);
    const mid = pngPixel(withPhoto, cx, cy);
    assert.equal(mid[2] > 150 && mid[0] < 90, true);

    const raw = new Uint8Array(8 * 8 * 4);
    for (let i = 0; i < raw.length; i += 4) {
      raw[i] = 20;
      raw[i + 1] = 40;
      raw[i + 2] = 220;
      raw[i + 3] = 255;
    }
    const jpegBytes = jpegWithComments(jpeg.encode({ data: raw, width: 8, height: 8 }, 90).data, 3_200_000);
    assert.ok(jpegBytes.length > 3_000_000);
    assert.ok(jpegBytes.length <= 10 * 1024 * 1024);
    const jpegPhoto = await decodeEtherIdPhoto(jpegBytes);
    assert.equal(jpegPhoto?.width, 8);
    assert.equal(jpegPhoto?.height, 8);

    const tooManyPixels = pngSizeHeader(2500, 2000);
    assert.equal(2500 * 2000 > 4_000_000, true);
    const plain = decodePng((await etherIdStripFiles(cadre, tooManyPixels))[2].data);
    assert.equal(pngPixel(plain, (STRIP_PHOTO.x + 8) * 3, (STRIP_PHOTO.y + 8) * 3)[2] < 40, true);

    const overBytes = Buffer.concat([png.subarray(0, 32), Buffer.alloc((10 * 1024 * 1024) - 31)]);
    assert.ok(overBytes.length > 10 * 1024 * 1024);
    assert.equal(await decodeEtherIdPhoto(overBytes), null);
    assert.deepEqual(await fetchEtherIdThumbnail("https://cdn.example.com/huge.png", {
      fetchImpl: async () => ({
        ok: true,
        headers: { get: () => String(10 * 1024 * 1024 + 1) },
        arrayBuffer: async () => {
          throw new Error("should not read a body over the byte cap");
        },
      }),
    }), []);
  });

  it("keeps the subtitle off the name for one line, two lines, and a long city", async () => {
    const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const cards = [
      {
        display_name: "Prince",
        username: "prince",
        passion: "music",
        city: "Minneapolis",
        lines: 1,
      },
      {
        display_name: "App Review",
        username: "appreview",
        passion: "content creation",
        city: "Charlotte, NC",
        lines: 2,
      },
      {
        display_name: "Christopher Alexander-Montgomery",
        username: "christopher",
        passion: "editorial photography and film",
        city: "Los Angeles, California",
        lines: 2,
      },
    ];
    for (const card of cards) {
      const boxes = await etherIdStripTextBoxes(card);
      assert.equal(boxes.names.length, card.lines);
      assert.ok(boxes.kicker);
      for (const name of boxes.names) assert.equal(overlaps(boxes.kicker, name), false);
      assert.equal(boxes.kicker.bottom < boxes.names[0].top, true);
      if (card.lines === 2) assert.equal(boxes.names[0].bottom < boxes.names[1].top, true);
      assert.ok(boxes.chip);
      const inkMid = (boxes.chip.ink.top + boxes.chip.ink.bottom) / 2;
      const boxMid = (boxes.chip.box.top + boxes.chip.box.bottom) / 2;
      assert.ok(Math.abs(inkMid - boxMid) < 0.5);
      assert.equal(boxes.chip.box.bottom <= 144 * 6, true);
      assert.equal(boxes.names[boxes.names.length - 1].bottom < boxes.chip.box.top, true);
    }
  });
});

describe("signed pkpass", () => {
  it("builds a zip whose signature verifies against the test pass certificate", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ether-id-pass-"));
    try {
      execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-keyout", "wwdr.key", "-out", "wwdr.pem", "-days", "2", "-nodes", "-subj", "/CN=Test WWDR"], { cwd: dir });
      execFileSync("openssl", ["req", "-newkey", "rsa:2048", "-keyout", "pass.key", "-out", "pass.csr", "-nodes", "-subj", "/CN=Ether ID"], { cwd: dir });
      execFileSync("openssl", ["x509", "-req", "-in", "pass.csr", "-CA", "wwdr.pem", "-CAkey", "wwdr.key", "-CAcreateserial", "-out", "pass.crt", "-days", "2"], { cwd: dir });
      const pass = etherIdPassJson({ ...card, status: "Inactive" }, meta);
      const bytes = await buildPkpass(
        [
          { name: "pass.json", data: JSON.stringify(pass) },
          { name: "icon.png", data: solidPng(29, 29) },
        ],
        {
          certPem: readFileSync(join(dir, "pass.crt"), "utf8"),
          keyPem: readFileSync(join(dir, "pass.key"), "utf8"),
          wwdrPem: readFileSync(join(dir, "wwdr.pem"), "utf8"),
        },
      );
      writeFileSync(join(dir, "ether-id.pkpass"), bytes);
      execFileSync("unzip", ["-t", "ether-id.pkpass"], { cwd: dir });
      execFileSync("unzip", ["-o", "ether-id.pkpass", "-d", "unpacked"], { cwd: dir });
      const icon = readFileSync(join(dir, "unpacked/icon.png"));
      assert.equal(icon[0], 137);
      assert.equal(icon[1], 80);
      const verified = execFileSync("openssl", [
        "cms", "-verify", "-binary", "-inform", "DER",
        "-in", "unpacked/signature",
        "-content", "unpacked/manifest.json",
        "-CAfile", "wwdr.pem",
        "-purpose", "any",
      ], { cwd: dir });
      assert.ok(verified.length > 0);
      const manifest = JSON.parse(readFileSync(join(dir, "unpacked/manifest.json"), "utf8"));
      assert.equal(typeof manifest["pass.json"], "string");
      assert.equal(manifest.signature, undefined);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("apns jwt", () => {
  it("signs an ES256 token a verifier accepts", async () => {
    const { generateKeyPairSync, createPrivateKey, verify } = await import("node:crypto");
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const jwt = await signApnsJwt({ p8: pem, keyId: "KEYID12345", teamId: "TEAM123456", nowSeconds: 1_700_000_000 });
    const [header, payload, signature] = jwt.split(".");
    const headerJson = JSON.parse(Buffer.from(header, "base64url").toString());
    const payloadJson = JSON.parse(Buffer.from(payload, "base64url").toString());
    assert.equal(headerJson.alg, "ES256");
    assert.equal(headerJson.kid, "KEYID12345");
    assert.equal(payloadJson.iss, "TEAM123456");
    assert.equal(payloadJson.iat, 1_700_000_000);
    const key = createPrivateKey(pem);
    const ok = verify(
      "sha256",
      Buffer.from(`${header}.${payload}`),
      { key, dsaEncoding: "ieee-p1363" },
      Buffer.from(signature, "base64url"),
    );
    assert.equal(ok, true);
  });
});
