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
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, UserCheck, Printer, Download, Barcode } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import * as XLSX from 'xlsx';

const Orders = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [bulkAgentId, setBulkAgentId] = useState<string>("");
  const [bulkShippingCost, setBulkShippingCost] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [governorateFilter, setGovernorateFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false);
  const [barcodeOrders, setBarcodeOrders] = useState<string[]>([""]);
  const [officeName, setOfficeName] = useState<string>("");
  const [editingNotes, setEditingNotes] = useState<{ [key: string]: string }>({});

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
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
        .is("delivery_agent_id", null)
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

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ orderIds, agentId, shippingCost }: { orderIds: string[]; agentId: string; shippingCost: number }) => {
      const { error } = await supabase
        .from("orders")
        .update({ 
          delivery_agent_id: agentId,
          agent_shipping_cost: shippingCost,
          status: 'shipped'
        })
        .in("id", orderIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["all-orders"] });
      queryClient.invalidateQueries({ queryKey: ["agent-orders"] });
      toast.success("تم تعيين المندوب لجميع الأوردرات المحددة وتغيير الحالة إلى تم الشحن");
      setSelectedOrders([]);
      setBulkAgentId("");
      setBulkShippingCost(0);
    },
  });

  const assignByBarcodeMutation = useMutation({
    mutationFn: async ({ orderNumbers, agentId, shippingCost }: { orderNumbers: string[]; agentId: string; shippingCost: number }) => {
      const orderNumbersAsInt = orderNumbers.map(n => parseInt(n, 10)).filter(n => !isNaN(n));
      
      const { data: ordersToAssign, error: fetchError } = await supabase
        .from("orders")
        .select("id")
        .in("order_number", orderNumbersAsInt);
      
      if (fetchError) throw fetchError;
      
      const orderIds = ordersToAssign.map(o => o.id);
      
      const { error } = await supabase
        .from("orders")
        .update({ 
          delivery_agent_id: agentId,
          agent_shipping_cost: shippingCost,
          status: 'shipped'
        })
        .in("id", orderIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["all-orders"] });
      queryClient.invalidateQueries({ queryKey: ["agent-orders"] });
      toast.success("تم تعيين الأوردرات بنجاح");
      setBarcodeDialogOpen(false);
      setBarcodeOrders([""]);
      setBulkAgentId("");
      setBulkShippingCost(0);
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: async ({ orderId, notes }: { orderId: string; notes: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ notes })
        .eq("id", orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("تم تحديث الملاحظات بنجاح");
      setEditingNotes({});
    },
  });

  // Helper function to get product name from order item
  const getProductInfo = (item: any) => {
    // Try to parse product_details JSON first
    try {
      if (item.product_details) {
        const details = typeof item.product_details === 'string' 
          ? JSON.parse(item.product_details) 
          : item.product_details;
        return {
          name: details.name || details.product_name || item.products?.name || "منتج محذوف",
          price: details.price || item.price,
          size: details.size || item.size,
          color: details.color || item.color
        };
      }
    } catch (e) {
      // If JSON parse fails, check if it's a plain string
      if (typeof item.product_details === 'string' && item.product_details.trim()) {
        return {
          name: item.product_details,
          price: item.price,
          size: item.size,
          color: item.color
        };
      }
    }
    // Fallback to products relation or show "منتج محذوف"
    return {
      name: item.products?.name || "منتج محذوف",
      price: item.price,
      size: item.size,
      color: item.color
    };
  };

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // First delete order items
      const { error: itemsError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", orderId);
      
      if (itemsError) throw itemsError;

      // Then delete the order
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["all-orders"] });
      toast.success("تم حذف الأوردر بنجاح");
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
    if (selectedOrders.length === filteredOrders?.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders?.map(o => o.id) || []);
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

  const handleBarcodeAssign = () => {
    if (!bulkAgentId) {
      toast.error("يرجى اختيار مندوب");
      return;
    }
    const validOrders = barcodeOrders.filter(o => o.trim() !== "");
    if (validOrders.length === 0) {
      toast.error("يرجى إدخال أرقام الأوردرات");
      return;
    }
    assignByBarcodeMutation.mutate({ 
      orderNumbers: validOrders, 
      agentId: bulkAgentId, 
      shippingCost: bulkShippingCost 
    });
  };

  const handleExportExcel = () => {
    if (selectedOrders.length === 0) {
      toast.error("يرجى اختيار أوردرات للتصدير");
      return;
    }

    const selectedOrdersData = orders?.filter(o => selectedOrders.includes(o.id));
    
    const exportData = selectedOrdersData?.map(order => {
      const totalAmount = parseFloat(order.total_amount?.toString() || "0");
      const discount = parseFloat(order.discount?.toString() || "0");
      const shippingCost = parseFloat(order.shipping_cost?.toString() || "0");
      const finalAmount = totalAmount + shippingCost;

      return {
        "رقم الأوردر": order.order_number || order.id.slice(0, 8),
        "المحافظة": order.customers?.governorate || "-",
        "الاسم": order.customers?.name,
        "الهاتف": order.customers?.phone,
        "الهاتف الإضافي": (order.customers as any)?.phone2 || "-",
        "العنوان": order.customers?.address,
        "تفاصيل الأوردر": (() => {
          if (order.order_details) {
            try {
              const parsed = JSON.parse(order.order_details);
              if (Array.isArray(parsed)) {
                return parsed.map((item: any) => `${item.name} × ${item.quantity}`).join(", ");
              }
            } catch (e) {
              return order.order_details;
            }
          }
          return order.order_items?.map((item: any) => {
            const productInfo = getProductInfo(item);
            return `${productInfo.name} × ${item.quantity}`;
          }).join(", ");
        })(),
        "الصافي": totalAmount.toFixed(2),
        "الخصم": discount.toFixed(2),
        "الشحن": shippingCost.toFixed(2),
        "الإجمالي": finalAmount.toFixed(2),
        "الملاحظات": order.notes || "-",
        "التاريخ": new Date(order.created_at).toLocaleDateString("ar-EG")
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData || []);
    
    // Enhanced styling for Excel
    const colWidths = [
      { wch: 12 }, // رقم الأوردر
      { wch: 15 }, // المحافظة
      { wch: 20 }, // الاسم
      { wch: 15 }, // الهاتف
      { wch: 15 }, // الهاتف الإضافي
      { wch: 35 }, // العنوان
      { wch: 30 }, // تفاصيل الأوردر
      { wch: 12 }, // الصافي
      { wch: 10 }, // الخصم
      { wch: 10 }, // الشحن
      { wch: 12 }, // الإجمالي
      { wch: 25 }, // الملاحظات
      { wch: 12 }  // التاريخ
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الأوردرات");
    XLSX.writeFile(wb, `orders_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("تم تصدير الأوردرات بنجاح");
  };

  const handlePrintInvoices = () => {
    if (selectedOrders.length === 0) {
      toast.error("يرجى اختيار أوردرات للطباعة");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const selectedOrdersData = orders?.filter(o => selectedOrders.includes(o.id));
    
    const invoicesHtml = selectedOrdersData?.map(order => {
      // Parse order_details if it's JSON array from external store
      let orderItemsHtml = '';
      if (order.order_details) {
        try {
          const parsed = JSON.parse(order.order_details);
          if (Array.isArray(parsed)) {
            orderItemsHtml = parsed.map((item: any) => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.name}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.quantity}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${parseFloat(item.price?.toString() || "0").toFixed(2)} ج.م</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${(parseFloat(item.price?.toString() || "0") * item.quantity).toFixed(2)} ج.م</td>
              </tr>
            `).join('');
          }
        } catch (e) {
          // Not JSON, use order_items
        }
      }
      
      if (!orderItemsHtml && order.order_items) {
        orderItemsHtml = order.order_items.map((item: any) => {
          const productInfo = getProductInfo(item);
          return `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">${productInfo.name}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${item.quantity}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${parseFloat(productInfo.price.toString()).toFixed(2)} ج.م</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${(parseFloat(productInfo.price.toString()) * item.quantity).toFixed(2)} ج.م</td>
            </tr>
          `;
        }).join('');
      }

      const totalAmount = parseFloat(order.total_amount?.toString() || "0");
      const discount = parseFloat(order.discount?.toString() || "0");
      const shippingCost = parseFloat(order.shipping_cost?.toString() || "0");
      const finalAmount = totalAmount + shippingCost;

      return `
        <div style="page-break-after: always; padding: 20px;">
          <h1 style="text-align: center;">${officeName || "فاتورة"}</h1>
          <div style="margin: 20px 0;">
            <p><strong>رقم الأوردر:</strong> #${order.order_number || order.id.slice(0, 8)}</p>
            <p><strong>اسم العميل:</strong> ${order.customers?.name}</p>
            <p><strong>الهاتف:</strong> ${order.customers?.phone}</p>
            ${(order.customers as any)?.phone2 ? `<p><strong>هاتف إضافي:</strong> ${(order.customers as any).phone2}</p>` : ''}
            <p><strong>العنوان:</strong> ${order.customers?.address}</p>
            <p><strong>المحافظة:</strong> ${order.customers?.governorate || '-'}</p>
            ${order.order_details ? `<p><strong>تفاصيل الأوردر:</strong> ${order.order_details}</p>` : ''}
            ${order.notes ? `<p><strong>ملاحظات:</strong> ${order.notes}</p>` : ''}
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr>
                <th style="border: 1px solid #ddd; padding: 12px; background-color: #f2f2f2;">المنتج</th>
                <th style="border: 1px solid #ddd; padding: 12px; background-color: #f2f2f2;">الكمية</th>
                <th style="border: 1px solid #ddd; padding: 12px; background-color: #f2f2f2;">السعر</th>
                <th style="border: 1px solid #ddd; padding: 12px; background-color: #f2f2f2;">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${orderItemsHtml}
            </tbody>
          </table>
          <div style="margin-top: 20px;">
            <p style="font-size: 16px;"><strong>الصافي:</strong> ${totalAmount.toFixed(2)} ج.م</p>
            ${discount > 0 ? `<p style="font-size: 16px;"><strong>الخصم:</strong> ${discount.toFixed(2)} ج.م</p>` : ''}
            <p style="font-size: 16px;"><strong>الشحن:</strong> ${shippingCost.toFixed(2)} ج.م</p>
            <p style="font-size: 18px; font-weight: bold;"><strong>الإجمالي:</strong> ${finalAmount.toFixed(2)} ج.م</p>
          </div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>الفواتير</title>
          <style>
            body { font-family: Arial, sans-serif; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${invoicesHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
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
      delivered_with_modification: "تم التوصيل مع التعديل"
    };
    return texts[status] || status;
  };

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
      const query = searchQuery.toLowerCase();
      const orderNumber = order.order_number?.toString() || "";
      const customerName = order.customers?.name?.toLowerCase() || "";
      const customerPhone = order.customers?.phone || "";
      const customerPhone2 = (order.customers as any)?.phone2 || "";
      
      if (!orderNumber.includes(query) && 
          !customerName.includes(query) && 
          !customerPhone.includes(query) && 
          !customerPhone2.includes(query)) {
        return false;
      }
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
                    <Button onClick={handleExportExcel} size="sm" variant="outline">
                      <Download className="ml-2 h-4 w-4" />
                      تصدير Excel
                    </Button>
                    <Button onClick={handlePrintInvoices} size="sm" variant="outline">
                      <Printer className="ml-2 h-4 w-4" />
                      طباعة الفواتير
                    </Button>
                    <Button onClick={() => setBarcodeDialogOpen(true)} size="sm" variant="outline">
                      <Barcode className="ml-2 h-4 w-4" />
                      تعيين بالباركود
                    </Button>
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
              
              <div className="sticky top-16 z-10 bg-card pt-2 pb-2 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">بحث:</span>
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="رقم الأوردر، الاسم، أو الهاتف"
                    className="w-64"
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
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedOrders.length === filteredOrders.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>رقم الأوردر</TableHead>
                      <TableHead>المحافظة</TableHead>
                      <TableHead>الاسم</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>الهاتف الإضافي</TableHead>
                      <TableHead>العنوان</TableHead>
                      <TableHead>تفاصيل الأوردر</TableHead>
                      <TableHead>السعر النهائي</TableHead>
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
                          <TableCell>
                            <Checkbox
                              checked={selectedOrders.includes(order.id)}
                              onCheckedChange={() => toggleOrderSelection(order.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            #{order.order_number || order.id.slice(0, 8)}
                          </TableCell>
                          <TableCell>{order.customers?.governorate || "-"}</TableCell>
                          <TableCell className="font-medium">{order.customers?.name}</TableCell>
                          <TableCell>{order.customers?.phone}</TableCell>
                          <TableCell>{(order.customers as any)?.phone2 || "-"}</TableCell>
                          <TableCell className="max-w-xs break-words whitespace-normal">{order.customers?.address}</TableCell>
                          <TableCell className="max-w-xs">
                            {(() => {
                              // Try to parse order_details as JSON array first
                              if (order.order_details) {
                                try {
                                  const parsed = JSON.parse(order.order_details);
                                  if (Array.isArray(parsed)) {
                                    return (
                                      <div className="text-xs space-y-1">
                                        {parsed.map((item: any, idx: number) => (
                                          <div key={idx}>
                                            {item.name} × {item.quantity}
                                            {item.size && <span className="text-muted-foreground"> - {item.size}</span>}
                                            {item.color && <span className="text-muted-foreground"> - {item.color}</span>}
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  }
                                } catch (e) {
                                  // Not JSON, display as text
                                  return order.order_details;
                                }
                              }
                              // Fallback to order_items
                              return (
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
                              );
                            })()}
                          </TableCell>
                          <TableCell className="font-bold">
                            {finalAmount.toFixed(2)} ج.م
                          </TableCell>
                          <TableCell className="max-w-xs">
                            {editingNotes[order.id] !== undefined ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editingNotes[order.id]}
                                  onChange={(e) => setEditingNotes({ ...editingNotes, [order.id]: e.target.value })}
                                  rows={3}
                                  className="min-w-[200px]"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => updateNotesMutation.mutate({ orderId: order.id, notes: editingNotes[order.id] })}
                                  >
                                    حفظ
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      const newNotes = { ...editingNotes };
                                      delete newNotes[order.id];
                                      setEditingNotes(newNotes);
                                    }}
                                  >
                                    إلغاء
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div 
                                className="cursor-pointer hover:bg-accent/20 p-2 rounded break-words whitespace-normal"
                                onClick={() => setEditingNotes({ ...editingNotes, [order.id]: order.notes || "" })}
                              >
                                {order.notes || "اضغط لإضافة ملاحظة"}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(order.created_at).toLocaleDateString("ar-EG")}
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  حذف
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    هل أنت متأكد من حذف هذا الأوردر؟ سيتم حذف جميع البيانات المرتبطة به. هذا الإجراء لا يمكن التراجع عنه.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteOrderMutation.mutate(order.id)}>
                                    حذف
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

        <Dialog open={barcodeDialogOpen} onOpenChange={setBarcodeDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>تعيين أوردرات بالباركود</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>اختر المندوب</Label>
                <Select value={bulkAgentId} onValueChange={setBulkAgentId}>
                  <SelectTrigger>
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
              </div>
              <div>
                <Label>شحن المندوب</Label>
                <Input
                  type="number"
                  value={bulkShippingCost}
                  onChange={(e) => setBulkShippingCost(Number(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label>أرقام الأوردرات</Label>
                {barcodeOrders.map((order, idx) => (
                  <Input
                    key={idx}
                    value={order}
                    onChange={(e) => {
                      const newOrders = [...barcodeOrders];
                      newOrders[idx] = e.target.value;
                      setBarcodeOrders(newOrders);
                    }}
                    placeholder={`رقم الأوردر ${idx + 1}`}
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBarcodeOrders([...barcodeOrders, ""])}
                  className="w-full"
                >
                  إضافة أوردر آخر
                </Button>
              </div>
              <Button onClick={handleBarcodeAssign} className="w-full">
                تعيين الأوردرات
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Orders;
