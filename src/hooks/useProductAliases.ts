import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ProductAlias {
  id: string;
  project_id: string;
  product_id: string | null;
  alias: string;
  source: string | null;
  confidence: number;
  status: string;
  created_at: string;
}

export function useProductAliases() {
  const { profile } = useAuth();
  const [aliases, setAliases] = useState<ProductAlias[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!profile?.project_id) { setAliases([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("product_aliases")
      .select("*")
      .eq("project_id", profile.project_id)
      .order("created_at", { ascending: false });
    if (!error && data) setAliases(data as any as ProductAlias[]);
    setLoading(false);
  }, [profile?.project_id]);

  useEffect(() => { refresh(); }, [refresh]);

  const addAlias = useCallback(
    async (input: { alias: string; product_id?: string | null; source?: string | null }) => {
      if (!profile?.project_id) throw new Error("No project");
      const { error } = await supabase.from("product_aliases").insert({
        project_id: profile.project_id,
        alias: input.alias.trim(),
        product_id: input.product_id ?? null,
        source: input.source ?? null,
        status: "confirmed",
      } as any);
      if (error) throw error;
      await refresh();
    },
    [profile?.project_id, refresh]
  );

  const updateAlias = useCallback(async (id: string, patch: Partial<ProductAlias>) => {
    const { error } = await supabase.from("product_aliases").update(patch as any).eq("id", id);
    if (error) throw error;
    await refresh();
  }, [refresh]);

  const deleteAlias = useCallback(async (id: string) => {
    const { error } = await supabase.from("product_aliases").delete().eq("id", id);
    if (error) throw error;
    await refresh();
  }, [refresh]);

  return { aliases, loading, refresh, addAlias, updateAlias, deleteAlias };
}
