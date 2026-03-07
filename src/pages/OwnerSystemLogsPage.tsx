import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, LogIn, ShieldCheck, FolderKanban, UserCog } from "lucide-react";
import OwnerLayout from "@/components/owner/OwnerLayout";

interface LogItem {
  id: string;
  type: string;
  action: string;
  userId: string | null;
  userName: string;
  userEmail: string;
  projectId: string | null;
  timestamp: string;
}

const typeIcons: Record<string, typeof LogIn> = {
  login: LogIn,
  role: ShieldCheck,
  project: FolderKanban,
  order: UserCog,
};

const typeColors: Record<string, string> = {
  login: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  role: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  project: "bg-green-500/10 text-green-500 border-green-500/20",
  order: "bg-orange-500/10 text-orange-500 border-orange-500/20",
};

export default function OwnerSystemLogsPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase.functions.invoke("manage-team", {
      body: { action: "owner_system_logs" },
    });
    if (data?.logs) setLogs(data.logs);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter((log) => {
    if (filterType && filterType !== "all" && log.type !== filterType) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return log.userName.toLowerCase().includes(term) || log.userEmail.toLowerCase().includes(term) || log.action.toLowerCase().includes(term);
    }
    return true;
  });

  return (
    <OwnerLayout title="System Logs" subtitle="Track platform activity and changes">
      <div className="flex flex-col sm:flex-row gap-3">
        <Input placeholder="Search logs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-xs" />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="login">User Login</SelectItem>
            <SelectItem value="order">Order Changes</SelectItem>
            <SelectItem value="project">Project Actions</SelectItem>
            <SelectItem value="role">Role Changes</SelectItem>
          </SelectContent>
        </Select>
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
