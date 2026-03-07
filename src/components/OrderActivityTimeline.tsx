import { useState, useEffect } from "react";
import { fetchActivityLogs, ActivityLogEntry } from "@/hooks/useActivityLog";
import { Clock, Package, UserCheck, CheckCircle, Edit2, ShoppingCart, RefreshCw, Trash2, Upload, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTION_ICONS: Record<string, any> = {
  "Order Created": Package,
  "Order Imported": Upload,
  "Order Assigned": UserCheck,
  "Followup Completed": CheckCircle,
  "Followup Edited": Edit2,
  "Upsell Added": ShoppingCart,
  "Repeat Order Created": RefreshCw,
  "Order Updated": FileText,
  "Order Deleted": Trash2,
  "Assignment Removed": UserCheck,
  "Assignment Transferred": UserCheck,
};

const ACTION_COLORS: Record<string, string> = {
  "Order Created": "bg-primary/10 text-primary",
  "Order Imported": "bg-info/10 text-info",
  "Order Assigned": "bg-success/10 text-success",
  "Followup Completed": "bg-success/10 text-success",
  "Followup Edited": "bg-warning/10 text-warning",
  "Upsell Added": "bg-info/10 text-info",
  "Repeat Order Created": "bg-warning/10 text-warning",
  "Order Updated": "bg-muted text-muted-foreground",
  "Order Deleted": "bg-destructive/10 text-destructive",
  "Assignment Removed": "bg-warning/10 text-warning",
  "Assignment Transferred": "bg-info/10 text-info",
};

function formatTimestamp(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return { date, time };
}

interface Props {
  orderId: string;
}

export default function OrderActivityTimeline({ orderId }: Props) {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchActivityLogs(orderId).then((data) => {
      if (!cancelled) {
        setLogs(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [orderId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 card-shadow">
        <h2 className="text-sm font-semibold text-foreground mb-4">Order Activity Timeline</h2>
        <p className="text-sm text-muted-foreground animate-pulse">Loading activity...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-shadow">
      <h2 className="text-sm font-semibold text-foreground mb-4">Order Activity Timeline</h2>
      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <div className="space-y-0">
          {logs.map((log, i) => {
            const Icon = ACTION_ICONS[log.actionType] || Clock;
            const colorClass = ACTION_COLORS[log.actionType] || "bg-muted text-muted-foreground";
            const { date, time } = formatTimestamp(log.createdAt);

            return (
              <div key={log.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", colorClass)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {i < logs.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
                </div>
                <div className="pb-4 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{log.actionType}</p>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-muted-foreground">{date}</p>
                      <p className="text-[10px] text-muted-foreground">{time}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{log.userName}</p>
                  {log.actionDescription && (
                    <p className="text-xs text-muted-foreground/70 mt-1">{log.actionDescription}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
