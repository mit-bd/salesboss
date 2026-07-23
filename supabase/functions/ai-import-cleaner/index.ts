import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { authenticateUser, createEdgeContext, jsonResponse, logEdge } from "../_shared/edge.ts";

const CANONICAL_FIELDS = [
  "externalOrderId","recipientName","recipientPhone","recipientAddress","codAmount",
  "trackingCode","invoiceNo","deliveryStatus","approvalStatus","deliveryTime",
  "riderName","riderPhone","shippingCharge","codCharge","paymentStatus","note",
  "product","orderDate","deliveryDate","deliveryMethod","orderSource","itemDescription",
] as const;

serve(async (req) => {
  const edge = createEdgeContext("ai-import-cleaner", req);
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    logEdge(edge, "info", "request_started", { method: req.method });
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) return jerr(corsHeaders, 500, "AI not configured");

    const auth = await authenticateUser(req, supabaseUrl, anonKey);
    if (auth.error || !auth.user) {
      logEdge(edge, "warn", "auth_failed", { supabase_error: auth.supabaseError });
      return jerr(edge, corsHeaders, 401, "Unauthorized", auth.error, auth.supabaseError);
    }
    const user = auth.user;

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: prof } = await admin.from("profiles").select("project_id").eq("user_id", user.id).maybeSingle();
    const projectId = prof?.project_id;
    if (!projectId) return jerr(corsHeaders, 400, "No project found");

    const body = await req.json().catch(() => ({}));
    const { rows, headers, mode = "clean", import_run_id } = body ?? {};
    if (!Array.isArray(headers) || headers.length === 0) return jerr(corsHeaders, 400, "No headers provided");

    // ---- Mapping detection (always fast) ----
    const mapping = await detectMapping(headers, lovableApiKey);

    // ---- Match saved template by header signature ----
    let matchedTemplate: any = null;
    const sig = headers.map(normalizeHeader).sort();
    const { data: templates } = await admin
      .from("import_mapping_templates")
      .select("id,name,source_hint,header_signature,mapping,usage_count,status_aliases,date_format,phone_format,product_alias_hints")
      .eq("project_id", projectId);
    if (templates) {
      let best: { t: any; score: number } | null = null;
      for (const t of templates as any[]) {
        const tsig: string[] = (t.header_signature || []).map(normalizeHeader).sort();
        const inter = tsig.filter((h) => sig.includes(h)).length;
        const denom = Math.max(sig.length, tsig.length) || 1;
        const score = inter / denom;
        if (score >= 0.7 && (!best || score > best.score)) best = { t, score };
      }
      if (best) matchedTemplate = { ...best.t, match_score: best.score };
    }

    if (mode === "detect" || !Array.isArray(rows) || rows.length === 0) {
      return jok(corsHeaders, { mapping, matchedTemplate, headerSignature: sig });
    }

    // ---- Load context (products + confirmed aliases) ----
    const [{ data: products }, { data: aliases }] = await Promise.all([
      admin.from("products").select("title,sku").eq("project_id", projectId).limit(500),
      admin.from("product_aliases").select("alias,product_id,status").eq("project_id", projectId).eq("status", "confirmed").limit(500),
    ]);
    const productHint = (products || []).map((p: any) => p.title).join(", ");
    const aliasHint = (aliases || []).map((a: any) => a.alias).join(", ");

    // ---- Clean in batches ----
    const BATCH = 50;
    const cleanedAll: any[] = [];
    const warningsAll: any[] = [];
    let corrections: string[] = [];
    let autoCorrected = 0;
    let needsReview = 0;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { cleaned, corrs, ac, nr, warnings, status } =
        await cleanBatch(batch, mapping, productHint, aliasHint, lovableApiKey);
      if (status === 429) return jerr(corsHeaders, 429, "Rate limit exceeded. Please retry shortly.");
      if (status === 402) return jerr(corsHeaders, 402, "AI credits exhausted. Please add credits.");
      cleanedAll.push(...cleaned);
      corrections.push(...corrs);
      autoCorrected += ac;
      needsReview += nr;
      warningsAll.push(...warnings);
    }

    // ---- Deterministic post-checks (always run — never rely only on AI) ----
    const postChecks = computeDeterministicWarnings(cleanedAll);
    const allWarnings = [...warningsAll, ...postChecks];

    // ---- Health score + recommendations ----
    const health = computeHealthScore(cleanedAll, allWarnings);
    const recommendations = buildRecommendations(cleanedAll, allWarnings);

    // Persist warnings if an import_run_id was supplied
    if (import_run_id) {
      const rows = allWarnings.slice(0, 5000).map((w) => ({
        import_run_id,
        project_id: projectId,
        row_number: w.rowNumber ?? 0,
        category: w.category || "other",
        severity: w.severity || "warning",
        field: w.field || null,
        message: w.message || "",
        reason: w.reason || null,
        suggested_fix: w.suggested_fix || null,
      }));
      if (rows.length) {
        // Chunked insert
        for (let i = 0; i < rows.length; i += 500) {
          await admin.from("import_warnings").insert(rows.slice(i, i + 500) as any);
        }
      }
      await admin.from("import_runs")
        .update({ health_score: health, recommendations })
        .eq("id", import_run_id);
    }

    const report = {
      totalRows: rows.length,
      autoCorrected,
      needsReview,
      ready: rows.length - needsReview,
      corrections: Array.from(new Set(corrections)).slice(0, 30),
      warningsCount: allWarnings.length,
      severityCounts: countSeverities(allWarnings),
    };

    return jok(corsHeaders, {
      mapping,
      matchedTemplate,
      headerSignature: sig,
      cleanedRows: cleanedAll,
      warnings: allWarnings,
      health,
      recommendations,
      report,
    });
  } catch (e) {
    logEdge(edge, "error", "unhandled_exception", { backend_error: e instanceof Error ? e.message : "Unknown error" });
    return jerr(edge, buildCorsHeaders(req), 500, e instanceof Error ? e.message : "Unknown error");
  }
});

