# Phase 3 — SalesBoss Enterprise Customer & Order Workspace

Additive, backward compatible. The existing "Edit Order" modal stays wired for legacy callers; a new full-page workspace becomes the primary surface when opening an order.

## Route & entry points

- New route `/orders/:orderId/workspace` (lazy-loaded), permission-gated by existing order-view rules; RLS handles data.
- Row "Open" / order id click in Orders, Repeat Orders, Followups, Notifications, Customer Profile deep-links to the workspace instead of the modal.
- Keep the current inline edit modal available for bulk-edit / quick contexts; no removal.

## Layout

Desktop (>=1280px): 3-column shell inside existing `AppLayout`.
- Left rail (300px): Customer Header, Tags, Customer Intelligence, AI Score, Repeat Orders list with prev/next nav.
- Center (fluid): Tabs — Order Info · Courier · Payment · Followup · Timelines · Activity · Import.
- Right rail (360px, collapsible): AI Sales Assistant + Quick Actions + AI Recommendations.

Tablet (768–1279): 2-column (left rail collapsible drawer, center + right rail toggled by button).
Mobile: single column with sticky tab bar (already supported patterns).

```text
+----------------+-----------------------------+-------------+
| Customer       | Order header + tabs         | AI Panel    |
| Intelligence   | (Info/Courier/Payment/...)  | Quick Acts  |
| Repeat Orders  |                             | Recs        |
+----------------+-----------------------------+-------------+
```

## Sections (all backed by real DB — no mocks)

1. **Customer Header** — from `customers` + `customer_tags` (VIP/Repeat/High Value/Dormant color-coded chips). Photo placeholder using initials avatar.
2. **Order Header** — `orders` + computed "Order #N of M" via `customer_id` ordering.
3. **Customer Intelligence** — reads existing computed fields on `customers` (lifetime_value, aov, delivered/pending/cancelled/returned, repeat_orders, last_product, last_order_date, last_followup_at, last_executive_name, stage).
4. **AI Customer Score** — new edge function `ai-customer-score` (Lovable AI, `google/gemini-2.5-flash`) returns JSON: {health, repeat_prob, upsell_prob, churn_risk, payment_risk, engagement, overall, reasons{}}. Cached to new `customer_ai_scores` table (24h TTL, per customer). "Why" text stored alongside each score.
5. **Repeat Order Intelligence** — list all orders for `customer_id`, click to switch workspace context. Prev/Next arrows in order header.
6. **Order Information** — editable form using existing order-edit hooks + optimistic locking (`updated_at`). Reuses the same field validators as the current modal so activity logs continue to fire.
7. **Courier Panel** — reads `delivery_method`, `tracking_code`, `shipping_charge`, `cod_charge`, `delivery_status`, history via `order_activity_logs` filtered to courier fields. API integration = placeholder card.
8. **Payment Panel** — Amount only (per project rule: no Paid/Due/Payment Status invented). Shows COD amount, shipping, total, and payment-related activity log entries. NOTE: project memory forbids Paid/Due/Payment Status — this panel surfaces amounts + status only, no fabricated fields.
9. **Customer Timeline** — extends existing `useCustomerTimeline` to include: order created, repeat order, followup, upsell, delivery status changes, customer edits, AI suggestions, imports. All timestamps rendered in BST.
10. **Order Timeline** — new hook `useOrderTimeline` merging: order row create/update, `order_activity_logs`, `followup_history`, assignment changes, status changes.
11. **Activity History** — existing `order_activity_logs` in old→new diff view (Old ↓ New, editor, BST time).
12. **Followup Panel** — reuses existing followup components (problem checklist, quick info, AI script). Wires "AI Suggested Next Action" from `ai-customer-score` reasons.
13. **AI Sales Assistant** — right-rail chat, uses existing `ai-copilot` function extended to accept `{customer_id, order_id}` context. Actions gated by `has_permission`.
14. **Quick Actions** — buttons hitting existing flows (New Order, Repeat Order, Create Followup, Assign, Change Status, Generate Invoice, Print, Export, Open Customer Profile).
15. **Import Information** — reads `import_runs` joined by `orders.import_run_id` (add nullable column if missing) → Imported By, Date/Time (BST), Source, Batch, Health Score, AI Corrections count.
16. **AI Recommendations** — same `ai-customer-score` payload: recommended product/upsell/followup time, risk, next best action; each carries confidence + explanation.

