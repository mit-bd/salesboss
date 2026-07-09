import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/contexts/AuditLogContext";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Database,
  Download,
  FileArchive,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldAlert,
  Info,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import JSZip from "jszip";

type JobStatus = "preparing" | "processing" | "completed" | "failed";

type ExportJob = {
  id: string;
  startedAt: string;
  finishedAt?: string;
  status: JobStatus;
  triggeredBy: string;
  recordCount: number;
  sizeBytes: number;
  filename?: string;
  blobUrl?: string;
  error?: string;
};

// Tenant-scoped business tables that RLS filters by project_id / assignment.
// Sensitive auth data (auth.users, secrets, tokens) is intentionally excluded.
// `profiles` is fetched with a whitelisted column set to guarantee no password
// or credential fields are ever exported, even if the schema changes.
const BUSINESS_TABLES = [
  "customers",
  "orders",
  "followup_history",
  "upsell_records",
  "repeat_order_records",
  "products",
  "order_sources",
  "delivery_methods",
  "followup_problems",
  "followup_quick_info_fields",
  "order_activity_logs",
  "commission_configs",
  "commission_entries",
  "sales_targets",
  "user_roles",
  "role_permissions",
  "permissions",
] as const;

const PROFILE_COLUMNS = "user_id, full_name, phone, project_id, created_at, updated_at";

const PAGE_SIZE = 1000;

