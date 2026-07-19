import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import { useProductStore } from "@/contexts/ProductStoreContext";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useDeliveryMethods } from "@/hooks/useDeliveryMethods";
import { useOrderSources } from "@/hooks/useOrderSources";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DuplicateOrderDialog, { DuplicateAction, DuplicateDetection } from "@/components/DuplicateOrderDialog";

interface FormErrors {
  customerName?: string;
  mobile?: string;
  address?: string;
  orderSource?: string;
  orderDate?: string;
  deliveryDate?: string;
  deliveryMethod?: string;
}

export default function CreateOrderDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { profile, user } = useAuth();
  const [errors, setErrors] = useState<FormErrors>({});
  const { methods: activePartners } = useDeliveryMethods({ activeOnly: true });
  const { sources: activeSources } = useOrderSources({ activeOnly: true });
  const { products } = useProductStore();
  const { addOrder } = useOrderStore();
  const { members } = useTeamMembers();

  const allExecutives = members.map((m) => ({ id: m.userId, name: m.name }));

  const [form, setForm] = useState({
    customerName: "",
    mobile: "",
    address: "",
    orderSource: "",
    productId: "",
    price: "",
    note: "",
    assignedTo: "",
    orderDate: new Date().toISOString().split("T")[0],
    deliveryDate: "",
    deliveryMethod: "",
    itemDescription: "",
  });

  const [dupOpen, setDupOpen] = useState(false);
  const [detection, setDetection] = useState<DuplicateDetection | null>(null);

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.customerName.trim()) e.customerName = "Name is required";
    if (!form.mobile.trim()) e.mobile = "Mobile is required";
    else if (!/^\d{10,15}$/.test(form.mobile.replace(/\s/g, ""))) e.mobile = "Invalid mobile number";
    if (!form.address.trim()) e.address = "Address is required";
    if (!form.orderSource) e.orderSource = "Order source is required";
    if (!form.orderDate) e.orderDate = "Order date is required";
    if (!form.deliveryDate) e.deliveryDate = "Delivery date is required";
    if (!form.deliveryMethod) e.deliveryMethod = "Delivery method is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleProductChange = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    setForm((f) => ({ ...f, productId, price: product ? String(product.price) : f.price }));
  };

  const resetForm = () => {
    setForm({ customerName: "", mobile: "", address: "", orderSource: "", productId: "", price: "", note: "", assignedTo: "", orderDate: new Date().toISOString().split("T")[0], deliveryDate: "", deliveryMethod: "", itemDescription: "" });
    setErrors({});
  };

  const performCreate = async () => {
    const product = products.find((p) => p.id === form.productId);
    const exec = allExecutives.find((se) => se.id === form.assignedTo);
    await addOrder({
      customerName: form.customerName.trim(),
      mobile: form.mobile.trim(),
      address: form.address.trim(),
      orderSource: form.orderSource,
      productId: form.productId,
      productTitle: product?.title || "",
      price: Number(form.price) || 0,
      note: form.note,
      followupStep: 1,
      followupDate: form.deliveryDate,
      assignedTo: form.assignedTo,
      assignedToName: exec?.name || "",
      createdAt: new Date().toISOString().split("T")[0],
      orderDate: form.orderDate,
      deliveryDate: form.deliveryDate,
      deliveryMethod: form.deliveryMethod,
      parentOrderId: null,
      isRepeat: false,
      health: "new",
      itemDescription: form.itemDescription,
    });
  };

  const logDupAudit = async (action: string, caseType: string) => {
    if (!profile?.project_id) return;
    await (supabase.from("duplicate_audit_log") as any).insert({
      project_id: profile.project_id,
      action,
      case_type: caseType,
      existing_order_id: detection?.duplicate_order_id ?? null,
      canonical_customer_id: detection?.customer_id ?? null,
      actor_user_id: user?.id ?? null,
      actor_name: profile?.full_name || user?.email || "unknown",
      reason: "manual_create_order",
      incoming_payload: { customerName: form.customerName, mobile: form.mobile, product: form.productId },
    });
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!profile?.project_id) {
      toast({ title: "No project context", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: det, error } = await supabase.rpc("detect_order_duplicate", {
        p_project_id: profile.project_id,
        p_mobile: form.mobile.trim(),
        p_external_order_id: null,
        p_tracking_code: null,
        p_invoice_no: null,
      });
      if (error) throw error;
      const detected = det as unknown as DuplicateDetection;

      if (detected && detected.case !== "none") {
        setDetection(detected);
        setDupOpen(true);
        setSaving(false);
        return;
      }
      await performCreate();
      toast({ title: "Order Created", description: `Order for ${form.customerName} created successfully.` });
      resetForm();
      setOpen(false);
    } catch (err: any) {
      console.error("Order create error:", err);
      toast({ title: "Error", description: err?.message || "Failed to create order.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDupAction = async (action: DuplicateAction) => {
    const caseType = detection?.case ?? "none";
    try {
      if (action === "cancel") { setDupOpen(false); return; }
      if (action === "skip") {
        await logDupAudit("skip", caseType);
        toast({ title: "Skipped", description: "Duplicate order skipped." });
        setDupOpen(false);
        return;
      }
      if (action === "open_profile") {
        await logDupAudit("open_profile", caseType);
        return;
      }
      if (action === "create_additional") {
        await performCreate();
        await logDupAudit("create_additional", caseType);
        toast({ title: "Order Created", description: `New order added for existing customer.` });
        setDupOpen(false); resetForm(); setOpen(false);
        return;
      }
      if (action === "update_existing" || action === "merge_orders") {
        if (!detection?.duplicate_order_id) return;
        const product = products.find((p) => p.id === form.productId);
        const isMerge = action === "merge_orders";
        // Merge = only contact/address/notes/product; Update = broader fields.
        const patch: Record<string, any> = isMerge
          ? {
              customer_name: form.customerName.trim() || undefined,
              address: form.address.trim() || undefined,
              note: form.note || undefined,
              product_id: form.productId || undefined,
              product_title: product?.title || undefined,
              delivery_method: form.deliveryMethod || undefined,
              updated_at: new Date().toISOString(),
            }
          : {
              customer_name: form.customerName.trim(),
              mobile: form.mobile.trim(),
              address: form.address.trim(),
              order_source: form.orderSource,
              product_id: form.productId || null,
              product_title: product?.title || "",
              price: Number(form.price) || 0,
              note: form.note,
              order_date: form.orderDate,
              delivery_date: form.deliveryDate || null,
              delivery_method: form.deliveryMethod,
              item_description: form.itemDescription || "",
              updated_at: new Date().toISOString(),
            };
        // Strip undefined for merge
        Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);
        const { error } = await (supabase.from("orders") as any)
          .update(patch)
          .eq("id", detection.duplicate_order_id);
        if (error) throw error;
        await logDupAudit(action, caseType);
        toast({ title: isMerge ? "Information Merged" : "Order Updated" });
        setDupOpen(false); resetForm(); setOpen(false);
      }
    } catch (err: any) {
      console.error("Duplicate action error:", err);
      toast({ title: "Action failed", description: err?.message || "Please try again.", variant: "destructive" });
    }
  };

  const update = (key: string, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as keyof FormErrors]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> New Order
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Customer Name *</Label>
                <Input value={form.customerName} onChange={(e) => update("customerName", e.target.value)} placeholder="Full name" className="mt-1" />
                {errors.customerName && <p className="text-xs text-destructive mt-1">{errors.customerName}</p>}
              </div>
              <div>
                <Label className="text-xs">Mobile Number *</Label>
                <Input value={form.mobile} onChange={(e) => update("mobile", e.target.value)} placeholder="01XXXXXXXXX" className="mt-1" />
                {errors.mobile && <p className="text-xs text-destructive mt-1">{errors.mobile}</p>}
              </div>
            </div>
            <div>
              <Label className="text-xs">Address *</Label>
              <Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Full address" className="mt-1" />
              {errors.address && <p className="text-xs text-destructive mt-1">{errors.address}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Order Source *</Label>
                <Select value={form.orderSource} onValueChange={(v) => update("orderSource", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>
                    {activeSources.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.orderSource && <p className="text-xs text-destructive mt-1">{errors.orderSource}</p>}
              </div>
              <div>
                <Label className="text-xs">Product</Label>
                <Select value={form.productId} onValueChange={handleProductChange}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.title} - ৳{p.price}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Order Date *</Label>
                <Input type="date" value={form.orderDate} onChange={(e) => update("orderDate", e.target.value)} className="mt-1" />
                {errors.orderDate && <p className="text-xs text-destructive mt-1">{errors.orderDate}</p>}
              </div>
              <div>
                <Label className="text-xs">Delivery Date *</Label>
                <Input type="date" value={form.deliveryDate} onChange={(e) => update("deliveryDate", e.target.value)} className="mt-1" />
                {errors.deliveryDate && <p className="text-xs text-destructive mt-1">{errors.deliveryDate}</p>}
              </div>
              <div>
                <Label className="text-xs">Delivery Method *</Label>
                <Select value={form.deliveryMethod} onValueChange={(v) => update("deliveryMethod", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {activePartners.map((dp) => <SelectItem key={dp.id} value={dp.id}>{dp.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.deliveryMethod && <p className="text-xs text-destructive mt-1">{errors.deliveryMethod}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Price (৳)</Label>
                <Input type="number" value={form.price} onChange={(e) => update("price", e.target.value)} placeholder="0" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Assign To</Label>
                <Select value={form.assignedTo} onValueChange={(v) => update("assignedTo", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select executive" /></SelectTrigger>
                  <SelectContent>
                    {allExecutives.map((se) => <SelectItem key={se.id} value={se.id}>{se.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Item Description *</Label>
              <Textarea value={form.itemDescription} onChange={(e) => update("itemDescription", e.target.value)} placeholder="Describe the items..." className="mt-1" rows={2} />
            </div>
            <div>
              <Label className="text-xs">Order Note</Label>
              <Textarea value={form.note} onChange={(e) => update("note", e.target.value)} placeholder="Any notes..." className="mt-1" rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Order
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DuplicateOrderDialog
        open={dupOpen}
        onOpenChange={setDupOpen}
        detection={detection}
        incomingSummary={{
          customerName: form.customerName,
          mobile: form.mobile,
          product: products.find((p) => p.id === form.productId)?.title,
          amount: Number(form.price) || 0,
        }}
        onAction={handleDupAction}
      />
    </>
  );
}
