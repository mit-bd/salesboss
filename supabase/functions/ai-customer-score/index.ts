// AI Customer Score — computes health, repeat/upsell probability, churn/payment risk,
// engagement and overall score for a customer, with a "why" per dimension and
// next-best-action recommendations. Cached in customer_ai_scores for 24h.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY")!;

serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const j = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return j({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return j({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const customerId: string | undefined = body?.customer_id;
    const force: boolean = !!body?.force;
    if (!customerId) return j({ error: "customer_id required" }, 400);

    // Caller's project
    const { data: profile } = await admin
      .from("profiles").select("project_id").eq("user_id", userId).maybeSingle();
    const projectId: string | null = profile?.project_id ?? null;
    if (!projectId) return j({ error: "No project" }, 403);

    // Verify customer belongs to caller's project
    const { data: customer } = await admin
      .from("customers").select("*").eq("id", customerId).eq("project_id", projectId).maybeSingle();
    if (!customer) return j({ error: "Customer not found" }, 404);

    // Cache
    if (!force) {
      const { data: cached } = await admin
        .from("customer_ai_scores")
        .select("*")
        .eq("customer_id", customerId)
        .maybeSingle();
      if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
        return j({ cached: true, ...cached });
      }
    }

    // Pull recent orders + followups (server-side, scoped)
    const [{ data: orders }, { data: followups }] = await Promise.all([
      admin.from("orders")
        .select("id,invoice_id,product_title,price,order_date,created_at,delivery_status,current_status,is_repeat,is_upsell,followup_step")
        .eq("customer_id", customerId).eq("is_deleted", false)
        .order("order_date", { ascending: false }).limit(50),
      admin.from("followup_history")
        .select("step_number,note,completed_at,next_followup_date,completed_by_name")
        .in("order_id",
          (await admin.from("orders").select("id").eq("customer_id", customerId).eq("is_deleted", false)).data?.map((o: any) => o.id) || ["00000000-0000-0000-0000-000000000000"])
        .order("completed_at", { ascending: false }).limit(30),
    ]);

    const summary = {
      customer: {
        name: customer.name, mobile: customer.mobile_number,
        total_orders: customer.total_orders, delivered: customer.delivered_orders,
        pending: customer.pending_orders, cancelled: customer.cancelled_orders,
        returned: customer.returned_orders, repeat_orders: customer.repeat_orders,
        lifetime_value: customer.lifetime_value, avg_order_value: customer.avg_order_value,
        first_order_date: customer.first_order_date, last_order_date: customer.last_order_date,
        stage: customer.stage, last_product: customer.last_product,
        last_followup_at: customer.last_followup_at, last_executive_name: customer.last_executive_name,
        is_active: customer.is_active,
      },
      recent_orders: (orders || []).slice(0, 15),
      recent_followups: (followups || []).slice(0, 15),
    };

    const sys = `You are a senior CRM analyst for a Bangladeshi commerce SaaS.
Return STRICT JSON only. All numeric scores are integers 0-100. Higher = better/more likely.
For risk fields, higher = more risky.
Every dimension MUST include a short "why" sentence citing specific numbers from the data.
Recommendations must be concrete and grounded in the data provided.
Currency is BDT (৳). Never invent facts not present in the data.`;

    const usr = `Data:\n${JSON.stringify(summary)}\n\nReturn JSON matching:
{
  "scores": {"health":0,"repeat_probability":0,"upsell_probability":0,"churn_risk":0,"payment_risk":0,"engagement":0,"overall":0},
  "reasons": {"health":"","repeat_probability":"","upsell_probability":"","churn_risk":"","payment_risk":"","engagement":"","overall":""},
  "recommendations": {
    "next_best_action": {"action":"","why":"","confidence":0},
    "recommended_product": {"product":"","why":"","confidence":0},
    "recommended_upsell": {"product":"","why":"","confidence":0},
    "recommended_followup_time": {"when":"","why":"","confidence":0},
    "customer_risk": {"level":"low|medium|high","why":"","confidence":0}
  }
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

    const scores = parsed.scores || {};
    const reasons = parsed.reasons || {};
    const recommendations = parsed.recommendations || {};

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: upserted, error: upsertErr } = await admin
      .from("customer_ai_scores")
      .upsert({
        customer_id: customerId,
        project_id: projectId,
        scores,
        reasons,
        recommendations,
        model,
        generated_at: new Date().toISOString(),
        expires_at: expiresAt,
      }, { onConflict: "customer_id" })
      .select().maybeSingle();
    if (upsertErr) return j({ error: upsertErr.message }, 500);

    return j({ cached: false, ...upserted });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});
