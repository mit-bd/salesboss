import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";

export default function SettingsPage() {
  return (
    <AppLayout>
      <PageHeader title="Settings" description="Application configuration" />

      <div className="max-w-2xl space-y-6 animate-fade-in">
        <div className="rounded-xl border border-border bg-card p-5 card-shadow">
          <h3 className="text-sm font-semibold text-foreground mb-1">Account</h3>
          <p className="text-sm text-muted-foreground">Manage your account settings and preferences.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 card-shadow">
          <h3 className="text-sm font-semibold text-foreground mb-1">Notifications</h3>
          <p className="text-sm text-muted-foreground">Configure followup reminders and alert preferences.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 card-shadow">
          <h3 className="text-sm font-semibold text-foreground mb-1">Roles & Permissions</h3>
          <p className="text-sm text-muted-foreground">Manage admin, sub-admin, and sales executive roles.</p>
        </div>
      </div>
    </AppLayout>
  );
}
