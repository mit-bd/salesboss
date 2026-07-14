import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ResumableRun {
  id: string;
  status: string;
  total_rows: number | null;
  total_batches: number | null;
  processed_batches: number | null;
  resumed_from_row: number | null;
  speed_rows_per_sec: number | null;
  resumed_by: string | null;
  resumed_at: string | null;
  started_at: string | null;
}

export function useResumeBanner() {
  const [run, setRun] = useState<ResumableRun | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase as any)
        .from("import_runs")
        .select("id,status,total_rows,total_batches,processed_batches,resumed_from_row,speed_rows_per_sec,resumed_by,resumed_at,started_at")
        .in("status", ["paused", "resumable", "processing", "failed_partial"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setRun((data as any) ?? null);
    };
    load();
    const channel = supabase.channel("resume-banner")
      .on("postgres_changes", { event: "*", schema: "public", table: "import_runs" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return run;
}
