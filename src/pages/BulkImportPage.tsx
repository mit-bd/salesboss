import { useState, useRef } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useDeliveryMethods } from "@/hooks/useDeliveryMethods";
import { useOrderSources } from "@/hooks/useOrderSources";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useOrderStore } from "@/contexts/OrderStoreContext";


// --- Types ---

interface ParsedRow {
  rowNumber: number;
  customerName: string;
  mobile: string;
  address: string;
  orderSource: string;
  product?: string;
  price?: string;
  note?: string;
  orderDate?: string;
  deliveryDate?: string;
  deliveryMethod?: string;
  itemDescription?: string;
  error?: string;
  autoCorrected?: boolean;
  needsReview?: boolean;
  corrections?: string[];
}

interface ImportResult {
  rowNumber: number;
  success: boolean;
  error?: string;
}

interface AiReport {
  totalRows: number;
  autoCorrected: number;
  needsReview: number;
  ready: number;
  corrections: string[];
}

// --- Constants ---

const REQUIRED_COLUMNS = ["customerName", "mobile", "address"];

const AUTO_MAP: Record<string, string[]> = {
  customerName: ["customer name", "name", "customer", "customer_name", "client", "client name"],
  mobile: ["mobile", "phone", "mobile number", "contact number", "contact", "phone number", "mobile_number", "phone_number"],
  address: ["address", "addr", "location"],
  orderSource: ["order source", "source", "order_source"],
  product: ["product", "product title", "product_title", "item"],
  price: ["price", "amount", "total", "cost"],
  note: ["note", "notes", "order note", "remark", "remarks"],
  orderDate: ["order date", "orderdate", "order_date", "date"],
  deliveryDate: ["delivery date", "deliverydate", "delivery_date"],
  deliveryMethod: ["delivery method", "deliverymethod", "delivery_method", "delivery partner", "courier"],
  itemDescription: ["item description", "itemdescription", "item_description", "description", "details"],
};

// --- Helpers ---

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split("\n").map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
  return { headers: lines[0] || [], rows: lines.slice(1) };
}

function validateRow(row: Record<string, string>): string | undefined {
  if (!row.customerName?.trim()) return "Missing customer name";
  if (!row.mobile?.trim()) return "Missing mobile";
  if (!/^\d{10,15}$/.test(row.mobile.replace(/\s/g, ""))) return "Invalid mobile number";
  if (!row.address?.trim()) return "Missing address";
  return undefined;
}

function safeDate(val: string | undefined): string | null {
  if (!val?.trim()) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(val.trim()) ? val.trim() : null;
}

function safePrice(val: string | undefined): number {
  if (!val?.trim()) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function autoMapColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  headers.forEach((h) => {
    const hl = h.toLowerCase().trim();
    for (const [key, aliases] of Object.entries(AUTO_MAP)) {
      if (aliases.includes(hl)) mapping[key] = h;
    }
  });
  return mapping;
}

// --- Component ---

