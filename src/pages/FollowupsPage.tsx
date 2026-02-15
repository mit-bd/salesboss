import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { mockOrders, mockFollowupSteps } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { Calendar, MessageSquare, ChevronRight } from "lucide-react";

const STEP_COLORS = [
  { bg: "bg-step-1/10", border: "border-step-1/30", text: "text-step-1", dot: "bg-step-1" },
  { bg: "bg-step-2/10", border: "border-step-2/30", text: "text-step-2", dot: "bg-step-2" },
  { bg: "bg-step-3/10", border: "border-step-3/30", text: "text-step-3", dot: "bg-step-3" },
  { bg: "bg-step-4/10", border: "border-step-4/30", text: "text-step-4", dot: "bg-step-4" },
  { bg: "bg-step-5/10", border: "border-step-5/30", text: "text-step-5", dot: "bg-step-5" },
];

export default function FollowupsPage() {
  const [activeStep, setActiveStep] = useState(1);
  const stepOrders = mockOrders.filter((o) => o.followupStep === activeStep);

  return (
    <AppLayout>
      <PageHeader title="Followups" description="5-step customer followup pipeline" />

      {/* Step Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {mockFollowupSteps.map((step, i) => {
          const c = STEP_COLORS[i];
          const isActive = activeStep === step.step;
          return (
            <button
              key={step.step}
              onClick={() => setActiveStep(step.step)}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 transition-fast min-w-[180px]",
                isActive
                  ? `${c.bg} ${c.border} ${c.text} border-2`
                  : "bg-card border-border hover:bg-muted/50"
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

      {/* Orders in step */}
      <div className="space-y-3 animate-fade-in">
        {stepOrders.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground card-shadow">
            No orders in this step
          </div>
        )}
        {stepOrders.map((order) => (
          <div
            key={order.id}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 card-shadow hover:card-shadow-hover transition-fast cursor-pointer group"
          >
            <div className={cn("h-10 w-1 rounded-full", STEP_COLORS[activeStep - 1].dot)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-foreground">{order.customerName}</p>
                <span className="text-xs text-muted-foreground">#{order.id}</span>
                {order.isRepeat && (
                  <span className="text-[10px] font-medium rounded px-1.5 py-0.5 bg-warning/10 text-warning">REPEAT</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{order.productTitle} · ₹{order.price}</p>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span className="text-xs">{order.followupDate}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="text-xs">{order.assignedToName}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-fast" />
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
