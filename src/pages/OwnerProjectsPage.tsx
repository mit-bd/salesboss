import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Trash2, Users, ShoppingCart, Pencil, RotateCcw, Eye } from "lucide-react";
import OwnerLayout from "@/components/owner/OwnerLayout";
import { Link } from "react-router-dom";

interface Project {
  id: string;
  business_name: string;
  owner_user_id: string;
  is_active: boolean;
  created_at: string;
  admin_name: string;
  admin_email: string;
  total_users: number;
  total_orders: number;
}

export default function OwnerProjectsPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");

  const fetchProjects = useCallback(async () => {
    const { data } = await supabase.functions.invoke("manage-team", { body: { action: "list_projects" } });
    if (data?.projects) setProjects(data.projects);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleToggle = async (projectId: string, isActive: boolean) => {
    const { data, error } = await supabase.functions.invoke("manage-team", {
      body: { action: "toggle_project", projectId, isActive },
    });
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: isActive ? "Project activated" : "Project suspended" });
      fetchProjects();
    }
  };

  const handleDelete = async (projectId: string) => {
    const { data, error } = await supabase.functions.invoke("manage-team", {
      body: { action: "delete_project", projectId },
    });
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Project deleted" });
      fetchProjects();
    }
  };

  const handleReset = async (projectId: string) => {
    const { data, error } = await supabase.functions.invoke("manage-team", {
      body: { action: "reset_project", projectId },
    });
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Project data reset successfully" });
      fetchProjects();
    }
  };

  const handleEditSave = async () => {
    if (!editProject) return;
    const { data, error } = await supabase.functions.invoke("manage-team", {
      body: { action: "update_project", projectId: editProject.id, businessName: editName },
    });
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Project updated" });
      setEditProject(null);
      fetchProjects();
    }
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">{project.business_name}</p>
                      <Badge variant={project.is_active ? "default" : "secondary"}>
                        {project.is_active ? "Active" : "Suspended"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Admin: {project.admin_name} ({project.admin_email})</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{project.total_users} Users</span>
                      <span className="flex items-center gap-1"><ShoppingCart className="h-3.5 w-3.5" />{project.total_orders} Orders</span>
                      <span className="text-xs">Created: {new Date(project.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <Link to={`/owner/users?project=${project.id}`}>
                      <Button variant="outline" size="sm"><Eye className="h-3.5 w-3.5 mr-1" />Users</Button>
                    </Link>
                    <Button variant="outline" size="sm" onClick={() => { setEditProject(project); setEditName(project.business_name); }}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                    </Button>
                    <Switch checked={project.is_active} onCheckedChange={(checked) => handleToggle(project.id, checked)} />
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
                          <AlertDialogAction onClick={() => handleReset(project.id)}>Reset</AlertDialogAction>
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
                          <AlertDialogAction onClick={() => handleDelete(project.id)}>Delete</AlertDialogAction>
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
              <label className="text-sm font-medium text-foreground">Business Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProject(null)}>Cancel</Button>
            <Button onClick={handleEditSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OwnerLayout>
  );
}