function jok(cors: Record<string, string>, body: unknown) {
  const edge = createEdgeContext("ai-import-cleaner", new Request("https://internal.local"));
  return jsonResponse(edge, cors, body as Record<string, unknown>);
}
function jerr(edge: ReturnType<typeof createEdgeContext>, cors: Record<string, string>, status: number, error: string, backendError?: string, supabaseError?: string) {
  return jsonResponse(edge, cors, { error, backend_error: backendError, supabase_error: supabaseError }, status);
}
function normalizeHeader(h: string) {
  return String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function normalizePhone(v: string): string {
  const d = (v || "").replace(/[^\d]/g, "");
  if (!d) return "";
  if (d.startsWith("880") && d.length === 13) return "0" + d.slice(3);
  if (d.startsWith("88") && d.length === 13) return "0" + d.slice(3);
  if (d.length === 10 && d.startsWith("1")) return "0" + d;
  return d;
}

async function detectMapping(headers: string[], apiKey: string): Promise<Record<string, string>> {
  const system = `You map raw CSV/XLSX column headers to canonical fields for a Bangladesh courier/CRM import. Only return a mapping for headers you are confident about.`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Canonical fields: ${CANONICAL_FIELDS.join(", ")}\nHeaders: ${JSON.stringify(headers)}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_mapping",
          description: "Return canonical->source header mapping",
          parameters: {
            type: "object",
            properties: Object.fromEntries(CANONICAL_FIELDS.map((f) => [f, { type: "string" }])),
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_mapping" } },
    }),
  });
  if (!res.ok) return {};
  const j = await res.json();
  const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return {};
  try {
    const parsed = JSON.parse(args);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && v.length > 0 && headers.includes(v)) out[k] = v;
    }
    return out;
  } catch { return {}; }
}

