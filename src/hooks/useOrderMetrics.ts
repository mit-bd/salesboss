import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface OrderMetrics {
  totalOrders: number;
  todaysOrders: number;
  pendingFollowups: number;
}

const CACHE_DURATION = 60_000; // 60 seconds

export function useOrderMetrics() {
  const { profile, role } = useAuth();
  const projectId = profile?.project_id;
  const [metrics, setMetrics] = useState<OrderMetrics>({ totalOrders: 0, todaysOrders: 0, pendingFollowups: 0 });
  const [loading, setLoading] = useState(true);
  const lastFetch = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchMetrics = useCallback(async () => {
    if (role === "owner" || !projectId) return;

    const now = Date.now();
    if (now - lastFetch.current < CACHE_DURATION) return;
    lastFetch.current = now;

    const today = new Date().toISOString().slice(0, 10);

    const [totalRes, todayRes, pendingRes] = await Promise.all([
      (supabase.from("orders").select("*", { count: "exact", head: true }) as any)
        .eq("project_id", projectId).eq("is_deleted", false),
      (supabase.from("orders").select("*", { count: "exact", head: true }) as any)
        .eq("project_id", projectId).eq("is_deleted", false).eq("order_date", today),
      (supabase.from("orders").select("*", { count: "exact", head: true }) as any)
        .eq("project_id", projectId).eq("is_deleted", false).eq("current_status", "pending"),
    ]);

    setMetrics({
      totalOrders: totalRes.count || 0,
      todaysOrders: todayRes.count || 0,
      pendingFollowups: pendingRes.count || 0,
    });
    setLoading(false);
  }, [projectId, role]);

  useEffect(() => {
    fetchMetrics();
    intervalRef.current = setInterval(fetchMetrics, CACHE_DURATION);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchMetrics]);

  return { metrics, loading, refresh: fetchMetrics };
}
