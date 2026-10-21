# Migrations

ether-prod migrations are applied by hand. The GitHub workflow that deploys Edge Functions does not run SQL.

Each file in `supabase/migrations/` is applied in filename order. The filename is then recorded in `public.ether_schema_migrations`. `version` is the full filename, not only the timestamp. `supabase/bundle/ether-schema.sql` is that same list, wrapped so a second run skips versions already in the table. Rebuild the bundle after adding or renaming a file:

```sh
bash scripts/build-supabase-bundle.sh
```

Do not use `supabase db push` for this project. Do not run the old `migration/` folder at the repo root. Do not apply these files from the integration branch.

## Timestamp rule

Every timestamp prefix must be unique and non-decreasing. The bundle script exits if a later file sorts before an earlier one, or if two files share a prefix.

One pair is allowed to share `20261020160000` because both filenames are already recorded on ether-prod:

- `20261020160000_connect_invoice_and_gifts.sql`
- `20261020160000_waitlist.sql`

Apply order between them is the full filename (`connect_invoice_and_gifts` before `waitlist`). Do not add another file with that prefix. `20261020160000_waitlist.sql` uses `CREATE TABLE` without `IF NOT EXISTS`, so a second apply would fail. Pull request 27's later file `20261020160500_waitlist.sql` is the idempotent copy and is also recorded.

`20261020120000_content_report_ai_reasons.sql` was renamed to `20261020120100_content_report_ai_reasons.sql` so it does not share a timestamp with `20261020120000_store_catalog_import.sql`. `20261020230000_post_video_embeds.sql` keeps that name: `VIDEO_EMBED_MIGRATION_FILE` in `src/lib/videoEmbed.ts` points at it.

## Files added after `cursor/ether-combined`

These are the migration files that are not on `cursor/ether-combined`. Order is filename order.

| File | Source | On ether-prod |
| --- | --- | --- |
| `20261020035500_community_fund_fee_sources.sql` | #29 | recorded |
| `20261020120000_store_catalog_import.sql` | #25 / #26 | recorded |
| `20261020120100_content_report_ai_reasons.sql` | #30, renamed off `20261020120000` | not applied |
| `20261020140000_sharing_reposts_and_post_views.sql` | #28 | recorded |
| `20261020143000_onboarding_red_flag_exam.sql` | #26 | recorded |
| `20261020150000_posts_stories_realtime.sql` | #26 | recorded |
| `20261020160000_connect_invoice_and_gifts.sql` | #26 | recorded |
| `20261020160000_waitlist.sql` | #29 | recorded |
| `20261020160500_waitlist.sql` | #27 | recorded |
| `20261020161000_signup_attribution.sql` | #27 | recorded |
| `20261020163000_waitlist_invites.sql` | #27 | recorded |
| `20261020164000_waitlist_import.sql` | #27 | recorded |
| `20261020165000_claim_waitlist_on_signup.sql` | #27 | recorded |
| `20261020170000_novi_studio_quest.sql` | #26 | recorded |
| `20261020171000_delete_pipeline_contact.sql` | #26 | recorded |
| `20261020172000_collab_invites.sql` | #26 | recorded |
| `20261020173000_profile_films.sql` | #26 | recorded |
| `20261020181000_app_store_readiness.sql` | #26 | not recorded |
| `20261020193000_community_fund_fees_source_types.sql` | #26 | not recorded |
| `20261020220000_story_like_notices_and_direct_chats.sql` | #28 | not recorded |
| `20261020230000_post_video_embeds.sql` | #33 | not applied |

`20261020193000_community_fund_fees_source_types.sql` repeats the source-type check from `20261020035500_community_fund_fee_sources.sql` and is safe to apply after it. The AI-reasons file and the video-embed file have not been applied. The story-like file was not listed as recorded when #29 was written.
