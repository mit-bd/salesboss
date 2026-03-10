import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, LogIn, ShieldCheck, FolderKanban, UserCog, ClipboardCheck } from "lucide-react";
import OwnerLayout from "@/components/owner/OwnerLayout";

interface LogItem {
  id: string;
  type: string;
  action: string;
  userId: string | null;
  userName: string;
  userEmail: string;
  projectId: string | null;
  projectName: string;
  timestamp: string;
}

interface ProjectRef {
  id: string;
  business_name: string;
}

const typeIcons: Record<string, typeof LogIn> = {
  login: LogIn,
  role: ShieldCheck,
  project: FolderKanban,
  order: UserCog,
  followup: ClipboardCheck,
};

const typeColors: Record<string, string> = {
  login: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  role: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  project: "bg-green-500/10 text-green-500 border-green-500/20",
  order: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  followup: "bg-teal-500/10 text-teal-500 border-teal-500/20",
};

export default function OwnerSystemLogsPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase.functions.invoke("manage-team", {
      body: { action: "owner_system_logs" },
    });
    if (data?.logs) setLogs(data.logs);
    if (data?.projects) setProjects(data.projects);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter((log) => {
    if (filterType !== "all" && log.type !== filterType) return false;
    if (filterProject !== "all" && log.projectId !== filterProject) return false;
    if (dateFrom) {
      const logDate = new Date(log.timestamp).toISOString().split("T")[0];
      if (logDate < dateFrom) return false;
    }
    if (dateTo) {
      const logDate = new Date(log.timestamp).toISOString().split("T")[0];
      if (logDate > dateTo) return false;
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return log.userName.toLowerCase().includes(term) || log.userEmail.toLowerCase().includes(term) || log.action.toLowerCase().includes(term);
    }
    return true;
  });

  return (
    <OwnerLayout title="System Logs" subtitle="Track platform activity and changes">
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <Input placeholder="Search logs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-xs" />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="login">User Login</SelectItem>
            <SelectItem value="order">Order Changes</SelectItem>
            <SelectItem value="project">Project Actions</SelectItem>
            <SelectItem value="role">Role Changes</SelectItem>
            <SelectItem value="followup">Followups</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.business_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2 items-center">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[140px]" placeholder="From" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[140px]" placeholder="To" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No logs found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => {
            const Icon = typeIcons[log.type] || UserCog;
            return (
              <Card key={log.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="shrink-0">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${typeColors[log.type] || "bg-muted"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">{log.action}</p>
                        <Badge variant="outline" className={typeColors[log.type] || ""}>{log.type}</Badge>
                        {log.projectName && (
                          <Badge variant="secondary" className="text-xs">{log.projectName}</Badge>
                        )}
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{log.userName}</span>
                        {log.userEmail && <span>{log.userEmail}</span>}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </OwnerLayout>
  );
}
