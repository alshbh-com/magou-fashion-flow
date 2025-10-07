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
  Settings
} from "lucide-react";
import { Link } from "react-router-dom";

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
    title: "مستحقات المندوب",
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
  }
];

const Dashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      navigate("/settings");
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold mb-2">لوحة التحكم</h1>
        <p className="text-muted-foreground mb-8">إدارة متجر Magou Fashion</p>

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
