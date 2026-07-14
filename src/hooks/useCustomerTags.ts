import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerTag {
  id: string;
  customer_id: string;
  project_id: string;
  tag: string;
  assigned_by: string;
  reason: string | null;
  created_at: string;
}

export function useCustomerTags(customerId: string | undefined) {
  const [tags, setTags] = useState<CustomerTag[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!customerId) { setTags([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("customer_tags")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (!error && data) setTags(data as any as CustomerTag[]);
    setLoading(false);
  }, [customerId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!customerId) return;
    const ch = supabase
      .channel(`customer-tags-${customerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_tags", filter: `customer_id=eq.${customerId}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [customerId, refresh]);

  return { tags, loading, refresh };
}
