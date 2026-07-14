import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TimelineEvent = {
  id: string;
  at: string;
  type: string;
  title: string;
  detail: string;
  orderId?: string;
  actor?: string;
};

// Merge real events from orders, followup_history, upsell_records, repeat_order_records, order_activity_logs
export function useCustomerTimeline(customerId: string | undefined, mobile: string | undefined) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const ordersRes: any = await supabase
        .from("orders")
        .select("id,invoice_id,generated_order_id,customer_name,product_title,price,order_date,created_at,delivery_status,assigned_to_name,is_upsell,is_repeat,current_status,followup_step")
        .eq("customer_id", customerId)
        .eq("is_deleted", false);
      const orders: any[] = ordersRes?.data || [];
      const orderIds: string[] = orders.map((o: any) => o.id);

      const fetchIn = async (table: string, cols: string, idCol: string) => {
        if (!orderIds.length) return { data: [] as any[] };
        const res: any = await (supabase as any).from(table).select(cols).in(idCol, orderIds);
        return { data: (res?.data || []) as any[] };
      };
      const [fh, ur, rr, al] = await Promise.all([
        fetchIn("followup_history", "id,order_id,step_number,note,completed_at,completed_by_name,next_followup_date", "order_id"),
        fetchIn("upsell_records", "id,order_id,product_title,amount,created_at,created_by_name", "order_id"),
        fetchIn("repeat_order_records", "id,parent_order_id,child_order_id,created_at", "parent_order_id"),
        fetchIn("order_activity_logs", "id,order_id,action_type,action_description,user_name,created_at", "order_id"),
      ]);

      const list: TimelineEvent[] = [];

      (orders || []).forEach((o: any) => {
        list.push({
          id: `order-${o.id}`,
          at: o.created_at || (o.order_date ? `${o.order_date}T00:00:00Z` : new Date().toISOString()),
          type: o.is_repeat ? "repeat_order" : o.is_upsell ? "upsell_order" : "order_created",
          title: o.is_repeat ? "Repeat order placed" : o.is_upsell ? "Upsell order placed" : "Order created",
          detail: `${o.generated_order_id || o.invoice_id || o.id.slice(0, 8)} · ${o.product_title || "—"} · ৳${(o.price || 0).toLocaleString()}`,
          orderId: o.id,
          actor: o.assigned_to_name || undefined,
        });
        if (o.delivery_status) {
          list.push({
            id: `delivery-${o.id}`,
            at: o.created_at || (o.order_date ? `${o.order_date}T00:00:00Z` : new Date().toISOString()),
            type: "delivery_status",
            title: `Delivery: ${o.delivery_status}`,
            detail: `${o.generated_order_id || o.invoice_id || o.id.slice(0, 8)}`,
            orderId: o.id,
          });
        }
      });

      (fh?.data || []).forEach((f: any) => {
        list.push({
          id: `followup-${f.id}`,
          at: f.completed_at,
          type: "followup",
          title: `Followup step ${f.step_number} completed`,
          detail: f.note || (f.next_followup_date ? `Next: ${f.next_followup_date}` : ""),
          orderId: f.order_id,
          actor: f.completed_by_name || undefined,
        });
      });

      (ur?.data || []).forEach((u: any) => {
        list.push({
          id: `upsell-${u.id}`,
          at: u.created_at,
          type: "upsell",
          title: "Upsell recorded",
          detail: `${u.product_title || "—"} · ৳${(u.amount || 0).toLocaleString()}`,
          orderId: u.order_id,
          actor: u.created_by_name || undefined,
        });
      });

      (rr?.data || []).forEach((r: any) => {
        list.push({
          id: `repeat-${r.id}`,
          at: r.created_at,
          type: "repeat",
          title: "Repeat order linked",
          detail: `Parent → Child`,
          orderId: r.parent_order_id,
        });
      });

      (al?.data || []).forEach((a: any) => {
        list.push({
          id: `activity-${a.id}`,
          at: a.created_at,
          type: a.action_type || "activity",
          title: a.action_type || "Activity",
          detail: a.action_description || "",
          orderId: a.order_id,
          actor: a.user_name || undefined,
        });
      });

      list.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
      if (!cancelled) { setEvents(list); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [customerId, mobile]);

  return { events, loading };
}
