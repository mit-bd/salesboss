import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { Product } from "@/types/data";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "./AuditLogContext";
import { useAuth } from "./AuthContext";
import { useToast } from "@/hooks/use-toast";

interface ProductStoreContextType {
  products: Product[];
  loading: boolean;
  addProduct: (product: Omit<Product, "id">, imageFile?: File) => Promise<void>;
  updateProduct: (updated: Product, imageFile?: File) => Promise<void>;
  refreshProducts: () => Promise<void>;
}

const ProductStoreContext = createContext<ProductStoreContextType | null>(null);

function mapRow(row: any): Product {
  return {
    id: row.id,
    title: row.title,
    sku: row.sku,
    price: Number(row.price),
    packageDuration: row.package_duration as 15 | 30,
    info: row.info || "",
    image: row.image_url || "",
  };
}

async function uploadImage(bucket: string, file: File, folder: string): Promise<string | null> {
  const ext = file.name.split(".").pop();
  const path = `${folder}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) {
    console.error("Image upload error:", error);
    return null;
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export function ProductStoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { addLog } = useAuditLog();
  const { user, profile, role } = useAuth();
  const { toast } = useToast();
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch products:", error);
      return;
    }
    if (isMounted.current) {
      setProducts((data || []).map(mapRow));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();

    const channel = supabase
      .channel("products-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "products" }, (payload) => {
        if (!isMounted.current) return;
        const p = mapRow(payload.new);
        setProducts((prev) => {
          if (prev.some((x) => x.id === p.id)) return prev;
          return [p, ...prev];
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "products" }, (payload) => {
        if (!isMounted.current) return;
        const p = mapRow(payload.new);
        setProducts((prev) => prev.map((x) => (x.id === p.id ? p : x)));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "products" }, (payload) => {
        if (!isMounted.current) return;
        const id = (payload.old as any).id;
        setProducts((prev) => prev.filter((x) => x.id !== id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchProducts]);

  const userName = profile?.full_name || user?.email || "Unknown";

  const addProduct = useCallback(
    async (product: Omit<Product, "id">, imageFile?: File) => {
      let imageUrl = product.image || "";

      if (imageFile) {
        const url = await uploadImage("product-images", imageFile, "products");
        if (url) imageUrl = url;
        else {
          toast({ title: "Image Upload Failed", description: "Could not upload product image.", variant: "destructive" });
        }
      }

      const { data, error } = await supabase
        .from("products")
        .insert({
          title: product.title,
          sku: product.sku,
          price: product.price,
          package_duration: product.packageDuration,
          info: product.info,
          image_url: imageUrl,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to create product:", error);
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }

      // Immediate local state update
      const newProduct = mapRow(data);
      setProducts((prev) => {
        if (prev.some((x) => x.id === newProduct.id)) return prev;
        return [newProduct, ...prev];
      });

      toast({ title: "Product created" });
      addLog({
        actionType: "Product Created",
        userName,
        role: role || "unknown",
        entity: product.title,
        details: `SKU: ${product.sku}, Price: ৳${product.price}`,
      });
    },
    [addLog, user, userName, role, toast]
  );

  const updateProduct = useCallback(
    async (updated: Product, imageFile?: File) => {
      let imageUrl = updated.image || "";

      if (imageFile) {
        const url = await uploadImage("product-images", imageFile, "products");
        if (url) imageUrl = url;
        else {
          toast({ title: "Image Upload Failed", description: "Could not upload product image.", variant: "destructive" });
        }
      }

      const { data, error } = await supabase
        .from("products")
        .update({
          title: updated.title,
          sku: updated.sku,
          price: updated.price,
          package_duration: updated.packageDuration,
          info: updated.info,
          image_url: imageUrl,
        })
        .eq("id", updated.id)
        .select()
        .single();

      if (error) {
        console.error("Failed to update product:", error);
        toast({ title: "Error", description: error.message, variant: "destructive" });
        throw error;
      }

      // Replace local state with confirmed DB data
      if (data) {
        const confirmed = mapRow(data);
        setProducts((list) => list.map((p) => (p.id === confirmed.id ? confirmed : p)));
      }

      toast({ title: "Product updated" });
      addLog({
        actionType: "Product Updated",
        userName,
        role: role || "unknown",
        entity: updated.title,
        details: `SKU: ${updated.sku}, Price: ৳${updated.price}`,
      });
    },
    [addLog, userName, role, toast]
  );

  return (
    <ProductStoreContext.Provider value={{ products, loading, addProduct, updateProduct, refreshProducts: fetchProducts }}>
      {children}
    </ProductStoreContext.Provider>
  );
}

export function useProductStore() {
  const ctx = useContext(ProductStoreContext);
  if (!ctx) throw new Error("useProductStore must be used within ProductStoreProvider");
  return ctx;
}
