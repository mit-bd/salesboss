// AI Customer Profile — permanent AI profile per customer.
// Extends customer_ai_profiles with personality, buying behaviour, preferences,
// loyalty, lifetime trend, AI confidence + evidence. Respects locked_fields
// (fields manually confirmed by a human — AI must NEVER overwrite them).
// Cached 24h unless force=true or dirty=true.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { authenticateUser, createEdgeContext, jsonResponse, logEdge } from "../_shared/edge.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const PROFILE_FIELDS = [
  "personality", "buying_behaviour", "purchase_pattern", "repeat_pattern",
  "price_sensitivity", "product_preference", "preferred_language",
  "preferred_call_time", "preferred_payment", "preferred_courier",
  "lifetime_trend",
] as const;

serve(async (req) => {
  const edge = createEdgeContext("ai-customer-profile", req);
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const j = (b: unknown, s = 200) =>
    jsonResponse(edge, cors, b as Record<string, unknown>, s);

  try {
    logEdge(edge, "info", "request_started", { method: req.method });
    const auth = await authenticateUser(req, SUPABASE_URL, ANON_KEY);
    if (auth.error || !auth.user) {
      logEdge(edge, "warn", "auth_failed", { supabase_error: auth.supabaseError });
      return j({ error: "Unauthorized", backend_error: auth.error, supabase_error: auth.supabaseError }, 401);
    }
    const userId = auth.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const customerId: string | undefined = body?.customer_id;
    const force: boolean = !!body?.force;
    if (!customerId) return j({ error: "customer_id required" }, 400);

    // Scope
    const { data: userProfile } = await admin
      .from("profiles").select("project_id").eq("user_id", userId).maybeSingle();
    const projectId: string | null = userProfile?.project_id ?? null;
    if (!projectId) return j({ error: "No project" }, 403);

    const { data: customer } = await admin
      .from("customers").select("*").eq("id", customerId).eq("project_id", projectId).maybeSingle();
    if (!customer) return j({ error: "Customer not found" }, 404);

    // Load existing profile
    const { data: existing } = await admin
      .from("customer_ai_profiles").select("*").eq("customer_id", customerId).maybeSingle();

    const isFresh = existing?.last_refreshed_at &&
      (Date.now() - new Date(existing.last_refreshed_at).getTime()) < 24 * 60 * 60 * 1000;
    if (existing && isFresh && !existing.dirty && !force) {
      return j({ cached: true, profile: existing });
    }

    // Pull real evidence: orders, followups, upsells, repeats, activity
    const orderIdsRes = await admin.from("orders").select("id").eq("customer_id", customerId).eq("is_deleted", false);
    const orderIds = (orderIdsRes.data || []).map((o: any) => o.id);
    const safeOrderIds = orderIds.length ? orderIds : ["00000000-0000-0000-0000-000000000000"];

    const [orders, followups, upsells, repeats, tags] = await Promise.all([
      admin.from("orders")
        .select("id,invoice_id,product_title,price,shipping_charge,order_date,created_at,delivery_status,current_status,is_repeat,is_upsell,followup_step,delivery_method,order_source,assigned_to_name")
        .eq("customer_id", customerId).eq("is_deleted", false)
        .order("order_date", { ascending: false }).limit(50),
      admin.from("followup_history")
        .select("step_number,note,problems_discussed,upsell_attempted,upsell_details,completed_at,next_followup_date,completed_by_name")
        .in("order_id", safeOrderIds)
        .order("completed_at", { ascending: false }).limit(30),
      admin.from("upsell_records")
        .select("product_name,price,note,created_at")
        .in("followup_id", safeOrderIds).limit(20),
      admin.from("repeat_order_records")
        .select("product_name,price,note,created_at")
        .in("followup_id", safeOrderIds).limit(20),
      admin.from("customer_tags")
        .select("tag,assigned_by,reason")
        .eq("customer_id", customerId).limit(30),
    ]);

    const locked: string[] = existing?.locked_fields ?? [];

    const summary = {
      customer: {
        name: customer.name, mobile: customer.mobile_number,
        stage: customer.stage,
        total_orders: customer.total_orders, delivered: customer.delivered_orders,
        pending: customer.pending_orders, cancelled: customer.cancelled_orders,
        returned: customer.returned_orders, repeat_orders: customer.repeat_orders,
        lifetime_value: customer.lifetime_value, lifetime_cod: customer.lifetime_cod,
        avg_order_value: customer.avg_order_value,
        first_order_date: customer.first_order_date, last_order_date: customer.last_order_date,
        is_repeat_customer: customer.is_repeat_customer, is_active: customer.is_active,
        last_product: customer.last_product, last_delivery_status: customer.last_delivery_status,
        last_executive_name: customer.last_executive_name, last_followup_at: customer.last_followup_at,
      },
      recent_orders: (orders.data || []).slice(0, 20),
      recent_followups: (followups.data || []).slice(0, 20),
      upsells: upsells.data || [],
      repeat_records: repeats.data || [],
      tags: tags.data || [],
      locked_fields: locked,
    };

    const sys = `You are a senior CRM analyst for a Bangladeshi commerce SaaS (SalesBoss).
Return STRICT JSON only. Currency BDT (৳). Timezone Asia/Dhaka.
Every field MUST be grounded in the provided data — never invent facts.
For any field listed in "locked_fields" you MUST return null (do not overwrite manually confirmed values).
"ai_confidence" and "loyalty_score" are integers 0-100.
"lifetime_trend" is one of: growing, stable, declining, new.
"evidence" must map each returned field to a short sentence citing specific numbers/dates from the data.`;

    const usr = `Data:\n${JSON.stringify(summary)}\n\nReturn JSON:
{
  "personality": "brief label (e.g. 'price-conscious pragmatist')" ,
  "buying_behaviour": "short phrase",
  "purchase_pattern": "short phrase (e.g. 'monthly refills')",
  "repeat_pattern": "short phrase",
  "price_sensitivity": "low|medium|high",
  "product_preference": "specific product family or SKU category from data",
  "preferred_language": "Bangla|English|Mixed",
  "preferred_call_time": "e.g. 'weekday evenings 6-9pm BST'",
  "preferred_payment": "COD|Prepaid|Mixed",
  "preferred_courier": "courier name from data or null",
  "loyalty_score": 0,
  "lifetime_trend": "growing",
  "ai_confidence": 0,
  "evidence": {"personality":"", "buying_behaviour":"", "purchase_pattern":"", "repeat_pattern":"", "price_sensitivity":"", "product_preference":"", "preferred_language":"", "preferred_call_time":"", "preferred_payment":"", "preferred_courier":"", "loyalty_score":"", "lifetime_trend":""},
  "memory_events": [
    {"event_type":"objection|promise|complaint|product_rejected|preference|discount_offered|delivery_issue","summary":"","sentiment":"positive|neutral|negative","importance":1,"occurred_at":"ISO or null"}
  ]
}`;

    const model = "google/gemini-2.5-flash";
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_KEY },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
        response_format: { type: "json_object" },
      }),
    });
    if (aiRes.status === 429) return j({ error: "Rate limited, try again in a moment" }, 429);
    if (aiRes.status === 402) return j({ error: "AI credits exhausted" }, 402);
    if (!aiRes.ok) return j({ error: `AI error: ${aiRes.status}` }, 500);
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    // Merge respecting locked_fields
    const merge: Record<string, unknown> = {};
    for (const f of PROFILE_FIELDS) {
      if (locked.includes(f)) continue;
      const v = parsed[f];
      if (v !== undefined && v !== null && v !== "") merge[f] = v;
    }
    if (!locked.includes("loyalty_score") && Number.isFinite(parsed.loyalty_score)) {
      merge.loyalty_score = Math.max(0, Math.min(100, Math.round(parsed.loyalty_score)));
    }
    if (Number.isFinite(parsed.ai_confidence)) {
      merge.ai_confidence = Math.max(0, Math.min(100, Math.round(parsed.ai_confidence)));
    }
    merge.evidence = parsed.evidence || {};
    merge.model = model;
    merge.dirty = false;
    merge.last_refreshed_at = new Date().toISOString();
    merge.customer_id = customerId;
    merge.project_id = projectId;

    const { data: upserted, error: upsertErr } = await admin
      .from("customer_ai_profiles")
      .upsert(merge, { onConflict: "customer_id" })
      .select().maybeSingle();
    if (upsertErr) return j({ error: upsertErr.message }, 500);

    // Persist AI-derived memory events (dedupe by summary+type+customer within 30d)
    const memEvents = Array.isArray(parsed.memory_events) ? parsed.memory_events.slice(0, 20) : [];
    if (memEvents.length > 0) {
      const { data: existingMem } = await admin
        .from("customer_memory_events")
        .select("event_type,summary")
        .eq("customer_id", customerId)
        .eq("source", "ai")
        .gte("occurred_at", new Date(Date.now() - 30 * 86400_000).toISOString());
      const existingKey = new Set((existingMem || []).map((m: any) => `${m.event_type}::${(m.summary || "").trim().toLowerCase()}`));
      const rows = memEvents
        .filter((m: any) => m?.event_type && m?.summary)
        .filter((m: any) => !existingKey.has(`${m.event_type}::${String(m.summary).trim().toLowerCase()}`))
        .map((m: any) => ({
          customer_id: customerId,
          project_id: projectId,
          event_type: String(m.event_type),
          summary: String(m.summary).slice(0, 500),
          sentiment: ["positive", "neutral", "negative"].includes(m.sentiment) ? m.sentiment : "neutral",
          importance: Math.max(1, Math.min(5, Number(m.importance) || 3)),
          occurred_at: m.occurred_at && !isNaN(Date.parse(m.occurred_at)) ? m.occurred_at : new Date().toISOString(),
          source: "ai",
          details: { model },
        }));
      if (rows.length > 0) {
        await admin.from("customer_memory_events").insert(rows);
      }
    }

    return j({ cached: false, profile: upserted });
  } catch (e) {
    logEdge(edge, "error", "unhandled_exception", { backend_error: (e as Error).message });
    return j({ error: (e as Error).message }, 500);
  }
});
