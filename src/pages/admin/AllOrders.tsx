import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AllOrders = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [governorateFilter, setGovernorateFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

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
      delivered_with_modification: "تم التوصيل مع التعديل"
    };
    return texts[status] || status;
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
                                {order.order_items?.map((item: any, idx: number) => (
                                  <div key={idx}>
                                    {item.products?.name} × {item.quantity}
                                  </div>
                                ))}
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
                            <Badge className={getStatusColor(order.status)}>
                              {getStatusText(order.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{order.notes || "-"}</TableCell>
                          <TableCell className="text-xs">
                            {new Date(order.created_at).toLocaleDateString("ar-EG")}
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
