import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Returns = () => {
  const navigate = useNavigate();
  const [dateFilter, setDateFilter] = useState<string>("");
  const [governorateFilter, setGovernorateFilter] = useState<string>("all");

  const egyptGovernorates = [
    "القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الشرقية", "المنوفية", "القليوبية",
    "البحيرة", "الغربية", "بني سويف", "الفيوم", "المنيا", "أسيوط", "سوهاج", "قنا",
    "الأقصر", "أسوان", "البحر الأحمر", "الوادي الجديد", "مطروح", "شمال سيناء",
    "جنوب سيناء", "بورسعيد", "دمياط", "الإسماعيلية", "السويس", "كفر الشيخ", "الأقصر"
  ];

  const { data: returns, isLoading } = useQuery({
    queryKey: ["returns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("returns")
        .select(`
          *,
          customers (name, phone, address, governorate),
          delivery_agents (name, serial_number),
          orders (id, total_amount, status)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const filteredReturns = returns?.filter(returnItem => {
    if (dateFilter) {
      const returnDate = new Date(returnItem.created_at).toISOString().split('T')[0];
      if (returnDate !== dateFilter) return false;
    }
    if (governorateFilter !== "all" && returnItem.customers?.governorate !== governorateFilter) {
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
            <div className="space-y-4">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                المرتجعات
              </CardTitle>
              
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
            {!filteredReturns || filteredReturns.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد مرتجعات</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم المرتجع</TableHead>
                      <TableHead>رقم الأوردر</TableHead>
                      <TableHead>العميل</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>المحافظة</TableHead>
                      <TableHead>المندوب</TableHead>
                      <TableHead>قيمة المرتجع</TableHead>
                      <TableHead>المنتجات المرتجعة</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>ملاحظات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReturns.map((returnItem) => {
                      const returnedItems = returnItem.returned_items as any[];
                      return (
                        <TableRow key={returnItem.id}>
                          <TableCell className="font-mono text-xs">
                            {returnItem.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {returnItem.order_id?.slice(0, 8)}...
                          </TableCell>
                          <TableCell className="font-medium">
                            {returnItem.customers?.name}
                          </TableCell>
                          <TableCell>{returnItem.customers?.phone}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {returnItem.customers?.governorate || "-"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {returnItem.delivery_agents ? (
                              <Badge variant="outline">
                                {returnItem.delivery_agents.name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="font-bold text-destructive">
                            {parseFloat(returnItem.return_amount.toString()).toFixed(2)} ج.م
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {returnedItems.map((item: any, idx: number) => (
                                <div key={idx}>
                                  {item.product_name} × {item.quantity}
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(returnItem.created_at).toLocaleDateString("ar-EG")}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            {returnItem.notes || "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Summary */}
                <div className="mt-6 p-4 bg-accent rounded-lg">
                  <h3 className="font-bold mb-2">ملخص المرتجعات</h3>
                  <p>عدد المرتجعات: {filteredReturns.length}</p>
                  <p className="font-bold text-lg text-destructive">
                    إجمالي قيمة المرتجعات: {filteredReturns.reduce((sum, item) => sum + parseFloat(item.return_amount.toString()), 0).toFixed(2)} ج.م
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

export default Returns;