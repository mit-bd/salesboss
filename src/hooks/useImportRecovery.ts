import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ImportRunSummary {
  id: string;
  status: string;
  total_rows: number | null;
  cleaned_rows: number | null;
  duplicate_rows: number | null;
  total_batches: number | null;
  processed_batches: number | null;
  speed_rows_per_sec: number | null;
  resumed_from_row: number | null;
  resumed_at: string | null;
  resumed_by: string | null;
  cancelled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  file_storage_path: string | null;
  template_id: string | null;
  courier_name: string | null;
  device: string | null;
  browser: string | null;
  health_score: any;
}

export function useImportRecovery() {
  const [runs, setRuns] = useState<ImportRunSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("import_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(200);
    setRuns((data as any) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel("import-recovery")
      .on("postgres_changes", { event: "*", schema: "public", table: "import_runs" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  const resume = useCallback(async (id: string) => {
    const { error } = await supabase.functions.invoke("import-resume", { body: { import_run_id: id } });
    if (error) throw error;
    await refresh();
  }, [refresh]);

  const cancel = useCallback(async (id: string) => {
    const { error } = await supabase.functions.invoke("import-cancel", { body: { import_run_id: id } });
    if (error) throw error;
    await refresh();
  }, [refresh]);

  const retryFailed = useCallback(async (id: string) => {
    const { error } = await supabase.rpc("retry_failed_batches", { p_run_id: id });
    if (error) throw error;
    await refresh();
  }, [refresh]);

  return { runs, loading, refresh, resume, cancel, retryFailed };
}
