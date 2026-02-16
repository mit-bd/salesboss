import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { RoleProvider } from "@/contexts/RoleContext";
import { AuditLogProvider } from "@/contexts/AuditLogContext";
import { OrderStoreProvider } from "@/contexts/OrderStoreContext";
import { ProductStoreProvider } from "@/contexts/ProductStoreContext";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerificationPendingPage from "./pages/VerificationPendingPage";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <RoleProvider>
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

                    {/* Protected routes */}
                    <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                    <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
                    <Route path="/orders/:id" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
                    <Route path="/followups" element={<ProtectedRoute><FollowupsPage /></ProtectedRoute>} />
                    <Route path="/repeat-orders" element={<ProtectedRoute><RepeatOrdersPage /></ProtectedRoute>} />
                    <Route path="/upsell" element={<ProtectedRoute><UpsellPage /></ProtectedRoute>} />
                    <Route path="/sales-executives" element={<ProtectedRoute><SalesExecutivesPage /></ProtectedRoute>} />
                    <Route path="/sales-executives/:id" element={<ProtectedRoute><SalesExecutiveDetailPage /></ProtectedRoute>} />
                    <Route path="/products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
                    <Route path="/delivery-methods" element={<ProtectedRoute><DeliveryMethodPage /></ProtectedRoute>} />
                    <Route path="/bulk-import" element={<ProtectedRoute><BulkImportPage /></ProtectedRoute>} />
                    <Route path="/team" element={<ProtectedRoute><TeamPage /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

                    {/* Admin-only routes */}
                    <Route path="/deleted-orders" element={<ProtectedRoute allowedRoles={["admin"]}><DeletedOrdersPage /></ProtectedRoute>} />
                    <Route path="/audit-logs" element={<ProtectedRoute allowedRoles={["admin"]}><AuditLogsPage /></ProtectedRoute>} />
                    <Route path="/export" element={<ProtectedRoute allowedRoles={["admin"]}><ExportPage /></ProtectedRoute>} />
                    <Route path="/backup-center" element={<ProtectedRoute allowedRoles={["admin"]}><BackupCenterPage /></ProtectedRoute>} />
                    <Route path="/commission" element={<ProtectedRoute allowedRoles={["admin"]}><CommissionPage /></ProtectedRoute>} />

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </TooltipProvider>
              </ProductStoreProvider>
            </OrderStoreProvider>
          </AuditLogProvider>
        </RoleProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
