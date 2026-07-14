import { useCustomerTimeline } from "@/hooks/useCustomerTimeline";
import { ShoppingBag, PhoneForwarded, RefreshCw, ArrowUpRight, Truck, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const ICONS: Record<string, any> = {
  order_created: ShoppingBag,
  repeat_order: RefreshCw,
  upsell_order: ArrowUpRight,
  followup: PhoneForwarded,
  upsell: ArrowUpRight,
  repeat: RefreshCw,
  delivery_status: Truck,
};

function formatBST(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      timeZone: "Asia/Dhaka",
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export default function CustomerTimeline({
  customerId,
  mobile,
}: {
  customerId: string;
  mobile?: string;
}) {
  const { events, loading } = useCustomerTimeline(customerId, mobile);
  const navigate = useNavigate();

  return (
    <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Customer activity timeline</h2>
        <span className="text-[11px] text-muted-foreground">(BST · Asia/Dhaka)</span>
      </div>
      <div className="max-h-[520px] overflow-auto">
        {loading && <div className="px-4 py-6 text-center text-xs text-muted-foreground">Loading timeline…</div>}
        {!loading && events.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">No activity yet.</div>
        )}
        {!loading && events.length > 0 && (
          <ol className="relative border-l border-border ml-4 my-3">
            {events.map((e) => {
              const Icon = ICONS[e.type] || Activity;
              return (
                <li key={e.id} className="ml-4 mb-3">
                  <span className="absolute -left-[7px] flex h-3 w-3 items-center justify-center rounded-full bg-primary/20 ring-2 ring-background">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  <div
                    className={cn(
                      "rounded-lg border border-border bg-background/50 p-2.5 text-xs",
                      e.orderId && "cursor-pointer hover:bg-muted/30",
                    )}
                    onClick={() => e.orderId && navigate(`/orders/${e.orderId}`)}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium text-foreground">{e.title}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{formatBST(e.at)}</span>
                    </div>
                    {e.detail && <p className="text-muted-foreground mt-1 pl-5">{e.detail}</p>}
                    {e.actor && <p className="text-[10px] text-muted-foreground/80 mt-0.5 pl-5">by {e.actor}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
