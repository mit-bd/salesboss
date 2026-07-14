import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ImportWarning {
  id: string;
  import_run_id: string;
  project_id: string;
  row_number: number;
  category: string;
  severity: "critical" | "warning" | "suggestion";
  field: string | null;
  message: string;
  reason: string | null;
  suggested_fix: any;
  resolved: boolean;
  created_at: string;
}

export function useImportWarnings(importRunId?: string) {
  const [warnings, setWarnings] = useState<ImportWarning[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!importRunId) { setWarnings([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("import_warnings")
      .select("*")
      .eq("import_run_id", importRunId)
      .order("severity", { ascending: true })
      .order("row_number", { ascending: true });
    if (!error && data) setWarnings(data as any as ImportWarning[]);
    setLoading(false);
  }, [importRunId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { warnings, loading, refresh, setWarnings };
}