export default function BulkImportPage() {
  const { toast } = useToast();
  const { profile, user } = useAuth();
  const { refreshOrders } = useOrderStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [parsedData, setParsedData] = useState<ParsedRow[] | null>(null);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [assignToExec, setAssignToExec] = useState("");
  const [assignDeliveryMethod, setAssignDeliveryMethod] = useState("");
  const [importing, setImporting] = useState(false);
  const [aiCleaning, setAiCleaning] = useState(false);
  const [aiReport, setAiReport] = useState<AiReport | null>(null);
  const { members } = useTeamMembers();
  const { methods: activeDeliveryMethods } = useDeliveryMethods({ activeOnly: true });
  const { sources } = useOrderSources();

  const allExecutives = [
    ...members.map((m) => ({ id: m.userId, name: m.name })),
    ...mockSalesExecutives.filter((se) => !members.some((m) => m.userId === se.id)).map((se) => ({ id: se.id, name: se.name })),
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCSV(text);
      setRawHeaders(headers);
      setRawRows(rows);
      setColumnMapping(autoMapColumns(headers));
      setParsedData(null);
      setImportResults(null);
      setAiReport(null);
    };
    reader.readAsText(file);
  };

  const handlePreview = () => {
    const rows: ParsedRow[] = rawRows.map((row, idx) => {
      const obj: Record<string, string> = {};
      rawHeaders.forEach((h, i) => { obj[h] = row[i] || ""; });
      const mapped: Record<string, string> = {};
      Object.entries(columnMapping).forEach(([key, col]) => { mapped[key] = obj[col] || ""; });
      const error = validateRow(mapped);
      return { ...mapped, rowNumber: idx + 2, error } as ParsedRow;
    });
    setParsedData(rows);
    setImportResults(null);
    setAiReport(null);
  };

  const handleAiClean = async () => {
    if (!parsedData) return;
    setAiCleaning(true);

    try {
      const rowsForAi = parsedData.map((r) => ({
        rowNumber: r.rowNumber,
        customerName: r.customerName,
        mobile: r.mobile,
        address: r.address,
        orderSource: r.orderSource,
        product: r.product || "",
        price: r.price || "",
        note: r.note || "",
        orderDate: r.orderDate || "",
        deliveryDate: r.deliveryDate || "",
        deliveryMethod: r.deliveryMethod || "",
        itemDescription: r.itemDescription || "",
      }));

      const { data, error } = await supabase.functions.invoke("ai-import-cleaner", {
        body: { rows: rowsForAi, headers: rawHeaders },
      });

      if (error) throw error;

      if (data?.cleanedRows && Array.isArray(data.cleanedRows)) {
        const cleaned: ParsedRow[] = data.cleanedRows.map((r: any) => {
          const validationError = validateRow(r);
          return {
            rowNumber: r.rowNumber,
            customerName: r.customerName || "",
            mobile: r.mobile || "",
            address: r.address || "",
            orderSource: r.orderSource || "",
            product: r.product || "",
            price: r.price || "",
            note: r.note || "",
            orderDate: r.orderDate || "",
            deliveryDate: r.deliveryDate || "",
            deliveryMethod: r.deliveryMethod || "",
            itemDescription: r.itemDescription || "",
            autoCorrected: r.autoCorrected || false,
            needsReview: r.needsReview || false,
            corrections: r.corrections || [],
            error: r.needsReview ? (validationError || "Needs review") : validationError,
          };
        });
        setParsedData(cleaned);
        setAiReport(data.report || null);

        toast({
          title: "AI Cleaning Complete",
          description: `${data.report?.autoCorrected || 0} rows auto-corrected, ${data.report?.needsReview || 0} need review.`,
        });
      }
    } catch (err: any) {
      console.error("AI clean error:", err);
      toast({
        title: "AI Cleaning Failed",
        description: err.message || "Could not process data with AI. You can still import manually.",
        variant: "destructive",
      });
    } finally {
      setAiCleaning(false);
    }
  };

  const handleImport = async () => {
    if (!parsedData || !profile?.project_id || !user) return;

    setImporting(true);
    const results: ImportResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    const execName = assignToExec && assignToExec !== "__none__"
      ? allExecutives.find((e) => e.id === assignToExec)?.name || ""
      : "";

    for (const row of parsedData) {
      if (row.error) {
        results.push({ rowNumber: row.rowNumber, success: false, error: row.error });
        errorCount++;
        continue;
      }

      try {
        const { data: customerId, error: custErr } = await supabase.rpc("find_or_create_customer", {
          p_name: row.customerName,
          p_mobile: row.mobile.replace(/\s/g, ""),
          p_address: row.address,
        });

        if (custErr) throw new Error(`Customer error: ${custErr.message}`);

        const dmName = (assignDeliveryMethod && assignDeliveryMethod !== "__none__")
          ? activeDeliveryMethods.find((dm) => dm.id === assignDeliveryMethod)?.name || row.deliveryMethod || ""
          : row.deliveryMethod || "";

        const orderDate = safeDate(row.orderDate);
        const deliveryDate = safeDate(row.deliveryDate);

        const { error: insertErr } = await supabase.from("orders").insert({
          customer_name: row.customerName,
          mobile: row.mobile.replace(/\s/g, ""),
          address: row.address,
          order_source: row.orderSource?.trim() || "Website",
          product_title: row.product?.trim() || "",
          price: safePrice(row.price),
          order_date: orderDate || new Date().toISOString().slice(0, 10),
          delivery_date: deliveryDate,
          delivery_method: dmName || "",
          item_description: row.itemDescription?.trim() || "",
          note: row.note?.trim() || "",
          customer_id: customerId,
          project_id: profile.project_id,
          created_by: user.id,
          assigned_to: (assignToExec && assignToExec !== "__none__") ? assignToExec : null,
          assigned_to_name: execName,
          current_status: "pending",
          followup_step: 1,
        });

        if (insertErr) throw new Error(insertErr.message);

        results.push({ rowNumber: row.rowNumber, success: true });
        successCount++;
      } catch (err: any) {
        results.push({ rowNumber: row.rowNumber, success: false, error: err.message || "Unknown error" });
        errorCount++;
      }
    }

    setImportResults(results);
    setImporting(false);

    await refreshOrders();

    toast({
      title: "Import Complete",
      description: `${successCount} orders saved. ${errorCount} rows failed.`,
    });
  };

  const handleSheetsImport = () => {
    if (!sheetsUrl.trim()) return;
    toast({ title: "Google Sheets", description: "Google Sheets import will be available soon." });
  };

  const resetAll = () => {
    setRawHeaders([]);
    setRawRows([]);
    setParsedData(null);
    setImportResults(null);
    setAiReport(null);
  };

  const validCount = parsedData?.filter((r) => !r.error).length ?? 0;
  const errorCount = parsedData?.filter((r) => r.error).length ?? 0;
  const correctedCount = parsedData?.filter((r) => r.autoCorrected).length ?? 0;

  return (
    <AppLayout>
      <PageHeader title="Bulk Import" description="Import orders from CSV with AI-powered data cleaning" />

      <div className="max-w-4xl animate-fade-in">
        {!rawHeaders.length ? (
          <>
            <div className="rounded-xl border-2 border-dashed border-border bg-card p-12 text-center card-shadow">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                <Upload className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Upload your file</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Drag and drop a CSV file, or click to browse.
              </p>
              <p className="text-xs text-muted-foreground mb-6 flex items-center justify-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                AI will automatically clean and organize messy data
              </p>
              <div className="flex justify-center gap-3">
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
                  <FileSpreadsheet className="h-4 w-4" /> Upload CSV
                </Button>
                <div className="flex items-center gap-2">
                  <Input placeholder="Google Sheets URL" value={sheetsUrl} onChange={(e) => setSheetsUrl(e.target.value)} className="w-64" />
                  <Button variant="outline" onClick={handleSheetsImport}>Import</Button>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-border bg-card p-5 card-shadow">
              <h3 className="text-sm font-semibold text-foreground mb-3">Column Guide</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Required:</p>
                <div className="grid grid-cols-3 gap-1">
                  <span>• Customer Name *</span>
                  <span>• Mobile Number *</span>
                  <span>• Address *</span>
                </div>
                <p className="font-medium text-foreground mt-2">Optional:</p>
                <div className="grid grid-cols-3 gap-1">
                  <span>• Order Source</span>
                  <span>• Product</span>
                  <span>• Price</span>
                  <span>• Order Date</span>
                  <span>• Delivery Date</span>
                  <span>• Delivery Method</span>
                  <span>• Item Description</span>
                  <span>• Order Note</span>
                </div>
                <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                    <Wand2 className="h-3.5 w-3.5" /> AI Data Organizer
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    After previewing, click "AI Clean Data" to auto-fix phone formats, names, product matching, and more. Messy data? No problem!
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Column Mapping</h3>
              <Button variant="ghost" size="sm" onClick={resetAll}>
                <X className="h-4 w-4 mr-1" /> Reset
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 card-shadow">
              <div className="grid grid-cols-2 gap-3">
                {["customerName", "mobile", "address", "orderSource", "product", "price", "orderDate", "deliveryDate", "deliveryMethod", "itemDescription", "note"].map((field) => (
                  <div key={field} className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground min-w-24 capitalize">
                      {field.replace(/([A-Z])/g, " $1")} {REQUIRED_COLUMNS.includes(field) ? "*" : ""}
                    </span>
                    <select
                      value={columnMapping[field] || ""}
                      onChange={(e) => setColumnMapping((m) => ({ ...m, [field]: e.target.value }))}
                      className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="">-- Select --</option>
                      {rawHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Assign to executive (optional)</Label>
                  <Select value={assignToExec} onValueChange={setAssignToExec}>
                    <SelectTrigger className="mt-1 h-8 text-xs">
                      <SelectValue placeholder="No assignment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No assignment</SelectItem>
                      {allExecutives.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Delivery method (optional override)</Label>
                  <Select value={assignDeliveryMethod} onValueChange={setAssignDeliveryMethod}>
                    <SelectTrigger className="mt-1 h-8 text-xs">
                      <SelectValue placeholder="Use CSV value" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Use CSV value</SelectItem>
                      {activeDeliveryMethods.map((dm) => (
                        <SelectItem key={dm.id} value={dm.id}>{dm.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button size="sm" onClick={handlePreview} disabled={importing || aiCleaning}>Preview Data</Button>
              </div>
            </div>

            {/* AI Report */}
            {aiReport && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 card-shadow animate-fade-in">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4.5 w-4.5 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">AI Import Report</h3>
                </div>
                <div className="grid grid-cols-4 gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{aiReport.totalRows}</p>
                    <p className="text-xs text-muted-foreground">Total Rows</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{aiReport.ready}</p>
                    <p className="text-xs text-muted-foreground">Ready to Import</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{aiReport.autoCorrected}</p>
                    <p className="text-xs text-muted-foreground">Auto Corrected</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-warning">{aiReport.needsReview}</p>
                    <p className="text-xs text-muted-foreground">Needs Review</p>
                  </div>
                </div>
                {aiReport.corrections.length > 0 && (
                  <div className="mt-2 pt-3 border-t border-primary/10">
                    <p className="text-xs font-medium text-foreground mb-1.5">Corrections Applied:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {aiReport.corrections.slice(0, 10).map((c, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{c}</Badge>
                      ))}
                      {aiReport.corrections.length > 10 && (
                        <Badge variant="outline" className="text-[10px]">+{aiReport.corrections.length - 10} more</Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Preview Table */}
            {parsedData && !importResults && (
              <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-success"><CheckCircle className="h-3.5 w-3.5" /> {validCount} valid</span>
                    {correctedCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-primary"><Sparkles className="h-3.5 w-3.5" /> {correctedCount} corrected</span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3.5 w-3.5" /> {errorCount} errors</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAiClean}
                      disabled={aiCleaning || importing}
                      className="gap-1.5"
                    >
                      {aiCleaning ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Cleaning...</>
                      ) : (
                        <><Wand2 className="h-3.5 w-3.5" /> AI Clean Data</>
                      )}
                    </Button>
                    <Button size="sm" onClick={handleImport} disabled={validCount === 0 || importing}>
                      {importing ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importing...</> : `Import ${validCount} Orders`}
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Row</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mobile</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Address</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Product</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Price</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Info</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.map((row, i) => (
                        <tr key={i} className={cn(
                          "border-b border-border last:border-0",
                          row.error && "bg-destructive/5",
                          row.autoCorrected && !row.error && "bg-primary/5",
                        )}>
                          <td className="px-3 py-2 text-muted-foreground">{row.rowNumber}</td>
                          <td className="px-3 py-2">
                            {row.error ? (
                              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                            ) : row.autoCorrected ? (
                              <Sparkles className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <CheckCircle className="h-3.5 w-3.5 text-success" />
                            )}
                          </td>
                          <td className="px-3 py-2 text-foreground">{row.customerName}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.mobile}</td>
                          <td className="px-3 py-2 text-muted-foreground truncate max-w-32">{row.address}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.product}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.price}</td>
                          <td className="px-3 py-2">
                            {row.error ? (
                              <span className="text-destructive">{row.error}</span>
                            ) : row.corrections && row.corrections.length > 0 ? (
                              <span className="text-primary text-[10px]">{row.corrections.join("; ")}</span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Import Results */}
            {importResults && (
              <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground mb-2">Import Summary</h3>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">Total: {importResults.length}</span>
                    <span className="flex items-center gap-1 text-xs text-success">
                      <CheckCircle className="h-3.5 w-3.5" /> {importResults.filter((r) => r.success).length} saved
                    </span>
                    <span className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5" /> {importResults.filter((r) => !r.success).length} failed
                    </span>
                    {correctedCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-primary">
                        <Sparkles className="h-3.5 w-3.5" /> {correctedCount} AI corrected
                      </span>
                    )}
                  </div>
                </div>
                {importResults.some((r) => !r.success) && (
                  <div className="overflow-x-auto max-h-60">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Row</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResults.filter((r) => !r.success).map((r) => (
                          <tr key={r.rowNumber} className="border-b border-border last:border-0 bg-destructive/5">
                            <td className="px-3 py-2 text-foreground">Row {r.rowNumber}</td>
                            <td className="px-3 py-2 text-destructive">{r.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="p-4 border-t border-border flex justify-end">
                  <Button size="sm" variant="outline" onClick={resetAll}>Import More</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
