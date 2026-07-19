import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Loader2, Sparkles, Wand2, AlertTriangle, ArrowRight, ArrowLeft, Save, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useDeliveryMethods } from "@/hooks/useDeliveryMethods";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { useImportTemplates } from "@/hooks/useImportTemplates";
import { useActivityLog } from "@/hooks/useActivityLog";
import WarningCenter, { type ImportWarningLite } from "@/components/import/WarningCenter";
import HealthScorePanel, { type HealthScore, type Recommendation } from "@/components/import/HealthScorePanel";
import ResumeBanner from "@/components/import/ResumeBanner";
import ImportLiveDashboard from "@/components/import/ImportLiveDashboard";
import CustomerPreviewPanel from "@/components/import/CustomerPreviewPanel";
import DuplicateGroupsReview, { type DupAction, type DupDecisionState, type DuplicateGroup } from "@/components/import/DuplicateGroupsReview";


// ---------- Canonical fields ----------
const CANONICAL: { key: string; label: string; required: boolean }[] = [
  { key: "externalOrderId", label: "Order ID", required: true },
  { key: "recipientName", label: "Recipient Name", required: true },
  { key: "recipientPhone", label: "Recipient Phone", required: true },
  { key: "recipientAddress", label: "Recipient Address", required: true },
  { key: "codAmount", label: "COD Amount", required: true },
  { key: "trackingCode", label: "Tracking Code", required: false },
  { key: "invoiceNo", label: "Invoice", required: false },
  { key: "deliveryStatus", label: "Delivery Status", required: false },
  { key: "approvalStatus", label: "Approval Status", required: false },
  { key: "deliveryTime", label: "Delivery Time", required: false },
  { key: "riderName", label: "Rider", required: false },
  { key: "riderPhone", label: "Rider Phone", required: false },
  { key: "shippingCharge", label: "Shipping Charge", required: false },
  { key: "codCharge", label: "COD Charge", required: false },
  { key: "paymentStatus", label: "Payment Status", required: false },
  { key: "note", label: "Note", required: false },
  { key: "product", label: "Product", required: false },
  { key: "orderDate", label: "Order Date", required: false },
  { key: "deliveryDate", label: "Delivery Date", required: false },
  { key: "deliveryMethod", label: "Delivery Method", required: false },
  { key: "orderSource", label: "Order Source", required: false },
  { key: "itemDescription", label: "Item Description", required: false },
];
const REQUIRED_KEYS = CANONICAL.filter((c) => c.required).map((c) => c.key);

type Mapping = Record<string, string>; // canonicalKey -> sourceHeader
type RawRow = Record<string, string>;
interface CleanedRow {
  rowNumber: number;
  externalOrderId?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  codAmount?: string;
  trackingCode?: string;
  invoiceNo?: string;
  deliveryStatus?: string;
  approvalStatus?: string;
  deliveryTime?: string;
  riderName?: string;
  riderPhone?: string;
  shippingCharge?: string;
  codCharge?: string;
  paymentStatus?: string;
  note?: string;
  product?: string;
  orderDate?: string;
  deliveryDate?: string;
  deliveryMethod?: string;
  orderSource?: string;
  itemDescription?: string;
  autoCorrected?: boolean;
  needsReview?: boolean;
  corrections?: string[];
}
type DupDecision = "update" | "skip" | "create";

type Step = "upload" | "mapping" | "clean" | "simulate" | "duplicates" | "execute" | "report";

const EMPTY_DUP_STATE: DupDecisionState = { version: 2, global: null, customers: {}, orders: {} };


