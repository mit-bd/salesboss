import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── TOOL DEFINITIONS FOR AI COMMAND EXECUTION ───
const ACTION_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_orders",
      description: "Search orders by customer name, phone number, or invoice ID. Returns matching orders.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string", description: "Customer name to search for (partial match)" },
          phone: { type: "string", description: "Phone/mobile number to search" },
          invoice_id: { type: "string", description: "Invoice ID to search" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Search products by name or SKU. Returns matching products with id, title, sku, price.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Product name or SKU to search for" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_action",
      description: "Propose an action to execute on the system. The user must confirm before execution. Use this when you have identified the target order and action to perform.",
      parameters: {
        type: "object",
        properties: {
          action_type: {
            type: "string",
            enum: ["update_order_product", "update_order_status", "update_order_note", "update_order_price", "assign_order", "update_followup_date", "update_delivery_method", "update_order_source"],
            description: "Type of action to perform",
          },
          order_id: { type: "string", description: "UUID of the target order" },
          order_display: { type: "string", description: "Human-readable order identifier (invoice or customer name)" },
          updates: {
            type: "object",
            description: "Key-value pairs of fields to update",
            properties: {
              product_id: { type: "string" },
              product_title: { type: "string" },
              product_sku: { type: "string" },
              price: { type: "number" },
              note: { type: "string" },
              current_status: { type: "string" },
              health: { type: "string" },
              assigned_to: { type: "string" },
              assigned_to_name: { type: "string" },
              followup_date: { type: "string" },
              delivery_method: { type: "string" },
              order_source: { type: "string" },
            },
            additionalProperties: false,
          },
          summary: { type: "string", description: "Human-readable summary of the proposed change" },
        },
        required: ["action_type", "order_id", "order_display", "updates", "summary"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_team_members",
      description: "Search team members (sales executives) by name. Returns user_id and full_name.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name to search for" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
];

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
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: userError } = await callerClient.auth.getUser(token);
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleData } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", caller.id).maybeSingle();
    const callerRole = roleData?.role || "sales_executive";

    const { data: profileData } = await supabaseAdmin
      .from("profiles").select("project_id, full_name").eq("user_id", caller.id).maybeSingle();
    const projectId = profileData?.project_id;
    const userName = profileData?.full_name || caller.email;

    const body = await req.json();
    const { messages, language, action } = body;
    const lang = language === "bn" ? "bn" : "en";

    // ─── ACTION: EXECUTE CONFIRMED ACTION ───
    if (action === "execute") {
      return await handleExecuteAction(supabaseAdmin, body, callerRole, caller.id, projectId, userName);
    }

    // Build comprehensive context with learning data
    const context = await buildContext(supabaseAdmin, callerRole, caller.id, projectId);

    const languageInstruction = lang === "bn"
      ? `\n\n## LANGUAGE INSTRUCTION\nYou MUST respond entirely in Bengali (বাংলা). Use simple, everyday Bengali. Do NOT mix English unless absolutely necessary for technical terms. All analysis, suggestions, scripts, and insights must be in Bengali.`
      : `\n\n## LANGUAGE INSTRUCTION\nRespond in English. Keep it clear and professional.`;

    const commandInstruction = `
## AI COMMAND EXECUTION CAPABILITY

You can now **execute actions** on the system! When the user asks you to perform an action (add product, update order, assign, etc.), follow this process:

1. **Search first**: Use \`search_orders\` to find the target order, \`search_products\` to match products, \`search_team_members\` to find team members
2. **Propose action**: Once you've identified the target, use \`propose_action\` to propose the change
3. **Never assume**: Always search to verify data before proposing actions
4. **Be specific**: Show the user exactly what will change before they confirm

### Supported actions:
- Add/change product on an order
- Update order status, health, price, note
- Assign order to a sales executive
- Update followup date, delivery method, order source

### Important rules:
- ${callerRole === "sales_executive" ? "You can only modify orders assigned to this user" : "You can modify any order in the project"}
- Always use propose_action — never claim to have executed something without it
- If multiple orders match, ask the user to clarify
- If no orders match, inform the user clearly
`;

    const systemPrompt = `You are **SalesBoss AI Copilot** — an intelligent sales mentor, analyst, advisor, AND action executor for a CRM/Sales Management platform.

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
- Suggest automation improvements
- Cross-sell insights
- SE coaching

### 5. CONTEXTUAL MEMORY
- Use followup notes history to understand customer conversations
- Reference past interactions when advising

${commandInstruction}

## RULES
- Only reference data from the user's project (project_id: ${projectId || "none"})
- ${callerRole === "sales_executive" ? "Only show data assigned to this user — never reveal other executives' data" : "Can access all project data"}
- Be concise, actionable, and data-driven
- Use Bangladesh Taka (৳) for currency
- Format dates as DD MMM YYYY
- Use clean markdown formatting (tables, bold, lists)
- Never reveal internal IDs or technical details to the user
- When giving sales scripts, make them natural and conversational

${languageInstruction}`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...(messages || []),
    ];

    // First call: check if AI wants to use tools
    const toolResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        tools: ACTION_TOOLS,
        stream: false,
      }),
    });

    if (!toolResponse.ok) {
      if (toolResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (toolResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await toolResponse.text();
      console.error("AI gateway error:", toolResponse.status, errorText);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toolResult = await toolResponse.json();
    const choice = toolResult.choices?.[0];

    if (!choice) {
      return new Response(JSON.stringify({ error: "No AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If AI wants to call tools, handle them
    if (choice.finish_reason === "tool_calls" || choice.message?.tool_calls?.length > 0) {
      const toolCalls = choice.message.tool_calls;
      const toolResults: any[] = [];

      for (const tc of toolCalls) {
        const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
        let result: any;

        switch (tc.function.name) {
          case "search_orders":
            result = await toolSearchOrders(supabaseAdmin, args, callerRole, caller.id, projectId);
            break;
          case "search_products":
            result = await toolSearchProducts(supabaseAdmin, args, projectId);
            break;
          case "search_team_members":
            result = await toolSearchTeamMembers(supabaseAdmin, args, projectId);
            break;
          case "propose_action":
            // Return the proposal directly to the client
            return new Response(JSON.stringify({
              type: "action_proposal",
              proposal: args,
              message: choice.message.content || "",
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          default:
            result = { error: "Unknown tool" };
        }

        toolResults.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }

      // Follow-up call with tool results (may propose action or provide info)
      const followupMessages = [
        ...aiMessages,
        choice.message,
        ...toolResults,
      ];

      const followupResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: followupMessages,
          tools: ACTION_TOOLS,
          stream: false,
        }),
      });

      if (!followupResponse.ok) {
        const errText = await followupResponse.text();
        console.error("Followup AI error:", followupResponse.status, errText);
        return new Response(JSON.stringify({ error: "AI service error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const followupResult = await followupResponse.json();
      const followupChoice = followupResult.choices?.[0];

      // Check if followup wants to propose action
      if (followupChoice?.message?.tool_calls?.length > 0) {
        // Handle second round of tool calls
        const secondToolCalls = followupChoice.message.tool_calls;
        const secondToolResults: any[] = [];

        for (const tc of secondToolCalls) {
          const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;

          if (tc.function.name === "propose_action") {
            return new Response(JSON.stringify({
              type: "action_proposal",
              proposal: args,
              message: followupChoice.message.content || "",
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          let result: any;
          switch (tc.function.name) {
            case "search_orders":
              result = await toolSearchOrders(supabaseAdmin, args, callerRole, caller.id, projectId);
              break;
            case "search_products":
              result = await toolSearchProducts(supabaseAdmin, args, projectId);
              break;
            case "search_team_members":
              result = await toolSearchTeamMembers(supabaseAdmin, args, projectId);
              break;
            default:
              result = { error: "Unknown tool" };
          }

          secondToolResults.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }

        // Third call with second round of tool results
        const thirdMessages = [
          ...followupMessages,
          followupChoice.message,
          ...secondToolResults,
        ];

        const thirdResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: thirdMessages,
            tools: ACTION_TOOLS,
            stream: false,
          }),
        });

        if (thirdResponse.ok) {
          const thirdResult = await thirdResponse.json();
          const thirdChoice = thirdResult.choices?.[0];

          if (thirdChoice?.message?.tool_calls?.length > 0) {
            for (const tc of thirdChoice.message.tool_calls) {
              const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
              if (tc.function.name === "propose_action") {
                return new Response(JSON.stringify({
                  type: "action_proposal",
                  proposal: args,
                  message: thirdChoice.message.content || "",
                }), {
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
            }
          }

          // Return text response
          return new Response(JSON.stringify({
            type: "text",
            message: thirdChoice?.message?.content || "I couldn't complete the action.",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Return text response from followup
      return new Response(JSON.stringify({
        type: "text",
        message: followupChoice?.message?.content || "I processed your request.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No tool calls — stream the regular response
    const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    if (!streamResponse.ok) {
      const errText = await streamResponse.text();
      console.error("Stream error:", streamResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(streamResponse.body, {
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

// ─── TOOL: SEARCH ORDERS ───
async function toolSearchOrders(
  supabase: any,
  args: { customer_name?: string; phone?: string; invoice_id?: string },
  role: string,
  userId: string,
  projectId: string | null
) {
  let query = supabase
    .from("orders")
    .select("id, customer_name, mobile, invoice_id, generated_order_id, product_title, product_id, price, current_status, followup_step, health, assigned_to, assigned_to_name, order_date, note, delivery_method, order_source, followup_date")
    .eq("is_deleted", false);

  if (projectId) query = query.eq("project_id", projectId);
  if (role === "sales_executive") query = query.eq("assigned_to", userId);

  if (args.phone) {
    query = query.ilike("mobile", `%${args.phone}%`);
  }
  if (args.customer_name) {
    query = query.ilike("customer_name", `%${args.customer_name}%`);
  }
  if (args.invoice_id) {
    query = query.or(`invoice_id.ilike.%${args.invoice_id}%,generated_order_id.ilike.%${args.invoice_id}%`);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(10);

  if (error) return { error: error.message, orders: [] };
  return { orders: data || [], count: data?.length || 0 };
}

// ─── TOOL: SEARCH PRODUCTS ───
async function toolSearchProducts(
  supabase: any,
  args: { query: string },
  projectId: string | null
) {
  let query = supabase
    .from("products")
    .select("id, title, sku, price, package_duration");

  if (projectId) query = query.eq("project_id", projectId);

  // Fuzzy match on title or SKU
  query = query.or(`title.ilike.%${args.query}%,sku.ilike.%${args.query}%`);

  const { data, error } = await query.limit(10);

  if (error) return { error: error.message, products: [] };
  return { products: data || [], count: data?.length || 0 };
}

// ─── TOOL: SEARCH TEAM MEMBERS ───
async function toolSearchTeamMembers(
  supabase: any,
  args: { name: string },
  projectId: string | null
) {
  let query = supabase
    .from("profiles")
    .select("user_id, full_name");

  if (projectId) query = query.eq("project_id", projectId);
  query = query.ilike("full_name", `%${args.name}%`);

  const { data, error } = await query.limit(10);

  if (error) return { error: error.message, members: [] };
  return { members: data || [], count: data?.length || 0 };
}

// ─── HANDLE EXECUTE ACTION ───
async function handleExecuteAction(
  supabase: any,
  body: any,
  role: string,
  userId: string,
  projectId: string | null,
  userName: string
) {
  const { proposal } = body;
  if (!proposal || !proposal.order_id || !proposal.updates) {
    return new Response(JSON.stringify({ error: "Invalid action proposal" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify the order exists and belongs to the user's project
  let orderQuery = supabase
    .from("orders")
    .select("id, project_id, assigned_to, customer_name, invoice_id")
    .eq("id", proposal.order_id)
    .eq("is_deleted", false)
    .maybeSingle();

  const { data: order, error: orderError } = await orderQuery;

  if (orderError || !order) {
    return new Response(JSON.stringify({ success: false, error: "Order not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Project isolation check
  if (projectId && order.project_id !== projectId) {
    return new Response(JSON.stringify({ success: false, error: "Access denied" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Role-based check: SE can only modify assigned orders
  if (role === "sales_executive" && order.assigned_to !== userId) {
    return new Response(JSON.stringify({ success: false, error: "You can only modify orders assigned to you" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Build safe update object (only allow known fields)
  const allowedFields = [
    "product_id", "product_title", "product_sku", "price",
    "note", "current_status", "health", "assigned_to",
    "assigned_to_name", "followup_date", "delivery_method", "order_source",
  ];
  const safeUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const [key, value] of Object.entries(proposal.updates)) {
    if (allowedFields.includes(key) && value !== undefined && value !== null) {
      safeUpdates[key] = value;
    }
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update(safeUpdates)
    .eq("id", proposal.order_id);

  if (updateError) {
    console.error("Execute action error:", updateError);
    return new Response(JSON.stringify({ success: false, error: "Failed to update order" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Log the activity
  const now = new Date();
  const bstTime = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const dateStr = bstTime.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = bstTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });

  await supabase.from("order_activity_logs").insert({
    order_id: proposal.order_id,
    project_id: projectId,
    user_id: userId,
    user_name: userName,
    action_type: "AI Command",
    action_description: `AI executed: ${proposal.summary} | Requested by: ${userName} | ${dateStr} • ${timeStr} (BST)`,
  });

  return new Response(JSON.stringify({
    success: true,
    message: `✅ Action completed: ${proposal.summary}`,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

      const stepCounts = [1, 2, 3, 4, 5].map(s => {
        const stepOrders = orders.filter((o: any) => o.followup_step === s);
        const stepPending = stepOrders.filter((o: any) => o.current_status === "pending").length;
        const stepCompleted = stepOrders.filter((o: any) => o.current_status === "completed").length;
        return { step: s, total: stepOrders.length, pending: stepPending, completed: stepCompleted };
      });
      parts.push(`## FOLLOWUP PIPELINE
${stepCounts.map(s => `- **Step ${s.step}**: ${s.pending} pending, ${s.completed} completed (${s.total} total)`).join("\n")}`);

      if (todayFollowups.length > 0) {
        parts.push(`## TODAY'S FOLLOWUPS (${todayFollowups.length})
${todayFollowups.slice(0, 15).map((o: any) => `- ${o.customer_name} — Step ${o.followup_step}, ${o.product_title || "N/A"}, ৳${Number(o.price || 0).toLocaleString()}`).join("\n")}`);
      }

      if (overdueFollowups.length > 0) {
        parts.push(`## ⚠ OVERDUE FOLLOWUPS (${overdueFollowups.length})
${overdueFollowups.slice(0, 15).map((o: any) => `- ${o.customer_name} — Step ${o.followup_step}, due ${o.followup_date}, ${o.product_title || "N/A"}`).join("\n")}`);
      }

      const healthCounts: Record<string, number> = {};
      orders.forEach((o: any) => { healthCounts[o.health] = (healthCounts[o.health] || 0) + 1; });
      parts.push(`## ORDER HEALTH
${Object.entries(healthCounts).map(([h, c]) => `- ${h}: ${c}`).join("\n")}`);

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
- Total repeat orders analyzed: ${repeatTimings.length}`);

        const todayMs = new Date(today).getTime();
        const predictions: { name: string; lastOrder: string; avgInterval: number; predictedDate: string; daysUntil: number; status: string }[] = [];

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

        predictions.sort((a, b) => a.daysUntil - b.daysUntil);
        const relevantPredictions = predictions.filter(p => p.daysUntil <= 30);

        if (relevantPredictions.length > 0) {
          parts.push(`## 🔮 REPEAT ORDER PREDICTIONS
${relevantPredictions.slice(0, 15).map(p =>
  `- ${p.status} **${p.name}**: avg interval ${p.avgInterval}d, last order ${p.lastOrder}, predicted reorder: **${p.predictedDate}** (${p.daysUntil < 0 ? Math.abs(p.daysUntil) + "d overdue" : p.daysUntil + "d away"})`
).join("\n")}`);
        }
      }

      // SE Performance (admin/owner)
      if (role === "admin" || role === "owner") {
        const seMap: Record<string, { name: string; orders: number; revenue: number; repeats: number; upsells: number; pending: number }> = {};
        orders.forEach((o: any) => {
          if (!o.assigned_to) return;
          if (!seMap[o.assigned_to]) seMap[o.assigned_to] = { name: o.assigned_to_name || "Unknown", orders: 0, revenue: 0, repeats: 0, upsells: 0, pending: 0 };
          seMap[o.assigned_to].orders++;
          seMap[o.assigned_to].revenue += Number(o.price || 0);
          if (o.is_repeat) seMap[o.assigned_to].repeats++;
          if (o.is_upsell) seMap[o.assigned_to].upsells++;
          if (o.current_status === "pending") seMap[o.assigned_to].pending++;
        });
        const sePerformance = Object.entries(seMap).sort((a, b) => b[1].revenue - a[1].revenue);
        if (sePerformance.length > 0) {
          const topSE = sePerformance[0][1];
          const bestRepeatSE = [...sePerformance].sort((a, b) => b[1].repeats - a[1].repeats)[0]?.[1];
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

    // ── FOLLOWUP HISTORY ──
    const orderIds = (orders || []).map((o: any) => o.id);
    if (orderIds.length > 0) {
      const { data: followups } = await supabase
        .from("followup_history")
        .select("order_id, step_number, note, problems_discussed, upsell_attempted, upsell_details, next_followup_date, completed_by_name, completed_at")
        .in("order_id", orderIds.slice(0, 200))
        .order("completed_at", { ascending: false })
        .limit(300);

      if (followups && followups.length > 0) {
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

        const recentNotes = followups.filter((f: any) => f.note).slice(0, 20).map((f: any) => {
          const order = (orders || []).find((o: any) => o.id === f.order_id);
          return `[Step ${f.step_number}] ${order?.customer_name || "?"}: "${f.note}"${f.problems_discussed ? ` | Problems: "${f.problems_discussed}"` : ""}`;
        });
        if (recentNotes.length > 0) {
          parts.push(`## RECENT FOLLOWUP NOTES (MEMORY)
${recentNotes.join("\n")}`);
        }
      }

      const { data: upsells } = await supabase
        .from("upsell_records").select("followup_id, product_name, price, note").limit(100);

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
${topUpsells.map(([name, d]) => `- **${name}**: ${d.count} times, ৳${d.totalValue.toLocaleString()} total`).join("\n")}`);
      }

      const { data: repeats } = await supabase
        .from("repeat_order_records").select("product_name, price, note").limit(100);

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
          .from("user_roles").select("user_id, role").in("user_id", userIds);

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
