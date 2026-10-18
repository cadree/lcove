# Hosting Ether without Lovable

The live site may still be published by Lovable. This page is how to serve the same Vite app from a free host you control. It does not change DNS and it does not deploy anything.

GitHub remains the source of truth. The host builds `main` (or a release branch) from this repo.

## Recommended: Cloudflare Pages (free)

The free tier includes a custom domain, HTTPS, and enough bandwidth for this app. Netlify's free tier accepts the same `public/_redirects` file. Vercel’s free tier works too, with a different redirect file, noted below.

### Build settings

| Setting | Value |
| --- | --- |
| Framework preset | None, or Vite if the form offers it |
| Root directory | `/` (the repository root) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | 22 |

`npm run build` runs `vite build`. Vite copies `public/` into `dist/`, including `public/_redirects`.

### SPA redirect

Ether is a client-side React Router app. A refresh on `/auth` or `/nuance` must return `index.html`, not a 404.

`public/_redirects` is already in the repo:

```
/* /index.html 200
```

Cloudflare Pages and Netlify both honor that file from the output directory. Do not add a second redirect that sends those paths to a server function.

### Environment variables

Set these in the host's environment settings for Production (and Preview, if you want preview URLs to talk to a staging Supabase project). They are public client values. Vite inlines them at build time. Changing them requires a new build.

| Name | What to paste |
| --- | --- |
| `VITE_SUPABASE_URL` | The Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The anon public key |
| `VITE_SUPABASE_PROJECT_ID` | The project ref |

Do not set the service role key on the host as a `VITE_` variable. It would ship in the JavaScript bundle.

The repo used to commit a `.env` file, so a clone could build without host settings. That file is no longer tracked. A build on a machine or host that does not set the three names still completes, but the bundle's Supabase URL and key are empty and the app cannot sign in. Local development uses a gitignored `.env` copied from `.env.example`.

### Custom domain `etherbylcove.com`

Do this in the Cloudflare Pages project after a production deployment has succeeded. Leave the current DNS records in place until the new host answers.

1. In the Pages project, open Custom domains and add `etherbylcove.com`.
2. Add `www.etherbylcove.com` as well if you want the www name.
3. Cloudflare shows the DNS record it wants. For a domain already on Cloudflare, it can add a CNAME for you. For a domain at another registrar, create only the record Cloudflare displays (usually a CNAME to `<project>.pages.dev`). Apex names at some registrars need the registrar's CNAME flattening, or an ALIAS / ANAME record. Do not point the name at a guessed IP.
4. Wait until the Pages dashboard says the certificate is active.
5. Open `https://etherbylcove.com` and `https://etherbylcove.com/auth`. Both should render the app, not a host 404.
6. In the Supabase project, set the site URL and redirect URLs to `https://etherbylcove.com` before sending people to the new host. The list is in `docs/supabase-migration.md`.

If the name still points at Lovable, finish the Supabase and env steps on a `pages.dev` URL first. Switch DNS only when that URL signs in.

## Netlify (free tier)

Use the same build command (`npm run build`), the same output directory (`dist`), and the same three environment variables. `public/_redirects` is the Netlify SPA rule. Add the custom domain under Domain management and follow the DNS record Netlify shows. The rest of the domain steps above are the same.

## Vercel (free tier)

Build command `npm run build`, output directory `dist`, same three environment variables. Vercel does not read `_redirects`. In the project settings, set the framework to Vite, or add a rewrite so every path serves `index.html`. A `vercel.json` at the repo root that does that is:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

That file is not in the repo because Cloudflare Pages is the recommended host. Add it only if you choose Vercel.

## What not to do

- Do not deploy from this document's instructions as part of a code change. Deploy from the host's dashboard when you are ready.
- Do not commit `.env`.
- Do not turn on a host's "publish from Lovable" connection. Push to GitHub and let the host build that commit.
