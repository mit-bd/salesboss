import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { mockFollowupSteps } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { CheckCircle, Clock } from "lucide-react";
import GlobalFilters, { FilterState, EMPTY_FILTERS } from "@/components/GlobalFilters";
import OrderTable from "@/components/OrderTable";
import { useRole } from "@/contexts/RoleContext";
import { Order } from "@/types/data";

const STEP_COLORS = [
  { bg: "bg-step-1/10", border: "border-step-1/30", text: "text-step-1", dot: "bg-step-1" },
  { bg: "bg-step-2/10", border: "border-step-2/30", text: "text-step-2", dot: "bg-step-2" },
  { bg: "bg-step-3/10", border: "border-step-3/30", text: "text-step-3", dot: "bg-step-3" },
  { bg: "bg-step-4/10", border: "border-step-4/30", text: "text-step-4", dot: "bg-step-4" },
  { bg: "bg-step-5/10", border: "border-step-5/30", text: "text-step-5", dot: "bg-step-5" },
];

function applyFilters(orders: Order[], filters: FilterState): Order[] {
  return orders.filter((o) => {
    if (filters.dateFrom && o.orderDate < filters.dateFrom) return false;
    if (filters.dateTo && o.orderDate > filters.dateTo) return false;
    if (filters.salesExecutive && o.assignedTo !== filters.salesExecutive) return false;
    if (filters.product && o.productId !== filters.product) return false;
    if (filters.orderSource && o.orderSource !== filters.orderSource) return false;
    if (filters.deliveryMethod && o.deliveryMethod !== filters.deliveryMethod) return false;
    return true;
  });
}

export default function FollowupsPage() {
  const [activeStep, setActiveStep] = useState(1);
  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const { isAdmin } = useRole();
  const { activeOrders } = useOrderStore();

  const filteredOrders = applyFilters(activeOrders, filters);
  const stepOrders = filteredOrders.filter((o) => o.followupStep === activeStep);
  const today = "2026-02-15";
  const pendingOrders = stepOrders.filter((o) => o.followupDate > today);
  const completedOrders = stepOrders.filter((o) => o.followupDate <= today);
  const displayOrders = activeTab === "pending" ? pendingOrders : completedOrders;

  return (
    <AppLayout>
      <PageHeader title="Followups" description="5-step customer followup pipeline" />
      <GlobalFilters filters={filters} onChange={setFilters} showStepFilter={false} />

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {mockFollowupSteps.map((step, i) => {
          const c = STEP_COLORS[i];
          const isActive = activeStep === step.step;
          return (
            <button key={step.step} onClick={() => setActiveStep(step.step)} className={cn("flex items-center gap-3 rounded-xl border px-4 py-3 transition-fast min-w-[180px]", isActive ? `${c.bg} ${c.border} ${c.text} border-2` : "bg-card border-border hover:bg-muted/50")}>
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold", isActive ? `${c.dot} text-primary-foreground` : "bg-muted text-muted-foreground")}>{step.step}</div>
              <div className="text-left">
                <p className={cn("text-sm font-semibold", isActive ? c.text : "text-foreground")}>{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.pending} pending · {step.completed} done</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-1 mb-4 rounded-lg bg-muted p-1 w-fit">
        <button onClick={() => setActiveTab("pending")} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-fast", activeTab === "pending" ? "bg-card text-foreground card-shadow" : "text-muted-foreground hover:text-foreground")}>
          <Clock className="h-3 w-3" /> Pending ({pendingOrders.length})
        </button>
        <button onClick={() => setActiveTab("completed")} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-fast", activeTab === "completed" ? "bg-card text-foreground card-shadow" : "text-muted-foreground hover:text-foreground")}>
          <CheckCircle className="h-3 w-3" /> Completed ({completedOrders.length})
        </button>
      </div>

      <div className="animate-fade-in">
        <OrderTable orders={displayOrders} isAdmin={isAdmin} />
      </div>
    </AppLayout>
  );
}
