import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AppNotification {
  id: string;
  user_id: string;
  project_id: string | null;
  type: string;
  title: string;
  message: string;
  order_id: string | null;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setNotifications(data as AppNotification[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as AppNotification;
          setNotifications((prev) => [newNotif, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as AppNotification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAsRead = useCallback(async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }, [user]);

  return { notifications, unreadCount, loading, markAsRead, markAllRead, refetch: fetchNotifications };
}

// Helper to create notifications for assignment events
export async function createAssignmentNotifications({
  orderId,
  orderName,
  assignedToId,
  assignedToName,
  assignedById,
  projectId,
}: {
  orderId: string;
  orderName: string;
  assignedToId: string;
  assignedToName: string;
  assignedById: string;
  projectId: string;
}) {
  const notifs = [
    {
      user_id: assignedToId,
      project_id: projectId,
      type: "order_assigned",
      title: "New Order Assigned",
      message: `Order for "${orderName}" has been assigned to you.`,
      order_id: orderId,
    },
  ];

  // Also notify the admin who assigned (if different)
  if (assignedById !== assignedToId) {
    notifs.push({
      user_id: assignedById,
      project_id: projectId,
      type: "order_assigned",
      title: "Order Assigned",
      message: `You assigned "${orderName}" to ${assignedToName}.`,
      order_id: orderId,
    });
  }

  await supabase.from("notifications").insert(notifs);
}

// Helper to create followup due notifications
export async function createFollowupNotification({
  orderId,
  orderName,
  stepNumber,
  userId,
  projectId,
}: {
  orderId: string;
  orderName: string;
  stepNumber: number;
  userId: string;
  projectId: string;
}) {
  await supabase.from("notifications").insert({
    user_id: userId,
    project_id: projectId,
    type: "followup_due",
    title: `Followup Step ${stepNumber} Due`,
    message: `Followup due for "${orderName}".`,
    order_id: orderId,
  });
}
