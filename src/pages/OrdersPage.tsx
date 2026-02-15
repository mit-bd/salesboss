import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { mockOrders } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

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

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const filtered = mockOrders.filter(
    (o) =>
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.mobile.includes(search)
  );

  return (
    <AppLayout>
      <PageHeader title="Orders" description="Manage all customer orders">
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> New Order
        </Button>
      </PageHeader>

      {/* Search */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, ID, or mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden animate-fade-in">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Order ID</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Price</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Step</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Assigned</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Health</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-fast cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-foreground">{order.id}</td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">{order.customerName}</p>
                      <p className="text-xs text-muted-foreground">{order.mobile}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{order.productTitle}</td>
                  <td className="px-4 py-3 font-medium text-foreground">₹{order.price}</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", stepColors[order.followupStep - 1])}>
                      Step {order.followupStep}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{order.assignedToName}</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize", healthColors[order.health])}>
                      {order.health}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {order.isRepeat && (
                      <Badge variant="outline" className="gap-1 text-xs border-warning/30 text-warning">
                        <RefreshCw className="h-3 w-3" /> Repeat
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
