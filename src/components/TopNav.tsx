import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Home, ShoppingCart, LayoutDashboard, Users, Truck, Package, ShoppingBag, DollarSign, BarChart3, FileText, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { isAdminAuthenticated } from "@/lib/adminAuth";

import logo from "@/assets/magou-logo.jpg";

const TopNav = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isAdmin = isAdminAuthenticated();

  const publicMenuItems = [
    { title: "الرئيسية", icon: Home, path: "/" },
    { title: "السلة", icon: ShoppingCart, path: "/cart" },
  ];

  const adminMenuItems = [
    { title: "لوحة التحكم", icon: LayoutDashboard, path: "/admin" },
    { title: "العملاء", icon: Users, path: "/admin/customers" },
    { title: "المندوبين", icon: Truck, path: "/admin/agents" },
    { title: "الأوردرات", icon: Package, path: "/admin/orders" },
    { title: "المنتجات", icon: ShoppingBag, path: "/admin/products" },
    { title: "أوردرات المندوبين", icon: Package, path: "/admin/agent-orders" },
    { title: "مدفوعات المندوبين", icon: DollarSign, path: "/admin/agent-payments" },
    { title: "الإحصائيات", icon: BarChart3, path: "/admin/statistics" },
    { title: "الفواتير", icon: FileText, path: "/admin/invoices" },
    { title: "المرتجعات", icon: PackageOpen, path: "/admin/returns" },
  ];

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 gradient-primary shadow-glow border-b border-white/10">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="القائمة" className="h-12 w-12 hover:bg-white/20 text-white">
                <Menu className="h-7 w-7" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 overflow-y-auto">
              <SheetHeader>
                <SheetTitle>القائمة</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground px-3">القوائم العامة</h3>
                  {publicMenuItems.map((item) => (
                    <Button
                      key={item.path}
                      variant="ghost"
                      className="w-full justify-start gap-3"
                      onClick={() => handleNavigate(item.path)}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.title}
                    </Button>
                  ))}
                </div>

                {isAdmin && (
                  <div className="space-y-2 pt-4 border-t">
                    <h3 className="text-sm font-medium text-muted-foreground px-3">لوحة التحكم</h3>
                    {adminMenuItems.map((item) => (
                      <Button
                        key={item.path}
                        variant="ghost"
                        className="w-full justify-start gap-3"
                        onClick={() => handleNavigate(item.path)}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.title}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <button
            className="flex items-center gap-3 group hover:opacity-95 transition-all"
            onClick={() => handleNavigate('/')}
            aria-label="Magou Fashion - الصفحة الرئيسية"
          >
            <img 
              src={logo} 
              alt="شعار متجر Magou Fashion" 
              className="h-12 w-12 rounded-full object-cover shadow-lg ring-2 ring-white/30 group-hover:ring-white/60 transition-all" 
            />
            <span className="text-2xl font-black text-white tracking-tight hidden sm:block">Magou Fashion</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopNav;
