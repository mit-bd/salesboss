import { useState } from "react";
import { Bell, X, Check, ShoppingCart, PhoneForwarded, RefreshCw, UserPlus, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: "order_assigned" | "followup_completed" | "repeat_order" | "order_edited" | "team_added";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: "n1", type: "order_assigned", title: "Order Assigned", message: "ORD-005 assigned to Rahul Sharma", time: "2 min ago", read: false },
  { id: "n2", type: "followup_completed", title: "Followup Completed", message: "Step 2 completed for Vikram Mehta", time: "15 min ago", read: false },
  { id: "n3", type: "repeat_order", title: "Repeat Order Created", message: "Vikram Mehta placed a repeat order", time: "1 hr ago", read: false },
  { id: "n4", type: "order_edited", title: "Order Updated", message: "ORD-003 details updated by Admin", time: "2 hrs ago", read: true },
  { id: "n5", type: "team_added", title: "Team Member Added", message: "Neha Singh joined as Sales Executive", time: "1 day ago", read: true },
];

const ICON_MAP = {
  order_assigned: ShoppingCart,
  followup_completed: PhoneForwarded,
  repeat_order: RefreshCw,
  order_edited: Edit,
  team_added: UserPlus,
};

const COLOR_MAP = {
  order_assigned: "text-info bg-info/10",
  followup_completed: "text-success bg-success/10",
  repeat_order: "text-warning bg-warning/10",
  order_edited: "text-primary bg-primary/10",
  team_added: "text-accent-foreground bg-accent",
};

export default function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
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
              {notifications.map((n) => {
                const Icon = ICON_MAP[n.type];
                return (
                  <div
                    key={n.id}
                    onClick={() => markAsRead(n.id)}
                    className={cn(
                      "flex items-start gap-3 p-4 border-b border-border cursor-pointer transition-fast hover:bg-muted/30",
                      !n.read && "bg-primary/5"
                    )}
                  >
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", COLOR_MAP[n.type])}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn("text-sm font-medium", !n.read ? "text-foreground" : "text-muted-foreground")}>{n.title}</p>
                        {!n.read && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                      <p className="text-[11px] text-muted-foreground/70 mt-1">{n.time}</p>
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
