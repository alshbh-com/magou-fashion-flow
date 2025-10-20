import { Home, ShoppingCart, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "@/hooks/useCart";

const BottomNav = () => {
  const location = useLocation();
  const { getTotalItems } = useCart();
  const cartItems = getTotalItems();

  // Don't show on admin pages
  if (location.pathname.startsWith("/admin")) {
    return null;
  }

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-around items-center h-16">
          <Link
            to="/"
            className={`flex flex-col items-center justify-center w-20 h-full transition-colors ${
              isActive("/") ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Home className="h-6 w-6 mb-1" />
            <span className="text-xs font-medium">الرئيسية</span>
          </Link>

          <Link
            to="/cart"
            className={`flex flex-col items-center justify-center w-20 h-full transition-colors relative ${
              isActive("/cart") ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className="relative">
              <ShoppingCart className="h-6 w-6 mb-1" />
              {cartItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {cartItems}
                </span>
              )}
            </div>
            <span className="text-xs font-medium">السلة</span>
          </Link>

          <Link
            to="/settings"
            className={`flex flex-col items-center justify-center w-20 h-full transition-colors ${
              isActive("/settings") ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Settings className="h-6 w-6 mb-1" />
            <span className="text-xs font-medium">الإعدادات</span>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
