import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WorkspaceCustomer {
  id: string;
  name: string;
  mobile_number: string;
  address: string;
  project_id: string;
  total_orders: number;
  delivered_orders: number;
  pending_orders: number;
  cancelled_orders: number;
  returned_orders: number;
  repeat_orders: number;
  lifetime_value: number;
  lifetime_cod: number;
  lifetime_shipping: number;
  avg_order_value: number;
  first_order_date: string | null;
  last_order_date: string | null;
  last_product: string | null;
  last_followup_at: string | null;
  last_executive_name: string | null;
  stage: string;
  is_active: boolean;
  is_repeat_customer: boolean;
  created_at: string;
}

export interface WorkspaceOrderRow {
  id: string;
  customer_id: string | null;
  invoice_id: string | null;
  generated_order_id: string | null;
  external_order_id?: string | null;
  tracking_code: string | null;
  order_source: string | null;
  import_run_id?: string | null;
  order_date: string | null;
  created_at: string;
  updated_at: string;
}

export function useOrderWorkspace(orderId: string | undefined) {
  const [customer, setCustomer] = useState<WorkspaceCustomer | null>(null);
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: o } = await supabase
        .from("orders").select("*").eq("id", orderId).maybeSingle();
      if (!o) { if (!cancelled) { setOrder(null); setCustomer(null); setLoading(false); } return; }
      if (!cancelled) setOrder(o);
      const cid = (o as any).customer_id;
      if (cid) {
        const { data: c } = await supabase
          .from("customers").select("*").eq("id", cid).maybeSingle();
        if (!cancelled) setCustomer((c as any) || null);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  return { order, customer, loading };
}
