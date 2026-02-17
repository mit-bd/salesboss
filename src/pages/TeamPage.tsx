import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Edit2, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import AddTeamMemberDialog from "@/components/AddTeamMemberDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface TeamUser {
  id: string;
  email: string;
  fullName: string;
  role: string | null;
  createdAt: string;
  lastSignIn: string | null;
  banned: boolean;
}

export default function TeamPage() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMember, setEditMember] = useState<TeamUser | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-team", {
      body: { action: "list_users" },
    });
    if (error || data?.error) {
      console.error("Failed to fetch users:", error || data?.error);
    } else {
      setUsers(data.users || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleBan = async (userId: string, ban: boolean) => {
    const { data, error } = await supabase.functions.invoke("manage-team", {
      body: { action: "toggle_ban", userId, ban },
    });
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: ban ? "User Deactivated" : "User Activated" });
      fetchUsers();
    }
  };

  const roleLabel = (role: string | null) => {
    if (!role) return "No Role";
    return role.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const roleVariant = (role: string | null): "default" | "secondary" | "outline" => {
    if (role === "admin") return "default";
    if (role === "sub_admin") return "secondary";
    return "outline";
  };

  return (
    <AppLayout>
      <PageHeader title="Team" description="Manage team members and access">
        <AddTeamMemberDialog onSuccess={fetchUsers} />
      </PageHeader>

      {editMember && (
        <AddTeamMemberDialog editMember={editMember} onClose={() => setEditMember(null)} onSuccess={fetchUsers} />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
          {users.map((u) => (
            <div
              key={u.id}
              className="rounded-xl border border-border bg-card p-5 card-shadow hover:card-shadow-hover transition-fast relative group"
            >
              <button
                onClick={() => setEditMember(u)}
                className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground opacity-0 group-hover:opacity-100 transition-fast hover:bg-muted"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>

              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {(u.fullName || u.email)
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate">{u.fullName || "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-2">
                <Badge variant={roleVariant(u.role)} className="text-xs">
                  {roleLabel(u.role)}
                </Badge>
                <div className="flex items-center gap-2">
                  {u.banned ? (
                    <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                  )}
                  {u.id !== currentUser?.id && (
                    <Switch
                      checked={!u.banned}
                      onCheckedChange={(v) => handleToggleBan(u.id, !v)}
                    />
                  )}
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Created: {new Date(u.createdAt).toLocaleDateString()}
              </p>
              {u.lastSignIn && (
                <p className="text-[11px] text-muted-foreground">
                  Last login: {new Date(u.lastSignIn).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
