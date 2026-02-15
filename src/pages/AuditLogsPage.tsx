import { useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useAuditLog } from "@/contexts/AuditLogContext";
import { useRole } from "@/contexts/RoleContext";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";

const ACTION_TYPES = [
  "Order Created",
  "Order Edited",
  "Order Soft Deleted",
  "Order Restored",
  "Order Permanently Deleted",
  "Followup Completed",
  "Repeat Order Created",
  "Product Added",
  "Product Edited",
  "Team Member Added",
  "Team Member Edited",
  "Profile Updated",
  "Role Changed",
];

const actionColors: Record<string, string> = {
  "Order Created": "bg-success/10 text-success",
  "Order Edited": "bg-info/10 text-info",
  "Order Soft Deleted": "bg-warning/10 text-warning",
  "Order Restored": "bg-primary/10 text-primary",
  "Order Permanently Deleted": "bg-destructive/10 text-destructive",
};

export default function AuditLogsPage() {
  const { logs } = useAuditLog();
  const { isAdmin } = useRole();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("");

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (dateFrom && log.timestamp < dateFrom) return false;
      if (dateTo && log.timestamp < dateTo) return false;
      if (actionFilter !== "all" && log.actionType !== actionFilter) return false;
      if (userFilter && !log.userName.toLowerCase().includes(userFilter.toLowerCase())) return false;
      return true;
    });
  }, [logs, dateFrom, dateTo, actionFilter, userFilter]);

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Access restricted to Admin only.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title="Audit Logs" description="Immutable system activity log">
        <div className="flex items-center gap-1.5">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{logs.length} entries</span>
        </div>
      </PageHeader>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 card-shadow animate-fade-in">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-40 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-40 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Action Type</label>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-9 w-48 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {ACTION_TYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">User</label>
          <Input value={userFilter} onChange={(e) => setUserFilter(e.target.value)} placeholder="Search user..." className="h-9 w-40 text-sm" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden animate-fade-in">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Action</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  <Badge variant="secondary" className={actionColors[log.actionType] || "bg-muted text-muted-foreground"}>
                    {log.actionType}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium text-foreground">{log.userName}</TableCell>
                <TableCell className="text-xs text-muted-foreground capitalize">{log.role}</TableCell>
                <TableCell className="font-medium text-foreground">{log.entity}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{log.details || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No audit logs yet. Actions will appear here as you use the system.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
