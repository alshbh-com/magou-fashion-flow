import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const AllOrders = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [governorateFilter, setGovernorateFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editingStatus, setEditingStatus] = useState<{orderId: string, currentStatus: string} | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["all-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          customers (name, phone, phone2, address, governorate),
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

  const { data: governorates } = useQuery({
    queryKey: ["governorates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("governorates")
        .select("*")
        .order("name", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  // Helper function to get product name from order item
  const getProductInfo = (item: any) => {
    try {
      if (item.product_details) {
        const details = JSON.parse(item.product_details);
        return {
          name: details.name || item.products?.name || "-",
          price: details.price || item.price,
          size: details.size || item.size,
          color: details.color || item.color
        };
      }
    } catch (e) {
      // If JSON parse fails, use original values
    }
    return {
      name: item.products?.name || "-",
      price: item.price,
      size: item.size,
      color: item.color
    };
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500",
      processing: "bg-blue-500",
      shipped: "bg-purple-500",
      delivered: "bg-green-500",
      cancelled: "bg-red-500",
      returned: "bg-orange-500",
      partially_returned: "bg-orange-400",
      delivered_with_modification: "bg-teal-500"
    };
    return colors[status] || "bg-gray-500";
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      pending: "قيد الانتظار",
      processing: "قيد التنفيذ",
      shipped: "تم الشحن",
      delivered: "تم التوصيل",
      cancelled: "ملغي",
      returned: "مرتجع",
      partially_returned: "مرتجع جزئي",
      delivered_with_modification: "تم التوصيل مع التعديل",
      return_no_shipping: "مرتجع دون شحن"
    };
    return texts[status] || status;
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus, oldStatus, order }: { 
      orderId: string; 
      newStatus: string; 
      oldStatus: string;
      order: any;
    }) => {
      // If changing from delivered/returned back to shipped, update agent totals
      if ((oldStatus === 'delivered' || oldStatus === 'returned' || oldStatus === 'partially_returned') && newStatus === 'shipped') {
        if (order.delivery_agent_id) {
          const owedAmount = parseFloat(order.total_amount?.toString() || "0") + 
                            parseFloat(order.shipping_cost?.toString() || "0") - 
                            parseFloat(order.agent_shipping_cost?.toString() || "0");
          
          // Get current total_owed
          const { data: agentData, error: fetchError } = await supabase
            .from("delivery_agents")
            .select("total_owed")
            .eq("id", order.delivery_agent_id)
            .single();
          
          if (fetchError) throw fetchError;
          
          const currentOwed = parseFloat(agentData.total_owed?.toString() || "0");
          const newOwed = currentOwed + owedAmount;
          
          // Add back to agent's total_owed
          const { error: agentError } = await supabase
            .from("delivery_agents")
            .update({ 
              total_owed: newOwed
            })
            .eq("id", order.delivery_agent_id);
          
          if (agentError) throw agentError;

          // Create a new payment record
          const { error: paymentError } = await supabase
            .from("agent_payments")
            .insert({
              delivery_agent_id: order.delivery_agent_id,
              order_id: orderId,
              amount: owedAmount,
              payment_type: 'owed',
              notes: `إعادة تعيين طلب رقم ${order.order_number} من ${getStatusText(oldStatus)} إلى تم الشحن`
            });
          
          if (paymentError) throw paymentError;
        }
      }

      // Update order status
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus as any })
        .eq("id", orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-orders"] });
      queryClient.invalidateQueries({ queryKey: ["agent-orders"] });
      toast.success("تم تحديث حالة الأوردر بنجاح");
      setEditingStatus(null);
    },
    onError: (error) => {
      console.error("Error updating status:", error);
      toast.error("حدث خطأ أثناء تحديث الحالة");
    },
  });

  const filteredOrders = orders?.filter(order => {
    if (statusFilter !== "all" && order.status !== statusFilter) return false;
    if (startDate || endDate) {
      const orderDate = new Date(order.created_at).toISOString().split('T')[0];
      if (startDate && orderDate < startDate) return false;
      if (endDate && orderDate > endDate) return false;
    }
    if (governorateFilter !== "all" && order.customers?.governorate !== governorateFilter) {
      return false;
    }
    if (searchQuery) {
      const orderNumber = order.order_number?.toString() || "";
      if (!orderNumber.includes(searchQuery)) return false;
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
            <CardTitle>جميع الأوردرات</CardTitle>
            <div className="sticky top-16 z-10 bg-card pt-4 pb-2 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">بحث برقم الأوردر:</span>
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="رقم الأوردر"
                  className="w-48"
                />
              </div>
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
                    <SelectItem value="delivered_with_modification">تم التوصيل مع التعديل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">من تاريخ:</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">إلى تاريخ:</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40"
                />
              </div>
              {(startDate || endDate) && (
                <Button size="sm" variant="ghost" onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}>
                  إلغاء
                </Button>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">فلتر حسب المحافظة:</span>
                <Select value={governorateFilter} onValueChange={setGovernorateFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="جميع المحافظات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المحافظات</SelectItem>
                    {governorates?.map((gov) => (
                      <SelectItem key={gov.id} value={gov.name}>
                        {gov.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!filteredOrders || filteredOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد أوردرات</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الأوردر</TableHead>
                      <TableHead>المحافظة</TableHead>
                      <TableHead>الاسم</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>الهاتف الإضافي</TableHead>
                      <TableHead>العنوان</TableHead>
                      <TableHead>تفاصيل الأوردر</TableHead>
                      <TableHead>السعر النهائي</TableHead>
                      <TableHead>المندوب</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الملاحظات</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => {
                      const totalAmount = parseFloat(order.total_amount?.toString() || "0");
                      const discount = parseFloat(order.discount?.toString() || "0");
                      const shippingCost = parseFloat(order.shipping_cost?.toString() || "0");
                      const finalAmount = totalAmount + shippingCost;

                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-xs">
                            #{order.order_number || order.id.slice(0, 8)}
                          </TableCell>
                          <TableCell>{order.customers?.governorate || "-"}</TableCell>
                          <TableCell className="font-medium">{order.customers?.name}</TableCell>
                          <TableCell>{order.customers?.phone}</TableCell>
                          <TableCell>{(order.customers as any)?.phone2 || "-"}</TableCell>
                          <TableCell className="max-w-xs truncate">{order.customers?.address}</TableCell>
                          <TableCell className="max-w-xs">
                            {order.order_details || (
                              <div className="text-xs space-y-1">
                                {order.order_items?.map((item: any, idx: number) => {
                                  const productInfo = getProductInfo(item);
                                  return (
                                    <div key={idx}>
                                      {productInfo.name} × {item.quantity}
                                      {productInfo.size && <span className="text-muted-foreground"> - {productInfo.size}</span>}
                                      {productInfo.color && <span className="text-muted-foreground"> - {productInfo.color}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-bold">
                            {finalAmount.toFixed(2)} ج.م
                          </TableCell>
                          <TableCell>
                            {order.delivery_agents ? (
                              <div>
                                <div className="font-medium">{order.delivery_agents.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  #{order.delivery_agents.serial_number}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">غير معين</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingStatus?.orderId === order.id ? (
                              <Select
                                value={editingStatus.currentStatus}
                                onValueChange={(value) => setEditingStatus({ orderId: order.id, currentStatus: value })}
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">قيد الانتظار</SelectItem>
                                  <SelectItem value="processing">قيد التنفيذ</SelectItem>
                                  <SelectItem value="shipped">تم الشحن</SelectItem>
                                  <SelectItem value="delivered">تم التوصيل</SelectItem>
                                  <SelectItem value="cancelled">ملغي</SelectItem>
                                  <SelectItem value="returned">مرتجع</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge className={getStatusColor(order.status)}>
                                {getStatusText(order.status)}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{order.notes || "-"}</TableCell>
                          <TableCell className="text-xs">
                            {new Date(order.created_at).toLocaleDateString("ar-EG")}
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                >
                                  تعديل الحالة
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>تعديل حالة الأوردر</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    اختر الحالة الجديدة للأوردر #{order.order_number || order.id.slice(0, 8)}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="py-4">
                                  <Select
                                    value={editingStatus?.orderId === order.id ? editingStatus.currentStatus : order.status}
                                    onValueChange={(value) => setEditingStatus({ orderId: order.id, currentStatus: value })}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending">قيد الانتظار</SelectItem>
                                      <SelectItem value="processing">قيد التنفيذ</SelectItem>
                                      <SelectItem value="shipped">تم الشحن</SelectItem>
                                      <SelectItem value="delivered">تم التوصيل</SelectItem>
                                      <SelectItem value="cancelled">ملغي</SelectItem>
                                      <SelectItem value="returned">مرتجع</SelectItem>
                                      <SelectItem value="partially_returned">مرتجع جزئي</SelectItem>
                                      <SelectItem value="return_no_shipping">مرتجع دون شحن</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setEditingStatus(null)}>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => {
                                    if (editingStatus) {
                                      updateStatusMutation.mutate({
                                        orderId: order.id,
                                        newStatus: editingStatus.currentStatus,
                                        oldStatus: order.status,
                                        order: order
                                      });
                                    }
                                  }}>
                                    حفظ
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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

export default AllOrders;
