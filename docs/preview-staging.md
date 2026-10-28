# Preview builds use a staging Supabase project

Cloudflare Pages project `ether-staging` serves two kinds of URLs:

| Deployment | Host | Git branch | Supabase |
| --- | --- | --- | --- |
| Production | `etherbylcove.com`, `ether-staging.pages.dev` | `cursor/ether-combined` | ether-prod `aykopqinnnssxdhxqruo` |
| Preview | `https://<branch>.ether-staging.pages.dev` and the per-deployment hash URL for any other branch | every branch except the production branch | ether-staging `vjdrihmriufkameqngfg` |

A hash URL is created for production deployments too. Those builds use the Production environment, so they keep ether-prod. The branch, not the hostname, is what separates the two.

Vite inlines `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_PROJECT_ID` at build time. Preview builds were given the ether-prod values, so a post, like, or signup on a preview wrote into the live database.

## Why a second project, not a read-only preview

Two free options were considered.

**Second free Supabase project, selected by the Cloudflare environment.** This is the one to use. The Free plan includes two active projects. Paused projects do not count. Database Branching is a paid add-on (Pro and above, billed per branch-hour), so it is not used. Preview builds get the staging URL and anon key. Production builds of `cursor/ether-combined` keep the ether-prod values they have now. Posts, likes, and signups on a preview land in the empty project.

**A read-only or guarded preview that still talks to ether-prod.** This does not meet the goal. Writes are allowed by row-level security for any signed-in member. The anon key is in the JavaScript bundle. A check in the browser can be skipped by calling the API. A server rule that blocks writes from a preview hostname would have to live on ether-prod, and a missing or spoofed signal would either block production or fail open. It also cannot exercise the thing previews are for: creating a post, a like, or an account.

`supabase/config.toml` stays on `aykopqinnnssxdhxqruo`. The GitHub workflow that deploys Edge Functions stays on ether-prod. This change does not deploy functions, cron, SMTP, or Stripe to the staging project. Preview auth, posts, and likes work after the schema and seed below. Email, Stripe, and push on a preview call the staging project, which has no functions, and those calls fail until someone deploys functions there on purpose. Do not point that workflow at the staging ref.

## 1. Staging project

The live staging project is **ether-staging**, ref `vjdrihmriufkameqngfg`, API URL `https://vjdrihmriufkameqngfg.supabase.co`. Preview builds use this project.

It was created as a free project. The paused project named ETHER does not count toward the Free plan's two-project limit. Do not unpause it. Do not pause ether-prod. If the organization that owns ether-prod is on a paid plan, this project belongs in a separate Free organization so it is not billed with production.

A free project pauses after a week without traffic. Unpause it in the dashboard before testing a preview. A paused staging project makes the preview fail. It does not send the preview back to ether-prod.

Turn on the same extensions as ether-prod before the schema runs. Database, Extensions: `pg_cron`, `pg_net`, `supabase_vault`, `pgmq`. `pgcrypto` is already there. The reason for each is in `docs/supabase-migration.md`.

## 2. Apply the schema and seed

From a machine with `psql`, at the repo root. The connection string is the Postgres URI from Project Settings, Database, Connection string. Use the direct host `db.vjdrihmriufkameqngfg.supabase.co` on port **5432**, or the session pooler (`postgres.vjdrihmriufkameqngfg` on port 5432). Do not use port 6543. Do not paste the URI into git, chat, or this file.

```sh
export STAGING_PROJECT_REF="vjdrihmriufkameqngfg"
export STAGING_DB_URL="<postgres URI from the staging dashboard>"
export STAGING_SEED_PASSWORD="<at least 8 characters>"
bash scripts/apply-staging-project.sh
```

The script rebuilds `supabase/bundle/ether-schema.sql` from `supabase/migrations/` and applies that file, then applies `supabase/seed/staging.sql`. It exits before connecting when the ref or the URI is ether-prod. It does not print the URI or the password. A failed `psql` run can still echo the SQL statement in your terminal, so run it on your own machine.

