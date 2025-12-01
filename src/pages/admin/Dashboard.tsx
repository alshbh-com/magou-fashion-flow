import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  Truck, 
  ShoppingCart, 
  Package, 
  DollarSign, 
  FileText, 
  BarChart, 
  Settings,
  Trash2,
  AlertTriangle
} from "lucide-react";
import { Link } from "react-router-dom";
import SearchBar from "@/components/admin/SearchBar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

const adminSections = [
  {
    title: "العملاء",
    description: "إدارة بيانات العملاء",
    icon: Users,
    path: "/admin/customers",
    color: "text-blue-500"
  },
  {
    title: "بيانات المندوبين",
    description: "إدارة المندوبين",
    icon: Truck,
    path: "/admin/agents",
    color: "text-green-500"
  },
  {
    title: "الأوردرات",
    description: "إدارة الطلبات",
    icon: ShoppingCart,
    path: "/admin/orders",
    color: "text-orange-500"
  },
  {
    title: "أوردرات المندوب",
    description: "طلبات كل مندوب",
    icon: Package,
    path: "/admin/agent-orders",
    color: "text-purple-500"
  },
  {
    title: "دفعات المندوب",
    description: "المدفوعات والمستحقات",
    icon: DollarSign,
    path: "/admin/agent-payments",
    color: "text-yellow-500"
  },
  {
    title: "المنتجات",
    description: "إدارة المنتجات والعروض",
    icon: Settings,
    path: "/admin/products",
    color: "text-red-500"
  },
  {
    title: "الأقسام",
    description: "إدارة أقسام المنتجات",
    icon: Settings,
    path: "/admin/categories",
    color: "text-indigo-500"
  },
  {
    title: "الإحصائيات",
    description: "إحصائيات المبيعات",
    icon: BarChart,
    path: "/admin/statistics",
    color: "text-cyan-500"
  },
  {
    title: "الفواتير",
    description: "طباعة الفواتير",
    icon: FileText,
    path: "/admin/invoices",
    color: "text-pink-500"
  },
  {
    title: "المحافظات",
    description: "إدارة المحافظات وأسعار الشحن",
    icon: Settings,
    path: "/admin/governorates",
    color: "text-teal-500"
  },
  {
    title: "جميع الأوردرات",
    description: "عرض جميع الأوردرات",
    icon: ShoppingCart,
    path: "/admin/all-orders",
    color: "text-violet-500"
  },
  {
    title: "إعادة تعيين البيانات",
    description: "مسح جميع البيانات والبدء من جديد",
    icon: Trash2,
    path: "/admin/reset-data",
    color: "text-red-600"
  }
];

const LOW_STOCK_THRESHOLD = 10;

const Dashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      navigate("/settings");
    }
  }, [navigate]);

  const { data: lowStockProducts, isLoading: isLoadingLowStock } = useQuery({
    queryKey: ["lowStockProducts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .lte("stock", LOW_STOCK_THRESHOLD)
        .order("stock", { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold mb-2">لوحة التحكم</h1>
        <p className="text-muted-foreground mb-8">إدارة متجر Magou Fashion</p>

        <div className="mb-8">
          <SearchBar />
        </div>

        {!isLoadingLowStock && lowStockProducts && lowStockProducts.length > 0 && (
          <Card className="mb-8 border-destructive/50 bg-destructive/5">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <CardTitle className="text-destructive">تنبيه: نفاذ المخزون</CardTitle>
                  <CardDescription>
                    يوجد {lowStockProducts.length} منتج مخزونه {LOW_STOCK_THRESHOLD} قطع أو أقل
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lowStockProducts.map((product) => (
                  <Card key={product.id} className="border-destructive/30">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {product.image_url && (
                          <img 
                            src={product.image_url} 
                            alt={product.name}
                            className="w-16 h-16 object-cover rounded"
                          />
                        )}
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm mb-1">{product.name}</h4>
                          <div className="flex items-center gap-2">
                            <Badge variant={product.stock === 0 ? "destructive" : "secondary"}>
                              {product.stock === 0 ? "نفذت الكمية" : `${product.stock} قطعة متبقية`}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {adminSections.map((section) => (
            <Link key={section.path} to={section.path}>
              <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer group">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg bg-accent flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${section.color}`}>
                    <section.icon className="w-6 h-6" />
                  </div>
                  <CardTitle>{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
