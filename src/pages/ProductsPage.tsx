import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { mockProducts } from "@/data/mockData";
import { Package, Edit2 } from "lucide-react";
import CreateProductDialog from "@/components/CreateProductDialog";
import { Product } from "@/types/data";

export default function ProductsPage() {
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  return (
    <AppLayout>
      <PageHeader title="Products" description="Manage your product catalog">
        <CreateProductDialog />
      </PageHeader>

      {editProduct && (
        <CreateProductDialog editProduct={editProduct} onClose={() => setEditProduct(null)} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
        {mockProducts.map((product) => (
          <div
            key={product.id}
            className="rounded-xl border border-border bg-card p-5 card-shadow hover:card-shadow-hover transition-fast cursor-pointer group relative"
          >
            <button
              onClick={() => setEditProduct(product)}
              className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground opacity-0 group-hover:opacity-100 transition-fast hover:bg-muted"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <div className="flex h-24 items-center justify-center rounded-lg bg-muted mb-4">
              <Package className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">{product.title}</h3>
            <p className="text-xs text-muted-foreground mb-3">{product.info}</p>
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-foreground">৳{product.price}</span>
              <span className="text-xs text-muted-foreground">{product.packageDuration} days</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">SKU: {product.sku}</div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
