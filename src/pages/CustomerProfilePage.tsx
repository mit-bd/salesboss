import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, MapPin, Calendar, RefreshCw, ShoppingBag, TrendingUp, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomerTags } from "@/hooks/useCustomerTags";
import CustomerTimeline from "@/components/import/CustomerTimeline";

interface Customer {
  id: string;
  name: string;
  mobile_number: string;
  address: string;
  created_at: string;
  first_order_date?: string | null;
  last_order_date?: string | null;
  total_orders?: number;
  delivered_orders?: number;
  pending_orders?: number;
  cancelled_orders?: number;
  returned_orders?: number;
  repeat_orders?: number;
  lifetime_cod?: number;
  lifetime_shipping?: number;
  lifetime_value?: number;
  avg_order_value?: number;
  last_product?: string | null;
  last_delivery_status?: string | null;
  last_followup_at?: string | null;
  last_executive_name?: string | null;
  is_repeat_customer?: boolean;
  stage?: string;
  is_active?: boolean;
}

export default function CustomerProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { orders, activeOrders, followupHistory } = useOrderStore();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const { tags } = useCustomerTags(id);

  useEffect(() => {
    const fetchCustomer = async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!error && data) setCustomer(data as Customer);
      setLoading(false);
    };
    fetchCustomer();

    const channel = supabase
      .channel(`customer-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "customers", filter: `id=eq.${id}` }, (payload) => {
        setCustomer(payload.new as Customer);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const customerOrders = useMemo(() => {
    if (!customer) return [];
    return orders.filter((o) => o.mobile === customer.mobile_number);
  }, [orders, customer]);

  const activeCustomerOrders = useMemo(
    () => customerOrders.filter((o) => !o.isDeleted),
    [customerOrders]
  );

  const stats = useMemo(() => {
    const total = activeCustomerOrders.length;
    const repeats = activeCustomerOrders.filter((o) => o.isRepeat).length;
    const revenue = activeCustomerOrders.reduce((sum, o) => sum + o.price, 0);

    const allHistoryIds = new Set(activeCustomerOrders.map((o) => o.id));
    const relatedHistory = followupHistory.filter((h) => allHistoryIds.has(h.orderId));
    const lastFollowup = relatedHistory.sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];

    const latestOrder = activeCustomerOrders.sort((a, b) => b.orderDate.localeCompare(a.orderDate))[0];

    return { total, repeats, revenue, lastFollowup, latestOrder, historyCount: relatedHistory.length };
  }, [activeCustomerOrders, followupHistory]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Loading customer profile...</p>
        </div>
      </AppLayout>
    );
  }

  if (!customer) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground mb-4">Customer not found</p>
          <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl animate-fade-in">
        {/* Header */}
        <div className="mb-4">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground mb-3" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="rounded-xl border border-border bg-card p-5 card-shadow">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-semibold text-foreground">{customer.name}</h1>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {customer.mobile_number}</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {customer.address || "No address"}</span>
                </div>
                <p className="text-xs text-muted-foreground/60 mt-1">Customer since {new Date(customer.created_at).toLocaleDateString()}</p>
                {tags.length > 0 && (
                  <div className="flex items-center flex-wrap gap-1.5 mt-3">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    {tags.map((t) => (
                      <Badge
                        key={t.id}
                        variant="outline"
                        className={cn(
                          "text-[10px] h-5 px-1.5",
                          t.assigned_by === "manual" ? "border-primary/40 text-primary" : "border-warning/40 text-warning"
                        )}
                        title={t.reason || undefined}
                      >
                        {t.tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Total Orders", value: stats.total, icon: ShoppingBag, color: "text-primary" },
            { label: "Repeat Orders", value: stats.repeats, icon: RefreshCw, color: "text-warning" },
            { label: "Total Revenue", value: `৳${stats.revenue.toLocaleString()}`, icon: TrendingUp, color: "text-success" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4 card-shadow">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={cn("h-4 w-4", stat.color)} />
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
              <p className="text-lg font-bold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Lifetime analytics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <MiniStat label="Lifetime value" value={`৳${(customer.lifetime_value ?? 0).toLocaleString()}`} />
          <MiniStat label="Avg order value" value={`৳${Math.round(customer.avg_order_value ?? 0).toLocaleString()}`} />
          <MiniStat label="Lifetime shipping" value={`৳${(customer.lifetime_shipping ?? 0).toLocaleString()}`} />
          <MiniStat label="Stage" value={customer.stage || "—"} />
          <MiniStat label="Delivered" value={customer.delivered_orders ?? 0} />
          <MiniStat label="Pending" value={customer.pending_orders ?? 0} />
          <MiniStat label="Cancelled" value={customer.cancelled_orders ?? 0} />
          <MiniStat label="Returned" value={customer.returned_orders ?? 0} />
        </div>

        {/* Extra info row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <MiniStat label="First order" value={customer.first_order_date || "—"} />
          <MiniStat label="Last order" value={customer.last_order_date || "—"} />
          <MiniStat label="Last product" value={customer.last_product || "—"} />
          <MiniStat label="Last delivery status" value={customer.last_delivery_status || "—"} />
          <MiniStat label="Last followup" value={customer.last_followup_at ? new Date(customer.last_followup_at).toLocaleDateString() : "—"} />
          <MiniStat label="Last executive" value={customer.last_executive_name || "—"} />
          <MiniStat label="Repeat customer" value={customer.is_repeat_customer ? "Yes" : "No"} />
          <MiniStat label="Active" value={customer.is_active ? "Yes" : "No"} />
        </div>

        {/* Order Timeline */}
        <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Order Timeline</h2>
          </div>
          <div className="divide-y divide-border">
            {activeCustomerOrders.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm">No orders found</div>
            ) : (
              activeCustomerOrders
                .sort((a, b) => b.orderDate.localeCompare(a.orderDate))
                .map((order) => (
                  <div
                    key={order.id}
                    className="px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors flex items-center justify-between"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-primary">{order.generatedOrderId || order.invoiceId || order.id.slice(0, 8)}</span>
                          {order.isRepeat && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1 border-warning/30 text-warning">
                              <RefreshCw className="h-2.5 w-2.5 mr-0.5" /> Repeat
                            </Badge>
                          )}
                          {order.isUpsell && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1 border-success/30 text-success">Upsell</Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">{order.productTitle}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-xs font-semibold text-foreground">৳{order.price.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">{order.orderDate}</p>
                      </div>
                      <span className={cn(
                        "text-[10px] font-medium rounded px-1.5 py-0.5",
                        order.currentStatus === "completed" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                      )}>
                        Step {order.followupStep}
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Activity Timeline (real business events) */}
        <div className="mt-4">
          <CustomerTimeline customerId={customer.id} mobile={customer.mobile_number} />
        </div>
      </div>
    </AppLayout>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 card-shadow">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-0.5 truncate">{value}</p>
    </div>
  );
}
