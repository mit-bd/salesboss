import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { mockSalesExecutives } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Plus, UserCheck } from "lucide-react";

export default function TeamPage() {
  return (
    <AppLayout>
      <PageHeader title="Team" description="Manage sales executives and roles">
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Member
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
        {mockSalesExecutives.map((se) => (
          <div
            key={se.id}
            className="rounded-xl border border-border bg-card p-5 card-shadow hover:card-shadow-hover transition-fast"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {se.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div>
                <p className="font-semibold text-foreground">{se.name}</p>
                <p className="text-xs text-muted-foreground">{se.email}</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-lg font-bold text-foreground">{se.assignedOrders}</p>
                <p className="text-[11px] text-muted-foreground">Active Orders</p>
              </div>
              <div className="flex-1 rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-lg font-bold text-foreground">{se.completedFollowups}</p>
                <p className="text-[11px] text-muted-foreground">Followups Done</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
