/**
 * Builds signed test passes and writes strip.png, pass.json, and a Wallet mockup.
 * Signing uses throwaway openssl certs. Production signing code is not involved.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { etherIdPassJson } from "../supabase/functions/_shared/ether-id-pass-json.mjs";
import { etherIdImages, renderWalletPreview } from "../supabase/functions/_shared/ether-id-strip.mjs";
import { buildPkpass } from "../supabase/functions/_shared/pkpass.mjs";

const outDir = process.argv[2] || "/opt/cursor/artifacts/ether-id";
mkdirSync(outDir, { recursive: true });

const card = {
  display_name: "Maya Torres",
  username: "maya",
  passion: "Photography",
  peer_review_average: 4.5,
  peer_review_count: 2,
  projects_label: "2 completed",
  member_since_label: "October 2026",
  birthday_label: "March 4",
  verify_path: "/id/v/eid1.example.1.sig",
};

const meta = {
  passTypeIdentifier: "pass.com.ether.id",
  serialNumber: "eid_already_on_phone",
  teamIdentifier: "TEAM123456",
  verifyUrl: "https://etherbylcove.com/id/v/eid1.example.1.sig",
  webServiceURL: "https://example.supabase.co/functions/v1/ether-id-pass",
  authenticationToken: "proof-token",
};

const photo = readFileSync(new URL("../public/ether-id/shot-portrait.jpg", import.meta.url));

const dir = mkdtempSync(join(tmpdir(), "ether-id-proof-"));
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-keyout", "wwdr.key", "-out", "wwdr.pem", "-days", "2", "-nodes", "-subj", "/CN=Test WWDR"], { cwd: dir });
execFileSync("openssl", ["req", "-newkey", "rsa:2048", "-keyout", "pass.key", "-out", "pass.csr", "-nodes", "-subj", "/CN=Ether ID"], { cwd: dir });
execFileSync("openssl", ["x509", "-req", "-in", "pass.csr", "-CA", "wwdr.pem", "-CAkey", "wwdr.key", "-CAcreateserial", "-out", "pass.crt", "-days", "2"], { cwd: dir });
const creds = {
  certPem: readFileSync(join(dir, "pass.crt"), "utf8"),
  keyPem: readFileSync(join(dir, "pass.key"), "utf8"),
  wwdrPem: readFileSync(join(dir, "wwdr.pem"), "utf8"),
};

for (const status of ["Active", "Banned"]) {
  const member = { ...card, status };
  const pass = etherIdPassJson(member, meta);
  const images = await etherIdImages(member, { photo });
  const bytes = await buildPkpass(
    [{ name: "pass.json", data: JSON.stringify(pass) }, ...images],
    creds,
  );
  const slug = status.toLowerCase();
  const pkpass = join(outDir, `ether-id-${slug}.pkpass`);
  writeFileSync(pkpass, bytes);
  const unpacked = join(outDir, `pkpass-${slug}`);
  mkdirSync(unpacked, { recursive: true });
  execFileSync("unzip", ["-o", pkpass, "-d", unpacked]);
  const strip = images.find((file) => file.name === "strip@2x.png").data;
  writeFileSync(join(outDir, `pass-${slug}.json`), `${JSON.stringify(pass, null, 2)}\n`);
  writeFileSync(join(outDir, `strip-${slug}@2x.png`), strip);
  writeFileSync(join(outDir, `wallet-${slug}.png`), await renderWalletPreview(member, { strip, verifyUrl: meta.verifyUrl }));
  console.log(slug, JSON.parse(readFileSync(join(unpacked, "pass.json"), "utf8")).storeCard.headerFields[0].value);
}

console.log("proof", outDir);
