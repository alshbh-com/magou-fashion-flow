import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import Home from "./pages/Home";
import Cart from "./pages/Cart";
import Settings from "./pages/Settings";
import Dashboard from "./pages/admin/Dashboard";
import Customers from "./pages/admin/Customers";
import Agents from "./pages/admin/Agents";
import Orders from "./pages/admin/Orders";
import Products from "./pages/admin/Products";
import Categories from "./pages/admin/Categories";
import AgentOrders from "./pages/admin/AgentOrders";

import Statistics from "./pages/admin/Statistics";
import Invoices from "./pages/admin/Invoices";
import Governorates from "./pages/admin/Governorates";
import AllOrders from "./pages/admin/AllOrders";
import ResetData from "./pages/admin/ResetData";
import UserManagement from "./pages/admin/UserManagement";
import ActivityLogs from "./pages/admin/ActivityLogs";
import Treasury from "./pages/admin/Treasury";
import Cashbox from "./pages/admin/Cashbox";
import BottomNav from "./components/BottomNav";
import TopNav from "./components/TopNav";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AdminAuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <TopNav />
          <div className="pb-16 pt-16">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin" element={<Dashboard />} />
              <Route path="/admin/customers" element={<Customers />} />
              <Route path="/admin/agents" element={<Agents />} />
              <Route path="/admin/orders" element={<Orders />} />
              <Route path="/admin/products" element={<Products />} />
              <Route path="/admin/categories" element={<Categories />} />
              <Route path="/admin/agent-orders" element={<AgentOrders />} />
              
              <Route path="/admin/statistics" element={<Statistics />} />
              <Route path="/admin/invoices" element={<Invoices />} />
              <Route path="/admin/governorates" element={<Governorates />} />
              <Route path="/admin/all-orders" element={<AllOrders />} />
              <Route path="/admin/reset-data" element={<ResetData />} />
              <Route path="/admin/users" element={<UserManagement />} />
              <Route path="/admin/activity" element={<ActivityLogs />} />
              <Route path="/admin/treasury" element={<Treasury />} />
              <Route path="/admin/cashbox" element={<Cashbox />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <BottomNav />
          </div>
        </BrowserRouter>
      </AdminAuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
