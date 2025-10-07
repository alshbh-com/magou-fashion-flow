import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, RefreshCw, BarChart3, DollarSign, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Statistics = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: statistics, isLoading } = useQuery({
    queryKey: ["statistics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("statistics")
        .select("*")
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["all-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*");
      
      if (error) throw error;
      return data;
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("statistics")
        .update({
          total_sales: 0,
          total_orders: 0,
          last_reset: new Date().toISOString()
        })
        .eq("id", statistics?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["statistics"] });
      toast.success("تم إعادة تعيين الإحصائيات");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      // Calculate total from shipped and delivered orders
      const shippedOrders = orders?.filter(o => 
        o.status === 'shipped' || o.status === 'delivered'
      ) || [];
      
      const totalSales = shippedOrders.reduce((sum, order) => 
        sum + parseFloat(order.total_amount.toString()), 0
      );

      const { error } = await supabase
        .from("statistics")
        .update({
          total_sales: totalSales,
          total_orders: shippedOrders.length
        })
        .eq("id", statistics?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["statistics"] });
      toast.success("تم تحديث الإحصائيات");
    },
  });

  if (isLoading) {
    return <div className="p-8">جاري التحميل...</div>;
  }

  const shippedCount = orders?.filter(o => o.status === 'shipped' || o.status === 'delivered').length || 0;
  const pendingCount = orders?.filter(o => o.status === 'pending' || o.status === 'processing').length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <Button onClick={() => navigate("/admin")} variant="ghost" className="mb-4">
          <ArrowLeft className="ml-2 h-4 w-4" />
          رجوع
        </Button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">الإحصائيات</h1>
          <p className="text-muted-foreground">
            آخر إعادة تعيين: {statistics ? new Date(statistics.last_reset).toLocaleDateString("ar-EG") : "-"}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي المبيعات</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {parseFloat(statistics?.total_sales?.toString() || "0").toFixed(2)} ج.م
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">عدد الأوردرات المكتملة</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics?.total_orders || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">أوردرات قيد التنفيذ</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {pendingCount}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">أوردرات تم شحنها</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {shippedCount}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>إدارة الإحصائيات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              يتم حساب الإحصائيات تلقائياً من الأوردرات التي تم شحنها أو توصيلها
            </p>
            
            <div className="flex gap-4">
              <Button onClick={() => updateMutation.mutate()}>
                <RefreshCw className="ml-2 h-4 w-4" />
                تحديث الإحصائيات الآن
              </Button>
              
              <Button 
                variant="destructive"
                onClick={() => {
                  if (confirm("هل أنت متأكد من إعادة تعيين الإحصائيات؟")) {
                    resetMutation.mutate();
                  }
                }}
              >
                إعادة تعيين الإحصائيات
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Statistics;
