import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ImportErrorRow {
  id: string;
  import_run_id: string;
  batch_index: number | null;
  row_index: number | null;
  category: string;
  why: string | null;
  recommended_fix: string | null;
  retryable: boolean;
  resolved: boolean;
  created_at: string;
}

export function useImportErrors(runId?: string) {
  const [errors, setErrors] = useState<ImportErrorRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!runId) { setErrors([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("import_errors")
      .select("*")
      .eq("import_run_id", runId)
      .order("created_at", { ascending: false })
      .limit(500);
    setErrors((data as any) ?? []);
    setLoading(false);
  }, [runId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { errors, loading, refresh };
}
