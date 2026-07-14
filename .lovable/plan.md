
# Epic 01 — AI Customer Intelligence Platform

This is a very large epic (Sections A–S). To ship it safely on top of the existing SalesBoss architecture (Phases 1–3.1 already live), I'll deliver it in **6 milestones**, each production-ready, regression-tested, and backward compatible. I'll confirm scope with you before starting, then execute milestones one at a time so you can review after each.

## Discovery (already scanned)

**Existing AI surface I will extend, not duplicate:**
- Edge fns: `ai-assistant`, `ai-customer-score`, `ai-followup-insight`, `ai-import-cleaner`, `ai-address-normalizer`
- Tables: `customer_ai_scores`, `customer_tags`, `customers` (27 cols incl. stage, LTV, repeat metrics), `orders`, `followup_history`, `upsell_records`, `repeat_order_records`, `order_activity_logs`, `import_learning_suggestions`, `product_aliases`
- Hooks: `useCustomerAIScore`, `useCustomerTags`, `useOrderMetrics`, `useCustomerTimeline`, `useOrderActivityLogs`, etc.
- Workspace: Phase 3.1 components (`WorkspaceHeaderSummary`, `AIRecommendationCard`, `RelatedOrdersPanel`, etc.)
- Automation: `run_followup_automation` pg_cron, `recalc_customer_analytics`, `apply_customer_tags` triggers
- Multi-tenant RLS by `project_id` via `get_user_project_id` + `has_role`

**No duplication rule:** I will extend `customer_ai_scores` (add columns) and reuse existing triggers rather than create parallel tables.

## Milestones

### M1 — Customer AI Profile schema + Memory Engine (Sections A, B, L, M, P, Q)
- **Schema extension** (single migration):
  - `customer_ai_profiles` — one row per customer (personality, buying_behaviour, purchase_pattern, price_sensitivity, product_preference, preferred_language, preferred_call_time, preferred_executive_id, preferred_payment, preferred_courier, loyalty_score, lifetime_trend, ai_confidence, evidence jsonb, locked_fields text[], updated_at). Extending, not replacing, `customer_ai_scores`.
  - `customer_memory_events` — normalized memory log (conversations, objections, promises, complaints, rejections) sourced from `followup_history` + `order_activity_logs` via view + incremental job.
  - GRANTs + RLS scoped by `project_id`; `locked_fields` prevents overwrite of manually confirmed data.
- **Edge fn** `ai-customer-profile` — computes/refreshes profile from real data (orders, followups, upsells, repeats). Caches 24h. Explains WHY (evidence jsonb).
- **Triggers**: extend existing `trg_orders_recalc_customer` + `trg_followup_touch_customer` to enqueue profile refresh (dirty flag column), processed by edge fn — no synchronous AI in triggers.

### M2 — Prediction engines (Sections C, D, E, F, G)
- Extend `customer_ai_scores.recommendations` shape (already jsonb) to include: `buying_stage`, `repeat_prediction`, `upsell_prediction`, `churn_prediction`, `best_call_time`. No new table.
- Edge fn `ai-customer-score` upgraded to compute all five in one pass with confidence + reason + evidence + suggested action + priority.
- Frontend: reuse `AIRecommendationCard` — add new panels in workspace (RepeatPredictionCard, UpsellPredictionCard, ChurnRiskCard, BestCallTimeCard, BuyingStageCard). All derive from real DB history.

### M3 — Dashboards (Sections I, J, N)
- New page `AIOwnerDashboardPage` (route `/ai/owner`) — top customers, at-risk, forecast, expected repeats/upsells/churn, team perf, insights. Data comes from aggregations of existing tables + `customer_ai_scores`.
- New page `AIExecutiveDashboardPage` (route `/ai/today`) — today's priorities, hot customers, missed followups, suggested scripts, daily goal — scoped to `auth.uid()` executive.
- Edge fn `ai-business-insights` — daily/weekly/monthly insight generator, cached in new `ai_insights` table (project_id, period, kind, payload, generated_at).

### M4 — Sales Coach + Segmentation (Sections H, K)
- Edge fn `ai-sales-coach` — per-executive: conversion, repeat rate, upsell rate, avg revenue, avg response time, missed followups, improvement suggestions. Cached in `ai_coach_reports` (executive_id, period, payload).
- Segmentation runs inside existing `apply_customer_tags` — extend with AI-driven tags (High Repeat, High Upsell, High Risk, Wholesale/Retail heuristics) added by profile edge fn as `assigned_by='ai'`.

### M5 — AI Assistant commands + Automation hooks (Sections O, P)
- Extend `ai-assistant` edge fn with structured command parser: "who should I call today", "show risky customers", "generate today's work plan", "generate executive report", etc. Each command runs a scoped SQL query and returns structured results the assistant renders.
- Ensure every relevant DB change enqueues profile refresh (orders, followups, upsells, repeats, delivery, import, manual edit).

### M6 — Performance, Security, Regression, Final QA (Sections Q, R, S)
- **Perf**: indexes on `customer_memory_events(customer_id, occurred_at)`, `customer_ai_scores(expires_at, project_id)`; response caching in edge fns; batch profile refresh; incremental updates only for dirty customers.
- **Security**: every new edge fn validates JWT, resolves `project_id` from profile, uses service role only for writes to profile tables. No RLS bypass in queries returned to client.
- **Regression pass**: Orders, Workspace, Customers, Import, Followup, AI Assistant, Owner/Exec Dashboards, Permissions, Realtime, Notifications, Billing. Fix issues found.
- **Cleanup**: remove any dead hooks superseded by new ones; consolidate duplicate AI fetch logic into shared `useAiProfile` / `useAiPredictions` hooks.

## Deliverables per milestone
Each milestone ends with: files list, migration summary, regression checklist, and readiness note. Final report after M6 covers everything requested in "FINAL REPORT".

## Out of scope (called out explicitly)
- No new AI model providers — continues on Lovable AI Gateway (`openai/gpt-5.5` default, cheaper models for high-volume classification).
- No live courier API integration (Phase 3.1 already stubbed).
- No changes to overall UI design system, sidebar structure, or existing pages beyond additive panels.

## Confirm before I start

Two things I need before executing M1:

1. **Scope confirmation** — proceed with all 6 milestones in order, pausing after each for review? Or condense into fewer/larger deliveries?
2. **AI cost posture** — profile refresh is expensive at scale. Default plan: refresh a customer's profile at most once every 24h, and only when there's new activity (dirty flag). OK, or do you want manual-only refresh with a "Refresh AI" button?

Once you confirm, I start M1 immediately with the schema migration.
