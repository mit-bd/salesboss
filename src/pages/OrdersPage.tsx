import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { mockDeliveryPartners } from "@/data/mockData";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import GlobalFilters, { FilterState, EMPTY_FILTERS } from "@/components/GlobalFilters";
import CreateOrderDialog from "@/components/CreateOrderDialog";
import EditOrderDialog from "@/components/EditOrderDialog";
import { useRole } from "@/contexts/RoleContext";
import { Order } from "@/types/data";

const healthColors: Record<string, string> = {
  new: "bg-info/10 text-info border-info/20",
  good: "bg-success/10 text-success border-success/20",
  "at-risk": "bg-warning/10 text-warning border-warning/20",
};

const stepColors = [
  "bg-step-1/10 text-step-1",
  "bg-step-2/10 text-step-2",
  "bg-step-3/10 text-step-3",
  "bg-step-4/10 text-step-4",
  "bg-step-5/10 text-step-5",
];

function applyFilters(orders: Order[], filters: FilterState, search: string): Order[] {
  return orders.filter((o) => {
    if (search && !o.customerName.toLowerCase().includes(search.toLowerCase()) && !o.id.toLowerCase().includes(search.toLowerCase()) && !o.mobile.includes(search)) return false;
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

function getDeliveryName(id: string): string {
  return mockDeliveryPartners.find((dp) => dp.id === id)?.name || id;
}

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const navigate = useNavigate();
  const { isAdmin } = useRole();
  const { activeOrders, updateOrder } = useOrderStore();
  const filtered = applyFilters(activeOrders, filters, search);

  return (
    <AppLayout>
      <PageHeader title="All Orders" description="View and manage all customer orders">
        <CreateOrderDialog />
      </PageHeader>

      <GlobalFilters filters={filters} onChange={setFilters} />

      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, ID, or mobile..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden animate-fade-in">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Order ID</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Price</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Order Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Delivery</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Step</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Health</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                {isAdmin && <th className="px-4 py-3 text-left font-medium text-muted-foreground w-12"></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id} onClick={() => navigate(`/orders/${order.id}`)} className="border-b border-border last:border-0 hover:bg-muted/30 transition-fast cursor-pointer">
                  <td className="px-4 py-3 font-medium text-foreground">{order.id}</td>
                  <td className="px-4 py-3"><div><p className="font-medium text-foreground">{order.customerName}</p><p className="text-xs text-muted-foreground">{order.mobile}</p></div></td>
                  <td className="px-4 py-3 text-muted-foreground">{order.productTitle}</td>
                  <td className="px-4 py-3 font-medium text-foreground">৳{order.price}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{order.orderDate}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{getDeliveryName(order.deliveryMethod)}</td>
                  <td className="px-4 py-3"><span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", stepColors[order.followupStep - 1])}>Step {order.followupStep}</span></td>
                  <td className="px-4 py-3"><span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize", healthColors[order.health])}>{order.health}</span></td>
                  <td className="px-4 py-3">{order.isRepeat && <Badge variant="outline" className="gap-1 text-xs border-warning/30 text-warning"><RefreshCw className="h-3 w-3" /> Repeat</Badge>}</td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); setEditOrder(order); }}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={isAdmin ? 10 : 9} className="px-4 py-12 text-center text-muted-foreground">No orders found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {editOrder && (
        <EditOrderDialog order={editOrder} open={!!editOrder} onOpenChange={(open) => !open && setEditOrder(null)} onSave={(updated) => { updateOrder(updated); setEditOrder(null); }} />
      )}
    </AppLayout>
  );
}
