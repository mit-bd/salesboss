import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { useAuth } from "@/contexts/AuthContext";
import { useProductStore } from "@/contexts/ProductStoreContext";
import { TrendingUp, DollarSign, Package, ChevronRight, Search, ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpsellRow {
  id: string;
  parentOrderId: string;
  parentInvoiceId: string;
  customerName: string;
  mobile: string;
  productName: string;
  productId: string | null;
  price: number;
  confirmedBy: string;
  step: number;
  confirmDate: string;
}

export default function UpsellPage() {
  const navigate = useNavigate();
  const { activeOrders, followupHistory, upsellRecords } = useOrderStore();
  const { products } = useProductStore();
  const { user, role } = useAuth();

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [execFilter, setExecFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Build enriched upsell rows
  const allRows = useMemo(() => {
    const rows: UpsellRow[] = [];
    for (const rec of upsellRecords) {
      const followup = followupHistory.find((h) => h.id === rec.followupId);
      if (!followup) continue;

      // SE role restriction
      if (role === "sales_executive" && user && rec.addedBy !== user.id) continue;

      const order = activeOrders.find((o) => o.id === followup.orderId);
      if (!order) continue;

      rows.push({
        id: rec.id,
        parentOrderId: order.id,
        parentInvoiceId: order.invoiceId || order.id,
        customerName: order.customerName,
        mobile: order.mobile,
        productName: rec.productName,
        productId: rec.productId,
        price: rec.price,
        confirmedBy: followup.completedByName,
        step: followup.stepNumber,
        confirmDate: followup.completedAt?.split("T")[0] || rec.createdAt?.split("T")[0] || "",
      });
    }
    return rows.sort((a, b) => b.confirmDate.localeCompare(a.confirmDate));
  }, [upsellRecords, followupHistory, activeOrders, role, user]);

  // Get unique executives for filter
  const executives = useMemo(() => {
    const map = new Map<string, string>();
    allRows.forEach((r) => { if (r.confirmedBy) map.set(r.confirmedBy, r.confirmedBy); });
    return Array.from(map.values());
  }, [allRows]);

  // Apply filters
  const filtered = useMemo(() => {
    return allRows.filter((r) => {
      if (dateFrom && r.confirmDate < dateFrom) return false;
      if (dateTo && r.confirmDate > dateTo) return false;
      if (execFilter && r.confirmedBy !== execFilter) return false;
      if (productFilter && r.productId !== productFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!r.customerName.toLowerCase().includes(s) && !r.mobile.includes(s)) return false;
      }
      return true;
    });
  }, [allRows, dateFrom, dateTo, execFilter, productFilter, search]);

  // Analytics
  const totalCount = filtered.length;
  const totalRevenue = filtered.reduce((s, r) => s + r.price, 0);

  const productBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    filtered.forEach((r) => {
      const key = r.productId || r.productName;
      const existing = map.get(key) || { name: r.productName, count: 0, revenue: 0 };
      existing.count++;
      existing.revenue += r.price;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  const hasActiveFilters = dateFrom || dateTo || execFilter || productFilter;

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setExecFilter("");
    setProductFilter("");
  };

  return (
    <AppLayout>
      <PageHeader title="Upsell" description="Track upsell products from followup interactions" />

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-fade-in">
        <div className="rounded-xl border border-border bg-card p-4 card-shadow">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Upsells</p>
              <p className="text-xl font-bold text-foreground">{totalCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 card-shadow">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10">
              <DollarSign className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-xl font-bold text-foreground">৳{totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 card-shadow">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10">
              <Package className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Products</p>
              <p className="text-xl font-bold text-foreground">{productBreakdown.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Product Breakdown */}
      {productBreakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 card-shadow mb-6 animate-fade-in">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Product Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {productBreakdown.map((p) => (
              <div key={p.name} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-foreground">{p.count} upsells</span>
                  <span className="text-xs font-medium text-foreground">৳{p.revenue.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex items-center gap-3 mb-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search name or mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8 text-xs"
          />
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setFiltersOpen(!filtersOpen)}>
          <Filter className="h-3.5 w-3.5" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">!</span>
          )}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={clearFilters}>
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </div>

      {filtersOpen && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl border border-border bg-card card-shadow animate-fade-in mb-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 text-xs" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 text-xs" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Confirmed By</label>
            <Select value={execFilter} onValueChange={(v) => setExecFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {executives.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Product</label>
            <Select value={productFilter} onValueChange={(v) => setProductFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Upsell List */}
      <div className="space-y-3 animate-fade-in">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground card-shadow">No upsell records found</div>
        )}
        {filtered.map((row) => (
          <div key={row.id} onClick={() => navigate(`/orders/${row.parentOrderId}`)} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 card-shadow hover:card-shadow-hover transition-fast cursor-pointer">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <ArrowUpRight className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-foreground">{row.customerName}</p>
                <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary">Upsell</span>
                <span className="text-xs text-muted-foreground">Parent: #{row.parentInvoiceId}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{row.mobile}</span>
                <span>{row.productName}</span>
                <span className="font-medium text-foreground">৳{row.price.toLocaleString()}</span>
                <span>Step {row.step}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">By {row.confirmedBy}</p>
              <p className="text-xs text-muted-foreground">{row.confirmDate}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
