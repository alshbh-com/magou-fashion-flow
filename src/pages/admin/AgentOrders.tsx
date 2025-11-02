import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, PackageX, Printer, Download, AlertTriangle, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import * as XLSX from 'xlsx';

const statusLabels: Record<string, string> = {
  shipped: "تم الشحن",
  delivered: "تم التوصيل",
  returned: "مرتجع",
  partially_returned: "مرتجع جزئي",
  return_no_shipping: "مرتجع دون شحن"
};

const statusColors: Record<string, string> = {
  shipped: "bg-purple-500",
  delivered: "bg-green-500",
  returned: "bg-orange-600",
  partially_returned: "bg-orange-400",
  return_no_shipping: "bg-red-500"
};

const AgentOrders = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [confirmReturnDialogOpen, setConfirmReturnDialogOpen] = useState(false);
  const [pendingReturnOrder, setPendingReturnOrder] = useState<any>(null);
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [selectedOrderForReturn, setSelectedOrderForReturn] = useState<any>(null);
  const [returnData, setReturnData] = useState({
    returned_items: [] as any[],
    notes: "",
    removeShipping: false
  });
  const [editingShipping, setEditingShipping] = useState<string | null>(null);
  const [newShipping, setNewShipping] = useState<string>("");

  const { data: agents } = useQuery({
    queryKey: ["delivery_agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_agents")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ["agent-orders", selectedAgentId],
    queryFn: async () => {
      if (!selectedAgentId) return [];
      
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
        .eq("delivery_agent_id", selectedAgentId)
        .not("status", "in", '("delivered","returned","partially_returned","cancelled")')
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAgentId
  });

  const { data: agentPayments } = useQuery({
    queryKey: ["agent_payments", selectedAgentId],
    queryFn: async () => {
      if (!selectedAgentId) return null;
      
      const { data: agent, error } = await supabase
        .from("delivery_agents")
        .select("total_owed, total_paid")
        .eq("id", selectedAgentId)
        .single();
      
      if (error) throw error;
      return agent;
    },
    enabled: !!selectedAgentId
  });

  const filteredOrders = orders?.filter(order => {
    if (statusFilter !== "all" && order.status !== statusFilter) return false;
    if (startDate || endDate) {
      const orderDate = new Date(order.created_at).toISOString().split('T')[0];
      if (startDate && orderDate < startDate) return false;
      if (endDate && orderDate > endDate) return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const orderNumber = order.order_number?.toString() || "";
      const customerName = order.customers?.name?.toLowerCase() || "";
      const customerPhone = order.customers?.phone || "";
      
      if (!orderNumber.includes(query) && 
          !customerName.includes(query) && 
          !customerPhone.includes(query)) {
        return false;
      }
    }
    return true;
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, removeShipping }: { id: string; status: string; removeShipping?: boolean }) => {
      const order = orders?.find(o => o.id === id);
      if (!order) throw new Error("Order not found");

      let updates: any = { status: status as any };
      
      // إذا كانت الحالة "مرتجع دون شحن"، خصم الشحن من المبلغ
      if (status === "return_no_shipping" && removeShipping) {
        const customerShipping = parseFloat(order.shipping_cost?.toString() || "0");
        
        // خصم الشحن من المستحقات
        const { error: agentError } = await supabase
          .from("delivery_agents")
          .update({ 
            total_owed: order.delivery_agent_id ? 
              await supabase.from("delivery_agents")
                .select("total_owed")
                .eq("id", order.delivery_agent_id)
                .single()
                .then(({ data }) => parseFloat(data?.total_owed?.toString() || "0") - customerShipping)
              : 0
          })
          .eq("id", order.delivery_agent_id!);
        
        if (agentError) throw agentError;

        // إضافة سجل دفع
        await supabase.from("agent_payments").insert({
          delivery_agent_id: order.delivery_agent_id,
          order_id: id,
          amount: -customerShipping,
          payment_type: 'return',
          notes: 'مرتجع دون شحن - خصم الشحن'
        });
      }

      const { error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-orders"] });
      queryClient.invalidateQueries({ queryKey: ["agent_payments"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      toast.success("تم تحديث الحالة");
    },
  });

  const updateShippingMutation = useMutation({
    mutationFn: async ({ orderId, newShipping, oldShipping, agentId }: { orderId: string; newShipping: number; oldShipping: number; agentId: string }) => {
      // Update order agent shipping cost (the cost the agent pays, which reduces what they owe)
      const { error: orderError } = await supabase
        .from("orders")
        .update({ agent_shipping_cost: newShipping })
        .eq("id", orderId);
      
      if (orderError) throw orderError;

      // Calculate the difference (negative because agent_shipping reduces what agent owes)
      const difference = -(newShipping - oldShipping);

      // Update agent total_owed
      const { data: agent, error: fetchError } = await supabase
        .from("delivery_agents")
        .select("total_owed")
        .eq("id", agentId)
        .single();
      
      if (fetchError) throw fetchError;

      const newTotalOwed = parseFloat(agent.total_owed.toString()) + difference;
      
      const { error: updateError } = await supabase
        .from("delivery_agents")
        .update({ total_owed: newTotalOwed })
        .eq("id", agentId);
      
      if (updateError) throw updateError;

      // Add a payment record for the adjustment
      if (difference !== 0) {
        const { error: paymentError } = await supabase
          .from("agent_payments")
          .insert({
            delivery_agent_id: agentId,
            order_id: orderId,
            amount: difference,
            payment_type: 'owed',
            notes: `تعديل شحن المندوب - فرق ${difference > 0 ? '+' : ''}${difference.toFixed(2)} ج.م`
          });
        
        if (paymentError) throw paymentError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-orders"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      queryClient.invalidateQueries({ queryKey: ["agent_payments"] });
      toast.success("تم تحديث سعر الشحن");
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // First, get the order details to check agent assignment
      const { data: order, error: orderFetchError } = await supabase
        .from("orders")
        .select("delivery_agent_id, total_amount, shipping_cost, agent_shipping_cost")
        .eq("id", orderId)
        .maybeSingle();
      
      if (orderFetchError) throw orderFetchError;

      // Delete agent_payments related to this order
      await supabase
        .from("agent_payments")
        .delete()
        .eq("order_id", orderId);

      // Delete returns related to this order
      await supabase
        .from("returns")
        .delete()
        .eq("order_id", orderId);

      // Delete order items
      const { error: itemsError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", orderId);
      
      if (itemsError) throw itemsError;

      // Update agent's total_owed if agent was assigned
      if (order && order.delivery_agent_id) {
        const owedAmount = parseFloat(order.total_amount?.toString() || "0") + 
                          parseFloat(order.shipping_cost?.toString() || "0") - 
                          parseFloat(order.agent_shipping_cost?.toString() || "0");
        
        // Get current total_owed
        const { data: agentData, error: fetchError } = await supabase
          .from("delivery_agents")
          .select("total_owed")
          .eq("id", order.delivery_agent_id)
          .maybeSingle();
        
        if (!fetchError && agentData) {
          const currentOwed = parseFloat(agentData.total_owed?.toString() || "0");
          const newOwed = currentOwed - owedAmount;
          
          await supabase
            .from("delivery_agents")
            .update({ total_owed: newOwed })
            .eq("id", order.delivery_agent_id);
        }
      }

      // Delete the order
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["all-orders"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      queryClient.invalidateQueries({ queryKey: ["agent_payments"] });
      toast.success("تم حذف الأوردر");
    },
    onError: (error) => {
      console.error("Error deleting order:", error);
      toast.error("حدث خطأ أثناء حذف الأوردر");
    },
  });

  const unassignAgentMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("orders")
        .update({ 
          delivery_agent_id: null,
          status: 'pending'
        })
        .eq("id", orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["all-orders"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      queryClient.invalidateQueries({ queryKey: ["agent_payments"] });
      toast.success("تم إلغاء تعيين المندوب");
    },
  });

  const createReturnMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("returns")
        .insert({
          order_id: data.order_id,
          customer_id: data.customer_id,
          delivery_agent_id: data.delivery_agent_id,
          return_amount: data.return_amount,
          returned_items: data.returned_items,
          notes: data.notes
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      toast.success("تم تسجيل المرتجع بنجاح");
      setReturnDialogOpen(false);
      setSelectedOrderForReturn(null);
      setReturnData({ returned_items: [], notes: "", removeShipping: false });
    },
  });

  const handleOpenReturnDialog = (order: any) => {
    setSelectedOrderForReturn(order);
    const items = order.order_items.map((item: any) => ({
      product_id: item.product_id,
      product_name: item.products.name,
      total_quantity: item.quantity,
      returned_quantity: 0,
      price: parseFloat(item.price.toString())
    }));
    setReturnData({ returned_items: items, notes: "", removeShipping: false });
    setReturnDialogOpen(true);
  };

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

  const handleExportExcel = () => {
    if (selectedOrders.length === 0) {
      toast.error("يرجى اختيار أوردرات للتصدير");
      return;
    }

    const selectedOrdersData = orders?.filter(o => selectedOrders.includes(o.id));
    
    const exportData = selectedOrdersData?.map(order => {
      const customerShipping = parseFloat(order.shipping_cost?.toString() || "0");
      const agentShipping = parseFloat(order.agent_shipping_cost?.toString() || "0");
      const totalAmount = parseFloat(order.total_amount.toString());
      const totalPrice = totalAmount + customerShipping;
      const netAmount = totalPrice - agentShipping;

      return {
        "رقم الأوردر": order.order_number || order.id.slice(0, 8),
        "الاسم": order.customers?.name,
        "الهاتف": order.customers?.phone,
        "العنوان": order.customers?.address,
        "المحافظة": order.customers?.governorate || "-",
        "الإجمالي": totalPrice.toFixed(2),
        "شحن المندوب": agentShipping.toFixed(2),
        "الصافي": netAmount.toFixed(2),
        "الحالة": statusLabels[order.status] || order.status,
        "التاريخ": new Date(order.created_at).toLocaleDateString("ar-EG")
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData || []);
    
    // Enhanced styling for Excel
    const colWidths = [
      { wch: 12 }, // رقم الأوردر
      { wch: 20 }, // الاسم
      { wch: 15 }, // الهاتف
      { wch: 35 }, // العنوان
      { wch: 15 }, // المحافظة
      { wch: 12 }, // الإجمالي
      { wch: 12 }, // شحن المندوب
      { wch: 12 }, // الصافي
      { wch: 12 }, // الحالة
      { wch: 12 }  // التاريخ
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "أوردرات المندوب");
    XLSX.writeFile(wb, `agent_orders_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("تم تصدير الأوردرات بنجاح");
  };

  const handlePrintOrders = () => {
    if (selectedOrders.length === 0) {
      toast.error("يرجى اختيار أوردرات للطباعة");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const selectedOrdersData = orders?.filter(o => selectedOrders.includes(o.id));
    
    const invoicesHtml = selectedOrdersData?.map(order => {
      const orderItems = order.order_items?.map((item: any) => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${item.products?.name}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${item.quantity}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${parseFloat(item.price.toString()).toFixed(2)} ج.م</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${(parseFloat(item.price.toString()) * item.quantity).toFixed(2)} ج.م</td>
        </tr>
      `).join('');

      const customerShipping = parseFloat(order.shipping_cost?.toString() || "0");
      const agentShipping = parseFloat(order.agent_shipping_cost?.toString() || "0");
      const totalAmount = parseFloat(order.total_amount.toString());
      const discount = parseFloat(order.discount?.toString() || "0");
      const totalPrice = totalAmount + customerShipping;
      const netAmount = totalPrice - agentShipping;

      return `
        <div style="page-break-after: always; padding: 20px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="/images/magou-logo.jpg" alt="Magou Fashion Logo" style="max-width: 150px; height: auto;" />
          </div>
          <h1 style="text-align: center; margin: 10px 0;">فاتورة</h1>
          <hr style="border: 1px solid #ddd; margin: 20px 0;"/>
          <div style="margin: 20px 0; line-height: 1.8;">
            <p><strong>رقم الأوردر:</strong> #${order.order_number || order.id.slice(0, 8)}</p>
            <p><strong>التاريخ:</strong> ${new Date(order.created_at).toLocaleDateString('ar-EG')}</p>
            <p><strong>اسم العميل:</strong> ${order.customers?.name}</p>
            <p><strong>الهاتف:</strong> ${order.customers?.phone}</p>
            <p><strong>الهاتف 2:</strong> ${(order.customers as any)?.phone2 || '-'}</p>
            <p><strong>المحافظة:</strong> ${order.customers?.governorate || '-'}</p>
            <p><strong>العنوان بالتفصيل:</strong> ${order.customers?.address}</p>
            ${order.notes ? `<p><strong>ملاحظات:</strong> ${order.notes}</p>` : ''}
          </div>
          <hr style="border: 1px solid #ddd; margin: 20px 0;"/>
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
              ${orderItems}
            </tbody>
          </table>
          <hr style="border: 1px solid #ddd; margin: 20px 0;"/>
          <div style="margin-top: 20px; line-height: 2;">
            <p><strong>سعر المنتجات:</strong> ${totalAmount.toFixed(2)} ج.م</p>
            <p><strong>شحن العميل:</strong> ${customerShipping.toFixed(2)} ج.م</p>
            ${discount > 0 ? `<p><strong>خصم:</strong> ${discount.toFixed(2)} ج.م</p>` : ''}
            <p style="font-size: 18px;"><strong>الإجمالي:</strong> ${totalPrice.toFixed(2)} ج.م</p>
            <p><strong>شحن المندوب:</strong> ${agentShipping.toFixed(2)} ج.م</p>
            <p style="font-size: 20px; font-weight: bold; color: green;">المطلوب من المندوب: ${netAmount.toFixed(2)} ج.م</p>
          </div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>أوردرات المندوب</title>
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

  const handleBulkStatusUpdate = async () => {
    if (selectedOrders.length === 0 || !bulkStatus) {
      toast.error("الرجاء تحديد أوردرات وحالة");
      return;
    }

    try {
      for (const orderId of selectedOrders) {
        await updateStatusMutation.mutateAsync({
          id: orderId,
          status: bulkStatus,
        });
      }
      setSelectedOrders([]);
      setBulkStatusDialogOpen(false);
      setBulkStatus("");
      toast.success("تم تحديث حالة الأوردرات بنجاح");
    } catch (error) {
      console.error("Error updating bulk status:", error);
      toast.error("حدث خطأ أثناء تحديث الحالات");
    }
  };

  const handleReturnQuantityChange = (index: number, value: number) => {
    const newItems = [...returnData.returned_items];
    newItems[index].returned_quantity = Math.min(value, newItems[index].total_quantity);
    setReturnData({ ...returnData, returned_items: newItems });
  };

  const handleSubmitReturn = async () => {
    const returnedItems = returnData.returned_items.filter(item => item.returned_quantity > 0);
    
    if (returnedItems.length === 0) {
      toast.error("يرجى تحديد كمية المرتجع");
      return;
    }

    const returnAmount = returnedItems.reduce((sum, item) => 
      sum + (item.price * item.returned_quantity), 0
    );

    const allReturned = returnData.returned_items.every(item => 
      item.returned_quantity === item.total_quantity
    );

    // تحديد الحالة
    let newStatus = allReturned ? "returned" : "partially_returned";
    if (returnData.removeShipping) {
      newStatus = "return_no_shipping";
    }

    // Update order status
    await updateStatusMutation.mutateAsync({
      id: selectedOrderForReturn.id,
      status: newStatus,
      removeShipping: returnData.removeShipping
    });

    // Create return record
    await createReturnMutation.mutateAsync({
      order_id: selectedOrderForReturn.id,
      customer_id: selectedOrderForReturn.customer_id,
      delivery_agent_id: selectedOrderForReturn.delivery_agent_id,
      return_amount: returnAmount,
      returned_items: returnedItems.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.returned_quantity,
        price: item.price
      })),
      notes: returnData.notes
    });
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

    const customerShipping = parseFloat(order.shipping_cost?.toString() || "0");
    const agentShipping = parseFloat(order.agent_shipping_cost?.toString() || "0");
    const totalAmount = parseFloat(order.total_amount.toString());
    const discount = parseFloat(order.discount?.toString() || "0");
    const totalPrice = totalAmount + customerShipping;
    const netAmount = totalPrice - agentShipping;

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>فاتورة - ${order.order_number || order.id.slice(0, 8)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .logo { text-align: center; margin-bottom: 20px; }
            .logo img { max-width: 150px; height: auto; }
            h1 { text-align: center; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
            th { background-color: #f2f2f2; }
            .info { margin: 20px 0; line-height: 1.8; }
            .total { font-size: 16px; margin-top: 20px; line-height: 2; }
            .final-total { font-size: 20px; font-weight: bold; color: green; }
            hr { border: 1px solid #ddd; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="logo">
            <img src="/images/magou-logo.jpg" alt="Magou Fashion Logo" />
          </div>
          <h1>فاتورة</h1>
          <hr/>
          <div class="info">
            <p><strong>رقم الأوردر:</strong> #${order.order_number || order.id.slice(0, 8)}</p>
            <p><strong>التاريخ:</strong> ${new Date(order.created_at).toLocaleDateString('ar-EG')}</p>
            <p><strong>اسم العميل:</strong> ${order.customers?.name}</p>
            <p><strong>الهاتف:</strong> ${order.customers?.phone}</p>
            <p><strong>الهاتف 2:</strong> ${(order.customers as any)?.phone2 || '-'}</p>
            <p><strong>المحافظة:</strong> ${order.customers?.governorate || '-'}</p>
            <p><strong>العنوان بالتفصيل:</strong> ${order.customers?.address}</p>
            ${order.notes ? `<p><strong>ملاحظات:</strong> ${order.notes}</p>` : ''}
          </div>
          <hr/>
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
          <hr/>
          <div class="total">
            <p><strong>سعر المنتجات:</strong> ${totalAmount.toFixed(2)} ج.م</p>
            <p><strong>شحن العميل:</strong> ${customerShipping.toFixed(2)} ج.م</p>
            ${discount > 0 ? `<p><strong>خصم:</strong> ${discount.toFixed(2)} ج.م</p>` : ''}
            <p style="font-size: 18px;"><strong>الإجمالي:</strong> ${totalPrice.toFixed(2)} ج.م</p>
            <p><strong>شحن المندوب:</strong> ${agentShipping.toFixed(2)} ج.م</p>
            <p class="final-total">المطلوب من المندوب: ${netAmount.toFixed(2)} ج.م</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <Button onClick={() => navigate("/admin")} variant="ghost" className="mb-4">
          <ArrowLeft className="ml-2 h-4 w-4" />
          الرجوع إلى الصفحة الرئيسية
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>أوردرات المندوب</CardTitle>
            <div className="mt-4 space-y-4">
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="اختر مندوب" />
                </SelectTrigger>
                <SelectContent>
                  {agents?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name} - {agent.serial_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedAgentId && (
                <>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">بحث:</span>
                      <Input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="رقم الطلب، اسم العميل، أو رقم الهاتف"
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
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
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
                  </div>
                   {selectedOrders.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {selectedOrders.length} محدد
                      </span>
                      <Button onClick={handleExportExcel} size="sm" variant="outline">
                        <Download className="ml-2 h-4 w-4" />
                        تصدير Excel
                      </Button>
                      <Button onClick={handlePrintOrders} size="sm" variant="outline">
                        <Printer className="ml-2 h-4 w-4" />
                        طباعة
                      </Button>
                      <Button 
                        onClick={() => setBulkStatusDialogOpen(true)} 
                        size="sm" 
                        variant="default"
                      >
                        تغيير الحالة للمحدد
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedAgentId ? (
              <p className="text-center text-muted-foreground py-8">اختر مندوب لعرض أوردراته</p>
            ) : isLoading ? (
              <p className="text-center py-8">جاري التحميل...</p>
            ) : !filteredOrders || filteredOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد أوردرات لهذا المندوب</p>
            ) : (
              <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Checkbox
                            checked={selectedOrders.length === filteredOrders?.length}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>رقم الأوردر</TableHead>
                        <TableHead>العميل</TableHead>
                        <TableHead>الهاتف</TableHead>
                        <TableHead>العنوان</TableHead>
                        <TableHead>الإجمالي</TableHead>
                        <TableHead>شحن المندوب</TableHead>
                        <TableHead>الصافي</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => {
                        const customerShipping = parseFloat(order.shipping_cost?.toString() || "0");
                        const agentShipping = parseFloat(order.agent_shipping_cost?.toString() || "0");
                        const totalAmount = parseFloat(order.total_amount.toString());
                        const totalPrice = totalAmount + customerShipping; // الإجمالي (ثابت)
                        const netAmount = totalPrice - agentShipping; // الصافي (المستحقات)
                        
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
                            <TableCell className="font-medium">
                              {order.customers?.name}
                            </TableCell>
                            <TableCell>{order.customers?.phone}</TableCell>
                            <TableCell className="max-w-xs whitespace-normal break-words">
                              {order.customers?.address}
                            </TableCell>
                            <TableCell className="font-bold text-blue-600">
                              {totalPrice.toFixed(2)} ج.م
                            </TableCell>
                            <TableCell>
                              {editingShipping === order.id ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={newShipping}
                                    onChange={(e) => setNewShipping(e.target.value)}
                                    className="w-20"
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      updateShippingMutation.mutate({
                                        orderId: order.id,
                                        newShipping: parseFloat(newShipping),
                                        oldShipping: agentShipping,
                                        agentId: order.delivery_agent_id!
                                      });
                                      setEditingShipping(null);
                                    }}
                                  >
                                    حفظ
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditingShipping(null)}
                                  >
                                    ✕
                                  </Button>
                                </div>
                              ) : (
                                <div
                                  className="text-orange-600 font-semibold cursor-pointer hover:bg-accent p-2 rounded"
                                  onClick={() => {
                                    setEditingShipping(order.id);
                                    setNewShipping(agentShipping.toString());
                                  }}
                                >
                                  {agentShipping.toFixed(2)} ج.م
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-bold text-green-600">
                              {netAmount.toFixed(2)} ج.م
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
                                  defaultValue={order.status}
                                  onValueChange={(value) => {
                                    updateStatusMutation.mutate({ id: order.id, status: value });
                                  }}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(statusLabels).map(([value, label]) => (
                                      <SelectItem key={value} value={value}>
                                        <div className="flex items-center gap-2">
                                          <div className={`w-2 h-2 rounded-full ${statusColors[value]}`} />
                                          {label}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 flex-wrap">
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
                                <Button
                                  variant="outline"
                                  size="sm"
                                >
                                  <PackageX className="ml-2 h-4 w-4" />
                                  مرتجع
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>تسجيل مرتجع</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    هل أنت متأكد من تسجيل هذا الأوردر كمرتجع؟
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => {
                                    handleOpenReturnDialog(order);
                                  }}>
                                    تأكيد
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                >
                                  <Trash2 className="h-4 w-4" />
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
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                >
                                  إزالة مندوب
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>تأكيد إزالة المندوب</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    هل أنت متأكد من إزالة المندوب من هذا الأوردر؟ سيتم إرجاع الأوردر إلى قائمة الأوردرات غير المعينة.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => unassignAgentMutation.mutate(order.id)}>
                                    إزالة
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePrintOrder(order)}
                              title="طباعة الفاتورة"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPendingReturnOrder(order);
                                setConfirmReturnDialogOpen(true);
                              }}
                            >
                              <PackageX className="ml-2 h-4 w-4" />
                              مرتجع
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                if (window.confirm("هل أنت متأكد من حذف الأوردر؟")) {
                                  deleteOrderMutation.mutate(order.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (window.confirm("هل أنت متأكد من إلغاء تعيين المندوب؟ سيتم إرجاع الأوردر إلى قائمة الأوردرات")) {
                                  unassignAgentMutation.mutate(order.id);
                                }
                              }}
                            >
                              إلغاء التعيين
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                
                {/* Summary */}
                <div className="mt-6 p-4 bg-accent rounded-lg space-y-2">
                  <h3 className="font-bold mb-2">ملخص مستحقات المندوب</h3>
                  <p>عدد الأوردرات: {filteredOrders.length}</p>
                  <p className="font-bold text-lg text-purple-600">
                    إجمالي الأوردرات: {filteredOrders.reduce((sum, order) => {
                      const total = parseFloat(order.total_amount.toString());
                      const customerShipping = parseFloat(order.shipping_cost?.toString() || "0");
                      return sum + (total + customerShipping);
                    }, 0).toFixed(2)} ج.م
                  </p>
                  <p className="font-bold text-lg text-orange-600">
                    شحن المندوب (خصم): {filteredOrders.reduce((sum, order) => sum + parseFloat(order.agent_shipping_cost?.toString() || "0"), 0).toFixed(2)} ج.م
                  </p>
                  <p className="font-bold text-xl text-green-600">
                    الصافي المطلوب من المندوب (من الأوردرات المعروضة): {filteredOrders.reduce((sum, order) => {
                      const total = parseFloat(order.total_amount.toString());
                      const customerShipping = parseFloat(order.shipping_cost?.toString() || "0");
                      const agentShipping = parseFloat(order.agent_shipping_cost?.toString() || "0");
                      return sum + (total + customerShipping - agentShipping);
                    }, 0).toFixed(2)} ج.م
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confirm Return Dialog */}
        <AlertDialog open={confirmReturnDialogOpen} onOpenChange={setConfirmReturnDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                تأكيد المرتجع
              </AlertDialogTitle>
              <AlertDialogDescription>
                هل تريد إرسال هذا الأوردر إلى السلة لتعديله؟ سيتم نقله إلى صفحة السلة حيث يمكنك تقليل أو زيادة الكميات ثم تأكيد الأوردر بنفس الرقم والتاريخ.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                if (pendingReturnOrder) {
                  // Navigate to cart with order data
                  navigate('/cart', { 
                    state: { 
                      returnOrder: pendingReturnOrder,
                      isReturn: true 
                    } 
                  });
                }
                setConfirmReturnDialogOpen(false);
                setPendingReturnOrder(null);
              }}>
                تأكيد ونقل للسلة
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Status Update Dialog */}
        <Dialog open={bulkStatusDialogOpen} onOpenChange={setBulkStatusDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تحديث حالة الأوردرات المحددة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                تم تحديد {selectedOrders.length} أوردر. اختر الحالة الجديدة:
              </p>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الحالة" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkStatusDialogOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleBulkStatusUpdate} disabled={!bulkStatus}>
                تحديث
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Return Dialog */}
        <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>تسجيل مرتجع</DialogTitle>
            </DialogHeader>
            {selectedOrderForReturn && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold mb-2">الأوردر: {selectedOrderForReturn.id.slice(0, 8)}...</h3>
                  <p>العميل: {selectedOrderForReturn.customers?.name}</p>
                </div>

                <div>
                  <h3 className="font-bold mb-2">المنتجات المرتجعة</h3>
                  {returnData.returned_items.map((item, index) => (
                    <div key={index} className="flex items-center gap-4 mb-3 p-3 bg-accent rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          الكمية الكلية: {item.total_quantity} | السعر: {item.price.toFixed(2)} ج.م
                        </p>
                      </div>
                      <div className="w-32">
                        <Label htmlFor={`return-qty-${index}`} className="text-xs">
                          الكمية المرتجعة
                        </Label>
                        <Input
                          id={`return-qty-${index}`}
                          type="number"
                          min="0"
                          max={item.total_quantity}
                          value={item.returned_quantity}
                          onChange={(e) => handleReturnQuantityChange(index, parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <Label htmlFor="return-notes">ملاحظات</Label>
                  <Textarea
                    id="return-notes"
                    value={returnData.notes}
                    onChange={(e) => setReturnData({ ...returnData, notes: e.target.value })}
                    placeholder="سبب المرتجع..."
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox
                    id="remove-shipping"
                    checked={returnData.removeShipping}
                    onCheckedChange={(checked) => 
                      setReturnData({ ...returnData, removeShipping: checked as boolean })
                    }
                  />
                  <Label htmlFor="remove-shipping" className="cursor-pointer">
                    مرتجع دون شحن (خصم الشحن من المستحقات)
                  </Label>
                </div>

                <div className="p-4 bg-accent rounded-lg">
                  <p className="font-bold text-lg text-destructive">
                    قيمة المرتجع: {returnData.returned_items
                      .reduce((sum, item) => sum + (item.price * item.returned_quantity), 0)
                      .toFixed(2)} ج.م
                  </p>
                  {returnData.removeShipping && selectedOrderForReturn && (
                    <p className="font-bold text-sm text-orange-600 mt-2">
                      سيتم خصم الشحن: {parseFloat(selectedOrderForReturn.shipping_cost?.toString() || "0").toFixed(2)} ج.م
                    </p>
                  )}
                </div>

                <Button onClick={handleSubmitReturn} className="w-full">
                  تأكيد المرتجع
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AgentOrders;