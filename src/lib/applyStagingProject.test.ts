import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../scripts/apply-staging-project.sh");
const PROD_REF = "aykopqinnnssxdhxqruo";
const STAGING_REF = "bbbbbbbbbbbbbbbbbbbb";
const DB_PASSWORD = "super-secret-db-pass";
const SEED_PASSWORD = "staging-test-password";

function run(env: Record<string, string>, args: string[] = []) {
  const result = spawnSync("bash", [script, ...args], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      STAGING_PROJECT_REF: "",
      STAGING_DB_URL: "",
      STAGING_SEED_PASSWORD: "",
      ...env,
    },
  });
  return {
    status: result.status,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

function assertSecretsHidden(output: string) {
  assert.equal(output.includes(DB_PASSWORD), false, "connection password was printed");
  assert.equal(output.includes(SEED_PASSWORD), false, "seed password was printed");
}

const directUrl = `postgresql://postgres:${DB_PASSWORD}@db.${STAGING_REF}.supabase.co:5432/postgres`;
const sessionUrl = `postgresql://postgres.${STAGING_REF}:${DB_PASSWORD}@aws-0-us-east-1.supabase.com:5432/postgres`;

describe("apply-staging-project", () => {
  it("prints help and rejects unknown arguments", () => {
    const help = run({}, ["--help"]);
    assert.equal(help.status, 0);
    assert.match(help.output, /STAGING_PROJECT_REF/);

    const unknown = run({}, ["--deploy"]);
    assert.equal(unknown.status, 2);
  });

  it("refuses ether-prod without printing secrets", () => {
    const byRef = run({
      STAGING_PROJECT_REF: PROD_REF,
      STAGING_DB_URL: `postgresql://postgres:${DB_PASSWORD}@db.${PROD_REF}.supabase.co:5432/postgres`,
      STAGING_SEED_PASSWORD: SEED_PASSWORD,
    }, ["--check"]);
    assert.notEqual(byRef.status, 0);
    assert.match(byRef.output, /ether-prod/);
    assertSecretsHidden(byRef.output);

    const byUrl = run({
      STAGING_PROJECT_REF: STAGING_REF,
      STAGING_DB_URL: `postgresql://postgres.${PROD_REF}:${DB_PASSWORD}@aws-0-us-east-1.supabase.com:5432/postgres`,
      STAGING_SEED_PASSWORD: SEED_PASSWORD,
    }, ["--check"]);
    assert.notEqual(byUrl.status, 0);
    assert.match(byUrl.output, new RegExp(PROD_REF));
    assertSecretsHidden(byUrl.output);
  });

  it("refuses a connection string that is not this staging project", () => {
    const mismatch = run({
      STAGING_PROJECT_REF: STAGING_REF,
      STAGING_DB_URL: `postgresql://postgres:${DB_PASSWORD}@db.cccccccccccccccccccc.supabase.co:5432/postgres`,
      STAGING_SEED_PASSWORD: SEED_PASSWORD,
    }, ["--check"]);
    assert.notEqual(mismatch.status, 0);
    assert.match(mismatch.output, /does not contain staging ref/);
    assertSecretsHidden(mismatch.output);

    const pooled = run({
      STAGING_PROJECT_REF: STAGING_REF,
      STAGING_DB_URL: directUrl.replace(":5432", ":6543"),
      STAGING_SEED_PASSWORD: SEED_PASSWORD,
    }, ["--check"]);
    assert.notEqual(pooled.status, 0);
    assert.match(pooled.output, /6543/);
    assertSecretsHidden(pooled.output);
  });

  it("accepts a staging target without connecting", () => {
    const direct = run({
      STAGING_PROJECT_REF: STAGING_REF,
      STAGING_DB_URL: directUrl,
      STAGING_SEED_PASSWORD: SEED_PASSWORD,
    }, ["--check"]);
    assert.equal(direct.status, 0);
    assert.match(direct.output, new RegExp(`staging target ${STAGING_REF} accepted`));
    assertSecretsHidden(direct.output);

    const session = run({
      STAGING_PROJECT_REF: STAGING_REF,
      STAGING_DB_URL: sessionUrl,
      STAGING_SEED_PASSWORD: SEED_PASSWORD,
    }, ["--check", "--schema-only"]);
    assert.equal(session.status, 0);
    assert.match(session.output, /accepted \(schema\)/);
    assertSecretsHidden(session.output);

    const schemaWithoutPassword = run({
      STAGING_PROJECT_REF: STAGING_REF,
      STAGING_DB_URL: directUrl,
    }, ["--check", "--schema-only"]);
    assert.equal(schemaWithoutPassword.status, 0);

    const shortPassword = run({
      STAGING_PROJECT_REF: STAGING_REF,
      STAGING_DB_URL: directUrl,
      STAGING_SEED_PASSWORD: "short",
    }, ["--check"]);
    assert.notEqual(shortPassword.status, 0);
    assert.match(shortPassword.output, /at least 8/);
  });
});
