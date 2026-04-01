import { useState, useEffect, useMemo } from "react";
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
import { Loader2, CheckCircle, ChevronDown, Plus, X, ShoppingCart, RefreshCw, CalendarIcon, Clock } from "lucide-react";
import { Order, UpsellEntry, RepeatOrderEntry } from "@/types/data";
import { useProductStore } from "@/contexts/ProductStoreContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFollowupProblems } from "@/hooks/useFollowupProblems";
import ProblemsQuickInfoSection from "@/components/followup/ProblemsQuickInfoSection";
import AiFollowupInsightPanel from "@/components/followup/AiFollowupInsightPanel";
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
    nextFollowupDatetime: string | null;
    upsellEntries: UpsellEntry[];
    repeatOrderEntries: RepeatOrderEntry[];
  }) => Promise<void>;
}

function ProductEntryCard({
  entry, index, onChange, onRemove, products, label,
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
            onChange(index, { ...entry, productId: val, productName: product?.title || "", price: product?.price || entry.price });
          }}
        >
          <SelectTrigger className="mt-1"><SelectValue placeholder="Select product" /></SelectTrigger>
          <SelectContent>
            {products.map((p) => (<SelectItem key={p.id} value={p.id}>{p.title} — ৳{p.price}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Price</Label>
        <Input type="number" value={entry.price} onChange={(e) => onChange(index, { ...entry, price: Number(e.target.value) })} className="mt-1" />
      </div>
      <div>
        <Label className="text-xs">Note</Label>
        <Textarea value={entry.note} onChange={(e) => onChange(index, { ...entry, note: e.target.value })} placeholder={`${label} note...`} className="mt-1" rows={2} />
      </div>
    </div>
  );
}

// Time picker helper
const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

export default function CompleteFollowupDialog({ order, open, onOpenChange, onComplete }: CompleteFollowupDialogProps) {
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [problems, setProblems] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [nextHour, setNextHour] = useState("04");
  const [nextMinute, setNextMinute] = useState("30");
  const [nextAmPm, setNextAmPm] = useState("PM");
  const [error, setError] = useState("");

  // Problems & Quick Info
  const [selectedProblems, setSelectedProblems] = useState<Set<string>>(new Set());
  const [quickInfoValues, setQuickInfoValues] = useState<Record<string, string>>({});
  const { role, profile } = useAuth();
  const isAdmin = role === "admin" || role === "sub_admin";
  const {
    problems: problemOptions,
    quickInfoFields,
    addProblem,
    updateProblem,
    deleteProblem,
    addQuickInfoField,
    deleteQuickInfoField,
  } = useFollowupProblems();

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

  // Auto-generate problems text from selections
  useEffect(() => {
    const selectedText = Array.from(selectedProblems).join(", ");
    setProblems(selectedText);
  }, [selectedProblems]);

  // Build quick info summary
  const quickInfoSummary = useMemo(() => {
    const parts: string[] = [];
    quickInfoFields.forEach((field) => {
      const val = quickInfoValues[field.id];
      if (val && val.trim()) {
        parts.push(`${field.label}: ${val}`);
      }
    });
    return parts.join(", ");
  }, [quickInfoValues, quickInfoFields]);

  // Build next followup datetime ISO string
  const nextFollowupDatetime = useMemo(() => {
    if (!nextDate) return null;
    let hour24 = parseInt(nextHour);
    if (nextAmPm === "PM" && hour24 !== 12) hour24 += 12;
    if (nextAmPm === "AM" && hour24 === 12) hour24 = 0;
    return `${nextDate}T${hour24.toString().padStart(2, "0")}:${nextMinute}:00`;
  }, [nextDate, nextHour, nextMinute, nextAmPm]);

  const formattedDateTime = useMemo(() => {
    if (!nextDate) return "";
    try {
      const dateStr = `${nextDate}T00:00:00`;
      const formatted = format(new Date(dateStr), "dd MMM yyyy");
      return `${formatted} - ${nextHour}:${nextMinute} ${nextAmPm}`;
    } catch {
      return "";
    }
  }, [nextDate, nextHour, nextMinute, nextAmPm]);

  const handleToggleProblem = (label: string) => {
    setSelectedProblems((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleQuickInfoChange = (fieldId: string, value: string) => {
    setQuickInfoValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleAddProblem = async (label: string) => {
    await addProblem(label, profile?.project_id);
  };

  const handleAddField = async (label: string, fieldType: string, options: string[]) => {
    await addQuickInfoField(label, fieldType, options, profile?.project_id);
  };

  const addUpsellEntry = () => setUpsellEntries((prev) => [...prev, { productId: "", productName: "", price: 0, note: "" }]);
  const addRepeatEntry = () => setRepeatEntries((prev) => [...prev, { productId: "", productName: "", price: 0, note: "" }]);
  const updateUpsellEntry = (i: number, updated: UpsellEntry | RepeatOrderEntry) => setUpsellEntries((prev) => prev.map((e, idx) => (idx === i ? (updated as UpsellEntry) : e)));
  const updateRepeatEntry = (i: number, updated: UpsellEntry | RepeatOrderEntry) => setRepeatEntries((prev) => prev.map((e, idx) => (idx === i ? (updated as RepeatOrderEntry) : e)));
  const removeUpsellEntry = (i: number) => setUpsellEntries((prev) => prev.filter((_, idx) => idx !== i));
  const removeRepeatEntry = (i: number) => setRepeatEntries((prev) => prev.filter((_, idx) => idx !== i));

  const totalUpsellValue = upsellEntries.reduce((sum, e) => sum + e.price, 0);
  const totalRepeatValue = repeatEntries.reduce((sum, e) => sum + e.price, 0);

  const handleSubmit = async () => {
    if (!note.trim()) { setError("Followup summary note is required"); return; }
    if (!isFinalStep && !nextDate) { setError("Next followup date & time is required"); return; }
    if (addUpsell && upsellEntries.some((e) => !e.productId)) { setError("Please select a product for all upsell entries"); return; }
    if (addRepeat && repeatEntries.some((e) => !e.productId)) { setError("Please select a product for all repeat order entries"); return; }

    let finalNote = note.trim();
    if (quickInfoSummary) finalNote += `\n\n📋 ${quickInfoSummary}`;

    setError("");
    setSaving(true);
    try {
      await onComplete({
        orderId: order.id,
        stepNumber: order.followupStep,
        note: finalNote,
        problemsDiscussed: problems,
        upsellAttempted: addUpsell && upsellEntries.length > 0,
        upsellDetails: addUpsell ? upsellEntries.map((e) => e.productName).join(", ") : "",
        nextFollowupDate: isFinalStep ? null : nextDate,
        nextFollowupDatetime: isFinalStep ? null : nextFollowupDatetime,
        upsellEntries: addUpsell ? upsellEntries : [],
        repeatOrderEntries: addRepeat ? repeatEntries : [],
      });
      setNote(""); setProblems(""); setSelectedProblems(new Set()); setQuickInfoValues({});
      setAddUpsell(false); setUpsellEntries([]); setAddRepeat(false); setRepeatEntries([]); setNextDate("");
      setNextHour("04"); setNextMinute("30"); setNextAmPm("PM");
      onOpenChange(false);
    } catch {
      // Error handled by caller
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

          {/* Two Column Layout: Problems + Quick Info | AI Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column: Note + Problems + Quick Info */}
            <div className="space-y-4">
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

              <div className="rounded-lg border border-border p-3 space-y-3">
                <ProblemsQuickInfoSection
                  problems={problemOptions}
                  quickInfoFields={quickInfoFields}
                  selectedProblems={selectedProblems}
                  onToggleProblem={handleToggleProblem}
                  quickInfoValues={quickInfoValues}
                  onQuickInfoChange={handleQuickInfoChange}
                  isAdmin={isAdmin}
                  onAddProblem={handleAddProblem}
                  onEditProblem={updateProblem}
                  onDeleteProblem={deleteProblem}
                  onAddQuickInfoField={handleAddField}
                  onDeleteQuickInfoField={deleteQuickInfoField}
                />
                {problems && (
                  <div className="rounded bg-muted/50 p-2">
                    <p className="text-xs text-muted-foreground">Selected: <span className="text-foreground">{problems}</span></p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: AI Panel */}
            <div className="space-y-4">
              <AiFollowupInsightPanel
                customerName={order.customerName}
                productTitle={order.productTitle}
                productPrice={order.price}
                stepNumber={order.followupStep}
                selectedProblems={Array.from(selectedProblems)}
                quickInfoSummary={quickInfoSummary}
                products={products}
              />
            </div>
          </div>

          {/* Upsell Section */}
          <Collapsible open={upsellOpen} onOpenChange={setUpsellOpen}>
            <div className="rounded-lg border border-border">
              <div className="flex items-center gap-2 p-3">
                <Checkbox id="add-upsell" checked={addUpsell} onCheckedChange={(checked) => { setAddUpsell(!!checked); if (checked) { setUpsellOpen(true); if (upsellEntries.length === 0) addUpsellEntry(); } }} />
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
                      <ProductEntryCard key={i} entry={entry} index={i} onChange={updateUpsellEntry} onRemove={removeUpsellEntry} products={products} label="Upsell" />
                    ))}
                    <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addUpsellEntry}><Plus className="h-3 w-3" /> Add Upsell</Button>
                  </div>
                </CollapsibleContent>
              )}
            </div>
          </Collapsible>

          {/* Repeat Order Section */}
          <Collapsible open={repeatOpen} onOpenChange={setRepeatOpen}>
            <div className="rounded-lg border border-border">
              <div className="flex items-center gap-2 p-3">
                <Checkbox id="add-repeat" checked={addRepeat} onCheckedChange={(checked) => { setAddRepeat(!!checked); if (checked) { setRepeatOpen(true); if (repeatEntries.length === 0) addRepeatEntry(); } }} />
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
                      <ProductEntryCard key={i} entry={entry} index={i} onChange={updateRepeatEntry} onRemove={removeRepeatEntry} products={products} label="Repeat Order" />
                    ))}
                    <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addRepeatEntry}><Plus className="h-3 w-3" /> Add Repeat Order</Button>
                  </div>
                </CollapsibleContent>
              )}
            </div>
          </Collapsible>

          {/* Next Followup Date + Time */}
          {!isFinalStep && (
            <div className="space-y-3">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Next Followup Date & Time *
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Date Picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !nextDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {nextDate ? format(new Date(nextDate + "T00:00:00"), "dd MMM yyyy") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start" side="top">
                    <Calendar
                      mode="single"
                      selected={nextDate ? new Date(nextDate + "T00:00:00") : undefined}
                      onSelect={(date) => { if (date) { setNextDate(format(date, "yyyy-MM-dd")); if (error) setError(""); } }}
                      disabled={(date) => date < new Date(new Date().toDateString())}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>

                {/* Time Picker */}
                <div className="flex items-center gap-2">
                  <Select value={nextHour} onValueChange={setNextHour}>
                    <SelectTrigger className="w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((h) => (<SelectItem key={h} value={h}>{h}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm font-medium text-muted-foreground">:</span>
                  <Select value={nextMinute} onValueChange={setNextMinute}>
                    <SelectTrigger className="w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MINUTES.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Select value={nextAmPm} onValueChange={setNextAmPm}>
                    <SelectTrigger className="w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {formattedDateTime && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Scheduled: {formattedDateTime}
                </p>
              )}
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
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
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
