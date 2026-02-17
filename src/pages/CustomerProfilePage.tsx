import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, MapPin, Package, Calendar, RefreshCw, ShoppingBag, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  mobile_number: string;
  address: string;
  created_at: string;
}

export default function CustomerProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { orders, activeOrders, followupHistory } = useOrderStore();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

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
    const paid = activeCustomerOrders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);

    const allHistoryIds = new Set(activeCustomerOrders.map((o) => o.id));
    const relatedHistory = followupHistory.filter((h) => allHistoryIds.has(h.orderId));
    const lastFollowup = relatedHistory.sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];

    const latestOrder = activeCustomerOrders.sort((a, b) => b.orderDate.localeCompare(a.orderDate))[0];

    return { total, repeats, revenue, paid, lastFollowup, latestOrder, historyCount: relatedHistory.length };
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
              <div>
                <h1 className="text-xl font-semibold text-foreground">{customer.name}</h1>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {customer.mobile_number}</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {customer.address || "No address"}</span>
                </div>
                <p className="text-xs text-muted-foreground/60 mt-1">Customer since {new Date(customer.created_at).toLocaleDateString()}</p>
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
            { label: "Total Paid", value: `৳${stats.paid.toLocaleString()}`, icon: Package, color: "text-info" },
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

        {/* Extra info row */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl border border-border bg-card p-4 card-shadow">
            <p className="text-xs text-muted-foreground">Followups Completed</p>
            <p className="text-sm font-semibold text-foreground mt-1">{stats.historyCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 card-shadow">
            <p className="text-xs text-muted-foreground">Last Followup</p>
            <p className="text-sm font-semibold text-foreground mt-1">
              {stats.lastFollowup ? new Date(stats.lastFollowup.completedAt).toLocaleDateString() : "None"}
            </p>
          </div>
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
      </div>
    </AppLayout>
  );
}
