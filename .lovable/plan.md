

# Complete Data Migration to External Supabase Project

## Overview

Migrating all data from your current Lovable Cloud backend (`wjbyvlgsxscwukkolehg`) to your external project (`waafzlorvnozeujjhvxu`).

## Current Data Summary

| Category | Count |
|----------|-------|
| Tables | 121 tables |
| User Profiles | 31 users |
| Posts | 5 |
| Messages | 19 |
| Conversations | 9 |
| Events | 3 |
| Projects | 1 |
| Stores | 2 |
| Pipeline Items | 12 |
| Storage Files | 151 total (media: 113, contact-media: 26, contact-avatars: 7, board-uploads: 5) |
| Edge Functions | 32 functions |

---

## Important Limitation

**Lovable cannot directly connect to or modify your external Supabase project.** The migration requires manual execution using:
- Supabase Dashboard SQL Editor
- Supabase CLI for edge functions and storage
- Direct database access for data export/import

---

## Step-by-Step Migration Checklist

### Phase 1: Schema Migration (Run in SQL Editor)

Execute these SQL files in your external project's SQL Editor (`https://supabase.com/dashboard/project/waafzlorvnozeujjhvxu/sql`):

1. **Run `01-schema.sql`** - Creates all 121 tables and enums
2. **Run `02-functions.sql`** - Creates 21 database functions
3. **Run `03-triggers.sql`** - Sets up all triggers
4. **Run `04-views.sql`** - Creates database views
5. **Run `05-rls-policies.sql`** - Applies ~125 Row Level Security policies
6. **Run `06-storage.sql`** - Creates storage buckets with policies
7. **Run `08-realtime.sql`** - Enables realtime on key tables

### Phase 2: Data Migration

**Option A: Fresh Start (Recommended for Beta Apps)**
- Skip data migration
- Users will need to re-register
- Cleanest approach for iOS launch

**Option B: Export and Import Data**
Since Lovable manages your current database, you have two options:

1. **Via Supabase CLI (if you have direct access)**
   ```bash
   # Export from current project
   pg_dump postgresql://postgres:[SERVICE_ROLE_KEY]@db.wjbyvlgsxscwukkolehg.supabase.co:5432/postgres \
     --data-only --no-owner > data-export.sql
   
   # Import to new project
   psql postgresql://postgres:[SERVICE_ROLE_KEY]@db.waafzlorvnozeujjhvxu.supabase.co:5432/postgres \
     < data-export.sql
   ```

2. **Manual Table-by-Table Export**
   Use the Supabase Table Editor to export each table as CSV and import into the new project.

### Phase 3: Storage Migration

Download files from current buckets and upload to the new project:

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Download from source (requires service role access)
supabase storage download media/* --project-ref wjbyvlgsxscwukkolehg -o ./backup/media

# Upload to target
supabase storage upload ./backup/media media/ --project-ref waafzlorvnozeujjhvxu
```

Repeat for: `contact-media`, `contact-avatars`, `board-uploads`

### Phase 4: Edge Function Deployment

```bash
cd supabase/functions
supabase link --project-ref waafzlorvnozeujjhvxu
supabase functions deploy
```

### Phase 5: Configure Secrets

In your new Supabase Dashboard → Edge Functions → Secrets, add:

| Secret | Get Value From |
|--------|----------------|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → API Keys |
| `RESEND_API_KEY` | Resend Dashboard |
| `MUX_TOKEN_ID` | Mux Dashboard |
| `MUX_TOKEN_SECRET` | Mux Dashboard |
| `TWILIO_ACCOUNT_SID` | Twilio Console |
| `TWILIO_AUTH_TOKEN` | Twilio Console |
| `TWILIO_PHONE_NUMBER` | Your Twilio number |
| `VAPID_PRIVATE_KEY` | Generate new or copy existing |
| `VAPID_PUBLIC_KEY` | Generate new or copy existing |

### Phase 6: Configure Auth URLs

In Supabase Dashboard → Authentication → URL Configuration:

**Site URL:**
```
https://lcove.lovable.app
```

**Redirect URLs (add all):**
```
app.lovable.e07d9c457fd949f78f3cc7d5998be668://
capacitor://localhost
https://id-preview--e07d9c45-7fd9-49f7-8f3c-c7d5998be668.lovable.app
https://lcove.lovable.app
```

### Phase 7: Update App Environment

**This step requires exporting your project to GitHub:**

1. Export project from Lovable to GitHub
2. Clone the repository locally
3. Update the `.env` file:
   ```env
   VITE_SUPABASE_URL=https://waafzlorvnozeujjhvxu.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhYWZ6bG9ydm5vemV1ampodnh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzODk5NzQsImV4cCI6MjA4MTk2NTk3NH0.KpcERd3mctTaR5UUU_Ev6hhpDLc4dNua4Nd5kqVbZBI
   VITE_SUPABASE_PROJECT_ID=waafzlorvnozeujjhvxu
   ```
4. Commit and push changes

### Phase 8: User Authentication Migration

Users cannot be directly migrated due to password hashing. Options:

1. **Password Reset Flow (Recommended)**
   - Send password reset emails to all users
   - Users set new passwords on the new system

2. **Contact Supabase Support**
   - For enterprise needs, Supabase can assist with auth user migration

---

## Technical Details

### Files Already Prepared

All migration SQL files are in the `/migration` directory:
- `01-schema.sql` (2,117 lines) - Complete schema
- `02-functions.sql` (465 lines) - 21 database functions
- `03-triggers.sql` - All triggers
- `04-views.sql` - Database views
- `05-rls-policies.sql` - ~125 RLS policies
- `06-storage.sql` (136 lines) - 4 storage buckets + policies
- `08-realtime.sql` - Realtime configuration

### Code Changes Required After Migration

Once on the external project, update in `capacitorStorage.ts`:

```typescript
// Update storage keys to match new project
const authKeys = [
  'sb-waafzlorvnozeujjhvxu-auth-token',
  'sb-waafzlorvnozeujjhvxu-auth-token-code-verifier',
  'supabase.auth.token',
];
```

---

## Verification Checklist

After migration, verify:

- [ ] Schema created (121 tables visible in Table Editor)
- [ ] Functions deployed (check Database → Functions)
- [ ] RLS policies active (check Table Editor → Policies)
- [ ] Storage buckets created (4 buckets)
- [ ] Edge functions deployed (32 functions)
- [ ] Auth sign-in works
- [ ] Auth sign-up creates user with profile
- [ ] iOS deep links work for auth
- [ ] Data appears in app (if migrated)

---

## Alternative: Keep Using Lovable Cloud

If the migration complexity is too high, consider:
- Continue using Lovable Cloud for development and production
- Lovable Cloud provides the same Supabase capabilities
- No manual migration steps required
- You can always export later when needed

