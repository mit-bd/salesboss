import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBSTDateTime } from "@/lib/bst";
import {
  ArrowLeft, ArrowRight, TrendingUp, Repeat2, Sparkles, User, Wallet, Activity,
} from "lucide-react";

interface Props {
  position: number;
  total: number;
  isFirstOrder: boolean;
  isOnlyOrder: boolean;
  isRepeatCustomer: boolean;
  lifetimeValue: number;
  healthScore?: number | null;
  aiScore?: number | null;
  lastFollowupAt?: string | null;
  currentExecutive?: string | null;
  prevOrderId?: string | null;
  nextOrderId?: string | null;
  onPrev?: () => void;
  onNext?: () => void;
}

export default function WorkspaceHeaderSummary({
  position, total, isFirstOrder, isOnlyOrder, isRepeatCustomer,
  lifetimeValue, healthScore, aiScore, lastFollowupAt, currentExecutive,
  prevOrderId, nextOrderId, onPrev, onNext,
}: Props) {
  const positionLabel = isOnlyOrder ? "First Order" : `Order #${position} of ${total}`;

  return (
    <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-background/95 backdrop-blur px-4 py-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {isRepeatCustomer && (
            <Badge variant="outline" className="h-6 gap-1 bg-info/10 text-info border-info/30">
              <Repeat2 className="h-3 w-3" /> Repeat Customer
            </Badge>
          )}
          <Badge variant="outline" className="h-6 font-mono">
            {positionLabel}
          </Badge>
          <Chip icon={Wallet} label="LTV" value={`৳${(lifetimeValue || 0).toLocaleString()}`} />
          {healthScore != null && (
            <Chip icon={Activity} label="Health" value={`${Math.round(healthScore)}`} tone="success" />
          )}
          {aiScore != null && (
            <Chip icon={Sparkles} label="AI" value={`${Math.round(aiScore)}`} tone="primary" />
          )}
          {lastFollowupAt && (
            <Chip icon={TrendingUp} label="Last F/U" value={formatBSTDateTime(lastFollowupAt)} />
          )}
          {currentExecutive && (
            <Chip icon={User} label="Exec" value={currentExecutive} />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-7 gap-1" disabled={!prevOrderId} onClick={onPrev}>
            <ArrowLeft className="h-3.5 w-3.5" /> Prev
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1" disabled={!nextOrderId} onClick={onNext}>
            Next <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Chip({ icon: Icon, label, value, tone = "muted" }: { icon: any; label: string; value: string; tone?: "muted" | "primary" | "success" }) {
  const toneCls: Record<string, string> = {
    muted: "bg-muted text-foreground border-border",
    primary: "bg-primary/10 text-primary border-primary/30",
    success: "bg-success/10 text-success border-success/30",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 h-6 px-2 rounded-md border text-[11px]", toneCls[tone])}>
      <Icon className="h-3 w-3 opacity-70" />
      <span className="uppercase tracking-wide opacity-70">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}
