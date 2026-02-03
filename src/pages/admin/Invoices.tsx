import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Printer, FileSpreadsheet, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import * as XLSX from "xlsx";

const Invoices = () => {
  const navigate = useNavigate();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  
  // فلاتر
  const [dateFilter, setDateFilter] = useState<string>("");
  const [governorateFilter, setGovernorateFilter] = useState<string>("all");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders-for-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          customers (name, phone, address, governorate, phone2),
          delivery_agents (name, serial_number),
          governorates (name, shipping_cost),
          order_items (*, products (name))
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // جلب المحافظات للفلتر
  const { data: governorates } = useQuery({
    queryKey: ["governorates-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("governorates")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // تحويل التاريخ ليوم Cairo
  const getDateKey = (value: string | Date) => {
    const d = typeof value === "string" ? new Date(value) : value;
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  };

  // استخراج التواريخ الفريدة من الأوردرات
  const uniqueDates = useMemo(() => {
    if (!orders?.length) return [];
    const dates = new Set<string>();
    orders.forEach(order => {
      dates.add(getDateKey(order.created_at));
    });
    return Array.from(dates).sort().reverse();
  }, [orders]);

  // فلترة الأوردرات
  const filteredOrders = useMemo(() => {
    if (!orders?.length) return [];
    
    return orders.filter(order => {
      // فلتر التاريخ
      if (dateFilter) {
        const orderDate = getDateKey(order.created_at);
        if (orderDate !== dateFilter) return false;
      }
      
      // فلتر المحافظة
      if (governorateFilter && governorateFilter !== "all") {
        const orderGov = order.governorates?.name || order.customers?.governorate || "";
        if (orderGov !== governorateFilter) return false;
      }
      
      return true;
    });
  }, [orders, dateFilter, governorateFilter]);

  // تصدير Excel للأوردرات المفلترة/المحددة فقط
  const handleExportExcel = () => {
    // إذا كان هناك أوردرات محددة، صدّرها فقط، وإلا صدّر المفلتر
    const ordersToExport = selectedOrders.length > 0 
      ? filteredOrders.filter(o => selectedOrders.includes(o.id))
      : filteredOrders;
    
    if (!ordersToExport?.length) {
      return;
    }
    
    const exportData = ordersToExport.map(order => {
      const totalAmount = parseFloat(order.total_amount.toString());
      const customerShipping = parseFloat((order.shipping_cost || 0).toString());
      const agentShipping = parseFloat((order.agent_shipping_cost || 0).toString());
      const totalPrice = totalAmount + customerShipping;
      const netAmount = totalPrice - agentShipping;
      
      return {
        "رقم الأوردر": order.order_number || order.id.slice(0, 8),
        "اسم العميل": order.customers?.name || "-",
        "الهاتف": order.customers?.phone || "-",
        "العنوان": order.customers?.address || "-",
        "المحافظة": order.governorates?.name || order.customers?.governorate || "-",
        "المندوب": order.delivery_agents?.name || "-",
        "الحالة": order.status,
        "سعر المنتجات": totalAmount.toFixed(2),
        "شحن العميل": customerShipping.toFixed(2),
        "الإجمالي": totalPrice.toFixed(2),
        "شحن المندوب": agentShipping.toFixed(2),
        "الصافي (المطلوب من المندوب)": netAmount.toFixed(2),
        "الخصم": parseFloat((order.discount || 0).toString()).toFixed(2),
        "التاريخ": new Date(order.created_at).toLocaleDateString("ar-EG")
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الأوردرات");
    
    const fileName = dateFilter 
      ? `orders_${dateFilter}.xlsx`
      : `orders_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handlePrint = () => {
    const ordersToPrint = filteredOrders?.filter(o => selectedOrders.includes(o.id));
    if (!ordersToPrint?.length) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const invoicesHTML = ordersToPrint.map(order => {
      const totalAmount = parseFloat(order.total_amount.toString());
      const customerShipping = parseFloat((order.shipping_cost || 0).toString());
      const totalPrice = totalAmount + customerShipping;
      
      // Get items with size, color and quantity
      const itemsHtml = order.order_items?.map((item: any) => {
        const size = item.size || '-';
        const color = item.color || '-';
        const quantity = item.quantity || 1;
        const itemTotal = parseFloat(item.price.toString()) * quantity;
        return `
          <tr>
            <td style="border: 2px solid #000; padding: 12px; text-align: center; font-size: 16px;">${item.products?.name || '-'}</td>
            <td style="border: 2px solid #000; padding: 12px; text-align: center; font-size: 16px;">${quantity}</td>
            <td style="border: 2px solid #000; padding: 12px; text-align: center; font-size: 16px;">${size}</td>
            <td style="border: 2px solid #000; padding: 12px; text-align: center; font-size: 16px;">${color}</td>
            <td style="border: 2px solid #000; padding: 12px; text-align: center; font-size: 16px;">${itemTotal.toFixed(2)} ج.م</td>
          </tr>
        `;
      }).join('') || '';
      
      return `
      <div style="width: 100%; min-height: 100vh; padding: 20mm; page-break-after: always; font-family: Arial; position: relative; box-sizing: border-box;">
        <!-- Watermark -->
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg); font-size: 120px; font-weight: bold; color: rgba(212, 175, 55, 0.15); pointer-events: none; z-index: 0; white-space: nowrap;">
          Zahra
        </div>
        
        <div style="position: relative; z-index: 1;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="font-size: 48px; font-weight: bold; color: #d4af37; margin: 0;">Zahra</h1>
          </div>
          <h2 style="text-align: center; margin: 15px 0; font-size: 24px;">فاتورة</h2>
          <hr style="border: 2px solid #ddd;"/>
          <div style="margin: 20px 0; line-height: 2; font-size: 18px;">
            <p style="margin: 8px 0;"><strong>رقم الأوردر:</strong> #${order.order_number || order.id.slice(0, 8)}</p>
            <p style="margin: 8px 0;"><strong>التاريخ:</strong> ${new Date(order.created_at).toLocaleDateString('ar-EG')}</p>
            <p style="margin: 8px 0;"><strong>العميل:</strong> ${order.customers?.name}</p>
            <p style="margin: 8px 0;"><strong>الهاتف:</strong> ${order.customers?.phone}</p>
            ${order.customers?.phone2 ? `<p style="margin: 8px 0;"><strong>الهاتف 2:</strong> ${order.customers.phone2}</p>` : ''}
            <p style="margin: 8px 0;"><strong>المحافظة:</strong> ${order.governorates?.name || order.customers?.governorate || "-"}</p>
            <p style="margin: 8px 0;"><strong>سعر شحن المحافظة:</strong> ${order.governorates?.shipping_cost || order.shipping_cost || 0} ج.م</p>
            <p style="margin: 8px 0;"><strong>العنوان:</strong> ${order.customers?.address}</p>
            ${order.notes ? `<p style="margin: 8px 0;"><strong>ملاحظات:</strong> ${order.notes}</p>` : ''}
          </div>
          <hr style="border: 2px solid #ddd;"/>
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 18px;">
            <tr>
              <th style="border: 2px solid #000; padding: 15px; background-color: #f8f8f8;">المنتج</th>
              <th style="border: 2px solid #000; padding: 15px; background-color: #f8f8f8;">الكمية</th>
              <th style="border: 2px solid #000; padding: 15px; background-color: #f8f8f8;">المقاس</th>
              <th style="border: 2px solid #000; padding: 15px; background-color: #f8f8f8;">اللون</th>
              <th style="border: 2px solid #000; padding: 15px; background-color: #f8f8f8;">السعر</th>
            </tr>
            ${itemsHtml}
          </table>
          <hr style="border: 2px solid #ddd; margin-top: 20px;"/>
          <div style="margin-top: 20px; text-align: left; font-size: 20px;">
            <p style="margin: 12px 0;"><strong>سعر المنتجات:</strong> ${totalAmount.toFixed(2)} ج.م</p>
            <p style="margin: 12px 0;"><strong>سعر الشحن:</strong> ${customerShipping.toFixed(2)} ج.م</p>
            <p style="font-size: 24px; font-weight: bold; margin-top: 20px; border-top: 3px solid #000; padding-top: 15px;"><strong>الإجمالي:</strong> ${totalPrice.toFixed(2)} ج.م</p>
          </div>
        </div>
      </div>
    `;
    }).join('');

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>طباعة الفواتير</title>
          <style>
            body { font-family: Arial, sans-serif; }
          </style>
        </head>
        <body>${invoicesHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // تحديد/إلغاء تحديد الكل
  const handleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id));
    }
  };

  if (isLoading) return <div className="p-8">جاري التحميل...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <Button onClick={() => navigate("/admin")} variant="ghost" className="mb-4">
          <ArrowLeft className="ml-2 h-4 w-4" />
          رجوع
        </Button>
        <Card>
          <CardHeader className="flex flex-col gap-4">
            <div className="flex flex-row items-center justify-between flex-wrap gap-4">
              <CardTitle>الفواتير</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={handleExportExcel} disabled={filteredOrders.length === 0}>
                  <FileSpreadsheet className="ml-2 h-4 w-4" />
                  تصدير Excel {selectedOrders.length > 0 ? `(${selectedOrders.length})` : `(${filteredOrders.length})`}
                </Button>
                <Button onClick={handlePrint} disabled={selectedOrders.length === 0}>
                  <Printer className="ml-2 h-4 w-4" />
                  طباعة ({selectedOrders.length})
                </Button>
              </div>
            </div>
            
            {/* الفلاتر */}
            <div className="flex items-end gap-4 flex-wrap p-4 bg-muted/50 rounded-lg">
              <Filter className="h-5 w-5 text-muted-foreground" />
              
              <div className="flex flex-col gap-1">
                <Label className="text-xs">التاريخ</Label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="كل الأيام" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأيام</SelectItem>
                    {uniqueDates.map((date) => (
                      <SelectItem key={date} value={date}>
                        {new Date(date).toLocaleDateString('ar-EG')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-col gap-1">
                <Label className="text-xs">المحافظة</Label>
                <Select value={governorateFilter} onValueChange={setGovernorateFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="كل المحافظات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المحافظات</SelectItem>
                    {governorates?.map((gov) => (
                      <SelectItem key={gov.id} value={gov.name}>
                        {gov.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setDateFilter("");
                  setGovernorateFilter("all");
                }}
              >
                مسح الفلاتر
              </Button>
              
              <div className="mr-auto text-sm text-muted-foreground">
                عدد النتائج: {filteredOrders.length}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredOrders.length > 0 && (
              <div className="mb-4">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {selectedOrders.length === filteredOrders.length ? "إلغاء تحديد الكل" : "تحديد الكل"}
                </Button>
              </div>
            )}
            <div className="space-y-2">
              {filteredOrders?.map((order) => {
                const totalAmount = parseFloat(order.total_amount.toString());
                const customerShipping = parseFloat((order.shipping_cost || 0).toString());
                const agentShipping = parseFloat((order.agent_shipping_cost || 0).toString());
                const totalPrice = totalAmount + customerShipping;
                const netAmount = totalPrice - agentShipping;
                
                return (
                  <div key={order.id} className="flex items-center gap-4 p-4 border rounded">
                    <Checkbox
                      checked={selectedOrders.includes(order.id)}
                      onCheckedChange={(checked) => {
                        setSelectedOrders(checked 
                          ? [...selectedOrders, order.id]
                          : selectedOrders.filter(id => id !== order.id)
                        );
                      }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold">{order.customers?.name}</p>
                        <span className="text-xs px-2 py-0.5 rounded bg-muted">
                          {order.governorates?.name || order.customers?.governorate || "-"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('ar-EG')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        الإجمالي: {totalPrice.toFixed(2)} ج.م | الصافي المطلوب من المندوب: {netAmount.toFixed(2)} ج.م
                      </p>
                    </div>
                  </div>
                );
              })}
              
              {filteredOrders.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  لا توجد فواتير تطابق الفلاتر المحددة
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Invoices;