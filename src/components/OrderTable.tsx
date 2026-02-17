import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Order } from "@/types/data";
import { mockDeliveryPartners } from "@/data/mockData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { cn } from "@/lib/utils";
import {
  Copy, Phone, MessageCircle, Plus, RefreshCw, Edit2,
  ChevronLeft, ChevronRight, Truck, Loader2, CheckCircle, User, ShoppingBag,
} from "lucide-react";

const stepLabels = ["1st Followup", "2nd Followup", "3rd Followup", "4th Followup", "5th Followup"];
const stepColors = [
  "bg-step-1/10 text-step-1", "bg-step-2/10 text-step-2", "bg-step-3/10 text-step-3",
  "bg-step-4/10 text-step-4", "bg-step-5/10 text-step-5",
];

function getDeliveryName(id: string): string {
  return mockDeliveryPartners.find((dp) => dp.id === id)?.name || id;
}

function truncate(str: string, len: number) {
  return str.length > len ? str.slice(0, len) + "…" : str;
}

interface OrderTableProps {
  orders: Order[];
  isAdmin: boolean;
  onEdit?: (order: Order) => void;
  onCompleteFollowup?: (order: Order) => void;
  pageSize?: number;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

export default function OrderTable({ orders, isAdmin, onEdit, onCompleteFollowup, pageSize = 20, selectedIds, onSelectionChange }: OrderTableProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { updateOrder, activeOrders } = useOrderStore();
  const [internalSelected, setInternalSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [noteOrderId, setNoteOrderId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Calculate total confirmed orders per mobile number
  const orderCountByMobile = useMemo(() => {
    const counts: Record<string, number> = {};
    activeOrders.forEach((o) => {
      if (o.mobile) {
        counts[o.mobile] = (counts[o.mobile] || 0) + 1;
      }
    });
    return counts;
  }, [activeOrders]);

  // Use external selection if provided, otherwise internal
  const selected = selectedIds ?? internalSelected;
  const setSelected = onSelectionChange ?? setInternalSelected;

  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize));
  const pageOrders = orders.slice(page * pageSize, (page + 1) * pageSize);

  const toggleAll = useCallback(() => {
    if (selected.size === pageOrders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pageOrders.map((o) => o.id)));
    }
  }, [pageOrders, selected, setSelected]);

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard.` });
  };

  const handleRowClick = (orderId: string, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-action]")) return;
    navigate(`/orders/${orderId}`);
  };

  const handleSaveNote = async (order: Order) => {
    setSavingNote(true);
    try {
      await updateOrder({ ...order, note: noteText });
      toast({ title: "Note Saved", description: "Order note updated successfully." });
      setNoteOrderId(null);
    } catch (err) {
      console.error("Note save error:", err);
      toast({ title: "Error", description: "Failed to save note.", variant: "destructive" });
    } finally {
      setSavingNote(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-3 w-10">
                <Checkbox checked={pageOrders.length > 0 && selected.size === pageOrders.length} onCheckedChange={toggleAll} data-action="true" />
              </th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground text-xs">Status</th>
              <th className="px-3 py-3 w-8"></th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground text-xs">Invoice / Product</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground text-xs">Customer / Orders</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground text-xs">Dates</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground text-xs">Address</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground text-xs">Delivery</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground text-xs">Payment (৳)</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground text-xs">Assigned</th>
              {(isAdmin || onCompleteFollowup) && <th className="px-3 py-3 w-16"></th>}
            </tr>
          </thead>
          <tbody>
            {pageOrders.length === 0 && (
              <tr>
                <td colSpan={(isAdmin || onCompleteFollowup) ? 11 : 10} className="px-4 py-16 text-center text-muted-foreground">No orders found</td>
              </tr>
            )}
            {pageOrders.map((order) => {
              const isCompleted = order.followupDate <= today;
              const paid = order.paidAmount || 0;
              const due = order.price - paid;
              const isAssigned = !!(order.assignedTo && order.assignedToName);

              return (
                <tr key={order.id} onClick={(e) => handleRowClick(order.id, e)} className="border-b border-border last:border-0 hover:bg-muted/30 transition-fast cursor-pointer group">
                  <td className="px-3 py-3" data-action="true">
                    <Checkbox checked={selected.has(order.id)} onCheckedChange={() => toggleOne(order.id)} data-action="true" />
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold w-fit", stepColors[order.followupStep - 1])}>
                        Step {order.followupStep}
                      </span>
                      <span className={cn("text-[10px] font-medium", isCompleted ? "text-success" : "text-warning")}>
                        {isCompleted ? "Completed" : "Pending"}
                      </span>
                    </div>
                  </td>

                  {/* Notes */}
                  <td className="px-1 py-3" data-action="true">
                    <Popover open={noteOrderId === order.id} onOpenChange={(open) => { if (!open) setNoteOrderId(null); }}>
                      <PopoverTrigger asChild>
                        <button data-action="true" onClick={(e) => { e.stopPropagation(); setNoteOrderId(order.id); setNoteText(order.note || ""); }} className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-fast" title="Add note">
                          <Plus className="h-3 w-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-3" data-action="true" onClick={(e) => e.stopPropagation()}>
                        <p className="text-xs font-medium text-foreground mb-2">Quick Note — {order.invoiceId || order.id}</p>
                        <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} placeholder="Add a note..." className="text-xs" />
                        <div className="flex justify-end mt-2">
                          <Button size="sm" className="h-7 text-xs" disabled={savingNote} onClick={() => handleSaveNote(order)}>
                            {savingNote && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Save
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </td>

                  {/* Invoice / Product */}
                  <td className="px-3 py-3">
                    <p className="font-semibold text-primary text-xs">{order.generatedOrderId || order.invoiceId || order.id}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{order.productTitle}</p>
                    {order.isRepeat && (
                      <Badge variant="outline" className="mt-1 gap-0.5 text-[9px] h-4 px-1 border-warning/30 text-warning">
                        <RefreshCw className="h-2.5 w-2.5" /> Repeat
                      </Badge>
                    )}
                    {order.isUpsell && (
                      <Badge variant="outline" className="mt-1 ml-1 text-[9px] h-4 px-1 border-success/30 text-success">Upsell</Badge>
                    )}
                  </td>

                  {/* Customer */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-foreground text-xs">{order.customerName}</p>
                      {orderCountByMobile[order.mobile] > 0 && (
                        <button
                          data-action="true"
                          onClick={(e) => { e.stopPropagation(); navigate(`/orders?search=${encodeURIComponent(order.mobile)}`); }}
                          className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary hover:bg-primary/20 transition-fast"
                          title={`Total orders by ${order.mobile}`}
                        >
                          <ShoppingBag className="h-2.5 w-2.5" />
                          {orderCountByMobile[order.mobile]}
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{order.mobile}</p>
                    <div className="flex items-center gap-1 mt-1" data-action="true">
                      <button data-action="true" onClick={(e) => { e.stopPropagation(); copyText(order.mobile, "Phone number"); }} className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-fast" title="Copy number">
                        <Copy className="h-2.5 w-2.5" />
                      </button>
                      <a data-action="true" href={`tel:${order.mobile}`} onClick={(e) => e.stopPropagation()} className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-fast" title="Call">
                        <Phone className="h-2.5 w-2.5" />
                      </a>
                      <a data-action="true" href={`https://wa.me/${order.mobile}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-success hover:bg-success/10 transition-fast" title="WhatsApp">
                        <MessageCircle className="h-2.5 w-2.5" />
                      </a>
                    </div>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">{order.orderSource}</p>
                  </td>

                  {/* Dates */}
                  <td className="px-3 py-3">
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground"><span className="text-muted-foreground/60">Ord:</span> {order.orderDate}</p>
                      <p className="text-[11px] text-muted-foreground"><span className="text-muted-foreground/60">Del:</span> {order.deliveryDate}</p>
                    </div>
                  </td>

                  {/* Address */}
                  <td className="px-3 py-3 max-w-[140px]">
                    <p className="text-[11px] text-muted-foreground leading-tight truncate" title={order.address}>{truncate(order.address, 30)}</p>
                    <button data-action="true" onClick={(e) => { e.stopPropagation(); copyText(order.address, "Address"); }} className="flex items-center gap-0.5 mt-0.5 text-[10px] text-muted-foreground/60 hover:text-foreground transition-fast">
                      <Copy className="h-2 w-2" /> Copy
                    </button>
                  </td>

                  {/* Delivery */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <Truck className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-[11px] text-foreground font-medium">{getDeliveryName(order.deliveryMethod)}</span>
                    </div>
                  </td>

                  {/* Payment */}
                  <td className="px-3 py-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-foreground">৳{order.price.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Paid: ৳{paid.toLocaleString()}</p>
                      {due > 0 && <p className="text-[10px] font-medium text-destructive">Due: ৳{due.toLocaleString()}</p>}
                    </div>
                  </td>

                  {/* Assigned */}
                  <td className="px-3 py-3">
                    {isAssigned ? (
                      <div className="flex items-center gap-1.5">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-2.5 w-2.5 text-primary" />
                        </div>
                        <div>
                          <span className="text-[11px] font-medium text-foreground">{order.assignedToName}</span>
                          <Badge variant="outline" className="ml-1.5 text-[8px] h-3.5 px-1 border-primary/20 text-primary">Assigned</Badge>
                        </div>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-warning/40 text-warning bg-warning/5">
                        Unassigned
                      </Badge>
                    )}
                  </td>

                  {/* Actions */}
                  {(isAdmin || onCompleteFollowup) && (
                    <td className="px-3 py-3" data-action="true">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-fast">
                        {onCompleteFollowup && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-success hover:text-success" data-action="true" title="Complete followup" onClick={(e) => { e.stopPropagation(); onCompleteFollowup(order); }}>
                            <CheckCircle className="h-3 w-3" />
                          </Button>
                        )}
                        {isAdmin && onEdit && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" data-action="true" onClick={(e) => { e.stopPropagation(); onEdit(order); }}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 bg-muted/30">
          <p className="text-xs text-muted-foreground">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, orders.length)} of {orders.length}</p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">{page + 1} / {totalPages}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