`--check` validates the variables and does not connect. `--schema-only` skips the seed. `--seed-only` runs the seed again. `--no-rebuild` uses the bundle already in the repo.

Run the same command after new migration files land. The bundle records applied filenames in `public.ether_schema_migrations` and skips them on a second run.

The seed creates two confirmed accounts. Both use `STAGING_SEED_PASSWORD`:

| Email | Name |
| --- | --- |
| `ada@staging.ether.test` | Ada Staging |
| `nico@staging.ether.test` | Nico Staging |

Ada's post is liked by Nico, and Nico's post is liked by Ada. The copy says the rows are staging data. Sign in with either email on a preview URL. Change the password in the staging dashboard if other people can open that project. To add the rows again without replaying the schema, run `bash scripts/apply-staging-project.sh --seed-only`.

A local rehearsal that never opens a remote connection needs Postgres on the machine:

```sh
bash scripts/staging-seed-check.sh
```

### Auth URLs on the staging project only

Authentication, URL configuration, on the **staging** project. Do not change these on ether-prod.

- Site URL: `http://localhost:8080`
- Redirect URLs:
  - `http://localhost:8080/**`
  - `https://*.ether-staging.pages.dev/**`

Authentication, Providers, Email: turn **Confirm email** off on the staging project so a new preview signup does not need SMTP. Leave it on for ether-prod.

## 3. Cloudflare Pages environment variables

No Cloudflare token is used from this repo. Set these in the dashboard. Production and Preview do not share variables. The page opens on Production. Switch to **Preview** before editing. Do not change the Production values.

1. Open [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages). The nav may say **Compute**.
2. Open the Pages project **ether-staging**.
3. Open **Settings**, then **Environment variables**.
4. Select the **Preview** environment.
5. Set or replace these three variables. Plain text is correct. They are inlined into the preview JavaScript. Do not put the service role key in any `VITE_` name.

| Name | Preview value | Production value, leave as it is |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://vjdrihmriufkameqngfg.supabase.co` | `https://aykopqinnnssxdhxqruo.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Staging anon key. Project Settings, API Keys. Not the service role key. | The ether-prod anon key already saved there |
| `VITE_SUPABASE_PROJECT_ID` | `vjdrihmriufkameqngfg` | `aykopqinnnssxdhxqruo` |

6. Switch back to **Production** and confirm the three values in the right-hand column are unchanged.
7. If `VITE_VAPID_PUBLIC_KEY` or `VITE_WALLET_PASSES_ENABLED` exist only under Production, leave them. Preview does not need them for posts and likes.
8. Do not set `ETHER_PRODUCTION_BRANCH` on Preview. Set it on Production only when the Pages production branch is not `cursor/ether-combined`, and set it to that branch name. A preview build compares `CF_PAGES_BRANCH` with `cursor/ether-combined` (or with `ETHER_PRODUCTION_BRANCH` when that variable is present). A preview that still contains `aykopqinnnssxdhxqruo` fails `npm run build`.
9. Confirm the production branch and do not change it if it is already correct: **Settings**, **Builds & deployments**, **Configure Production deployments**. Production branch: `cursor/ether-combined`.
10. Save, then retry a preview deployment. The build log for a non-production branch should say `Preview build will use Supabase project vjdrihmriufkameqngfg.` A build that still has the ether-prod ref stops with `Cloudflare Pages preview build refused.`

`npm run build` runs `scripts/check-supabase-target.mjs` before Vite. `vite build` runs the same check from `vite.config.ts`. Local builds and GitHub Actions do not set `CF_PAGES`, so they are not treated as previews. A production Pages build of `cursor/ether-combined` is allowed to keep ether-prod, including when those three variables are the values already documented in `docs/deploy-ether-prod.md`.

## What you should see

On `https://<branch>.ether-staging.pages.dev`, the browser console line `[Supabase Client]` shows `vjdrihmriufkameqngfg`. Sign in as `ada@staging.ether.test`. The feed shows the two seed posts. A new post from that session stays in the staging project.

On `https://etherbylcove.com`, the same console line shows `aykopqinnnssxdhxqruo`.
