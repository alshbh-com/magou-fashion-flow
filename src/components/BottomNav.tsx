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
    <nav className="fixed bottom-0 left-0 right-0 gradient-primary shadow-glow z-50 border-t border-white/10">
      <div className="container mx-auto px-4">
        <div className="flex justify-around items-center h-20">
          <Link
            to="/"
            className={`flex flex-col items-center justify-center w-24 h-full transition-all ${
              isActive("/") ? "text-white scale-110" : "text-white/70 hover:text-white hover:scale-105"
            }`}
          >
            <Home className="h-7 w-7 mb-1" />
            <span className="text-sm font-bold">الرئيسية</span>
          </Link>

          <Link
            to="/cart"
            className={`flex flex-col items-center justify-center w-24 h-full transition-all relative ${
              isActive("/cart") ? "text-white scale-110" : "text-white/70 hover:text-white hover:scale-105"
            }`}
          >
            <div className="relative">
              <ShoppingCart className="h-7 w-7 mb-1" />
              {cartItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-secondary text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center animate-pulse shadow-lg">
                  {cartItems}
                </span>
              )}
            </div>
            <span className="text-sm font-bold">السلة</span>
          </Link>

          <Link
            to="/settings"
            className={`flex flex-col items-center justify-center w-24 h-full transition-all ${
              isActive("/settings") ? "text-white scale-110" : "text-white/70 hover:text-white hover:scale-105"
            }`}
          >
            <Settings className="h-7 w-7 mb-1" />
            <span className="text-sm font-bold">الإعدادات</span>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
