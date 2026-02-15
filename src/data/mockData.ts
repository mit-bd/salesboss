import { Order, Product, FollowupStep, DashboardMetrics, SalesExecutive } from "@/types/data";

export const mockProducts: Product[] = [
  { id: "p1", title: "Herbal Wellness Kit", sku: "HWK-001", price: 2499, packageDuration: 30, image: "", info: "Complete herbal supplement package" },
  { id: "p2", title: "Daily Nutrition Pack", sku: "DNP-002", price: 1299, packageDuration: 15, image: "", info: "15-day nutrition essentials" },
  { id: "p3", title: "Premium Health Bundle", sku: "PHB-003", price: 4999, packageDuration: 30, image: "", info: "Premium health and wellness bundle" },
  { id: "p4", title: "Immunity Booster", sku: "IMB-004", price: 899, packageDuration: 15, image: "", info: "Immunity support formula" },
  { id: "p5", title: "Joint Care Plus", sku: "JCP-005", price: 1899, packageDuration: 30, image: "", info: "Advanced joint care supplement" },
];

export const mockSalesExecutives: SalesExecutive[] = [
  { id: "se1", name: "Rahul Sharma", email: "rahul@example.com", assignedOrders: 24, completedFollowups: 89 },
  { id: "se2", name: "Priya Patel", email: "priya@example.com", assignedOrders: 31, completedFollowups: 112 },
  { id: "se3", name: "Amit Kumar", email: "amit@example.com", assignedOrders: 18, completedFollowups: 67 },
  { id: "se4", name: "Neha Singh", email: "neha@example.com", assignedOrders: 27, completedFollowups: 95 },
];

export const mockOrders: Order[] = [
  { id: "ORD-001", customerName: "Vikram Mehta", mobile: "9876543210", address: "12 MG Road, Mumbai", orderSource: "Website", productId: "p1", productTitle: "Herbal Wellness Kit", price: 2499, note: "Interested in long-term plan", followupStep: 2, followupDate: "2026-02-18", assignedTo: "se1", assignedToName: "Rahul Sharma", createdAt: "2026-02-01", parentOrderId: null, isRepeat: false, health: "good" },
  { id: "ORD-002", customerName: "Sunita Reddy", mobile: "9876543211", address: "45 Jubilee Hills, Hyderabad", orderSource: "Phone Call", productId: "p3", productTitle: "Premium Health Bundle", price: 4999, note: "Premium customer", followupStep: 1, followupDate: "2026-02-16", assignedTo: "se2", assignedToName: "Priya Patel", createdAt: "2026-02-10", parentOrderId: null, isRepeat: false, health: "new" },
  { id: "ORD-003", customerName: "Rajesh Gupta", mobile: "9876543212", address: "78 Sector 5, Noida", orderSource: "Referral", productId: "p2", productTitle: "Daily Nutrition Pack", price: 1299, note: "", followupStep: 4, followupDate: "2026-02-17", assignedTo: "se1", assignedToName: "Rahul Sharma", createdAt: "2026-01-20", parentOrderId: null, isRepeat: false, health: "good" },
  { id: "ORD-004", customerName: "Anita Joshi", mobile: "9876543213", address: "23 Koregaon Park, Pune", orderSource: "Social Media", productId: "p4", productTitle: "Immunity Booster", price: 899, note: "First time buyer", followupStep: 1, followupDate: "2026-02-15", assignedTo: "se3", assignedToName: "Amit Kumar", createdAt: "2026-02-12", parentOrderId: null, isRepeat: false, health: "at-risk" },
  { id: "ORD-005", customerName: "Vikram Mehta", mobile: "9876543210", address: "12 MG Road, Mumbai", orderSource: "Website", productId: "p1", productTitle: "Herbal Wellness Kit", price: 2499, note: "Repeat order", followupStep: 1, followupDate: "2026-02-20", assignedTo: "se1", assignedToName: "Rahul Sharma", createdAt: "2026-02-14", parentOrderId: "ORD-001", isRepeat: true, health: "good" },
  { id: "ORD-006", customerName: "Deepak Verma", mobile: "9876543214", address: "90 Anna Nagar, Chennai", orderSource: "Website", productId: "p5", productTitle: "Joint Care Plus", price: 1899, note: "Needs consultation", followupStep: 3, followupDate: "2026-02-19", assignedTo: "se4", assignedToName: "Neha Singh", createdAt: "2026-01-28", parentOrderId: null, isRepeat: false, health: "good" },
  { id: "ORD-007", customerName: "Kavita Nair", mobile: "9876543215", address: "56 Indiranagar, Bangalore", orderSource: "Phone Call", productId: "p3", productTitle: "Premium Health Bundle", price: 4999, note: "", followupStep: 5, followupDate: "2026-02-16", assignedTo: "se2", assignedToName: "Priya Patel", createdAt: "2026-01-10", parentOrderId: null, isRepeat: false, health: "good" },
  { id: "ORD-008", customerName: "Mohan Das", mobile: "9876543216", address: "34 Salt Lake, Kolkata", orderSource: "Referral", productId: "p2", productTitle: "Daily Nutrition Pack", price: 1299, note: "Budget conscious", followupStep: 2, followupDate: "2026-02-18", assignedTo: "se3", assignedToName: "Amit Kumar", createdAt: "2026-02-05", parentOrderId: null, isRepeat: false, health: "at-risk" },
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
