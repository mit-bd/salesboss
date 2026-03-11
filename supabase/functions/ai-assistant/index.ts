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
    const { messages, language } = body;
    const lang = language === "bn" ? "bn" : "en";

    // Build comprehensive context with learning data
    const context = await buildContext(supabaseAdmin, callerRole, caller.id, projectId);

    const languageInstruction = lang === "bn"
      ? `\n\n## LANGUAGE INSTRUCTION\nYou MUST respond entirely in Bengali (বাংলা). Use simple, everyday Bengali. Do NOT mix English unless absolutely necessary for technical terms. All analysis, suggestions, scripts, and insights must be in Bengali.`
      : `\n\n## LANGUAGE INSTRUCTION\nRespond in English. Keep it clear and professional.`;

    const systemPrompt = `You are **SalesBoss AI Copilot** — an intelligent sales mentor, analyst, and advisor for a CRM/Sales Management platform.

Current user: ${userName} (Role: ${callerRole})
Today: ${new Date().toISOString().split("T")[0]}

${context}

## YOUR ROLE — AUTONOMOUS SALES AI COPILOT

### 1. PREDICTIVE INTELLIGENCE
- **Repeat Order Predictor**: Analyze each customer's order history and calculate their typical reorder interval. Predict when they're likely to reorder. Flag customers who are overdue for a repeat order.
- **Upsell Timing**: Identify the best moment during the followup cycle to suggest upsells based on historical success data.
- **Customer Risk Detection**: Flag customers who haven't ordered in longer than their usual interval as "at-risk".
- When asked about predictions, provide specific customer names, predicted dates, and confidence levels.

### 2. SALES COACH
- Provide tailored followup conversation scripts adapted to the specific step
- Suggest customer handling strategies based on actual data patterns
- Recommend upsell techniques that have worked historically
- Give repeat order timing advice based on real patterns
- Generate natural, conversational sales scripts in simple language

### 3. PERFORMANCE ANALYST
- Analyze sales executive metrics and identify top performers
- Identify which followup steps convert best
- Find patterns in successful upsells and repeat orders
- Highlight trends in customer behavior
- Provide data-driven recommendations

### 4. AUTONOMOUS ADVISOR
- Proactively provide alerts: overdue followups, repeat opportunities, at-risk customers
- Suggest automation improvements: "Step 2 followups convert better than Step 1"
- Cross-sell insights: "Customers buying Product A often buy Product B"
- Timing insights: "Followups after 7 days increase repeat orders"
- SE coaching: suggest which executives need support based on metrics

### 5. CONTEXTUAL MEMORY
- Use followup notes history to understand customer conversations
- Reference past interactions when advising on next steps
- Track which strategies worked for specific customers
- Remember customer preferences from order history

## RULES
- Only reference data from the user's project (project_id: ${projectId || "none"})
- ${callerRole === "sales_executive" ? "Only show data assigned to this user — never reveal other executives' data" : "Can access all project data"}
- Be concise, actionable, and data-driven
- Use Bangladesh Taka (৳) for currency
- Format dates as DD MMM YYYY
- Use clean markdown formatting (tables, bold, lists)
- Never reveal internal IDs or technical details
- Actions (create order, assign, etc.) must be done through the app UI — guide the user there
- When giving sales scripts, make them natural and conversational
- Proactively offer insights when data suggests opportunities

## LANGUAGE
Respond in the same language the user writes in. Default to Bangla/English mix if unclear.`;

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
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

// ─── COMPREHENSIVE CONTEXT BUILDER ───

