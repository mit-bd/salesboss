import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { mockSalesExecutives } from "@/data/mockData";
import { useProductStore } from "@/contexts/ProductStoreContext";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useDeliveryMethods } from "@/hooks/useDeliveryMethods";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FormErrors {
  customerName?: string;
  mobile?: string;
  address?: string;
  orderSource?: string;
  orderDate?: string;
  deliveryDate?: string;
  deliveryMethod?: string;
}

const ORDER_SOURCES = ["Website", "Phone Call", "Referral", "Social Media"];

export default function CreateOrderDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [errors, setErrors] = useState<FormErrors>({});
  const { methods: activePartners } = useDeliveryMethods({ activeOnly: true });
  const { products } = useProductStore();
  const { addOrder } = useOrderStore();
  const { members } = useTeamMembers();

  const allExecutives = [
    ...members.map((m) => ({ id: m.userId, name: m.name })),
    ...mockSalesExecutives.filter((se) => !members.some((m) => m.userId === se.id)).map((se) => ({ id: se.id, name: se.name })),
  ];

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
  });

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

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);

    const product = products.find((p) => p.id === form.productId);
    const exec = allExecutives.find((se) => se.id === form.assignedTo);

    try {
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
      });
      toast({ title: "Order Created", description: `Order for ${form.customerName} created successfully.` });
      setForm({ customerName: "", mobile: "", address: "", orderSource: "", productId: "", price: "", note: "", assignedTo: "", orderDate: new Date().toISOString().split("T")[0], deliveryDate: "", deliveryMethod: "" });
      setErrors({});
      setOpen(false);
    } catch (err) {
      console.error("Order create error:", err);
      toast({ title: "Error", description: "Failed to create order.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const update = (key: string, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as keyof FormErrors]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  return (
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
                  {ORDER_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
  );
}
