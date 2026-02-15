export interface Product {
  id: string;
  title: string;
  sku: string;
  price: number;
  packageDuration: 15 | 30;
  image: string;
  info: string;
}

export interface Order {
  id: string;
  customerName: string;
  mobile: string;
  address: string;
  orderSource: string;
  productId: string;
  productTitle: string;
  price: number;
  note: string;
  followupStep: number;
  followupDate: string;
  assignedTo: string;
  assignedToName: string;
  createdAt: string;
  parentOrderId: string | null;
  isRepeat: boolean;
  health: "new" | "good" | "at-risk";
}

export interface FollowupStep {
  step: number;
  label: string;
  pending: number;
  completed: number;
}

export interface DashboardMetrics {
  totalOrders: number;
  revenue: number;
  conversionRate: number;
  repeatOrderRate: number;
  followupCompletion: number;
  upsellSuccessRate: number;
}

export interface SalesExecutive {
  id: string;
  name: string;
  email: string;
  assignedOrders: number;
  completedFollowups: number;
}

export type UserRole = "admin" | "sub_admin" | "sales_executive";
