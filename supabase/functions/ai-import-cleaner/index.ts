import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

// Canonical field names the frontend understands.
const CANONICAL_FIELDS = [
  "externalOrderId",
  "recipientName",
  "recipientPhone",
  "recipientAddress",
  "codAmount",
  "trackingCode",
  "invoiceNo",
  "deliveryStatus",
  "approvalStatus",
  "deliveryTime",
  "riderName",
  "riderPhone",
  "shippingCharge",
  "codCharge",
  "paymentStatus",
  "note",
  "product",
  "orderDate",
  "deliveryDate",
  "deliveryMethod",
  "orderSource",
  "itemDescription",
] as const;

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return jerr(corsHeaders, 500, "AI not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jerr(corsHeaders, 401, "Unauthorized");

    const token = authHeader.replace("Bearer ", "");
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uerr } = await caller.auth.getUser(token);
    if (uerr || !user) return jerr(corsHeaders, 401, "Unauthorized");

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: prof } = await admin
      .from("profiles").select("project_id").eq("user_id", user.id).maybeSingle();
    const projectId = prof?.project_id;
    if (!projectId) return jerr(corsHeaders, 400, "No project found");

    const body = await req.json().catch(() => ({}));
    const { rows, headers, mode = "clean" } = body ?? {};

    if (!Array.isArray(headers) || headers.length === 0) {
      return jerr(corsHeaders, 400, "No headers provided");
    }

    // Mode: detect mapping only (fast, small payload). Always run first.
    const mapping = await detectMapping(headers, lovableApiKey);

    // Also try to match a saved template by header signature.
    let matchedTemplate: any = null;
    const sig = headers.map(normalizeHeader).sort();
    const { data: templates } = await admin
      .from("import_mapping_templates")
      .select("id,name,source_hint,header_signature,mapping,usage_count")
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

    // Fetch existing products to help AI with product matching hint.
    const { data: products } = await admin
      .from("products").select("title,sku").eq("project_id", projectId).limit(200);
    const productHint = (products || []).map((p: any) => p.title).join(", ");

    // Clean rows in batches.
    const BATCH = 50;
    const cleanedAll: any[] = [];
    let corrections: string[] = [];
    let autoCorrected = 0;
    let needsReview = 0;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { cleaned, corrs, ac, nr, status } = await cleanBatch(batch, mapping, productHint, lovableApiKey);
      if (status === 429) return jerr(corsHeaders, 429, "Rate limit exceeded. Please retry shortly.");
      if (status === 402) return jerr(corsHeaders, 402, "AI credits exhausted. Please add credits.");
      cleanedAll.push(...cleaned);
      corrections.push(...corrs);
      autoCorrected += ac;
      needsReview += nr;
    }

    const report = {
      totalRows: rows.length,
      autoCorrected,
      needsReview,
      ready: rows.length - needsReview,
      corrections: Array.from(new Set(corrections)).slice(0, 30),
    };

    return jok(corsHeaders, {
      mapping,
      matchedTemplate,
      headerSignature: sig,
      cleanedRows: cleanedAll,
      report,
    });
  } catch (e) {
    console.error("import cleaner error", e);
    return jerr(buildCorsHeaders(req), 500, e instanceof Error ? e.message : "Unknown error");
  }
});

function jok(cors: Record<string, string>, body: unknown) {
  return new Response(JSON.stringify(body), { headers: { ...cors, "Content-Type": "application/json" } });
}
function jerr(cors: Record<string, string>, status: number, error: string) {
  return new Response(JSON.stringify({ error }), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
function normalizeHeader(h: string) {
  return String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function detectMapping(headers: string[], apiKey: string): Promise<Record<string, string>> {
  const system = `You map raw CSV/XLSX column headers to canonical fields for a Bangladesh courier/CRM import.

Canonical fields:
- externalOrderId (Order ID / Consignment ID / Order#)
- recipientName (Customer / Receiver / Client)
- recipientPhone (Phone / Mobile / Contact)
- recipientAddress (Address)
- codAmount (Cash On Delivery / COD / Total / Amount)
- trackingCode, invoiceNo
- deliveryStatus (Delivered / Pending / Cancelled / Returned / In Transit / Hold)
- approvalStatus, deliveryTime, riderName, riderPhone
- shippingCharge, codCharge
- paymentStatus, note, product, orderDate, deliveryDate, deliveryMethod, orderSource, itemDescription

Return the tool call. For each canonical field either give the exact matching source header string, or omit it if no confident match exists. Never invent headers not present.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Headers: ${JSON.stringify(headers)}` },
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
  batch: any[],
  mapping: Record<string, string>,
  productHint: string,
  apiKey: string,
): Promise<{ cleaned: any[]; corrs: string[]; ac: number; nr: number; status?: number }> {
  const system = `You clean/normalize rows for a Bangladesh CRM import.

Rules:
- Phones: normalize to 11-digit BD format 01XXXXXXXXX. Strip +880, 880 country code, spaces, dashes. If it becomes 10 digits starting with 1, prefix a 0. If clearly not a BD phone, keep the digits but set needsReview=true.
- Names & addresses: trim, collapse whitespace, fix casing (Title Case for names).
- Dates: normalize to YYYY-MM-DD when possible. If ambiguous, keep original and note it.
- Statuses (deliveryStatus): canonicalize to one of Delivered, Pending, Cancelled, Returned, In Transit, Hold. Case-insensitive matching (delivered/success/complete/done -> Delivered).
- Numeric fields (codAmount, shippingCharge, codCharge): strip currency symbols/commas, return numeric string.
- Product: keep original; if it fuzzy-matches one of these existing products, use the existing title: [${productHint || "none"}].
- Required fields for validity: externalOrderId, recipientName, recipientPhone, recipientAddress, codAmount. If any is missing/empty after cleaning, set needsReview=true.
- Optional field errors do NOT set needsReview.
- For each row, list every field you changed in corrections[].`;

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
          name: "return_cleaned_rows",
          description: "Return cleaned rows",
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
                  required: ["rowNumber", "autoCorrected", "needsReview", "corrections"],
                  additionalProperties: false,
                },
              },
            },
            required: ["rows"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_cleaned_rows" } },
    }),
  });

  if (res.status === 429 || res.status === 402) return { cleaned: [], corrs: [], ac: 0, nr: 0, status: res.status };
  if (!res.ok) {
    console.error("AI batch error", res.status, await res.text().catch(() => ""));
    return { cleaned: batch.map(passthrough), corrs: [], ac: 0, nr: 0 };
  }
  const j = await res.json();
  const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return { cleaned: batch.map(passthrough), corrs: [], ac: 0, nr: 0 };
  try {
    const parsed = JSON.parse(args);
    const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
    let ac = 0, nr = 0;
    const corrs: string[] = [];
    for (const r of rows) {
      if (r.autoCorrected) ac++;
      if (r.needsReview) nr++;
      if (Array.isArray(r.corrections)) corrs.push(...r.corrections);
    }
    return { cleaned: rows, corrs, ac, nr };
  } catch {
    return { cleaned: batch.map(passthrough), corrs: [], ac: 0, nr: 0 };
  }
}

function passthrough(r: any) {
  return { ...r, autoCorrected: false, needsReview: false, corrections: [] };
}
