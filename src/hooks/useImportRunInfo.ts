import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ImportRunInfo {
  id: string;
  source: string | null;
  courier_name: string | null;
  created_by_name?: string | null;
  uploaded_by_name?: string | null;
  file_name?: string | null;
  original_file_name?: string | null;
  started_at: string | null;
  created_at?: string | null;
  finished_at?: string | null;
  total_batches: number | null;
  processed_batches: number | null;
  total_rows: number | null;
  cleaned_rows: number | null;
  health_score: any;
  status?: string | null;
}

export function useImportRunInfo(importRunId: string | null | undefined) {
  const [run, setRun] = useState<ImportRunInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(!!importRunId);

  useEffect(() => {
    if (!importRunId) { setRun(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("import_runs")
        .select("*")
        .eq("id", importRunId)
        .maybeSingle();
      if (!cancelled) { setRun((data as any) || null); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [importRunId]);

  return { run, loading };
}
