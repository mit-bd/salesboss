

# Plan: Comprehensive Sales Executive Profile Page

## Current State
The `SalesExecutiveDetailPage` shows basic KPIs (revenue, order count, followups done, pending) and a simple order table with tabs for All/Repeat/Upsell. It lacks detailed followup stage breakdown, overdue detection, today's followups, and per-order followup status visibility.

## What We'll Build

Rebuild `src/pages/SalesExecutiveDetailPage.tsx` into a full executive profile dashboard with these sections:

### Section 1: Profile Header
- Executive name with avatar initials
- Quick stats inline: Total Orders, Revenue, Commission earned (from `commission_entries`)

### Section 2: Enhanced KPI Cards (8 cards, 2 rows)
- Total Assigned Orders
- Revenue
- Followups Completed (total from `followup_history`)
- Followups Remaining (orders where `current_status = 'pending'`)
- Overdue Followups (pending orders where `followup_date < today`)
- Today's Followups (pending orders where `followup_date = today`)
- Repeat Orders count
- Upsell Orders count

### Section 3: Followup Stage Breakdown
- Visual pipeline showing Steps 1-5 with counts per step
- Each step shows: pending count, completed count
- Color-coded progress indicators
- Overdue orders highlighted in red per step

### Section 4: Alert Cards
- **Today's Followups**: list of orders due today with quick links
- **Overdue Followups**: list of overdue orders with days-overdue badge, sorted by most overdue first

### Section 5: Charts (existing, enhanced)
- Revenue Over Time (bar chart)
- Orders Over Time (line chart)

### Section 6: Tabbed Order Tables (enhanced)
- **All Orders** — with Status column (Pending/Completed badge), Followup Step, overdue indicator
- **Pending** — only pending orders, sorted by followup_date ASC (most urgent first)
- **Overdue** — only overdue orders
- **Today** — orders due today
- **Repeat** / **Upsell** tabs

### Data Fetching
- Already fetches orders + followup_history
- Additionally fetch: `commission_entries` for this exec, `sales_targets` for this exec
- Add target progress section if target exists

### File Changes
- **`src/pages/SalesExecutiveDetailPage.tsx`** — Complete rewrite with all sections above

No database changes needed — all data already exists in orders, followup_history, commission_entries, and sales_targets tables.

