import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useImportPerformance } from "@/hooks/useImportPerformance";
import { Activity, Loader2 } from "lucide-react";

export default function ImportPerformancePanel() {
  const { data, loading } = useImportPerformance();
  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground p-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading performance…</div>;
  if (!data) return null;

  const items = [
    { label: "Avg Speed", value: `${Number(data.avg_speed_rows_per_sec ?? 0).toFixed(1)} rows/s` },
    { label: "Fastest", value: `${Math.round((data.fastest_import_ms ?? 0) / 1000)}s` },
    { label: "Slowest", value: `${Math.round((data.slowest_import_ms ?? 0) / 1000)}s` },
    { label: "Largest", value: (data.largest_import ?? 0).toLocaleString() },
    { label: "Avg AI Fixes", value: Math.round(data.avg_ai_fixes ?? 0) },
    { label: "Duplicate Rate", value: `${Number(data.duplicate_rate ?? 0).toFixed(1)}%` },
    { label: "Avg Processing", value: `${Math.round((data.avg_processing_time_ms ?? 0) / 1000)}s` },
    { label: "Avg Queue Wait", value: `${Math.round((data.avg_queue_wait_ms ?? 0) / 1000)}s` },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> Import Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {items.map((m) => (
            <div key={m.label} className="rounded-md border border-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</p>
              <p className="text-lg font-semibold mt-1">{m.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
