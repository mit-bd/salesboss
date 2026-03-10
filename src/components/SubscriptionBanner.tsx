import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, X } from "lucide-react";

export default function SubscriptionBanner() {
  const { profile, role } = useAuth();
  const [banner, setBanner] = useState<{ message: string; severity: "warning" | "danger" } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!profile?.project_id || role === "owner") return;

    const fetchSubscription = async () => {
      const { data } = await supabase
        .from("projects")
        .select("expiry_date, subscription_status")
        .eq("id", profile.project_id)
        .maybeSingle();

      if (!data) return;

      if (data.subscription_status === "suspended") {
        setBanner({
          message: "Account suspended due to expired subscription. Please contact the administrator.",
          severity: "danger",
        });
        return;
      }

      if (!data.expiry_date) return;

      const now = new Date();
      const expiry = new Date(data.expiry_date);
      const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        const graceDaysLeft = 3 + diffDays;
        if (graceDaysLeft > 0) {
          setBanner({
            message: `⚠ Your subscription has expired. Please renew within ${graceDaysLeft} day${graceDaysLeft > 1 ? "s" : ""} to avoid suspension.`,
            severity: "danger",
          });
        }
      } else if (diffDays <= 3) {
        setBanner({
          message: `⚠ Subscription expiring soon. Please renew before ${expiry.toLocaleDateString()}.`,
          severity: "warning",
        });
      }
    };

    fetchSubscription();
  }, [profile?.project_id, role]);

  if (!banner || dismissed) return null;

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium ${
        banner.severity === "danger"
          ? "bg-destructive/10 text-destructive border-b border-destructive/20"
          : "bg-warning/10 text-warning border-b border-warning/20"
      }`}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>{banner.message}</span>
      </div>
      <button onClick={() => setDismissed(true)} className="shrink-0 opacity-60 hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
