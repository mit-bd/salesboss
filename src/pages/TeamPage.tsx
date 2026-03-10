import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, MoreHorizontal, Pencil, Trash2, ShieldCheck, ShieldAlert } from "lucide-react";
import AddTeamMemberDialog from "@/components/AddTeamMemberDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface TeamUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: string | null;
  createdAt: string;
  lastSignIn: string | null;
  banned: boolean;
}

export default function TeamPage() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMember, setEditMember] = useState<TeamUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamUser | null>(null);
  const [deleting, setDeleting] = useState(false);
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-team", {
        body: { action: "delete_user", userId: deleteTarget.id },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: "Deleted", description: `${deleteTarget.fullName} has been removed.` });
      setDeleteTarget(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete.", variant: "destructive" });
    } finally {
      setDeleting(false);
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
      ) : users.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No team members found.</p>
      ) : (
        <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden animate-fade-in">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right w-12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {(u.fullName || u.email)
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <span className="font-medium text-foreground">{u.fullName || "Unnamed"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.phone || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={roleVariant(u.role)} className="text-xs">
                      {roleLabel(u.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {u.banned ? (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <ShieldAlert className="h-3 w-3" /> Disabled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs gap-1 border-green-500/30 text-green-600">
                          <ShieldCheck className="h-3 w-3" /> Active
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString() : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditMember(u)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        {u.id !== currentUser?.id && (
                          <DropdownMenuItem onClick={() => handleToggleBan(u.id, !u.banned)}>
                            {u.banned ? (
                              <><ShieldCheck className="mr-2 h-4 w-4" /> Enable</>
                            ) : (
                              <><ShieldAlert className="mr-2 h-4 w-4" /> Disable</>
                            )}
                          </DropdownMenuItem>
                        )}
                        {u.id !== currentUser?.id && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(u)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{deleteTarget?.fullName}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
