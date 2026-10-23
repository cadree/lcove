# Deploy Ether to ether-prod

Do these steps in order. The project is **ether-prod**, ref `aykopqinnnssxdhxqruo`, region `us-east-1`. That ref is public. Do not paste tokens, API keys, or webhook signing secrets into git, chat, or this file.

The GitHub workflow deploys Edge Functions and copies function secrets. It does not change the database and it does not run SQL. Do not point `etherbylcove.com` at the new site until the last step says so.

## 1. Add the GitHub secret `SUPABASE_ACCESS_TOKEN`

Create the token on the Supabase account that owns ether-prod:

1. Open [https://supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens).
2. Click **Generate new token**.
3. Name it `GitHub Actions ether-prod`.
4. Copy the token. Supabase shows it once. Do not email it.

Add it to the GitHub repo `cadree/lcove`:

1. Open [https://github.com/cadree/lcove/settings/secrets/actions](https://github.com/cadree/lcove/settings/secrets/actions).
2. You need admin on the repo to see **Settings**.
3. Click **New repository secret**.
4. Name: `SUPABASE_ACCESS_TOKEN`
5. Secret: paste the token.
6. Click **Add secret**.

The same screen is **Settings**, then **Secrets and variables**, then **Actions**.

## 2. Re-run the deploy

GitHub only shows a **Run workflow** button for **Deploy Supabase functions** after that workflow file is on `main`. This pull request is not on `main`. Do not merge it to `main` to make that button appear.

A push to `cursor/ether-combined` that changes a function, `supabase/config.toml`, or the workflow file starts **Deploy Supabase functions** and deploys every function to ether-prod. If `SUPABASE_ACCESS_TOKEN` is missing, that run stops immediately and the log says `SUPABASE_ACCESS_TOKEN is empty`.

After you add the secret:

1. Open [https://github.com/cadree/lcove/actions](https://github.com/cadree/lcove/actions).
2. Open the latest **Deploy Supabase functions** run.
3. Click **Re-run all jobs**.

A green check means the functions are on ether-prod. The log lists secret **names** it set or skipped. It does not print secret values. A secret that is not filled in is skipped, so a partial setup still succeeds.

After this pull request is on `main`, **Run workflow** can deploy `all` or a comma-separated list, and **Dry run** only prints the list. Until then, **Re-run all jobs** deploys every function.

Supabase already provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Do not add those as GitHub secrets.

Optional names, same **New repository secret** button. Add them when you have the value, then open the latest **Deploy Supabase functions** run and click **Re-run all jobs**:

| Name | Where the value comes from |
| --- | --- |
| `RESEND_API_KEY` | Resend, API Keys. Also the Auth SMTP password in the next step. |
| `STRIPE_SECRET_KEY` | Stripe, Developers, API keys. Use the test secret key (`sk_test_...`) until launch. |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret from the step below (`whsec_...`). |
| `STRIPE_PRODUCT_COMMUNITY`, `STRIPE_PRICE_COMMUNITY`, `STRIPE_PRODUCT_ELITE`, `STRIPE_PRICE_ELITE` | Membership products on this Stripe account. Community is pay-what-you-want, minimum $5 a month. Elite is $25 a month. What to copy is in `docs/stripe-setup.md`. Checkout fails if any name is unset. |
| `INTERNAL_FUNCTION_SECRET` | The same value as the ether-prod Vault secret `internal_function_secret` (already created). Database, Vault. The email-queue cron and the reminder cron send it as `x-internal-secret`. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | Twilio, only if texts are turned on. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | `docs/push-setup.md`. Optional `VAPID_SUBJECT` (`mailto:you@domain`). |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | LiveKit Cloud. Camera streams use these. Do not set Mux tokens. Point the LiveKit webhook at `livekit-webhook`. |
| `SITE_URL`, `APP_URL` | The site people should land on from email links. See the hosting step. |
| `EMAIL_FROM` | Optional. The queue From address. If you leave it unset, mail is sent as `notifications@notifications.etherbylcove.com`. |
| `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SERVICE_ACCOUNT_KEY` | Wallet passes, later. Store the Google key as one line. |
| `LOVABLE_API_KEY` | Only `ai-project-match`. That function is not email. Leave this unset and project matching fails closed. Do not add `LOVABLE_SEND_URL`. Nothing reads it. |

### Run the email queue every minute

`process-email-queue` reads the `auth_emails` and `transactional_emails` queues and sends with Resend. It does not accept a service role JWT. `verify_jwt` is off. The function checks header `x-internal-secret`.

ether-prod already has a Vault secret named `internal_function_secret`. Copy that value into the GitHub secret `INTERNAL_FUNCTION_SECRET` (same **New repository secret** button), then **Re-run all jobs**. Do not paste the value into git, chat, or this file. Do not create a second secret, and do not create `email_queue_service_role_key`.

After that deploy is green:

1. Open [https://supabase.com/dashboard/project/aykopqinnnssxdhxqruo/integrations/cron/jobs](https://supabase.com/dashboard/project/aykopqinnnssxdhxqruo/integrations/cron/jobs).
2. Click **Create job** (or **Jobs**, then **Create**).
3. Name: `process-email-queue`
4. Schedule: `* * * * *` (every minute).
5. Type: HTTP request, method **POST**.
6. URL: `https://aykopqinnnssxdhxqruo.supabase.co/functions/v1/process-email-queue`
7. Add a header. Name: `x-internal-secret`. Value: the Vault secret `internal_function_secret` (Database, Vault). Do not put the service role key in `Authorization`.

The same header belongs on the `auto-event-reminders` cron job if that job is not already sending it.

Resend bounce and complaint webhooks are not connected. To suppress an address, POST JSON to `https://aykopqinnnssxdhxqruo.supabase.co/functions/v1/handle-email-suppression` with the same `x-internal-secret` header:

```json
{ "email": "person@example.com", "reason": "bounce" }
```

`reason` is `bounce`, `complaint`, or `unsubscribe`. `message_id` and `metadata` are optional. People who click unsubscribe still hit `handle-email-unsubscribe`, which does not need this header.

## 3. Free custom SMTP with Resend

Supabase's built-in mailer allows **2 emails per hour for the whole project**. Signup confirmation and password reset will fail at launch if you leave that mailer on. Resend's free plan replaces it. You do not need a paid Resend plan or a paid Supabase add-on.

Resend's free plan includes SMTP, 3 domains, and 100 emails a day. That daily cap is much higher than 2 per hour. Check [https://resend.com/pricing](https://resend.com/pricing) if the number has changed.

1. Create a free account at [https://resend.com](https://resend.com).
2. Open **API Keys**, click **Create API key**, choose **Sending access**, and copy the key once.
3. Add that key as the GitHub secret `RESEND_API_KEY`, then **Re-run all jobs** on the latest **Deploy Supabase functions** run so invite and reminder functions can send.
4. In Resend, open **Domains**, click **Add Domain**, and enter `notifications.etherbylcove.com`. If it asks for a region, choose North Virginia (`us-east-1`), the same region as ether-prod.
5. Open that domain's **Records** tab. Add the records below at the DNS host for `etherbylcove.com`. Paste the values Resend shows. The DKIM value is unique to this domain and is not something you invent.

| Type | Name | Value |
| --- | --- | --- |
| MX | `send.notifications` | The mail server Resend shows, priority **10**. For `us-east-1` it is often `feedback-smtp.us-east-1.amazonses.com`. |
| TXT | `send.notifications` | `v=spf1 include:amazonses.com ~all` (paste Resend's text if it differs) |
| TXT | `resend._domainkey.notifications` | The long value from Resend. It starts with `p=`. |

Cloudflare's Name box already adds `.etherbylcove.com`. Paste `send.notifications` and `resend._domainkey.notifications`, not the full host. Pasting the full host saves the name twice. Use the full host only if the DNS form does not add the domain for you.

On Cloudflare, leave these records as **DNS only** (grey cloud). An orange-cloud proxy stops verification.

Do not add an MX record on `etherbylcove.com` itself. The MX above is only the name `send.notifications`. Leave existing mail records for the website domain alone. Do not turn on Resend receiving.

Optional, after the domain verifies. This is a trust record, not one of the three Resend asks for:

| Type | Name | Value |
| --- | --- | --- |
| TXT | `_dmarc.notifications` | `v=DMARC1; p=none;` |

Wait until Resend says the domain is **Verified**. That is often within 15 minutes and can take up to 72 hours.

Then set Supabase Auth to use Resend. This is separate from the GitHub secret. Auth mail reads the SMTP password, not the function secret.

1. Open the ether-prod project: [https://supabase.com/dashboard/project/aykopqinnnssxdhxqruo](https://supabase.com/dashboard/project/aykopqinnnssxdhxqruo).
2. Click **Authentication**.
3. Under **Notifications**, click **Email**.
4. Click **SMTP Settings**.
5. Fill in:

| Field | Value |
| --- | --- |
| Enable custom SMTP | On |
| Sender email | `noreply@notifications.etherbylcove.com` |
| Sender name | `Ether` |
| Host | `smtp.resend.com` |
| Port number | `465` |
| Username | `resend` |
| Password | The Resend API key (the same value as `RESEND_API_KEY`) |
| Minimum interval between emails | `60` seconds, if that field is shown. Do not type `3600`. |

6. Click **Save**.

Signup and password-reset mail now go through Resend. Send yourself one confirmation from the staged site before you invite anyone.

## 4. Stripe test webhook

Use Stripe test mode. Do not use the live account for this step.

1. In the Stripe dashboard, open **Developers**, then **Webhooks**, then **Add endpoint**.
2. Endpoint URL: `https://aykopqinnnssxdhxqruo.supabase.co/functions/v1/stripe-music-webhook`
3. Select these events, not "all events":
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `charge.refunded`
4. Open the endpoint, reveal the **Signing secret** (`whsec_...`).
5. On GitHub, **Settings**, **Secrets and variables**, **Actions**, **New repository secret**. Name: `STRIPE_WEBHOOK_SECRET`. Paste the signing secret. Click **Add secret**.
6. Add `STRIPE_SECRET_KEY` the same way if it is not there yet. Stripe, **Developers**, **API keys**, the secret key (`sk_test_...`). That is not the publishable key.
7. Open the latest **Deploy Supabase functions** run and click **Re-run all jobs**. That copies both names onto the project and deploys every function.
8. Send a test event from the Stripe dashboard only after that run is green.

## 5. Host the site

Cloudflare Pages is the free host to use. It includes a custom domain and HTTPS. Netlify's free tier uses the same build and the same redirect file. The longer notes are in `docs/hosting-without-lovable.md`.

The host needs these three values. Vite bakes them in at build time, so changing them means a new build. They are public client values. The anon key is public by design.

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://aykopqinnnssxdhxqruo.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The anon / public key. Supabase dashboard, **Project Settings**, **API Keys**. Not the `service_role` key. |
| `VITE_SUPABASE_PROJECT_ID` | `aykopqinnnssxdhxqruo` |

Do not put the service role key, the database password, or `VAPID_PRIVATE_KEY` in a `VITE_` variable. Those ship in the JavaScript.

Leave `VITE_VAPID_PUBLIC_KEY` and `VITE_WALLET_PASSES_ENABLED` unset until push and wallet are ready.

### Cloudflare Pages

1. Open the Cloudflare dashboard, **Workers & Pages**, **Create**, **Pages**, **Connect to Git**.
2. Choose the GitHub repo `cadree/lcove`. For production, build `main` after this pull request is merged.
3. Framework preset: **None**, or **Vite** if the form offers it.
4. Build command: `npm run build`
5. Build output directory: `dist`
6. Add the three environment variables above for **Production** only. Do not add them under **Preview**. Preview deployments must use a second Supabase project. The steps are in `docs/preview-staging.md`.
7. Save and deploy. Open the `pages.dev` address Cloudflare gives you.

### SPA redirect

Ether is a single-page app. A refresh on `/auth` must return the app, not a 404.

`public/_redirects` is already in the repo:

```
/* /index.html 200
```

`npm run build` copies it into `dist`. Cloudflare Pages and Netlify both honor that file. Do not add a second redirect.

### Do not move the domain yet

**Do not switch `etherbylcove.com` until the staged site has been tested.** Leave the current DNS records in place. On the `pages.dev` URL, confirm the app loads, signup sends a message you can open, the link returns to that staged URL, and sign-in works.

While you are testing on `pages.dev`, set the GitHub secrets `SITE_URL` and `APP_URL` to that `https://....pages.dev` address and **Re-run all jobs** on the latest **Deploy Supabase functions** run. Email links from the functions use those values. If you leave them unset, the links use `https://etherbylcove.com`, which is still the old site. When you do move the domain, change both secrets to `https://etherbylcove.com` and re-run the same way.

Move the domain only after that staged test:

1. In the Pages project, open **Custom domains** and add `etherbylcove.com`.
2. Add `www.etherbylcove.com` as well if you want the www name.
3. Add only the DNS record Cloudflare shows. If the domain is already on Cloudflare, it can add the CNAME for you. If it is at another registrar, create that record there (usually a CNAME to `<project>.pages.dev`). For an apex name, use the registrar's CNAME flattening, or an ALIAS / ANAME record. Do not point the name at a guessed IP address.
4. Wait until the Pages dashboard says the certificate is active.
5. Open `https://etherbylcove.com` and `https://etherbylcove.com/auth`. Both should show the app, not a host 404.
6. In ether-prod, set **Authentication**, **URL configuration**: Site URL `https://etherbylcove.com`, plus the redirect URLs in `docs/supabase-migration.md`. Add the `pages.dev` host the same way, including `/auth?reset=true` and `/auth?confirmed=1`, while you still test on it. Remove it when that host should no longer complete login.
