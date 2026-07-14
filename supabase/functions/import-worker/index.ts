import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

/**
 * Import Worker (background batch processor).
 * Claims one queued batch at a time via claim_next_import_batch (SKIP LOCKED),
 * downloads the batch JSONL from Storage, upserts customers+orders idempotently,
 * writes rows_ok / rows_failed / categorized errors, and completes the batch.
 *
 * Invoked on-demand by client after enqueuing, and every minute by pg_cron for drainage.
 * Exits after ~40s to stay under CPU budget; the next tick continues where this stopped.
 */
serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const workerId = `w_${crypto.randomUUID().slice(0, 8)}`;
    const started = Date.now();
    const deadlineMs = 40_000;

    let processed = 0;
    while (Date.now() - started < deadlineMs) {
      const { data: claim } = await admin.rpc("claim_next_import_batch", { p_worker_id: workerId });
      const job = Array.isArray(claim) ? claim[0] : claim;
      if (!job?.id) break;

      const batchStart = Date.now();
      let rowsOk = 0;
      let rowsFailed = 0;
      let category: string | null = null;
      let errorMsg: string | null = null;

      try {
        if (!job.payload_ref) throw new Error("Missing payload_ref");
        const { data: file, error: dlErr } = await admin.storage.from("import-uploads").download(job.payload_ref);
        if (dlErr || !file) throw new Error(`Storage download failed: ${dlErr?.message ?? "unknown"}`);
        const text = await file.text();
        const rows = text.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));

        for (const row of rows) {
          try {
            const {
              externalOrderId, recipientName, recipientPhone, recipientAddress,
              codAmount, product, deliveryStatus, orderDate, deliveryDate,
              deliveryMethod, orderSource, note, invoiceNo, trackingCode,
              shippingCharge, codCharge,
            } = row;

            if (!recipientPhone) throw new Error("missing_phone");

            const { data: customerId, error: cErr } = await admin.rpc("find_or_create_customer", {
              p_name: recipientName ?? "Unknown",
              p_mobile: String(recipientPhone),
              p_address: recipientAddress ?? "",
              p_project_id: job.project_id,
            });
            if (cErr) throw cErr;

            const orderRow = {
              project_id: job.project_id,
              customer_id: customerId,
              customer_name: recipientName ?? "Unknown",
              customer_mobile: String(recipientPhone),
              customer_address: recipientAddress ?? "",
              product_title: product ?? "",
              price: Number(codAmount ?? 0) || 0,
              shipping_charge: Number(shippingCharge ?? 0) || 0,
              cod_charge: Number(codCharge ?? 0) || 0,
              delivery_status: deliveryStatus ?? "pending",
              delivery_method: deliveryMethod ?? null,
              order_source: orderSource ?? null,
              order_date: orderDate ?? new Date().toISOString().slice(0, 10),
              delivery_date: deliveryDate ?? null,
              external_order_id: externalOrderId ?? null,
              invoice_id: invoiceNo ?? externalOrderId ?? null,
              tracking_code: trackingCode ?? null,
              note: note ?? "",
              current_status: "pending",
              followup_step: 1,
              health: "good",
            };

            const { error: oErr } = await admin.from("orders").upsert(orderRow, {
              onConflict: "project_id,external_order_id",
              ignoreDuplicates: true,
            });
            if (oErr) throw oErr;
            rowsOk++;
          } catch (rowErr) {
            rowsFailed++;
            await admin.from("import_errors").insert({
              import_run_id: job.import_run_id,
              project_id: job.project_id,
              batch_index: job.batch_index,
              category: classifyError((rowErr as Error).message),
              why: (rowErr as Error).message,
              recommended_fix: recommendFix((rowErr as Error).message),
              retryable: true,
              payload: row,
            });
          }
        }

        const dur = Date.now() - batchStart;
        await admin.rpc("complete_import_batch", {
          p_queue_id: job.id, p_rows_ok: rowsOk, p_rows_failed: rowsFailed, p_duration_ms: dur,
        });
        processed++;
      } catch (batchErr) {
        category = "database";
        errorMsg = (batchErr as Error).message;
        await admin.rpc("fail_import_batch", {
          p_queue_id: job.id, p_category: category, p_message: errorMsg,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed_batches: processed, worker: workerId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

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
    case "validation": return "Correct the invalid field in the source file and retry this batch.";
    case "duplicate": return "Row already exists — Skip or use Duplicate Resolution Center.";
    case "permission": return "Confirm the caller belongs to the correct project.";
    case "timeout": return "Retry the batch — the database was momentarily busy.";
    case "network": return "Check connectivity and retry.";
    case "file_format": return "Verify the batch file JSON structure.";
    default: return "Retry the failed batch from the Recovery Center.";
  }
}
