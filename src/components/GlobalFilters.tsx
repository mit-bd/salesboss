import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useProductStore } from "@/contexts/ProductStoreContext";
import { useOrderSources } from "@/hooks/useOrderSources";
import { useDeliveryMethods } from "@/hooks/useDeliveryMethods";
import { Filter, X } from "lucide-react";

export interface FilterState {
  dateFrom: string;
  dateTo: string;
  salesExecutive: string;
  product: string;
  orderSource: string;
  followupStep: string;
  deliveryMethod: string;
}

const EMPTY_FILTERS: FilterState = {
  dateFrom: "",
  dateTo: "",
  salesExecutive: "",
  product: "",
  orderSource: "",
  followupStep: "",
  deliveryMethod: "",
};



interface GlobalFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  showStepFilter?: boolean;
  showDeliveryFilter?: boolean;
}

export default function GlobalFilters({ filters, onChange, showStepFilter = true, showDeliveryFilter = true }: GlobalFiltersProps) {
  const [open, setOpen] = useState(false);
  const { sources: orderSources } = useOrderSources();
  const { methods: activePartners } = useDeliveryMethods({ activeOnly: true });
  const { members } = useTeamMembers();
  const { products } = useProductStore();

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  const update = (key: keyof FilterState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const reset = () => onChange({ ...EMPTY_FILTERS });

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(!open)}>
          <Filter className="h-3.5 w-3.5" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {Object.values(filters).filter((v) => v !== "").length}
            </span>
          )}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={reset}>
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </div>

      {open && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 p-4 rounded-xl border border-border bg-card card-shadow animate-fade-in">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
            <Input type="date" value={filters.dateFrom} onChange={(e) => update("dateFrom", e.target.value)} className="h-9 text-xs" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
            <Input type="date" value={filters.dateTo} onChange={(e) => update("dateTo", e.target.value)} className="h-9 text-xs" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Sales Executive</label>
            <Select value={filters.salesExecutive} onValueChange={(v) => update("salesExecutive", v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="__unassigned__">Unassigned</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Product</label>
            <Select value={filters.product} onValueChange={(v) => update("product", v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Order Source</label>
            <Select value={filters.orderSource} onValueChange={(v) => update("orderSource", v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {orderSources.map((s) => (
                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {showDeliveryFilter && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Delivery</label>
              <Select value={filters.deliveryMethod} onValueChange={(v) => update("deliveryMethod", v === "all" ? "" : v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {activePartners.map((dp) => (
                    <SelectItem key={dp.id} value={dp.id}>{dp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {showStepFilter && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Step</label>
              <Select value={filters.followupStep} onValueChange={(v) => update("followupStep", v === "all" ? "" : v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <SelectItem key={s} value={String(s)}>Step {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { EMPTY_FILTERS };
