import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useRole } from "@/contexts/RoleContext";
import { useAuditLog } from "@/contexts/AuditLogContext";
import { mockBackups } from "@/data/mockData";
import { BackupEntry } from "@/types/data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Database, Download, RefreshCw, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function BackupCenterPage() {
  const { isAdmin } = useRole();
  const { addLog } = useAuditLog();
  const { toast } = useToast();
  const [backups, setBackups] = useState<BackupEntry[]>(mockBackups);
  const [isRunning, setIsRunning] = useState(false);

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Access restricted to Admin only.
        </div>
      </AppLayout>
    );
  }

  const handleManualBackup = () => {
    setIsRunning(true);
    const newBackup: BackupEntry = {
      id: `bk-${Date.now()}`,
      date: new Date().toISOString(),
      triggerType: "manual",
      triggeredBy: "Admin User",
      status: "in_progress",
      recordCount: 0,
      size: "0 B",
    };
    setBackups((prev) => [newBackup, ...prev]);

    setTimeout(() => {
      setBackups((prev) =>
        prev.map((b) =>
          b.id === newBackup.id
            ? { ...b, status: "completed" as const, recordCount: 158, size: "2.5 MB" }
            : b
        )
      );
      setIsRunning(false);
      addLog({
        actionType: "Manual Backup Created",
        userName: "Admin User",
        role: "admin",
        entity: "Backup Center",
        details: "Manual backup snapshot completed successfully",
      });
      toast({ title: "Backup Complete", description: "Manual backup created successfully." });
    }, 2500);
  };

  const handleDownload = (backup: BackupEntry) => {
    toast({ title: "Download Started", description: `Downloading backup from ${new Date(backup.date).toLocaleDateString()}.` });
  };

  const statusIcon = (status: BackupEntry["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "in_progress":
        return <Loader2 className="h-4 w-4 text-info animate-spin" />;
    }
  };

  const completedCount = backups.filter((b) => b.status === "completed").length;
  const lastBackup = backups.find((b) => b.status === "completed");

  return (
    <AppLayout>
      <PageHeader title="Backup Center" description="Automated daily backups and manual snapshots">
        <Button size="sm" onClick={handleManualBackup} disabled={isRunning} className="gap-1.5">
          {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Backup Now
        </Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
        <div className="rounded-xl border border-border bg-card p-4 card-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Backups</p>
              <p className="mt-1 text-xl font-bold text-card-foreground">{completedCount}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Database className="h-4 w-4 text-primary" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 card-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Last Backup</p>
              <p className="mt-1 text-sm font-semibold text-card-foreground">
                {lastBackup ? new Date(lastBackup.date).toLocaleString() : "None"}
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "hsl(var(--success) / 0.1)" }}>
              <Clock className="h-4 w-4 text-success" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 card-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Schedule</p>
              <p className="mt-1 text-sm font-semibold text-card-foreground">Daily at 6:00 AM</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "hsl(var(--info) / 0.1)" }}>
              <RefreshCw className="h-4 w-4 text-info" />
            </div>
          </div>
        </div>
      </div>

      {/* Backup includes info */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4 card-shadow animate-fade-in">
        <p className="text-xs font-medium text-muted-foreground mb-2">Backup includes</p>
        <div className="flex flex-wrap gap-2">
          {["Orders & Child Orders", "Products", "Users", "Followup Data", "Commission Data"].map((item) => (
            <Badge key={item} variant="secondary" className="text-xs">{item}</Badge>
          ))}
        </div>
      </div>

      {/* Backup history table */}
      <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden animate-fade-in">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Status</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Triggered By</TableHead>
              <TableHead className="text-right">Records</TableHead>
              <TableHead className="text-right">Size</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {backups.map((backup) => (
              <TableRow key={backup.id}>
                <TableCell>{statusIcon(backup.status)}</TableCell>
                <TableCell className="font-medium text-foreground">
                  {new Date(backup.date).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant={backup.triggerType === "manual" ? "default" : "secondary"} className="text-[11px]">
                    {backup.triggerType === "auto" ? "Scheduled" : "Manual"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{backup.triggeredBy}</TableCell>
                <TableCell className="text-right font-medium">{backup.recordCount}</TableCell>
                <TableCell className="text-right text-muted-foreground">{backup.size}</TableCell>
                <TableCell className="text-right">
                  {backup.status === "completed" && (
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => handleDownload(backup)}>
                      <Download className="h-3 w-3" /> Download
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
