import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OrderSource {
  id: string;
  name: string;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
}

interface UseOrderSourcesOptions {
  activeOnly?: boolean;
}

export function useOrderSources(options: UseOrderSourcesOptions = {}) {
  const [sources, setSources] = useState<OrderSource[]>([]);
  const [loading, setLoading] = useState(true);

  const mapRow = (row: any): OrderSource => ({
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    isSystem: row.is_system,
    createdAt: row.created_at,
  });

  const fetchSources = async () => {
    let query = (supabase.from as any)("order_sources").select("*").order("created_at", { ascending: true });
    if (options.activeOnly) {
      query = query.eq("is_active", true);
    }
    const { data, error } = await query;
    if (!error && data) {
      setSources(data.map(mapRow));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSources();

    const channel = supabase
      .channel("order_sources_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_sources" },
        () => {
          fetchSources();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.activeOnly]);

  const addSource = async (name: string) => {
    const { error } = await (supabase.from as any)("order_sources").insert({ name });
    return { error };
  };

  const updateSource = async (id: string, data: Partial<{ name: string; isActive: boolean }>) => {
    const payload: any = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.isActive !== undefined) payload.is_active = data.isActive;
    const { error } = await (supabase.from as any)("order_sources").update(payload).eq("id", id);
    return { error };
  };

  const deleteSource = async (id: string) => {
    const { error } = await (supabase.from as any)("order_sources").delete().eq("id", id);
    return { error };
  };

  return { sources, loading, addSource, updateSource, deleteSource, refetch: fetchSources };
}
