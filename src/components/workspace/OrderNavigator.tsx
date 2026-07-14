import { cn } from "@/lib/utils";
import type { CustomerOrderRow } from "@/hooks/useCustomerOrders";

interface Props {
  orders: CustomerOrderRow[]; // chronological (oldest→newest)
  currentOrderId: string;
  onOpen: (orderId: string) => void;
}

export default function OrderNavigator({ orders, currentOrderId, onOpen }: Props) {
  if (orders.length <= 1) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-3 card-shadow">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Order Navigator</p>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {orders.map((o, i) => {
          const isCurrent = o.id === currentOrderId;
          return (
            <div key={o.id} className="flex items-center shrink-0">
              <button
                onClick={() => !isCurrent && onOpen(o.id)}
                title={o.product_title || undefined}
                className={cn(
                  "h-7 px-2 rounded-md text-[11px] font-mono border transition-colors",
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted/40 hover:bg-muted",
                )}
              >
                #{i + 1}
              </button>
              {i < orders.length - 1 && <span className="mx-1 text-muted-foreground">→</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
