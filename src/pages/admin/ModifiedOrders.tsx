import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ModifiedOrders = () => {
  const navigate = useNavigate();
  const [dateFilter, setDateFilter] = useState<string>("");
  const [governorateFilter, setGovernorateFilter] = useState<string>("all");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["modified-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          customers (name, phone, phone2, address, governorate),
          delivery_agents (name, serial_number)
        `)
        .eq("status", "delivered_with_modification")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const egyptGovernorates = [
    "القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الشرقية", "المنوفية", "القليوبية",
    "البحيرة", "الغربية", "بني سويف", "الفيوم", "المنيا", "أسيوط", "سوهاج", "قنا",
    "الأقصر", "أسوان", "البحر الأحمر", "الوادي الجديد", "مطروح", "شمال سيناء",
    "جنوب سيناء", "بورسعيد", "دمياط", "الإسماعيلية", "السويس", "كفر الشيخ", "الأقصر"
  ];

  const filteredOrders = orders?.filter(order => {
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
              <CardTitle>الأوردرات المعدلة</CardTitle>
              <div className="flex items-center gap-4 flex-wrap">
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
            {!filteredOrders || filteredOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد أوردرات معدلة</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الأوردر</TableHead>
                      <TableHead>العميل</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>المحافظة</TableHead>
                      <TableHead>الإجمالي الأصلي</TableHead>
                      <TableHead>المبلغ المعدل</TableHead>
                      <TableHead>المندوب</TableHead>
                      <TableHead>التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-xs">
                          #{order.order_number || order.id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {order.customers?.name}
                        </TableCell>
                        <TableCell>
                          {order.customers?.phone}
                          {order.customers?.phone2 && (
                            <div className="text-xs text-muted-foreground">
                              {order.customers.phone2}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {order.customers?.governorate || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {parseFloat(order.total_amount.toString()).toFixed(2)} ج.م
                        </TableCell>
                        <TableCell className="font-bold text-primary">
                          {order.modified_amount 
                            ? parseFloat(order.modified_amount.toString()).toFixed(2) + " ج.م"
                            : "-"
                          }
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
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('ar-EG')}
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

export default ModifiedOrders;