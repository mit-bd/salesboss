import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { mockProducts } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Plus, Package } from "lucide-react";

export default function ProductsPage() {
  return (
    <AppLayout>
      <PageHeader title="Products" description="Manage your product catalog">
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
        {mockProducts.map((product) => (
          <div
            key={product.id}
            className="rounded-xl border border-border bg-card p-5 card-shadow hover:card-shadow-hover transition-fast cursor-pointer group"
          >
            <div className="flex h-24 items-center justify-center rounded-lg bg-muted mb-4">
              <Package className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">{product.title}</h3>
            <p className="text-xs text-muted-foreground mb-3">{product.info}</p>
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-foreground">₹{product.price}</span>
              <span className="text-xs text-muted-foreground">{product.packageDuration} days</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">SKU: {product.sku}</div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
