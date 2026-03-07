import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { RoleProvider } from "@/contexts/RoleContext";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { AuditLogProvider } from "@/contexts/AuditLogContext";
import { OrderStoreProvider } from "@/contexts/OrderStoreContext";
import { ProductStoreProvider } from "@/contexts/ProductStoreContext";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerificationPendingPage from "./pages/VerificationPendingPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import OwnerDashboardPage from "./pages/OwnerDashboardPage";
import RegistrationRequestsPage from "./pages/RegistrationRequestsPage";
import OwnerProjectsPage from "./pages/OwnerProjectsPage";
import OwnerUsersPage from "./pages/OwnerUsersPage";
import OwnerSystemLogsPage from "./pages/OwnerSystemLogsPage";
import DashboardPage from "./pages/DashboardPage";
import OrdersPage from "./pages/OrdersPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import FollowupsPage from "./pages/FollowupsPage";
import RepeatOrdersPage from "./pages/RepeatOrdersPage";
import UpsellPage from "./pages/UpsellPage";
import ProductsPage from "./pages/ProductsPage";
import DeliveryMethodPage from "./pages/DeliveryMethodPage";
import BulkImportPage from "./pages/BulkImportPage";
import TeamPage from "./pages/TeamPage";
import SettingsPage from "./pages/SettingsPage";
import SalesExecutivesPage from "./pages/SalesExecutivesPage";
import SalesExecutiveDetailPage from "./pages/SalesExecutiveDetailPage";
import DeletedOrdersPage from "./pages/DeletedOrdersPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import ExportPage from "./pages/ExportPage";
import BackupCenterPage from "./pages/BackupCenterPage";
import CommissionPage from "./pages/CommissionPage";
import RolesPage from "./pages/RolesPage";
import OrderSourcesPage from "./pages/OrderSourcesPage";
import CustomerProfilePage from "./pages/CustomerProfilePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <RoleProvider>
          <PermissionProvider>
            <AuditLogProvider>
              <OrderStoreProvider>
                <ProductStoreProvider>
                  <TooltipProvider>
                    <Toaster />
                    <Sonner />
                    <Routes>
                      {/* Public routes */}
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/register" element={<RegisterPage />} />
                      <Route path="/verification-pending" element={<VerificationPendingPage />} />
                      <Route path="/pending-approval" element={<PendingApprovalPage />} />

                      {/* Owner routes */}
                      <Route path="/owner" element={<ProtectedRoute ownerOnly><OwnerDashboardPage /></ProtectedRoute>} />
                      <Route path="/owner/requests" element={<ProtectedRoute ownerOnly><RegistrationRequestsPage /></ProtectedRoute>} />
                      <Route path="/owner/projects" element={<ProtectedRoute ownerOnly><OwnerProjectsPage /></ProtectedRoute>} />
                      <Route path="/owner/users" element={<ProtectedRoute ownerOnly><OwnerUsersPage /></ProtectedRoute>} />
                      <Route path="/owner/logs" element={<ProtectedRoute ownerOnly><OwnerSystemLogsPage /></ProtectedRoute>} />

                      {/* Protected routes */}
                      <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                      <Route path="/orders" element={<ProtectedRoute requiredPermission="orders.view"><OrdersPage /></ProtectedRoute>} />
                      <Route path="/orders/:id" element={<ProtectedRoute requiredPermission="orders.view"><OrderDetailPage /></ProtectedRoute>} />
                      <Route path="/followups" element={<ProtectedRoute requiredPermission="followups.view"><FollowupsPage /></ProtectedRoute>} />
                      <Route path="/repeat-orders" element={<ProtectedRoute requiredPermission="orders.view"><RepeatOrdersPage /></ProtectedRoute>} />
                      <Route path="/upsell" element={<ProtectedRoute requiredPermission="followups.view"><UpsellPage /></ProtectedRoute>} />
                      <Route path="/sales-executives" element={<ProtectedRoute requiredPermission="sales.view_performance"><SalesExecutivesPage /></ProtectedRoute>} />
                      <Route path="/sales-executives/:id" element={<ProtectedRoute requiredPermission="sales.view_performance"><SalesExecutiveDetailPage /></ProtectedRoute>} />
                      <Route path="/products" element={<ProtectedRoute requiredPermission="products.view"><ProductsPage /></ProtectedRoute>} />
                      <Route path="/delivery-methods" element={<ProtectedRoute requiredPermission="delivery.view"><DeliveryMethodPage /></ProtectedRoute>} />
                      <Route path="/bulk-import" element={<ProtectedRoute requiredPermission="orders.create"><BulkImportPage /></ProtectedRoute>} />
                      <Route path="/team" element={<ProtectedRoute><TeamPage /></ProtectedRoute>} />
                      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                      <Route path="/roles" element={<ProtectedRoute requiredPermission="roles.manage"><RolesPage /></ProtectedRoute>} />
                      <Route path="/deleted-orders" element={<ProtectedRoute requiredPermission="orders.delete"><DeletedOrdersPage /></ProtectedRoute>} />
                      <Route path="/audit-logs" element={<ProtectedRoute requiredPermission="audit.view"><AuditLogsPage /></ProtectedRoute>} />
                      <Route path="/export" element={<ProtectedRoute requiredPermission="backup.export"><ExportPage /></ProtectedRoute>} />
                      <Route path="/backup-center" element={<ProtectedRoute requiredPermission="backup.view"><BackupCenterPage /></ProtectedRoute>} />
                      <Route path="/commission" element={<ProtectedRoute requiredPermission="commission.view"><CommissionPage /></ProtectedRoute>} />
                      <Route path="/order-sources" element={<ProtectedRoute><OrderSourcesPage /></ProtectedRoute>} />
                      <Route path="/customers/:id" element={<ProtectedRoute><CustomerProfilePage /></ProtectedRoute>} />

                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </TooltipProvider>
                </ProductStoreProvider>
              </OrderStoreProvider>
            </AuditLogProvider>
          </PermissionProvider>
        </RoleProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
