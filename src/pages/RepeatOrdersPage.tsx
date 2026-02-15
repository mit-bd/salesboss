import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { RefreshCw, ChevronRight } from "lucide-react";
import GlobalFilters, { FilterState, EMPTY_FILTERS } from "@/components/GlobalFilters";
import { Order } from "@/types/data";

function applyFilters(orders: Order[], filters: FilterState): Order[] {
  return orders.filter((o) => {
    if (filters.dateFrom && o.orderDate < filters.dateFrom) return false;
    if (filters.dateTo && o.orderDate > filters.dateTo) return false;
    if (filters.salesExecutive && o.assignedTo !== filters.salesExecutive) return false;
    if (filters.product && o.productId !== filters.product) return false;
    if (filters.orderSource && o.orderSource !== filters.orderSource) return false;
    if (filters.followupStep && o.followupStep !== Number(filters.followupStep)) return false;
    if (filters.deliveryMethod && o.deliveryMethod !== filters.deliveryMethod) return false;
    return true;
  });
}

export default function RepeatOrdersPage() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const navigate = useNavigate();
  const { activeOrders } = useOrderStore();
  const repeatOrders = applyFilters(activeOrders.filter((o) => o.isRepeat), filters);

  return (
    <AppLayout>
      <PageHeader title="Repeat Orders" description="Track repeat purchases and customer retention" />
      <GlobalFilters filters={filters} onChange={setFilters} />

      <div className="space-y-3 animate-fade-in">
        {repeatOrders.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground card-shadow">No repeat orders found</div>
        )}
        {repeatOrders.map((order) => {
          const parent = activeOrders.find((o) => o.id === order.parentOrderId);
          return (
            <div key={order.id} onClick={() => navigate(`/orders/${order.id}`)} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 card-shadow hover:card-shadow-hover transition-fast cursor-pointer">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10"><RefreshCw className="h-5 w-5 text-warning" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1"><p className="font-semibold text-foreground">{order.customerName}</p><span className="text-xs text-muted-foreground">#{order.id}</span></div>
                <p className="text-sm text-muted-foreground">{order.productTitle} · ৳{order.price}{parent && <span> · Parent: #{parent.id}</span>}</p>
              </div>
              <div className="text-xs text-muted-foreground shrink-0">Step {order.followupStep} · {order.followupDate}</div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
