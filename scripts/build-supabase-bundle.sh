#!/usr/bin/env bash
# Build supabase/bundle/ether-schema.sql from supabase/migrations.
#
# The file is for a brand-new hosted Supabase project. It does not read the
# stale migration/ folder at the repo root, and it does not connect to any
# database. Run it from the repo root:
#
#   bash scripts/build-supabase-bundle.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/supabase/bundle"
OUT="$OUT_DIR/ether-schema.sql"
mkdir -p "$OUT_DIR"

node --input-type=module - "$ROOT" "$OUT" <<'EOF'
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];
const outPath = process.argv[3];
const dir = join(root, "supabase", "migrations");
const files = readdirSync(dir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const timestamps = files.map((name) => name.split("_")[0]);
const seen = new Set();
for (const stamp of timestamps) {
  if (seen.has(stamp)) {
    console.error(`duplicate migration timestamp: ${stamp}`);
    process.exit(1);
  }
  seen.add(stamp);
}
for (let i = 1; i < timestamps.length; i += 1) {
  if (timestamps[i] < timestamps[i - 1]) {
    console.error(`migration filenames are not in timestamp order at ${files[i]}`);
    process.exit(1);
  }
}

function splitSql(sql) {
  const statements = [];
  let current = "";
  let i = 0;
  let dollar = null;
  let lineComment = false;
  let blockComment = false;
  let quote = false;

  const push = () => {
    if (current.trim()) statements.push(current.trim());
    current = "";
  };

  while (i < sql.length) {
    const rest = sql.slice(i);

    if (lineComment) {
      current += sql[i];
      if (sql[i] === "\n") lineComment = false;
      i += 1;
      continue;
    }
    if (blockComment) {
      current += sql[i];
      if (rest.startsWith("*/")) {
        current += "/";
        i += 2;
        blockComment = false;
        continue;
      }
      i += 1;
      continue;
    }
    if (dollar) {
      if (rest.startsWith(dollar)) {
        current += dollar;
        i += dollar.length;
        dollar = null;
        continue;
      }
      current += sql[i];
      i += 1;
      continue;
    }
    if (quote) {
      current += sql[i];
      if (sql[i] === "'") {
        if (sql[i + 1] === "'") {
          current += "'";
          i += 2;
          continue;
        }
        quote = false;
      }
      i += 1;
      continue;
    }

    if (rest.startsWith("--")) {
      lineComment = true;
      current += "-";
      i += 1;
      continue;
    }
    if (rest.startsWith("/*")) {
      blockComment = true;
      current += "/";
      i += 1;
      continue;
    }
    if (sql[i] === "'") {
      quote = true;
      current += sql[i];
      i += 1;
      continue;
    }
    const dollarMatch = rest.match(/^\$[A-Za-z0-9_]*\$/);
    if (dollarMatch) {
      dollar = dollarMatch[0];
      current += dollar;
      i += dollar.length;
      continue;
    }
    if (sql[i] === ";") {
      current += ";";
      push();
      i += 1;
      continue;
    }
    current += sql[i];
    i += 1;
  }
  push();
  return statements;
}

function dollarTag(body, seed) {
  let tag = `$ether_${seed}$`;
  while (body.includes(tag)) tag = `$ether_${seed}_${tag.length}$`;
  return tag;
}

function withoutComments(sql) {
  let out = "";
  let i = 0;
  let dollar = null;
  let quote = false;
  while (i < sql.length) {
    const rest = sql.slice(i);
    if (dollar) {
      if (rest.startsWith(dollar)) {
        out += dollar;
        i += dollar.length;
        dollar = null;
        continue;
      }
      out += sql[i];
      i += 1;
      continue;
    }
    if (quote) {
      out += sql[i];
      if (sql[i] === "'") {
        if (sql[i + 1] === "'") {
          out += "'";
          i += 2;
          continue;
        }
        quote = false;
      }
      i += 1;
      continue;
    }
    if (rest.startsWith("--")) {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end + 1;
      out += "\n";
      continue;
    }
    if (rest.startsWith("/*")) {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }
    if (sql[i] === "'") {
      quote = true;
      out += sql[i];
      i += 1;
      continue;
    }
    const dollarMatch = rest.match(/^\$[A-Za-z0-9_]*\$/);
    if (dollarMatch) {
      dollar = dollarMatch[0];
      out += dollar;
      i += dollar.length;
      continue;
    }
    out += sql[i];
    i += 1;
  }
  return out;
}

function guardStatement(statement) {
  let next = statement.replace(
    /\bCREATE EXTENSION\s+(?!IF NOT EXISTS\b)(pg_cron|pg_net|supabase_vault|pgmq)\b/gi,
    "CREATE EXTENSION IF NOT EXISTS $1",
  );
  next = next.replace(
    /INSERT INTO storage\.buckets \(id, name, public\)\s+VALUES \('media', 'media', true\);/i,
    "INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true) ON CONFLICT (id) DO NOTHING;",
  );

  const stripped = withoutComments(next).trim();
  const publication = stripped.match(
    /^ALTER PUBLICATION supabase_realtime (ADD|DROP) TABLE (ONLY )?(public\.)?([a-z0-9_]+)\s*;$/i,
  );
  if (publication) {
    const action = publication[1].toUpperCase();
    const table = publication[4];
    const gate = action === "ADD" ? "NOT EXISTS" : "EXISTS";
    const verb = action === "ADD" ? "adding" : "dropping";
    return `DO $ether_pub$\nBEGIN\n  IF ${gate} (\n    SELECT 1 FROM pg_publication_tables\n    WHERE pubname = 'supabase_realtime'\n      AND schemaname = 'public'\n      AND tablename = '${table}'\n  ) THEN\n    BEGIN\n      ALTER PUBLICATION supabase_realtime ${action} TABLE public.${table};\n    EXCEPTION\n      WHEN insufficient_privilege THEN\n        RAISE NOTICE 'skipped ${verb} ${table} on supabase_realtime: %', SQLERRM;\n    END;\n  END IF;\nEND\n$ether_pub$;`;
  }

  return next;
}

const header = `-- Ether schema bundle for a brand-new hosted Supabase project.
-- Generated by scripts/build-supabase-bundle.sh. Do not edit by hand.
-- Source of truth: supabase/migrations, in filename order (${files.length} files).
-- The repo-root migration/ folder is not included.
--
-- Hosted Supabase already provides auth, storage, realtime, and the
-- postgres role. This file does not create those schemas.
--
-- Before running this file, enable these extensions in Dashboard,
-- Database, Extensions. CREATE EXTENSION IF NOT EXISTS still fails when
-- the extension is not allowlisted:
--   pg_cron, pg_net, supabase_vault, pgmq
--
-- This file does not schedule cron jobs and does not write vault secrets.
-- Those statements would name this project's URL and a secret, and the
-- cron and vault objects are owned by supabase_admin. Create them in the
-- dashboard after the functions are deployed. See docs/supabase-migration.md.
--
-- ALTER PUBLICATION supabase_realtime is guarded so a table already in
-- the publication is skipped. Changing the publication needs its owner.
-- On hosted that owner is supabase_admin, and the Management API role
-- postgres is not a member of it. A permission error is a notice. Add or
-- remove the tables under Database, Publications. Do not add profiles.
--
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin is the same kind of
-- error. The migration skips it unless the current role is a member.
-- Defaults for the current role, and for postgres when this session may
-- act for postgres, still apply.
--
-- pg_net belongs in extensions. A project that already has it in public
-- can move it only when this role owns the extension and the installed
-- build allows SET SCHEMA. Otherwise the notice below is the result, and
-- the dashboard owner runs: ALTER EXTENSION pg_net SET SCHEMA extensions
--
-- Running this file a second time records nothing new. Applied versions
-- live in public.ether_schema_migrations.

CREATE TABLE IF NOT EXISTS public.ether_schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE SCHEMA IF NOT EXISTS extensions;

DO $ether_pg_net$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    BEGIN
      CREATE EXTENSION pg_net WITH SCHEMA extensions;
    EXCEPTION
      WHEN insufficient_privilege OR undefined_file THEN
        RAISE NOTICE 'pg_net was not created in extensions: %', SQLERRM;
    END;
  ELSIF (
    SELECT n.nspname
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_net'
  ) IS DISTINCT FROM 'extensions' THEN
    BEGIN
      ALTER EXTENSION pg_net SET SCHEMA extensions;
    EXCEPTION
      WHEN insufficient_privilege OR feature_not_supported THEN
        RAISE NOTICE 'pg_net was left outside extensions (move it in the dashboard as the extension owner): %', SQLERRM;
    END;
  END IF;
END
$ether_pg_net$;

`;

let body = header;
let statementCount = 0;

files.forEach((name, index) => {
  const sql = readFileSync(join(dir, name), "utf8");
  const statements = splitSql(sql)
    .map(guardStatement)
    .filter((statement) => withoutComments(statement).replace(/;/g, "").trim());
  for (const statement of statements) {
    const tags = statement.match(/\$[A-Za-z0-9_]*\$/g) || [];
    const counts = new Map();
    for (const tag of tags) counts.set(tag, (counts.get(tag) || 0) + 1);
    for (const [tag, count] of counts) {
      if (count % 2 !== 0) {
        throw new Error(`${name} has an unbalanced dollar quote ${tag}`);
      }
    }
  }
  statementCount += statements.length;
  const outer = dollarTag(sql, `m${index}`);
  const chunks = statements.map((statement, statementIndex) => {
    const tag = dollarTag(statement, `m${index}s${statementIndex}`);
    if (statement.includes(outer)) {
      throw new Error(`${name} contains the migration wrapper tag`);
    }
    return `  EXECUTE ${tag}\n${statement}\n${tag};`;
  });

  body += `-- ${name}\n`;
  body += `DO ${outer}\nBEGIN\n`;
  body += `  IF EXISTS (SELECT 1 FROM public.ether_schema_migrations WHERE version = '${name}') THEN\n`;
  body += `    RAISE NOTICE 'skip ${name}';\n`;
  body += `    RETURN;\n`;
  body += `  END IF;\n`;
  body += chunks.length ? `${chunks.join("\n")}\n` : "";
  body += `  INSERT INTO public.ether_schema_migrations (version) VALUES ('${name}');\n`;
  body += `END\n${outer};\n\n`;
});

writeFileSync(outPath, body);
console.log(`wrote ${outPath}`);
console.log(`migrations ${files.length}`);
console.log(`statements ${statementCount}`);
EOF
