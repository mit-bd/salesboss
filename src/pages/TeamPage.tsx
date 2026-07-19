import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Eye, KeyRound, Loader2, MoreHorizontal, Pause, Pencil, Play, Search, ShieldAlert, ShieldCheck, Trash2, UserCog, UsersRound,
} from "lucide-react";
import AddTeamMemberDialog from "@/components/AddTeamMemberDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionContext";

interface TeamUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: string | null;
  createdAt: string;
  lastSignIn: string | null;
  banned: boolean;
  aiVoiceEnabled: boolean;
  avatarUrl: string | null;
  employeeId: string | null;
  department: string | null;
  status: string;
  supervisorId: string | null;
  supervisorName: string | null;
}

const ROLE_TABS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "sales_executive", label: "Sales Executives" },
  { value: "team_leader", label: "Team Leaders" },
  { value: "sub_admin", label: "Sub Admins" },
  { value: "manager", label: "Managers" },
  { value: "admin", label: "Admins" },
];

const STATUS_TABS = ["all", "active", "on_hold", "suspended", "resigned", "archived"] as const;

const prettify = (s: string | null | undefined) =>
  (s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "active") return "default";
  if (s === "on_hold") return "secondary";
  if (s === "suspended" || s === "resigned") return "destructive";
  return "outline";
};

const roleVariant = (role: string | null): "default" | "secondary" | "outline" => {
  if (role === "admin") return "default";
  if (role === "sub_admin" || role === "manager") return "secondary";
  return "outline";
};

