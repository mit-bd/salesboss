import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, ListOrdered } from "lucide-react";
import type { CustomerOrderRow } from "@/hooks/useCustomerOrders";

interface Props {
  orders: CustomerOrderRow[]; // chronological (oldest→newest)
  currentOrderId: string;
  onOpen: (orderId: string) => void;
  prevOrderId?: string | null;
  nextOrderId?: string | null;
}

const PAGE = 15;

export default function RelatedOrdersPanel({ orders, currentOrderId, onOpen, prevOrderId, nextOrderId }: Props) {
  const [limit, setLimit] = useState(PAGE);
  // Show newest first for readability, but keep chrono nav
  const sorted = useMemo(() => [...orders].reverse(), [orders]);
  const visible = sorted.slice(0, limit);

  return (
    <div className="rounded-xl border border-border bg-card p-4 card-shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <ListOrdered className="h-3.5 w-3.5 text-muted-foreground" /> Related Orders ({orders.length})
        </h3>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-6 px-1.5" disabled={!prevOrderId} onClick={() => prevOrderId && onOpen(prevOrderId)}>
            <ArrowLeft className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" className="h-6 px-1.5" disabled={!nextOrderId} onClick={() => nextOrderId && onOpen(nextOrderId)}>
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {orders.length === 0 && <p className="text-xs text-muted-foreground">No other orders for this customer.</p>}

      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="py-1.5 pr-2 font-medium">Order ID</th>
              <th className="py-1.5 pr-2 font-medium">Product</th>
              <th className="py-1.5 pr-2 font-medium">Date</th>
              <th className="py-1.5 pr-2 font-medium text-right">COD (৳)</th>
              <th className="py-1.5 pr-2 font-medium">Delivery</th>
              <th className="py-1.5 pr-2 font-medium">Status</th>
              <th className="py-1.5 pr-2 font-medium">Exec</th>
              <th className="py-1.5 pr-2 font-medium">Step</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((o) => {
              const isCurrent = o.id === currentOrderId;
              return (
                <tr
                  key={o.id}
                  onClick={() => !isCurrent && onOpen(o.id)}
                  className={cn(
                    "border-b border-border/50 last:border-0 transition-colors",
                    isCurrent ? "bg-primary/5" : "cursor-pointer hover:bg-muted/50",
                  )}
                >
                  <td className="py-1.5 pr-2 font-mono">
                    <div className="flex items-center gap-1">
                      {o.generated_order_id || o.invoice_id || o.id.slice(0, 8)}
                      {isCurrent && <Badge variant="outline" className="h-4 text-[9px] border-primary/40 text-primary">CURRENT</Badge>}
                    </div>
                  </td>
                  <td className="py-1.5 pr-2 truncate max-w-[140px]">{o.product_title || "—"}</td>
                  <td className="py-1.5 pr-2 text-muted-foreground">{o.order_date || o.created_at?.split("T")[0]}</td>
                  <td className="py-1.5 pr-2 text-right font-medium">৳{(o.price || 0).toLocaleString()}</td>
                  <td className="py-1.5 pr-2 capitalize text-muted-foreground">{o.delivery_status || "—"}</td>
                  <td className="py-1.5 pr-2 capitalize">{o.current_status || "pending"}</td>
                  <td className="py-1.5 pr-2 truncate max-w-[100px] text-muted-foreground">{(o as any).assigned_to_name || "—"}</td>
                  <td className="py-1.5 pr-2 text-muted-foreground">—</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {orders.length > limit && (
        <Button
          variant="ghost" size="sm" className="mt-2 h-7 text-xs w-full"
          onClick={() => setLimit((n) => n + PAGE)}
        >
          Show more ({orders.length - limit} remaining)
        </Button>
      )}
    </div>
  );
}
