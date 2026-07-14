import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useProductAliases } from "@/hooks/useProductAliases";
import { useProductStore } from "@/contexts/ProductStoreContext";
import { Plus, Trash2, Sparkles, Package } from "lucide-react";

export default function ProductAliasesPage() {
  const { toast } = useToast();
  const { aliases, loading, addAlias, deleteAlias } = useProductAliases();
  const { products } = useProductStore();
  const [open, setOpen] = useState(false);
  const [alias, setAlias] = useState("");
  const [productId, setProductId] = useState<string>("__none__");
  const [source, setSource] = useState("");

  const handleAdd = async () => {
    if (!alias.trim()) return;
    try {
      await addAlias({
        alias: alias.trim(),
        product_id: productId === "__none__" ? null : productId,
        source: source.trim() || null,
      });
      setAlias(""); setProductId("__none__"); setSource("");
      setOpen(false);
      toast({ title: "Alias added" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="AI Product Alias Library"
        description="Teach the AI Import Engine to recognize courier abbreviations and short codes for your products."
        action={
          <Button className="gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add alias
          </Button>
        }
      />

      <div className="max-w-4xl animate-fade-in">
        <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            AI uses these aliases while cleaning imports. Only Admin and Sub Admin can add or delete. AI never overwrites entries you have added here.
          </div>
          <div className="divide-y divide-border">
            {loading && <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>}
            {!loading && aliases.length === 0 && (
              <div className="p-6 text-center text-xs text-muted-foreground">No aliases yet. Add your first alias to help AI detect abbreviated products.</div>
            )}
            {aliases.map((a) => {
              const product = products.find((p) => p.id === a.product_id);
              return (
                <div key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{a.alias}</span>
                        <span className="text-muted-foreground">→</span>
                        <span>{product?.title || <span className="text-muted-foreground italic">Unlinked</span>}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                        {a.source && <Badge variant="outline" className="text-[9px] h-4 px-1">{a.source}</Badge>}
                        <span>Confidence {(a.confidence * 100).toFixed(0)}%</span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1 capitalize">{a.status}</Badge>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteAlias(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add product alias</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Alias / short code</Label>
              <Input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="e.g. SG15" />
            </div>
            <div>
              <Label className="text-xs">Maps to product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Choose product (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Unlinked —</SelectItem>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Source (optional)</Label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Courier / supplier name" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!alias.trim()}>Add alias</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
