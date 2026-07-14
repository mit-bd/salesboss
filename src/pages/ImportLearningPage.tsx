import { useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useImportLearning } from "@/hooks/useImportLearning";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, RotateCcw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ImportLearningPage() {
  const { items, loading, approve, reject, reset } = useImportLearning();
  const { toast } = useToast();

  const groups = useMemo(() => {
    const g: Record<string, typeof items> = {};
    for (const it of items) { (g[it.kind] ||= []).push(it); }
    return g;
  }, [items]);

  const act = async (fn: () => Promise<void>, ok: string) => {
    try { await fn(); toast({ title: ok }); }
    catch (e) { toast({ title: "Failed", description: (e as Error).message, variant: "destructive" }); }
  };

  return (
    <AppLayout>
      <PageHeader title="AI Learning Center" description="Approve, reject, or reset AI-learned mappings" />
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            AI observes recurring corrections and proposes them for approval. Approved suggestions become active on future imports.
          </p>
          <Button variant="outline" size="sm" onClick={() => act(() => reset(), "Pending suggestions cleared")}>
            <RotateCcw className="h-4 w-4" /> Reset Pending
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : Object.keys(groups).length === 0 ? (
          <p className="text-sm text-muted-foreground">No AI suggestions yet. They will appear as imports run.</p>
        ) : Object.entries(groups).map(([kind, list]) => (
          <Card key={kind}>
            <CardHeader className="pb-2"><CardTitle className="text-base capitalize">{kind.replace(/_/g, " ")}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {list.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{s.input_value}</code>
                      <span className="text-muted-foreground">→</span>
                      <code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs">{s.suggested_value}</code>
                      <Badge variant="outline">{s.confirmations}× seen</Badge>
                      <Badge variant={s.status === "approved" ? "default" : s.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{s.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Why: repeated confirmation across imports.</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {s.status === "pending" && (
                      <>
                        <Button size="sm" onClick={() => act(() => approve(s.id), "Approved")}><CheckCircle className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => act(() => reject(s.id), "Rejected")}><XCircle className="h-4 w-4" /></Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
