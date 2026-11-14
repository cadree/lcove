import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  PRODUCTION_SUPABASE_REF,
  authStorageKeys,
  decidePreviewSupabaseTarget,
  formatPreviewTargetError,
  supabaseProjectRef,
} from "./supabaseTarget.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const checkScript = path.join(root, "scripts/check-supabase-target.mjs");
const PROD_URL = `https://${PRODUCTION_SUPABASE_REF}.supabase.co`;
const STAGING_REF = "bbbbbbbbbbbbbbbbbbbb";
const STAGING_URL = `https://${STAGING_REF}.supabase.co`;
const SECRET_KEY = "sb_publishable_test_do_not_print";

function previewEnv(overrides: Record<string, string> = {}) {
  return {
    CF_PAGES: "1",
    CF_PAGES_BRANCH: "cursor/ether-integration-oct21",
    VITE_SUPABASE_URL: STAGING_URL,
    VITE_SUPABASE_PROJECT_ID: STAGING_REF,
    VITE_SUPABASE_PUBLISHABLE_KEY: SECRET_KEY,
    ...overrides,
  };
}

describe("supabase project ref", () => {
  it("reads the ref from the project id or the URL", () => {
    assert.deepEqual(supabaseProjectRef(PROD_URL, ""), {
      ref: PRODUCTION_SUPABASE_REF,
      conflict: false,
      fromId: "",
      fromUrl: PRODUCTION_SUPABASE_REF,
    });
    assert.equal(supabaseProjectRef("", STAGING_REF).ref, STAGING_REF);
    assert.equal(supabaseProjectRef(` ${STAGING_URL}/ `, ` ${STAGING_REF} `).ref, STAGING_REF);
  });

  it("reports a conflict when the URL and project id disagree", () => {
    const parsed = supabaseProjectRef(PROD_URL, STAGING_REF);
    assert.equal(parsed.conflict, true);
    assert.equal(parsed.ref, null);
  });
});

describe("preview supabase target", () => {
  it("allows ether-prod outside Cloudflare and on the production branch", () => {
    const local = decidePreviewSupabaseTarget({
      VITE_SUPABASE_URL: PROD_URL,
      VITE_SUPABASE_PROJECT_ID: PRODUCTION_SUPABASE_REF,
      VITE_SUPABASE_PUBLISHABLE_KEY: SECRET_KEY,
    });
    assert.equal(local.action, "allow");
    assert.equal(local.reason, "not-cloudflare");

    const production = decidePreviewSupabaseTarget(
      previewEnv({
        CF_PAGES_BRANCH: "cursor/ether-combined",
        VITE_SUPABASE_URL: PROD_URL,
        VITE_SUPABASE_PROJECT_ID: PRODUCTION_SUPABASE_REF,
      }),
    );
    assert.equal(production.action, "allow");
    assert.equal(production.reason, "production-branch");

    const emptyProduction = decidePreviewSupabaseTarget({
      CF_PAGES: "1",
      CF_PAGES_BRANCH: "cursor/ether-combined",
    });
    assert.equal(emptyProduction.action, "allow");
    assert.equal(emptyProduction.reason, "production-branch");
  });

  it("refuses a preview build that embeds ether-prod", () => {
    const decision = decidePreviewSupabaseTarget(
      previewEnv({
        VITE_SUPABASE_URL: PROD_URL,
        VITE_SUPABASE_PROJECT_ID: PRODUCTION_SUPABASE_REF,
      }),
    );
    assert.equal(decision.action, "reject");
    assert.equal(decision.reason, "preview-uses-production");
    const message = formatPreviewTargetError(decision);
    assert.match(message, /preview build refused/);
    assert.match(message, /VITE_SUPABASE_URL/);
    assert.equal(message.includes(SECRET_KEY), false);

    const urlOnly = decidePreviewSupabaseTarget(
      previewEnv({
        VITE_SUPABASE_URL: `${PROD_URL}/`,
        VITE_SUPABASE_PROJECT_ID: STAGING_REF,
      }),
    );
    assert.equal(urlOnly.reason, "preview-uses-production");

    const idOnly = decidePreviewSupabaseTarget(
      previewEnv({
        VITE_SUPABASE_URL: STAGING_URL,
        VITE_SUPABASE_PROJECT_ID: PRODUCTION_SUPABASE_REF,
      }),
    );
    assert.equal(idOnly.reason, "preview-uses-production");
  });

  it("refuses a preview build with a missing or mismatched target", () => {
    const missing = decidePreviewSupabaseTarget(
      previewEnv({
        VITE_SUPABASE_URL: "",
        VITE_SUPABASE_PROJECT_ID: "",
        VITE_SUPABASE_PUBLISHABLE_KEY: "",
      }),
    );
    assert.equal(missing.reason, "preview-missing-target");
    assert.match(formatPreviewTargetError(missing), /VITE_SUPABASE_PUBLISHABLE_KEY/);

    const mismatch = decidePreviewSupabaseTarget(
      previewEnv({
        VITE_SUPABASE_URL: STAGING_URL,
        VITE_SUPABASE_PROJECT_ID: "cccccccccccccccccccc",
      }),
    );
    assert.equal(mismatch.reason, "preview-target-mismatch");
  });

  it("allows a preview build pointed at staging", () => {
    const decision = decidePreviewSupabaseTarget(previewEnv());
    assert.equal(decision.action, "allow");
    assert.equal(decision.reason, "staging-target");
    assert.equal(decision.projectRef, STAGING_REF);

    const renamed = decidePreviewSupabaseTarget(
      previewEnv({
        CF_PAGES_BRANCH: "release",
        ETHER_PRODUCTION_BRANCH: "release",
        VITE_SUPABASE_URL: PROD_URL,
        VITE_SUPABASE_PROJECT_ID: PRODUCTION_SUPABASE_REF,
      }),
    );
    assert.equal(renamed.reason, "production-branch");
  });
});

