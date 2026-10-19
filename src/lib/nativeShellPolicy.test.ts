import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  CAPACITOR_DOCUMENT_URLS,
  NATIVE_SPLASH_BACKSTOP_MS,
  NATIVE_SPLASH_RETRY_MS,
  allowsWebServiceWorker,
  baseHrefFromHtml,
  bundledPathname,
  isBundledModuleHref,
  isRelativeBundleHref,
  localAssetRefs,
  resolveBundledUrl,
} from "./nativeShellPolicy.ts";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

describe("native splash", () => {
  it("hides on boot and again on a timer that does not follow a request", () => {
    assert.ok(NATIVE_SPLASH_RETRY_MS.length >= 1);
    assert.ok(NATIVE_SPLASH_RETRY_MS.every((delay) => delay > 0 && delay < NATIVE_SPLASH_BACKSTOP_MS));

    const config = fs.readFileSync(path.join(repoRoot, "capacitor.config.ts"), "utf8");
    const boot = fs.readFileSync(path.join(repoRoot, "src/lib/nativeShell.ts"), "utf8");
    assert.match(config, /launchAutoHide:\s*true/);
    assert.match(config, /NATIVE_SPLASH_BACKSTOP_MS/);
    assert.match(boot, /SplashScreen\.hide/);
    assert.match(boot, /NATIVE_SPLASH_RETRY_MS/);
    assert.doesNotMatch(boot, /supabase|getSession|fetch\(/);
  });
});

describe("service worker", () => {
  it("is not registered in the native shell", () => {
    assert.equal(allowsWebServiceWorker(true), false);
    assert.equal(allowsWebServiceWorker(false), true);
  });
});

describe("capacitor asset URLs", () => {
  const moduleHref = "./assets/index-abc.js";

  it("resolves relative bundle URLs on the capacitor://localhost documents", () => {
    for (const documentUrl of CAPACITOR_DOCUMENT_URLS) {
      assert.equal(bundledPathname(documentUrl, moduleHref, "/"), "/assets/index-abc.js");
      assert.equal(
        resolveBundledUrl(documentUrl, moduleHref, "/").href,
        "capacitor://localhost/assets/index-abc.js",
      );
    }
  });

  it("keeps a nested web refresh on the origin root", () => {
    const page = "https://etherbylcove.com/dashboard/events/123";
    assert.equal(resolveBundledUrl(page, moduleHref, "/").pathname, "/assets/index-abc.js");
    assert.equal(resolveBundledUrl(page, moduleHref, "./").pathname, "/dashboard/events/assets/index-abc.js");
  });
});

describe("built index.html", () => {
  const distIndex = path.join(repoRoot, "dist/index.html");
  const built = fs.existsSync(distIndex);

  it("resolves under capacitor://localhost when dist is present", { skip: !built }, () => {
    const html = fs.readFileSync(distIndex, "utf8");
    assert.equal(baseHrefFromHtml(html), "/");
    assert.equal(/crossorigin/i.test(html), false);
    assert.equal(html.includes("serviceWorker.register"), false);
    assert.equal(html.includes("sw.js"), false);

    const refs = localAssetRefs(html);
    assert.ok(refs.some((ref) => ref.tag === "script"));

    for (const ref of refs) {
      if (isBundledModuleHref(ref)) {
        assert.equal(isRelativeBundleHref(ref.href), true, ref.href);
      }
      for (const documentUrl of CAPACITOR_DOCUMENT_URLS) {
        const pathname = bundledPathname(documentUrl, ref.href, "/");
        const file = path.join(repoRoot, "dist", pathname);
        assert.equal(fs.existsSync(file), true, `${ref.href} -> ${file}`);
      }
    }
  });
});
