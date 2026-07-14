import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDataQuality } from "@/hooks/useDataQuality";
import { Sparkles, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function AIDataQualityCard() {
  const { snapshot: data, loading } = useDataQuality();

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground p-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading data quality…</div>;
  if (!data) return null;

  const overall = Math.round(Number(data?.avg_health_score ?? 0));
  const metrics = [
    { label: "Overall", value: `${overall}%` },
    { label: "AI Fix Rate", value: `${Number(data?.ai_fix_success_rate ?? 0).toFixed(0)}%` },
    { label: "Duplicate Rate", value: `${Number(data?.duplicate_rate ?? 0).toFixed(1)}%` },
    { label: "Repeat Customers", value: `${Number(data?.repeat_customer_rate ?? 0).toFixed(0)}%` },
    { label: "Imports (Month)", value: data?.imports_this_month ?? 0 },
  ];

  return (
    <Link to="/data-quality" className="block">
      <Card className="hover:border-primary/60 transition-colors">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> AI Data Quality</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-md border border-border p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</p>
                <p className="text-lg font-semibold mt-1">{m.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
