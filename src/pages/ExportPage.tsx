import { useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { useAuditLog } from "@/contexts/AuditLogContext";
import { useRole } from "@/contexts/RoleContext";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useProductStore } from "@/contexts/ProductStoreContext";
import { useDeliveryMethods } from "@/hooks/useDeliveryMethods";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileArchive, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import JSZip from "jszip";

function buildCSV(headers: string[], rows: string[][]): string {
  return [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
}

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csvContent = buildCSV(headers, rows);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ExportPage() {
  const { activeOrders, followupHistory, upsellRecords, repeatOrderRecords } = useOrderStore();
  const { logs } = useAuditLog();
  const { isAdmin } = useRole();
  const { toast } = useToast();
  const [zipLoading, setZipLoading] = useState(false);
  const { members } = useTeamMembers();
  const { products } = useProductStore();
  const { methods: deliveryPartners } = useDeliveryMethods({ activeOnly: false });

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [execFilter, setExecFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [deliveryFilter, setDeliveryFilter] = useState("all");

  const filteredOrders = useMemo(() => {
    return activeOrders.filter((o) => {
      if (dateFrom && o.orderDate < dateFrom) return false;
      if (dateTo && o.orderDate > dateTo) return false;
      if (execFilter !== "all" && o.assignedTo !== execFilter) return false;
      if (productFilter !== "all" && o.productId !== productFilter) return false;
      if (deliveryFilter !== "all" && o.deliveryMethod !== deliveryFilter) return false;
      return true;
    });
  }, [activeOrders, dateFrom, dateTo, execFilter, productFilter, deliveryFilter]);

  const getDeliveryName = (id: string) => deliveryPartners.find((dp) => dp.id === id)?.name || id;

  const exportOrders = () => {
    downloadCSV(
      "orders_export.csv",
      ["Order ID", "Customer", "Mobile", "Product", "Price (৳)", "Order Date", "Delivery Date", "Delivery Method", "Source", "Step", "Type"],
      filteredOrders.map((o) => [
        o.id, o.customerName, o.mobile, o.productTitle, `৳${o.price}`, o.orderDate, o.deliveryDate, getDeliveryName(o.deliveryMethod), o.orderSource, `Step ${o.followupStep}`, o.isRepeat ? "Repeat" : "Original",
      ])
    );
    toast({ title: "Exported", description: `${filteredOrders.length} orders exported.` });
  };

  const exportRepeatOrders = () => {
    const repeats = filteredOrders.filter((o) => o.isRepeat);
    downloadCSV(
      "repeat_orders_export.csv",
      ["Order ID", "Customer", "Product", "Price (৳)", "Parent Order", "Order Date"],
      repeats.map((o) => [o.id, o.customerName, o.productTitle, `৳${o.price}`, o.parentOrderId || "", o.orderDate])
    );
    toast({ title: "Exported", description: `${repeats.length} repeat orders exported.` });
  };

  const exportPerformance = () => {
    const data = members.map((m) => {
      const seOrders = filteredOrders.filter((o) => o.assignedTo === m.userId);
      const revenue = seOrders.reduce((s, o) => s + o.price, 0);
      const repeats = seOrders.filter((o) => o.isRepeat).length;
      return [m.name, m.email, String(seOrders.length), String(repeats), `৳${revenue}`];
    });
    downloadCSV(
      "sales_performance_export.csv",
      ["Name", "Email", "Total Orders", "Repeat Orders", "Revenue (৳)"],
      data
    );
    toast({ title: "Exported", description: "Sales performance exported." });
  };

  const exportProducts = () => {
    downloadCSV(
      "products_export.csv",
      ["SKU", "Title", "Price (৳)", "Duration (days)", "Info"],
      products.map((p) => [p.sku, p.title, `৳${p.price}`, String(p.packageDuration), p.info || ""])
    );
    toast({ title: "Exported", description: `${products.length} products exported.` });
  };

  const exportAuditLogs = () => {
    downloadCSV(
      "audit_logs_export.csv",
      ["Action", "User", "Role", "Entity", "Details", "Timestamp"],
      logs.map((l) => [l.actionType, l.userName, l.role, l.entity, l.details || "", l.timestamp])
    );
    toast({ title: "Exported", description: `${logs.length} audit log entries exported.` });
  };

  const exportAllReport = async () => {
    setZipLoading(true);
    try {
      const zip = new JSZip();

      // Orders
      zip.file("orders.csv", buildCSV(
        ["Order ID", "Invoice", "Customer", "Mobile", "Address", "Product", "SKU", "Price (৳)", "Paid (৳)", "Order Date", "Delivery Date", "Delivery Method", "Source", "Step", "Status", "Health", "Type", "Assigned To"],
        filteredOrders.map((o) => [
          o.id, o.invoiceId || "", o.customerName, o.mobile, o.address, o.productTitle, o.productSku || "", `${o.price}`, `${(o as any).paidAmount ?? 0}`, o.orderDate, o.deliveryDate, getDeliveryName(o.deliveryMethod), o.orderSource, `Step ${o.followupStep}`, o.currentStatus || "pending", o.health, o.isRepeat ? "Repeat" : o.isUpsell ? "Upsell" : "Original", o.assignedToName,
        ])
      ));

      // Customers (deduplicated from orders)
      const customerMap = new Map<string, { name: string; mobile: string; address: string; orderCount: number }>();
      filteredOrders.forEach((o) => {
        const existing = customerMap.get(o.mobile);
        if (existing) { existing.orderCount++; } else {
          customerMap.set(o.mobile, { name: o.customerName, mobile: o.mobile, address: o.address, orderCount: 1 });
        }
      });
      zip.file("customers.csv", buildCSV(
        ["Customer Name", "Mobile", "Address", "Total Orders"],
        Array.from(customerMap.values()).map((c) => [c.name, c.mobile, c.address, String(c.orderCount)])
      ));

      // Followups
      const orderIds = new Set(filteredOrders.map((o) => o.id));
      const filteredFollowups = followupHistory.filter((f) => orderIds.has(f.orderId));
      zip.file("followups.csv", buildCSV(
        ["Followup ID", "Order ID", "Step", "Note", "Problems Discussed", "Upsell Attempted", "Next Followup Date", "Completed By", "Completed At"],
        filteredFollowups.map((f) => [
          f.id, f.orderId, String(f.stepNumber), f.note, f.problemsDiscussed, f.upsellAttempted ? "Yes" : "No", f.nextFollowupDate || "", f.completedByName, f.completedAt,
        ])
      ));

      // Upsell records
      const followupIds = new Set(filteredFollowups.map((f) => f.id));
      const filteredUpsells = upsellRecords.filter((u) => followupIds.has(u.followupId));
      zip.file("upsell.csv", buildCSV(
        ["Upsell ID", "Followup ID", "Product", "Price (৳)", "Note", "Created At"],
        filteredUpsells.map((u) => [u.id, u.followupId, u.productName, `${u.price}`, u.note, u.createdAt])
      ));

      // Repeat orders
      const filteredRepeats = repeatOrderRecords.filter((r) => followupIds.has(r.followupId));
      zip.file("repeat_orders.csv", buildCSV(
        ["Record ID", "Followup ID", "Product", "Price (৳)", "Child Order ID", "Note", "Created At"],
        filteredRepeats.map((r) => [r.id, r.followupId, r.productName, `${r.price}`, r.childOrderId || "", r.note, r.createdAt])
      ));

      // Sales performance
      zip.file("sales_performance.csv", buildCSV(
        ["Name", "Email", "Total Orders", "Repeat Orders", "Upsell Orders", "Revenue (৳)"],
        members.map((m) => {
          const seOrders = filteredOrders.filter((o) => o.assignedTo === m.userId);
          const revenue = seOrders.reduce((s, o) => s + o.price, 0);
          const repeats = seOrders.filter((o) => o.isRepeat).length;
          const upsells = seOrders.filter((o) => o.isUpsell).length;
          return [m.name, m.email, String(seOrders.length), String(repeats), String(upsells), `${revenue}`];
        })
      ));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      link.download = `salesboss_all_report_${dateStr}.zip`;
      link.click();
      URL.revokeObjectURL(url);

      toast({ title: "All Reports Downloaded", description: "All reports downloaded successfully." });
    } catch (err) {
      console.error("ZIP export error:", err);
      toast({ title: "Export Failed", description: "Failed to generate report package.", variant: "destructive" });
    } finally {
      setZipLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Access restricted to Admin only.
        </div>
      </AppLayout>
    );
  }

  const totalRecords = filteredOrders.length + followupHistory.length + upsellRecords.length + repeatOrderRecords.length + members.length;

  const exports = [
    { label: "All Orders", count: filteredOrders.length, action: exportOrders },
    { label: "Repeat Orders", count: filteredOrders.filter((o) => o.isRepeat).length, action: exportRepeatOrders },
    { label: "Sales Performance", count: members.length, action: exportPerformance },
    { label: "Products", count: products.length, action: exportProducts },
    { label: "Audit Logs", count: logs.length, action: exportAuditLogs },
  ];

  return (
    <AppLayout>
      <PageHeader title="Export & Backup" description="Export filtered data as CSV" />

      {/* All Report card */}
      <div className="mb-6 rounded-xl border-2 border-primary/20 bg-primary/5 p-5 card-shadow animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileArchive className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">All Report</p>
              <p className="text-xs text-muted-foreground">
                Download complete report package (ZIP) — {totalRecords} total records across 6 reports
              </p>
            </div>
          </div>
          <Button onClick={exportAllReport} disabled={zipLoading} className="gap-2">
            {zipLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Preparing report...</>
            ) : (
              <><FileArchive className="h-4 w-4" /> Download All Report</>
            )}
          </Button>
        </div>
      </div>

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
          <label className="text-xs font-medium text-muted-foreground">Executive</label>
          <Select value={execFilter} onValueChange={setExecFilter}>
            <SelectTrigger className="h-9 w-44 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {members.map((m) => <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Product</label>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="h-9 w-44 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Delivery</label>
          <Select value={deliveryFilter} onValueChange={setDeliveryFilter}>
            <SelectTrigger className="h-9 w-44 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {deliveryPartners.filter((d) => d.isActive).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Export cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
        {exports.map((exp) => (
          <div key={exp.label} className="rounded-xl border border-border bg-card p-5 card-shadow hover:card-shadow-hover transition-fast">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-foreground">{exp.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{exp.count} records</p>
              </div>
              <Download className="h-4 w-4 text-muted-foreground" />
            </div>
            <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={exp.action}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
