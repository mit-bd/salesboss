import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { cn } from "@/lib/utils";
import { AlertTriangle, CalendarCheck, CheckCircle, Clock, Target } from "lucide-react";
import GlobalFilters, { FilterState, EMPTY_FILTERS } from "@/components/GlobalFilters";
import OrderTable from "@/components/OrderTable";
import CompleteFollowupDialog from "@/components/CompleteFollowupDialog";
import BulkActionBar from "@/components/BulkActionBar";
import BulkEditDialog from "@/components/BulkEditDialog";
import BulkSingleFieldDialog, { BulkFieldType } from "@/components/BulkSingleFieldDialog";
import BulkCompleteFollowupDialog from "@/components/BulkCompleteFollowupDialog";
import { useRole } from "@/contexts/RoleContext";
import { useAuth } from "@/contexts/AuthContext";
import { Order } from "@/types/data";
import { Button } from "@/components/ui/button";


const STEP_LABELS = ["1st Followup", "2nd Followup", "3rd Followup", "4th Followup", "5th Followup"];
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
    if (filters.salesExecutive === "__unassigned__" && o.assignedTo) return false;
    if (filters.salesExecutive && filters.salesExecutive !== "__unassigned__" && o.assignedTo !== filters.salesExecutive) return false;
    if (filters.product && o.productId !== filters.product) return false;
    if (filters.orderSource && o.orderSource !== filters.orderSource) return false;
    if (filters.deliveryMethod && o.deliveryMethod !== filters.deliveryMethod) return false;
    return true;
  });
}

