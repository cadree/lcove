# Migration Package: Lovable Cloud → External Supabase

This package migrates the ETHER app from Lovable Cloud Supabase (`wjbyvlgsxscwukkolehg`) to your external Supabase project (`waafzlorvnozeujjhvxu`).

## Prerequisites

1. **Supabase CLI** installed: `npm install -g supabase`
2. **psql** or Supabase SQL Editor access
3. Target project configured at: `https://supabase.com/dashboard/project/waafzlorvnozeujjhvxu`

## Execution Order

Run these SQL files in your target Supabase project's SQL Editor in this exact order:

```bash
# 1. Schema (tables, enums, indexes)
psql $DATABASE_URL -f 01-schema.sql

# 2. Database functions
psql $DATABASE_URL -f 02-functions.sql

# 3. Triggers
psql $DATABASE_URL -f 03-triggers.sql

# 4. Views
psql $DATABASE_URL -f 04-views.sql

# 5. RLS Policies
psql $DATABASE_URL -f 05-rls-policies.sql

# 6. Storage buckets
psql $DATABASE_URL -f 06-storage.sql

# 7. Data (if migrating existing data)
psql $DATABASE_URL -f 07-data.sql

# 8. Realtime
psql $DATABASE_URL -f 08-realtime.sql
```

## Post-Migration Steps

### 1. Configure Auth Redirect URLs
In Supabase Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://lcove.lovable.app`
- **Redirect URLs**:
  - `app.lovable.e07d9c457fd949f78f3cc7d5998be668://`
  - `capacitor://localhost`
  - `https://id-preview--e07d9c45-7fd9-49f7-8f3c-c7d5998be668.lovable.app`
  - `https://lcove.lovable.app`

### 2. Configure Secrets
In Supabase Dashboard → Edge Functions → Secrets, add:

| Secret | Description |
|--------|-------------|
| `STRIPE_SECRET_KEY` | Stripe API key |
| `RESEND_API_KEY` | Resend email API key |
| `MUX_TOKEN_ID` | Mux streaming token ID |
| `MUX_TOKEN_SECRET` | Mux streaming secret |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio phone number |
| `VAPID_PRIVATE_KEY` | Push notification private key |
| `VAPID_PUBLIC_KEY` | Push notification public key |

### 3. Deploy Edge Functions
```bash
cd supabase/functions
supabase login
supabase link --project-ref waafzlorvnozeujjhvxu
supabase functions deploy
```

### 4. Migrate Storage Files
```bash
# Download from source
supabase storage download media/* --project-ref wjbyvlgsxscwukkolehg

# Upload to target
supabase storage upload media/* --project-ref waafzlorvnozeujjhvxu
```

### 5. Update App Environment
Export this project to GitHub, then update `.env`:

```env
VITE_SUPABASE_URL=https://waafzlorvnozeujjhvxu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key-from-dashboard>
VITE_SUPABASE_PROJECT_ID=waafzlorvnozeujjhvxu
```

### 6. Auth User Migration

**Option A: Users reset passwords (recommended)**
- Create users manually or import emails
- Send password reset emails

**Option B: Full migration (advanced)**
- Requires direct database access to export `auth.users`
- Contact Supabase support for assistance

## iOS/Capacitor Configuration

The app is already configured for native platforms:
- ✅ PKCE flow enabled
- ✅ Capacitor Preferences storage adapter
- ✅ `detectSessionInUrl: false` on native
- ✅ Deep link scheme: `app.lovable.e07d9c457fd949f78f3cc7d5998be668://`

## Verification Checklist

### Web
- [ ] Sign in works
- [ ] Sign up creates user
- [ ] Profile data loads
- [ ] Images display from storage

### iOS
- [ ] Sign in completes without errors
- [ ] Session persists after app kill
- [ ] Deep links work for auth

## Troubleshooting

### "Invalid redirect URL" error
Add the redirect URL to your Supabase Auth settings

### Storage access denied
Check RLS policies on storage buckets

### Edge function 500 errors
Verify all secrets are configured correctly
