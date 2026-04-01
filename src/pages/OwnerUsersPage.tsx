import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Pencil, Shield, Key, Ban, Trash2, Eye, EyeOff, Users, Building2 } from "lucide-react";
import OwnerLayout from "@/components/owner/OwnerLayout";

interface UserItem {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: string | null;
  projectId: string | null;
  projectName: string;
  createdAt: string;
  lastSignIn: string | null;
  emailConfirmed: boolean;
  banned: boolean;
}

interface ProjectItem {
  id: string;
  business_name: string;
  total_users: number;
}

export default function OwnerUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [roleUser, setRoleUser] = useState<UserItem | null>(null);
  const [passwordUser, setPasswordUser] = useState<UserItem | null>(null);
  const [viewUser, setViewUser] = useState<UserItem | null>(null);
  const [showViewPassword, setShowViewPassword] = useState(false);
  const [viewPasswordText, setViewPasswordText] = useState("");
  const [viewPasswordLoading, setViewPasswordLoading] = useState(false);

  // Form states
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState("sales_executive");
  const [formProjectId, setFormProjectId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const [usersRes, projectsRes] = await Promise.all([
      supabase.functions.invoke("manage-team", { body: { action: "owner_list_users", projectId: selectedProjectId || undefined } }),
      supabase.functions.invoke("manage-team", { body: { action: "list_projects" } }),
    ]);
    if (usersRes.data?.users) setUsers(usersRes.data.users);
    if (projectsRes.data?.projects) setProjects(projectsRes.data.projects);
    setLoading(false);
  }, [selectedProjectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredUsers = users.filter((u) => {
    if (filterRole !== "all" && u.role !== filterRole) return false;
    if (filterStatus === "active" && u.banned) return false;
    if (filterStatus === "disabled" && !u.banned) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return u.email.toLowerCase().includes(term) || u.fullName.toLowerCase().includes(term);
    }
    return true;
  });

  const projectUserCounts = projects.map((p) => ({
    ...p,
    userCount: users.filter((u) => u.projectId === p.id).length,
  }));

  const handleCreate = async () => {
    if (!formEmail || !formPassword || !formRole) return;
    setActionLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-team", {
      body: { action: "owner_create_user", email: formEmail, password: formPassword, fullName: formName, role: formRole, projectId: formProjectId || null },
    });
    setActionLoading(false);
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "User created successfully" });
      setCreateOpen(false);
      resetForm();
      fetchData();
    }
  };

  const handleEditSave = async () => {
    if (!editUser) return;
    setActionLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-team", {
      body: { action: "owner_update_user", userId: editUser.id, fullName: formName, email: formEmail, phone: formPhone },
    });
    setActionLoading(false);
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "User updated" });
      setEditUser(null);
      fetchData();
    }
  };

  const handleRoleChange = async () => {
    if (!roleUser || !newRole) return;
    setActionLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-team", {
      body: { action: "owner_update_role", userId: roleUser.id, role: newRole },
    });
    setActionLoading(false);
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Role updated" });
      setRoleUser(null);
      fetchData();
    }
  };

  const handleResetPassword = async () => {
    if (!passwordUser || !newPassword) return;
    setActionLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-team", {
      body: { action: "owner_reset_password", userId: passwordUser.id, newPassword },
    });
    setActionLoading(false);
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Password reset successfully" });
      setPasswordUser(null);
      setNewPassword("");
      fetchData();
    }
  };

  const handleToggleBan = async (userId: string, ban: boolean) => {
    const { data, error } = await supabase.functions.invoke("manage-team", {
      body: { action: "owner_toggle_ban", userId, ban },
    });
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: ban ? "User disabled" : "User enabled" });
      fetchData();
    }
  };

  const handleDelete = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke("manage-team", {
      body: { action: "owner_delete_user", userId },
    });
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "User deleted" });
      fetchData();
    }
  };

  const resetForm = () => {
    setFormEmail(""); setFormPassword(""); setFormName(""); setFormPhone(""); setFormRole("sales_executive"); setFormProjectId("");
  };

  const roleBadge = (role: string | null) => {
    const colors: Record<string, string> = {
      admin: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      sub_admin: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      sales_executive: "bg-green-500/10 text-green-500 border-green-500/20",
    };
    return <Badge variant="outline" className={colors[role || ""] || ""}>{role?.replace("_", " ") || "No role"}</Badge>;
  };

  return (
    <OwnerLayout title="Users Manager" subtitle="Manage all platform users grouped by project">
      {/* Project Selector Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <Card
          className={`cursor-pointer transition-colors ${!selectedProjectId ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"}`}
          onClick={() => setSelectedProjectId("")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">All Projects</p>
              <p className="text-xs text-muted-foreground">{users.length} Users</p>
            </div>
          </CardContent>
        </Card>
        {projectUserCounts.map((p) => (
          <Card
            key={p.id}
            className={`cursor-pointer transition-colors ${selectedProjectId === p.id ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"}`}
            onClick={() => setSelectedProjectId(p.id)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.business_name}</p>
                <p className="text-xs text-muted-foreground">{p.userCount} Users</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap flex-1">
          <Input placeholder="Search by name or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-xs" />
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Roles" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="sub_admin">Sub Admin</SelectItem>
              <SelectItem value="sales_executive">Sales Executive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { resetForm(); setFormProjectId(selectedProjectId); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Create User
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filteredUsers.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No users found.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium text-foreground">{user.fullName || "Unnamed"}</TableCell>
                  <TableCell className="text-sm">{user.email}</TableCell>
                  <TableCell>{roleBadge(user.role)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.projectName}</TableCell>
                  <TableCell>
                    <Badge variant={user.banned ? "destructive" : "default"}>
                      {user.banned ? "Disabled" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.lastSignIn ? new Date(user.lastSignIn).toLocaleDateString() : "Never"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="View" onClick={() => setViewUser(user)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => { setEditUser(user); setFormName(user.fullName); setFormEmail(user.email); setFormPhone(user.phone); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Role" onClick={() => { setRoleUser(user); setNewRole(user.role || "sales_executive"); }}>
                        <Shield className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Password" onClick={() => { setPasswordUser(user); setNewPassword(""); }}>
                        <Key className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title={user.banned ? "Enable" : "Disable"} onClick={() => handleToggleBan(user.id, !user.banned)}>
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                            <AlertDialogDescription>Permanently delete {user.email}?</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(user.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* View Profile Dialog */}
      <Dialog open={!!viewUser} onOpenChange={(open) => !open && setViewUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>User Profile</DialogTitle></DialogHeader>
          {viewUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-xs text-muted-foreground">Name</Label><p className="text-sm font-medium text-foreground">{viewUser.fullName || "—"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Email</Label><p className="text-sm font-medium text-foreground">{viewUser.email}</p></div>
                <div><Label className="text-xs text-muted-foreground">Role</Label><div className="mt-0.5">{roleBadge(viewUser.role)}</div></div>
                <div><Label className="text-xs text-muted-foreground">Project</Label><p className="text-sm font-medium text-foreground">{viewUser.projectName}</p></div>
                <div><Label className="text-xs text-muted-foreground">Phone</Label><p className="text-sm font-medium text-foreground">{viewUser.phone || "—"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Status</Label><Badge variant={viewUser.banned ? "destructive" : "default"}>{viewUser.banned ? "Disabled" : "Active"}</Badge></div>
                <div><Label className="text-xs text-muted-foreground">Last Login</Label><p className="text-sm font-medium text-foreground">{viewUser.lastSignIn ? new Date(viewUser.lastSignIn).toLocaleString() : "Never"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Created</Label><p className="text-sm font-medium text-foreground">{new Date(viewUser.createdAt).toLocaleDateString()}</p></div>
              </div>
              <div className="border-t border-border pt-3 text-xs text-muted-foreground">
                <p>Password: ●●●●●●●● (hashed — use "Set Password" to change)</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewUser(null)}>Close</Button>
            <Button variant="outline" onClick={() => { if (viewUser) { setPasswordUser(viewUser); setNewPassword(""); setViewUser(null); } }}>
              <Key className="h-3.5 w-3.5 mr-1.5" />Set Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Full Name</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} /></div>
            <div><Label>Password</Label><Input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} /></div>
            <div>
              <Label>Role</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="sub_admin">Sub Admin</SelectItem>
                  <SelectItem value="sales_executive">Sales Executive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assign to Project</Label>
              <Select value={formProjectId} onValueChange={setFormProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project..." /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.business_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={actionLoading}>{actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Full Name</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={actionLoading}>{actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={!!roleUser} onOpenChange={(open) => !open && setRoleUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change Role for {roleUser?.fullName || roleUser?.email}</DialogTitle></DialogHeader>
          <Select value={newRole} onValueChange={setNewRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="sub_admin">Sub Admin</SelectItem>
              <SelectItem value="sales_executive">Sales Executive</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleUser(null)}>Cancel</Button>
            <Button onClick={handleRoleChange} disabled={actionLoading}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Password Dialog */}
      <Dialog open={!!passwordUser} onOpenChange={(open) => !open && setPasswordUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set New Password for {passwordUser?.email}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input type="password" placeholder="Enter new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <p className="text-xs text-muted-foreground">Minimum 6 characters.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordUser(null)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={actionLoading || newPassword.length < 6}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Set Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OwnerLayout>
  );
}
