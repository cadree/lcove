# Uploaded music

Artists choose Free listening or Paid access when uploading from Files.
Free tracks use `access_type = 'free'`, a zero price and downloads disabled.
Signed-in listeners can play those published tracks in full without Stripe or a
payout account. Existing zero-price subscriber tracks are not automatically free.
Paid tracks retain the $0.50 minimum, previews and verified purchase unlocks.

Downloads require `allow_downloads` and a completed, positive-value purchase of
that specific track. Subscription listening does not grant downloads. The
`download-music-track` function rechecks both before minting a one-minute link.
Streaming delivers audio to the device; these controls do not prevent recording
or extracting audio from a playback session.

## Where files live

| File | Bucket | Who can read it |
| --- | --- | --- |
| Full track | `music-private` (private, 50 MB, `audio/*`) | The artist, buyers with a `paid` purchase, active subscribers. Checked by `public.can_read_private_music()` in the storage SELECT policy. The app reads it through a 1-hour signed URL. |
| 15-second preview | `media` (public) | Anyone. The browser makes it at upload time (mono 22 kHz WAV, about 660 KB). |
| Cover art | `media` (public) | Anyone. |

`exclusive_tracks.audio_file_path` holds the private path. `audio_file_url` is the
old public URL. The migration's trigger refuses to store a new one, so the
1.0.3 app and older web builds can't upload locked tracks after the migration.
They get "Update Ether and upload the track again."

## Checkout and webhook

`purchase-exclusive-track` takes the price and the artist from the track row.
An access rule only applies when it belongs to the same artist and track. It
creates a Checkout Session as a destination charge to the artist's Connect
account with a 0% application fee, and inserts a `pending` purchase.

The Stripe webhook endpoint must send these events:

- `checkout.session.completed`: marks the purchase `paid` only when `payment_status` is `paid`.
- `checkout.session.async_payment_succeeded`: marks it `paid` (delayed methods).
- `checkout.session.async_payment_failed`: marks it `failed`.
- `checkout.session.expired`: marks it `expired`.
- `charge.refunded`: marks it `refunded` after a full refund, which removes access. A partial refund keeps access.

## Moving existing tracks

After the migration, run `scripts/move-legacy-locked-tracks.mjs` once. It
defaults to a dry run; pass `--apply` to write. It moves full files that are
still public into `music-private` and makes previews with ffmpeg.

## Payout onboarding on iPhone

`create-music-payout-account` uses trusted HTTPS return/retry URLs, never the
native WebView origin. SITE_URL/APP_URL support a configured staging website.
An expired Stripe link returns to the profile and creates a fresh link. Returning
from onboarding refreshes Stripe status; a return query does not itself enable
payouts. On iPhone, the existing Safari bridge opens `/payout-onboarding.html`, where
the single-use Stripe URL is read from a fragment (not sent to the web server).
