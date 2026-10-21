# Migrations

ether-prod migrations are applied by hand. The GitHub workflow that deploys Edge Functions does not run SQL.

Each file in `supabase/migrations/` is applied in filename order. The filename is then recorded in `public.ether_schema_migrations`. `version` is the primary key. `supabase/bundle/ether-schema.sql` is that same list, wrapped so a second run skips versions already in the table. Rebuild the bundle after adding a file:

```sh
bash scripts/build-supabase-bundle.sh
```

Do not use `supabase db push` for this project. Do not run the old `migration/` folder at the repo root.

## Files in this branch that were missing from `cursor/ether-combined`

These two filenames are already recorded on ether-prod. They are not added by pull requests 26, 27, or 28.

| File | What it is |
| --- | --- |
| `20261020035500_community_fund_fee_sources.sql` | Allows `contact_invoice`, `stream_gift`, and `project_payment` on `community_fund_fees.source_type`. |
| `20261020160000_waitlist.sql` | Creates the pre-launch waitlist. Pull request 27 later renamed this file to `20261020160500_waitlist.sql`, after this version was already recorded. |

`20261020160000_waitlist.sql` shares its timestamp prefix with `20261020160000_connect_invoice_and_gifts.sql` from pull request 26. Apply order is the full filename. The bundle script allows that shared prefix.

## Recorded on ether-prod, added by other pull requests

Do not copy these files into this branch. The open pull request already contains them.

### Pull request 26 (`cursor/feed-studio-live-fixes-1f00`)

- `20261020120000_store_catalog_import.sql`
- `20261020143000_onboarding_red_flag_exam.sql`
- `20261020150000_posts_stories_realtime.sql`
- `20261020160000_connect_invoice_and_gifts.sql`
- `20261020170000_novi_studio_quest.sql`
- `20261020171000_delete_pipeline_contact.sql`
- `20261020172000_collab_invites.sql`
- `20261020173000_profile_films.sql`

### Pull request 27 (`cursor/ether-waitlist-launch-9660`)

- `20261020160500_waitlist.sql`
- `20261020161000_signup_attribution.sql`
- `20261020163000_waitlist_invites.sql`
- `20261020164000_waitlist_import.sql`
- `20261020165000_claim_waitlist_on_signup.sql`

### Pull request 28 (`cursor/instagram-sharing-3efe`)

- `20261020140000_sharing_reposts_and_post_views.sql`

Two more files are on pull request 26 and are not recorded on ether-prod yet: `20261020181000_app_store_readiness.sql` and `20261020193000_community_fund_fees_source_types.sql`.
