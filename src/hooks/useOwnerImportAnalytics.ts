import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OwnerImportAnalytics {
  today_imports: number;
  month_imports: number;
  largest_import: number;
  avg_import_time_ms: number;
  avg_health_score: number;
  most_used_template: string | null;
  most_used_courier: string | null;
  ai_success_rate: number;
  resume_imports: number;
  import_failures: number;
}

export function useOwnerImportAnalytics(days = 30) {
  const [data, setData] = useState<OwnerImportAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: res } = await supabase.rpc("owner_import_analytics", { p_days: days });
    setData((res as any) ?? null);
    setLoading(false);
  }, [days]);

  useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, refresh };
}