async function fetchAllRows(
  table: string,
  columns = "*",
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let from = 0;
  // Batch-paginate to safely handle large tenants without a 1k cap.
  while (true) {
    const { data, error } = await supabase
      .from(table as never)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const batch = (data ?? []) as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce<Set<string>>((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set()),
  );
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function BackupCenterPage() {
  const { role, user, profile } = useAuth();
  const { addLog } = useAuditLog();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [running, setRunning] = useState(false);

  const authorized = role === "owner" || role === "admin" || role === "sub_admin";

  if (!authorized) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Access restricted. Backup & Recovery Center is available to Owner, Admin, and Sub Admin only.
        </div>
      </AppLayout>
    );
  }

  const updateJob = (id: string, patch: Partial<ExportJob>) =>
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));

  const runExport = async () => {
    const id = `job-${Date.now()}`;
    const startedAt = new Date().toISOString();
    const triggeredBy = profile?.full_name || user?.email || "Unknown";

    setRunning(true);
    setJobs((prev) => [
      {
        id,
        startedAt,
        status: "preparing",
        triggeredBy,
        recordCount: 0,
        sizeBytes: 0,
      },
      ...prev,
    ]);

    try {
      updateJob(id, { status: "processing" });
      const zip = new JSZip();
      let total = 0;

      // Profiles with whitelisted columns only — never export credentials.
      const profiles = await fetchAllRows("profiles", PROFILE_COLUMNS);
      total += profiles.length;
      zip.file("profiles.csv", toCSV(profiles));

      for (const table of BUSINESS_TABLES) {
        const rows = await fetchAllRows(table);
        total += rows.length;
        zip.file(`${table}.csv`, toCSV(rows));
      }

      const manifest = {
        generatedAt: new Date().toISOString(),
        generatedBy: triggeredBy,
        projectId: profile?.project_id ?? null,
        type: "application_data_export",
        note:
          "This archive is an application-level data export, not a full database backup. It does not include auth users, passwords, secrets, or storage objects. Full database backups and point-in-time recovery are handled by the managed database provider.",
        tables: ["profiles", ...BUSINESS_TABLES],
        totalRows: total,
      };
      zip.file("MANIFEST.json", JSON.stringify(manifest, null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      const blobUrl = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `salesboss_data_export_${dateStr}.zip`;

      // Auto-download the artifact immediately so the user has the file.
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      link.click();

      updateJob(id, {
        status: "completed",
        finishedAt: new Date().toISOString(),
        recordCount: total,
        sizeBytes: blob.size,
        blobUrl,
        filename,
      });

      addLog({
        actionType: "Data Export Completed",
        userName: triggeredBy,
        role: role || "admin",
        entity: "Backup Center",
        details: `Application data export generated (${total} rows, ${formatBytes(blob.size)})`,
      });

      toast({
        title: "Export Completed",
        description: `${total} rows packaged (${formatBytes(blob.size)}).`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      updateJob(id, {
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: message,
      });
      toast({
        title: "Export Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const redownload = (job: ExportJob) => {
    if (!job.blobUrl || !job.filename) return;
    const link = document.createElement("a");
    link.href = job.blobUrl;
    link.download = job.filename;
    link.click();
  };

  const statusBadge = (status: JobStatus) => {
    switch (status) {
      case "preparing":
        return (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 text-xs text-info">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Completed
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 text-xs text-destructive">
            <XCircle className="h-3.5 w-3.5" /> Failed
          </span>
        );
    }
  };

  const lastCompleted = jobs.find((j) => j.status === "completed");

  return (
    <AppLayout>
      <PageHeader
        title="Backup & Recovery Center"
        description="Application data exports and managed database backup status"
      >
        <Button size="sm" onClick={runExport} disabled={running} className="gap-1.5">
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileArchive className="h-3.5 w-3.5" />
          )}
          Generate Data Export
        </Button>
      </PageHeader>

      {/* Truthful status cards */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
        <div className="rounded-xl border border-border bg-card p-4 card-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Application Data Export
              </p>
              <p className="mt-1 text-sm font-semibold text-card-foreground">
                {lastCompleted
                  ? `Last export: ${new Date(lastCompleted.finishedAt || lastCompleted.startedAt).toLocaleString()}`
                  : "No export generated in this session"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {lastCompleted
                  ? `${lastCompleted.recordCount.toLocaleString()} rows · ${formatBytes(lastCompleted.sizeBytes)}`
                  : "Generate one to produce a downloadable ZIP archive."}
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <FileArchive className="h-4 w-4 text-primary" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 card-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Managed Database Backup Status
              </p>
              <p className="mt-1 text-sm font-semibold text-card-foreground">
                Configured externally
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Full-database backups and point-in-time recovery are provided by the
                managed database provider and are not exposed to the application. Verify
                the backup schedule and retention with your platform administrator.
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10">
              <Database className="h-4 w-4 text-info" />
            </div>
          </div>
        </div>
      </div>

      {/* What's included */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4 card-shadow animate-fade-in">
        <div className="flex items-start gap-2 mb-3">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">
              What the Data Export includes
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              A ZIP archive containing one CSV per business table, plus a MANIFEST.json.
              Rows are fetched in {PAGE_SIZE.toLocaleString()}-row pages and are scoped
              to your project by database security policies.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["profiles", ...BUSINESS_TABLES].map((t) => (
            <Badge key={t} variant="secondary" className="text-[11px]">
              {t}
            </Badge>
          ))}
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/50 p-3">
          <ShieldAlert className="h-4 w-4 text-muted-foreground mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Passwords, auth tokens, service-role keys, and other platform credentials are
            never included in the export.
          </p>
        </div>
      </div>

      {/* Restore reality check */}
      <div className="mb-6 rounded-xl border border-warning/40 bg-warning/5 p-4 card-shadow animate-fade-in">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Restore is not available in-app
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              A one-click restore is intentionally disabled — importing a raw CSV archive
              without transactional validation can corrupt live data. To recover data:
            </p>
            <ol className="list-decimal ml-5 mt-2 space-y-1 text-xs text-muted-foreground">
              <li>Use the managed database provider's point-in-time recovery for full restores.</li>
              <li>For targeted recovery, contact your platform administrator with the exported archive and the affected table/rows.</li>
              <li>Ad-hoc CSV imports must be reviewed and performed by an administrator against a staging environment first.</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Job history */}
      <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <p className="text-sm font-medium text-foreground">Export History (this session)</p>
          <p className="text-xs text-muted-foreground">
            Persistent history is not stored — download artifacts immediately.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Finished</TableHead>
              <TableHead>Triggered By</TableHead>
              <TableHead className="text-right">Rows</TableHead>
              <TableHead className="text-right">Size</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">
                  No exports generated yet.
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>{statusBadge(job.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(job.startedAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {job.finishedAt ? new Date(job.finishedAt).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {job.triggeredBy}
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium">
                    {job.status === "completed" ? job.recordCount.toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {job.status === "completed" ? formatBytes(job.sizeBytes) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {job.status === "completed" && job.blobUrl ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 text-xs"
                        onClick={() => redownload(job)}
                      >
                        <Download className="h-3 w-3" /> Download
                      </Button>
                    ) : job.status === "failed" ? (
                      <span className="text-xs text-destructive" title={job.error}>
                        {job.error?.slice(0, 40) || "Failed"}
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