async function cleanBatch(
  batch: any[], mapping: Record<string, string>,
  productHint: string, aliasHint: string, apiKey: string,
): Promise<{ cleaned: any[]; corrs: string[]; ac: number; nr: number; warnings: any[]; status?: number }> {
  const system = `You clean and normalize rows for a Bangladesh CRM import. Return cleaned rows AND a list of warnings.

Rules:
- Phones: normalize to 11-digit BD format 01XXXXXXXXX. If it cannot be normalized, flag with a warning of category "phone_invalid".
- Statuses (deliveryStatus): canonicalize to Delivered/Pending/Cancelled/Returned/In Transit/Hold. If unknown, warn "unknown_status".
- Numeric (codAmount, shippingCharge, codCharge): strip currency symbols. If negative or non-numeric COD, warn "negative_cod".
- Dates: normalize to YYYY-MM-DD when possible. If deliveryDate is in the future, warn "future_date".
- Addresses: trim/collapse spaces, remove duplicate commas, Title Case city/district if obvious. If very short (<10 chars), warn "address_low_quality".
- Product: if it matches an alias in the alias library, use the full product name from the product list. If cannot identify, warn "unknown_product".
- Required fields: externalOrderId, recipientName, recipientPhone, recipientAddress, codAmount. Missing sets needsReview=true.
- Every warning MUST include a "reason" that explains WHY the AI raised it.

Product alias library (case-insensitive): [${aliasHint || "none"}]
Product catalog: [${productHint || "none"}]

Severity mapping:
  critical = row cannot be imported without fixing (missing required, invalid phone, invalid COD)
  warning  = importable but likely wrong (unknown status, future date, low-quality address)
  suggestion = improvement (product alias hint, capitalization)`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Mapping: ${JSON.stringify(mapping)}\n\nRows: ${JSON.stringify(batch)}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_cleaned",
          description: "Return cleaned rows and per-row warnings",
          parameters: {
            type: "object",
            properties: {
              rows: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    rowNumber: { type: "number" },
                    ...Object.fromEntries(CANONICAL_FIELDS.map((f) => [f, { type: "string" }])),
                    autoCorrected: { type: "boolean" },
                    needsReview: { type: "boolean" },
                    corrections: { type: "array", items: { type: "string" } },
                  },
                  required: ["rowNumber","autoCorrected","needsReview","corrections"],
                  additionalProperties: false,
                },
              },
              warnings: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    rowNumber: { type: "number" },
                    category: { type: "string" },
                    severity: { type: "string" },
                    field: { type: "string" },
                    message: { type: "string" },
                    reason: { type: "string" },
                  },
                  required: ["rowNumber","category","severity","message","reason"],
                  additionalProperties: false,
                },
              },
            },
            required: ["rows","warnings"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_cleaned" } },
    }),
  });

  if (res.status === 429 || res.status === 402) return { cleaned: [], corrs: [], ac: 0, nr: 0, warnings: [], status: res.status };
  if (!res.ok) {
    console.error("AI batch error", res.status, await res.text().catch(() => ""));
    return { cleaned: batch.map(passthrough), corrs: [], ac: 0, nr: 0, warnings: [] };
  }
  const j = await res.json();
  const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return { cleaned: batch.map(passthrough), corrs: [], ac: 0, nr: 0, warnings: [] };
  try {
    const parsed = JSON.parse(args);
    const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
    const warnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];
    let ac = 0, nr = 0;
    const corrs: string[] = [];
    for (const r of rows) {
      if (r.autoCorrected) ac++;
      if (r.needsReview) nr++;
      if (Array.isArray(r.corrections)) corrs.push(...r.corrections);
    }
    // Normalize severity string
    for (const w of warnings) {
      const s = String(w.severity || "").toLowerCase();
      w.severity = ["critical","warning","suggestion"].includes(s) ? s : "warning";
    }
    return { cleaned: rows, corrs, ac, nr, warnings };
  } catch {
    return { cleaned: batch.map(passthrough), corrs: [], ac: 0, nr: 0, warnings: [] };
  }
}

