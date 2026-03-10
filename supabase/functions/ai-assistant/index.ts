import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: userError } = await callerClient.auth.getUser(token);
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Get user role and project
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();
    const callerRole = roleData?.role || "sales_executive";

    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("project_id, full_name")
      .eq("user_id", caller.id)
      .maybeSingle();
    const projectId = profileData?.project_id;
    const userName = profileData?.full_name || caller.email;

    const body = await req.json();
    const { messages, action } = body;

    // If action requested, handle data queries
    if (action === "get_context") {
      const context = await buildContext(supabaseAdmin, callerRole, caller.id, projectId);
      return new Response(JSON.stringify({ context }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build system prompt with live data context
    const context = await buildContext(supabaseAdmin, callerRole, caller.id, projectId);

    const systemPrompt = `You are SalesBoss AI Assistant — a sales copilot for a CRM/Sales Management platform.

Current user: ${userName} (Role: ${callerRole})
${projectId ? `Project ID: ${projectId}` : "No project assigned"}

LIVE DATA CONTEXT:
${context}

CAPABILITIES:
- Provide sales guidance, followup strategies, upsell suggestions
- Generate customer conversation scripts
- Analyze performance data and provide insights
- Answer questions about orders, followups, customers, products
- Suggest followup timing and repeat order strategies

RULES:
- Only reference data from the user's project
- ${callerRole === "sales_executive" ? "Only show data assigned to this user" : "Can access all project data"}
- Be concise and actionable
- Use Bangladesh Taka (৳) for currency
- Format dates in DD MMM YYYY format
- When showing data, use clean markdown tables
- Never reveal internal IDs or technical details to the user
- If asked to perform an action (create order, assign, etc.), explain that actions must be done through the app interface

Respond helpfully in the user's language. Keep answers clear, practical, and data-driven.`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...(messages || []),
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("AI assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function buildContext(
  supabase: any,
  role: string,
  userId: string,
  projectId: string | null
): Promise<string> {
  if (!projectId && role !== "owner") return "No project data available.";

  const parts: string[] = [];
  const today = new Date().toISOString().split("T")[0];

  try {
    // Orders summary
    let ordersQuery = supabase
      .from("orders")
      .select("id, customer_name, current_status, followup_step, followup_date, price, assigned_to_name, is_repeat, is_upsell, order_date, product_title")
      .eq("is_deleted", false);

    if (projectId) ordersQuery = ordersQuery.eq("project_id", projectId);
    if (role === "sales_executive") ordersQuery = ordersQuery.eq("assigned_to", userId);

    const { data: orders } = await ordersQuery.order("created_at", { ascending: false }).limit(500);

    if (orders && orders.length > 0) {
      const total = orders.length;
      const pending = orders.filter((o: any) => o.current_status === "pending").length;
      const completed = orders.filter((o: any) => o.current_status === "completed").length;
      const repeatOrders = orders.filter((o: any) => o.is_repeat).length;
      const upsellOrders = orders.filter((o: any) => o.is_upsell).length;
      const totalRevenue = orders.reduce((s: number, o: any) => s + Number(o.price || 0), 0);

      const todayFollowups = orders.filter((o: any) => o.followup_date === today && o.current_status === "pending").length;
      const overdueFollowups = orders.filter((o: any) => o.followup_date && o.followup_date < today && o.current_status === "pending").length;

      parts.push(`ORDERS SUMMARY:
- Total Orders: ${total}
- Pending: ${pending}
- Completed: ${completed}
- Repeat Orders: ${repeatOrders}
- Upsell Orders: ${upsellOrders}
- Total Revenue: ৳${totalRevenue.toLocaleString()}
- Today's Followups Due: ${todayFollowups}
- Overdue Followups: ${overdueFollowups}`);

      // Followup pipeline
      const stepCounts = [1, 2, 3, 4, 5].map(s => ({
        step: s,
        pending: orders.filter((o: any) => o.followup_step === s && o.current_status === "pending").length,
        completed: orders.filter((o: any) => o.followup_step === s && o.current_status === "completed").length,
      }));
      parts.push(`FOLLOWUP PIPELINE:\n${stepCounts.map(s => `Step ${s.step}: ${s.pending} pending, ${s.completed} completed`).join("\n")}`);

      // Top customers
      const customerCounts: Record<string, { count: number; revenue: number }> = {};
      orders.forEach((o: any) => {
        if (!customerCounts[o.customer_name]) customerCounts[o.customer_name] = { count: 0, revenue: 0 };
        customerCounts[o.customer_name].count++;
        customerCounts[o.customer_name].revenue += Number(o.price || 0);
      });
      const topCustomers = Object.entries(customerCounts)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 5);
      if (topCustomers.length > 0) {
        parts.push(`TOP CUSTOMERS:\n${topCustomers.map(([name, data]) => `- ${name}: ${data.count} orders, ৳${data.revenue.toLocaleString()}`).join("\n")}`);
      }

      // Overdue details
      if (overdueFollowups > 0) {
        const overdue = orders
          .filter((o: any) => o.followup_date && o.followup_date < today && o.current_status === "pending")
          .slice(0, 10);
        parts.push(`OVERDUE FOLLOWUPS (top 10):\n${overdue.map((o: any) => `- ${o.customer_name} (Step ${o.followup_step}, due ${o.followup_date})`).join("\n")}`);
      }
    }

    // Products
    let productsQuery = supabase.from("products").select("title, sku, price, package_duration");
    if (projectId) productsQuery = productsQuery.eq("project_id", projectId);
    const { data: products } = await productsQuery.limit(50);

    if (products && products.length > 0) {
      parts.push(`PRODUCTS:\n${products.map((p: any) => `- ${p.title} (${p.sku}): ৳${p.price}, ${p.package_duration} days`).join("\n")}`);
    }

    // Team (admin/owner only)
    if (role === "admin" || role === "owner") {
      let profilesQuery = supabase.from("profiles").select("user_id, full_name");
      if (projectId) profilesQuery = profilesQuery.eq("project_id", projectId);
      const { data: profiles } = await profilesQuery.limit(50);

      if (profiles && profiles.length > 0) {
        const userIds = profiles.map((p: any) => p.user_id);
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds);

        const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
        parts.push(`TEAM MEMBERS:\n${profiles.map((p: any) => `- ${p.full_name || "Unnamed"} (${roleMap.get(p.user_id) || "no role"})`).join("\n")}`);
      }
    }
  } catch (err) {
    console.error("Context build error:", err);
    parts.push("Error loading some data context.");
  }

  return parts.length > 0 ? parts.join("\n\n") : "No data available yet.";
}
