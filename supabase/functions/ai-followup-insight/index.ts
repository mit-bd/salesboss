import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { problems, quickInfo, customerName, productTitle, productPrice, stepNumber, products } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const productList = (products || []).map((p: any) => `- ${p.title} (৳${p.price}, ${p.packageDuration} days)`).join("\n");

    const systemPrompt = `You are a smart AI sales assistant for a health/wellness telesales business in Bangladesh. 
You communicate in Bengali (Bangla) with English terms when needed.
You analyze customer health problems and provide:
1. Product recommendations from available products
2. A natural sales script the executive can use
3. Next followup timing suggestion
4. Customer priority assessment (hot/warm/cold)

Available products:
${productList}

Keep responses concise, actionable, and optimized for telesales workflow.
Always respond in Bengali language.`;

    const userPrompt = `Customer: ${customerName}
Current Product: ${productTitle} (৳${productPrice})
Followup Step: ${stepNumber}
Selected Problems: ${problems || "None"}
Customer Info: ${quickInfo || "Not provided"}

Analyze this customer and provide:
1. **পণ্য সুপারিশ (Product Recommendation)**: Which product/package would be most effective and why
2. **সেলস স্ক্রিপ্ট (Sales Script)**: A natural conversation script (2-3 sentences) the executive can use
3. **পরবর্তী ফলোআপ (Next Followup)**: When and what time to follow up next
4. **গ্রাহক অগ্রাধিকার (Priority)**: Hot/Warm/Cold with brief reasoning`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ suggestion: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-followup-insight error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
