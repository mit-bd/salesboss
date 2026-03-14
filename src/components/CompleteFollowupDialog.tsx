import { useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, CheckCircle, ChevronDown, Plus, X, ShoppingCart, RefreshCw, CalendarIcon } from "lucide-react";
import { Order, UpsellEntry, RepeatOrderEntry } from "@/types/data";
import { useProductStore } from "@/contexts/ProductStoreContext";
import { cn } from "@/lib/utils";

interface CompleteFollowupDialogProps {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (data: {
    orderId: string;
    stepNumber: number;
    note: string;
    problemsDiscussed: string;
    upsellAttempted: boolean;
    upsellDetails: string;
    nextFollowupDate: string | null;
    upsellEntries: UpsellEntry[];
    repeatOrderEntries: RepeatOrderEntry[];
  }) => Promise<void>;
}

function ProductEntryCard({
  entry,
  index,
  onChange,
  onRemove,
  products,
  label,
}: {
  entry: UpsellEntry | RepeatOrderEntry;
  index: number;
  onChange: (index: number, updated: UpsellEntry | RepeatOrderEntry) => void;
  onRemove: (index: number) => void;
  products: { id: string; title: string; price: number }[];
  label: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">{label} #{index + 1}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRemove(index)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div>
        <Label className="text-xs">Product *</Label>
        <Select
          value={entry.productId}
          onValueChange={(val) => {
            const product = products.find((p) => p.id === val);
            onChange(index, {
              ...entry,
              productId: val,
              productName: product?.title || "",
              price: product?.price || entry.price,
            });
          }}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select product" />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title} — ৳{p.price}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Price</Label>
        <Input
          type="number"
          value={entry.price}
          onChange={(e) => onChange(index, { ...entry, price: Number(e.target.value) })}
          className="mt-1"
        />
      </div>
      <div>
        <Label className="text-xs">Note</Label>
        <Textarea
          value={entry.note}
          onChange={(e) => onChange(index, { ...entry, note: e.target.value })}
          placeholder={`${label} note...`}
          className="mt-1"
          rows={2}
        />
      </div>
    </div>
  );
}

