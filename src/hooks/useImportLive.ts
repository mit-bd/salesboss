import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface QueueBatch {
  id: string;
  batch_index: number;
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | "paused";
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_attempt_at: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface RunLive {
  id: string;
  status: string;
  total_rows: number | null;
  total_batches: number | null;
  processed_batches: number | null;
  speed_rows_per_sec: number | null;
  import_mode: string | null;
  source_filename: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export function useImportLive(runId?: string) {
  const [run, setRun] = useState<RunLive | null>(null);
  const [batches, setBatches] = useState<QueueBatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!runId) return;
    const [{ data: r, error: runError }, { data: q, error: queueError }] = await Promise.all([
      supabase.from("import_runs")
        .select("id,status,total_rows,total_batches,processed_batches,speed_rows_per_sec,import_mode,source_filename,started_at,finished_at")
        .eq("id", runId).maybeSingle(),
      supabase.from("import_queue")
        .select("id,batch_index,status,attempts,max_attempts,last_error,next_attempt_at,started_at,finished_at")
        .eq("import_run_id", runId)
        .order("batch_index", { ascending: true }),
    ]);
    const nextError = runError?.message || queueError?.message || null;
    setError(nextError);
    setRun((r as any) ?? null);
    setBatches(((q as any) ?? []) as QueueBatch[]);
  }, [runId]);

  useEffect(() => {
    if (!runId) return;
    refresh();
    const ch = supabase.channel(`import-live-${runId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "import_runs", filter: `id=eq.${runId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "import_queue", filter: `import_run_id=eq.${runId}` }, refresh)
      .subscribe();
    // Poll fallback every 3s to be safe against dropped realtime events
    const t = setInterval(refresh, 3000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [runId, refresh]);

  const kickWorker = useCallback(async () => {
    const { data, error: invokeError } = await supabase.functions.invoke("import-worker", { body: {} });
    if (invokeError) {
      setError(invokeError.message);
      throw invokeError;
    }
    setError(null);
    return data;
  }, []);

  return { run, batches, refresh, kickWorker, error };
}
