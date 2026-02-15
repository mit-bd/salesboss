import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import OrdersPage from "./pages/OrdersPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import FollowupsPage from "./pages/FollowupsPage";
import RepeatOrdersPage from "./pages/RepeatOrdersPage";
import ProductsPage from "./pages/ProductsPage";
import DeliveryMethodPage from "./pages/DeliveryMethodPage";
import BulkImportPage from "./pages/BulkImportPage";
import TeamPage from "./pages/TeamPage";
import SettingsPage from "./pages/SettingsPage";
import SalesExecutivesPage from "./pages/SalesExecutivesPage";
import SalesExecutiveDetailPage from "./pages/SalesExecutiveDetailPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="/followups" element={<FollowupsPage />} />
          <Route path="/repeat-orders" element={<RepeatOrdersPage />} />
          <Route path="/sales-executives" element={<SalesExecutivesPage />} />
          <Route path="/sales-executives/:id" element={<SalesExecutiveDetailPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/delivery-methods" element={<DeliveryMethodPage />} />
          <Route path="/bulk-import" element={<BulkImportPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
