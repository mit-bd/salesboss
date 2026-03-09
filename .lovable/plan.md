

# Plan: Sales Executive Edit/Delete + Live Commission Page

## Problem
1. Sales Executives page has no edit/delete actions
2. Commission page uses **mock data** (`mockSalesExecutives`, `mockCommissionConfigs`, etc.) instead of real database data
3. No connection between the two pages

## Approach

### 1. Add `delete_user` action to manage-team Edge Function
- Add a new admin action `delete_user` that deletes the user from auth, profiles, user_roles
- Unassign any orders assigned to the deleted user (set `assigned_to = null`, `assigned_to_name = ''`)

### 2. Update Sales Executives Page
- Add Edit and Delete action buttons per row (visible to admin only, via dropdown menu or inline buttons)
- **Edit**: Opens `AddTeamMemberDialog` in edit mode (reuse existing component)
- **Delete**: Opens confirmation dialog, calls `manage-team` with `delete_user` action, then refreshes data
- Stop row click from triggering navigation when clicking action buttons (use `e.stopPropagation()`)

### 3. Migrate Commission Page from Mock to Real Data
- Replace `mockSalesExecutives` with real executives fetched from `user_roles` + `profiles` (same pattern as SalesExecutivesPage)
- Replace `mockOrders` with real orders from Supabase
- Remove mock commission configs/entries — derive commission data from real orders or keep commission configs in local state for now (no DB table for commission yet)
- Target progress computed from real order data per executive
- When an SE is deleted from the SE page, they disappear from Commission page automatically since both read from the same source

### Files to Edit
- **`supabase/functions/manage-team/index.ts`** — Add `delete_user` action (delete auth user, clean up roles/profiles, unassign orders)
- **`src/pages/SalesExecutivesPage.tsx`** — Add Actions column with Edit/Delete buttons, edit dialog integration, delete confirmation dialog
- **`src/pages/CommissionPage.tsx`** — Replace all mock data with real Supabase queries matching the executives list, compute targets/commission from real orders
- **`src/components/AddTeamMemberDialog.tsx`** — Minor: ensure it works when opened from SE page context (it already supports `editMember` prop)

### Technical Details
- Delete user edge function: `supabaseAdmin.auth.admin.deleteUser(userId)` + cleanup `user_roles`, `profiles` rows, and unassign orders
- Both pages fetch from `user_roles` where `role = 'sales_executive'`, ensuring consistency
- Commission configs remain in-memory state (no DB table exists) — when SE list changes, configs auto-sync