function passthrough(r: any) {
  return { ...r, autoCorrected: false, needsReview: false, corrections: [] };
}

// ---- Deterministic checks (always run, independent of AI) ----
function computeDeterministicWarnings(rows: any[]): any[] {
  const out: any[] = [];
  const seenExtId = new Map<string, number>();
  const seenTracking = new Map<string, number>();
  const seenPhoneName = new Map<string, Set<string>>();

  for (const r of rows) {
    const rn = r.rowNumber ?? 0;
    const phone = normalizePhone(r.recipientPhone || "");
    if (r.recipientPhone && !/^01\d{9}$/.test(phone)) {
      out.push({ rowNumber: rn, category: "phone_invalid", severity: "critical", field: "recipientPhone",
        message: `Phone "${r.recipientPhone}" does not look like a valid Bangladesh mobile.`,
        reason: "Expected 11 digits starting with 01 after normalization." });
    }
    const cod = parseFloat(String(r.codAmount || "").replace(/[^\d.\-]/g, ""));
    if (r.codAmount && (isNaN(cod) || cod < 0)) {
      out.push({ rowNumber: rn, category: "negative_cod", severity: "critical", field: "codAmount",
        message: `COD amount "${r.codAmount}" is invalid.`,
        reason: "COD must be a non-negative number." });
    }
    if (r.deliveryDate && /^\d{4}-\d{2}-\d{2}$/.test(String(r.deliveryDate))) {
      if (new Date(r.deliveryDate) > new Date(Date.now() + 24*3600*1000)) {
        out.push({ rowNumber: rn, category: "future_date", severity: "warning", field: "deliveryDate",
          message: `Delivery date ${r.deliveryDate} is in the future.`,
          reason: "Delivery dates are usually today or earlier for imported courier data." });
      }
    }
    if (r.recipientAddress && String(r.recipientAddress).trim().length < 10) {
      out.push({ rowNumber: rn, category: "address_low_quality", severity: "suggestion", field: "recipientAddress",
        message: `Address looks incomplete: "${r.recipientAddress}"`,
        reason: "Addresses under 10 characters usually miss road/area details." });
    }

    const extId = String(r.externalOrderId || "").trim();
    if (extId) {
      seenExtId.set(extId, (seenExtId.get(extId) || 0) + 1);
      if (seenExtId.get(extId)! > 1) {
        out.push({ rowNumber: rn, category: "duplicate_in_file", severity: "warning", field: "externalOrderId",
          message: `Order ID ${extId} appears more than once in this file.`,
          reason: "Duplicate Order IDs in the same file usually indicate an export mistake." });
      }
    }
    const tc = String(r.trackingCode || "").trim();
    if (tc) {
      seenTracking.set(tc, (seenTracking.get(tc) || 0) + 1);
      if (seenTracking.get(tc)! > 1) {
        out.push({ rowNumber: rn, category: "duplicate_tracking", severity: "warning", field: "trackingCode",
          message: `Tracking code ${tc} appears more than once in this file.`,
          reason: "The same tracking code across rows may indicate a duplicate shipment." });
      }
    }
    if (phone && r.recipientName) {
      const set = seenPhoneName.get(phone) || new Set<string>();
      set.add(String(r.recipientName).trim().toLowerCase());
      seenPhoneName.set(phone, set);
    }

    // Status conflicts (basic)
    const st = String(r.deliveryStatus || "").toLowerCase();
    const ps = String(r.paymentStatus || "").toLowerCase();
    if (st === "delivered" && (ps === "pending" || ps === "unpaid" || ps === "due")) {
      out.push({ rowNumber: rn, category: "status_conflict", severity: "warning", field: "paymentStatus",
        message: `Delivered order marked as payment ${r.paymentStatus}.`,
        reason: "Delivered COD orders should generally have their payment marked collected." });
    }
  }

  // Same phone / different names
  for (const [phone, names] of seenPhoneName.entries()) {
    if (names.size > 1) {
      // Attach on every row of this phone
      rows.filter((r) => normalizePhone(r.recipientPhone || "") === phone).forEach((r) => {
        out.push({ rowNumber: r.rowNumber ?? 0, category: "same_phone_diff_name", severity: "suggestion",
          field: "recipientName",
          message: `Same phone (${phone}) used for ${names.size} different names in this file.`,
          reason: "Likely the same customer with name variations (e.g. Sagar vs Sagor). Consider unifying." });
      });
    }
  }

  return out;
}

