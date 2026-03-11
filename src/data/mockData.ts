import { Order, Product, FollowupStep, DashboardMetrics, SalesExecutive, DeliveryPartner, BackupEntry, SalesTarget, CommissionConfig, CommissionEntry, EmailReportConfig } from "@/types/data";

export const mockDeliveryPartners: DeliveryPartner[] = [
  { id: "dp1", name: "Sundarban Courier", contactInfo: "01711-000001", notes: "Nationwide coverage", active: true },
  { id: "dp2", name: "SA Paribahan", contactInfo: "01711-000002", notes: "Dhaka metro only", active: true },
  { id: "dp3", name: "Pathao Courier", contactInfo: "01711-000003", notes: "Express delivery", active: true },
  { id: "dp4", name: "RedX", contactInfo: "01711-000004", notes: "", active: true },
  { id: "dp5", name: "Paperfly", contactInfo: "01711-000005", notes: "Fragile items specialist", active: false },
];

export const mockProducts: Product[] = [
  { id: "p1", title: "Herbal Wellness Kit", sku: "HWK-001", price: 2499, packageDuration: 30, image: "", info: "Complete herbal supplement package" },
  { id: "p2", title: "Daily Nutrition Pack", sku: "DNP-002", price: 1299, packageDuration: 15, image: "", info: "15-day nutrition essentials" },
  { id: "p3", title: "Premium Health Bundle", sku: "PHB-003", price: 4999, packageDuration: 30, image: "", info: "Premium health and wellness bundle" },
  { id: "p4", title: "Immunity Booster", sku: "IMB-004", price: 899, packageDuration: 15, image: "", info: "Immunity support formula" },
  { id: "p5", title: "Joint Care Plus", sku: "JCP-005", price: 1899, packageDuration: 30, image: "", info: "Advanced joint care supplement" },
];

export const mockSalesExecutives: SalesExecutive[] = [];

export const mockOrders: Order[] = [
  { id: "ORD-001", customerName: "Vikram Mehta", mobile: "9876543210", address: "12 MG Road, Mumbai", orderSource: "Website", productId: "p1", productTitle: "Herbal Wellness Kit", price: 2499, note: "Interested in long-term plan", followupStep: 2, followupDate: "2026-02-18", assignedTo: "se1", assignedToName: "Rahul Sharma", createdAt: "2026-02-01", orderDate: "2026-02-01", deliveryDate: "2026-02-05", deliveryMethod: "dp1", parentOrderId: null, isRepeat: false, health: "good" },
  { id: "ORD-002", customerName: "Sunita Reddy", mobile: "9876543211", address: "45 Jubilee Hills, Hyderabad", orderSource: "Phone Call", productId: "p3", productTitle: "Premium Health Bundle", price: 4999, note: "Premium customer", followupStep: 1, followupDate: "2026-02-16", assignedTo: "se2", assignedToName: "Priya Patel", createdAt: "2026-02-10", orderDate: "2026-02-10", deliveryDate: "2026-02-14", deliveryMethod: "dp2", parentOrderId: null, isRepeat: false, health: "new" },
  { id: "ORD-003", customerName: "Rajesh Gupta", mobile: "9876543212", address: "78 Sector 5, Noida", orderSource: "Referral", productId: "p2", productTitle: "Daily Nutrition Pack", price: 1299, note: "", followupStep: 4, followupDate: "2026-02-17", assignedTo: "se1", assignedToName: "Rahul Sharma", createdAt: "2026-01-20", orderDate: "2026-01-20", deliveryDate: "2026-01-24", deliveryMethod: "dp3", parentOrderId: null, isRepeat: false, health: "good" },
  { id: "ORD-004", customerName: "Anita Joshi", mobile: "9876543213", address: "23 Koregaon Park, Pune", orderSource: "Social Media", productId: "p4", productTitle: "Immunity Booster", price: 899, note: "First time buyer", followupStep: 1, followupDate: "2026-02-15", assignedTo: "se3", assignedToName: "Amit Kumar", createdAt: "2026-02-12", orderDate: "2026-02-12", deliveryDate: "2026-02-16", deliveryMethod: "dp4", parentOrderId: null, isRepeat: false, health: "at-risk" },
  { id: "ORD-005", customerName: "Vikram Mehta", mobile: "9876543210", address: "12 MG Road, Mumbai", orderSource: "Website", productId: "p1", productTitle: "Herbal Wellness Kit", price: 2499, note: "Repeat order", followupStep: 1, followupDate: "2026-02-20", assignedTo: "se1", assignedToName: "Rahul Sharma", createdAt: "2026-02-14", orderDate: "2026-02-14", deliveryDate: "2026-02-18", deliveryMethod: "dp1", parentOrderId: "ORD-001", isRepeat: true, health: "good" },
  { id: "ORD-006", customerName: "Deepak Verma", mobile: "9876543214", address: "90 Anna Nagar, Chennai", orderSource: "Website", productId: "p5", productTitle: "Joint Care Plus", price: 1899, note: "Needs consultation", followupStep: 3, followupDate: "2026-02-19", assignedTo: "se4", assignedToName: "Neha Singh", createdAt: "2026-01-28", orderDate: "2026-01-28", deliveryDate: "2026-02-01", deliveryMethod: "dp2", parentOrderId: null, isRepeat: false, health: "good" },
  { id: "ORD-007", customerName: "Kavita Nair", mobile: "9876543215", address: "56 Indiranagar, Bangalore", orderSource: "Phone Call", productId: "p3", productTitle: "Premium Health Bundle", price: 4999, note: "", followupStep: 5, followupDate: "2026-02-16", assignedTo: "se2", assignedToName: "Priya Patel", createdAt: "2026-01-10", orderDate: "2026-01-10", deliveryDate: "2026-01-14", deliveryMethod: "dp3", parentOrderId: null, isRepeat: false, health: "good" },
  { id: "ORD-008", customerName: "Mohan Das", mobile: "9876543216", address: "34 Salt Lake, Kolkata", orderSource: "Referral", productId: "p2", productTitle: "Daily Nutrition Pack", price: 1299, note: "Budget conscious", followupStep: 2, followupDate: "2026-02-18", assignedTo: "se3", assignedToName: "Amit Kumar", createdAt: "2026-02-05", orderDate: "2026-02-05", deliveryDate: "2026-02-09", deliveryMethod: "dp4", parentOrderId: null, isRepeat: false, health: "at-risk" },
  { id: "ORD-009", customerName: "Deepak Verma", mobile: "9876543214", address: "90 Anna Nagar, Chennai", orderSource: "Website", productId: "p5", productTitle: "Joint Care Plus", price: 1899, note: "Upsell from followup", followupStep: 1, followupDate: "2026-02-22", assignedTo: "se4", assignedToName: "Neha Singh", createdAt: "2026-02-10", orderDate: "2026-02-10", deliveryDate: "2026-02-14", deliveryMethod: "dp2", parentOrderId: "ORD-006", isRepeat: true, isUpsell: true, health: "good" },
];

