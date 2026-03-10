import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useOwnerProject } from "@/contexts/OwnerProjectContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, LogIn, Pencil, Calendar, CalendarPlus, Pause, Play, Download, RotateCcw } from "lucide-react";
import OwnerLayout from "@/components/owner/OwnerLayout";

interface Project {
  id: string;
  business_name: string;
  owner_user_id: string;
  is_active: boolean;
  created_at: string;
  expiry_date: string | null;
  subscription_status: string;
  admin_name: string;
  admin_email: string;
  total_users: number;
  total_orders: number;
}

function getProjectStatus(project: Project): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (project.subscription_status === "suspended") return { label: "Suspended", variant: "destructive" };
  if (!project.expiry_date) return { label: "Active", variant: "default" };
  const days = Math.ceil((new Date(project.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < -3) return { label: "Suspended", variant: "destructive" };
  if (days < 0) return { label: "Expired", variant: "destructive" };
  if (days <= 3) return { label: "Expiring", variant: "outline" };
  return { label: "Active", variant: "default" };
}

function getDaysRemaining(expiryDate: string | null): string {
  if (!expiryDate) return "—";
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)}d overdue`;
  return `${days}d`;
}

function getNextDueDate(expiryDate: string | null): string {
  if (!expiryDate) return "—";
  return new Date(expiryDate).toLocaleDateString();
}

export default function ProjectStatusPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { enterProject } = useOwnerProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [expiryProject, setExpiryProject] = useState<Project | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [extendProject, setExtendProject] = useState<Project | null>(null);
  const [extendDays, setExtendDays] = useState("30");
  const [actionLoading, setActionLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchProjects = useCallback(async () => {
    const { data } = await supabase.functions.invoke("manage-team", { body: { action: "list_projects" } });
    if (data?.projects) setProjects(data.projects);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const invokeAction = async (action: string, body: any, successMsg: string) => {
    setActionLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-team", { body: { action, ...body } });
    setActionLoading(false);
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
      return false;
    }
    toast({ title: successMsg });
    fetchProjects();
    return true;
  };

  const handleOpenProject = (project: Project) => {
    enterProject({ id: project.id, businessName: project.business_name });
    navigate("/");
  };

  const handleEditSave = async () => {
    if (!editProject) return;
    const ok = await invokeAction("update_project", { projectId: editProject.id, businessName: editName }, "Project updated");
    if (ok) setEditProject(null);
  };

  const handleSetExpiry = async () => {
    if (!expiryProject || !expiryDate) return;
    const ok = await invokeAction("set_expiry", { projectId: expiryProject.id, expiryDate }, "Expiry date set");
    if (ok) setExpiryProject(null);
  };

  const handleExtendExpiry = async () => {
    if (!extendProject || !extendDays) return;
    const ok = await invokeAction("extend_expiry", { projectId: extendProject.id, days: parseInt(extendDays) }, "Expiry extended");
    if (ok) setExtendProject(null);
  };

  const handleExportProject = async (project: Project) => {
    const { data, error } = await supabase.functions.invoke("manage-team", {
      body: { action: "export_project_data", projectId: project.id },
    });
    if (error || !data) {
      toast({ title: "Error", description: "Failed to export", variant: "destructive" });
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.business_name.replace(/\s+/g, "_")}_export.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Project data exported" });
  };

  const filteredProjects = projects.filter((p) => {
    if (statusFilter === "all") return true;
    const status = getProjectStatus(p).label.toLowerCase();
    return status === statusFilter;
  });

  return (
    <OwnerLayout title="Project Status" subtitle="Subscription and lifecycle management for all projects">
      {/* Filter */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expiring">Expiring</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filteredProjects.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No projects found.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Name</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead className="text-center">Users</TableHead>
                <TableHead className="text-center">Orders</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Next Due</TableHead>
                <TableHead className="text-center">Days Left</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((project) => {
                const status = getProjectStatus(project);
                return (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium text-foreground">{project.business_name}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm text-foreground">{project.admin_name}</p>
                        <p className="text-xs text-muted-foreground">{project.admin_email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{project.total_users}</TableCell>
                    <TableCell className="text-center">{project.total_orders}</TableCell>
                    <TableCell>
                      <Badge
                        variant={status.variant}
                        className={status.label === "Expiring" ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" : ""}
                      >
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {project.expiry_date ? new Date(project.expiry_date).toLocaleDateString() : "Not set"}
                    </TableCell>
                    <TableCell className="text-sm">{getNextDueDate(project.expiry_date)}</TableCell>
                    <TableCell className="text-center text-sm">{getDaysRemaining(project.expiry_date)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenProject(project)} title="Open Project">
                          <LogIn className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setEditProject(project); setEditName(project.business_name); }} title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setExpiryProject(project); setExpiryDate(project.expiry_date || ""); }} title="Set Expiry">
                          <Calendar className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setExtendProject(project); setExtendDays("30"); }} title="Extend">
                          <CalendarPlus className="h-3.5 w-3.5" />
                        </Button>
                        {project.subscription_status === "suspended" ? (
                          <Button variant="ghost" size="sm" onClick={() => invokeAction("reactivate_project", { projectId: project.id }, "Project reactivated")} title="Reactivate">
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => invokeAction("suspend_project", { projectId: project.id }, "Project suspended")} title="Suspend">
                            <Pause className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleExportProject(project)} title="Export Data">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" title="Reset Project">
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Reset Project Data</AlertDialogTitle>
                              <AlertDialogDescription>
                                Delete all orders, customers, products, and delivery methods for "{project.business_name}"? Users and roles will be preserved.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => invokeAction("reset_project", { projectId: project.id }, "Project data reset")}>
                                Reset
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editProject} onOpenChange={(open) => !open && setEditProject(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Business Name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProject(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Expiry Dialog */}
      <Dialog open={!!expiryProject} onOpenChange={(open) => !open && setExpiryProject(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set Expiry Date — {expiryProject?.business_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Expiry Date</Label><Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpiryProject(null)}>Cancel</Button>
            <Button onClick={handleSetExpiry} disabled={actionLoading || !expiryDate}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Set Expiry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Expiry Dialog */}
      <Dialog open={!!extendProject} onOpenChange={(open) => !open && setExtendProject(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Extend Expiry — {extendProject?.business_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Extension Period</Label>
              <Select value={extendDays} onValueChange={setExtendDays}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 Days</SelectItem>
                  <SelectItem value="15">15 Days</SelectItem>
                  <SelectItem value="30">30 Days</SelectItem>
                  <SelectItem value="60">60 Days</SelectItem>
                  <SelectItem value="90">90 Days</SelectItem>
                  <SelectItem value="180">180 Days</SelectItem>
                  <SelectItem value="365">1 Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {extendProject?.expiry_date && (
              <p className="text-sm text-muted-foreground">Current expiry: {new Date(extendProject.expiry_date).toLocaleDateString()}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendProject(null)}>Cancel</Button>
            <Button onClick={handleExtendExpiry} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Extend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OwnerLayout>
  );
}
