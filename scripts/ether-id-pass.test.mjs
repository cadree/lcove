import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { missingWalletSecrets, matchEtherIdRoute, walletConfigured } from "../supabase/functions/_shared/ether-id-config.mjs";
import { etherIdThumbnailFiles, fetchEtherIdThumbnail } from "../supabase/functions/_shared/ether-id-pass-photo.mjs";
import { etherIdPassJson, memberOfPass, walletStatus } from "../supabase/functions/_shared/ether-id-pass-json.mjs";
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
  const groups = ["primaryFields", "secondaryFields", "auxiliaryFields", "backFields"];
  return groups.flatMap((name) => (pass.generic[name] || []).map((field) => String(field.value)));
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
    assert.equal(pass.generic.secondaryFields.find((field) => field.key === "status").value, "BANNED");
    assert.equal(pass.generic.backFields.find((field) => field.key === "birthday").value, "March 4 · self-reported");
    assert.equal(pass.barcode.message.includes("11111111"), false);
    assert.equal(pass.webServiceURL.endsWith("/ether-id-pass"), true);
  });

  it("omits the birthday when the member has not opted in", () => {
    const pass = etherIdPassJson({ ...card, birthday_label: null, status: "Active" }, meta);
    assert.equal(pass.generic.backFields.some((field) => field.key === "birthday"), false);
    assert.equal(pass.generic.secondaryFields.find((field) => field.key === "status").value, "ACTIVE");
  });

  it("uses the card colors, the name as the headline, and Member Of", () => {
    assert.equal(memberOfPass(null), "LCOVE");
    assert.equal(memberOfPass(""), "LCOVE");
    assert.equal(memberOfPass("   "), "LCOVE");
    assert.equal(memberOfPass("  North Hall  "), "North Hall");

    const pass = etherIdPassJson({ ...card, member_of: "  North Hall  ", city: "Los Angeles" }, meta);
    assert.equal(pass.foregroundColor, "rgb(236, 231, 220)");
    assert.equal(pass.backgroundColor, "rgb(16, 14, 12)");
    assert.equal(pass.labelColor, "rgb(255, 179, 209)");
    assert.equal(pass.logoText, "ETHER");
    assert.equal(pass.generic.primaryFields[0].value, "Maya Torres");
    assert.equal(pass.generic.primaryFields[0].label, "");
    assert.equal(pass.generic.secondaryFields.find((field) => field.key === "member_of").value, "North Hall");
    assert.equal(pass.generic.secondaryFields.find((field) => field.key === "passion").value, "Photography");
    assert.equal(pass.generic.secondaryFields.find((field) => field.key === "username").value, "@maya");
    assert.equal(pass.generic.auxiliaryFields.find((field) => field.key === "city").value, "Los Angeles");
    assert.equal(pass.generic.auxiliaryFields.find((field) => field.key === "reviews").value, "4.5 average · 2 reviews");
    assert.equal(pass.generic.auxiliaryFields.find((field) => field.key === "projects").value, "2 completed");
    assert.equal(pass.passTypeIdentifier, meta.passTypeIdentifier);
    assert.equal(pass.serialNumber, meta.serialNumber);
    assert.equal(pass.authenticationToken, meta.authenticationToken);
    assert.equal(pass.webServiceURL, meta.webServiceURL);
    assert.equal(pass.barcode.message, meta.verifyUrl);
    assert.equal(pass.barcode.altText, "Scan to verify");
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
    assert.equal(pass.generic.primaryFields[0].value, "Cadre Wallace");
    assert.equal(pass.generic.secondaryFields.find((field) => field.key === "member_of").value, "LCOVE");
    assert.equal(pass.generic.secondaryFields.find((field) => field.key === "status").value, "ACTIVE");
    assert.equal(pass.generic.secondaryFields.some((field) => field.key === "username"), false);
    assert.equal(pass.generic.secondaryFields.some((field) => field.key === "passion"), false);
    assert.equal(pass.generic.auxiliaryFields.length, 0);
    assert.equal(pass.generic.backFields.some((field) => field.key === "since"), false);
    assert.equal(pass.generic.backFields.some((field) => field.key === "verify"), true);
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
