# Phase 3.1 – Customer & Order Workspace Completion

Additive polish on top of the Phase 3 workspace. No redesign, no removal, fully backward compatible.

## Scope

Complete every section defined in the spec (1–14) inside `OrderWorkspacePage.tsx` using existing DB tables and hooks. All values come from live Supabase — never mocked.

## New Components (under `src/components/workspace/`)

- `WorkspaceHeaderSummary.tsx` — sticky top strip: Repeat Customer badge, Order #X of Y (or "First Order"), Lifetime Value, Customer Health, AI Score, Last Followup, Current Executive.
- `OrderPositionCard.tsx` — Order sequence intelligence: position, first/last order dates, days since first/last, repeat badge.
- `RelatedOrdersPanel.tsx` — Table of all customer orders + Prev/Next buttons; current row highlighted; row click loads that order in place.
- `OrderNavigator.tsx` — Compact vertical/horizontal chip list `Order 1 → 2 → … Current …`, clickable.
- `CustomerHeaderPanel.tsx` — Full customer identity + KPIs + stage + tags (uses `customer_tags`).
- `ImportInfoCard.tsx` — Reads `orders.import_run_id` → joins `import_runs` for source/health/AI-fixes/file-name; falls back to "Created Manually".
- `PaymentPanel.tsx` — COD, Shipping, COD Charge, timeline from `order_activity_logs` filtered by payment-related keys, BST time. Honors project rule: no fabricated Paid/Due beyond what `orders` exposes.
- `CourierPanel.tsx` — Courier company, tracking, invoice, rider name/phone, shipping, status, delivery timeline; explicit "Live courier API — coming soon" placeholder region.
- `OrderTimelinePanel.tsx` — All events for the current order from `order_activity_logs` (Created, Assigned, Reassigned, Edited, Product/Price/Courier/Payment/Delivery/Approval Updated, Followup Completed, Upsell, Repeat, Completed, Cancelled). Each row: user, BST date, BST time, reason.
- `CustomerTimelinePanel.tsx` — Extends existing `useCustomerTimeline` to include imports, exports (if logged), AI suggestions, followups, upsells, status changes, merges. Future-ready: renders "Customer Split" events if type present.
- `ActivityDiffViewer.tsx` — Renders `old_value → new_value` diff pills for any activity log row with change payload.
- `AIRecommendationCard.tsx` — Wraps `customer_ai_scores.recommendations`. Every card shows: action, confidence %, WHY, expected impact, priority chip (Low/Medium/High/Critical derived from confidence + churn/payment risk).

## New Hooks

- `useOrderPosition(customerId, currentOrderId)` — derives position, totals, first/last dates, days-since. Reuses `useCustomerOrders`.
- `useImportRunInfo(importRunId)` — fetches one `import_runs` row when present.
- `useOrderActivityLogs(orderId)` — paginated (25) fetch of `order_activity_logs`, realtime scoped by `order_id`.

## Data Sources (all existing)

- `orders`, `customers`, `customer_tags`, `customer_ai_scores`
- `order_activity_logs`, `followup_history`, `repeat_order_records`, `upsell_records`
- `import_runs` (via `orders.import_run_id`), `notifications`

No schema changes required. All new panels lazy-load with independent `enabled` flags and `React.Suspense` so switching orders stays instant.

## Wiring

`OrderWorkspacePage.tsx` composition (unchanged 3-column shell):

```text
┌─ WorkspaceHeaderSummary (sticky) ──────────────────────────────┐
├─ Left rail ──┬─ Center ─────────────────────┬─ Right rail ─────┤
│ CustomerHdr  │ Tabs:                        │ AI Recommendations│
│ OrderPosition│  Order Info | Courier |      │ Quick Actions    │
│ Tags         │  Payment | Followup |        │ AI Assistant     │
│ AI Score     │  Order Timeline |            │                  │
│ OrderNav     │  Customer Timeline |         │                  │
│ RelatedOrders│  Activity (Diff) | Import    │                  │
└──────────────┴──────────────────────────────┴──────────────────┘
```

Prev/Next buttons in `WorkspaceHeaderSummary` call `navigate(/orders/${siblingId}/workspace, { replace: true })` — React Router keeps rail state, only order-scoped hooks refetch.

## BST Formatting

Central helper `src/lib/bst.ts` (`formatBSTDate`, `formatBSTTime`, `formatBSTDateTime`) using `Asia/Dhaka` via `Intl.DateTimeFormat`. All new panels format timestamps through it.

## Performance

- Each panel owns its own React Query key `[workspace, section, id]` and enables independently.
- Timelines page 25 rows with "Load more".
- Order switch uses `replace: true` and prefetches sibling order via `queryClient.prefetchQuery` when hovering Prev/Next.
- Related Orders virtualization only kicks in above 100 rows.

## Regression Safety

- Existing `OrderDetailPage`, `OrdersPage`, `FollowupsPage`, `NotificationPanel`, `EditOrderDialog`, `CompleteFollowupDialog`, permission gates, RLS — untouched.
- Workspace route unchanged: `/orders/:orderId/workspace`.
- All writes still go through existing hooks (optimistic lock via `updated_at`).

## Out of Scope

- No new AI models beyond re-using `ai-customer-score`.
- No live courier API integration (placeholder region only).
- No Paid/Due ledger (respects existing project constraint).

## Deliverables

- ~11 new components, 3 new hooks, 1 utility file.
- Updated `OrderWorkspacePage.tsx` composition only.
- No migrations, no edge-function changes.
- Final report: components list, perf notes, regression checklist, Phase 4 roadmap.
