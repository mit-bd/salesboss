import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OrderTimelineEvent {
  id: string;
  at: string;
  type: string;
  title: string;
  detail: string;
  actor?: string;
}

export function useOrderTimeline(orderId: string | undefined) {
  const [events, setEvents] = useState<OrderTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) { setEvents([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [ord, activity, followups] = await Promise.all([
        supabase.from("orders").select("id,created_at,customer_name,product_title,price,assigned_to_name").eq("id", orderId).maybeSingle(),
        supabase.from("order_activity_logs").select("id,action,description,performed_by_name,created_at").eq("order_id", orderId).order("created_at", { ascending: false }),
        supabase.from("followup_history").select("id,step_number,note,next_followup_date,completed_at,completed_by_name").eq("order_id", orderId).order("completed_at", { ascending: false }),
      ]);
      const list: OrderTimelineEvent[] = [];
      if (ord.data) {
        list.push({
          id: `created-${orderId}`, at: (ord.data as any).created_at,
          type: "order_created", title: "Order created",
          detail: `${(ord.data as any).product_title || "—"} · ৳${((ord.data as any).price || 0).toLocaleString()}`,
          actor: (ord.data as any).assigned_to_name || undefined,
        });
      }
      (activity.data || []).forEach((a: any) => list.push({
        id: `act-${a.id}`, at: a.created_at, type: a.action || "activity",
        title: a.action || "Activity", detail: a.description || "", actor: a.performed_by_name || undefined,
      }));
      (followups.data || []).forEach((f: any) => list.push({
        id: `fh-${f.id}`, at: f.completed_at, type: "followup",
        title: `Followup step ${f.step_number} completed`,
        detail: f.note || (f.next_followup_date ? `Next: ${f.next_followup_date}` : ""),
        actor: f.completed_by_name || undefined,
      }));
      list.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
      if (!cancelled) { setEvents(list); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  return { events, loading };
}
