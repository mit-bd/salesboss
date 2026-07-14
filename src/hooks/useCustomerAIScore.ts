import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AIScorePayload {
  customer_id: string;
  project_id: string;
  scores: Record<string, number>;
  reasons: Record<string, string>;
  recommendations: Record<string, { action?: string; product?: string; when?: string; level?: string; why?: string; confidence?: number }>;
  model?: string;
  generated_at: string;
  expires_at: string;
  cached?: boolean;
}

export function useCustomerAIScore(customerId: string | undefined) {
  const [data, setData] = useState<AIScorePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (!customerId) return;
    setLoading(true); setError(null);
    try {
      if (!force) {
        const { data: cached } = await supabase
          .from("customer_ai_scores")
          .select("*").eq("customer_id", customerId).maybeSingle();
        if (cached && new Date(cached.expires_at as string).getTime() > Date.now()) {
          setData(cached as any);
          setLoading(false);
          return;
        }
      }
      const { data: res, error: fnErr } = await supabase.functions.invoke("ai-customer-score", {
        body: { customer_id: customerId, force },
      });
      if (fnErr) throw fnErr;
      if ((res as any)?.error) throw new Error((res as any).error);
      setData(res as AIScorePayload);
    } catch (e: any) {
      setError(e?.message || "Failed to compute AI score");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { load(false); }, [load]);

  return { data, loading, error, refresh: () => load(true) };
}
