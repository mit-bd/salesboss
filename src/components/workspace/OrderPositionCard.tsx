import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Hash, Repeat2 } from "lucide-react";
import type { OrderPosition } from "@/hooks/useOrderPosition";

export default function OrderPositionCard({ pos }: { pos: OrderPosition }) {
  if (!pos.total) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-4 card-shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Hash className="h-3.5 w-3.5 text-muted-foreground" /> Order Position
        </h3>
        {pos.isRepeatCustomer && (
          <Badge variant="outline" className="h-5 text-[10px] bg-info/10 text-info border-info/30 gap-1">
            <Repeat2 className="h-3 w-3" /> Repeat
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <Item label="Sequence" value={pos.isOnlyOrder ? "First Order" : `#${pos.position} of ${pos.total}`} strong />
        <Item label="Total Orders" value={pos.total} />
        <Item label="First Order" value={pos.firstOrderDate || "—"} icon={Calendar} />
        <Item label="Latest Order" value={pos.latestOrderDate || "—"} icon={Calendar} />
        <Item label="Days Since First" value={pos.daysSinceFirst != null ? `${pos.daysSinceFirst}d` : "—"} icon={Clock} />
        <Item label="Days Since Last" value={pos.daysSinceLast != null ? `${pos.daysSinceLast}d` : "—"} icon={Clock} />
      </div>
    </div>
  );
}

function Item({ label, value, strong, icon: Icon }: { label: string; value: React.ReactNode; strong?: boolean; icon?: any }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </p>
      <p className={strong ? "text-sm font-semibold text-foreground" : "text-sm text-foreground"}>{value}</p>
    </div>
  );
}
