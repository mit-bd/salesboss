import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DataQualitySnapshot {
  avg_health_score: number;
  imports_this_month: number;
  duplicate_rate: number;
  repeat_customer_rate: number;
  ai_fix_success_rate: number;
  top_validation_errors: Array<{ category: string; count: number }>;
  top_products: Array<{ name: string; count: number }>;
  top_templates: Array<{ name: string; count: number }>;
}

export function useDataQuality() {
  const { profile } = useAuth();
  const [snapshot, setSnapshot] = useState<DataQualitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!profile?.project_id) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("data_quality_snapshot", { p_project_id: profile.project_id });
    if (err) { setError(err.message); setLoading(false); return; }
    setSnapshot(data as any as DataQualitySnapshot);
    setLoading(false);
  }, [profile?.project_id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { snapshot, loading, error, refresh };
}
