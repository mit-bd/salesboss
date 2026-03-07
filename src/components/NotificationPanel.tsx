import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X, Check, ShoppingCart, PhoneForwarded, RefreshCw, UserPlus, Edit, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNotifications, AppNotification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";

const ICON_MAP: Record<string, any> = {
  order_assigned: ShoppingCart,
  followup_due: PhoneForwarded,
  followup_completed: PhoneForwarded,
  repeat_order: RefreshCw,
  order_edited: Edit,
  team_added: UserPlus,
  info: Info,
};

const COLOR_MAP: Record<string, string> = {
  order_assigned: "text-info bg-info/10",
  followup_due: "text-warning bg-warning/10",
  followup_completed: "text-success bg-success/10",
  repeat_order: "text-warning bg-warning/10",
  order_edited: "text-primary bg-primary/10",
  team_added: "text-accent-foreground bg-accent",
  info: "text-muted-foreground bg-muted",
};

export default function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllRead, loading } = useNotifications();

  const handleClick = (n: AppNotification) => {
    markAsRead(n.id);
    if (n.order_id) {
      navigate(`/orders/${n.order_id}`);
      setOpen(false);
    }
  };

  const timeAgo = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return "";
    }
  };

  return (
    <>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(true)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted transition-fast"
      >
        <Bell className="h-4 w-4 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm bg-card border-l border-border shadow-xl animate-fade-in flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={markAllRead}>
                    <Check className="h-3 w-3 mr-1" /> Mark all read
                  </Button>
                )}
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading && (
                <div className="p-6 text-center text-sm text-muted-foreground">Loading...</div>
              )}
              {!loading && notifications.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">No notifications yet</div>
              )}
              {notifications.map((n) => {
                const Icon = ICON_MAP[n.type] || Info;
                const colorClass = COLOR_MAP[n.type] || COLOR_MAP.info;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      "flex items-start gap-3 p-4 border-b border-border cursor-pointer transition-fast hover:bg-muted/30",
                      !n.is_read && "bg-primary/5"
                    )}
                  >
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", colorClass)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn("text-sm font-medium", !n.is_read ? "text-foreground" : "text-muted-foreground")}>{n.title}</p>
                        {!n.is_read && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                      <p className="text-[11px] text-muted-foreground/70 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
