import { useImportErrors } from "@/hooks/useImportErrors";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle } from "lucide-react";

const CATEGORY_COLOR: Record<string, string> = {
  validation: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  ai: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  database: "bg-red-500/15 text-red-700 dark:text-red-400",
  permission: "bg-red-500/15 text-red-700 dark:text-red-400",
  duplicate: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  network: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  timeout: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  file_format: "bg-slate-500/15 text-slate-700 dark:text-slate-400",
  unknown: "bg-slate-500/15 text-slate-700 dark:text-slate-400",
};

export default function ImportErrorCenter({ runId }: { runId: string }) {
  const { errors, loading } = useImportErrors(runId);

  if (loading) return <p className="text-sm text-muted-foreground">Loading errors…</p>;
  if (errors.length === 0) return <p className="text-sm text-muted-foreground flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> No errors for this run.</p>;

  return (
    <ScrollArea className="max-h-96">
      <div className="space-y-2">
        {errors.map((e) => (
          <div key={e.id} className="rounded-md border border-border p-3 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={CATEGORY_COLOR[e.category] ?? CATEGORY_COLOR.unknown} variant="outline">{e.category}</Badge>
              {e.batch_index !== null && <span className="text-xs text-muted-foreground">Batch #{e.batch_index}</span>}
              {e.retryable && <Badge variant="outline">Retryable</Badge>}
              {e.resolved && <Badge variant="secondary">Resolved</Badge>}
            </div>
            {e.why && <p className="text-sm"><span className="font-medium">Why:</span> {e.why}</p>}
            {e.recommended_fix && <p className="text-xs text-muted-foreground"><span className="font-medium">Fix:</span> {e.recommended_fix}</p>}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
