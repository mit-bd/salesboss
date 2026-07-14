
# SalesBoss AI Smart Import Engine

This is a large upgrade. To keep it safe and reviewable, I'll ship it in 3 sequential phases, each independently working, without breaking existing Orders/Customers/Followups/RLS.

## Phase 1 — Foundation (Data Model + Import Core)

**Database (migration):**
- `customers`: add analytics columns — `first_order_date`, `last_order_date`, `total_orders`, `delivered_orders`, `pending_orders`, `cancelled_orders`, `returned_orders`, `repeat_orders`, `lifetime_cod`, `lifetime_shipping`, `lifetime_value`, `avg_order_value`, `last_product`, `last_delivery_status`, `last_followup_at`, `last_executive_name`, `is_repeat_customer`, `stage`, `is_active`, `name_manually_edited` (bool, prevents import overwriting name).
- `orders`: add optional import fields — `external_order_id` (text), `tracking_code`, `invoice_no`, `delivery_status`, `approval_status`, `delivery_time`, `rider_name`, `rider_phone`, `shipping_charge` (numeric), `cod_charge` (numeric), `payment_status`, `recipient_name` (per-order original name).
- New table `import_mapping_templates` (project-scoped, RLS by `project_id`): `id, project_id, name, source_hint, header_signature (text[]), mapping (jsonb), created_by, created_at, updated_at, usage_count`.
- New table `import_runs` (audit): `id, project_id, user_id, user_name, source_filename, total_rows, imported, updated_count, skipped, duplicates, new_customers, existing_customers, repeat_orders, ai_fixed_fields, missing_mandatory, invalid_phone, invalid_cod, processing_ms, report jsonb, created_at`. RLS: project members read, service_role write.
- New RPC `recalc_customer_analytics(p_customer_id uuid)` — SECURITY DEFINER, recomputes all lifetime stats from `orders` for that customer.
- Trigger on `orders` INSERT/UPDATE/DELETE → call recalc for affected customer(s). Trigger on `followup_history` insert → update `customers.last_followup_at`, `last_executive_name`.
- Update `find_or_create_customer`: never overwrite `name` when `name_manually_edited = true`; when false, keep the first non-empty name (do not overwrite).
- GRANTs on all new tables (`authenticated` SELECT/INSERT/UPDATE, `service_role` ALL).

**Edge function `ai-import-cleaner` (rewrite):**
- Inputs: `{ rows, headers, projectId }`.
- Uses Lovable AI (`google/gemini-3.5-flash`) with structured tool output.
- Detects source (Steadfast/Pathao/RedX/Paperfly/Sundarban/Shopify/Woo/Custom) from header signature.
- Returns: canonical column mapping (extended field set), per-row cleaned values, per-row corrections list, per-row `needsReview`, and a header-signature suggestion for template save.
- Normalizes phones to `01XXXXXXXXX` (strip `+880`/`880`/leading `1`), dates to `YYYY-MM-DD`, statuses to canonical set (Delivered/Pending/Cancelled/Returned/In Transit/Hold), COD/prices to numeric, trims/whitespace/encoding.
- Batches of 50, backoff on 429, surfaces 402/429 to UI.

**UI rewrite `src/pages/BulkImportPage.tsx`** as multi-step wizard component tree under `src/components/import/`:
1. **Upload** — CSV/XLSX (SheetJS `xlsx`) drop zone. Remove misleading Sheets input.
2. **Mapping Preview** — auto-detected mapping with editable dropdowns for each canonical field (required: Order ID, Recipient Name, Recipient Phone, Recipient Address, COD Amount; optional set above). "Save as template" + "Load template" using `import_mapping_templates`.
3. **AI Analyze & Clean** — calls edge function, shows before/after diff per row, corrections list, confidence.
4. **Simulation** — computed counts: safe / duplicate order IDs / invalid phone / missing mandatory / invalid COD / AI-fixed fields / new customers / existing customers / repeat orders. Continue button.
5. **Duplicate Resolution Center** (new component) — one row per duplicate `external_order_id` within project, showing existing vs incoming; options Update / Skip / Create Anyway (with confirm), plus "Apply to all". Persist decisions in local state.
6. **Import Execution** — streaming progress ("Analyzing / Cleaning / Checking Customer / Checking Duplicate / Creating Orders / Finalizing"), batches of 200, per-row status. Only rejects rows missing mandatory fields; optional-field errors imported with warning.
7. **Report** — full metrics + downloadable CSV of skipped/failed rows + writes `import_runs` row + logs activity via `useActivityLog`.

## Phase 2 — Customer Profile Upgrade

- Extend `CustomerProfilePage` to render the new analytics fields (first/last order, totals by status, lifetime COD/shipping/value, AOV, last product/status/followup/exec, stage, active, repeat).
- Add computed cards: Days Since Last Order, Days Since Last Followup, Customer Health Score (rule: active <30d = healthy, 30–60d = at-risk, >60d = churning), Risk of Losing (derived), Repeat Purchase Rate.
- Name field: only Admin/Sub Admin can edit; on save sets `name_manually_edited = true`.

## Phase 3 — Templates Management + Activity

- Settings section (Admin-only) to view/rename/delete import templates.
- Every import writes to Activity Log + `import_runs` (BST timestamp).

## Technical details

```text
UI wizard flow:
  Upload → Mapping → AI Clean → Simulate → Duplicates → Execute → Report
              │           │
              └─ Save/Load Templates (project-scoped)
```

- Concurrency: keep existing batch pattern (200 rows/batch, `Promise.all` inside batch). Duplicates checked in one `SELECT external_order_id FROM orders WHERE project_id=? AND external_order_id = ANY(?)` before execution.
- Security: all writes go through authenticated Supabase client; `find_or_create_customer(p_project_id)` variant used explicitly; edge function verifies JWT and resolves `project_id` server-side.
- No mock data, no hardcoded mappings (aliases live in edge function AI prompt + learned templates in DB).
- Files touched: migration; `supabase/functions/ai-import-cleaner/index.ts`; new `src/components/import/*` (UploadStep, MappingStep, CleanStep, SimulationStep, DuplicateResolutionStep, ExecuteStep, ReportStep); rewrite `src/pages/BulkImportPage.tsx`; extend `src/pages/CustomerProfilePage.tsx`; add `src/hooks/useImportTemplates.ts`.

## Scope guardrails

- No changes to Followup, Permissions, AI Copilot, Owner Panel, RLS on existing tables (only new columns + new tables).
- Existing Orders schema stays backward-compatible: new columns are nullable.
- If you approve, I'll execute Phase 1 first (migration + edge function + wizard), verify build, then Phase 2, then Phase 3 — in follow-up turns.

Approve to proceed with Phase 1?
