import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

/**
 * Import Worker v2.
 * - Claims one queued batch at a time (claim_next_import_batch, SKIP LOCKED).
 * - Downloads the batch JSONL from Storage, upserts customers + orders idempotently.
 * - AI Enhanced mode: normalizes phone/address/product/status via cache-backed LLM calls
 *   with fail-soft (falls back to original values when AI is unavailable).
 * - Writes rows_ok / rows_failed / categorized errors and completes the batch.
 * - Self-invokes to drain the queue quickly when work remains.
 * Exits after ~40s to stay under CPU budget.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const log = (step: string, details: Record<string, unknown> = {}) => {
    console.log(`[ImportWorker] ${step}`, JSON.stringify(details));
  };

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const workerId = `w_${crypto.randomUUID().slice(0, 8)}`;
    const started = Date.now();
    const deadlineMs = 40_000;

    log("Worker Started", { workerId });

    let processed = 0;
    let anyRemaining = false;

    while (Date.now() - started < deadlineMs) {
      log("Claim Started", { workerId });
      const { data: claim, error: claimErr } = await admin.rpc("claim_next_import_batch", { p_worker_id: workerId });
      if (claimErr) {
        log("Claim Failed", { workerId, error: claimErr.message });
        throw new Error(`claim_next_import_batch failed: ${claimErr.message}`);
      }
      const job = Array.isArray(claim) ? claim[0] : claim;
      if (!job?.id) {
        log("Queue Completed", { workerId, processed });
        break;
      }

      log("Batch Claimed", {
        workerId,
        queueId: job.id,
        runId: job.import_run_id,
        batchIndex: job.batch_index,
        projectId: job.project_id,
        mode: job.import_mode,
      });

      const batchStart = Date.now();
      let rowsOk = 0;
      let rowsFailed = 0;

      try {
        // Load run config for assignments / mapping context.
        const { data: run } = await admin
          .from("import_runs")
          .select("id, project_id, import_mode, assignments, duplicate_decisions, user_id, user_name")
          .eq("id", job.import_run_id)
          .maybeSingle();

        if (!run) throw new Error(`Import run not found: ${job.import_run_id}`);
        if (run.project_id !== job.project_id) {
          throw new Error(`Project mismatch for run ${job.import_run_id}: queue=${job.project_id}, run=${run.project_id}`);
        }

        const mode = job.import_mode ?? run?.import_mode ?? "quick";
        const assignments = (run?.assignments ?? {}) as Record<string, unknown>;
        const dupDecisions = (run?.duplicate_decisions ?? {}) as Record<string, "update" | "skip" | "create">;

        if (!job.payload_ref) throw new Error("Missing payload_ref");
        const { data: file, error: dlErr } = await admin.storage.from("import-uploads").download(job.payload_ref);
        if (dlErr || !file) throw new Error(`Storage download failed: ${dlErr?.message ?? "unknown"}`);
        const text = await file.text();
        const rows = text.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
        log("Rows Loaded", { workerId, queueId: job.id, rows: rows.length, payloadRef: job.payload_ref });

        for (const raw of rows) {
          try {
            if (mode === "ai") log("AI Started", { workerId, queueId: job.id, batchIndex: job.batch_index });
            const row = mode === "ai" ? await aiEnhanceRow(admin, job.project_id, raw) : normalizeRow(raw);

            if (!row.recipientPhone) throw new Error("missing_phone");
            const phone = normalizePhone(row.recipientPhone);
            if (!/^01\d{9}$/.test(phone)) throw new Error("invalid_phone");

            log("Insert Started", {
              workerId,
              queueId: job.id,
              batchIndex: job.batch_index,
              externalOrderId: row.externalOrderId ?? null,
            });

            const { data: customerId, error: cErr } = await admin.rpc("find_or_create_customer", {
              p_name: row.recipientName ?? "Unknown",
              p_mobile: phone,
              p_address: row.recipientAddress ?? "",
              p_project_id: job.project_id,
            });
            if (cErr) throw cErr;

            const externalId = row.externalOrderId?.trim() || null;
            const decision = externalId ? dupDecisions[externalId] : undefined;

            if (externalId && decision === "skip") {
              rowsOk++;
              continue;
            }

            // Update existing when external_order_id already exists (and not "create")
            let existingOrderId: string | null = null;
            if (externalId && decision !== "create") {
              const { data: existing } = await admin
                .from("orders")
                .select("id")
                .eq("project_id", job.project_id)
                .eq("external_order_id", externalId)
                .eq("is_deleted", false)
                .maybeSingle();
              existingOrderId = existing?.id ?? null;
            }

            const orderPayload: Record<string, unknown> = {
              project_id: job.project_id,
              customer_id: customerId,
              customer_name: row.recipientName ?? "Unknown",
              recipient_name: row.recipientName ?? "Unknown",
              mobile: phone,
              address: row.recipientAddress ?? "",
              product_title: row.product ?? "",
              price: toNum(row.codAmount),
              shipping_charge: toNum(row.shippingCharge),
              cod_charge: toNum(row.codCharge),
              delivery_status: row.deliveryStatus ?? "pending",
              delivery_method: (assignments.delivery_method as string) || row.deliveryMethod || "",
              order_source: row.orderSource ?? "Import",
              order_date: safeDate(row.orderDate) ?? new Date().toISOString().slice(0, 10),
              delivery_date: safeDate(row.deliveryDate),
              external_order_id: externalId,
              invoice_no: row.invoiceNo ?? null,
              invoice_id: externalId,
              tracking_code: row.trackingCode ?? null,
              approval_status: row.approvalStatus ?? null,
              delivery_time: row.deliveryTime ?? null,
              rider_name: row.riderName ?? null,
              rider_phone: row.riderPhone ?? null,
              payment_status: row.paymentStatus ?? null,
              item_description: row.itemDescription ?? "",
              note: row.note ?? "",
              assigned_to: (assignments.assigned_to as string) || null,
              assigned_to_name: (assignments.assigned_to_name as string) || "",
              created_by: run?.user_id ?? null,
              current_status: "pending",
              followup_step: 1,
              health: "good",
            };

            if (existingOrderId) {
              const { error: uErr } = await admin.from("orders").update(orderPayload).eq("id", existingOrderId);
              if (uErr) throw uErr;
            } else {
              const { error: iErr } = await admin.from("orders").insert(orderPayload);
              // duplicate-key on (project_id, external_order_id) => treat as skip-ok
              if (iErr && !/duplicate key|unique constraint/i.test(iErr.message)) throw iErr;
            }
            rowsOk++;
            log("Insert Completed", { workerId, queueId: job.id, rowsOk, rowsFailed });
          } catch (rowErr) {
            rowsFailed++;
            log("Row Failed", {
              workerId,
              queueId: job.id,
              batchIndex: job.batch_index,
              error: (rowErr as Error).message,
            });
            await admin.from("import_errors").insert({
              import_run_id: job.import_run_id,
              project_id: job.project_id,
              batch_index: job.batch_index,
              category: classifyError((rowErr as Error).message),
              why: (rowErr as Error).message,
              recommended_fix: recommendFix((rowErr as Error).message),
              retryable: false,
              payload: raw,
            });
          }
        }

        const dur = Date.now() - batchStart;
        await admin.rpc("complete_import_batch", {
          p_queue_id: job.id, p_rows_ok: rowsOk, p_rows_failed: rowsFailed, p_duration_ms: dur,
        });
        log("Progress Updated", { workerId, queueId: job.id, rowsOk, rowsFailed, durationMs: dur });
        log("Batch Completed", { workerId, queueId: job.id, batchIndex: job.batch_index });
        processed++;
      } catch (batchErr) {
        log("Batch Failed", {
          workerId,
          queueId: job.id,
          batchIndex: job.batch_index,
          error: (batchErr as Error).message,
        });
        await admin.rpc("fail_import_batch", {
          p_queue_id: job.id, p_category: "database", p_message: (batchErr as Error).message,
        });
      }
    }

    // Check if more work remains and self-invoke to keep draining
    const { count } = await admin
      .from("import_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued")
      .lte("next_attempt_at", new Date().toISOString());
    anyRemaining = (count ?? 0) > 0;
    log("Queue Remaining Check", { workerId, remaining: anyRemaining, queuedCount: count ?? 0 });

    if (anyRemaining) {
      // Fire-and-forget; do not await
      log("Self Invocation Started", { workerId });
      fetch(`${SUPABASE_URL}/functions/v1/import-worker`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true, processed_batches: processed, worker: workerId, remaining: anyRemaining }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ImportWorker] Worker Failed", JSON.stringify({ error: (e as Error).message }));
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

// -------------- Helpers --------------

interface RowShape {
  externalOrderId?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  codAmount?: string | number;
  trackingCode?: string;
  invoiceNo?: string;
  deliveryStatus?: string;
  approvalStatus?: string;
  deliveryTime?: string;
  riderName?: string;
  riderPhone?: string;
  shippingCharge?: string | number;
  codCharge?: string | number;
  paymentStatus?: string;
  note?: string;
  product?: string;
  orderDate?: string;
  deliveryDate?: string;
  deliveryMethod?: string;
  orderSource?: string;
  itemDescription?: string;
}

function normalizeRow(raw: RowShape): RowShape {
  const out: RowShape = { ...raw };
  out.recipientPhone = normalizePhone(String(raw.recipientPhone ?? ""));
  out.recipientName = trimOr(raw.recipientName, "");
  out.recipientAddress = trimOr(raw.recipientAddress, "");
  out.deliveryStatus = canonStatus(raw.deliveryStatus);
  return out;
}

async function aiEnhanceRow(admin: any, projectId: string, raw: RowShape): Promise<RowShape> {
  const base = normalizeRow(raw);
  // Skip AI entirely when key not configured
  if (!LOVABLE_KEY) return base;

  // Phone: normalized deterministically; only ask AI if still invalid.
  if (base.recipientPhone && !/^01\d{9}$/.test(base.recipientPhone)) {
    const fixed = await cachedNormalize(admin, projectId, "phone", String(raw.recipientPhone ?? ""), aiNormalizePhone);
    if (fixed) base.recipientPhone = fixed;
  }

  // Address: only enhance when short/low-quality
  if (base.recipientAddress && base.recipientAddress.length < 12) {
    const fixed = await cachedNormalize(admin, projectId, "address", base.recipientAddress, aiNormalizeAddress);
    if (fixed) base.recipientAddress = fixed;
  }

  return base;
}

async function cachedNormalize(
  admin: any, projectId: string, kind: string, input: string,
  fn: (v: string) => Promise<string | null>,
): Promise<string | null> {
  const hash = await sha256(input.toLowerCase().trim());
  const { data: hit } = await admin
    .from("ai_normalization_cache")
    .select("output")
    .eq("project_id", projectId).eq("kind", kind).eq("input_hash", hash)
    .maybeSingle();
  if (hit?.output) {
    admin.from("ai_normalization_cache")
      .update({ hits: (hit as any).hits ? (hit as any).hits + 1 : 2, updated_at: new Date().toISOString() })
      .eq("project_id", projectId).eq("kind", kind).eq("input_hash", hash)
      .then(() => {});
    return hit.output;
  }
  const out = await fn(input).catch(() => null);
  if (out && out !== input) {
    await admin.from("ai_normalization_cache").insert({
      project_id: projectId, kind, input_hash: hash, input, output: out, confidence: 0.9,
    });
  }
  return out;
}

async function aiNormalizePhone(v: string): Promise<string | null> {
  const res = await callAI(
    `Normalize this Bangladesh mobile number to 11-digit format starting with 01. Return ONLY the normalized number or "INVALID": ${v}`,
  );
  if (!res || /INVALID/i.test(res)) return null;
  const d = res.replace(/[^\d]/g, "");
  return /^01\d{9}$/.test(d) ? d : null;
}

async function aiNormalizeAddress(v: string): Promise<string | null> {
  const res = await callAI(
    `Clean up this Bangladesh address: fix spacing, capitalization, remove duplicate commas. Do NOT invent details. Return ONLY the cleaned address:\n${v}`,
  );
  return res?.trim() || null;
}

async function callAI(prompt: string): Promise<string | null> {
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return String(j?.choices?.[0]?.message?.content ?? "").trim() || null;
  } catch { return null; }
}

async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizePhone(v: string): string {
  const d = (v || "").replace(/[^\d]/g, "");
  if (!d) return "";
  if (d.startsWith("880") && d.length === 13) return "0" + d.slice(3);
  if (d.startsWith("88") && d.length === 13) return "0" + d.slice(3);
  if (d.length === 10 && d.startsWith("1")) return "0" + d;
  return d;
}
function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = parseFloat(String(v).replace(/[^\d.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}
function safeDate(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function trimOr<T>(v: unknown, fallback: T): string | T {
  const s = String(v ?? "").trim();
  return s || fallback;
}
function canonStatus(v: unknown): string {
  const s = String(v ?? "").toLowerCase().trim();
  if (!s) return "pending";
  if (/deliver/.test(s)) return "delivered";
  if (/cancel/.test(s)) return "cancelled";
  if (/return/.test(s)) return "returned";
  if (/transit|way|ship/.test(s)) return "in transit";
  if (/hold/.test(s)) return "hold";
  return "pending";
}
function classifyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("phone") || m.includes("missing_") || m.includes("invalid")) return "validation";
  if (m.includes("duplicate") || m.includes("conflict") || m.includes("unique")) return "duplicate";
  if (m.includes("permission") || m.includes("rls")) return "permission";
  if (m.includes("timeout")) return "timeout";
  if (m.includes("network") || m.includes("fetch")) return "network";
  if (m.includes("json") || m.includes("parse")) return "file_format";
  return "database";
}
function recommendFix(msg: string): string {
  const c = classifyError(msg);
  switch (c) {
    case "validation": return "Correct the invalid field in the source file and retry.";
    case "duplicate": return "Row already exists — Skip or use the Duplicate Resolution Center.";
    case "permission": return "Confirm the caller belongs to the correct project.";
    case "timeout": return "Automatic retry with backoff is scheduled.";
    case "network": return "Automatic retry with backoff is scheduled.";
    case "file_format": return "Verify the batch file JSON structure.";
    default: return "Retry the failed batch from the Recovery Center.";
  }
}
