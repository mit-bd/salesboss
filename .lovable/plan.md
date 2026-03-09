

# Plan: Collapsible Followups Menu with Live Step Counts

## What Changes

**`src/components/layout/AppSidebar.tsx`** — Make "Followups" a collapsible parent item that expands to show Steps 1-5 with live order counts from `useOrderStore`.

### Current State
Steps 1-5 are flat items in the sidebar always visible under Orders category. No order counts shown.

### New Behavior
- "Followups" becomes a clickable/expandable parent item
- Clicking the arrow expands to reveal 5 sub-items: "1st Followup (12)", "2nd Followup (3)", etc.
- Clicking the label itself still navigates to `/followups`
- Each step shows pending order count as a badge: e.g. `Step 1 (24)`
- Remove the 5 standalone followup step items from the flat nav list
- Counts come from `useOrderStore().activeOrders` filtered by `followupStep` and `currentStatus === 'pending'`

### Implementation
1. Remove the 5 `?step=N` items from `navCategories`
2. Add a `hasChildren` or `children` field to the `NavItem` interface for Followups
3. In the render, detect the Followups item and render it with a collapsible sub-menu
4. Import `useOrderStore` to compute per-step pending counts
5. Each sub-item shows a count badge (small pill) next to the label
6. Expand/collapse state stored alongside category expand state

### Files
- **Edit**: `src/components/layout/AppSidebar.tsx`

No database changes needed.

