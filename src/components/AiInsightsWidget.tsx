import { useState, useEffect, useCallback } from "react";
import { BrainCircuit, Loader2, TrendingUp, RotateCcw, Zap, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

export default function AiInsightsWidget() {
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) { setLoading(false); return; }

      const prompt = `Give me a brief AI Insights panel with exactly 4-5 bullet points. Include:
1. One repeat order prediction (which customer might reorder soon and when)
2. One upsell opportunity
3. One followup improvement tip
4. One sales performance highlight
5. One overdue/urgent alert if any

Keep each point to ONE short sentence. Use emojis for visual. Don't use headers or tables — just a clean bullet list.`;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!resp.ok) throw new Error("Failed to load insights");
      if (!resp.body) throw new Error("No response");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      let done = false;

      while (!done) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) content += delta;
          } catch { break; }
        }
      }

      setInsights(content || "No insights available at this time.");
    } catch (err: any) {
      setError(err.message || "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-shadow animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-[hsl(250,70%,55%)]/10">
            <BrainCircuit className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-sm font-semibold text-card-foreground">AI Insights</h2>
        </div>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
          title="Refresh insights"
        >
          <RotateCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !insights && (
        <div className="flex items-center gap-2 py-6 justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Generating insights...</span>
        </div>
      )}

      {error && !insights && (
        <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <span>{error}</span>
        </div>
      )}

      {insights && (
        <div className="prose prose-sm dark:prose-invert max-w-none text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_strong]:text-foreground">
          <ReactMarkdown>{insights}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
