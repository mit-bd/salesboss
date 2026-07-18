## SalesBoss Smart Import v2 — Enterprise Refactor

Refactor (not rewrite) the existing import engine into a fully background, resumable, chunked pipeline. Preserve all existing tables, edge functions, templates, warnings, health scores, learning, recovery center, and audit trail.

---

### 1. New architecture (queue-first)

```text
Upload  →  Column Mapping  →  Review (optional)  →  Import
                                                       ↓
                                        enqueue run + upload chunk files
                                                       ↓
                                    import-worker (background, cron + kick)
                                                       ↓
                                    live progress dashboard (polling + realtime)
```

- **Mode selection on step 1**:
  - **Quick Import** — no AI. Local phone/date/status normalization only.
  - **AI Enhanced Import** — AI runs asynchronously per chunk inside the worker (not blocking the wizard).

### 2. Wizard collapse: 7 steps → 4

| Old | New |
|-----|-----|
| upload | **1. Upload** (+ mode picker) |
| mapping | **2. Column Mapping** (with AI detect) |
| clean + simulate + duplicates | **3. Review** (optional — health, warnings, dup decisions, sample fixes) |
| execute + report | **4. Import** (live dashboard) |

Blocking full-file AI clean is removed. Review can be skipped entirely for Quick Import.

### 3. Background processing

- `BulkImportPage` writes rows to `import-uploads` as JSONL chunks (**300 rows / chunk**, tunable 200–500).
- `enqueue_import_batches` RPC already exists — extend the run row with `import_mode` (`quick` | `ai`), `mapping`, `duplicate_decisions`, `assignments`.
- `import-worker` refactor:
  - Per-chunk AI cleaning when `mode = 'ai'`, using a new `ai_normalization_cache` table keyed by `(project_id, kind, input_hash)`.
  - Skip AI for values already matching clean patterns (phone `^01\d{9}$`, ISO date, canonical status).
  - **Fail-soft AI**: if AI call fails or times out, keep original value, insert an `import_warnings` row (severity `warning`, category `ai_fallback`), continue.
  - Per-row failures never abort the chunk; per-chunk failures re-enqueue with exponential backoff (`attempts` column already exists; add `next_attempt_at`, cap at 5).
  - Batch DB writes: `customers` upsert + `orders` upsert in single-statement chunks.
  - Renew worker deadline; kick a follow-up invocation before exit if queue non-empty.

### 4. Resume & recovery

- Existing `resume_import_run` + `import-resume` already handle this. Surface a **Resume** action in the new dashboard and detect in-progress runs on wizard mount → jump straight to the dashboard for that run.
- Browser close is already safe (cron drains queue).

### 5. Live progress dashboard (replaces "execute" screen)

Component `ImportLiveDashboard` polling `import_runs` + `import_queue` + `import_errors` every 2s (plus realtime channel):

- Overall progress bar + processed/total rows
- Current chunk index, rows/sec, ETA
- Current task label (`Cleaning`, `Upserting customers`, `Writing orders`)
- Warnings count (link → Warning Center)
- Errors count + retry queue length (link → Recovery Center)
- Buttons: Pause, Cancel, Resume

### 6. AI cache & clean-value skip

New table `ai_normalization_cache` (project-scoped, RLS): `kind` (`phone` | `address` | `product` | `status`), `input`, `input_hash`, `output`, `confidence`, `hits`. Worker checks cache before invoking AI; writes back on success.

### 7. Retry with exponential backoff

Extend `import_queue`: add `next_attempt_at timestamptz`, `max_attempts smallint default 5`. Worker `claim_next_import_batch` becomes time-aware. Failed batch retry delay = `min(60 * 2^attempts, 900)` seconds.

### 8. Files touched

**New**
- `src/components/import/ImportLiveDashboard.tsx`
- `src/components/import/ImportModePicker.tsx`
- `supabase/migrations/*_import_v2.sql` (ai cache table, queue backoff columns, import_runs.import_mode)

**Refactored (surgical, preserve APIs)**
- `src/pages/BulkImportPage.tsx` — 4-step wizard, mode picker, chunked upload → enqueue, redirect to dashboard
- `supabase/functions/import-worker/index.ts` — AI-in-worker, cache lookup, fail-soft, backoff, self-kick
- `supabase/functions/ai-import-cleaner/index.ts` — keep `mode: 'detect'` for mapping; remove synchronous full-file `clean`

**Unchanged**
- Templates, warnings, health score, learning, recovery center, product aliases, address normalizer, customer analytics triggers, all Phase 3 workspace features.

### 9. Regression test pass

After implementation, exercise: Quick Import 500 rows, AI Import 2000 rows, resume after cancel, duplicate decisions (update/skip/create), template save+apply, error retry, warning surfacing. Fix any breakages found before closing.

### Technical details

- Chunk size default 300, configurable via constant `IMPORT_CHUNK_SIZE`.
- Worker deadline stays 40s; self-invokes via `fetch` to its own URL when queue non-empty at exit (already partially done by cron every minute; add immediate kick for responsiveness).
- AI cache TTL: soft — entries never expire but `hits` increments to prove value; manual reset via existing Learning page pattern.
- Idempotency guaranteed by existing partial unique index `(project_id, external_order_id)`.
- BST timestamps everywhere (existing `src/lib/bst.ts`).
- No changes to auth, RLS scope by `project_id` on every new table/column.
