import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOwnerImportAnalytics } from "@/hooks/useOwnerImportAnalytics";
import { Loader2, Upload } from "lucide-react";

export default function OwnerImportAnalytics() {
  const { data, loading } = useOwnerImportAnalytics(30);

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground p-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading import analytics…</div>;
  if (!data) return null;

  const items = [
    { label: "Today", value: data.today_imports },
    { label: "This Month", value: data.month_imports },
    { label: "Largest Import", value: data.largest_import?.toLocaleString() ?? "0" },
    { label: "Avg Import Time", value: `${Math.round((data.avg_import_time_ms ?? 0) / 1000)}s` },
    { label: "Avg Health", value: `${Math.round(data.avg_health_score ?? 0)}%` },
    { label: "AI Success", value: `${data.ai_success_rate ?? 0}%` },
    { label: "Top Template", value: data.most_used_template ?? "—" },
    { label: "Top Courier", value: data.most_used_courier ?? "—" },
    { label: "Resumed", value: data.resume_imports ?? 0 },
    { label: "Failures", value: data.import_failures ?? 0 },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Upload className="h-4 w-4" /> Import Analytics · 30 days</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {items.map((it) => (
            <div key={it.label} className="rounded-md border border-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{it.label}</p>
              <p className="text-lg font-semibold mt-1 truncate">{it.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
