import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { mockSalesExecutives } from "@/data/mockData";
import { Edit2 } from "lucide-react";
import AddTeamMemberDialog from "@/components/AddTeamMemberDialog";
import { SalesExecutive } from "@/types/data";

export default function TeamPage() {
  const [editMember, setEditMember] = useState<SalesExecutive | null>(null);

  return (
    <AppLayout>
      <PageHeader title="Team" description="Manage sales executives and roles">
        <AddTeamMemberDialog />
      </PageHeader>

      {editMember && (
        <AddTeamMemberDialog editMember={editMember} onClose={() => setEditMember(null)} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
        {mockSalesExecutives.map((se) => (
          <div
            key={se.id}
            className="rounded-xl border border-border bg-card p-5 card-shadow hover:card-shadow-hover transition-fast relative group"
          >
            <button
              onClick={() => setEditMember(se)}
              className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground opacity-0 group-hover:opacity-100 transition-fast hover:bg-muted"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
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