export default function CompleteFollowupDialog({
  order,
  open,
  onOpenChange,
  onComplete,
}: CompleteFollowupDialogProps) {
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [problems, setProblems] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [error, setError] = useState("");

  // Upsell state
  const [addUpsell, setAddUpsell] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [upsellEntries, setUpsellEntries] = useState<UpsellEntry[]>([]);

  // Repeat order state
  const [addRepeat, setAddRepeat] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [repeatEntries, setRepeatEntries] = useState<RepeatOrderEntry[]>([]);

  const { products } = useProductStore();
  const isFinalStep = order.followupStep === 5;

  const addUpsellEntry = () => {
    setUpsellEntries((prev) => [...prev, { productId: "", productName: "", price: 0, note: "" }]);
  };

  const addRepeatEntry = () => {
    setRepeatEntries((prev) => [...prev, { productId: "", productName: "", price: 0, note: "" }]);
  };

  const updateUpsellEntry = (i: number, updated: UpsellEntry | RepeatOrderEntry) => {
    setUpsellEntries((prev) => prev.map((e, idx) => (idx === i ? (updated as UpsellEntry) : e)));
  };

  const updateRepeatEntry = (i: number, updated: UpsellEntry | RepeatOrderEntry) => {
    setRepeatEntries((prev) => prev.map((e, idx) => (idx === i ? (updated as RepeatOrderEntry) : e)));
  };

  const removeUpsellEntry = (i: number) => {
    setUpsellEntries((prev) => prev.filter((_, idx) => idx !== i));
  };

  const removeRepeatEntry = (i: number) => {
    setRepeatEntries((prev) => prev.filter((_, idx) => idx !== i));
  };

  const totalUpsellValue = upsellEntries.reduce((sum, e) => sum + e.price, 0);
  const totalRepeatValue = repeatEntries.reduce((sum, e) => sum + e.price, 0);

  const handleSubmit = async () => {
    if (!note.trim()) {
      setError("Followup summary note is required");
      return;
    }
    if (!isFinalStep && !nextDate) {
      setError("Next followup date is required");
      return;
    }
    // Validate upsell entries have products selected
    if (addUpsell && upsellEntries.length > 0) {
      const invalid = upsellEntries.some((e) => !e.productId);
      if (invalid) {
        setError("Please select a product for all upsell entries");
        return;
      }
    }
    // Validate repeat entries have products selected
    if (addRepeat && repeatEntries.length > 0) {
      const invalid = repeatEntries.some((e) => !e.productId);
      if (invalid) {
        setError("Please select a product for all repeat order entries");
        return;
      }
    }

    setError("");
    setSaving(true);
    try {
      await onComplete({
        orderId: order.id,
        stepNumber: order.followupStep,
        note,
        problemsDiscussed: problems,
        upsellAttempted: addUpsell && upsellEntries.length > 0,
        upsellDetails: addUpsell ? upsellEntries.map((e) => e.productName).join(", ") : "",
        nextFollowupDate: isFinalStep ? null : nextDate,
        upsellEntries: addUpsell ? upsellEntries : [],
        repeatOrderEntries: addRepeat ? repeatEntries : [],
      });
      // Reset form
      setNote("");
      setProblems("");
      setAddUpsell(false);
      setUpsellEntries([]);
      setAddRepeat(false);
      setRepeatEntries([]);
      setNextDate("");
      onOpenChange(false);
    } catch {
      // Error handled by caller
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            Complete Step {order.followupStep} Followup
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Order Info */}
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-sm font-medium text-foreground">{order.customerName}</p>
            <p className="text-xs text-muted-foreground">{order.productTitle} · ৳{order.price}</p>
          </div>

          {/* Required Fields */}
          <div>
            <Label className="text-xs">Followup Summary Note *</Label>
            <Textarea
              value={note}
              onChange={(e) => { setNote(e.target.value); if (error) setError(""); }}
              placeholder="What was discussed during this followup..."
              className="mt-1"
              rows={3}
            />
          </div>

          <div>
            <Label className="text-xs">Problems Discussed</Label>
            <Textarea
              value={problems}
              onChange={(e) => setProblems(e.target.value)}
              placeholder="Any issues or concerns raised..."
              className="mt-1"
              rows={2}
            />
          </div>

          {/* Upsell Section */}
          <Collapsible open={upsellOpen} onOpenChange={setUpsellOpen}>
            <div className="rounded-lg border border-border">
              <div className="flex items-center gap-2 p-3">
                <Checkbox
                  id="add-upsell"
                  checked={addUpsell}
                  onCheckedChange={(checked) => {
                    setAddUpsell(!!checked);
                    if (checked) {
                      setUpsellOpen(true);
                      if (upsellEntries.length === 0) addUpsellEntry();
                    }
                  }}
                />
                <Label htmlFor="add-upsell" className="text-xs cursor-pointer flex items-center gap-1.5 flex-1">
                  <ShoppingCart className="h-3.5 w-3.5 text-info" /> Add Upsell
                </Label>
                {addUpsell && (
                  <>
                    <span className="text-xs text-muted-foreground">৳{totalUpsellValue}</span>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", upsellOpen && "rotate-180")} />
                      </Button>
                    </CollapsibleTrigger>
                  </>
                )}
              </div>
              {addUpsell && (
                <CollapsibleContent className="px-3 pb-3">
                  <div className="space-y-3">
                    {upsellEntries.map((entry, i) => (
                      <ProductEntryCard
                        key={i}
                        entry={entry}
                        index={i}
                        onChange={updateUpsellEntry}
                        onRemove={removeUpsellEntry}
                        products={products}
                        label="Upsell"
                      />
                    ))}
                    <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addUpsellEntry}>
                      <Plus className="h-3 w-3" /> Add Upsell
                    </Button>
                  </div>
                </CollapsibleContent>
              )}
            </div>
          </Collapsible>

          {/* Repeat Order Section */}
          <Collapsible open={repeatOpen} onOpenChange={setRepeatOpen}>
            <div className="rounded-lg border border-border">
              <div className="flex items-center gap-2 p-3">
                <Checkbox
                  id="add-repeat"
                  checked={addRepeat}
                  onCheckedChange={(checked) => {
                    setAddRepeat(!!checked);
                    if (checked) {
                      setRepeatOpen(true);
                      if (repeatEntries.length === 0) addRepeatEntry();
                    }
                  }}
                />
                <Label htmlFor="add-repeat" className="text-xs cursor-pointer flex items-center gap-1.5 flex-1">
                  <RefreshCw className="h-3.5 w-3.5 text-warning" /> Receive Repeat Order
                </Label>
                {addRepeat && (
                  <>
                    <span className="text-xs text-muted-foreground">৳{totalRepeatValue}</span>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", repeatOpen && "rotate-180")} />
                      </Button>
                    </CollapsibleTrigger>
                  </>
                )}
              </div>
              {addRepeat && (
                <CollapsibleContent className="px-3 pb-3">
                  <div className="space-y-3">
                    {repeatEntries.map((entry, i) => (
                      <ProductEntryCard
                        key={i}
                        entry={entry}
                        index={i}
                        onChange={updateRepeatEntry}
                        onRemove={removeRepeatEntry}
                        products={products}
                        label="Repeat Order"
                      />
                    ))}
                    <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addRepeatEntry}>
                      <Plus className="h-3 w-3" /> Add Repeat Order
                    </Button>
                  </div>
                </CollapsibleContent>
              )}
            </div>
          </Collapsible>

          {/* Next Followup Date */}
          {!isFinalStep && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Next Followup Date *</Label>
                <Input
                  type="date"
                  value={nextDate}
                  onChange={(e) => { setNextDate(e.target.value); if (error) setError(""); }}
                  className="mt-1"
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          {isFinalStep && (
            <div className="rounded-lg bg-success/10 p-3">
              <p className="text-xs font-medium text-success">
                This is the final step. Completing this will mark the order's followup lifecycle as fully completed.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Complete Step {order.followupStep}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
