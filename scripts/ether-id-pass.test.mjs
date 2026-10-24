import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { missingWalletSecrets, matchEtherIdRoute, walletConfigured } from "../supabase/functions/_shared/ether-id-config.mjs";
import { etherIdPassJson, walletStatus } from "../supabase/functions/_shared/ether-id-pass-json.mjs";
import { buildPkpass, solidPng } from "../supabase/functions/_shared/pkpass.mjs";
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
    const pass = etherIdPassJson(card, {
      passTypeIdentifier: "pass.com.ether.id",
      serialNumber: "eid_abc",
      teamIdentifier: "TEAM123456",
      verifyUrl: "https://etherbylcove.com/id/v/eid1.example.1.sig",
      webServiceURL: "https://example.supabase.co/functions/v1/ether-id-pass",
      authenticationToken: "a".repeat(32),
    });
    assert.equal(pass.generic.secondaryFields.find((field) => field.key === "status").value, "BANNED");
    assert.equal(pass.generic.backFields.find((field) => field.key === "birthday").value, "March 4 · self-reported");
    assert.equal(pass.barcode.message.includes("11111111"), false);
    assert.equal(pass.webServiceURL.endsWith("/ether-id-pass"), true);
  });

  it("omits the birthday when the member has not opted in", () => {
    const pass = etherIdPassJson({ ...card, birthday_label: null, status: "Active" }, {
      passTypeIdentifier: "pass.com.ether.id",
      serialNumber: "eid_abc",
      teamIdentifier: "TEAM123456",
      verifyUrl: "https://etherbylcove.com/id/v/eid1.example.1.sig",
      webServiceURL: "https://example.supabase.co/functions/v1/ether-id-pass",
      authenticationToken: "a".repeat(32),
    });
    assert.equal(pass.generic.backFields.some((field) => field.key === "birthday"), false);
    assert.equal(pass.generic.secondaryFields.find((field) => field.key === "status").value, "ACTIVE");
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
      const pass = etherIdPassJson({ ...card, status: "Inactive" }, {
        passTypeIdentifier: "pass.com.ether.id",
        serialNumber: "eid_abc",
        teamIdentifier: "TEAM123456",
        verifyUrl: "https://etherbylcove.com/id/v/eid1.example.1.sig",
        webServiceURL: "https://example.supabase.co/functions/v1/ether-id-pass",
        authenticationToken: "a".repeat(32),
      });
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
