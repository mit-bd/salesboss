import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useOwnerProject } from "@/contexts/OwnerProjectContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2, Users, ShoppingCart, Pencil, RotateCcw, Eye, LogIn, Calendar, CalendarPlus, Pause, Play } from "lucide-react";
import OwnerLayout from "@/components/owner/OwnerLayout";
import { Link } from "react-router-dom";

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

export default function OwnerProjectsPage() {
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

  const getStatusBadge = (project: Project) => {
    if (project.subscription_status === "suspended") return <Badge variant="destructive">Suspended</Badge>;
    if (!project.is_active) return <Badge variant="secondary">Inactive</Badge>;
    if (project.expiry_date) {
      const days = Math.ceil((new Date(project.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (days < 0) return <Badge variant="destructive">Expired</Badge>;
      if (days <= 3) return <Badge className="bg-warning/10 text-warning border-warning/20" variant="outline">Expiring</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  return (
    <OwnerLayout title="Projects" subtitle="Manage all registered business projects">
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : projects.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No projects created yet.</p>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">{project.business_name}</p>
                      {getStatusBadge(project)}
                    </div>
                    <p className="text-sm text-muted-foreground">Admin: {project.admin_name} ({project.admin_email})</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{project.total_users} Users</span>
                      <span className="flex items-center gap-1"><ShoppingCart className="h-3.5 w-3.5" />{project.total_orders} Orders</span>
                      <span className="text-xs">Created: {new Date(project.created_at).toLocaleDateString()}</span>
                      {project.expiry_date && (
                        <span className="flex items-center gap-1 text-xs">
                          <Calendar className="h-3 w-3" />Expiry: {new Date(project.expiry_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <Button variant="default" size="sm" onClick={() => handleOpenProject(project)}>
                      <LogIn className="h-3.5 w-3.5 mr-1" />Open Project
                    </Button>
                    <Link to={`/owner/users?project=${project.id}`}>
                      <Button variant="outline" size="sm"><Eye className="h-3.5 w-3.5 mr-1" />Users</Button>
                    </Link>
                    <Button variant="outline" size="sm" onClick={() => { setEditProject(project); setEditName(project.business_name); }}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setExpiryProject(project); setExpiryDate(project.expiry_date || ""); }}>
                      <Calendar className="h-3.5 w-3.5 mr-1" />Expiry
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setExtendProject(project); setExtendDays("30"); }}>
                      <CalendarPlus className="h-3.5 w-3.5 mr-1" />Extend
                    </Button>
                    {project.subscription_status === "suspended" ? (
                      <Button variant="outline" size="sm" onClick={() => invokeAction("reactivate_project", { projectId: project.id }, "Project reactivated")}>
                        <Play className="h-3.5 w-3.5 mr-1" />Reactivate
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => invokeAction("suspend_project", { projectId: project.id }, "Project suspended")}>
                        <Pause className="h-3.5 w-3.5 mr-1" />Suspend
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8"><RotateCcw className="h-3.5 w-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reset Project Data</AlertDialogTitle>
                          <AlertDialogDescription>This will delete all orders, customers, products, and delivery methods for "{project.business_name}". Users and roles will be preserved.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => invokeAction("reset_project", { projectId: project.id }, "Project data reset successfully")}>Reset</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon" className="h-8 w-8"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Project</AlertDialogTitle>
                          <AlertDialogDescription>Are you sure you want to permanently delete "{project.business_name}" and all its data?</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => invokeAction("delete_project", { projectId: project.id }, "Project deleted")}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editProject} onOpenChange={(open) => !open && setEditProject(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Business Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProject(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Expiry Dialog */}
      <Dialog open={!!expiryProject} onOpenChange={(open) => !open && setExpiryProject(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set Expiry Date for {expiryProject?.business_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Expiry Date</Label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
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
          <DialogHeader><DialogTitle>Extend Expiry for {extendProject?.business_name}</DialogTitle></DialogHeader>
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
              <p className="text-sm text-muted-foreground">
                Current expiry: {new Date(extendProject.expiry_date).toLocaleDateString()}
              </p>
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
