import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { useAuth } from "@/contexts/AuthContext";
import { RefreshCw, ChevronRight, Search, TrendingUp, DollarSign, Package } from "lucide-react";
import GlobalFilters, { FilterState, EMPTY_FILTERS } from "@/components/GlobalFilters";
import { Input } from "@/components/ui/input";
import { Order } from "@/types/data";
import { cn } from "@/lib/utils";

function applyFilters(orders: Order[], filters: FilterState, search: string): Order[] {
  return orders.filter((o) => {
    if (filters.dateFrom && o.orderDate < filters.dateFrom) return false;
    if (filters.dateTo && o.orderDate > filters.dateTo) return false;
    if (filters.salesExecutive && o.assignedTo !== filters.salesExecutive) return false;
    if (filters.product && o.productId !== filters.product) return false;
    if (filters.orderSource && o.orderSource !== filters.orderSource) return false;
    if (filters.deliveryMethod && o.deliveryMethod !== filters.deliveryMethod) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!o.customerName.toLowerCase().includes(s) && !o.mobile.includes(s)) return false;
    }
    return true;
  });
}

export default function RepeatOrdersPage() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { activeOrders, followupHistory, repeatOrderRecords } = useOrderStore();
  const { user, role } = useAuth();

  // For SE role, only show orders they confirmed
  const allRepeatOrders = useMemo(() => {
    let orders = activeOrders.filter((o) => o.isRepeat);
    if (role === "sales_executive" && user) {
      // Only show repeat orders where the repeat_order_record was added by this user
      const myRepeatChildIds = new Set(
        repeatOrderRecords.filter((r) => r.addedBy === user.id).map((r) => r.childOrderId)
      );
      orders = orders.filter((o) => myRepeatChildIds.has(o.id));
    }
    return orders;
  }, [activeOrders, role, user, repeatOrderRecords]);

  const filtered = applyFilters(allRepeatOrders, filters, search);

  // Analytics
  const totalCount = filtered.length;
  const totalRevenue = filtered.reduce((s, o) => s + o.price, 0);

  // Product-wise breakdown
  const productBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    filtered.forEach((o) => {
      const key = o.productId || "unknown";
      const existing = map.get(key) || { name: o.productTitle || "Unknown", count: 0, revenue: 0 };
      existing.count++;
      existing.revenue += o.price;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  // Get confirmedBy info from repeat_order_records + followup_history
  const getConfirmInfo = (order: Order) => {
    const record = repeatOrderRecords.find((r) => r.childOrderId === order.id);
    if (!record) return { confirmedBy: "", confirmDate: "", step: 0 };
    const followup = followupHistory.find((h) => h.id === record.followupId);
    return {
      confirmedBy: followup?.completedByName || "",
      confirmDate: followup?.completedAt?.split("T")[0] || record.createdAt?.split("T")[0] || "",
      step: followup?.stepNumber || 0,
    };
  };

  return (
    <AppLayout>
      <PageHeader title="Repeat Orders" description="Track repeat purchases and customer retention" />

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-fade-in">
        <div className="rounded-xl border border-border bg-card p-4 card-shadow">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Repeat Orders</p>
              <p className="text-xl font-bold text-foreground">{totalCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 card-shadow">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10">
              <DollarSign className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-xl font-bold text-foreground">৳{totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 card-shadow">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10">
              <Package className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Products</p>
              <p className="text-xl font-bold text-foreground">{productBreakdown.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Product Breakdown */}
      {productBreakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 card-shadow mb-6 animate-fade-in">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Product Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {productBreakdown.map((p) => (
              <div key={p.name} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-foreground">{p.count} orders</span>
                  <span className="text-xs font-medium text-foreground">৳{p.revenue.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters + Search */}
      <div className="flex items-center gap-3 mb-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search name or mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8 text-xs"
          />
        </div>
      </div>
      <GlobalFilters filters={filters} onChange={setFilters} showStepFilter={false} />

      {/* Order List */}
      <div className="space-y-3 animate-fade-in">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground card-shadow">No repeat orders found</div>
        )}
        {filtered.map((order) => {
          const parent = activeOrders.find((o) => o.id === order.parentOrderId);
          const { confirmedBy, confirmDate, step } = getConfirmInfo(order);
          return (
            <div key={order.id} onClick={() => navigate(`/orders/${order.id}`)} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 card-shadow hover:card-shadow-hover transition-fast cursor-pointer">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 shrink-0"><RefreshCw className="h-5 w-5 text-warning" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-foreground">{order.customerName}</p>
                  <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-warning/10 text-warning">Repeat</span>
                  <span className="text-xs text-muted-foreground">#{order.invoiceId || order.id}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{order.mobile}</span>
                  <span>{order.productTitle}</span>
                  <span className="font-medium text-foreground">৳{order.price.toLocaleString()}</span>
                  {parent && <span>Parent: #{parent.invoiceId || parent.id}</span>}
                  {order.assignedToName && <span>Assigned: {order.assignedToName}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                {confirmedBy && <p className="text-xs text-muted-foreground">By {confirmedBy}</p>}
                {confirmDate && <p className="text-xs text-muted-foreground">{confirmDate}</p>}
                {step > 0 && <p className="text-[10px] text-muted-foreground">Step {step}</p>}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
