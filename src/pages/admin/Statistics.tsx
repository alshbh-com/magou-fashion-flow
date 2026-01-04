import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Package, Truck, CheckCircle, XCircle, RotateCcw, DollarSign, Users, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Statistics = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dateFilter, setDateFilter] = useState<string>("");

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
    queryKey: ["all-orders-stats", dateFilter],
    queryFn: async () => {
      let query = supabase.from("orders").select("*, delivery_agents(name)");
      
      if (dateFilter) {
        const start = new Date(`${dateFilter}T00:00:00.000Z`);
        const end = new Date(`${dateFilter}T23:59:59.999Z`);
        query = query.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: agents } = useQuery({
    queryKey: ["agents-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("delivery_agents").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("customers").select("*", { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
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

  // Calculate statistics
  const totalOrders = orders?.length || 0;
  const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;
  const shippedOrders = orders?.filter(o => o.status === 'shipped').length || 0;
  const deliveredOrders = orders?.filter(o => o.status === 'delivered').length || 0;
  const cancelledOrders = orders?.filter(o => o.status === 'cancelled').length || 0;
  const returnedOrders = orders?.filter(o => o.status === 'returned' || o.status === 'partially_returned' || o.status === 'return_no_shipping').length || 0;
  
  const totalSales = orders?.filter(o => o.status === 'delivered').reduce((sum, o) => 
    sum + parseFloat(o.total_amount?.toString() || "0") + parseFloat(o.shipping_cost?.toString() || "0"), 0
  ) || 0;

  const totalShipping = orders?.filter(o => o.status === 'delivered').reduce((sum, o) => 
    sum + parseFloat(o.shipping_cost?.toString() || "0"), 0
  ) || 0;

  const totalAgentOwed = agents?.reduce((sum, a) => sum + parseFloat(a.total_owed?.toString() || "0"), 0) || 0;

  // Orders by agent
  const ordersByAgent = agents?.map(agent => ({
    name: agent.name,
    count: orders?.filter(o => o.delivery_agent_id === agent.id).length || 0,
    delivered: orders?.filter(o => o.delivery_agent_id === agent.id && o.status === 'delivered').length || 0
  })) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-8">
      <div className="container mx-auto px-4">
        <Button onClick={() => navigate("/admin")} variant="ghost" className="mb-4 text-white hover:bg-white/10">
          <ArrowLeft className="ml-2 h-4 w-4" />
          رجوع
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">لوحة الإحصائيات</h1>
          <div className="flex items-center gap-4 flex-wrap">
            <p className="text-purple-200">
              آخر إعادة تعيين: {statistics ? new Date(statistics.last_reset).toLocaleDateString("ar-EG") : "-"}
            </p>
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1">
              <Calendar className="h-4 w-4 text-purple-200" />
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-transparent border-0 text-white w-40 focus:ring-0"
              />
              {dateFilter && (
                <Button size="sm" variant="ghost" className="text-white h-6 px-2" onClick={() => setDateFilter("")}>
                  ✕
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 border-0 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">إجمالي المبيعات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{totalSales.toFixed(0)}</div>
                <DollarSign className="h-8 w-8 opacity-50" />
              </div>
              <p className="text-xs opacity-75 mt-1">ج.م</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">إجمالي الأوردرات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{totalOrders}</div>
                <Package className="h-8 w-8 opacity-50" />
              </div>
              <p className="text-xs opacity-75 mt-1">طلب</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-violet-500 to-violet-600 border-0 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">إجمالي العملاء</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{customers}</div>
                <Users className="h-8 w-8 opacity-50" />
              </div>
              <p className="text-xs opacity-75 mt-1">عميل</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 border-0 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">مستحقات على المندوبين</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{totalAgentOwed.toFixed(0)}</div>
                <Truck className="h-8 w-8 opacity-50" />
              </div>
              <p className="text-xs opacity-75 mt-1">ج.م</p>
            </CardContent>
          </Card>
        </div>

        {/* Order Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-yellow-500/20">
                  <Package className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{pendingOrders}</p>
                  <p className="text-xs text-purple-200">قيد الانتظار</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-purple-500/20">
                  <Truck className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{shippedOrders}</p>
                  <p className="text-xs text-purple-200">تم الشحن</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-green-500/20">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{deliveredOrders}</p>
                  <p className="text-xs text-purple-200">تم التوصيل</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-red-500/20">
                  <XCircle className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{cancelledOrders}</p>
                  <p className="text-xs text-purple-200">ملغي</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-orange-500/20">
                  <RotateCcw className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{returnedOrders}</p>
                  <p className="text-xs text-purple-200">مرتجع</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agents Performance */}
        <Card className="bg-white/10 backdrop-blur border-white/20 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Truck className="h-5 w-5" />
              أداء المندوبين
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ordersByAgent.map((agent, idx) => (
                <div key={idx} className="bg-white/5 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">{agent.name}</h3>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-200">إجمالي الطلبات:</span>
                    <span className="text-white font-medium">{agent.count}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-purple-200">تم التوصيل:</span>
                    <span className="text-green-400 font-medium">{agent.delivered}</span>
                  </div>
                  <div className="mt-2 bg-white/10 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-400 to-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: agent.count > 0 ? `${(agent.delivered / agent.count) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="bg-white/10 backdrop-blur border-white/20">
          <CardHeader>
            <CardTitle className="text-white">إدارة الإحصائيات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-purple-200">
              يتم حساب الإحصائيات تلقائياً من الأوردرات
            </p>
            
            <div className="flex gap-4">
              <Button onClick={() => updateMutation.mutate()} className="bg-white/20 hover:bg-white/30 text-white">
                <RefreshCw className="ml-2 h-4 w-4" />
                تحديث الإحصائيات
              </Button>
              
              <Button 
                variant="destructive"
                onClick={() => {
                  if (confirm("هل أنت متأكد من إعادة تعيين الإحصائيات؟")) {
                    resetMutation.mutate();
                  }
                }}
              >
                إعادة تعيين
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Statistics;
