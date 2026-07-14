import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

export interface HealthScore {
  overall: number;
  phone: number;
  address: number;
  duplicate_risk: number;
  customer_match: number;
  status_accuracy: number;
  cod_accuracy: number;
  product_detection: number;
  ai_confidence: number;
}

export interface Recommendation {
  id: string;
  title: string;
  reason: string;
  severity: "critical" | "warning" | "suggestion";
  affectedRows?: number[];
}

function tone(score: number) {
  if (score >= 85) return "text-success";
  if (score >= 65) return "text-warning";
  return "text-destructive";
}

export default function HealthScorePanel({
  health,
  recommendations,
  onJumpToRows,
}: {
  health: HealthScore | null;
  recommendations: Recommendation[];
  onJumpToRows?: (rows: number[]) => void;
}) {
  if (!health) return null;

  const dims: { label: string; key: keyof HealthScore }[] = [
    { label: "Phone quality", key: "phone" },
    { label: "Address quality", key: "address" },
    { label: "Duplicate risk", key: "duplicate_risk" },
    { label: "Customer match", key: "customer_match" },
    { label: "Status accuracy", key: "status_accuracy" },
    { label: "COD accuracy", key: "cod_accuracy" },
    { label: "Product detection", key: "product_detection" },
    { label: "AI confidence", key: "ai_confidence" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-shadow space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" /> Import health score
          </h3>
          <p className="text-xs text-muted-foreground">AI-computed data quality assessment for this file</p>
        </div>
        <div className="text-right">
          <p className={cn("text-3xl font-bold", tone(health.overall))}>{Math.round(health.overall)}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Overall</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {dims.map((d) => {
          const val = Math.round(Number(health[d.key] ?? 0));
          return (
            <div key={d.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{d.label}</span>
                <span className={cn("font-semibold", tone(val))}>{val}</span>
              </div>
              <Progress value={val} className="h-1.5" />
            </div>
          );
        })}
      </div>

      {recommendations.length > 0 && (
        <div className="pt-3 border-t border-border">
          <p className="text-xs font-medium mb-2">Recommendations</p>
          <div className="space-y-1.5">
            {recommendations.map((r) => (
              <div
                key={r.id}
                className={cn(
                  "text-xs rounded-lg border px-3 py-2 flex items-start justify-between gap-3",
                  r.severity === "critical" && "border-destructive/30 bg-destructive/5",
                  r.severity === "warning" && "border-warning/30 bg-warning/5",
                  r.severity === "suggestion" && "border-primary/30 bg-primary/5",
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] h-4 px-1 capitalize">{r.severity}</Badge>
                    <p className="font-medium">{r.title}</p>
                  </div>
                  <p className="text-muted-foreground mt-0.5 italic">Why: {r.reason}</p>
                </div>
                {r.affectedRows && r.affectedRows.length > 0 && onJumpToRows && (
                  <button
                    className="text-primary underline text-[11px] shrink-0"
                    onClick={() => onJumpToRows(r.affectedRows!)}
                  >
                    View {r.affectedRows.length}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
