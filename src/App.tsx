import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import AgentPayments from "./pages/admin/AgentPayments";
import Statistics from "./pages/admin/Statistics";
import Invoices from "./pages/admin/Invoices";
import Governorates from "./pages/admin/Governorates";
import AllOrders from "./pages/admin/AllOrders";
import ResetData from "./pages/admin/ResetData";
import BottomNav from "./components/BottomNav";
import TopNav from "./components/TopNav";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
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
            <Route path="/admin/agent-payments" element={<AgentPayments />} />
            <Route path="/admin/statistics" element={<Statistics />} />
            <Route path="/admin/invoices" element={<Invoices />} />
            <Route path="/admin/governorates" element={<Governorates />} />
            <Route path="/admin/all-orders" element={<AllOrders />} />
            <Route path="/admin/reset-data" element={<ResetData />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <BottomNav />
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
