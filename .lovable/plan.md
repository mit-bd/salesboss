# Phase 2.5 — Complete the AI Smart Import Engine

Extends Phase 1 + Phase 2. Nothing existing is removed or redesigned. Every new capability is additive and backward compatible.

## 1. Database (single migration)

New tables (all project-scoped, RLS via `get_user_project_id(auth.uid())`, GRANT to authenticated + service_role):

- `import_queue` — background job rows: `import_run_id`, `project_id`, `status` (queued/running/paused/failed/completed/cancelled), `batch_index`, `total_batches`, `payload_ref` (storage path), `attempts`, `last_error`, `worker_id`, `started_at`, `finished_at`.
- `import_batches` — per-batch state: `import_run_id`, `batch_index`, `row_start`, `row_end`, `status`, `rows_ok`, `rows_failed`, `duration_ms`, `error_category`, `error_message`, `retry_count`.
- `import_audit_events` — permanent audit: `import_run_id`, `project_id`, `actor_user_id`, `actor_name`, `action` (started/resumed/paused/cancelled/completed/failed/retry_batch), `device`, `browser`, `ip`, `bst_timestamp`, `metadata jsonb`.
- `import_learning_suggestions` — pending → approved pipeline: `project_id`, `kind` (product_alias/status_alias/column_map/date_format/address_format/courier_field), `input_value`, `suggested_value`, `confirmations`, `status` (pending/approved/rejected), `promoted_at`, `last_seen_at`.
- `import_errors` — categorized errors: `import_run_id`, `batch_index`, `row_index`, `category` (validation/ai/database/permission/duplicate/network/timeout/file_format/unknown), `why`, `recommended_fix`, `retryable bool`, `resolved bool`.

Extend `import_runs`: add `file_storage_path`, `file_hash`, `total_batches`, `processed_batches`, `speed_rows_per_sec`, `memory_peak_kb`, `queue_wait_ms`, `resumed_from_row`, `resumed_by`, `resumed_at`, `cancelled_by`, `cancelled_at`, `device`, `browser`, `ip`, `template_id`, `courier_name`.

Extend `import_mapping_templates`: `success_count`, `fail_count`, `avg_health_score`.

New storage bucket: `import-uploads` (private, RLS: only project members can read/write objects under `project_id/…`).

### DB Functions
- `enqueue_import_batches(p_run_id uuid, p_total_batches int)` — creates queue + batch rows atomically.
- `claim_next_import_batch(p_worker_id text)` — SKIP LOCKED select, sets status=running, returns batch payload pointer.
- `complete_import_batch(...)`, `fail_import_batch(...)`, `retry_failed_batches(p_run_id)`.
- `resume_import_run(p_run_id, p_user_id, p_user_name)` — sets status=resumable, records audit event, returns next batch pointer + `resumed_from_row`.
- `owner_import_analytics(p_days int)` — today, this month, largest, avg time, avg health, top template, top courier, AI success rate, resume count, failure count.
- `import_performance_snapshot(p_project_id uuid)` — avg/fastest/slowest/largest, avg AI fixes, duplicate rate, avg processing time, avg queue wait.
- `promote_learning_suggestion(p_id uuid)` and `reset_learning(p_project_id, p_kind)`.

Idempotency: `(project_id, external_order_id)` unique partial index enforced; batch worker uses `INSERT … ON CONFLICT DO NOTHING` for orders and calls `find_or_create_customer` for customers, so replaying a batch never duplicates data.

## 2. Edge Functions

- `import-worker` (new) — invoked by pg_cron every minute AND on-demand. Loops: claim next batch via SKIP LOCKED → stream rows from storage (byte-range) → validate → upsert customers/orders idempotently → write `import_batches`, `import_errors`, update `import_runs.processed_batches` + speed. Exits after N seconds to stay under CPU budget; cron re-invokes until queue empty.
- `import-resume` (new) — validates ownership, calls `resume_import_run`, ensures queue rows exist for unprocessed batches, triggers `import-worker`.
- `import-cancel` (new) — marks run + queue cancelled, writes audit.
- `ai-address-normalizer` (new) — Lovable AI Gateway `google/gemini-2.5-flash`; input: raw BD address; output: structured `{district, upazila, area, road, house, village, flat, postal_code, normalized}` + confidence + why. Skips rows with `address_manually_confirmed=true`.
- `ai-import-cleaner` (extend) — accepts learning hints, records `import_learning_suggestions` on new user-approved mappings, emits categorized errors into `import_errors`.

pg_cron: schedule `import-worker` every minute (`select cron.schedule('import-worker-tick', '* * * * *', $$ select net.http_post(url:='.../functions/v1/import-worker', headers:='...', body:='{}') $$)`). Uses `FOLLOWUP_AUTOMATION_SECRET`-style shared secret.

## 3. Streaming Upload & Parsing

