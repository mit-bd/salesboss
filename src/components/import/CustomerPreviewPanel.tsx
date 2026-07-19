import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CustomerLite {
  id: string;
  name: string;
  mobile_number: string;
  total_orders: number;
  repeat_orders: number;
  delivered_orders: number;
  returned_orders: number;
  cancelled_orders: number;
  pending_orders: number;
  lifetime_value: number;
  last_followup_at: string | null;
  last_product: string | null;
  address: string | null;
}

interface OrderLite {
  id: string;
  external_order_id: string | null;
  product_title: string | null;
  price: number | null;
  order_date: string | null;
  delivery_status: string | null;
  current_status: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerId: string | null;
  mobile: string | null;
  projectId: string | null;
}

export default function CustomerPreviewPanel({ open, onOpenChange, customerId, mobile, projectId }: Props) {
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState<CustomerLite | null>(null);
  const [orders, setOrders] = useState<OrderLite[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setCustomer(null);
      setOrders([]);
      setAiSummary(null);
      try {
        let cust: any = null;
        if (customerId) {
          const { data } = await supabase.from("customers").select("*").eq("id", customerId).maybeSingle();
          cust = data;
        } else if (mobile) {
          const { data } = await supabase
            .from("customers")
            .select("*")
            .eq("project_id", projectId)
            .eq("mobile_number", mobile)
            .maybeSingle();
          cust = data;
        }
        if (cancelled) return;
        setCustomer(cust);
        if (cust?.id) {
          const { data: ords } = await supabase
            .from("orders")
            .select("id, external_order_id, product_title, price, order_date, delivery_status, current_status")
            .eq("project_id", projectId)
            .eq("customer_id", cust.id)
            .eq("is_deleted", false)
            .order("order_date", { ascending: false })
            .limit(20);
          if (!cancelled) setOrders(ords || []);
          const { data: ai } = await supabase
            .from("customer_ai_profiles")
            .select("summary")
            .eq("customer_id", cust.id)
            .maybeSingle();
          if (!cancelled) setAiSummary((ai as any)?.summary || null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, customerId, mobile, projectId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Customer Preview</SheetTitle>
        </SheetHeader>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}
        {!loading && !customer && (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No matching customer profile found in the database.
          </div>
        )}
        {!loading && customer && (
          <div className="space-y-4 mt-3 text-sm">
            <div>
              <p className="text-base font-semibold">{customer.name}</p>
              <p className="text-xs text-muted-foreground">{customer.mobile_number}</p>
              {customer.address && <p className="text-xs text-muted-foreground mt-0.5">{customer.address}</p>}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Metric label="Total" value={customer.total_orders} />
              <Metric label="Repeat" value={customer.repeat_orders} />
              <Metric label="Lifetime ৳" value={Math.round(Number(customer.lifetime_value || 0))} />
              <Metric label="Delivered" value={customer.delivered_orders} tone="success" />
              <Metric label="Returned" value={customer.returned_orders} tone="destructive" />
              <Metric label="Cancelled" value={customer.cancelled_orders} tone="destructive" />
              <Metric label="Pending" value={customer.pending_orders} tone="warning" />
            </div>

            <div>
              <p className="text-[11px] text-muted-foreground uppercase font-medium">Last Followup</p>
              <p>{customer.last_followup_at ? new Date(customer.last_followup_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }) : "—"}</p>
            </div>

            {aiSummary && (
              <div className="border border-border rounded-lg p-3 bg-muted/30">
                <p className="text-[11px] uppercase font-medium text-muted-foreground mb-1">AI Summary</p>
                <p className="text-xs whitespace-pre-line">{aiSummary}</p>
              </div>
            )}

            <div>
              <p className="text-[11px] uppercase font-medium text-muted-foreground mb-2">Last {orders.length} orders</p>
              <div className="border border-border rounded-lg divide-y divide-border">
                {orders.length === 0 && <p className="text-xs text-muted-foreground p-3">No orders yet.</p>}
                {orders.map((o) => (
                  <div key={o.id} className="p-2.5 text-xs flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{o.product_title || "—"}</p>
                      <p className="text-muted-foreground truncate">
                        {o.external_order_id || o.id.slice(0, 8)} · {o.order_date || "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p>৳{Math.round(Number(o.price || 0))}</p>
                      <Badge variant="outline" className="text-[9px] mt-0.5">{o.delivery_status || o.current_status || "pending"}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full gap-1.5"
              onClick={() => window.open(`/orders?customer=${customer.id}`, "_blank")}
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open Full Workspace
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" | "destructive" }) {
  const toneCls =
    tone === "success" ? "text-success" :
    tone === "warning" ? "text-warning" :
    tone === "destructive" ? "text-destructive" : "";
  return (
    <div className="border border-border rounded-lg p-2">
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
      <p className={`text-sm font-semibold ${toneCls}`}>{value}</p>
    </div>
  );
}
