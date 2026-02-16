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
  orderDate: string;
  deliveryDate: string;
  deliveryMethod: string;
  parentOrderId: string | null;
  isRepeat: boolean;
  isUpsell?: boolean;
  health: "new" | "good" | "at-risk";
  isDeleted?: boolean;
  paidAmount?: number;
  invoiceId?: string;
  currentStatus?: "pending" | "completed";
}

export interface FollowupStep {
  step: number;
  label: string;
  pending: number;
  completed: number;
}

export interface FollowupHistoryEntry {
  id: string;
  orderId: string;
  stepNumber: number;
  note: string;
  problemsDiscussed: string;
  upsellAttempted: boolean;
  upsellDetails: string;
  nextFollowupDate: string | null;
  completedBy: string | null;
  completedByName: string;
  completedAt: string;
  editedBy?: string | null;
  editedAt?: string | null;
}

export interface UpsellRecord {
  id: string;
  followupId: string;
  productId: string | null;
  productName: string;
  price: number;
  note: string;
  addedBy: string | null;
  createdAt: string;
}

export interface RepeatOrderRecord {
  id: string;
  followupId: string;
  productId: string | null;
  productName: string;
  price: number;
  note: string;
  childOrderId: string | null;
  addedBy: string | null;
  createdAt: string;
}

export interface UpsellEntry {
  productId: string;
  productName: string;
  price: number;
  note: string;
}

export interface RepeatOrderEntry {
  productId: string;
  productName: string;
  price: number;
  note: string;
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

export interface DeliveryPartner {
  id: string;
  name: string;
  contactInfo: string;
  notes: string;
  active: boolean;
}

export type UserRole = "admin" | "sub_admin" | "sales_executive";

// Backup types
export interface BackupEntry {
  id: string;
  date: string;
  triggerType: "auto" | "manual";
  triggeredBy: string;
  status: "completed" | "in_progress" | "failed";
  recordCount: number;
  size: string;
}

// Email report types
export interface EmailReportConfig {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  recipients: string[];
  lastSent?: string;
}

// Sales target types
export interface SalesTarget {
  id: string;
  executiveId: string;
  type: "monthly" | "custom";
  startDate: string;
  endDate: string;
  targetRepeatOrders: number;
  targetRevenue: number;
  targetUpsellCount: number;
}

// Commission types
export interface CommissionConfig {
  executiveId: string;
  enabled: boolean;
  type: "percentage" | "fixed";
  rate: number;
}

export interface CommissionEntry {
  id: string;
  executiveId: string;
  orderId: string;
  orderDate: string;
  amount: number;
  status: "pending" | "paid";
  paidDate?: string;
  paymentNote?: string;
}