- Client uploads file to `import-uploads/{project_id}/{run_id}.{ext}` via Supabase Storage.
- CSV: parse via PapaParse `step:` streaming; XLSX: SheetJS stream mode; both chunk into 200-row batches written as JSONL under `import-uploads/{project_id}/{run_id}/batches/{index}.jsonl`.
- Worker reads one JSONL batch at a time — never loads whole file.

## 4. Frontend (no wizard redesign)

Additive UI only:

- **Resume banner** on `BulkImportPage`: if any `import_runs` with status ∈ (paused, resumable, running, failed_partial) exist, show banner with Last Processed Row, Remaining Rows, ETA, Current Batch, Resume Token, Resume Started By, Resume Time, and `Resume` button → calls `import-resume`.
- **Realtime Import Insights panel** (added to existing progress step): live counters via Supabase Realtime on `import_runs` + `import_batches`. Rows processed/remaining/cleaned/corrected, dup customers, dup orders, new/repeat customers, ETA, current speed, avg batch time, live health score.
- **Import Recovery Center** — new page `/imports/recovery` (Admin/Sub-Admin): tabs Running/Completed/Paused/Failed/Cancelled/Resume Available. Row actions: Resume, Retry Failed Batches, Cancel, View Log, Delete History (soft).
- **Import Error Center** — drawer inside recovery detail view: categorized error list with WHY, Recommended Fix, Retry button (calls `retry_failed_batches`).
- **Learning Center** — new admin page `/imports/learning`: pending suggestions grouped by kind, Approve/Reject/Reset/Disable per project (`project_settings.learning_enabled`).
- **Address AI toggle** — checkbox in wizard AI Clean step; per-row preview with confidence + why; respects `address_manually_confirmed`.
- **Owner Dashboard** — new "Import Analytics" card group calling `owner_import_analytics`: Today, This Month, Largest, Avg Time, Avg Health, Most Used Template, Most Used Courier, AI Success Rate, Resume Imports, Failures.
- **AI Data Quality widget** — dashboard card (Admin + Owner) showing Overall, Phone, Address, Duplicate Risk, Customer Match, Product Detection, Unknown Status, Invalid Rows; each metric click-through to filtered warning list.
- **Import Performance Analytics** — section on Data Quality page: avg/fastest/slowest/largest, avg AI fixes, duplicate rate, avg processing time, memory, queue wait.

New hooks: `useImportQueue`, `useImportRecovery`, `useImportErrors`, `useImportLearning`, `useOwnerImportAnalytics`, `useImportPerformance`, `useResumeImport`.

## 5. Audit

Every state change writes `import_audit_events` with BST timestamp (`now() AT TIME ZONE 'Asia/Dhaka'`), device/browser (parsed client-side from UA), IP (from edge function `x-forwarded-for`, best-effort).

## 6. Security

- All new tables RLS-scoped by `project_id` via `get_user_project_id(auth.uid())`.
- Storage bucket policies restrict path prefix to caller's project.
- Worker uses service role but always filters by the run's `project_id`; never crosses tenants.
- Learning suggestions scoped per project — no global leakage.

## 7. Regression Plan

After migration + deploy, verify:
Bulk Import (Phase 1 flow still works), Duplicate Resolution, Customer Matching, Customer Analytics, Import Memory, Product Alias, Warning Center, Health Score, Activity Logs, Orders CRUD, Customer Profiles, Followups, AI Assistant, Owner Dashboard KPIs.

## 8. Out of scope (Phase 3)

Customer Workspace, AI Customer Intelligence, courier API auto-pull, cross-workspace learning.

## Technical Notes

- Batch size 200 rows; worker budget ~50s/invocation; cron every minute keeps queue draining.
- Idempotency keys: `(import_run_id, batch_index)` for batches, `(project_id, external_order_id)` for orders.
- ETA = remaining_rows / rolling avg speed (last 5 batches).
- Realtime channel: `import_run:{id}` publishing batch + run updates.
- No changes to `client.ts`, `types.ts` regenerated post-migration.

## Files

New: migration SQL; `supabase/functions/import-worker/index.ts`, `import-resume/index.ts`, `import-cancel/index.ts`, `ai-address-normalizer/index.ts`; `src/pages/ImportRecoveryPage.tsx`, `ImportLearningPage.tsx`; `src/components/import/ResumeBanner.tsx`, `RealtimeInsightsPanel.tsx`, `ImportErrorCenter.tsx`, `OwnerImportAnalytics.tsx`, `AIDataQualityCard.tsx`, `ImportPerformancePanel.tsx`; hooks listed above.

Edited: `ai-import-cleaner/index.ts` (learning + error categorization), `BulkImportPage.tsx` (resume banner + insights + address AI toggle + storage upload), `OwnerDashboardPage.tsx` (analytics cards), `DataQualityPage.tsx` (performance panel), `AppSidebar.tsx` (Recovery + Learning entries), `App.tsx` (routes), `types.ts` (auto).
