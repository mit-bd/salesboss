import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

/**
 * AI Address Normalizer — Bangladesh addresses.
 * Input:  { addresses: [{ id, raw, confirmed?: boolean }] }
 * Output: { results: [{ id, normalized, parts, confidence, why, skipped }] }
 * Rows with confirmed=true are returned unchanged.
 */
serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) return json(corsHeaders, 500, { error: "AI not configured" });

    const body = await req.json().catch(() => ({}));
    const addresses = Array.isArray(body?.addresses) ? body.addresses : [];
    if (addresses.length === 0) return json(corsHeaders, 400, { error: "No addresses provided" });

    const toProcess = addresses.filter((a: any) => a?.raw && !a?.confirmed);
    const skipped = addresses
      .filter((a: any) => a?.confirmed)
      .map((a: any) => ({ id: a.id, normalized: a.raw, parts: {}, confidence: 1, why: "User-confirmed address preserved", skipped: true }));

    if (toProcess.length === 0) return json(corsHeaders, 200, { results: skipped });

    const prompt = `You are a Bangladesh address normalizer. For each address, return structured JSON:
{
  "id": "...",
  "normalized": "clean single-line address",
  "parts": { "district": "", "upazila": "", "area": "", "road": "", "house": "", "village": "", "flat": "", "postal_code": "" },
  "confidence": 0-1,
  "why": "short reason"
}
Rules:
- Fix duplicate words, spacing, capitalization, extra commas.
- Keep Bangla script if input is Bangla; otherwise Title Case English.
- Never invent data. Missing parts = "".
Input:
${JSON.stringify(toProcess.map((a: any) => ({ id: a.id, raw: a.raw })))}
Return only {"results":[...]}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableApiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return json(corsHeaders, resp.status, { error: "AI gateway error", details: text });
    }

    const data = await resp.json();
    let parsed: any = {};
    try { parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}"); } catch { parsed = {}; }
    const results = Array.isArray(parsed?.results) ? parsed.results : [];

    return json(corsHeaders, 200, { results: [...skipped, ...results] });
  } catch (e) {
    return json(buildCorsHeaders(req), 500, { error: (e as Error).message });
  }
});

function json(headers: Record<string, string>, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}
