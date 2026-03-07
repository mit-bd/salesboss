import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface LogActivityParams {
  orderId: string;
  actionType: string;
  actionDescription: string;
}

export function useActivityLog() {
  const { user, profile } = useAuth();

  const logActivity = useCallback(
    async ({ orderId, actionType, actionDescription }: LogActivityParams) => {
      if (!user) return;
      const userName = profile?.full_name || user.email || "Unknown";
      const projectId = profile?.project_id;

      const { error } = await supabase.from("order_activity_logs" as any).insert({
        order_id: orderId,
        project_id: projectId,
        user_id: user.id,
        user_name: userName,
        action_type: actionType,
        action_description: actionDescription,
      });

      if (error) {
        console.error("[ActivityLog] Insert error:", error);
      }
    },
    [user, profile]
  );

  return { logActivity };
}

export interface ActivityLogEntry {
  id: string;
  orderId: string;
  userId: string | null;
  userName: string;
  actionType: string;
  actionDescription: string;
  createdAt: string;
}

export async function fetchActivityLogs(orderId: string): Promise<ActivityLogEntry[]> {
  const { data, error } = await (supabase.from("order_activity_logs" as any) as any)
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[ActivityLog] Fetch error:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    orderId: row.order_id,
    userId: row.user_id,
    userName: row.user_name || "Unknown",
    actionType: row.action_type || "",
    actionDescription: row.action_description || "",
    createdAt: row.created_at || "",
  }));
}
