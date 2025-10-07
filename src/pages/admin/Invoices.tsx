import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const Invoices = () => {
  const navigate = useNavigate();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders-for-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`*, customers (name, phone, address), order_items (*, products (name))`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handlePrint = () => {
    const ordersToPrint = orders?.filter(o => selectedOrders.includes(o.id));
    if (!ordersToPrint?.length) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const invoicesHTML = ordersToPrint.map(order => `
      <div style="width: 148mm; height: 210mm; padding: 10mm; page-break-after: always; font-family: Arial;">
        <h2 style="text-align: center;">Magou Fashion</h2>
        <hr/>
        <p><strong>رقم الأوردر:</strong> ${order.id.slice(0, 8)}</p>
        <p><strong>العميل:</strong> ${order.customers?.name}</p>
        <p><strong>الهاتف:</strong> ${order.customers?.phone}</p>
        <p><strong>العنوان:</strong> ${order.customers?.address}</p>
        <hr/>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><th style="border: 1px solid #000; padding: 5px;">المنتج</th><th style="border: 1px solid #000; padding: 5px;">الكمية</th><th style="border: 1px solid #000; padding: 5px;">السعر</th></tr>
          ${order.order_items?.map((item: any) => `
            <tr><td style="border: 1px solid #000; padding: 5px;">${item.products?.name}</td><td style="border: 1px solid #000; padding: 5px;">${item.quantity}</td><td style="border: 1px solid #000; padding: 5px;">${parseFloat(item.price.toString()).toFixed(2)} ج.م</td></tr>
          `).join('')}
        </table>
        <hr/>
        <p style="text-align: left; font-size: 18px;"><strong>الإجمالي: ${parseFloat(order.total_amount.toString()).toFixed(2)} ج.م</strong></p>
      </div>
    `).join('');

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
            <Button onClick={handlePrint} disabled={selectedOrders.length === 0}>
              <Printer className="ml-2 h-4 w-4" />
              طباعة ({selectedOrders.length})
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {orders?.map((order) => (
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
                    <p className="text-sm text-muted-foreground">{parseFloat(order.total_amount.toString()).toFixed(2)} ج.م</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Invoices;
