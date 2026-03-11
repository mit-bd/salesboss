import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, CalendarCheck, Clock, AlertTriangle, History, CreditCard } from "lucide-react";
import { format } from "date-fns";

interface BillingActivity {
  action: string;
  performedBy: string;
  date: string;
}

export default function BillingPage() {
  const { profile, role } = useAuth();
  const [sub, setSub] = useState<{
    expiry_date: string | null;
    subscription_status: string;
    business_name: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.project_id || role === "owner") {
      setLoading(false);
      return;
    }
    supabase
      .from("projects")
      .select("expiry_date, subscription_status, business_name")
      .eq("id", profile.project_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSub(data);
        setLoading(false);
      });
  }, [profile?.project_id, role]);

  const expiry = sub?.expiry_date ? new Date(sub.expiry_date) : null;
  const now = new Date();
  const daysRemaining = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

  const statusLabel =
    sub?.subscription_status === "suspended"
      ? "Suspended"
      : sub?.subscription_status === "expired" || (daysRemaining !== null && daysRemaining <= 0)
      ? "Expired"
      : "Active";

  const statusVariant: "default" | "destructive" | "secondary" =
    statusLabel === "Active" ? "default" : statusLabel === "Suspended" ? "destructive" : "secondary";

  const isNearExpiry = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 3;
  const isExpired = daysRemaining !== null && daysRemaining <= 0;

  // Mock billing history — in production this would come from a billing_history table
  const billingHistory: BillingActivity[] = [
    ...(sub?.expiry_date
      ? [{ action: "Subscription Set", performedBy: "Owner", date: sub.expiry_date }]
      : []),
  ];

  if (loading) {
    return (
      <AppLayout>
        <PageHeader title="Billing" description="Subscription and billing management" />
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Loading billing information...</div>
      </AppLayout>
    );
  }

  if (!sub) {
    return (
      <AppLayout>
        <PageHeader title="Billing" description="Subscription and billing management" />
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">No subscription information available.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title="Billing" description="Subscription and billing management" />

      {/* Expiry Warning Banner */}
      {(isNearExpiry || isExpired) && (
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 mb-6 animate-fade-in ${
            isExpired
              ? "border-destructive/30 bg-destructive/5"
              : "border-warning/30 bg-warning/5"
          }`}
        >
          <AlertTriangle className={`h-5 w-5 shrink-0 ${isExpired ? "text-destructive" : "text-warning"}`} />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {isExpired
                ? "Subscription has expired. Contact the platform owner to renew."
                : `⚠ Subscription will expire in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}.`}
            </p>
            <p className="text-xs text-muted-foreground">
              {isExpired
                ? "Your project is in a grace period. Services may be suspended soon."
                : "Please contact the platform owner to extend your subscription."}
            </p>
          </div>
        </div>
      )}

      {/* Subscription Overview */}
      <Card className="mb-6 animate-fade-in">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4.5 w-4.5 text-primary" />
            Subscription Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Status</p>
              <Badge variant={statusVariant} className="text-sm">{statusLabel}</Badge>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                <CalendarCheck className="h-3 w-3" /> Expiry Date
              </p>
              <p className="text-sm font-semibold text-foreground">
                {expiry ? format(expiry, "dd MMMM yyyy") : "No expiry set"}
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Next Due Date</p>
              <p className="text-sm font-semibold text-foreground">
                {expiry ? format(expiry, "dd MMMM yyyy") : "N/A"}
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                <Clock className="h-3 w-3" /> Days Remaining
              </p>
              <p className={`text-sm font-semibold ${
                daysRemaining !== null && daysRemaining <= 3 ? "text-destructive" : "text-foreground"
              }`}>
                {daysRemaining !== null ? (daysRemaining > 0 ? `${daysRemaining} Days` : "Expired") : "∞"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Info */}
      <Card className="mb-6 animate-fade-in">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4.5 w-4.5 text-primary" />
            Project Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Business Name</p>
              <p className="text-sm font-semibold text-foreground">{sub.business_name}</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Plan</p>
              <p className="text-sm font-semibold text-foreground">Standard</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Note */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 mb-6 animate-fade-in">
        <p className="text-xs text-muted-foreground">
          <strong>Note:</strong> Subscription management actions (Set Expiry, Extend, Suspend, Reactivate) are handled by the platform Owner through the Owner Panel.
        </p>
      </div>

      {/* Billing History */}
      <Card className="animate-fade-in">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4.5 w-4.5 text-primary" />
            Billing Activity History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {billingHistory.length > 0 ? (
            <div className="space-y-3">
              {billingHistory.map((entry, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{entry.action}</p>
                    <p className="text-xs text-muted-foreground">By {entry.performedBy}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(entry.date), "dd MMMM yyyy")}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No billing activity recorded yet.</p>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
