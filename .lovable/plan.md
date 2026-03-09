

# Plan: Full Targets & Commission System with Database Persistence

## Current State
The Commission page stores all data **in-memory only** — commission configs, targets, and payment entries are lost on page refresh. No database tables exist for this feature.

## What We'll Build

### Database: 3 New Tables

1. **`commission_configs`** — Per-executive commission settings controlled by admin
   - `id`, `executive_id` (uuid), `project_id` (uuid)
   - `enabled` (boolean, default false)
   - `type` ("percentage" | "fixed")
   - `rate` (numeric, default 5)
   - `apply_on` ("repeat_orders" | "all_orders" | "upsell_orders") — what triggers commission
   - `min_order_value` (numeric, default 0) — minimum order price to qualify
   - `max_commission_cap` (numeric, nullable) — cap per entry
   - `auto_generate` (boolean, default true) — auto-create entries for qualifying orders
   - `created_at`, `updated_at`
   - UNIQUE(executive_id, project_id)

2. **`sales_targets`** — Per-executive monthly/custom targets set by admin
   - `id`, `executive_id` (uuid), `project_id` (uuid)
   - `period_type` ("monthly" | "quarterly" | "custom")
   - `start_date` (date), `end_date` (date)
   - `target_orders` (integer, default 0)
   - `target_repeat_orders` (integer, default 0)
   - `target_revenue` (numeric, default 0)
   - `target_upsell_count` (integer, default 0)
   - `target_followups` (integer, default 0)
   - `is_active` (boolean, default true)
   - `created_at`, `updated_at`

3. **`commission_entries`** — Individual commission records (auto or manual)
   - `id`, `executive_id` (uuid), `project_id` (uuid)
   - `order_id` (uuid, nullable)
   - `order_invoice` (text)
   - `amount` (numeric)
   - `status` ("pending" | "paid" | "cancelled")
   - `source` ("auto" | "manual") — how it was created
   - `paid_date` (date, nullable)
   - `payment_note` (text, default '')
   - `paid_by` (uuid, nullable)
   - `created_at`

RLS: Admin can CRUD all three. SE can SELECT own records. All scoped by project_id.

### Commission Page Rebuild — Admin Controls

**Section 1: Global Commission Settings** (card at top)
- Master toggle: Enable/Disable commission system
- Default commission type (percentage/fixed) + default rate
- Apply on: repeat orders / all orders / upsell orders (radio)
- Min order value threshold
- Max commission cap toggle + value
- Auto-generate entries toggle

**Section 2: Per-Executive Configuration** (expandable cards)
Each executive card shows:
- Commission toggle (enable/disable)
- Override type (percentage/fixed) + rate (or "use default")
- Override apply-on rule
- Override min order value
- Override max cap
- Current period earnings summary
- "Edit Target" button → opens target dialog

**Section 3: Targets Management** (within each executive card or separate tab)
- Set target period: Monthly / Quarterly / Custom date range
- Target fields: Orders, Repeat Orders, Revenue, Upsell Count, Followups Completed
- Progress bars showing actual vs target
- Target status badges (On Track / Behind / Exceeded)

**Section 4: Commission Ledger** (table at bottom)
- All commission entries with filters (date, executive, status)
- Columns: Executive, Order, Date, Amount, Source (Auto/Manual), Status, Note, Action
- Admin actions: Mark Paid (with note), Cancel, Add Manual Entry
- Bulk mark as paid
- Summary row: Total / Paid / Pending

### Files to Create/Edit

1. **Migration SQL** — Create 3 tables with RLS + realtime
2. **`src/pages/CommissionPage.tsx`** — Complete rewrite with all sections above
3. **`src/components/CommissionConfigDialog.tsx`** — Dialog for editing per-executive config
4. **`src/components/SalesTargetDialog.tsx`** — Dialog for setting/editing targets
5. **`src/components/AddManualCommissionDialog.tsx`** — Dialog for manual commission entry

### Data Flow
- On page load: fetch `commission_configs`, `sales_targets`, `commission_entries` from DB
- Admin toggles/edits → upsert to DB immediately
- Commission entries auto-generated when orders qualify (checked on page load by comparing orders vs existing entries)
- Realtime subscriptions on all 3 tables + orders for live updates