// ---------- Helpers ----------
function normalizePhone(v: string): string {
  const d = (v || "").replace(/[^\d]/g, "");
  if (!d) return "";
  if (d.startsWith("880") && d.length === 13) return "0" + d.slice(3);
  if (d.startsWith("88") && d.length === 13) return "0" + d.slice(3);
  if (d.length === 10 && d.startsWith("1")) return "0" + d;
  return d;
}
function toNum(v: string | undefined): number {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/[^\d.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}
function safeDate(v: string | undefined): string | null {
  if (!v) return null;
  const t = String(v).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

// ---------- Component ----------
export default function BulkImportPage() {
  const { toast } = useToast();
  const { profile, user } = useAuth();
  const { refreshOrders } = useOrderStore();
  const { logActivity } = useActivityLog();
  const { members } = useTeamMembers();
  const { methods: activeDeliveryMethods } = useDeliveryMethods({ activeOnly: true });
  const { templates, saveTemplate, deleteTemplate, renameTemplate, bumpUsage } = useImportTemplates();

  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [importMode, setImportMode] = useState<"quick" | "ai">("quick");
  const [liveRunId, setLiveRunId] = useState<string | null>(null);
  const [queuing, setQueuing] = useState(false);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [detecting, setDetecting] = useState(false);
  const [matchedTemplate, setMatchedTemplate] = useState<any>(null);
  const [cleanedRows, setCleanedRows] = useState<CleanedRow[]>([]);
  const [aiReport, setAiReport] = useState<{ autoCorrected: number; needsReview: number; corrections: string[] } | null>(null);
  const [aiWarnings, setAiWarnings] = useState<ImportWarningLite[]>([]);
  const [aiHealth, setAiHealth] = useState<HealthScore | null>(null);
  const [aiRecommendations, setAiRecommendations] = useState<Recommendation[]>([]);
  const [resumableRuns, setResumableRuns] = useState<any[]>([]);
  const [cleaning, setCleaning] = useState(false);

  const [assignToExec, setAssignToExec] = useState("");
  const [assignDeliveryMethod, setAssignDeliveryMethod] = useState("");

  // duplicates
  const [existingByExtId, setExistingByExtId] = useState<Record<string, any>>({});
  const [dupDecisions, setDupDecisions] = useState<Record<string, DupDecision>>({});
  const [confirmCreateFor, setConfirmCreateFor] = useState<string | null>(null);
  const [dupGroups, setDupGroups] = useState<DuplicateGroup[]>([]);
  const [dupState, setDupState] = useState<DupDecisionState>(EMPTY_DUP_STATE);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMobile, setPreviewMobile] = useState<string | null>(null);
  const [previewCustomerId, setPreviewCustomerId] = useState<string | null>(null);


  // execute
  const [executing, setExecuting] = useState(false);
  const [execStage, setExecStage] = useState("");
  const [execProgress, setExecProgress] = useState({ current: 0, total: 0 });

  // report
  const [finalReport, setFinalReport] = useState<any>(null);

  // template save dialog
  const [saveTplOpen, setSaveTplOpen] = useState(false);
  const [tplName, setTplName] = useState("");

  const allExecutives = members.map((m) => ({ id: m.userId, name: m.name }));

  // ---------------- File load ----------------
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
      if (!json.length) {
        toast({ title: "Empty file", description: "No rows found.", variant: "destructive" });
        return;
      }
      const headers = Object.keys(json[0]);
      const rows: RawRow[] = json.map((r) => {
        const o: RawRow = {};
        headers.forEach((h) => { o[h] = String((r as any)[h] ?? "").trim(); });
        return o;
      });
      setRawHeaders(headers);
      setRawRows(rows);
      setStep("mapping");
      await runDetect(headers);
    } catch (err: any) {
      toast({ title: "Failed to read file", description: err.message || "Unknown error", variant: "destructive" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ---------------- AI mapping detect ----------------
  const runDetect = async (headers: string[]) => {
    setDetecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-import-cleaner", {
        body: { headers, mode: "detect" },
      });
      if (error) throw error;
      const m: Mapping = (data?.mapping || {}) as Mapping;
      setMapping(m);
      setMatchedTemplate(data?.matchedTemplate || null);
    } catch (err: any) {
      console.error(err);
      // Best-effort local mapping fallback
      const guess: Mapping = {};
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const table: Record<string, string[]> = {
        externalOrderId: ["orderid", "orderno", "consignmentid", "trackingid", "invoice"],
        recipientName: ["customername", "recipient", "receiver", "customer", "client", "name"],
        recipientPhone: ["phone", "mobile", "contact", "customerphone", "recipientphone"],
        recipientAddress: ["address", "recipientaddress"],
        codAmount: ["cod", "amount", "codamount", "total", "cash"],
        trackingCode: ["trackingcode", "trackingnumber"],
        deliveryStatus: ["status", "deliverystatus"],
        product: ["product", "item"],
        note: ["note", "notes", "remark"],
        orderDate: ["orderdate", "date"],
      };
      for (const h of headers) {
        const n = norm(h);
        for (const [k, aliases] of Object.entries(table)) {
          if (!guess[k] && aliases.includes(n)) guess[k] = h;
        }
      }
      setMapping(guess);
    } finally {
      setDetecting(false);
    }
  };

  const applyTemplate = (tpl: any) => {
    // remap template's canonical->header if header exists in this file
    const m: Mapping = {};
    for (const [k, v] of Object.entries(tpl.mapping || {})) {
      if (typeof v === "string" && rawHeaders.includes(v)) m[k] = v;
    }
    setMapping(m);
    bumpUsage(tpl.id, tpl.usage_count || 0).catch(() => {});
    toast({ title: "Template applied", description: tpl.name });
  };

  // ---------------- AI clean ----------------
  const runClean = async () => {
    setCleaning(true);
    try {
      // Build mapped rows
      const rowsForAi = rawRows.map((r, i) => {
        const o: any = { rowNumber: i + 2 };
        for (const [k, h] of Object.entries(mapping)) o[k] = r[h] || "";
        return o;
      });

      // Chunk client-side to keep each edge function call well under the 150s idle timeout.
      const CHUNK = 200;
      const cleanedAgg: any[] = [];
      const warningsAgg: any[] = [];
      let autoCorrected = 0;
      let needsReview = 0;
      const correctionsAgg: string[] = [];
      let lastHealth: HealthScore | null = null;
      let lastRecs: Recommendation[] = [];

      for (let i = 0; i < rowsForAi.length; i += CHUNK) {
        const slice = rowsForAi.slice(i, i + CHUNK);
        const { data, error } = await supabase.functions.invoke("ai-import-cleaner", {
          body: { headers: rawHeaders, rows: slice, mode: "clean" },
        });
        if (error) throw error;
        cleanedAgg.push(...(data?.cleanedRows || []));
        warningsAgg.push(...(data?.warnings || []));
        autoCorrected += data?.report?.autoCorrected ?? 0;
        needsReview += data?.report?.needsReview ?? 0;
        if (Array.isArray(data?.report?.corrections)) correctionsAgg.push(...data.report.corrections);
        if (data?.health) lastHealth = data.health as HealthScore;
        if (Array.isArray(data?.recommendations)) lastRecs = data.recommendations as Recommendation[];
      }

      const cleaned: CleanedRow[] = cleanedAgg.map((r: any) => {
        if (r.recipientPhone) r.recipientPhone = normalizePhone(r.recipientPhone);
        const missing = REQUIRED_KEYS.filter((k) => !String(r[k] || "").trim());
        return { ...r, needsReview: r.needsReview || missing.length > 0 };
      });
      setCleanedRows(cleaned);
      setAiReport({
        autoCorrected,
        needsReview,
        corrections: Array.from(new Set(correctionsAgg)).slice(0, 30),
      });
      setAiWarnings(warningsAgg as ImportWarningLite[]);
      setAiHealth(lastHealth);
      setAiRecommendations(lastRecs);
      setStep("simulate");
    } catch (err: any) {
      toast({ title: "AI cleaning failed", description: err.message || "Try again", variant: "destructive" });
    } finally {
      setCleaning(false);
    }
  };


  // ---------------- Simulation ----------------
  const simulation = useMemo(() => {
    const missing = cleanedRows.filter((r) => REQUIRED_KEYS.some((k) => !String((r as any)[k] || "").trim())).length;
    const invalidPhone = cleanedRows.filter((r) => {
      const p = normalizePhone(r.recipientPhone || "");
      return !/^01\d{9}$/.test(p);
    }).length;
    const invalidCod = cleanedRows.filter((r) => r.codAmount && isNaN(parseFloat(String(r.codAmount).replace(/[^\d.\-]/g, "")))).length;
    const seen = new Set<string>();
    let dupInFile = 0;
    cleanedRows.forEach((r) => {
      const id = (r.externalOrderId || "").trim();
      if (!id) return;
      if (seen.has(id)) dupInFile++;
      else seen.add(id);
    });
    const safe = cleanedRows.length - missing;
    return { total: cleanedRows.length, safe, missing, invalidPhone, invalidCod, dupInFile };
  }, [cleanedRows]);

  const goToDuplicates = async () => {
    if (!profile?.project_id) return;
    const projectId = profile.project_id;

    // Collect keys from incoming
    const rowsByMobile = new Map<string, CleanedRow[]>();
    const rowsByExtId = new Map<string, CleanedRow>();
    const rowsByTracking = new Map<string, CleanedRow>();
    const rowsByInvoice = new Map<string, CleanedRow>();
    for (const r of cleanedRows) {
      const p = normalizePhone(r.recipientPhone || "");
      if (p) {
        const arr = rowsByMobile.get(p) || [];
        arr.push(r);
        rowsByMobile.set(p, arr);
      }
      const eid = (r.externalOrderId || "").trim();
      if (eid) rowsByExtId.set(eid, r);
      const tc = (r.trackingCode || "").trim();
      if (tc) rowsByTracking.set(tc, r);
      const inv = (r.invoiceNo || "").trim();
      if (inv) rowsByInvoice.set(inv, r);
    }

    const mobiles = Array.from(rowsByMobile.keys());
    const extIds = Array.from(rowsByExtId.keys());
    const trackings = Array.from(rowsByTracking.keys());
    const invoices = Array.from(rowsByInvoice.keys());

    // 1) Existing orders that match on any of the 4 keys (batched IN queries)
    const chunk = <T,>(arr: T[], n = 500): T[][] => {
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
      return out;
    };
    const orderCols = "id, external_order_id, customer_id, customer_name, mobile, product_title, price, order_date, delivery_status, tracking_code, invoice_no";
    const collect: any[] = [];
    for (const c of chunk(mobiles)) {
      const { data } = await supabase.from("orders").select(orderCols)
        .eq("project_id", projectId).eq("is_deleted", false).in("mobile", c);
      collect.push(...(data || []));
    }
    for (const c of chunk(extIds)) {
      const { data } = await supabase.from("orders").select(orderCols)
        .eq("project_id", projectId).eq("is_deleted", false).in("external_order_id", c);
      collect.push(...(data || []));
    }
    for (const c of chunk(trackings)) {
      const { data } = await supabase.from("orders").select(orderCols)
        .eq("project_id", projectId).eq("is_deleted", false).in("tracking_code", c);
      collect.push(...(data || []));
    }
    for (const c of chunk(invoices)) {
      const { data } = await supabase.from("orders").select(orderCols)
        .eq("project_id", projectId).eq("is_deleted", false).in("invoice_no", c);
      collect.push(...(data || []));
    }

    // dedupe by id
    const uniqueOrders = new Map<string, any>();
    for (const o of collect) uniqueOrders.set(o.id, o);

    // Group by mobile (normalized)
    const groupsMap = new Map<string, {
      customerId: string | null;
      customerName: string;
      existingOrders: any[];
      matchedOrderIds: Set<string>;
      matchedTrackingCodes: Set<string>;
      matchedInvoices: Set<string>;
    }>();

    for (const o of uniqueOrders.values()) {
      const m = normalizePhone(o.mobile || "");
      if (!m) continue;
      if (!rowsByMobile.has(m) && !rowsByExtId.has(o.external_order_id || "") &&
          !rowsByTracking.has(o.tracking_code || "") && !rowsByInvoice.has(o.invoice_no || "")) {
        continue;
      }
      let g = groupsMap.get(m);
      if (!g) {
        g = {
          customerId: o.customer_id || null,
          customerName: o.customer_name || "",
          existingOrders: [],
          matchedOrderIds: new Set(),
          matchedTrackingCodes: new Set(),
          matchedInvoices: new Set(),
        };
        groupsMap.set(m, g);
      }
      g.existingOrders.push(o);
      if (o.external_order_id && rowsByExtId.has(o.external_order_id)) g.matchedOrderIds.add(o.external_order_id);
      if (o.tracking_code && rowsByTracking.has(o.tracking_code)) g.matchedTrackingCodes.add(o.tracking_code);
      if (o.invoice_no && rowsByInvoice.has(o.invoice_no)) g.matchedInvoices.add(o.invoice_no);
    }

    // Fetch learning suggestions for these mobiles
    const suggestionByMobile = new Map<string, DupAction>();
    if (mobiles.length) {
      for (const c of chunk(mobiles)) {
        const { data } = await supabase
          .from("import_learning_suggestions")
          .select("input_value, suggested_value, confirmations")
          .eq("project_id", projectId)
          .eq("kind", "dup_action_by_mobile")
          .in("input_value", c);
        (data || []).forEach((s: any) => {
          if ((s.confirmations ?? 0) >= 1 && ["skip","update","create","merge"].includes(s.suggested_value)) {
            suggestionByMobile.set(s.input_value, s.suggested_value as DupAction);
          }
        });
      }
    }

    const groups: DuplicateGroup[] = Array.from(groupsMap.entries()).map(([mobile, g]) => {
      const incomingRows = rowsByMobile.get(mobile) || [];
      return {
        mobile,
        customerId: g.customerId,
        customerName: g.customerName,
        existingOrders: g.existingOrders.slice(0, 20),
        existingCount: g.existingOrders.length,
        incomingCount: incomingRows.length || 1,
        incomingRowNumbers: incomingRows.map((r) => r.rowNumber),
        matchedOrderIds: Array.from(g.matchedOrderIds),
        matchedTrackingCodes: Array.from(g.matchedTrackingCodes),
        matchedInvoices: Array.from(g.matchedInvoices),
        suggestedAction: suggestionByMobile.get(mobile),
      };
    }).sort((a, b) => b.incomingCount - a.incomingCount);

    // Legacy map: extId -> existing (still used by the AI/simulate inline path)
    const legacyMap: Record<string, any> = {};
    const legacyDec: Record<string, DupDecision> = {};
    for (const o of uniqueOrders.values()) {
      if (o.external_order_id) {
        legacyMap[o.external_order_id] = o;
        legacyDec[o.external_order_id] = "update";
      }
    }
    setExistingByExtId(legacyMap);
    setDupDecisions(legacyDec);
    setDupGroups(groups);
    setDupState(EMPTY_DUP_STATE);

    if (groups.length === 0) { setStep("execute"); return; }
    setStep("duplicates");
  };


  // ---------------- Queued (background) import ----------------
  const runQueuedImport = async () => {
    if (!profile?.project_id || !user) return;
    setQueuing(true);
    try {
      // Build mapped, phone-normalized rows
      const mapped = rawRows.map((r, i) => {
        const o: any = { rowNumber: i + 2 };
        for (const [k, h] of Object.entries(mapping)) o[k] = r[h] || "";
        if (o.recipientPhone) o.recipientPhone = normalizePhone(o.recipientPhone);
        return o;
      });

      const execName = assignToExec && assignToExec !== "__none__"
        ? allExecutives.find((e) => e.id === assignToExec)?.name || ""
        : "";
      const dmName = (assignDeliveryMethod && assignDeliveryMethod !== "__none__")
        ? activeDeliveryMethods.find((dm) => dm.id === assignDeliveryMethod)?.name || ""
        : "";

      const CHUNK = 300;
      const total = mapped.length;
      const batchCount = Math.max(1, Math.ceil(total / CHUNK));

      // 1) Create import_run first (so we have an id for file paths)
      const { data: runRow, error: rErr } = await supabase.from("import_runs").insert({
        project_id: profile.project_id,
        user_id: user.id,
        user_name: profile.full_name || user.email || "",
        source_filename: fileName,
        total_rows: total,
        total_batches: batchCount,
        processed_batches: 0,
        import_mode: importMode,
        chunk_size: CHUNK,
        mapping,
        duplicate_decisions: dupGroups.length ? (dupState as any) : dupDecisions,
        assignments: {
          assigned_to: (assignToExec && assignToExec !== "__none__") ? assignToExec : null,
          assigned_to_name: execName,
          delivery_method: dmName,
        },
        status: "processing",
      }).select("id").single();
      if (rErr) throw rErr;
      const runId = runRow!.id as string;

      // 2) Upload each chunk as JSONL to storage
      for (let i = 0; i < batchCount; i++) {
        const slice = mapped.slice(i * CHUNK, (i + 1) * CHUNK);
        const jsonl = slice.map((r) => JSON.stringify(r)).join("\n");
        const path = `${profile.project_id}/${runId}/batch-${String(i).padStart(5, "0")}.jsonl`;
        const { error: upErr } = await supabase.storage
          .from("import-uploads")
          .upload(path, new Blob([jsonl], { type: "application/x-ndjson" }), { upsert: true });
        if (upErr) throw upErr;
        // Insert queue row with payload_ref pointing at this file
        const { error: qErr } = await supabase.from("import_queue").insert({
          import_run_id: runId,
          project_id: profile.project_id,
          batch_index: i,
          total_batches: batchCount,
          payload_ref: path,
          status: "queued",
          import_mode: importMode,
        });
        if (qErr) throw qErr;
        // Mirror batches metadata
        await supabase.from("import_batches").insert({
          import_run_id: runId,
          project_id: profile.project_id,
          batch_index: i,
          row_start: i * CHUNK,
          row_end: Math.min((i + 1) * CHUNK, total),
          status: "pending",
        }).then(() => {}, () => {});
      }

      // 2b) Audit each duplicate-group decision + upsert learning suggestions
      if (dupGroups.length) {
        const auditRows: any[] = [];
        const learnRows: any[] = [];
        for (const g of dupGroups) {
          const action = dupState.customers[g.mobile] || g.suggestedAction || dupState.global || "update";
          const caseType =
            g.matchedOrderIds.length > 0 ? "same_order_id" :
            g.matchedTrackingCodes.length > 0 ? "same_tracking" :
            g.matchedInvoices.length > 0 ? "same_invoice" : "same_mobile";
          auditRows.push({
            project_id: profile.project_id,
            action,
            case_type: caseType,
            existing_order_id: g.existingOrders[0]?.id ?? null,
            canonical_customer_id: g.customerId,
            actor_user_id: user.id,
            actor_name: profile.full_name || user.email || "",
            reason: `Bulk import decision (${g.incomingCount} incoming vs ${g.existingCount} existing)`,
            details: {
              import_run_id: runId,
              mobile: g.mobile,
              matched_order_ids: g.matchedOrderIds,
              matched_tracking: g.matchedTrackingCodes,
              matched_invoices: g.matchedInvoices,
            },
          });
          learnRows.push({
            project_id: profile.project_id,
            kind: "dup_action_by_mobile",
            input_value: g.mobile,
            suggested_value: action,
            confirmations: 1,
            status: "active",
            last_seen_at: new Date().toISOString(),
          });
        }
        // Fire-and-forget: audit + learning should not block the queue kickoff.
        if (auditRows.length) supabase.from("duplicate_audit_log").insert(auditRows).then(() => {}, () => {});
        for (const l of learnRows) {
          supabase.from("import_learning_suggestions")
            .upsert(l, { onConflict: "project_id,kind,input_value" })
            .then(() => {}, () => {});
        }
      }


      // 3) Kick worker (fire-and-forget: worker runs up to 40s and self-invokes to drain the queue).
      // Awaiting here would block the UI and can surface as "Failed to send a request to the Edge Function"
      // when the response exceeds the browser fetch window. Queueing is already complete at this point.
      supabase.functions.invoke("import-worker", { body: {} }).catch(() => {});


      setLiveRunId(runId);
      setStep("execute");
      toast({ title: "Import queued", description: `${total} rows split into ${batchCount} background chunks.` });
    } catch (err: any) {
      toast({ title: "Failed to queue import", description: err.message || "Unknown error", variant: "destructive" });
    } finally {
      setQueuing(false);
    }
  };

  // ---------------- Execute (legacy inline path) ----------------
  const runImport = async () => {
    if (!profile?.project_id || !user) return;
    setExecuting(true);
    setStep("execute");
    setExecStage("Preparing...");
    const t0 = performance.now();

    const execName = assignToExec && assignToExec !== "__none__"
      ? allExecutives.find((e) => e.id === assignToExec)?.name || ""
      : "";
    const dmName = (assignDeliveryMethod && assignDeliveryMethod !== "__none__")
      ? activeDeliveryMethods.find((dm) => dm.id === assignDeliveryMethod)?.name || ""
      : "";

    // Filter rejectable rows
    const rejects: Array<{ rowNumber: number; reason: string }> = [];
    const eligible: CleanedRow[] = [];
    for (const r of cleanedRows) {
      const missing = REQUIRED_KEYS.filter((k) => !String((r as any)[k] || "").trim());
      if (missing.length) {
        rejects.push({ rowNumber: r.rowNumber, reason: `Missing: ${missing.join(", ")}` });
        continue;
      }
      const phone = normalizePhone(r.recipientPhone || "");
      if (!/^01\d{9}$/.test(phone)) {
        rejects.push({ rowNumber: r.rowNumber, reason: "Invalid phone" });
        continue;
      }
      r.recipientPhone = phone;
      eligible.push(r);
    }

    // Duplicate handling
    setExecStage("Checking duplicates...");
    const toUpdate: CleanedRow[] = [];
    const toInsert: CleanedRow[] = [];
    const skipped: number[] = [];
    for (const r of eligible) {
      const id = (r.externalOrderId || "").trim();
      if (id && existingByExtId[id]) {
        const dec = dupDecisions[id] || "update";
        if (dec === "skip") { skipped.push(r.rowNumber); continue; }
        if (dec === "update") { toUpdate.push(r); continue; }
        toInsert.push(r); // create anyway
      } else {
        toInsert.push(r);
      }
    }

    let inserted = 0, updatedCount = 0, failed = 0, newCustomers = 0, existingCustomers = 0, repeatOrders = 0;
    const failures: Array<{ rowNumber: number; error: string }> = [];

    setExecStage("Creating orders...");
    setExecProgress({ current: 0, total: toInsert.length + toUpdate.length });

    // Track which customers existed before (to distinguish new vs existing).
    const existingCustomerMobiles = new Set<string>();
    if (toInsert.length) {
      const phones = Array.from(new Set(toInsert.map((r) => r.recipientPhone!).filter(Boolean)));
      const { data: existCust } = await supabase
        .from("customers").select("mobile_number,total_orders")
        .eq("project_id", profile.project_id)
        .in("mobile_number", phones as any);
      (existCust || []).forEach((c: any) => existingCustomerMobiles.add(c.mobile_number));
    }

    // INSERT batches
    const BATCH = 100;
    for (let start = 0; start < toInsert.length; start += BATCH) {
      const batch = toInsert.slice(start, start + BATCH);
      await Promise.all(batch.map(async (r) => {
        try {
          const { data: customerId, error: cerr } = await supabase.rpc("find_or_create_customer", {
            p_name: r.recipientName!,
            p_mobile: r.recipientPhone!,
            p_address: r.recipientAddress!,
            p_project_id: profile.project_id,
          });
          if (cerr) throw new Error(`Customer: ${cerr.message}`);
          const isExisting = existingCustomerMobiles.has(r.recipientPhone!);
          if (isExisting) { existingCustomers++; repeatOrders++; }
          else { newCustomers++; existingCustomerMobiles.add(r.recipientPhone!); }

          const { error: ierr } = await supabase.from("orders").insert({
            customer_name: r.recipientName!,
            recipient_name: r.recipientName!,
            mobile: r.recipientPhone!,
            address: r.recipientAddress!,
            order_source: r.orderSource?.trim() || "Import",
            product_title: r.product?.trim() || "",
            price: toNum(r.codAmount),
            order_date: safeDate(r.orderDate) || new Date().toISOString().slice(0, 10),
            delivery_date: safeDate(r.deliveryDate),
            delivery_method: dmName || r.deliveryMethod?.trim() || "",
            item_description: r.itemDescription?.trim() || "",
            note: r.note?.trim() || "",
            customer_id: customerId,
            project_id: profile.project_id,
            created_by: user.id,
            assigned_to: (assignToExec && assignToExec !== "__none__") ? assignToExec : null,
            assigned_to_name: execName,
            current_status: "pending",
            followup_step: 1,
            external_order_id: (r.externalOrderId || "").trim() || null,
            tracking_code: r.trackingCode?.trim() || null,
            invoice_no: r.invoiceNo?.trim() || null,
            delivery_status: r.deliveryStatus?.trim() || null,
            approval_status: r.approvalStatus?.trim() || null,
            delivery_time: r.deliveryTime?.trim() || null,
            rider_name: r.riderName?.trim() || null,
            rider_phone: r.riderPhone?.trim() || null,
            shipping_charge: toNum(r.shippingCharge),
            cod_charge: toNum(r.codCharge),
            payment_status: r.paymentStatus?.trim() || null,
          });
          if (ierr) throw new Error(ierr.message);
          inserted++;
        } catch (e: any) {
          failed++;
          failures.push({ rowNumber: r.rowNumber, error: e.message || "Unknown" });
        }
      }));
      setExecProgress({ current: Math.min(start + BATCH, toInsert.length), total: toInsert.length + toUpdate.length });
    }

    // UPDATE existing orders
    if (toUpdate.length) setExecStage("Updating existing orders...");
    for (const r of toUpdate) {
      try {
        const existing = existingByExtId[(r.externalOrderId || "").trim()];
        if (!existing) continue;
        const patch: Record<string, unknown> = {
          product_title: r.product?.trim() || undefined,
          price: r.codAmount ? toNum(r.codAmount) : undefined,
          delivery_status: r.deliveryStatus?.trim() || undefined,
          approval_status: r.approvalStatus?.trim() || undefined,
          tracking_code: r.trackingCode?.trim() || undefined,
          delivery_time: r.deliveryTime?.trim() || undefined,
          rider_name: r.riderName?.trim() || undefined,
          rider_phone: r.riderPhone?.trim() || undefined,
          shipping_charge: r.shippingCharge ? toNum(r.shippingCharge) : undefined,
          cod_charge: r.codCharge ? toNum(r.codCharge) : undefined,
          payment_status: r.paymentStatus?.trim() || undefined,
          delivery_date: safeDate(r.deliveryDate) || undefined,
          note: r.note?.trim() || undefined,
        };
        Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);
        if (Object.keys(patch).length) {
          const { error: uerr } = await supabase.from("orders").update(patch).eq("id", existing.id);
          if (uerr) throw new Error(uerr.message);
          updatedCount++;
        }
      } catch (e: any) {
        failed++;
        failures.push({ rowNumber: r.rowNumber, error: e.message || "Update failed" });
      }
    }

    setExecStage("Finalizing...");
    const processing_ms = Math.round(performance.now() - t0);
    const aiFixed = cleanedRows.filter((r) => r.autoCorrected).length;

    const report = {
      totalRows: cleanedRows.length,
      imported: inserted,
      updated: updatedCount,
      skipped: skipped.length + rejects.length,
      duplicates: Object.keys(existingByExtId).length,
      newCustomers,
      existingCustomers,
      repeatOrders,
      aiFixedFields: aiFixed,
      missingMandatory: rejects.filter((x) => x.reason.startsWith("Missing")).length,
      invalidPhone: rejects.filter((x) => x.reason === "Invalid phone").length,
      invalidCod: simulation.invalidCod,
      failed,
      processingMs: processing_ms,
      failures: failures.slice(0, 200),
    };

    // Persist import_runs
    await supabase.from("import_runs").insert({
      project_id: profile.project_id,
      user_id: user.id,
      user_name: profile.full_name || user.email || "",
      source_filename: fileName,
      total_rows: report.totalRows,
      imported: report.imported,
      updated_count: report.updated,
      skipped: report.skipped,
      duplicates: report.duplicates,
      new_customers: report.newCustomers,
      existing_customers: report.existingCustomers,
      repeat_orders: report.repeatOrders,
      ai_fixed_fields: report.aiFixedFields,
      missing_mandatory: report.missingMandatory,
      invalid_phone: report.invalidPhone,
      invalid_cod: report.invalidCod,
      processing_ms: report.processingMs,
      report: report as any,
    });

    setFinalReport(report);
    setExecuting(false);
    setStep("report");
    await refreshOrders();
    toast({ title: "Import complete", description: `${inserted} inserted, ${updatedCount} updated, ${report.skipped} skipped.` });
  };

  // ---------------- Save template ----------------
  const handleSaveTemplate = async () => {
    if (!tplName.trim()) return;
    try {
      await saveTemplate({
        name: tplName.trim(),
        header_signature: rawHeaders,
        mapping,
      });
      toast({ title: "Template saved" });
      setSaveTplOpen(false);
      setTplName("");
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  const resetAll = () => {
    setStep("upload");
    setFileName("");
    setRawHeaders([]); setRawRows([]);
    setMapping({}); setMatchedTemplate(null);
    setCleanedRows([]); setAiReport(null);
    setExistingByExtId({}); setDupDecisions({});
    setDupGroups([]); setDupState(EMPTY_DUP_STATE);

    setFinalReport(null);
    setLiveRunId(null);
  };

  const downloadFailures = () => {
    if (!finalReport?.failures?.length) return;
    const csv = "row,error\n" + finalReport.failures.map((f: any) => `${f.rowNumber},"${(f.error || "").replace(/"/g, '""')}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `import-failures-${Date.now()}.csv`;
    a.click();
  };

  // ---------------- Render ----------------
  return (
    <AppLayout>
      <PageHeader title="AI Smart Import" description="Analyze, clean, validate, and import courier/CRM data with AI" />

      <div className="max-w-5xl animate-fade-in space-y-4">
        <ResumeBanner />
        <StepIndicator step={step} />

        {/* ---------- UPLOAD ---------- */}
        {step === "upload" && (
          <>
            <div className="rounded-xl border border-border bg-card p-5 card-shadow">
              <h3 className="text-sm font-semibold mb-3">Import mode</h3>
              <RadioGroup value={importMode} onValueChange={(v) => setImportMode(v as "quick" | "ai")} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className={cn("flex items-start gap-3 rounded-lg border p-4 cursor-pointer", importMode === "quick" ? "border-primary bg-primary/5" : "border-border")}>
                  <RadioGroupItem value="quick" className="mt-1" />
                  <div>
                    <p className="text-sm font-medium">Quick Import</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Fast background import. Deterministic normalization only, no AI cleaning. Best for clean exports and very large files.</p>
                  </div>
                </label>
                <label className={cn("flex items-start gap-3 rounded-lg border p-4 cursor-pointer", importMode === "ai" ? "border-primary bg-primary/5" : "border-border")}>
                  <RadioGroupItem value="ai" className="mt-1" />
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" /> AI Enhanced</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Background worker fixes phones/addresses per row using a cached AI normalizer. Fails soft — original values are kept when AI is unavailable.</p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            <div className="rounded-xl border-2 border-dashed border-border bg-card p-12 text-center card-shadow">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                <Upload className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Upload CSV or XLSX</h3>
              <p className="text-xs text-muted-foreground mb-6 flex items-center justify-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Columns are auto-detected. Rows process in the background with automatic retry.
              </p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
              <Button className="gap-2" onClick={() => fileRef.current?.click()}>
                <FileSpreadsheet className="h-4 w-4" /> Choose file
              </Button>
            </div>

            {templates.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5 card-shadow">
                <h3 className="text-sm font-semibold mb-3">Saved import templates</h3>
                <div className="space-y-2">
                  {templates.map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-sm border border-border rounded-lg px-3 py-2">
                      <div>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">Used {t.usage_count}× · {(t.header_signature || []).length} columns</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => deleteTemplate(t.id)} className="text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ---------- MAPPING ---------- */}
        {step === "mapping" && (
          <div className="rounded-xl border border-border bg-card p-5 card-shadow">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">Column mapping</h3>
                <p className="text-xs text-muted-foreground">{fileName} · {rawRows.length} rows · {rawHeaders.length} columns</p>
              </div>
              <div className="flex items-center gap-2">
                {detecting && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Detecting…</span>}
                {matchedTemplate && (
                  <Badge variant="outline" className="text-xs">Matched template: {matchedTemplate.name}</Badge>
                )}
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setSaveTplOpen(true)}>
                  <Save className="h-3.5 w-3.5" /> Save as template
                </Button>
              </div>
            </div>

            {templates.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="text-xs text-muted-foreground self-center">Apply template:</span>
                {templates.map((t) => (
                  <Button key={t.id} size="sm" variant="outline" className="h-7 text-xs" onClick={() => applyTemplate(t)}>
                    {t.name}
                  </Button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CANONICAL.map((f) => (
                <div key={f.key} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">
                      {f.label} {f.required && <span className="text-destructive">*</span>}
                    </Label>
                    <Select value={mapping[f.key] || "__none__"} onValueChange={(v) => {
                      setMapping((m) => {
                        const next = { ...m };
                        if (v === "__none__") delete next[f.key]; else next[f.key] = v;
                        return next;
                      });
                    }}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Not mapped" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Not mapped</SelectItem>
                        {rawHeaders.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <Button variant="ghost" onClick={resetAll}>Cancel</Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => runDetect(rawHeaders)} disabled={detecting}>
                  <Sparkles className="h-4 w-4 mr-1.5" /> Re-detect
                </Button>
                {importMode === "quick" ? (
                  <Button
                    disabled={REQUIRED_KEYS.some((k) => !mapping[k]) || queuing}
                    onClick={runQueuedImport}
                  >
                    {queuing ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Queuing…</> : <>Start background import <ArrowRight className="h-4 w-4 ml-1.5" /></>}
                  </Button>
                ) : (
                  <Button
                    disabled={REQUIRED_KEYS.some((k) => !mapping[k])}
                    onClick={() => setStep("clean")}
                  >
                    Next: Review with AI <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---------- CLEAN ---------- */}
        {step === "clean" && (
          <div className="rounded-xl border border-border bg-card p-5 card-shadow">
            <h3 className="text-sm font-semibold mb-2">AI cleaning</h3>
            <p className="text-xs text-muted-foreground mb-4">
              The AI will normalize phones, statuses, dates and product names. Rows with missing mandatory data will be flagged for review.
            </p>
            <div className="flex items-center gap-2">
              <Button onClick={runClean} disabled={cleaning}>
                {cleaning ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Cleaning…</> : <><Wand2 className="h-4 w-4 mr-1.5" /> Start AI clean</>}
              </Button>
              <Button variant="ghost" onClick={() => setStep("mapping")}>
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
              </Button>
            </div>
          </div>
        )}

        {/* ---------- SIMULATE ---------- */}
        {step === "simulate" && (
          <div className="space-y-4">
            <HealthScorePanel health={aiHealth} recommendations={aiRecommendations} />
            <WarningCenter warnings={aiWarnings} />
            <div className="rounded-xl border border-border bg-card p-5 card-shadow">
              <h3 className="text-sm font-semibold mb-3">Import simulation</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <Stat label="Total rows" value={simulation.total} />
                <Stat label="Safe to import" value={simulation.safe} tone="success" />
                <Stat label="Missing mandatory" value={simulation.missing} tone="destructive" />
                <Stat label="Invalid phone" value={simulation.invalidPhone} tone="destructive" />
                <Stat label="Invalid COD" value={simulation.invalidCod} tone="warning" />
                <Stat label="Duplicate Order IDs (in file)" value={simulation.dupInFile} tone="warning" />
                <Stat label="AI auto-corrected" value={aiReport?.autoCorrected ?? 0} tone="success" />
                <Stat label="Needs review" value={aiReport?.needsReview ?? 0} tone="warning" />
              </div>
              {!!aiReport?.corrections?.length && (
                <div className="mt-4">
                  <p className="text-xs font-medium mb-1">AI corrections summary</p>
                  <div className="flex flex-wrap gap-1.5">
                    {aiReport.corrections.slice(0, 12).map((c, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-5 card-shadow">
              <h3 className="text-sm font-semibold mb-3">Default assignment (optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Assign all to executive</Label>
                  <Select value={assignToExec} onValueChange={setAssignToExec}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Unassigned</SelectItem>
                      {allExecutives.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Delivery method</Label>
                  <Select value={assignDeliveryMethod} onValueChange={setAssignDeliveryMethod}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="From file" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Use value from file</SelectItem>
                      {activeDeliveryMethods.map((dm) => <SelectItem key={dm.id} value={dm.id}>{dm.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep("clean")}><ArrowLeft className="h-4 w-4 mr-1.5" /> Back</Button>
              <Button onClick={goToDuplicates}>Continue <ArrowRight className="h-4 w-4 ml-1.5" /></Button>
            </div>
          </div>
        )}

        {/* ---------- DUPLICATES (grouped by customer) ---------- */}
        {step === "duplicates" && (
          <div className="space-y-3">
            <DuplicateGroupsReview
              groups={dupGroups}
              decisions={dupState}
              onDecisions={setDupState}
              onPreview={(mobile, customerId) => {
                setPreviewMobile(mobile);
                setPreviewCustomerId(customerId);
                setPreviewOpen(true);
              }}
            />
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep("simulate")}><ArrowLeft className="h-4 w-4 mr-1.5" /> Back</Button>
              <Button onClick={runQueuedImport} disabled={queuing}>
                {queuing ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Queuing…</> : <>Start background import <ArrowRight className="h-4 w-4 ml-1.5" /></>}
              </Button>
            </div>
          </div>
        )}


        {/* ---------- EXECUTE (background live dashboard) ---------- */}
        {step === "execute" && liveRunId && (
          <div className="space-y-4">
            <ImportLiveDashboard runId={liveRunId} />
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={resetAll}>Import another file</Button>
              <Button variant="outline" onClick={() => window.location.assign("/imports/recovery")}>Open Recovery Center</Button>
            </div>
          </div>
        )}

        {/* ---------- EXECUTE (legacy inline path, kept for AI simulate flow if used) ---------- */}
        {step === "execute" && !liveRunId && executing && (
          <div className="rounded-xl border border-border bg-card p-8 card-shadow text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
            <p className="text-sm font-medium">{execStage}</p>
            {execProgress.total > 0 && (
              <>
                <Progress value={(execProgress.current / execProgress.total) * 100} className="mt-4" />
                <p className="text-xs text-muted-foreground mt-2">{execProgress.current} / {execProgress.total}</p>
              </>
            )}
          </div>
        )}

        {step === "execute" && !liveRunId && !executing && Object.keys(existingByExtId).length === 0 && (
          <div className="rounded-xl border border-border bg-card p-5 card-shadow">
            <p className="text-sm mb-3">No duplicate Order IDs found. Ready to import.</p>
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep("simulate")}><ArrowLeft className="h-4 w-4 mr-1.5" /> Back</Button>
              <Button onClick={runQueuedImport} disabled={queuing}>
                {queuing ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Queuing…</> : <>Start background import <ArrowRight className="h-4 w-4 ml-1.5" /></>}
              </Button>
            </div>
          </div>
        )}

        {/* ---------- REPORT ---------- */}
        {step === "report" && finalReport && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 card-shadow">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-5 w-5 text-success" />
                <h3 className="text-sm font-semibold">Import report</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Stat label="Total rows" value={finalReport.totalRows} />
                <Stat label="Imported" value={finalReport.imported} tone="success" />
                <Stat label="Updated" value={finalReport.updated} tone="success" />
                <Stat label="Skipped" value={finalReport.skipped} tone="warning" />
                <Stat label="Duplicates found" value={finalReport.duplicates} />
                <Stat label="New customers" value={finalReport.newCustomers} />
                <Stat label="Existing customers" value={finalReport.existingCustomers} />
                <Stat label="Repeat orders" value={finalReport.repeatOrders} />
                <Stat label="AI fixed fields" value={finalReport.aiFixedFields} />
                <Stat label="Missing mandatory" value={finalReport.missingMandatory} tone="destructive" />
                <Stat label="Invalid phone" value={finalReport.invalidPhone} tone="destructive" />
                <Stat label="Failed" value={finalReport.failed} tone="destructive" />
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">Processed in {(finalReport.processingMs / 1000).toFixed(1)}s</p>
            </div>
            <div className="flex items-center gap-2">
              {!!finalReport.failures?.length && (
                <Button variant="outline" onClick={downloadFailures}><Download className="h-4 w-4 mr-1.5" /> Download failures CSV</Button>
              )}
              <Button onClick={resetAll}>Import another file</Button>
            </div>
          </div>
        )}
      </div>

      {/* Save template dialog */}
      <Dialog open={saveTplOpen} onOpenChange={setSaveTplOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save mapping as template</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Template name</Label>
            <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="e.g. Steadfast export" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveTplOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTemplate} disabled={!tplName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm create anyway */}
      <AlertDialog open={!!confirmCreateFor} onOpenChange={(o) => !o && setConfirmCreateFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create duplicate order?</AlertDialogTitle>
            <AlertDialogDescription>
              This Order ID already exists. Are you sure you want to create another order with the same Order ID?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmCreateFor(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (confirmCreateFor) setDupDecisions((d) => ({ ...d, [confirmCreateFor]: "create" }));
              setConfirmCreateFor(null);
            }}>Yes, create anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <CustomerPreviewPanel
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        customerId={previewCustomerId}
        mobile={previewMobile}
        projectId={profile?.project_id ?? null}
      />
    </AppLayout>

  );
}

// ---------- Small UI bits ----------
function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "mapping", label: "Mapping" },
    { key: "clean", label: "AI Clean" },
    { key: "simulate", label: "Simulate" },
    { key: "duplicates", label: "Duplicates" },
    { key: "execute", label: "Import" },
    { key: "report", label: "Report" },
  ];
  const idx = steps.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center gap-1 text-xs">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <span className={cn(
            "px-2 py-1 rounded",
            i === idx ? "bg-primary text-primary-foreground" : i < idx ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
          )}>{i + 1}. {s.label}</span>
          {i < steps.length - 1 && <span className="text-muted-foreground">›</span>}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "success" | "warning" | "destructive" }) {
  return (
    <div className="border border-border rounded-lg p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn(
        "text-lg font-semibold mt-0.5",
        tone === "success" && "text-success",
        tone === "warning" && "text-warning",
        tone === "destructive" && "text-destructive"
      )}>{value}</p>
    </div>
  );
}