function countSeverities(warnings: any[]) {
  const c = { critical: 0, warning: 0, suggestion: 0 };
  warnings.forEach((w) => { const s = w.severity as keyof typeof c; if (c[s] !== undefined) c[s]++; });
  return c;
}

function computeHealthScore(rows: any[], warnings: any[]) {
  const total = Math.max(rows.length, 1);
  const critByCat: Record<string, number> = {};
  warnings.forEach((w) => {
    const key = w.category as string;
    critByCat[key] = (critByCat[key] || 0) + (w.severity === "critical" ? 2 : w.severity === "warning" ? 1 : 0.3);
  });
  const dim = (bad: number) => Math.max(0, Math.min(100, 100 - (bad / total) * 100));

  const phone = dim(critByCat["phone_invalid"] || 0);
  const address = dim(critByCat["address_low_quality"] || 0);
  const duplicate_risk = dim((critByCat["duplicate_in_file"] || 0) + (critByCat["duplicate_tracking"] || 0));
  const customer_match = dim(critByCat["same_phone_diff_name"] || 0);
  const status_accuracy = dim((critByCat["unknown_status"] || 0) + (critByCat["status_conflict"] || 0));
  const cod_accuracy = dim(critByCat["negative_cod"] || 0);
  const product_detection = dim(critByCat["unknown_product"] || 0);
  const needsReviewCount = rows.filter((r) => r.needsReview).length;
  const ai_confidence = Math.round(100 - (needsReviewCount / total) * 100);

  const overall = Math.round((phone + address + duplicate_risk + customer_match + status_accuracy + cod_accuracy + product_detection + ai_confidence) / 8);
  return { overall, phone, address, duplicate_risk, customer_match, status_accuracy, cod_accuracy, product_detection, ai_confidence };
}

function buildRecommendations(rows: any[], warnings: any[]) {
  const byCat = new Map<string, any[]>();
  warnings.forEach((w) => {
    const arr = byCat.get(w.category) || [];
    arr.push(w);
    byCat.set(w.category, arr);
  });
  const recs: any[] = [];
  for (const [cat, ws] of byCat.entries()) {
    const sev = ws.some((x) => x.severity === "critical") ? "critical"
      : ws.some((x) => x.severity === "warning") ? "warning" : "suggestion";
    const affectedRows = Array.from(new Set(ws.map((x) => x.rowNumber))).slice(0, 200);
    const label: Record<string, string> = {
      phone_invalid: `${ws.length} phone numbers appear invalid`,
      negative_cod: `${ws.length} COD values look suspicious`,
      unknown_status: `${ws.length} delivery statuses are unknown`,
      unknown_product: `${ws.length} products could not be identified`,
      address_low_quality: `${ws.length} addresses need review`,
      duplicate_in_file: `${ws.length} duplicate Order IDs in this file`,
      duplicate_tracking: `${ws.length} duplicate tracking codes`,
      same_phone_diff_name: `${ws.length} possible duplicate customers detected`,
      status_conflict: `${ws.length} rows have delivery/payment conflicts`,
      future_date: `${ws.length} delivery dates are in the future`,
    };
    recs.push({
      id: cat,
      title: label[cat] || `${ws.length} ${cat.replace(/_/g, " ")} issues`,
      severity: sev,
      reason: ws[0]?.reason || "AI flagged this pattern based on the rules configured for this project.",
      affectedRows,
    });
  }
  recs.sort((a, b) => (a.severity === "critical" ? -1 : b.severity === "critical" ? 1 : 0));
  return recs.slice(0, 20);
}