export const mockFollowupSteps: FollowupStep[] = [
  { step: 1, label: "1st Followup", pending: 2, completed: 15 },
  { step: 2, label: "2nd Followup", pending: 2, completed: 12 },
  { step: 3, label: "3rd Followup", pending: 1, completed: 9 },
  { step: 4, label: "4th Followup", pending: 1, completed: 7 },
  { step: 5, label: "5th Followup", pending: 1, completed: 5 },
];

export const mockDashboardMetrics: DashboardMetrics = {
  totalOrders: 156,
  revenue: 387500,
  conversionRate: 34.2,
  repeatOrderRate: 22.8,
  followupCompletion: 78.5,
  upsellSuccessRate: 15.3,
};

// Backup mock data
export const mockBackups: BackupEntry[] = [
  { id: "bk-001", date: "2026-02-15T06:00:00Z", triggerType: "auto", triggeredBy: "System", status: "completed", recordCount: 156, size: "2.4 MB" },
  { id: "bk-002", date: "2026-02-14T06:00:00Z", triggerType: "auto", triggeredBy: "System", status: "completed", recordCount: 152, size: "2.3 MB" },
  { id: "bk-003", date: "2026-02-13T14:22:00Z", triggerType: "manual", triggeredBy: "Admin User", status: "completed", recordCount: 148, size: "2.2 MB" },
  { id: "bk-004", date: "2026-02-13T06:00:00Z", triggerType: "auto", triggeredBy: "System", status: "completed", recordCount: 148, size: "2.2 MB" },
  { id: "bk-005", date: "2026-02-12T06:00:00Z", triggerType: "auto", triggeredBy: "System", status: "failed", recordCount: 0, size: "0 B" },
  { id: "bk-006", date: "2026-02-11T06:00:00Z", triggerType: "auto", triggeredBy: "System", status: "completed", recordCount: 140, size: "2.1 MB" },
];

// Sales targets mock data
export const mockSalesTargets: SalesTarget[] = [
  { id: "st-001", executiveId: "se1", type: "monthly", startDate: "2026-02-01", endDate: "2026-02-28", targetRepeatOrders: 10, targetRevenue: 50000, targetUpsellCount: 5 },
  { id: "st-002", executiveId: "se2", type: "monthly", startDate: "2026-02-01", endDate: "2026-02-28", targetRepeatOrders: 12, targetRevenue: 60000, targetUpsellCount: 6 },
  { id: "st-003", executiveId: "se3", type: "monthly", startDate: "2026-02-01", endDate: "2026-02-28", targetRepeatOrders: 8, targetRevenue: 35000, targetUpsellCount: 4 },
  { id: "st-004", executiveId: "se4", type: "monthly", startDate: "2026-02-01", endDate: "2026-02-28", targetRepeatOrders: 10, targetRevenue: 45000, targetUpsellCount: 5 },
];

// Commission config mock data
export const mockCommissionConfigs: CommissionConfig[] = [
  { executiveId: "se1", enabled: true, type: "percentage", rate: 5 },
  { executiveId: "se2", enabled: true, type: "percentage", rate: 6 },
  { executiveId: "se3", enabled: false, type: "percentage", rate: 5 },
  { executiveId: "se4", enabled: true, type: "fixed", rate: 200 },
];

// Commission entries mock data
export const mockCommissionEntries: CommissionEntry[] = [
  { id: "cm-001", executiveId: "se1", orderId: "ORD-005", orderDate: "2026-02-14", amount: 125, status: "pending" },
  { id: "cm-002", executiveId: "se4", orderId: "ORD-009", orderDate: "2026-02-10", amount: 200, status: "paid", paidDate: "2026-02-12", paymentNote: "Bank transfer" },
];

// Email report config
export const mockEmailReportConfig: EmailReportConfig = {
  enabled: false,
  frequency: "daily",
  recipients: ["admin@salesboss.com"],
};
