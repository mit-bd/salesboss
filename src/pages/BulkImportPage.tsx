import { useState, useRef } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useDeliveryMethods } from "@/hooks/useDeliveryMethods";
import { useOrderSources } from "@/hooks/useOrderSources";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { mockSalesExecutives } from "@/data/mockData";

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
}

interface ImportResult {
  rowNumber: number;
  success: boolean;
  error?: string;
}

// --- Constants ---

const REQUIRED_COLUMNS = ["customerName", "mobile", "address", "orderSource", "product", "price", "orderDate", "deliveryDate", "deliveryMethod", "itemDescription"];

const AUTO_MAP: Record<string, string[]> = {
  customerName: ["customer name", "name", "customer"],
  mobile: ["mobile", "phone", "mobile number"],
  address: ["address", "addr"],
  orderSource: ["order source", "source"],
  product: ["product", "product title"],
  price: ["price", "amount"],
  note: ["note", "notes", "order note"],
  orderDate: ["order date", "orderdate", "order_date"],
  deliveryDate: ["delivery date", "deliverydate", "delivery_date"],
  deliveryMethod: ["delivery method", "deliverymethod", "delivery_method", "delivery partner"],
  itemDescription: ["item description", "itemdescription", "item_description", "description"],
};

// --- Helpers ---

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split("\n").map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
  return { headers: lines[0] || [], rows: lines.slice(1) };
}

function validateRow(row: Record<string, string>, activeDeliveryMethodNames: string[]): string | undefined {
  if (!row.customerName?.trim()) return "Missing customer name";
  if (!row.mobile?.trim()) return "Missing mobile";
  if (!/^\d{10,15}$/.test(row.mobile.replace(/\s/g, ""))) return "Invalid mobile number";
  if (!row.address?.trim()) return "Missing address";
  if (!row.orderSource?.trim()) return "Missing order source";
  if (!row.product?.trim()) return "Missing product";
  if (!row.price?.trim()) return "Missing price";
  if (!row.orderDate?.trim()) return "Missing order date";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(row.orderDate.trim())) return "Invalid order date format (YYYY-MM-DD)";
  if (!row.deliveryDate?.trim()) return "Missing delivery date";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(row.deliveryDate.trim())) return "Invalid delivery date format (YYYY-MM-DD)";
  if (!row.deliveryMethod?.trim()) return "Missing delivery method";
  else if (!activeDeliveryMethodNames.some((m) => m.toLowerCase() === row.deliveryMethod!.trim().toLowerCase())) return "Invalid delivery method";
  if (!row.itemDescription?.trim()) return "Missing item description";
  return undefined;
}

function autoMapColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  headers.forEach((h) => {
    const hl = h.toLowerCase();
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
    };
    reader.readAsText(file);
  };

  const handlePreview = () => {
    const deliveryMethodNames = activeDeliveryMethods.map((dm) => dm.name);
    const rows: ParsedRow[] = rawRows.map((row, idx) => {
      const obj: Record<string, string> = {};
      rawHeaders.forEach((h, i) => { obj[h] = row[i] || ""; });
      const mapped: Record<string, string> = {};
      Object.entries(columnMapping).forEach(([key, col]) => { mapped[key] = obj[col] || ""; });
      const error = validateRow(mapped, deliveryMethodNames);
      return { ...mapped, rowNumber: idx + 2, error } as ParsedRow; // +2 for 1-indexed + header
    });
    setParsedData(rows);
    setImportResults(null);
  };

  const handleImport = async () => {
    if (!parsedData || !profile?.project_id || !user) return;

    setImporting(true);
    const results: ImportResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Find the exec name if assigned
    const execName = assignToExec && assignToExec !== "__none__"
      ? allExecutives.find((e) => e.id === assignToExec)?.name || ""
      : "";

    for (const row of parsedData) {
      // Skip rows that failed validation
      if (row.error) {
        results.push({ rowNumber: row.rowNumber, success: false, error: row.error });
        errorCount++;
        continue;
      }

      try {
        // Find or create customer
        const { data: customerId, error: custErr } = await supabase.rpc("find_or_create_customer", {
          p_name: row.customerName,
          p_mobile: row.mobile.replace(/\s/g, ""),
          p_address: row.address,
        });

        if (custErr) throw new Error(`Customer error: ${custErr.message}`);

        // Resolve delivery method name to use
        const dmName = (assignDeliveryMethod && assignDeliveryMethod !== "__none__")
          ? activeDeliveryMethods.find((dm) => dm.id === assignDeliveryMethod)?.name || row.deliveryMethod || ""
          : row.deliveryMethod || "";

        const { error: insertErr } = await supabase.from("orders").insert({
          customer_name: row.customerName,
          mobile: row.mobile.replace(/\s/g, ""),
          address: row.address,
          order_source: row.orderSource,
          product_title: row.product || "",
          price: parseFloat(row.price || "0"),
          order_date: row.orderDate,
          delivery_date: row.deliveryDate,
          delivery_method: dmName,
          item_description: row.itemDescription || "",
          note: row.note || "",
          customer_id: customerId,
          project_id: profile.project_id,
          created_by: user.id,
          assigned_to: (assignToExec && assignToExec !== "__none__") ? assignToExec : null,
          assigned_to_name: execName,
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

    // Refresh orders in store
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
  };

  const validCount = parsedData?.filter((r) => !r.error).length ?? 0;
  const errorCount = parsedData?.filter((r) => r.error).length ?? 0;

  return (
    <AppLayout>
      <PageHeader title="Bulk Import" description="Import orders from CSV or Google Sheets" />

      <div className="max-w-3xl animate-fade-in">
        {!rawHeaders.length ? (
          <>
            <div className="rounded-xl border-2 border-dashed border-border bg-card p-12 text-center card-shadow">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                <Upload className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Upload your file</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Drag and drop a CSV file, or click to browse. You can also paste a Google Sheets URL.
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
              <h3 className="text-sm font-semibold text-foreground mb-3">Required Columns</h3>
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <span>• Customer Name *</span>
                <span>• Mobile Number *</span>
                <span>• Address *</span>
                <span>• Order Source *</span>
                <span>• Product *</span>
                <span>• Price *</span>
                <span>• Order Date *</span>
                <span>• Delivery Date *</span>
                <span>• Delivery Method *</span>
                <span>• Item Description *</span>
                <span>• Order Note</span>
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
                <Button size="sm" onClick={handlePreview} disabled={importing}>Preview Data</Button>
              </div>
            </div>

            {/* Preview Table */}
            {parsedData && !importResults && (
              <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-success"><CheckCircle className="h-3.5 w-3.5" /> {validCount} valid</span>
                    <span className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3.5 w-3.5" /> {errorCount} errors</span>
                  </div>
                  <Button size="sm" onClick={handleImport} disabled={validCount === 0 || importing}>
                    {importing ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importing...</> : `Import ${validCount} Orders`}
                  </Button>
                </div>
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Row</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mobile</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Source</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Order Date</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Delivery</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.map((row, i) => (
                        <tr key={i} className={cn("border-b border-border last:border-0", row.error && "bg-destructive/5")}>
                          <td className="px-3 py-2 text-muted-foreground">{row.rowNumber}</td>
                          <td className="px-3 py-2">{row.error ? <AlertCircle className="h-3.5 w-3.5 text-destructive" /> : <CheckCircle className="h-3.5 w-3.5 text-success" />}</td>
                          <td className="px-3 py-2 text-foreground">{row.customerName}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.mobile}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.orderSource}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.orderDate}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.deliveryMethod}</td>
                          <td className="px-3 py-2 text-muted-foreground truncate max-w-24">{row.itemDescription}</td>
                          <td className="px-3 py-2 text-destructive">{row.error}</td>
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
