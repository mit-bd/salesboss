import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, LogOut } from "lucide-react";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { Link } from "react-router-dom";

interface Project {
  id: string;
  business_name: string;
  owner_user_id: string;
  is_active: boolean;
  created_at: string;
}

export default function OwnerProjectsPage() {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    const { data } = await supabase.functions.invoke("manage-team", {
      body: { action: "list_projects" },
    });
    if (data?.projects) setProjects(data.projects);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Projects</h1>
            <p className="text-sm text-muted-foreground">Manage all registered business projects</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex gap-3">
          <Link to="/owner">
            <Button variant="outline" size="sm">Dashboard</Button>
          </Link>
          <Link to="/owner/requests">
            <Button variant="outline" size="sm">Registration Requests</Button>
          </Link>
          <Link to="/owner/projects">
            <Button variant="default" size="sm">Projects</Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : projects.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No projects created yet.</p>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <Card key={project.id}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{project.business_name}</p>
                        <Badge variant={project.is_active ? "default" : "secondary"}>
                          {project.is_active ? "Active" : "Suspended"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(project.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Switch
                      checked={project.is_active}
                      onCheckedChange={(checked) => handleToggle(project.id, checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
