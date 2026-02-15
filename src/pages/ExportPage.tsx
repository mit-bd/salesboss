import { useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { useAuditLog } from "@/contexts/AuditLogContext";
import { useRole } from "@/contexts/RoleContext";
import { mockProducts, mockSalesExecutives, mockDeliveryPartners } from "@/data/mockData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ExportPage() {
  const { activeOrders } = useOrderStore();
  const { logs } = useAuditLog();
  const { isAdmin } = useRole();
  const { toast } = useToast();

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

  const getDeliveryName = (id: string) => mockDeliveryPartners.find((dp) => dp.id === id)?.name || id;

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
    const data = mockSalesExecutives.map((se) => {
      const seOrders = filteredOrders.filter((o) => o.assignedTo === se.id);
      const revenue = seOrders.reduce((s, o) => s + o.price, 0);
      const repeats = seOrders.filter((o) => o.isRepeat).length;
      return [se.name, se.email, String(seOrders.length), String(repeats), `৳${revenue}`];
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
      mockProducts.map((p) => [p.sku, p.title, `৳${p.price}`, String(p.packageDuration), p.info])
    );
    toast({ title: "Exported", description: `${mockProducts.length} products exported.` });
  };

  const exportAuditLogs = () => {
    downloadCSV(
      "audit_logs_export.csv",
      ["Action", "User", "Role", "Entity", "Details", "Timestamp"],
      logs.map((l) => [l.actionType, l.userName, l.role, l.entity, l.details || "", l.timestamp])
    );
    toast({ title: "Exported", description: `${logs.length} audit log entries exported.` });
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

  const exports = [
    { label: "All Orders", count: filteredOrders.length, action: exportOrders },
    { label: "Repeat Orders", count: filteredOrders.filter((o) => o.isRepeat).length, action: exportRepeatOrders },
    { label: "Sales Performance", count: mockSalesExecutives.length, action: exportPerformance },
    { label: "Products", count: mockProducts.length, action: exportProducts },
    { label: "Audit Logs", count: logs.length, action: exportAuditLogs },
  ];

  return (
    <AppLayout>
      <PageHeader title="Export & Backup" description="Export filtered data as CSV" />

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
              {mockSalesExecutives.map((se) => <SelectItem key={se.id} value={se.id}>{se.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Product</label>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="h-9 w-44 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {mockProducts.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Delivery</label>
          <Select value={deliveryFilter} onValueChange={setDeliveryFilter}>
            <SelectTrigger className="h-9 w-44 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {mockDeliveryPartners.filter((d) => d.active).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
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
