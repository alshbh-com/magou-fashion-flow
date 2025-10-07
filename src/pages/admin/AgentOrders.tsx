import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  processing: "قيد التنفيذ",
  shipped: "تم الشحن",
  delivered: "تم التوصيل",
  cancelled: "ملغي"
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500",
  processing: "bg-blue-500",
  shipped: "bg-purple-500",
  delivered: "bg-green-500",
  cancelled: "bg-red-500"
};

const AgentOrders = () => {
  const navigate = useNavigate();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  const { data: agents } = useQuery({
    queryKey: ["delivery_agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_agents")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ["agent-orders", selectedAgentId],
    queryFn: async () => {
      if (!selectedAgentId) return [];
      
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          customers (name, phone, address),
          delivery_agents (name, serial_number),
          order_items (
            *,
            products (name, price)
          )
        `)
        .eq("delivery_agent_id", selectedAgentId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAgentId
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <Button onClick={() => navigate("/admin")} variant="ghost" className="mb-4">
          <ArrowLeft className="ml-2 h-4 w-4" />
          رجوع
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>أوردرات المندوب</CardTitle>
            <div className="mt-4">
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="اختر مندوب" />
                </SelectTrigger>
                <SelectContent>
                  {agents?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name} - {agent.serial_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedAgentId ? (
              <p className="text-center text-muted-foreground py-8">اختر مندوب لعرض أوردراته</p>
            ) : isLoading ? (
              <p className="text-center py-8">جاري التحميل...</p>
            ) : !orders || orders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد أوردرات لهذا المندوب</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الأوردر</TableHead>
                      <TableHead>العميل</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>العنوان</TableHead>
                      <TableHead>الإجمالي</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-xs">
                          {order.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="font-medium">
                          {order.customers?.name}
                        </TableCell>
                        <TableCell>{order.customers?.phone}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {order.customers?.address}
                        </TableCell>
                        <TableCell>
                          {parseFloat(order.total_amount.toString()).toFixed(2)} ج.م
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[order.status]}>
                            {statusLabels[order.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(order.created_at).toLocaleDateString("ar-EG")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Summary */}
                <div className="mt-6 p-4 bg-accent rounded-lg">
                  <h3 className="font-bold mb-2">ملخص الأوردرات</h3>
                  <p>عدد الأوردرات: {orders.length}</p>
                  <p className="font-bold text-lg">
                    الإجمالي: {orders.reduce((sum, order) => sum + parseFloat(order.total_amount.toString()), 0).toFixed(2)} ج.م
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AgentOrders;
