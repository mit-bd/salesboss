import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LearningSuggestion {
  id: string;
  kind: string;
  input_value: string;
  suggested_value: string;
  confirmations: number;
  status: string;
  last_seen_at: string;
  promoted_at: string | null;
}

export function useImportLearning() {
  const [items, setItems] = useState<LearningSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("import_learning_suggestions")
      .select("*")
      .order("confirmations", { ascending: false })
      .limit(500);
    setItems((data as any) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const approve = useCallback(async (id: string) => {
    const { error } = await supabase.rpc("promote_learning_suggestion", { p_id: id });
    if (error) throw error;
    await refresh();
  }, [refresh]);

  const reject = useCallback(async (id: string) => {
    const { error } = await supabase.from("import_learning_suggestions").update({ status: "rejected" }).eq("id", id);
    if (error) throw error;
    await refresh();
  }, [refresh]);

  const reset = useCallback(async (kind?: string) => {
    const { data: prof } = await supabase.from("profiles").select("project_id").maybeSingle();
    if (!prof?.project_id) return;
    const { error } = await supabase.rpc("reset_learning", { p_project_id: prof.project_id, p_kind: kind ?? null });
    if (error) throw error;
    await refresh();
  }, [refresh]);

  return { items, loading, refresh, approve, reject, reset };
}
