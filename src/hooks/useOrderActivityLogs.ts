import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OrderActivityLog {
  id: string;
  order_id: string;
  user_id: string | null;
  user_name: string;
  action_type: string;
  action_description: string;
  created_at: string;
}

const PAGE = 25;

export function useOrderActivityLogs(orderId: string | undefined) {
  const [logs, setLogs] = useState<OrderActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const fetchPage = useCallback(async (startAt: number, replace: boolean) => {
    if (!orderId) return;
    const { data, error } = await (supabase.from("order_activity_logs" as any) as any)
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .range(startAt, startAt + PAGE - 1);
    if (error) { setLoading(false); return; }
    const rows = (data || []) as OrderActivityLog[];
    setLogs((prev) => (replace ? rows : [...prev, ...rows]));
    setHasMore(rows.length === PAGE);
    setOffset(startAt + rows.length);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    if (!orderId) { setLogs([]); setLoading(false); return; }
    setLoading(true);
    setOffset(0);
    fetchPage(0, true);
  }, [orderId, fetchPage]);

  // Realtime scoped to this order id
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`activity-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_activity_logs", filter: `order_id=eq.${orderId}` },
        (payload: any) => {
          setLogs((prev) => [payload.new as OrderActivityLog, ...prev]);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  const loadMore = useCallback(() => {
    if (!hasMore) return;
    fetchPage(offset, false);
  }, [hasMore, offset, fetchPage]);

  return { logs, loading, hasMore, loadMore };
}
