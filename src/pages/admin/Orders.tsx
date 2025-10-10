import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, UserCheck, Trash2, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import SearchBar from "@/components/admin/SearchBar";

const Orders = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [bulkAgentId, setBulkAgentId] = useState<string>("");
  const [bulkShippingCost, setBulkShippingCost] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [governorateFilter, setGovernorateFilter] = useState<string>("all");
  const [modificationDialogOpen, setModificationDialogOpen] = useState(false);
  const [selectedModifyOrder, setSelectedModifyOrder] = useState<any>(null);
  const [modifiedAmount, setModifiedAmount] = useState<number>(0);

  const egyptGovernorates = [
    "القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الشرقية", "المنوفية", "القليوبية",
    "البحيرة", "الغربية", "بني سويف", "الفيوم", "المنيا", "أسيوط", "سوهاج", "قنا",
    "الأقصر", "أسوان", "البحر الأحمر", "الوادي الجديد", "مطروح", "شمال سيناء",
    "جنوب سيناء", "بورسعيد", "دمياط", "الإسماعيلية", "السويس", "كفر الشيخ", "الأقصر"
  ];

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
    mutationFn: async ({ orderIds, agentId, shippingCost }: { orderIds: string[]; agentId: string; shippingCost: number }) => {
      const { error } = await supabase
        .from("orders")
        .update({ 
          delivery_agent_id: agentId,
          shipping_cost: shippingCost,
          status: 'shipped'
        })
        .in("id", orderIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["agent-orders"] });
      toast.success("تم تعيين المندوب لجميع الأوردرات المحددة وتغيير الحالة إلى تم الشحن");
      setSelectedOrders([]);
      setBulkAgentId("");
      setBulkShippingCost(0);
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // Delete order items first
      const { error: itemsError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", orderId);
      
      if (itemsError) throw itemsError;

      // Delete order
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("تم حذف الأوردر");
    },
  });

  const modifyOrderMutation = useMutation({
    mutationFn: async ({ orderId, modifiedAmount }: { orderId: string; modifiedAmount: number }) => {
      const { error } = await supabase
        .from("orders")
        .update({ 
          status: "delivered_with_modification",
          modified_amount: modifiedAmount
        })
        .eq("id", orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("تم تعديل الأوردر");
      setModificationDialogOpen(false);
      setSelectedModifyOrder(null);
      setModifiedAmount(0);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: any }) => {
      if (status === "delivered_with_modification") {
        return;
      }
      const { error } = await supabase
        .from("orders")
        .update({ status: status as any })
        .eq("id", orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("تم تحديث حالة الأوردر");
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
    if (bulkShippingCost < 0) {
      toast.error("يرجى إدخال قيمة شحن صحيحة");
      return;
    }
    bulkAssignMutation.mutate({ orderIds: selectedOrders, agentId: bulkAgentId, shippingCost: bulkShippingCost });
  };

  const handlePrintOrder = (order: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const orderItems = order.order_items?.map((item: any) => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.products?.name}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.quantity}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${parseFloat(item.price.toString()).toFixed(2)} ج.م</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${(parseFloat(item.price.toString()) * item.quantity).toFixed(2)} ج.م</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>فاتورة - ${order.id.slice(0, 8)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
            th { background-color: #f2f2f2; }
            .info { margin: 20px 0; }
            .total { font-size: 18px; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>فاتورة</h1>
          <div class="info">
            <p><strong>رقم الأوردر:</strong> ${order.id.slice(0, 8)}</p>
            <p><strong>اسم العميل:</strong> ${order.customers?.name}</p>
            <p><strong>الهاتف:</strong> ${order.customers?.phone}</p>
            <p><strong>العنوان:</strong> ${order.customers?.address}</p>
            <p><strong>المحافظة:</strong> ${order.customers?.governorate || '-'}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>المنتج</th>
                <th>الكمية</th>
                <th>السعر</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${orderItems}
            </tbody>
          </table>
          <div class="total">
            الإجمالي الكلي: ${parseFloat(order.total_amount.toString()).toFixed(2)} ج.م
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const filteredOrders = orders?.filter(order => {
    if (statusFilter !== "all" && order.status !== statusFilter) return false;
    if (dateFilter) {
      const orderDate = new Date(order.created_at).toISOString().split('T')[0];
      if (orderDate !== dateFilter) return false;
    }
    if (governorateFilter !== "all" && order.customers?.governorate !== governorateFilter) {
      return false;
    }
    return true;
  });

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
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <CardTitle>الأوردرات</CardTitle>
                {selectedOrders.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedOrders.length} محدد
                    </span>
                    <Input
                      type="number"
                      value={bulkShippingCost}
                      onChange={(e) => setBulkShippingCost(Number(e.target.value) || 0)}
                      placeholder="شحن المندوب"
                      className="w-32"
                      min="0"
                    />
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
              
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">فلتر حسب الحالة:</span>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="جميع الحالات" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الحالات</SelectItem>
                      <SelectItem value="pending">قيد الانتظار</SelectItem>
                      <SelectItem value="processing">قيد التنفيذ</SelectItem>
                      <SelectItem value="shipped">تم الشحن</SelectItem>
                      <SelectItem value="delivered">تم التوصيل</SelectItem>
                      <SelectItem value="cancelled">ملغي</SelectItem>
                      <SelectItem value="returned">مرتجع</SelectItem>
                      <SelectItem value="partially_returned">مرتجع جزئي</SelectItem>
                      <SelectItem value="delivered_with_modification">تم التوصيل مع التعديل</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">فلتر حسب التاريخ:</span>
                  <Input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-48"
                  />
                  {dateFilter && (
                    <Button size="sm" variant="ghost" onClick={() => setDateFilter("")}>
                      إلغاء
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">فلتر حسب المحافظة:</span>
                  <Select value={governorateFilter} onValueChange={setGovernorateFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="جميع المحافظات" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع المحافظات</SelectItem>
                      {egyptGovernorates.map((gov) => (
                        <SelectItem key={gov} value={gov}>
                          {gov}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <SearchBar />
            {!filteredOrders || filteredOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد أوردرات</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedOrders.length === filteredOrders.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>رقم الأوردر</TableHead>
                      <TableHead>العميل</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>العنوان</TableHead>
                      <TableHead>المحافظة</TableHead>
                      <TableHead>الإجمالي</TableHead>
                      <TableHead>الخصم</TableHead>
                      <TableHead>الصافي</TableHead>
                      <TableHead>المندوب</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedOrders.includes(order.id)}
                            onCheckedChange={() => toggleOrderSelection(order.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          #{order.order_number || order.id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{order.customers?.name}</div>
                          {order.order_details && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {order.order_details}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>{order.customers?.phone}</div>
                          {(order.customers as any)?.phone2 && (
                            <div className="text-xs text-muted-foreground">
                              {(order.customers as any).phone2}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="text-sm truncate" title={order.customers?.address}>
                            {order.customers?.address}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {order.customers?.governorate || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {parseFloat(order.total_amount.toString()).toFixed(2)} ج.م
                        </TableCell>
                        <TableCell>
                          {order.discount > 0 ? (
                            <span className="text-green-600">
                              {parseFloat(order.discount.toString()).toFixed(2)} ج.م
                            </span>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="font-bold">
                          {(parseFloat(order.total_amount.toString()) - (order.discount || 0)).toFixed(2)} ج.م
                        </TableCell>
                        <TableCell>
                          {order.delivery_agents ? (
                            <Badge variant="outline">
                              {order.delivery_agents.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">غير محدد</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={order.status}
                            onValueChange={(value) => {
                              if (value === "delivered_with_modification") {
                                setSelectedModifyOrder(order);
                                setModificationDialogOpen(true);
                              } else {
                                updateStatusMutation.mutate({ orderId: order.id, status: value });
                              }
                            }}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">قيد الانتظار</SelectItem>
                              <SelectItem value="processing">قيد التنفيذ</SelectItem>
                              <SelectItem value="shipped">تم الشحن</SelectItem>
                              <SelectItem value="delivered">تم التوصيل</SelectItem>
                              <SelectItem value="delivered_with_modification">تم التوصيل مع التعديل</SelectItem>
                              <SelectItem value="cancelled">ملغي</SelectItem>
                              <SelectItem value="returned">مرتجع</SelectItem>
                              <SelectItem value="partially_returned">مرتجع جزئي</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('ar-EG')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handlePrintOrder(order)}
                              title="طباعة الفاتورة"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    هل أنت متأكد من حذف هذا الأوردر؟ لا يمكن التراجع عن هذا الإجراء.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteOrderMutation.mutate(order.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    حذف
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modification Dialog */}
        <Dialog open={modificationDialogOpen} onOpenChange={setModificationDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تعديل الأوردر</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                أدخل المبلغ المعدل للأوردر رقم #{selectedModifyOrder?.order_number || selectedModifyOrder?.id.slice(0, 8)}
              </p>
              <div>
                <Label htmlFor="modifiedAmount">المبلغ المعدل (ج.م)</Label>
                <Input
                  id="modifiedAmount"
                  type="number"
                  value={modifiedAmount || ""}
                  onChange={(e) => setModifiedAmount(Number(e.target.value) || 0)}
                  placeholder="أدخل المبلغ الجديد"
                  min="0"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setModificationDialogOpen(false);
                    setSelectedModifyOrder(null);
                    setModifiedAmount(0);
                  }}
                >
                  إلغاء
                </Button>
                <Button 
                  onClick={() => {
                    if (selectedModifyOrder && modifiedAmount > 0) {
                      modifyOrderMutation.mutate({
                        orderId: selectedModifyOrder.id,
                        modifiedAmount
                      });
                    } else {
                      toast.error("يرجى إدخال مبلغ صحيح");
                    }
                  }}
                >
                  تأكيد
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Orders;