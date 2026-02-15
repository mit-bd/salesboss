import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Upload, Image, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProductStore } from "@/contexts/ProductStoreContext";
import { Product } from "@/types/data";

interface ProductFormErrors {
  title?: string;
  price?: string;
  sku?: string;
}

interface CreateProductDialogProps {
  editProduct?: Product | null;
  onClose?: () => void;
  trigger?: React.ReactNode;
}

export default function CreateProductDialog({ editProduct, onClose, trigger }: CreateProductDialogProps) {
  const [open, setOpen] = useState(!!editProduct);
  const { toast } = useToast();
  const { products, addProduct, updateProduct } = useProductStore();
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [imagePreview, setImagePreview] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    sku: "",
    price: "",
    packageDuration: "30",
    info: "",
  });

  useEffect(() => {
    if (editProduct) {
      setForm({
        title: editProduct.title,
        sku: editProduct.sku,
        price: String(editProduct.price),
        packageDuration: String(editProduct.packageDuration),
        info: editProduct.info,
      });
      setImagePreview(editProduct.image || "");
      setImageFile(null);
      setErrors({});
    } else {
      setForm({ title: "", sku: "", price: "", packageDuration: "30", info: "" });
      setImagePreview("");
      setImageFile(null);
      setErrors({});
    }
  }, [editProduct]);

  const validate = (): boolean => {
    const e: ProductFormErrors = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.price || Number(form.price) <= 0) e.price = "Valid price required";
    if (!form.sku.trim()) e.sku = "SKU is required";
    else {
      const duplicate = products.some(
        (p) => p.sku.toLowerCase() === form.sku.trim().toLowerCase() && p.id !== editProduct?.id
      );
      if (duplicate) e.sku = "SKU already exists";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);

    const productData = {
      title: form.title.trim(),
      sku: form.sku.trim(),
      price: Number(form.price),
      packageDuration: Number(form.packageDuration) as 15 | 30,
      info: form.info.trim(),
      image: editProduct?.image || "",
    };

    try {
      if (editProduct) {
        await updateProduct({ ...productData, id: editProduct.id }, imageFile || undefined);
        toast({ title: "Product Updated", description: `${productData.title} has been updated successfully.` });
      } else {
        await addProduct(productData, imageFile || undefined);
        toast({ title: "Product Created", description: `${productData.title} has been added successfully.` });
      }
      handleClose();
    } catch (err) {
      console.error("Product save error:", err);
      toast({ title: "Error", description: "Failed to save product.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setForm({ title: "", sku: "", price: "", packageDuration: "30", info: "" });
    setImagePreview("");
    setImageFile(null);
    setErrors({});
    onClose?.();
  };

  const update = (key: string, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as keyof ProductFormErrors]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  return (
    <Dialog open={editProduct ? true : open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(v); }}>
      {!editProduct && (
        <DialogTrigger asChild>
          {trigger || (
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Product
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editProduct ? "Edit Product" : "Add Product"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs">Product Image</Label>
            <div className="mt-1 flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 overflow-hidden">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <Image className="h-6 w-6 text-muted-foreground/50" />
                )}
              </div>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-fast">
                  <Upload className="h-3 w-3" /> Upload
                </span>
              </label>
            </div>
          </div>

          <div>
            <Label className="text-xs">Product Title *</Label>
            <Input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Product name" className="mt-1" />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">SKU *</Label>
              <Input value={form.sku} onChange={(e) => update("sku", e.target.value)} placeholder="SKU-001" className="mt-1" />
              {errors.sku && <p className="text-xs text-destructive mt-1">{errors.sku}</p>}
            </div>
            <div>
              <Label className="text-xs">Price (৳) *</Label>
              <Input type="number" value={form.price} onChange={(e) => update("price", e.target.value)} placeholder="0" className="mt-1" />
              {errors.price && <p className="text-xs text-destructive mt-1">{errors.price}</p>}
            </div>
          </div>
          <div>
            <Label className="text-xs">Package Duration</Label>
            <Select value={form.packageDuration} onValueChange={(v) => update("packageDuration", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Product Information</Label>
            <Textarea value={form.info} onChange={(e) => update("info", e.target.value)} placeholder="Description..." className="mt-1" rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editProduct ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
