import { cn } from "@/lib/utils";
import { formatBSTDate, formatBSTTime } from "@/lib/bst";
import type { OrderActivityLog } from "@/hooks/useOrderActivityLogs";
import { ArrowDown } from "lucide-react";

interface Props {
  logs: OrderActivityLog[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

// Parse "field: old → new" or "field: old -> new" or "Field changed from X to Y" patterns
const ARROW_RE = /(.+?):\s*(.+?)\s*(?:→|->|to)\s*(.+)/i;

function parseDiff(description: string): { field: string; oldVal: string; newVal: string } | null {
  if (!description) return null;
  const m = description.match(ARROW_RE);
  if (!m) return null;
  return { field: m[1].trim(), oldVal: m[2].trim(), newVal: m[3].trim() };
}

export default function ActivityDiffViewer({ logs, loading, hasMore, onLoadMore }: Props) {
  if (loading && logs.length === 0) {
    return <p className="text-xs text-muted-foreground">Loading activity…</p>;
  }
  if (!logs.length) return <p className="text-xs text-muted-foreground">No activity recorded yet.</p>;

  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const diff = parseDiff(log.action_description);
        return (
          <div key={log.id} className="rounded-md border border-border bg-card/50 p-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">{log.action_type || "Activity"}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {formatBSTDate(log.created_at)} · {formatBSTTime(log.created_at)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">by {log.user_name || "Unknown"}</p>

            {diff ? (
              <div className="mt-2 rounded-md bg-muted/40 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{diff.field}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn("px-1.5 py-0.5 rounded bg-destructive/10 text-destructive text-[11px] line-through decoration-destructive/40")}>
                    {diff.oldVal || "—"}
                  </span>
                  <ArrowDown className="h-3 w-3 text-muted-foreground rotate-[-90deg]" />
                  <span className="px-1.5 py-0.5 rounded bg-success/10 text-success text-[11px] font-medium">
                    {diff.newVal || "—"}
                  </span>
                </div>
              </div>
            ) : (
              log.action_description && (
                <p className="text-[11px] text-foreground/80 mt-1">{log.action_description}</p>
              )
            )}
          </div>
        );
      })}
      {hasMore && (
        <button
          onClick={onLoadMore}
          className="w-full text-center text-xs text-primary hover:underline py-1"
        >
          Load more
        </button>
      )}
    </div>
  );
}
