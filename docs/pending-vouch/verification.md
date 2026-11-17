# Pending application vouches and recovery — November 17, 2026

Changes are on `codex/pending-vouch-recovery`. Production release is held until the remaining staging gates pass.

## Implemented

- Pending applicants can copy/share an endorsement request for an already-submitted application. This is separate from inviting a new applicant.
- Approved, non-suspended members can endorse once with an optional 280-character note. Self-vouches, pending members, anonymous users, and closed applications are rejected. Retrying does not duplicate the endorsement.
- Admin review shows endorser identity, date, and note. No table access is granted to public clients; RPCs check the current caller.
- Sign-in preserves a valid vouch return path. Pending screen explains safe sign-out and resuming with the original account.
- Recovery email input remains editable after a syntactically valid partial address; the existing latest-branch unconfirmed-login recovery and resend cooldown remain.
- Review user list uses document scrolling, extending the existing dashboard fix.
- Landing circles replaced by three static silver logo images (about 124 KB total).

## Staging evidence

Project: `vjdrihmriufkameqngfg` only. Migration `20261117203615_membership_vouch_links.sql` applied to staging.

- PASS: actual browser sign-out and password sign-in restored `/pending` and the same vouch link without a verification code.
- PASS: approved member submitted a vouch; reload showed it already recorded; admin saw the same member and note at 390px, without horizontal overflow.
- PASS: real staging REST requests let admin enable/disable the application push preference and rejected a non-admin enabling it.
- PASS: application email delivered through the scheduled worker to `etherbylcove@gmail.com` Inbox at 20:43:01 UTC. Gmail message `1a1eb3fb0ebb884c`; application message key `ether-application-d72db42d-4730-4cab-8f50-4713c0a62b37-97d5f1c251c39f1634a27e5d0cb88010`. Exactly one sent log and one Gmail result; repeated saves did not enqueue another application alert.
- PASS: no Edge Function warning/error entries during the test window starting 20:40 UTC. Routine boot/shutdown entries are present.
- PASS: PGlite vouch access/deduplication tests; 8 existing referral, push preference, push dispatch, and admin scroll tests; 6 access-routing/cooldown tests; typecheck; lint (25 pre-existing warnings, no errors); spellcheck; staging production build.

## Release blockers

1. Auth `/resend` returned 500 at 20:43:37 UTC. Auth log request `01a1eb40-38f6-78a7-b1ce-5571a80a4cd2`: SMTP `535 Authentication credentials invalid`. The Edge worker secret works, but Auth's separately configured SMTP credential must be updated. No new code receipt has been claimed.
2. No registered staging iPhone. Provider/device delivery and actual iPhone receipt remain unverified. Supplied account credentials did not authenticate to staging; separate temporary fixtures were used. Production credentials/settings were not modified.

The security advisor also reports pre-existing definer views and function grants; the new vouch tables deliberately have RLS and no direct client grants. Existing unrelated advisories are not changed by this release.

## Assets

Built-in image generation edited each supplied logo separately with this prompt:

> Edit the provided logo into a polished silver metal emblem for a small website icon. Preserve its exact silhouette, proportions, internal linework and negative spaces. Front facing orthographic, restrained beveled edges, bright silver studio highlights, subtle dark metal reflections. Center tightly in a square with 8% padding, logo fills the canvas. Actual transparent background, no white background, no text, no added objects. No redesign.

Project assets: `src/assets/brand/silver-lotus.png`, `silver-lcove.png`, `silver-star.png`. Sized to 256px for delivery; full originals remain in Codex generated images.
