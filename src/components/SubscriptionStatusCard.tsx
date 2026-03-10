import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, Clock, Shield } from "lucide-react";

export default function SubscriptionStatusCard() {
  const { profile, role } = useAuth();
  const [sub, setSub] = useState<{ expiry_date: string | null; subscription_status: string } | null>(null);

  useEffect(() => {
    if (!profile?.project_id || role === "owner") return;
    supabase
      .from("projects")
      .select("expiry_date, subscription_status")
      .eq("id", profile.project_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSub(data);
      });
  }, [profile?.project_id, role]);

  if (!sub || role !== "admin") return null;

  const expiry = sub.expiry_date ? new Date(sub.expiry_date) : null;
  const now = new Date();
  const daysRemaining = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

  const statusLabel = sub.subscription_status === "suspended" ? "Suspended" :
    sub.subscription_status === "expired" ? "Expired" :
    daysRemaining !== null && daysRemaining <= 0 ? "Expired" : "Active";

  const statusColor = statusLabel === "Active" ? "default" :
    statusLabel === "Suspended" ? "destructive" : "secondary";

  return (
    <Card className="animate-fade-in">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4.5 w-4.5 text-primary" />
          <h3 className="text-sm font-semibold text-card-foreground">Subscription Status</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Plan Status</p>
            <Badge variant={statusColor}>{statusLabel}</Badge>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarCheck className="h-3 w-3" />Expiry Date</p>
            <p className="text-sm font-medium text-foreground">
              {expiry ? expiry.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "No expiry set"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Days Remaining</p>
            <p className="text-sm font-medium text-foreground">
              {daysRemaining !== null ? (daysRemaining > 0 ? `${daysRemaining} Days` : "Expired") : "∞"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Next Due Date</p>
            <p className="text-sm font-medium text-foreground">
              {expiry ? expiry.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "N/A"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
