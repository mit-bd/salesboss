import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Order } from "@/types/data";

function mapRow(row: any): Order {
  return {
    id: row.id,
    customerName: row.customer_name,
    mobile: row.mobile,
    address: row.address || "",
    orderSource: row.order_source || "Website",
    productId: row.product_id || "",
    productTitle: row.product_title || "",
    price: Number(row.price),
    note: row.note || "",
    followupStep: row.followup_step || 1,
    followupDate: row.followup_date || "",
    assignedTo: row.assigned_to || "",
    assignedToName: row.assigned_to_name || "",
    createdAt: row.created_at?.split("T")[0] || "",
    orderDate: row.order_date || "",
    deliveryDate: row.delivery_date || "",
    deliveryMethod: row.delivery_method || "",
    parentOrderId: row.parent_order_id || null,
    isRepeat: row.is_repeat || false,
    isUpsell: row.is_upsell || false,
    health: row.health || "new",
    isDeleted: row.is_deleted || false,
    invoiceId: row.invoice_id || row.id,
    currentStatus: row.current_status || "pending",
    itemDescription: row.item_description || "",
    productSku: row.product_sku || "",
    orderSequenceNumber: row.order_sequence_number || 0,
    generatedOrderId: row.generated_order_id || "",
    customerId: row.customer_id || "",
    updatedAt: row.updated_at || "",
  };
}

export interface ServerPaginationFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  salesExecutive?: string;
  product?: string;
  orderSource?: string;
  followupStep?: string;
  deliveryMethod?: string;
}

export function useServerPaginatedOrders(pageSize: number = 50) {
  const { profile, role } = useAuth();
  const projectId = profile?.project_id;

  const [orders, setOrders] = useState<Order[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ServerPaginationFilters>({});
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchPage = useCallback(async () => {
    if (role === "owner" || !projectId) { setLoading(false); return; }
    setLoading(true);

    try {
      // Build count query
      let countQuery = supabase.from("orders").select("*", { count: "exact", head: true });
      countQuery = (countQuery as any).eq("project_id", projectId).eq("is_deleted", false);

      // Apply filters to count
      if (filters.dateFrom) countQuery = (countQuery as any).gte("order_date", filters.dateFrom);
      if (filters.dateTo) countQuery = (countQuery as any).lte("order_date", filters.dateTo);
      if (filters.salesExecutive === "__unassigned__") countQuery = (countQuery as any).is("assigned_to", null);
      else if (filters.salesExecutive) countQuery = (countQuery as any).eq("assigned_to", filters.salesExecutive);
      if (filters.product) countQuery = (countQuery as any).eq("product_id", filters.product);
      if (filters.orderSource) countQuery = (countQuery as any).eq("order_source", filters.orderSource);
      if (filters.followupStep) countQuery = (countQuery as any).eq("followup_step", Number(filters.followupStep));
      if (filters.deliveryMethod) countQuery = (countQuery as any).eq("delivery_method", filters.deliveryMethod);
      if (filters.search) {
        countQuery = (countQuery as any).or(
          `customer_name.ilike.%${filters.search}%,mobile.ilike.%${filters.search}%,generated_order_id.ilike.%${filters.search}%,invoice_id.ilike.%${filters.search}%`
        );
      }

      const { count } = await countQuery;
      if (isMounted.current) setTotalCount(count || 0);

      // Build data query with pagination
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let dataQuery = supabase.from("orders").select("*").order("updated_at", { ascending: false }).range(from, to);
      dataQuery = (dataQuery as any).eq("project_id", projectId).eq("is_deleted", false);

      if (filters.dateFrom) dataQuery = (dataQuery as any).gte("order_date", filters.dateFrom);
      if (filters.dateTo) dataQuery = (dataQuery as any).lte("order_date", filters.dateTo);
      if (filters.salesExecutive === "__unassigned__") dataQuery = (dataQuery as any).is("assigned_to", null);
      else if (filters.salesExecutive) dataQuery = (dataQuery as any).eq("assigned_to", filters.salesExecutive);
      if (filters.product) dataQuery = (dataQuery as any).eq("product_id", filters.product);
      if (filters.orderSource) dataQuery = (dataQuery as any).eq("order_source", filters.orderSource);
      if (filters.followupStep) dataQuery = (dataQuery as any).eq("followup_step", Number(filters.followupStep));
      if (filters.deliveryMethod) dataQuery = (dataQuery as any).eq("delivery_method", filters.deliveryMethod);
      if (filters.search) {
        dataQuery = (dataQuery as any).or(
          `customer_name.ilike.%${filters.search}%,mobile.ilike.%${filters.search}%,generated_order_id.ilike.%${filters.search}%,invoice_id.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await dataQuery;
      if (error) { console.error("[ServerPagination] Fetch error:", error); return; }
      if (isMounted.current) setOrders((data || []).map(mapRow));
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [projectId, role, page, pageSize, filters]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  // Reset to page 0 when filters change
  const updateFilters = useCallback((newFilters: ServerPaginationFilters) => {
    setPage(0);
    setFilters(newFilters);
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    orders,
    totalCount,
    page,
    setPage,
    totalPages,
    loading,
    filters,
    updateFilters,
    refresh: fetchPage,
    pageSize,
  };
}