export default function FollowupsPage() {
  const [searchParams] = useSearchParams();
  const initialStep = Number(searchParams.get("step")) || 1;
  const [activeStep, setActiveStep] = useState(initialStep);
  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");

  useEffect(() => {
    const step = Number(searchParams.get("step"));
    if (step >= 1 && step <= 5) {
      setActiveStep(step);
      setActiveTab("pending");
    }
  }, [searchParams]);

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [completeOrder, setCompleteOrder] = useState<Order | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [conflictIds, setConflictIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [singleFieldOpen, setSingleFieldOpen] = useState(false);
  const [singleFieldType, setSingleFieldType] = useState<BulkFieldType>("assignExecutive");
  const [bulkCompleteOpen, setBulkCompleteOpen] = useState(false);
  const { isAdmin } = useRole();
  const { profile } = useAuth();
  const { activeOrders, completeFollowup } = useOrderStore();


  const today = new Date().toISOString().slice(0, 10);

  const filteredOrders = applyFilters(activeOrders, filters);
  const stepOrders = filteredOrders.filter((o) => o.followupStep === activeStep);
  const pendingOrders = stepOrders.filter((o) => (o.currentStatus || "pending") === "pending");
  const completedOrders = stepOrders.filter((o) => (o.currentStatus || "pending") === "completed");
  const displayOrders = activeTab === "pending" ? pendingOrders : completedOrders;

  const todayPending = pendingOrders.filter((o) => o.followupDate === today);
  const todayCompleted = completedOrders.filter((o) => o.followupDate === today);
  const overdueOrders = pendingOrders.filter((o) => o.followupDate && o.followupDate < today);

  const stepCounts = [1, 2, 3, 4, 5].map((step) => {
    const atStep = filteredOrders.filter((o) => o.followupStep === step);
    return {
      step,
      label: STEP_LABELS[step - 1],
      pending: atStep.filter((o) => (o.currentStatus || "pending") === "pending").length,
      completed: atStep.filter((o) => (o.currentStatus || "pending") === "completed").length,
    };
  });

  const openSingleField = (type: BulkFieldType) => {
    setSingleFieldType(type);
    setSingleFieldOpen(true);
  };

  const clearSelection = () => { setSelectedIds(new Set()); setConflictIds(new Set()); };

  return (
    <AppLayout>
      <PageHeader title="Followups" description="5-step customer followup pipeline" />
      <GlobalFilters filters={filters} onChange={setFilters} showStepFilter={false} />

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {stepCounts.map((step, i) => {
          const c = STEP_COLORS[i];
          const isActive = activeStep === step.step;
          return (
            <button
              key={step.step}
              onClick={() => { setActiveStep(step.step); setActiveTab("pending"); setSelectedIds(new Set()); }}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 transition-fast min-w-[180px]",
                isActive ? `${c.bg} ${c.border} ${c.text} border-2` : "bg-card border-border hover:bg-muted/50"
              )}
            >
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold", isActive ? `${c.dot} text-primary-foreground` : "bg-muted text-muted-foreground")}>
                {step.step}
              </div>
              <div className="text-left">
                <p className={cn("text-sm font-semibold", isActive ? c.text : "text-foreground")}>{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.pending} pending · {step.completed} done</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-1 mb-4 rounded-lg bg-muted p-1 w-fit">
        <button
          onClick={() => setActiveTab("pending")}
          className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-fast", activeTab === "pending" ? "bg-card text-foreground card-shadow" : "text-muted-foreground hover:text-foreground")}
        >
          <Clock className="h-3 w-3" /> Pending ({pendingOrders.length})
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-fast", activeTab === "completed" ? "bg-card text-foreground card-shadow" : "text-muted-foreground hover:text-foreground")}
        >
          <CheckCircle className="h-3 w-3" /> Completed ({completedOrders.length})
        </button>
      </div>

      {/* Daily Target Summary for this step */}
      <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 card-shadow flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{pendingOrders.length}</p>
            <p className="text-xs text-muted-foreground">Total Pending</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 card-shadow flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
            <CalendarCheck className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{todayPending.length}</p>
            <p className="text-xs text-muted-foreground">Due Today</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 card-shadow flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{todayCompleted.length}</p>
            <p className="text-xs text-muted-foreground">Done Today</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 card-shadow flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{overdueOrders.length}</p>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </div>
        </div>
      </div>

      <div className="animate-fade-in" style={{ paddingBottom: selectedIds.size > 0 ? "72px" : undefined }}>
        <OrderTable
          orders={displayOrders}
          isAdmin={isAdmin}
          onCompleteFollowup={activeTab === "pending" ? (order) => setCompleteOrder(order) : undefined}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          conflictIds={conflictIds}
        />
      </div>

      {completeOrder && (
        <CompleteFollowupDialog
          order={completeOrder}
          open={!!completeOrder}
          onOpenChange={(open) => { if (!open) setCompleteOrder(null); }}
          onComplete={async (data) => {
            await completeFollowup(data);
            setCompleteOrder(null);
          }}
          
        />
      )}

      {isAdmin && (
        <>
          <BulkActionBar
            selectedCount={selectedIds.size}
            onClear={clearSelection}
            onBulkEdit={() => setBulkEditOpen(true)}
            onAssignExecutive={() => openSingleField("assignExecutive")}
            onChangeDeliveryMethod={() => openSingleField("deliveryMethod")}
            onChangeOrderSource={() => openSingleField("orderSource")}
            onUpdateFollowupDate={() => openSingleField("followupDate")}
            onCompleteFollowup={activeTab === "pending" ? () => setBulkCompleteOpen(true) : undefined}
          />
          <BulkEditDialog
            open={bulkEditOpen}
            onOpenChange={setBulkEditOpen}
            selectedIds={selectedIds}
            onComplete={clearSelection}
            onConflict={setConflictIds}
          />
          <BulkSingleFieldDialog
            open={singleFieldOpen}
            onOpenChange={setSingleFieldOpen}
            fieldType={singleFieldType}
            selectedIds={selectedIds}
            onComplete={clearSelection}
            onConflict={setConflictIds}
          />
          <BulkCompleteFollowupDialog
            open={bulkCompleteOpen}
            onOpenChange={setBulkCompleteOpen}
            selectedIds={selectedIds}
            activeStep={activeStep}
            onComplete={clearSelection}
            onConflict={setConflictIds}
          />
        </>
      )}
    </AppLayout>
  );
}
