import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, AlertCircle, Info, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export type ImportWarningLite = {
  rowNumber: number;
  category: string;
  severity: "critical" | "warning" | "suggestion";
  field?: string;
  message: string;
  reason?: string;
};

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, suggestion: 2 };

const sevIcon = {
  critical: AlertCircle,
  warning: AlertTriangle,
  suggestion: Info,
};

const sevTone: Record<string, string> = {
  critical: "text-destructive border-destructive/40 bg-destructive/5",
  warning: "text-warning border-warning/40 bg-warning/5",
  suggestion: "text-primary border-primary/40 bg-primary/5",
};

export default function WarningCenter({
  warnings,
  onJumpToRow,
}: {
  warnings: ImportWarningLite[];
  onJumpToRow?: (rowNumber: number) => void;
}) {
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "suggestion">("all");
  const [catFilter, setCatFilter] = useState<string>("all");

  const categories = useMemo(() => {
    const set = new Map<string, number>();
    warnings.forEach((w) => set.set(w.category, (set.get(w.category) || 0) + 1));
    return Array.from(set.entries()).sort((a, b) => b[1] - a[1]);
  }, [warnings]);

  const counts = useMemo(() => {
    const c = { critical: 0, warning: 0, suggestion: 0 };
    warnings.forEach((w) => { c[w.severity] = (c[w.severity] || 0) + 1; });
    return c;
  }, [warnings]);

  const filtered = useMemo(() => {
    return warnings
      .filter((w) => filter === "all" || w.severity === filter)
      .filter((w) => catFilter === "all" || w.category === catFilter)
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.rowNumber - b.rowNumber);
  }, [warnings, filter, catFilter]);

  if (!warnings.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 card-shadow">
        <div className="flex items-center gap-2 text-sm text-success">
          <Info className="h-4 w-4" /> No warnings detected. Data looks clean.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-shadow space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold">AI Warning Center</h3>
          <p className="text-xs text-muted-foreground">
            {counts.critical} critical · {counts.warning} warning · {counts.suggestion} suggestion
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["all", "critical", "warning", "suggestion"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={filter === s ? "default" : "outline"}
              className="h-7 text-xs capitalize"
              onClick={() => setFilter(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-muted-foreground flex items-center gap-1"><Filter className="h-3 w-3" /> Category:</span>
        <Button size="sm" variant={catFilter === "all" ? "secondary" : "ghost"} className="h-6 text-[11px]" onClick={() => setCatFilter("all")}>
          All ({warnings.length})
        </Button>
        {categories.map(([cat, cnt]) => (
          <Button key={cat} size="sm" variant={catFilter === cat ? "secondary" : "ghost"} className="h-6 text-[11px]" onClick={() => setCatFilter(cat)}>
            {cat.replace(/_/g, " ")} ({cnt})
          </Button>
        ))}
      </div>

      <div className="border border-border rounded-lg divide-y divide-border max-h-[420px] overflow-auto">
        {filtered.map((w, i) => {
          const Icon = sevIcon[w.severity];
          return (
            <div
              key={`${w.rowNumber}-${w.category}-${i}`}
              className={cn("px-3 py-2 text-xs flex items-start gap-2 cursor-pointer hover:bg-muted/40", onJumpToRow && "cursor-pointer")}
              onClick={() => onJumpToRow?.(w.rowNumber)}
            >
              <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", sevTone[w.severity].split(" ")[0])} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground">Row {w.rowNumber}</span>
                  <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5 capitalize", sevTone[w.severity])}>
                    {w.severity}
                  </Badge>
                  <span className="text-muted-foreground">{w.category.replace(/_/g, " ")}</span>
                  {w.field && <span className="text-muted-foreground">· {w.field}</span>}
                </div>
                <p className="text-foreground mt-0.5">{w.message}</p>
                {w.reason && <p className="text-muted-foreground/80 mt-0.5 italic">Why: {w.reason}</p>}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">No warnings match this filter.</div>
        )}
      </div>
    </div>
  );
}
