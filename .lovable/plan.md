

## Add Password Visibility Toggle for Owner User Manager

### Context

Passwords in the authentication system are hashed and cannot be retrieved. To support the owner's ability to view user passwords, we need to:

1. Store a copy of the password (encrypted at rest by the database) in the `profiles` table when a user is created or their password is reset.
2. Add a new edge function action to retrieve this stored password for the owner.
3. Add an eye toggle button in the User Profile dialog.

### Database Changes

**Migration**: Add `password_text` column to `profiles` table.

```sql
ALTER TABLE public.profiles ADD COLUMN password_text text;
```

- RLS policies already restrict direct profile access; this column is only read via the edge function with owner-role validation.

### Backend Changes

**`supabase/functions/manage-team/index.ts`**:

1. **`owner_create_user` action**: After creating the user, also store `password` into `profiles.password_text` for that user.

2. **`owner_reset_password` action**: After resetting the password, update `profiles.password_text` with the new password.

3. **New `owner_get_password` action**: Returns the `password_text` from `profiles` for a given `userId`. Only accessible by owner role.

### Frontend Changes

**`src/pages/OwnerUsersPage.tsx`**:

1. Add `showPassword` state (boolean) and `viewPassword` state (string) to the view dialog section.
2. Replace the static "●●●●●●●●" text with a toggleable display:
   - Default: shows dots
   - On eye click: calls `owner_get_password` action to fetch and display the stored password
3. Add an `Eye`/`EyeOff` icon button next to the password dots.
4. Reset `showPassword` state when the dialog closes.

```text
Password: ●●●●●●●●  [👁]     ← default (hidden)
Password: mypass123  [👁‍🗨]    ← after clicking eye
```

### Security Notes

- Only the owner role can access `owner_get_password`
- Password text is stored alongside existing profile data, protected by existing RLS
- The eye toggle fetches on-demand rather than preloading

