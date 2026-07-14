import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ImportPerformance {
  avg_speed_rows_per_sec: number;
  fastest_import_ms: number;
  slowest_import_ms: number;
  largest_import: number;
  avg_ai_fixes: number;
  duplicate_rate: number;
  avg_processing_time_ms: number;
  avg_queue_wait_ms: number;
}

export function useImportPerformance() {
  const [data, setData] = useState<ImportPerformance | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: res } = await supabase.rpc("import_performance_snapshot", { p_project_id: null });
    setData((res as any) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, refresh };
}
