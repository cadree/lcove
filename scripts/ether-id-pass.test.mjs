import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { missingWalletSecrets, matchEtherIdRoute, walletConfigured } from "../supabase/functions/_shared/ether-id-config.mjs";
import { etherIdPassJson, personnelName, walletReviewValue, walletStatus } from "../supabase/functions/_shared/ether-id-pass-json.mjs";
import { buildPkpass, solidPng } from "../supabase/functions/_shared/pkpass.mjs";
import { etherIdImages } from "../supabase/functions/_shared/ether-id-strip.mjs";
import { signApnsJwt } from "../supabase/functions/_shared/apns.mjs";

const card = {
  display_name: "Maya Torres",
  username: "maya",
  status: "Banned",
  passion: "Photography",
  peer_review_average: 4.5,
  peer_review_count: 2,
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
    assert.equal(personnelName("Maya Torres"), "TORRES, MAYA");
    assert.equal(walletReviewValue(card), "4.5 · 2");
    const pass = etherIdPassJson(card, meta);
    assert.equal(pass.storeCard.headerFields.find((field) => field.key === "status").value, "BANNED");
    assert.equal(pass.storeCard.primaryFields[0].value, "TORRES, MAYA");
    assert.equal(pass.storeCard.backFields.find((field) => field.key === "birthday").value, "March 4 · self-reported");
    assert.equal(pass.barcode.message.includes("11111111"), false);
    assert.equal(pass.webServiceURL.endsWith("/ether-id-pass"), true);
    assert.equal(pass.labelColor, "rgb(255, 61, 73)");
    assert.equal(pass.generic, undefined);
  });

  it("omits the birthday when the member has not opted in", () => {
    const pass = etherIdPassJson({ ...card, birthday_label: null, status: "Active" }, meta);
    assert.equal(pass.storeCard.backFields.some((field) => field.key === "birthday"), false);
    assert.equal(pass.storeCard.auxiliaryFields.some((field) => field.key === "birthday"), false);
    assert.equal(pass.storeCard.headerFields.find((field) => field.key === "status").value, "ACTIVE");
    assert.equal(pass.backgroundColor, "rgb(8, 8, 10)");
    assert.equal(pass.foregroundColor, "rgb(236, 231, 220)");
    assert.equal(pass.labelColor, "rgb(255, 159, 200)");
  });

  it("keeps an existing serial and pass type when the style is a store card", () => {
    const pass = etherIdPassJson(card, { ...meta, serialNumber: "eid_already_on_phone", passTypeIdentifier: "pass.com.ether.id" });
    assert.equal(pass.serialNumber, "eid_already_on_phone");
    assert.equal(pass.passTypeIdentifier, "pass.com.ether.id");
    assert.equal(pass.storeCard.headerFields.length > 0, true);
    assert.equal("generic" in pass, false);
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

  it("signs a store card whose pass.json and strips come out of the pkpass", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ether-id-strip-pass-"));
    try {
      execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-keyout", "wwdr.key", "-out", "wwdr.pem", "-days", "2", "-nodes", "-subj", "/CN=Test WWDR"], { cwd: dir });
      execFileSync("openssl", ["req", "-newkey", "rsa:2048", "-keyout", "pass.key", "-out", "pass.csr", "-nodes", "-subj", "/CN=Ether ID"], { cwd: dir });
      execFileSync("openssl", ["x509", "-req", "-in", "pass.csr", "-CA", "wwdr.pem", "-CAkey", "wwdr.key", "-CAcreateserial", "-out", "pass.crt", "-days", "2"], { cwd: dir });
      const active = { ...card, status: "Active", birthday_label: null };
      const pass = etherIdPassJson(active, { ...meta, serialNumber: "eid_already_on_phone" });
      const images = await etherIdImages(active);
      const bytes = await buildPkpass(
        [
          { name: "pass.json", data: JSON.stringify(pass) },
          ...images,
        ],
        {
          certPem: readFileSync(join(dir, "pass.crt"), "utf8"),
          keyPem: readFileSync(join(dir, "pass.key"), "utf8"),
          wwdrPem: readFileSync(join(dir, "wwdr.pem"), "utf8"),
        },
      );
      writeFileSync(join(dir, "ether-id.pkpass"), bytes);
      execFileSync("unzip", ["-o", "ether-id.pkpass", "-d", "unpacked"], { cwd: dir });
      const packed = JSON.parse(readFileSync(join(dir, "unpacked/pass.json"), "utf8"));
      assert.equal(packed.serialNumber, "eid_already_on_phone");
      assert.equal(packed.storeCard.primaryFields[0].value, "TORRES, MAYA");
      assert.equal(packed.generic, undefined);
      const strip = readFileSync(join(dir, "unpacked/strip@2x.png"));
      assert.equal(strip[0], 137);
      const width = strip.readUInt32BE(16);
      const height = strip.readUInt32BE(20);
      assert.deepEqual([width, height], [750, 246]);
      assert.equal(readFileSync(join(dir, "unpacked/strip@3x.png")).readUInt32BE(16), 1125);
      const strip1 = readFileSync(join(dir, "unpacked/strip.png"));
      assert.equal(strip1.readUInt32BE(16), 375);
      assert.equal(strip1.readUInt32BE(20), 123);
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
