import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("project_id")
      .eq("user_id", caller.id)
      .maybeSingle();
    const projectId = profileData?.project_id;

    if (!projectId) {
      return new Response(JSON.stringify({ error: "No project found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { rows, headers: csvHeaders } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: "No data provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch existing products for matching
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("title, sku, price")
      .eq("project_id", projectId);

    const productList = (products || []).map((p: any) => `${p.title} (SKU: ${p.sku}, ৳${p.price})`).join(", ");

    // Process in batches of 50 to stay within token limits
    const BATCH_SIZE = 50;
    const allCleaned: any[] = [];
    let totalAutoCorrected = 0;
    let totalNeedsReview = 0;
    const corrections: string[] = [];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      const systemPrompt = `You are a data cleaning AI for a sales management system. Clean and normalize the provided CSV rows.

## RULES
1. **Phone numbers**: Normalize to 11-digit Bangladesh format (01XXXXXXXXX). Handle +880, 880, or missing leading 0.
2. **Customer names**: Trim extra spaces, fix capitalization to Title Case.
3. **Product names**: Match to existing products if similar. Existing products: [${productList || "none"}]
4. **Addresses**: Trim spaces, remove unnecessary characters, keep meaningful text.
5. **Dates**: Normalize to YYYY-MM-DD format if possible.
6. **Prices**: Extract numeric value, remove currency symbols.
7. Required fields: customerName, mobile, address. If these are missing/empty, mark needsReview=true.
8. Optional fields can be empty - that's fine.
9. For each row, set:
   - autoCorrected: true if you changed any value
   - needsReview: true if required fields are missing or data is too ambiguous
   - corrections: array of strings describing what was changed

Return ONLY the tool call with cleaned data.`;

      const userPrompt = `Clean these ${batch.length} rows (batch ${batchNum}):
${JSON.stringify(batch, null, 2)}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "return_cleaned_rows",
              description: "Return the cleaned and normalized rows",
              parameters: {
                type: "object",
                properties: {
                  rows: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        rowNumber: { type: "number" },
                        customerName: { type: "string" },
                        mobile: { type: "string" },
                        address: { type: "string" },
                        orderSource: { type: "string" },
                        product: { type: "string" },
                        price: { type: "string" },
                        note: { type: "string" },
                        orderDate: { type: "string" },
                        deliveryDate: { type: "string" },
                        deliveryMethod: { type: "string" },
                        itemDescription: { type: "string" },
                        autoCorrected: { type: "boolean" },
                        needsReview: { type: "boolean" },
                        corrections: { type: "array", items: { type: "string" } },
                      },
                      required: ["rowNumber", "customerName", "mobile", "address", "autoCorrected", "needsReview", "corrections"],
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
        console.error("AI error:", response.status, await response.text());
        // Fallback: return rows as-is
        allCleaned.push(...batch.map((r: any) => ({ ...r, autoCorrected: false, needsReview: false, corrections: [] })));
        continue;
      }

      const result = await response.json();
      try {
        const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall) {
          const parsed = JSON.parse(toolCall.function.arguments);
          if (parsed.rows && Array.isArray(parsed.rows)) {
            allCleaned.push(...parsed.rows);
            totalAutoCorrected += parsed.rows.filter((r: any) => r.autoCorrected).length;
            totalNeedsReview += parsed.rows.filter((r: any) => r.needsReview).length;
            parsed.rows.forEach((r: any) => {
              if (r.corrections?.length) corrections.push(...r.corrections);
            });
            continue;
          }
        }
      } catch (e) {
        console.error("Parse error:", e);
      }

      // Fallback
      allCleaned.push(...batch.map((r: any) => ({ ...r, autoCorrected: false, needsReview: false, corrections: [] })));
    }

    const report = {
      totalRows: rows.length,
      autoCorrected: totalAutoCorrected,
      needsReview: totalNeedsReview,
      ready: rows.length - totalNeedsReview,
      corrections: [...new Set(corrections)].slice(0, 20),
    };

    return new Response(JSON.stringify({ cleanedRows: allCleaned, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Import cleaner error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
