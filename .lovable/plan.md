

# Plan: Fix Build Errors + Remove Favicon

## 1. Fix Edge Function Build Errors

**`supabase/functions/manage-team/index.ts`**
- Replace all `supabaseAdmin.auth.admin.updateUser(userId, ...)` calls with `supabaseAdmin.auth.admin.updateUserById(userId, ...)`
- Fix `err.message` → `(err as Error).message` on line 569

**`supabase/functions/seed-demo-data/index.ts`**
- Fix `err.message` → `(err as Error).message` on line 295

**`supabase/functions/seed-demo-users/index.ts`**
- Fix `err.message` → `(err as Error).message` on line 159

## 2. Remove Favicon

**`index.html`**
- Remove `<link rel="icon" href="/favicon.ico">` (if present) or add `<link rel="icon" href="data:,">` to show no favicon