async function buildContext(
  supabase: any,
  role: string,
  userId: string,
  projectId: string | null
): Promise<string> {
  if (!projectId && role !== "owner") return "No project data available.";

  const parts: string[] = [];
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  try {
    // ── ORDERS ──
    let ordersQuery = supabase
      .from("orders")
      .select("id, customer_name, mobile, current_status, followup_step, followup_date, price, paid_amount, assigned_to, assigned_to_name, is_repeat, is_upsell, order_date, product_title, product_sku, delivery_method, health, note, parent_order_id")
      .eq("is_deleted", false);

    if (projectId) ordersQuery = ordersQuery.eq("project_id", projectId);
    if (role === "sales_executive") ordersQuery = ordersQuery.eq("assigned_to", userId);

    const { data: orders } = await ordersQuery.order("created_at", { ascending: false }).limit(800);

    if (orders && orders.length > 0) {
      const total = orders.length;
      const pending = orders.filter((o: any) => o.current_status === "pending").length;
      const completed = orders.filter((o: any) => o.current_status === "completed").length;
      const repeatOrders = orders.filter((o: any) => o.is_repeat).length;
      const upsellOrders = orders.filter((o: any) => o.is_upsell).length;
      const totalRevenue = orders.reduce((s: number, o: any) => s + Number(o.price || 0), 0);
      const totalPaid = orders.reduce((s: number, o: any) => s + Number(o.paid_amount || 0), 0);

      const todayFollowups = orders.filter((o: any) => o.followup_date === today && o.current_status === "pending");
      const overdueFollowups = orders.filter((o: any) => o.followup_date && o.followup_date < today && o.current_status === "pending");

      // Recent orders (last 30 days)
      const recentOrders = orders.filter((o: any) => o.order_date >= thirtyDaysAgo);
      const recentRevenue = recentOrders.reduce((s: number, o: any) => s + Number(o.price || 0), 0);

      parts.push(`## ORDERS OVERVIEW
| Metric | Value |
|--------|-------|
| Total Orders | ${total} |
| Pending | ${pending} |
| Completed | ${completed} |
| Repeat Orders | ${repeatOrders} (${total > 0 ? ((repeatOrders / total) * 100).toFixed(1) : 0}%) |
| Upsell Orders | ${upsellOrders} |
| Total Revenue | ৳${totalRevenue.toLocaleString()} |
| Collected | ৳${totalPaid.toLocaleString()} |
| Due | ৳${(totalRevenue - totalPaid).toLocaleString()} |
| Last 30 Days Revenue | ৳${recentRevenue.toLocaleString()} |
| Today's Followups | ${todayFollowups.length} |
| Overdue Followups | ${overdueFollowups.length} |`);

      // Followup pipeline with conversion analysis
      const stepCounts = [1, 2, 3, 4, 5].map(s => {
        const stepOrders = orders.filter((o: any) => o.followup_step === s);
        const stepPending = stepOrders.filter((o: any) => o.current_status === "pending").length;
        const stepCompleted = stepOrders.filter((o: any) => o.current_status === "completed").length;
        return { step: s, total: stepOrders.length, pending: stepPending, completed: stepCompleted };
      });
      parts.push(`## FOLLOWUP PIPELINE
${stepCounts.map(s => `- **Step ${s.step}**: ${s.pending} pending, ${s.completed} completed (${s.total} total)`).join("\n")}`);

      // Today's followups detail
      if (todayFollowups.length > 0) {
        parts.push(`## TODAY'S FOLLOWUPS (${todayFollowups.length})
${todayFollowups.slice(0, 15).map((o: any) => `- ${o.customer_name} — Step ${o.followup_step}, ${o.product_title || "N/A"}, ৳${Number(o.price || 0).toLocaleString()}`).join("\n")}`);
      }

      // Overdue details
      if (overdueFollowups.length > 0) {
        parts.push(`## ⚠ OVERDUE FOLLOWUPS (${overdueFollowups.length})
${overdueFollowups.slice(0, 15).map((o: any) => `- ${o.customer_name} — Step ${o.followup_step}, due ${o.followup_date}, ${o.product_title || "N/A"}`).join("\n")}`);
      }

      // Health analysis
      const healthCounts: Record<string, number> = {};
      orders.forEach((o: any) => { healthCounts[o.health] = (healthCounts[o.health] || 0) + 1; });
      parts.push(`## ORDER HEALTH
${Object.entries(healthCounts).map(([h, c]) => `- ${h}: ${c}`).join("\n")}`);

      // Top customers
      const customerMap: Record<string, { count: number; revenue: number; lastOrder: string; repeats: number }> = {};
      orders.forEach((o: any) => {
        if (!customerMap[o.customer_name]) customerMap[o.customer_name] = { count: 0, revenue: 0, lastOrder: o.order_date, repeats: 0 };
        customerMap[o.customer_name].count++;
        customerMap[o.customer_name].revenue += Number(o.price || 0);
        if (o.is_repeat) customerMap[o.customer_name].repeats++;
        if (o.order_date > customerMap[o.customer_name].lastOrder) customerMap[o.customer_name].lastOrder = o.order_date;
      });
      const topCustomers = Object.entries(customerMap).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10);
      parts.push(`## TOP CUSTOMERS
${topCustomers.map(([name, d]) => `- **${name}**: ${d.count} orders, ৳${d.revenue.toLocaleString()}, ${d.repeats} repeats, last order: ${d.lastOrder}`).join("\n")}`);

      // Product performance
      const productMap: Record<string, { count: number; revenue: number; repeats: number; upsells: number }> = {};
      orders.forEach((o: any) => {
        const key = o.product_title || "Unknown";
        if (!productMap[key]) productMap[key] = { count: 0, revenue: 0, repeats: 0, upsells: 0 };
        productMap[key].count++;
        productMap[key].revenue += Number(o.price || 0);
        if (o.is_repeat) productMap[key].repeats++;
        if (o.is_upsell) productMap[key].upsells++;
      });
      const topProducts = Object.entries(productMap).sort((a, b) => b[1].count - a[1].count).slice(0, 10);
      parts.push(`## PRODUCT PERFORMANCE
${topProducts.map(([name, d]) => `- **${name}**: ${d.count} orders, ৳${d.revenue.toLocaleString()}, ${d.repeats} repeats, ${d.upsells} upsells`).join("\n")}`);

      // Repeat order timing patterns
      const repeatTimings: number[] = [];
      const repeatChildren = orders.filter((o: any) => o.is_repeat && o.parent_order_id);
      const orderById = new Map(orders.map((o: any) => [o.id, o]));
      repeatChildren.forEach((child: any) => {
        const parent = orderById.get(child.parent_order_id);
        if (parent) {
          const days = Math.round((new Date(child.order_date).getTime() - new Date(parent.order_date).getTime()) / 86400000);
          if (days > 0 && days < 365) repeatTimings.push(days);
        }
      });
      if (repeatTimings.length > 0) {
        const avgDays = Math.round(repeatTimings.reduce((a, b) => a + b, 0) / repeatTimings.length);
        const minDays = Math.min(...repeatTimings);
        const maxDays = Math.max(...repeatTimings);
        parts.push(`## REPEAT ORDER PATTERNS (LEARNED)
- Average repeat interval: **${avgDays} days**
- Fastest repeat: ${minDays} days
- Longest repeat: ${maxDays} days
- Total repeat orders analyzed: ${repeatTimings.length}
- 💡 Insight: Customers typically reorder around day ${avgDays}. Proactively reach out a few days earlier.`);

        // ── REPEAT ORDER PREDICTIONS ──
        const todayMs = new Date(today).getTime();
        const predictions: { name: string; lastOrder: string; avgInterval: number; predictedDate: string; daysUntil: number; status: string }[] = [];

        // Build per-customer repeat intervals
        const customerIntervals: Record<string, { intervals: number[]; lastOrder: string }> = {};
        orders.forEach((o: any) => {
          if (!customerIntervals[o.customer_name]) customerIntervals[o.customer_name] = { intervals: [], lastOrder: o.order_date };
          if (o.order_date > customerIntervals[o.customer_name].lastOrder) {
            customerIntervals[o.customer_name].lastOrder = o.order_date;
          }
        });

        // Calculate intervals for customers with repeats
        const customerOrders: Record<string, string[]> = {};
        orders.forEach((o: any) => {
          if (!customerOrders[o.customer_name]) customerOrders[o.customer_name] = [];
          customerOrders[o.customer_name].push(o.order_date);
        });

        Object.entries(customerOrders).forEach(([name, dates]) => {
          if (dates.length < 2) return;
          const sorted = [...new Set(dates)].sort();
          const intervals: number[] = [];
          for (let i = 1; i < sorted.length; i++) {
            const gap = Math.round((new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86400000);
            if (gap > 0 && gap < 365) intervals.push(gap);
          }
          if (intervals.length === 0) return;

          const custAvg = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
          const lastDate = sorted[sorted.length - 1];
          const predictedMs = new Date(lastDate).getTime() + custAvg * 86400000;
          const predictedDate = new Date(predictedMs).toISOString().split("T")[0];
          const daysUntil = Math.round((predictedMs - todayMs) / 86400000);
          const status = daysUntil < 0 ? "🔴 OVERDUE" : daysUntil <= 7 ? "🟡 SOON" : "🟢 UPCOMING";

          predictions.push({ name, lastOrder: lastDate, avgInterval: custAvg, predictedDate, daysUntil, status });
        });

        // Sort: overdue first, then soonest
        predictions.sort((a, b) => a.daysUntil - b.daysUntil);
        const relevantPredictions = predictions.filter(p => p.daysUntil <= 30);

        if (relevantPredictions.length > 0) {
          parts.push(`## 🔮 REPEAT ORDER PREDICTIONS
${relevantPredictions.slice(0, 15).map(p =>
  `- ${p.status} **${p.name}**: avg interval ${p.avgInterval}d, last order ${p.lastOrder}, predicted reorder: **${p.predictedDate}** (${p.daysUntil < 0 ? Math.abs(p.daysUntil) + "d overdue" : p.daysUntil + "d away"})`
).join("\n")}

💡 Use these predictions to proactively reach out to customers before their expected reorder date.`);
        }
      }

      // SE Performance (admin/owner)
      if (role === "admin" || role === "owner") {
        const seMap: Record<string, { name: string; orders: number; revenue: number; repeats: number; upsells: number; pending: number; completedFollowups: number }> = {};
        orders.forEach((o: any) => {
          if (!o.assigned_to) return;
          if (!seMap[o.assigned_to]) seMap[o.assigned_to] = { name: o.assigned_to_name || "Unknown", orders: 0, revenue: 0, repeats: 0, upsells: 0, pending: 0, completedFollowups: 0 };
          seMap[o.assigned_to].orders++;
          seMap[o.assigned_to].revenue += Number(o.price || 0);
          if (o.is_repeat) seMap[o.assigned_to].repeats++;
          if (o.is_upsell) seMap[o.assigned_to].upsells++;
          if (o.current_status === "pending") seMap[o.assigned_to].pending++;
        });
        const sePerformance = Object.entries(seMap).sort((a, b) => b[1].revenue - a[1].revenue);
        if (sePerformance.length > 0) {
          const topSE = sePerformance[0][1];
          const bestRepeatSE = sePerformance.sort((a, b) => b[1].repeats - a[1].repeats)[0]?.[1];
          parts.push(`## SALES EXECUTIVE PERFORMANCE
${sePerformance.map(([_, d]) => `- **${d.name}**: ${d.orders} orders, ৳${d.revenue.toLocaleString()}, ${d.repeats} repeats, ${d.upsells} upsells, ${d.pending} pending`).join("\n")}

🏆 Top Revenue: **${topSE.name}** (৳${topSE.revenue.toLocaleString()})
🔁 Best Repeats: **${bestRepeatSE?.name}** (${bestRepeatSE?.repeats} repeats)`);
        }

        // Cross-sell patterns
        const customerProducts: Record<string, Set<string>> = {};
        orders.forEach((o: any) => {
          if (!o.product_title) return;
          if (!customerProducts[o.customer_name]) customerProducts[o.customer_name] = new Set();
          customerProducts[o.customer_name].add(o.product_title);
        });
        const productPairs: Record<string, number> = {};
        Object.values(customerProducts).forEach(products => {
          const arr = [...products];
          for (let i = 0; i < arr.length; i++) {
            for (let j = i + 1; j < arr.length; j++) {
              const key = [arr[i], arr[j]].sort().join(" + ");
              productPairs[key] = (productPairs[key] || 0) + 1;
            }
          }
        });
        const topPairs = Object.entries(productPairs).sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (topPairs.length > 0 && topPairs[0][1] > 1) {
          parts.push(`## CROSS-SELL PATTERNS (LEARNED)
${topPairs.filter(([_, c]) => c > 1).map(([pair, count]) => `- **${pair}**: bought together by ${count} customers`).join("\n")}`);
        }
      }
    }

    // ── FOLLOWUP HISTORY (Learning Data) ──
    const orderIds = (orders || []).map((o: any) => o.id);
    if (orderIds.length > 0) {
      const { data: followups } = await supabase
        .from("followup_history")
        .select("order_id, step_number, note, problems_discussed, upsell_attempted, upsell_details, next_followup_date, completed_by_name, completed_at")
        .in("order_id", orderIds.slice(0, 200))
        .order("completed_at", { ascending: false })
        .limit(300);

      if (followups && followups.length > 0) {
        // Conversion analysis per step
        const stepAnalysis: Record<number, { total: number; upsellAttempted: number; withProblems: number; notes: string[] }> = {};
        followups.forEach((f: any) => {
          if (!stepAnalysis[f.step_number]) stepAnalysis[f.step_number] = { total: 0, upsellAttempted: 0, withProblems: 0, notes: [] };
          stepAnalysis[f.step_number].total++;
          if (f.upsell_attempted) stepAnalysis[f.step_number].upsellAttempted++;
          if (f.problems_discussed) stepAnalysis[f.step_number].withProblems++;
          if (f.note) stepAnalysis[f.step_number].notes.push(f.note);
        });

        parts.push(`## FOLLOWUP INSIGHTS (LEARNED)
${Object.entries(stepAnalysis).sort((a, b) => Number(a[0]) - Number(b[0])).map(([step, d]) => 
  `- **Step ${step}**: ${d.total} completed, ${d.upsellAttempted} upsell attempts (${d.total > 0 ? ((d.upsellAttempted / d.total) * 100).toFixed(0) : 0}%), ${d.withProblems} with problems reported`
).join("\n")}`);

        // Recent followup notes (for memory/context)
        const recentNotes = followups
          .filter((f: any) => f.note)
          .slice(0, 20)
          .map((f: any) => {
            const order = (orders || []).find((o: any) => o.id === f.order_id);
            return `[Step ${f.step_number}] ${order?.customer_name || "?"}: "${f.note}"${f.problems_discussed ? ` | Problems: "${f.problems_discussed}"` : ""}`;
          });
        if (recentNotes.length > 0) {
          parts.push(`## RECENT FOLLOWUP NOTES (MEMORY)
${recentNotes.join("\n")}`);
        }
      }

      // Upsell records analysis
      const { data: upsells } = await supabase
        .from("upsell_records")
        .select("followup_id, product_name, price, note")
        .limit(100);

      if (upsells && upsells.length > 0) {
        const upsellProducts: Record<string, { count: number; totalValue: number }> = {};
        upsells.forEach((u: any) => {
          const key = u.product_name || "Unknown";
          if (!upsellProducts[key]) upsellProducts[key] = { count: 0, totalValue: 0 };
          upsellProducts[key].count++;
          upsellProducts[key].totalValue += Number(u.price || 0);
        });
        const topUpsells = Object.entries(upsellProducts).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
        parts.push(`## UPSELL PATTERNS (LEARNED)
Most successful upsell products:
${topUpsells.map(([name, d]) => `- **${name}**: ${d.count} times, ৳${d.totalValue.toLocaleString()} total`).join("\n")}`);
      }

      // Repeat order records
      const { data: repeats } = await supabase
        .from("repeat_order_records")
        .select("product_name, price, note")
        .limit(100);

      if (repeats && repeats.length > 0) {
        const repeatProducts: Record<string, { count: number; totalValue: number }> = {};
        repeats.forEach((r: any) => {
          const key = r.product_name || "Unknown";
          if (!repeatProducts[key]) repeatProducts[key] = { count: 0, totalValue: 0 };
          repeatProducts[key].count++;
          repeatProducts[key].totalValue += Number(r.price || 0);
        });
        const topRepeats = Object.entries(repeatProducts).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
        parts.push(`## REPEAT ORDER PATTERNS (LEARNED)
Most repeated products:
${topRepeats.map(([name, d]) => `- **${name}**: ${d.count} times, ৳${d.totalValue.toLocaleString()} total`).join("\n")}`);
      }
    }

    // ── PRODUCTS ──
    let productsQuery = supabase.from("products").select("title, sku, price, package_duration");
    if (projectId) productsQuery = productsQuery.eq("project_id", projectId);
    const { data: products } = await productsQuery.limit(50);

    if (products && products.length > 0) {
      parts.push(`## PRODUCTS CATALOG
${products.map((p: any) => `- **${p.title}** (${p.sku}): ৳${p.price}, ${p.package_duration} day package`).join("\n")}`);
    }

    // ── TEAM (admin/owner) ──
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
        parts.push(`## TEAM
${profiles.map((p: any) => `- ${p.full_name || "Unnamed"} — ${roleMap.get(p.user_id) || "no role"}`).join("\n")}`);
      }
    }

  } catch (err) {
    console.error("Context build error:", err);
    parts.push("Error loading some data context.");
  }

  return parts.length > 0 ? parts.join("\n\n") : "No data available yet.";
}
