import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

type Priority = "low" | "medium" | "high" | "critical";

interface Rec {
  action?: string;
  product?: string;
  when?: string;
  level?: string;
  why?: string;
  confidence?: number;
  impact?: string;
}

interface Props {
  label: string;
  rec?: Rec;
  field: keyof Rec;
  // If provided, overrides derived priority
  priority?: Priority;
  // Optional expected-impact override
  impact?: string;
}

function derivePriority(rec?: Rec): Priority {
  if (!rec) return "low";
  const conf = typeof rec.confidence === "number" ? rec.confidence : 0;
  const level = (rec.level || "").toLowerCase();
  if (level === "high" || level === "critical") return level as Priority;
  if (conf >= 85) return "critical";
  if (conf >= 65) return "high";
  if (conf >= 40) return "medium";
  return "low";
}

const PRIORITY_STYLE: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-info/10 text-info border-info/30",
  high: "bg-warning/10 text-warning border-warning/30",
  critical: "bg-destructive/10 text-destructive border-destructive/30",
};

export default function AIRecommendationCard({ label, rec, field, priority, impact }: Props) {
  const value = rec?.[field];
  if (!rec || !value) {
    return (
      <div className="rounded-md border border-border p-2.5">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Not enough data yet.</p>
      </div>
    );
  }
  const p: Priority = priority ?? derivePriority(rec);
  const conf = typeof rec.confidence === "number" ? Math.round(rec.confidence) : null;
  const finalImpact = impact ?? rec.impact;

  return (
    <div className={cn("rounded-md border p-2.5", PRIORITY_STYLE[p])}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 opacity-70" />
          <p className="text-[10px] uppercase tracking-wide font-medium">{label}</p>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className={cn("h-4 text-[9px] capitalize", PRIORITY_STYLE[p])}>
            {p}
          </Badge>
          {conf != null && (
            <span className="text-[10px] opacity-70">{conf}%</span>
          )}
        </div>
      </div>
      <p className="text-xs font-semibold text-foreground mt-1 capitalize">{String(value)}</p>
      {rec.why && (
        <div className="mt-1.5">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Why</p>
          <p className="text-[11px] text-foreground/80 leading-snug">{rec.why}</p>
        </div>
      )}
      {finalImpact && (
        <div className="mt-1.5">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Expected Impact</p>
          <p className="text-[11px] text-foreground/80 leading-snug">{finalImpact}</p>
        </div>
      )}
    </div>
  );
}
