import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Product } from "@/types/data";
import { mockProducts as initialProducts } from "@/data/mockData";
import { useAuditLog } from "./AuditLogContext";

interface ProductStoreContextType {
  products: Product[];
  addProduct: (product: Omit<Product, "id">) => void;
  updateProduct: (updated: Product) => void;
}

const ProductStoreContext = createContext<ProductStoreContextType | null>(null);

let productCounter = initialProducts.length;

export function ProductStoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(initialProducts.map((p) => ({ ...p })));
  const { addLog } = useAuditLog();

  const addProduct = useCallback(
    (product: Omit<Product, "id">) => {
      productCounter++;
      const newProduct: Product = { ...product, id: `p${productCounter}` };
      setProducts((prev) => [...prev, newProduct]);
      addLog({
        actionType: "Product Created",
        userName: "Admin User",
        role: "admin",
        entity: newProduct.title,
        details: `SKU: ${newProduct.sku}, Price: ৳${newProduct.price}`,
      });
    },
    [addLog]
  );

  const updateProduct = useCallback(
    (updated: Product) => {
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      addLog({
        actionType: "Product Updated",
        userName: "Admin User",
        role: "admin",
        entity: updated.title,
        details: `SKU: ${updated.sku}, Price: ৳${updated.price}`,
      });
    },
    [addLog]
  );

  return (
    <ProductStoreContext.Provider value={{ products, addProduct, updateProduct }}>
      {children}
    </ProductStoreContext.Provider>
  );
}

export function useProductStore() {
  const ctx = useContext(ProductStoreContext);
  if (!ctx) throw new Error("useProductStore must be used within ProductStoreProvider");
  return ctx;
}
