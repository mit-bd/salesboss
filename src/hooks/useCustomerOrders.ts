import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerOrderRow {
  id: string;
  invoice_id: string | null;
  generated_order_id: string | null;
  product_title: string | null;
  price: number | null;
  order_date: string | null;
  created_at: string;
  delivery_status: string | null;
  current_status: string | null;
  assigned_to_name: string | null;
  is_repeat: boolean | null;
  is_upsell: boolean | null;
}

export function useCustomerOrders(customerId: string | undefined) {
  const [orders, setOrders] = useState<CustomerOrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) { setOrders([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("orders")
        .select("id,invoice_id,generated_order_id,product_title,price,order_date,created_at,delivery_status,current_status,assigned_to_name,is_repeat,is_upsell")
        .eq("customer_id", customerId)
        .eq("is_deleted", false)
        .order("order_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setOrders((data || []) as any);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [customerId]);

  return { orders, loading };
}