## Mobile number protection

- On phone edit, `find_or_create_customer` semantics check:
  - Same project + new number belongs to a different customer → open confirm dialog "Merge orders into existing customer / Move this order only / Cancel".
  - No collision → warn "Changing phone updates customer identity" then proceed.
- No silent rewrites. Implemented in a new hook `usePhoneChangeGuard`.

## Database (single migration)

- `customer_ai_scores` (customer_id PK, project_id, scores jsonb, reasons jsonb, model text, generated_at, expires_at). RLS by project_id. GRANTs to authenticated/service_role.
- `orders.import_run_id uuid null` + index (if column missing) so Import Info panel joins cleanly.
- No changes to Paid/Due/Payment Status (respect memory rule).

## Edge functions

- `ai-customer-score` — accepts `{customer_id}`, pulls customer + orders + followups server-side, calls Lovable AI Gateway (`google/gemini-2.5-flash`) with strict JSON output, upserts cache row, returns scores + reasons.
- Extend `ai-copilot` (existing) to accept optional `customer_id` / `order_id` for contextual chat.

## New frontend files

Hooks:
- `useOrderWorkspace(orderId)` — order + customer + tags + siblings prev/next.
- `useCustomerOrders(customerId)` — paginated list for repeat-orders rail.
- `useOrderTimeline(orderId)`.
- `useCustomerAIScore(customerId)` — reads cache, triggers regen if stale.
- `usePhoneChangeGuard()`.
- `useImportContext(orderId)` — import_run + health + corrections.

Components (under `src/components/workspace/`):
- `WorkspaceLayout.tsx`
- `CustomerHeaderCard.tsx`, `CustomerTagsRow.tsx`
- `OrderHeaderBar.tsx` (with prev/next + "Order N of M")
- `CustomerIntelligencePanel.tsx`
- `AICustomerScoreCard.tsx`
- `RepeatOrdersRail.tsx`
- `OrderInfoTab.tsx`
- `CourierPanel.tsx`
- `PaymentPanel.tsx`
- `CustomerTimelineTab.tsx`
- `OrderTimelineTab.tsx`
- `ActivityHistoryTab.tsx`
- `FollowupPanelTab.tsx` (wraps existing followup UI)
- `ImportInfoCard.tsx`
- `AIRecommendationsCard.tsx`
- `AISalesAssistantPanel.tsx`
- `QuickActionsBar.tsx`
- `PhoneChangeConfirmDialog.tsx`

Page: `src/pages/OrderWorkspacePage.tsx`, added to `App.tsx` router (lazy).

Router entry points updated in: `OrdersPage`, `RepeatOrdersPage`, `FollowupsPage`, `CustomerProfilePage`, notification handlers.

## Performance

- Each panel is its own hook with independent `enabled` flags.
- Timelines paginated (25 rows, "load more").
- Repeat orders rail: server-side paginated 25/page.
- AI score cached 24h in `customer_ai_scores`; recompute on manual refresh only.
- Realtime subscription scoped to current order id + customer id only.

## Security

- All new tables RLS by `project_id` using `get_user_project_id(auth.uid())`.
- AI edge functions verify caller JWT, resolve `project_id`, and enforce customer belongs to caller's project before returning.
- Quick Actions call existing permission-checked mutations; AI cannot bypass.

## Regression checklist

Orders list, Repeat Orders, Bulk Import wizard, Followup pipeline + automation, Notifications, AI Copilot legacy chat, Activity Logs, Permissions matrix, multi-tenant isolation — all must remain green. The legacy edit modal stays for bulk contexts.

## Out of scope (next phase)

- AI Customer Intelligence dashboard (cohorts, cross-customer trends).
- Courier API live integration.
- Full "Paid/Due" ledger (would require reversing existing product rule — needs explicit user decision).

## Technical notes

- BST rendering via existing time util; no new tz code.
- Reuses existing shadcn tokens, Sidebar, Popover/Calendar patterns. No design-system changes.
- Uses `React.lazy` + `Suspense` for the workspace route to keep initial bundle unchanged.
