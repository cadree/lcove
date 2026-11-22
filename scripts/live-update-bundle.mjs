#!/usr/bin/env node
/**
 * Build the production web assets, zip them for the self-hosted updater,
 * hash the zip, and point public/native-updates/manifest.json at it.
 *
 * Usage:
 *   node scripts/live-update-bundle.mjs
 *   node scripts/live-update-bundle.mjs --skip-build --version 1.0.5-web.2
 *
 * Then commit the new zip and the updated manifest, and deploy the website
 * (not the App Store). Rollback is changing `current` in the manifest to a
 * previous bundle id that is still listed under `bundles`.
 */
import { createHash } from "node:crypto";
import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(root, "dist");
const manifestPath = join(root, "public/native-updates/manifest.json");
const bundlesDir = join(root, "public/native-updates/bundles");
const pbxprojPath = join(root, "ios/App/App.xcodeproj/project.pbxproj");
const PUBLIC_ORIGIN = "https://etherbylcove.com";
const VERSION_RE = /^\d+\.\d+\.\d+-web\.\d+$/;

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function readXcodeValue(key) {
  const text = readFileSync(pbxprojPath, "utf8");
  const match = text.match(new RegExp(`${key} = ([^;]+);`));
  if (!match) throw new Error(`Could not read ${key} from ${pbxprojPath}`);
  return match[1].trim();
}

function loadManifest() {
  if (!existsSync(manifestPath)) {
    return { native: {} };
  }
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

function nextWebVersion(marketingVersion, slot) {
  const prefix = `${marketingVersion}-web.`;
  let highest = 0;
  for (const name of Object.keys(slot?.bundles ?? {})) {
    if (!name.startsWith(prefix)) continue;
    const n = Number(name.slice(prefix.length));
    if (Number.isInteger(n) && n > highest) highest = n;
  }
  return `${prefix}${highest + 1}`;
}

function sha256File(path) {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

function zipDist(outFile) {
  mkdirSync(dirname(outFile), { recursive: true });
  if (existsSync(outFile)) {
    throw new Error(`${outFile} already exists. Pick a new --version or remove the zip.`);
  }
  const index = join(distDir, "index.html");
  if (!existsSync(index)) {
    throw new Error("dist/index.html is missing. Run a production build first.");
  }
  // index.html must sit at the zip root for @capgo/capacitor-updater.
  execFileSync("python3", ["-c", `
import zipfile, os, sys
root, dest = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for dirpath, _, files in os.walk(root):
        for name in files:
            full = os.path.join(dirpath, name)
            zf.write(full, os.path.relpath(full, root))
`, distDir, outFile], { cwd: root });
}

function main() {
  const skipBuild = hasFlag("--skip-build");
  const nativeVersion = arg("--native") || readXcodeValue("CURRENT_PROJECT_VERSION");
  const marketingVersion = readXcodeValue("MARKETING_VERSION");
  const manifest = loadManifest();
  manifest.native ??= {};
  manifest.native[nativeVersion] ??= { current: null, bundles: {} };
  const slot = manifest.native[nativeVersion];
  slot.bundles ??= {};
  const version = arg("--version") || nextWebVersion(marketingVersion, slot);
  if (!VERSION_RE.test(version)) {
    throw new Error(`Version ${version} must look like ${marketingVersion}-web.N`);
  }
  if (slot.bundles[version]) {
    throw new Error(`Bundle ${version} is already in the manifest. Choose a new --version.`);
  }

  if (!skipBuild) {
    execSync("npm run build", { cwd: root, stdio: "inherit" });
  }

  const fileName = `${nativeVersion}-${version}.zip`;
  const outFile = join(bundlesDir, fileName);
  zipDist(outFile);
  const checksum = sha256File(outFile);
  const url = `${PUBLIC_ORIGIN}/native-updates/bundles/${fileName}`;
  slot.bundles[version] = { url, checksum };
  slot.current = version;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`Native ${nativeVersion}`);
  console.log(`Web    ${version}`);
  console.log(`Zip    ${outFile}`);
  console.log(`SHA256 ${checksum}`);
  console.log(`URL    ${url}`);
  console.log("Commit the zip and public/native-updates/manifest.json, then deploy the website.");
  console.log("To roll back later, set native[version_build].current to a previous bundle id in the manifest and deploy the website only.");
}

main();