describe("auth storage keys", () => {
  it("keeps the ether-prod keys and adds the project this build uses", () => {
    const production = authStorageKeys(PROD_URL, PRODUCTION_SUPABASE_REF);
    assert.deepEqual(production, [
      "sb-aykopqinnnssxdhxqruo-auth-token",
      "sb-aykopqinnnssxdhxqruo-auth-token-code-verifier",
      "sb-wjbyvlgsxscwukkolehg-auth-token",
      "sb-wjbyvlgsxscwukkolehg-auth-token-code-verifier",
      "supabase.auth.token",
    ]);

    const staging = authStorageKeys(STAGING_URL, STAGING_REF);
    assert.ok(staging.includes(`sb-${STAGING_REF}-auth-token`));
    assert.ok(staging.includes("sb-aykopqinnnssxdhxqruo-auth-token"));
  });
});

describe("check-supabase-target script", () => {
  it("exits 0 for a production build and 1 for a preview pointed at ether-prod", () => {
    const allowed = spawnSync(process.execPath, [checkScript], {
      encoding: "utf8",
      env: {
        ...process.env,
        CF_PAGES: "1",
        CF_PAGES_BRANCH: "cursor/ether-combined",
        VITE_SUPABASE_URL: PROD_URL,
        VITE_SUPABASE_PROJECT_ID: PRODUCTION_SUPABASE_REF,
        VITE_SUPABASE_PUBLISHABLE_KEY: SECRET_KEY,
      },
    });
    assert.equal(allowed.status, 0);
    assert.equal(`${allowed.stdout}${allowed.stderr}`.includes(SECRET_KEY), false);

    const refused = spawnSync(process.execPath, [checkScript], {
      encoding: "utf8",
      env: {
        ...process.env,
        CF_PAGES: "1",
        CF_PAGES_BRANCH: "cursor/ether-integration-oct21",
        VITE_SUPABASE_URL: PROD_URL,
        VITE_SUPABASE_PROJECT_ID: PRODUCTION_SUPABASE_REF,
        VITE_SUPABASE_PUBLISHABLE_KEY: SECRET_KEY,
      },
    });
    assert.equal(refused.status, 1);
    const output = `${refused.stdout}${refused.stderr}`;
    assert.match(output, /preview build refused/);
    assert.equal(output.includes(SECRET_KEY), false);
  });
});
