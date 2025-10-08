import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import SearchBar from "@/components/admin/SearchBar";

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

const Orders = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          customers (name, phone, address, governorate),
          delivery_agents (name, serial_number),
          order_items (
            *,
            products (name, price)
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: agents } = useQuery({
    queryKey: ["delivery_agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_agents")
        .select("*");
      
      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: status as any })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("تم تحديث الحالة");
    },
  });

  const assignAgentMutation = useMutation({
    mutationFn: async ({ orderId, agentId }: { orderId: string; agentId: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ delivery_agent_id: agentId })
        .eq("id", orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("تم تعيين المندوب");
    },
  });

  if (isLoading) {
    return <div className="p-8">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <Button onClick={() => navigate("/admin")} variant="ghost" className="mb-4">
          <ArrowLeft className="ml-2 h-4 w-4" />
          رجوع
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>الأوردرات</CardTitle>
          </CardHeader>
          <CardContent>
            <SearchBar />
            {!orders || orders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد أوردرات</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الأوردر</TableHead>
                      <TableHead>العميل</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>المحافظة</TableHead>
                      <TableHead>الإجمالي</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>المندوب</TableHead>
                      <TableHead>تعيين المندوب</TableHead>
                      <TableHead>تفاصيل</TableHead>
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
                        <TableCell>
                          <Badge variant="outline">
                            {order.customers?.governorate || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {parseFloat(order.total_amount.toString()).toFixed(2)} ج.م
                        </TableCell>
                        <TableCell>
                          <Select
                            value={order.status}
                            onValueChange={(value) =>
                              updateStatusMutation.mutate({ id: order.id, status: value })
                            }
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${statusColors[value]}`} />
                                    {label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {order.delivery_agents ? (
                            <Badge variant="outline">
                              {order.delivery_agents.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={order.delivery_agent_id || ""}
                            onValueChange={(value) =>
                              assignAgentMutation.mutate({ orderId: order.id, agentId: value })
                            }
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue placeholder="اختر مندوب" />
                            </SelectTrigger>
                            <SelectContent>
                              {agents?.map((agent) => (
                                <SelectItem key={agent.id} value={agent.id}>
                                  {agent.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => setSelectedOrder(order)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>تفاصيل الأوردر</DialogTitle>
                              </DialogHeader>
                              {selectedOrder && selectedOrder.id === order.id && (
                                <div className="space-y-4">
                                <div>
                                  <h3 className="font-bold mb-2">معلومات العميل</h3>
                                  <p>الاسم: {order.customers?.name}</p>
                                  <p>الهاتف: {order.customers?.phone}</p>
                                  <p>المحافظة: {order.customers?.governorate || "-"}</p>
                                  <p>العنوان: {order.customers?.address}</p>
                                </div>
                                  <div>
                                    <h3 className="font-bold mb-2">المنتجات</h3>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>المنتج</TableHead>
                                          <TableHead>الكمية</TableHead>
                                          <TableHead>السعر</TableHead>
                                          <TableHead>الإجمالي</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {order.order_items?.map((item: any) => (
                                          <TableRow key={item.id}>
                                            <TableCell>{item.products?.name}</TableCell>
                                            <TableCell>{item.quantity}</TableCell>
                                            <TableCell>{parseFloat(item.price.toString()).toFixed(2)} ج.م</TableCell>
                                            <TableCell>
                                              {(parseFloat(item.price.toString()) * item.quantity).toFixed(2)} ج.م
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                  {order.notes && (
                                    <div>
                                      <h3 className="font-bold mb-2">ملاحظات</h3>
                                      <p>{order.notes}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Orders;
