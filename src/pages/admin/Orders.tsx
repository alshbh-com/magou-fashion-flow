import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Eye, UserCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import SearchBar from "@/components/admin/SearchBar";

const Orders = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [bulkAgentId, setBulkAgentId] = useState<string>("");

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

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ orderIds, agentId }: { orderIds: string[]; agentId: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ delivery_agent_id: agentId })
        .in("id", orderIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("تم تعيين المندوب لجميع الأوردرات المحددة");
      setSelectedOrders([]);
      setBulkAgentId("");
    },
  });

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrders.length === orders?.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders?.map(o => o.id) || []);
    }
  };

  const handleBulkAssign = () => {
    if (!bulkAgentId) {
      toast.error("يرجى اختيار مندوب");
      return;
    }
    if (selectedOrders.length === 0) {
      toast.error("يرجى اختيار أوردرات");
      return;
    }
    bulkAssignMutation.mutate({ orderIds: selectedOrders, agentId: bulkAgentId });
  };

  if (isLoading) {
    return <div className="p-8">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <Button onClick={() => navigate("/admin")} variant="ghost" className="mb-4">
          <ArrowLeft className="ml-2 h-4 w-4" />
          الرجوع إلى الصفحة الرئيسية
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>الأوردرات</CardTitle>
              {selectedOrders.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedOrders.length} محدد
                  </span>
                  <Select value={bulkAgentId} onValueChange={setBulkAgentId}>
                    <SelectTrigger className="w-48">
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
                  <Button onClick={handleBulkAssign} size="sm">
                    <UserCheck className="ml-2 h-4 w-4" />
                    تعيين المندوب
                  </Button>
                </div>
              )}
            </div>
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
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedOrders.length === orders.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>رقم الأوردر</TableHead>
                      <TableHead>العميل</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>المحافظة</TableHead>
                      <TableHead>الإجمالي</TableHead>
                      <TableHead>المندوب</TableHead>
                      <TableHead>تعيين المندوب</TableHead>
                      <TableHead>تفاصيل</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedOrders.includes(order.id)}
                            onCheckedChange={() => toggleOrderSelection(order.id)}
                          />
                        </TableCell>
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
                                            <TableCell>
                                              {item.products?.name}
                                              {item.size && <div className="text-xs text-muted-foreground">المقاس: {item.size}</div>}
                                              {item.color && <div className="text-xs text-muted-foreground">اللون: {item.color}</div>}
                                            </TableCell>
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