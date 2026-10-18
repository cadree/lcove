# Ether

Ether is the creative community app at [etherbylcove.com](https://etherbylcove.com). GitHub is the source of truth. Change the app by opening a pull request against this repository.

## Local setup

Install Node.js 22 and npm. [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) is a reliable way to do that.

```sh
git clone https://github.com/cadree/lcove.git
cd lcove
npm ci
cp .env.example .env
npm run dev
```

The dev server listens on port 8080.

Fill in `.env` on your machine. That file is gitignored. The names are listed in `.env.example`. Values are not stored in the repo.

| Name | What it is |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon (public) key |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ref |

Vite inlines every `VITE_` variable when it builds. A hosted build reads them from the host's environment settings, not from a file in git. The service role key must never use a `VITE_` name. See `docs/hosting-without-lovable.md`.

## Scripts

```sh
npm run dev         # local app
npm run typecheck   # tsc -b
npm run lint        # eslint
npm run build       # production build into dist/
npm run preview     # serve dist/
```

## Database migrations

Migrations live in `supabase/migrations/`. Apply them with the Supabase CLI to a project you own. Do not apply the SQL in the `migration/` folder. That folder is an old export for a different project.

```sh
npx supabase login
npx supabase link --project-ref <project-id>
npx supabase db push
```

`db push` applies the files in `supabase/migrations/` that the linked project has not applied yet. Run it against a staging project before production. Nothing in this repo connects to the live database by itself.

A local rehearsal that never opens a remote connection:

```sh
bash scripts/integration-rls-check.sh
```

That script needs local Postgres (`psql`, `pg_config`, `createdb`). It creates a throwaway database, applies the migrations, runs `scripts/integration-rls-assertions.sql`, and drops the database.

`bash scripts/safety-rls-check.sh` is an older check for the reporting and block migration only. It also stays on the local machine.

## Generate TypeScript types

`src/integrations/supabase/types.ts` is generated. After you apply migrations, regenerate it and commit the result:

```sh
npx supabase gen types typescript --project-id <project-id> --schema public > src/integrations/supabase/types.ts
```

You can edit that file by replacing it with the command above. Do not hand-write columns into it to paper over a mismatch. If a query uses a table the current file does not know about yet, define a small local type at the call site until the next regen.

`src/integrations/supabase/client.ts` re-exports `src/lib/supabaseClient.ts`. The Vite and TypeScript path aliases send `@/integrations/supabase/client` to that file so a phone session is stored in Capacitor Preferences. If you replace `client.ts`, keep the re-export and the aliases in `vite.config.ts`, `tsconfig.json`, and `tsconfig.app.json`.

## Tests

There is no `npm test` script and no browser test suite in this repo. The checks that exist are:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `bash scripts/integration-rls-check.sh` (local Postgres only)

GitHub Actions runs typecheck, lint, and build on pull requests (`.github/workflows/ci.yml`).

## More

- Hosting without a platform lock-in: `docs/hosting-without-lovable.md`
- Moving the database to a Supabase project you own: `docs/supabase-migration.md`
- Production database steps that are already written: `docs/go-live-checklist.md`
- iOS: `docs/ios-release.md`