export default function TeamPage() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMember, setEditMember] = useState<TeamUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<TeamUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk dialogs
  const [bulkStatusDialog, setBulkStatusDialog] = useState<null | string>(null);
  const [bulkRoleDialog, setBulkRoleDialog] = useState<string>("");
  const [bulkSupervisorDialog, setBulkSupervisorDialog] = useState<string>("");
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { hasPermission: has } = usePermissions();

  const canManage = has("team.manage") || has("users.manage");
  const canBulk = has("team.bulk") || canManage;
  const canDelete = has("team.delete") || has("users.manage");
  const canHierarchy = has("team.hierarchy") || canManage;
  const canStatus = has("team.status") || canManage;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_team_members_full");
    if (error) {
      toast({ title: "Failed to load team", description: error.message, variant: "destructive" });
      setUsers([]);
    } else {
      const rows = (data || []) as any[];
      setUsers(
        rows.map((r) => ({
          id: r.id,
          email: r.email || "",
          fullName: r.full_name || "",
          phone: r.phone || "",
          role: r.role,
          createdAt: r.created_at,
          lastSignIn: r.last_sign_in,
          emailConfirmed: r.email_confirmed,
          banned: r.banned,
          aiVoiceEnabled: r.ai_voice_enabled,
          avatarUrl: r.avatar_url,
          employeeId: r.employee_id,
          department: r.department,
          status: r.status,
          supervisorId: r.supervisor_id,
          supervisorName: r.supervisor_name,
          joinDate: r.join_date,
        })),
      );
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const supervisorOptions = useMemo(
    () => users
      .filter((u) => ["admin", "sub_admin", "manager", "team_leader"].includes(u.role || ""))
      .map((u) => ({ id: u.id, fullName: u.fullName || u.email, role: u.role })),
    [users],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter !== "all" && (u.status || "active") !== statusFilter) return false;
      if (!q) return true;
      return (
        (u.fullName || "").toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone || "").toLowerCase().includes(q) ||
        (u.employeeId || "").toLowerCase().includes(q) ||
        (u.department || "").toLowerCase().includes(q)
      );
    });
  }, [users, roleFilter, statusFilter, search]);

  const roleCounts = useMemo(() => {
    const c: Record<string, number> = { all: users.length };
    for (const u of users) c[u.role || ""] = (c[u.role || ""] || 0) + 1;
    return c;
  }, [users]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    const eligible = filtered.filter((u) => u.id !== currentUser?.id).map((u) => u.id);
    const allSelected = eligible.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(eligible));
  };

  const selectedList = users.filter((u) => selectedIds.has(u.id));

  const handleToggleVoice = async (userId: string, enabled: boolean) => {
    const { error } = await (supabase.rpc as any)("toggle_team_member_voice", {
      p_user_id: userId,
      p_enabled: enabled,
      p_reason: null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: enabled ? "Voice Input Enabled" : "Voice Input Disabled" });
      fetchUsers();
    }
  };

  const handleStatusChange = async (u: TeamUser, status: string) => {
    const { error } = await (supabase.rpc as any)("set_employee_status", {
      p_user_id: u.id,
      p_status: status,
      p_reason: null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Status → ${prettify(status)}`, description: `${u.fullName || u.email} updated.` });
      fetchUsers();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await (supabase.rpc as any)("remove_team_member_profile", {
        p_user_id: deleteTarget.id,
        p_reason: null,
      });
      if (error) throw new Error(error.message);
      toast({ title: "Removed", description: `${deleteTarget.fullName} has been removed from the team.` });
      setDeleteTarget(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete.", variant: "destructive" });
    } finally { setDeleting(false); }
  };

  const handleResetPassword = async () => {
    if (!passwordTarget || newPassword.length < 6) {
      toast({ title: "Password too short", description: "Minimum 6 characters.", variant: "destructive" });
      return;
    }
    setPwSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-team", {
        body: { action: "reset_password", userId: passwordTarget.id, newPassword },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: "Password reset", description: `New password set for ${passwordTarget.fullName || passwordTarget.email}.` });
      setPasswordTarget(null);
      setNewPassword("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setPwSaving(false); }
  };

  const runBulk = async (invokeBody: Record<string, unknown>, successMsg: string) => {
    setBulkBusy(true);
    try {
      let affected: number | null = null;
      let error: any = null;

      const action = invokeBody.action;
      const userIds = (invokeBody.userIds as string[] | undefined) || Array.from(selectedIds);
      if (action === "bulk_status") {
        const res = await (supabase.rpc as any)("bulk_set_employee_status", {
          p_user_ids: userIds,
          p_status: invokeBody.status,
          p_reason: invokeBody.reason ?? null,
        });
        affected = res.data ?? null;
        error = res.error;
      } else if (action === "bulk_role") {
        const res = await (supabase.rpc as any)("bulk_set_user_role", {
          p_user_ids: userIds,
          p_role: invokeBody.role,
          p_reason: invokeBody.reason ?? null,
        });
        affected = res.data ?? null;
        error = res.error;
      } else if (action === "bulk_supervisor") {
        const res = await (supabase.rpc as any)("bulk_set_employee_supervisor", {
          p_user_ids: userIds,
          p_supervisor_id: invokeBody.supervisorId ?? null,
          p_reason: invokeBody.reason ?? null,
        });
        affected = res.data ?? null;
        error = res.error;
      } else if (action === "bulk_delete") {
        const res = await (supabase.rpc as any)("bulk_remove_team_member_profiles", {
          p_user_ids: userIds,
          p_reason: invokeBody.reason ?? null,
        });
        affected = res.data ?? null;
        error = res.error;
      } else {
        throw new Error("Unsupported bulk action");
      }

      if (error) throw new Error(error.message);
      toast({ title: successMsg, description: `${affected ?? selectedIds.size} members updated.` });
      setSelectedIds(new Set());
      setBulkStatusDialog(null);
      setBulkRoleDialog("");
      setBulkSupervisorDialog("");
      setBulkDeleteOpen(false);
      setBulkReason("");
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Bulk action failed", description: err.message, variant: "destructive" });
    } finally { setBulkBusy(false); }
  };

  return (
    <AppLayout>
      <PageHeader title="Team" description="Manage team members, roles and hierarchy">
        {canManage && <AddTeamMemberDialog onSuccess={fetchUsers} supervisors={supervisorOptions} />}
      </PageHeader>

      {editMember && (
        <AddTeamMemberDialog
          editMember={editMember}
          onClose={() => setEditMember(null)}
          onSuccess={fetchUsers}
          supervisors={supervisorOptions}
        />
      )}

      {/* Role tabs */}
      <Tabs value={roleFilter} onValueChange={setRoleFilter} className="mb-3">
        <TabsList className="flex-wrap h-auto">
          {ROLE_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
              <UsersRound className="h-3.5 w-3.5" />
              {t.label}
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{roleCounts[t.value] ?? 0}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Status tabs + search */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between mb-3">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            {STATUS_TABS.map((s) => (
              <TabsTrigger key={s} value={s} className="capitalize text-xs">{s === "all" ? "All Status" : prettify(s)}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name / email / phone / ID" className="pl-8" />
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-2 z-10 rounded-lg border border-border bg-card/95 backdrop-blur px-3 py-2 mb-3 flex flex-wrap items-center gap-2 card-shadow">
          <Badge variant="secondary" className="text-xs">{selectedIds.size} selected</Badge>
          {canStatus && (
            <>
              <Button size="sm" variant="outline" onClick={() => setBulkStatusDialog("on_hold")}><Pause className="h-3.5 w-3.5 mr-1" /> Hold</Button>
              <Button size="sm" variant="outline" onClick={() => setBulkStatusDialog("active")}><Play className="h-3.5 w-3.5 mr-1" /> Activate</Button>
              <Button size="sm" variant="outline" onClick={() => setBulkStatusDialog("suspended")}>Suspend</Button>
            </>
          )}
          {canBulk && (
            <>
              <Button size="sm" variant="outline" onClick={() => setBulkRoleDialog("sales_executive")}><UserCog className="h-3.5 w-3.5 mr-1" /> Change Role</Button>
              {canHierarchy && (
                <Button size="sm" variant="outline" onClick={() => setBulkSupervisorDialog("none")}><UsersRound className="h-3.5 w-3.5 mr-1" /> Change Supervisor</Button>
              )}
            </>
          )}
          {canDelete && (
            <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No team members match the current filters.</p>
      ) : (
        <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden animate-fade-in">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8">
                  <Checkbox
                    checked={filtered.filter((u) => u.id !== currentUser?.id).length > 0 &&
                      filtered.filter((u) => u.id !== currentUser?.id).every((u) => selectedIds.has(u.id))}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead title="Uses the browser's built-in Speech Recognition API (Chrome/Edge). Not a hosted AI voice service.">Voice</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right w-12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <TableRow key={u.id} data-state={selectedIds.has(u.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(u.id)}
                        disabled={isSelf}
                        onCheckedChange={() => toggleSelect(u.id)}
                        aria-label={`Select ${u.fullName}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center overflow-hidden">
                          {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" /> :
                            (u.fullName || u.email).split(" ").map((n) => n[0]).filter(Boolean).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <Link to={`/team/${u.id}`} className="font-medium text-foreground hover:underline">
                          {u.fullName || "Unnamed"}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="text-foreground">{u.employeeId || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.department || "—"}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>{u.email}</div>
                      <div className="text-xs">{u.phone || "—"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleVariant(u.role)} className="text-xs">{prettify(u.role) || "No Role"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.supervisorName || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(u.status || "active")} className="text-xs">
                        {(u.status || "active") === "active" ? <ShieldCheck className="h-3 w-3 mr-1" /> : <ShieldAlert className="h-3 w-3 mr-1" />}
                        {prettify(u.status || "active")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={u.aiVoiceEnabled}
                        onCheckedChange={(checked) => handleToggleVoice(u.id, checked)}
                        className="data-[state=checked]:bg-primary"
                      />
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
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem asChild>
                            <Link to={`/team/${u.id}`}><Eye className="mr-2 h-4 w-4" /> View Details</Link>
                          </DropdownMenuItem>
                          {canManage && (
                            <DropdownMenuItem onClick={() => setEditMember(u)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit Profile
                            </DropdownMenuItem>
                          )}
                          {canManage && (
                            <DropdownMenuItem onClick={() => setPasswordTarget(u)}>
                              <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                            </DropdownMenuItem>
                          )}
                          {canStatus && !isSelf && <DropdownMenuSeparator />}
                          {canStatus && !isSelf && (u.status || "active") !== "active" && (
                            <DropdownMenuItem onClick={() => handleStatusChange(u, "active")}>
                              <Play className="mr-2 h-4 w-4" /> Activate
                            </DropdownMenuItem>
                          )}
                          {canStatus && !isSelf && (u.status || "active") !== "on_hold" && (
                            <DropdownMenuItem onClick={() => handleStatusChange(u, "on_hold")}>
                              <Pause className="mr-2 h-4 w-4" /> Hold
                            </DropdownMenuItem>
                          )}
                          {canStatus && !isSelf && (u.status || "active") !== "suspended" && (
                            <DropdownMenuItem onClick={() => handleStatusChange(u, "suspended")}>
                              <ShieldAlert className="mr-2 h-4 w-4" /> Suspend
                            </DropdownMenuItem>
                          )}
                          {canStatus && !isSelf && (u.status || "active") !== "resigned" && (
                            <DropdownMenuItem onClick={() => handleStatusChange(u, "resigned")}>
                              Mark Resigned
                            </DropdownMenuItem>
                          )}
                          {canStatus && !isSelf && (u.status || "active") !== "archived" && (
                            <DropdownMenuItem onClick={() => handleStatusChange(u, "archived")}>
                              Archive
                            </DropdownMenuItem>
                          )}
                          {canDelete && !isSelf && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(u)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
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
              This removes their team profile and role access. Any assigned orders will be unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset password */}
      <Dialog open={!!passwordTarget} onOpenChange={(v) => { if (!v) { setPasswordTarget(null); setNewPassword(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Set a new password for <span className="font-medium text-foreground">{passwordTarget?.fullName || passwordTarget?.email}</span>.
            </p>
            <Input
              type="password"
              placeholder="New password (min 6 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPasswordTarget(null); setNewPassword(""); }} disabled={pwSaving}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={pwSaving || newPassword.length < 6}>
              {pwSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk status */}
      <Dialog open={!!bulkStatusDialog} onOpenChange={(v) => { if (!v) setBulkStatusDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Change status → {prettify(bulkStatusDialog || "")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Apply to {selectedList.length} member{selectedList.length === 1 ? "" : "s"}.</p>
          <Input placeholder="Reason (optional)" value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkStatusDialog(null)} disabled={bulkBusy}>Cancel</Button>
            <Button
              onClick={() => runBulk(
                { action: "bulk_status", userIds: Array.from(selectedIds), status: bulkStatusDialog, reason: bulkReason || null },
                `Status updated to ${prettify(bulkStatusDialog || "")}`,
              )}
              disabled={bulkBusy}
            >
              {bulkBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk role */}
      <Dialog open={!!bulkRoleDialog} onOpenChange={(v) => { if (!v) setBulkRoleDialog(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Change role</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Apply to {selectedList.length} member{selectedList.length === 1 ? "" : "s"}.</p>
          <Select value={bulkRoleDialog} onValueChange={setBulkRoleDialog}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="sub_admin">Sub Admin</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="team_leader">Team Leader</SelectItem>
              <SelectItem value="sales_executive">Sales Executive</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Reason (optional)" value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkRoleDialog("")} disabled={bulkBusy}>Cancel</Button>
            <Button
              onClick={() => runBulk(
                { action: "bulk_role", userIds: Array.from(selectedIds), role: bulkRoleDialog, reason: bulkReason || null },
                "Role updated",
              )}
              disabled={bulkBusy || !bulkRoleDialog}
            >
              {bulkBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk supervisor */}
      <Dialog open={!!bulkSupervisorDialog} onOpenChange={(v) => { if (!v) setBulkSupervisorDialog(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Change supervisor</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Apply to {selectedList.length} member{selectedList.length === 1 ? "" : "s"}.</p>
          <Select value={bulkSupervisorDialog} onValueChange={setBulkSupervisorDialog}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No supervisor</SelectItem>
              {supervisorOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.fullName} {s.role ? `· ${prettify(s.role)}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Reason (optional)" value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkSupervisorDialog("")} disabled={bulkBusy}>Cancel</Button>
            <Button
              onClick={() => runBulk(
                {
                  action: "bulk_supervisor",
                  userIds: Array.from(selectedIds),
                  supervisorId: bulkSupervisorDialog === "none" ? null : bulkSupervisorDialog,
                  reason: bulkReason || null,
                },
                "Supervisor updated",
              )}
              disabled={bulkBusy || !bulkSupervisorDialog}
            >
              {bulkBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedList.length} team member{selectedList.length === 1 ? "" : "s"}</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the selected team profiles and role access.
              Any orders assigned to these users will be unassigned. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => runBulk(
                { action: "bulk_delete", userIds: Array.from(selectedIds), reason: "Bulk team member removal" },
                "Members removed",
              )}
              disabled={bulkBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
