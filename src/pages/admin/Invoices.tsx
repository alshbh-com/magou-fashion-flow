import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Printer, FileSpreadsheet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import * as XLSX from "xlsx";

const Invoices = () => {
  const navigate = useNavigate();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders-for-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          customers (name, phone, address, governorate),
          delivery_agents (name, serial_number),
          order_items (*, products (name))
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleExportExcel = () => {
    if (!orders?.length) return;
    
    const exportData = orders.map(order => {
      const totalAmount = parseFloat(order.total_amount.toString());
      const customerShipping = parseFloat((order.shipping_cost || 0).toString());
      const agentShipping = parseFloat((order.agent_shipping_cost || 0).toString());
      const totalPrice = totalAmount + customerShipping; // الإجمالي
      const netAmount = totalPrice - agentShipping; // الصافي
      
      return {
        "رقم الأوردر": order.order_number || order.id.slice(0, 8),
        "اسم العميل": order.customers?.name || "-",
        "الهاتف": order.customers?.phone || "-",
        "العنوان": order.customers?.address || "-",
        "المحافظة": order.customers?.governorate || "-",
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
    XLSX.writeFile(wb, `orders_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handlePrint = () => {
    const ordersToPrint = orders?.filter(o => selectedOrders.includes(o.id));
    if (!ordersToPrint?.length) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const invoicesHTML = ordersToPrint.map(order => {
      const totalAmount = parseFloat(order.total_amount.toString());
      const customerShipping = parseFloat((order.shipping_cost || 0).toString());
      const agentShipping = parseFloat((order.agent_shipping_cost || 0).toString());
      const totalPrice = totalAmount + customerShipping; // الإجمالي
      const netAmount = totalPrice - agentShipping; // الصافي
      
      return `
      <div style="width: 148mm; height: 210mm; padding: 10mm; page-break-after: always; font-family: Arial;">
        <h2 style="text-align: center;">Magou Fashion</h2>
        <hr/>
        <p><strong>رقم الأوردر:</strong> ${order.order_number || order.id.slice(0, 8)}</p>
        <p><strong>العميل:</strong> ${order.customers?.name}</p>
        <p><strong>الهاتف:</strong> ${order.customers?.phone}</p>
        <p><strong>العنوان:</strong> ${order.customers?.address}</p>
        <p><strong>المحافظة:</strong> ${order.customers?.governorate || "-"}</p>
        <hr/>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><th style="border: 1px solid #000; padding: 5px;">المنتج</th><th style="border: 1px solid #000; padding: 5px;">الكمية</th><th style="border: 1px solid #000; padding: 5px;">السعر</th></tr>
          ${order.order_items?.map((item: any) => `
            <tr><td style="border: 1px solid #000; padding: 5px;">${item.products?.name}</td><td style="border: 1px solid #000; padding: 5px;">${item.quantity}</td><td style="border: 1px solid #000; padding: 5px;">${parseFloat(item.price.toString()).toFixed(2)} ج.م</td></tr>
          `).join('')}
        </table>
        <hr/>
        <p style="text-align: left; font-size: 16px;"><strong>سعر المنتجات: ${totalAmount.toFixed(2)} ج.م</strong></p>
        <p style="text-align: left; font-size: 16px;"><strong>شحن العميل: ${customerShipping.toFixed(2)} ج.م</strong></p>
        <p style="text-align: left; font-size: 18px;"><strong>الإجمالي: ${totalPrice.toFixed(2)} ج.م</strong></p>
        <hr/>
        <p style="text-align: left; font-size: 16px;"><strong>شحن المندوب (خصم): ${agentShipping.toFixed(2)} ج.م</strong></p>
        <p style="text-align: left; font-size: 20px; color: green;"><strong>الصافي المطلوب من المندوب: ${netAmount.toFixed(2)} ج.م</strong></p>
      </div>
    `;}).join('');

    printWindow.document.write(`<html><head><title>طباعة الفواتير</title></head><body>${invoicesHTML}</body></html>`);
    printWindow.document.close();
    printWindow.print();
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>الفواتير</CardTitle>
            <div className="flex gap-2">
              <Button onClick={handleExportExcel}>
                <FileSpreadsheet className="ml-2 h-4 w-4" />
                تصدير Excel
              </Button>
              <Button onClick={handlePrint} disabled={selectedOrders.length === 0}>
                <Printer className="ml-2 h-4 w-4" />
                طباعة ({selectedOrders.length})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {orders?.map((order) => {
                const totalAmount = parseFloat(order.total_amount.toString());
                const customerShipping = parseFloat((order.shipping_cost || 0).toString());
                const agentShipping = parseFloat((order.agent_shipping_cost || 0).toString());
                const totalPrice = totalAmount + customerShipping; // الإجمالي
                const netAmount = totalPrice - agentShipping; // الصافي
                
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
                      <p className="font-bold">{order.customers?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        الإجمالي: {totalPrice.toFixed(2)} ج.م | الصافي المطلوب من المندوب: {netAmount.toFixed(2)} ج.م
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Invoices;
