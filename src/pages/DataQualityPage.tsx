import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useDataQuality } from "@/hooks/useDataQuality";
import { Loader2, TrendingUp, AlertTriangle, Package, Layers, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import ImportPerformancePanel from "@/components/import/ImportPerformancePanel";

function Card({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 card-shadow">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground mt-1">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DataQualityPage() {
  const { snapshot, loading, error, refresh } = useDataQuality();

  return (
    <AppLayout>
      <PageHeader
        title="Data Quality Dashboard"
        description="Real-time quality metrics computed from your live imports, customers, and orders."
      >
        <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
      </PageHeader>
      <div className="max-w-5xl animate-fade-in space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading metrics…
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
            Failed to load: {error}
          </div>
        )}
        {snapshot && (
          <>
            <ImportPerformancePanel />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card label="Avg import health" value={`${Math.round(Number(snapshot.avg_health_score || 0))}`} sub="Last 30 days" />
              <Card label="Imports this month" value={snapshot.imports_this_month || 0} />
              <Card label="Duplicate rate" value={`${Number(snapshot.duplicate_rate || 0)}%`} />
              <Card label="Repeat customers" value={`${Number(snapshot.repeat_customer_rate || 0)}%`} />
              <Card label="AI fix success" value={`${Number(snapshot.ai_fix_success_rate || 0)}%`} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card p-4 card-shadow">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <h3 className="text-sm font-semibold">Top validation errors</h3>
                </div>
                {snapshot.top_validation_errors?.length === 0 && (
                  <p className="text-xs text-muted-foreground">None recorded.</p>
                )}
                <ul className="space-y-1.5 text-xs">
                  {snapshot.top_validation_errors?.map((e) => (
                    <li key={e.category} className="flex items-center justify-between">
                      <span className="capitalize">{e.category.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground">{e.count}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 card-shadow">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Top imported products</h3>
                </div>
                {snapshot.top_products?.length === 0 && (
                  <p className="text-xs text-muted-foreground">No product data.</p>
                )}
                <ul className="space-y-1.5 text-xs">
                  {snapshot.top_products?.map((p) => (
                    <li key={p.name} className="flex items-center justify-between gap-2">
                      <span className="truncate">{p.name}</span>
                      <span className="text-muted-foreground shrink-0">{p.count}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 card-shadow">
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Most used templates</h3>
                </div>
                {snapshot.top_templates?.length === 0 && (
                  <p className="text-xs text-muted-foreground">No templates saved.</p>
                )}
                <ul className="space-y-1.5 text-xs">
                  {snapshot.top_templates?.map((t) => (
                    <li key={t.name} className="flex items-center justify-between gap-2">
                      <span className="truncate">{t.name}</span>
                      <span className="text-muted-foreground shrink-0">{t.count}×</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 card-shadow flex items-start gap-3">
              <TrendingUp className="h-4 w-4 text-success mt-0.5" />
              <div className="text-xs text-muted-foreground">
                All values are computed from real database data — import runs, warnings, orders, customers, and templates in your project.
                No estimates, no mocks.
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
