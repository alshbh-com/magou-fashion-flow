import { useState, useRef, useEffect } from "react";
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
import { ArrowLeft, PackageX, Printer, Download, AlertTriangle, Trash2, MessageCircle, ArrowDown, Plus, Edit2, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import * as XLSX from 'xlsx';

const statusLabels: Record<string, string> = {
  shipped: "تم الشحن",
  delivered: "تم التوصيل",
  returned: "مرتجع",
  return_no_shipping: "مرتجع دون شحن"
};

const statusColors: Record<string, string> = {
  shipped: "bg-purple-500",
  delivered: "bg-green-500",
  returned: "bg-orange-600",
  return_no_shipping: "bg-red-500"
};

const AgentOrders = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const summaryRef = useRef<HTMLDivElement>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [singleDateFilter, setSingleDateFilter] = useState<string>("");
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
  
  // Summary states - default to today's date (Cairo time)
  const getDateKey = (value: string | Date) => {
    const d = typeof value === "string" ? new Date(value) : value;
    // en-CA => YYYY-MM-DD
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  };

  const today = getDateKey(new Date());
  const [summaryDateFilter, setSummaryDateFilter] = useState<string>(today);

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");

  const scrollToSummary = () => {
    summaryRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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

  const { data: orders, isLoading, refetch: refetchOrders } = useQuery({
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
        .order("created_at", { ascending: false }); // ✅ التغيير: created_at بدل updated_at
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAgentId
  });

  // Real-time updates for orders and agent_payments
  useEffect(() => {
    if (!selectedAgentId) return;

    const ordersChannel = supabase
      .channel('agent-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ["agent-orders", selectedAgentId] });
          queryClient.invalidateQueries({ queryKey: ["all-agent-orders", selectedAgentId] });
          queryClient.invalidateQueries({ queryKey: ["agent_payments_full", selectedAgentId] });
          queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_payments' },
        () => {
          queryClient.invalidateQueries({ queryKey: ["agent_payments_full", selectedAgentId] });
          queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_agents' },
        () => {
          queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, [selectedAgentId, queryClient]);

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

  // Query for all orders for this agent (for summary)
  const { data: allAgentOrders } = useQuery({
    queryKey: ["all-agent-orders", selectedAgentId],
    queryFn: async () => {
      if (!selectedAgentId) return [];
      
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          customers (name, phone, address, governorate)
        `)
        .eq("delivery_agent_id", selectedAgentId)
        .order("created_at", { ascending: false }); // ✅ التغيير: created_at بدل updated_at
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAgentId
  });

  // Query for agent payments data (for summary calculations)
  const { data: agentPaymentsData } = useQuery({
    queryKey: ["agent_payments_full", selectedAgentId],
    queryFn: async () => {
      if (!selectedAgentId) return [];
      
      const { data, error } = await supabase
        .from("agent_payments")
        .select("*")
        .eq("delivery_agent_id", selectedAgentId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAgentId
  });

  // Query for governorates
  const { data: governorates } = useQuery({
    queryKey: ["governorates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("governorates")
        .select("*");
      
      if (error) throw error;
      return data;
    },
  });

  // ✅ دالة جديدة للحصول على تاريخ الأوردر الثابت
  const getOrderDate = (order: any) => {
    // استخدم assigned_at إن وجد، وإلا created_at (تاريخ إنشاء الأوردر الأصلي)
    return order.assigned_at || order.created_at;
  };

  // Calculate summary data
  const calculateSummary = (dateFilter?: string) => {
    if (!agentPaymentsData || !allAgentOrders) return null;

    let paymentsToUse = agentPaymentsData;
    let ordersToUse = allAgentOrders;

    if (dateFilter) {
      // ✅ اليوميات تعتمد على تاريخ تعيين الأوردر (assigned_at) وليس تاريخ آخر تعديل
      const orderDateById = new Map<string, string>();
      allAgentOrders.forEach((o) => {
        if (!o?.id) return;
        orderDateById.set(o.id, getDateKey(getOrderDate(o)));
      });

      ordersToUse = allAgentOrders.filter((o) => orderDateById.get(o.id) === dateFilter);

      // العمليات المرتبطة بأوردر (owed/delivered/return/modification) تُحسب على يوم تعيين الأوردر
      // الدفعات غير المرتبطة بأوردر (payment بدون order_id) تظل على تاريخها
      paymentsToUse = agentPaymentsData.filter((p) => {
        if (p.order_id) return orderDateById.get(p.order_id) === dateFilter;
        const paymentDate = getDateKey(p.created_at || "");
        return paymentDate === dateFilter;
      });
    }

    const owedPayments = paymentsToUse.filter((p) => p.payment_type === "owed");
    const manualPayments = paymentsToUse.filter((p) => p.payment_type === "payment");
    const deliveredPayments = paymentsToUse.filter((p) => p.payment_type === "delivered");
    const returnPayments = paymentsToUse.filter((p) => p.payment_type === "return");
    const modificationPayments = paymentsToUse.filter((p) => p.payment_type === "modification");

    const sumAmount = (arr: any[]) =>
      arr.reduce((sum, p) => sum + parseFloat((p.amount ?? 0).toString()), 0);

    const totalOwed = sumAmount(owedPayments);
    const totalPaid = sumAmount(manualPayments);
    const totalDelivered = sumAmount(deliveredPayments);

    // إشارات موجبة/سالبة كما هي في جدول agent_payments
    const totalReturnsSigned = sumAmount(returnPayments); // غالباً سالبة
    const totalModificationsSigned = sumAmount(modificationPayments);

    // للعرض فقط
    const totalReturns = Math.abs(totalReturnsSigned);
    const totalModifications = Math.abs(totalModificationsSigned);

    // صافي المطلوب (حركة اليوم) = المطلوب + التعديلات + المرتجعات(سالبة)
    const netRequired = totalOwed + totalModificationsSigned + totalReturnsSigned;

    // الصافي على المندوب = صافي المطلوب - المسلم - الدفعات المقدمة
    const agentReceivables = netRequired - totalDelivered - totalPaid;

    // حساب إحصائيات الأوردرات
    const shippedOrders = ordersToUse.filter((o) => o.status === "shipped");
    const deliveredOrders = ordersToUse.filter((o) => o.status === "delivered");
    const returnedOrders = ordersToUse.filter((o) =>
      ["returned", "return_no_shipping", "partially_returned"].includes(o.status || "")
    );

    const shippedTotal = shippedOrders.reduce((sum, o) => {
      const total = parseFloat(o.total_amount?.toString() || "0");
      const shipping = parseFloat(o.shipping_cost?.toString() || "0");
      const agentShipping = parseFloat(o.agent_shipping_cost?.toString() || "0");
      return sum + total + shipping - agentShipping;
    }, 0);

    const deliveredTotal = deliveredOrders.reduce((sum, o) => {
      const total = parseFloat(o.total_amount?.toString() || "0");
      const shipping = parseFloat(o.shipping_cost?.toString() || "0");
      const agentShipping = parseFloat(o.agent_shipping_cost?.toString() || "0");
      return sum + total + shipping - agentShipping;
    }, 0);

    const returnedTotal = returnedOrders.reduce((sum, o) => {
      const total = parseFloat(o.total_amount?.toString() || "0");
      const shipping = parseFloat(o.shipping_cost?.toString() || "0");
      const agentShipping = parseFloat(o.agent_shipping_cost?.toString() || "0");
      return sum + total + shipping - agentShipping;
    }, 0);

    return {
      totalOwed,
      totalPaid,
      totalDelivered,
      totalReturns,
      totalModifications,
      totalReturnsSigned,
      totalModificationsSigned,
      netRequired,
      agentReceivables,
      shippedCount: shippedOrders.length,
      deliveredCount: deliveredOrders.length,
      returnedCount: returnedOrders.length,
      shippedTotal,
      deliveredTotal,
      returnedTotal,
    };
  };

  const summaryData = calculateSummary(summaryDateFilter);

  // Get unique dates from orders for daily filter
  const getLocalDateForOrder = (dateStr: string) => getDateKey(dateStr);

  // Get agent creation date for date range
  const selectedAgent = agents?.find(a => a.id === selectedAgentId);
  const agentCreatedAt = selectedAgent?.created_at ? getLocalDateForOrder(selectedAgent.created_at) : today;
  
  // Generate all dates from agent creation to today
  const generateDateRange = (startDate: string, endDate: string) => {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    while (start <= end) {
      const year = start.getFullYear();
      const month = String(start.getMonth() + 1).padStart(2, '0');
      const day = String(start.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
      start.setDate(start.getDate() + 1);
    }
    return dates;
  };
  
  const uniqueDates = generateDateRange(agentCreatedAt, today).reverse();

  // Add payment mutation
  const addPaymentMutation = useMutation({
    mutationFn: async (amount: number) => {
      if (!selectedAgentId) throw new Error("لم يتم اختيار مندوب");

      const { error } = await supabase
        .from("agent_payments")
        .insert({
          delivery_agent_id: selectedAgentId,
          amount: amount,
          payment_type: 'payment',
          notes: `دفعة مقدمة - ${amount.toFixed(2)} ج.م`
        });

      if (error) throw error;

      // Update agent total_paid
      const { data: agent, error: agentError } = await supabase
        .from("delivery_agents")
        .select("total_paid")
        .eq("id", selectedAgentId)
        .single();

      if (agentError) throw agentError;

      const newTotalPaid = parseFloat(agent.total_paid?.toString() || "0") + amount;
      
      await supabase
        .from("delivery_agents")
        .update({ total_paid: newTotalPaid })
        .eq("id", selectedAgentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_payments_full"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      toast.success("تم إضافة الدفعة بنجاح");
      setPaymentDialogOpen(false);
      setPaymentAmount("");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء إضافة الدفعة");
    }
  });

  // Edit summary field mutation
  const editSummaryMutation = useMutation({
    mutationFn: async ({ field, newValue, currentValue }: { field: string; newValue: number; currentValue: number }) => {
      if (!selectedAgentId) throw new Error("لم يتم اختيار مندوب");

      const difference = newValue - currentValue;
      if (difference === 0) return;

      let paymentType: string;
      let amount: number;

      if (field === 'payment') {
        paymentType = 'payment';
        amount = difference;
      } else if (field === 'delivered') {
        paymentType = 'delivered';
        amount = difference;
      } else {
        throw new Error('نوع غير معروف');
      }

      const { error } = await supabase
        .from("agent_payments")
        .insert({
          delivery_agent_id: selectedAgentId,
          amount: amount,
          payment_type: paymentType,
          notes: `تعديل يدوي - ${difference > 0 ? 'إضافة' : 'خصم'} ${Math.abs(difference).toFixed(2)} ج.م`
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_payments_full"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      toast.success("تم التعديل بنجاح");
      setEditingField(null);
      setEditingValue("");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء التعديل");
    }
  });

  // ✅ دالة جديدة لتحديث الأوردر دون تغيير التاريخ
  const updateOrderWithoutDateChange = async (orderId: string, updates: any) => {
    // احتفظ بتاريخ created_at الأصلي
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("created_at, updated_at")
      .eq("id", orderId)
      .single();
    
    if (existingOrder) {
      return await supabase
        .from("orders")
        .update({
          ...updates,
          // لا تغير created_at
          created_at: existingOrder.created_at,
          // updated_at يتغير تلقائياً لكن هذا مقبول
        })
        .eq("id", orderId);
    }
    
    return await supabase
      .from("orders")
      .update(updates)
      .eq("id", orderId);
  };

  const handleAddPayment = () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
      return;
    }
    addPaymentMutation.mutate(amount);
  };

  const handleEditSummary = () => {
    if (!editingField) return;
    const newValue = parseFloat(editingValue);
    if (isNaN(newValue)) {
      toast.error("قيمة غير صحيحة");
      return;
    }

    let currentValue = 0;
    if (editingField === 'payment') {
      currentValue = summaryData?.totalPaid || 0;
    } else if (editingField === 'delivered') {
      currentValue = summaryData?.totalDelivered || 0;
    }

    editSummaryMutation.mutate({ field: editingField, newValue, currentValue });
  };

  const filteredOrders = orders?.filter(order => {
    if (statusFilter !== "all" && order.status !== statusFilter) return false;
    
    // Single date filter (priority)
    if (singleDateFilter) {
      const orderDate = getDateKey(getOrderDate(order));
      if (orderDate !== singleDateFilter) return false;
    } else if (startDate || endDate) {
      const orderDate = getDateKey(getOrderDate(order));
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
      
      const totalAmount = parseFloat(order.total_amount?.toString() || "0");
      const customerShipping = parseFloat(order.shipping_cost?.toString() || "0");
      const agentShipping = parseFloat(order.agent_shipping_cost?.toString() || "0");
      const orderTotal = totalAmount + customerShipping;
      
      // إذا كانت الحالة "مرتجع" أو "مرتجع دون شحن":
      // لا نُحدّث total_owed ولا نُضيف agent_payments من الواجهة هنا، لأن ذلك يتم تلقائياً
      // عبر Triggers قاعدة البيانات (لتجنب تكرار الحسابات ×2).
      if (status === "return_no_shipping") {
        // إلغاء تعيين المندوب (سيذهب الأوردر لجميع الأوردرات)
        updates.delivery_agent_id = null;
      }

      // ✅ استخدام الدالة الجديدة التي تحافظ على التواريخ
      const { error } = await updateOrderWithoutDateChange(id, updates);
      
      if (error) throw error;

    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-orders"] });
      queryClient.invalidateQueries({ queryKey: ["agent_payments"] });
      queryClient.invalidateQueries({ queryKey: ["agent_payments_summary"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      queryClient.invalidateQueries({ queryKey: ["all-orders"] });
      toast.success("تم تحديث الحالة");
    },
  });

  const updateShippingMutation = useMutation({
    mutationFn: async ({ orderId, newShipping, oldShipping, agentId }: { orderId: string; newShipping: number; oldShipping: number; agentId: string }) => {
      // Update order agent shipping cost (the cost the agent pays, which reduces what they owe)
      const { error: orderError } = await updateOrderWithoutDateChange(orderId, { agent_shipping_cost: newShipping });
      
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
      // ✅ استخدام الدالة الجديدة التي تحافظ على التواريخ
      const { error } = await updateOrderWithoutDateChange(orderId, { 
        delivery_agent_id: null,
        status: 'pending'
      });
      
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
        "تاريخ الأوردر": new Date(getOrderDate(order)).toLocaleDateString("ar-EG"), // ✅ استخدام التاريخ الثابت
        "تاريخ آخر تعديل": order.updated_at ? new Date(order.updated_at).toLocaleDateString("ar-EG") : "-"
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
      { wch: 15 }, // تاريخ الأوردر ✅
      { wch: 15 }  // تاريخ آخر تعديل ✅
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
            <p><strong>تاريخ الأوردر:</strong> ${new Date(getOrderDate(order)).toLocaleDateString('ar-EG')}</p> <!-- ✅ استخدام التاريخ الثابت -->
            <p><strong>تاريخ آخر تعديل:</strong> ${order.updated_at ? new Date(order.updated_at).toLocaleDateString('ar-EG') : '-'}</p>
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
            <p><strong>تاريخ الأوردر:</strong> ${new Date(getOrderDate(order)).toLocaleDateString('ar-EG')}</p> <!-- ✅ استخدام التاريخ الثابت -->
            <p><strong>تاريخ آخر تعديل:</strong> ${order.updated_at ? new Date(order.updated_at).toLocaleDateString('ar-EG') : '-'}</p>
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

  // Print summary function
  const handlePrintSummary = () => {
    if (!summaryData || !selectedAgentId) {
      toast.error("لا توجد بيانات للطباعة");
      return;
    }

    const agent = agents?.find(a => a.id === selectedAgentId);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>ملخص مستحقات المندوب</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .logo { text-align: center; margin-bottom: 20px; }
            .logo img { max-width: 150px; height: auto; }
            h1 { text-align: center; margin: 10px 0; }
            .info { margin: 20px 0; line-height: 2; }
            .summary-item { 
              display: flex; 
              justify-content: space-between; 
              padding: 10px; 
              border-bottom: 1px solid #ddd; 
            }
            .summary-item.total { 
              font-weight: bold; 
              font-size: 18px; 
              background-color: #f5f5f5; 
            }
            .label { color: #666; }
            .value { font-weight: bold; }
            .positive { color: green; }
            .negative { color: red; }
            hr { border: 1px solid #ddd; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="logo">
            <img src="/images/magou-logo.jpg" alt="Magou Fashion Logo" />
          </div>
          <h1>ملخص مستحقات المندوب</h1>
          <hr/>
          <div class="info">
            <p><strong>المندوب:</strong> ${agent?.name || 'غير محدد'} (${agent?.serial_number || '-'})</p>
            <p><strong>تاريخ الأوردرات:</strong> ${new Date(summaryDateFilter).toLocaleDateString('ar-EG')}</p>
            <p><strong>ملاحظة:</strong> الحسابات تعتمد على تاريخ تعيين الأوردر (assigned_at) وليس تاريخ آخر تعديل</p>
            <p><strong>تاريخ الطباعة:</strong> ${new Date().toLocaleString('ar-EG')}</p>
          </div>
          <hr/>
          <div class="summary">
            <div class="summary-item total ${summaryData.agentReceivables >= 0 ? 'negative' : 'positive'}">
              <span class="label">مستحقات على المندوب</span>
              <span class="value">${summaryData.agentReceivables.toFixed(2)} ج.م</span>
            </div>
            <div class="summary-item">
              <span class="label">الأوردرات المسلمة</span>
              <span class="value">${summaryData.totalDelivered.toFixed(2)} ج.م (${summaryData.deliveredCount} أوردر)</span>
            </div>
            <div class="summary-item">
              <span class="label">الدفعة المقدمة</span>
              <span class="value">${summaryData.totalPaid.toFixed(2)} ج.م</span>
            </div>
            <div class="summary-item">
              <span class="label">المرتجعات</span>
              <span class="value">${summaryData.returnedCount} أوردر (بقيمة ${summaryData.returnedTotal.toFixed(2)} ج.م)</span>
            </div>
            <div class="summary-item">
              <span class="label">أوردرات في الطريق</span>
              <span class="value">${summaryData.shippedCount} أوردر (بقيمة ${summaryData.shippedTotal.toFixed(2)} ج.م)</span>
            </div>
          </div>
          <hr/>
          <p style="text-align: center; font-size: 12px; color: #999;">
            تم إنشاء هذا التقرير تلقائياً - نظام الإحصائيات يعتمد على تاريخ تعيين الأوردر (assigned_at)
          </p>
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
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle>أوردرات المندوب</CardTitle>
              {selectedAgentId && (
                <Button onClick={scrollToSummary} variant="outline" size="sm">
                  <ArrowDown className="ml-2 h-4 w-4" />
                  الذهاب للملخص
                </Button>
              )}
            </div>

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
                      <span className="text-sm font-medium">تاريخ التعيين:</span>
                      <Input
                        type="date"
                        value={singleDateFilter}
                        onChange={(e) => {
                          setSingleDateFilter(e.target.value);
                          if (e.target.value) {
                            setStartDate("");
                            setEndDate("");
                          }
                        }}
                        className="w-40"
                      />
                      {singleDateFilter && (
                        <Button size="sm" variant="ghost" onClick={() => setSingleDateFilter("")}>
                          إلغاء
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">من تاريخ التعيين:</span>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          setSingleDateFilter("");
                        }}
                        className="w-40"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">إلى تاريخ التعيين:</span>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          setSingleDateFilter("");
                        }}
                        className="w-40"
                      />
                    </div>

                    {(startDate || endDate) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setStartDate("");
                          setEndDate("");
                        }}
                      >
                        إلغاء
                      </Button>
                    )}
                  </div>

                  {selectedOrders.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-muted-foreground">{selectedOrders.length} محدد</span>
                      <Button onClick={handleExportExcel} size="sm" variant="outline">
                        <Download className="ml-2 h-4 w-4" />
                        تصدير Excel
                      </Button>
                      <Button onClick={handlePrintOrders} size="sm" variant="outline">
                        <Printer className="ml-2 h-4 w-4" />
                        طباعة
                      </Button>
                      <Button onClick={() => setBulkStatusDialogOpen(true)} size="sm">
                        <ChevronDown className="ml-2 h-4 w-4" />
                        تغيير حالة (مجمع)
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {!selectedAgentId ? (
              <p className="text-center text-muted-foreground py-10">اختر مندوب لعرض الأوردرات والملخص.</p>
            ) : isLoading ? (
              <p className="text-center text-muted-foreground py-10">جاري التحميل...</p>
            ) : !filteredOrders || filteredOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">لا توجد أوردرات لهذا المندوب.</p>
            ) : (
              <div className="space-y-6">
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
                        <TableHead>رقم</TableHead>
                        <TableHead>العميل</TableHead>
                        <TableHead>الهاتف</TableHead>
                        <TableHead>المحافظة</TableHead>
                        <TableHead>الصافي</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>تاريخ التعيين</TableHead>
                        <TableHead>آخر تعديل</TableHead>
                        <TableHead>إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => {
                        const customerShipping = parseFloat(order.shipping_cost?.toString() || "0");
                        const agentShipping = parseFloat(order.agent_shipping_cost?.toString() || "0");
                        const totalAmount = parseFloat(order.total_amount?.toString() || "0");
                        const netAmount = totalAmount + customerShipping - agentShipping;

                        return (
                          <TableRow key={order.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedOrders.includes(order.id)}
                                onCheckedChange={() => toggleOrderSelection(order.id)}
                              />
                            </TableCell>

                            <TableCell className="font-mono text-xs">#{order.order_number || order.id.slice(0, 8)}</TableCell>
                            <TableCell className="font-medium">{order.customers?.name || "-"}</TableCell>
                            <TableCell>{order.customers?.phone || "-"}</TableCell>
                            <TableCell>{order.customers?.governorate || "-"}</TableCell>
                            <TableCell className="font-bold">{netAmount.toFixed(2)} ج.م</TableCell>
                            <TableCell>
                              <Badge className={statusColors[order.status] || "bg-gray-500"}>
                                {statusLabels[order.status] || order.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{new Date(getOrderDate(order)).toLocaleDateString("ar-EG")}</TableCell>
                            <TableCell>
                              {order.updated_at ? new Date(order.updated_at).toLocaleDateString("ar-EG") : "-"}
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Button size="sm" variant="outline" onClick={() => handlePrintOrder(order)}>
                                  <Printer className="ml-2 h-4 w-4" />
                                  طباعة
                                </Button>

                                <Button size="sm" variant="outline" onClick={() => handleOpenReturnDialog(order)}>
                                  <PackageX className="ml-2 h-4 w-4" />
                                  مرتجع
                                </Button>

                                <Button size="sm" variant="outline" onClick={() => unassignAgentMutation.mutate(order.id)}>
                                  <ArrowDown className="ml-2 h-4 w-4" />
                                  إلغاء التعيين
                                </Button>

                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="destructive">
                                      <Trash2 className="ml-2 h-4 w-4" />
                                      حذف
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        هل أنت متأكد من حذف هذا الأوردر؟ سيتم حذف بياناته ودفعاته المرتبطة.
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

                                {/* تعديل شحن المندوب */}
                                {editingShipping === order.id ? (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      value={newShipping}
                                      onChange={(e) => setNewShipping(e.target.value)}
                                      className="w-24"
                                      min="0"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        const value = parseFloat(newShipping);
                                        if (isNaN(value) || value < 0) return toast.error("قيمة غير صحيحة");
                                        updateShippingMutation.mutate({
                                          orderId: order.id,
                                          newShipping: value,
                                          oldShipping: parseFloat(order.agent_shipping_cost?.toString() || "0"),
                                          agentId: order.delivery_agent_id,
                                        });
                                        setEditingShipping(null);
                                        setNewShipping("");
                                      }}
                                    >
                                      حفظ
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingShipping(null);
                                        setNewShipping("");
                                      }}
                                    >
                                      إلغاء
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingShipping(order.id);
                                      setNewShipping(order.agent_shipping_cost?.toString() || "0");
                                    }}
                                  >
                                    <Edit2 className="ml-2 h-4 w-4" />
                                    شحن المندوب
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* الملخص */}
                <div ref={summaryRef} />
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <CardTitle>ملخص اليوميات (حسب تاريخ التعيين)</CardTitle>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Select value={summaryDateFilter} onValueChange={setSummaryDateFilter}>
                          <SelectTrigger className="w-44">
                            <SelectValue placeholder="اختر يوم" />
                          </SelectTrigger>
                          <SelectContent>
                            {uniqueDates.map((d) => (
                              <SelectItem key={d} value={d}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={handlePrintSummary}>
                          <Printer className="ml-2 h-4 w-4" />
                          طباعة الملخص
                        </Button>
                        <Button variant="default" size="sm" onClick={() => setPaymentDialogOpen(true)}>
                          <Plus className="ml-2 h-4 w-4" />
                          إضافة دفعة
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {!summaryData ? (
                      <p className="text-muted-foreground">لا توجد بيانات للملخص.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="rounded-lg border p-4">
                          <div className="text-sm text-muted-foreground">صافي المطلوب (اليوم)</div>
                          <div className="text-2xl font-bold mt-1">{summaryData.netRequired.toFixed(2)} ج.م</div>
                        </div>

                        <div className="rounded-lg border p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm text-muted-foreground">الأوردرات المسلمة</div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setEditingField("delivered");
                                setEditingValue((summaryData.totalDelivered || 0).toString());
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="text-2xl font-bold mt-1">{summaryData.totalDelivered.toFixed(2)} ج.م</div>
                        </div>

                        <div className="rounded-lg border p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm text-muted-foreground">الدفعة المقدمة</div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setEditingField("payment");
                                setEditingValue((summaryData.totalPaid || 0).toString());
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="text-2xl font-bold mt-1">{summaryData.totalPaid.toFixed(2)} ج.م</div>
                        </div>

                        <div className="rounded-lg border p-4">
                          <div className="text-sm text-muted-foreground">الصافي المطلوب من المندوب</div>
                          <div className="text-2xl font-bold mt-1">{summaryData.agentReceivables.toFixed(2)} ج.م</div>
                        </div>

                        <div className="rounded-lg border p-4">
                          <div className="text-sm text-muted-foreground">المرتجعات</div>
                          <div className="text-lg font-semibold mt-1">{summaryData.returnedCount} أوردر</div>
                          <div className="text-sm text-muted-foreground mt-1">بقيمة {summaryData.returnedTotal.toFixed(2)} ج.م</div>
                        </div>

                        <div className="rounded-lg border p-4">
                          <div className="text-sm text-muted-foreground">في الطريق</div>
                          <div className="text-lg font-semibold mt-1">{summaryData.shippedCount} أوردر</div>
                          <div className="text-sm text-muted-foreground mt-1">بقيمة {summaryData.shippedTotal.toFixed(2)} ج.م</div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog: تغيير حالة مجمع */}
        <Dialog open={bulkStatusDialogOpen} onOpenChange={setBulkStatusDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تغيير حالة الأوردرات المحددة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>الحالة الجديدة</Label>
                <Select value={bulkStatus} onValueChange={setBulkStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر حالة" />
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
                <Button variant="ghost" onClick={() => setBulkStatusDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button onClick={handleBulkStatusUpdate}>تطبيق</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: إضافة دفعة */}
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة دفعة مقدمة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>المبلغ</Label>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="مثال: 500"
                  min="0"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setPaymentDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button onClick={handleAddPayment}>إضافة</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: تعديل قيم الملخص */}
        <Dialog
          open={!!editingField}
          onOpenChange={(open) => {
            if (!open) {
              setEditingField(null);
              setEditingValue("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تعديل قيمة الملخص</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>القيمة الجديدة</Label>
                <Input type="number" value={editingValue} onChange={(e) => setEditingValue(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingField(null);
                    setEditingValue("");
                  }}
                >
                  إلغاء
                </Button>
                <Button onClick={handleEditSummary}>حفظ</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: المرتجع */}
        <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>تسجيل مرتجع</DialogTitle>
            </DialogHeader>

            {!selectedOrderForReturn ? (
              <p className="text-muted-foreground">لا يوجد أوردر محدد.</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border p-3 text-sm">
                  <div className="font-medium">
                    أوردر #{selectedOrderForReturn.order_number || selectedOrderForReturn.id.slice(0, 8)}
                  </div>
                  <div className="text-muted-foreground mt-1">
                    {selectedOrderForReturn.customers?.name} - {selectedOrderForReturn.customers?.phone}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>القطع المرتجعة</Label>
                  <div className="space-y-2">
                    {returnData.returned_items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 flex-wrap rounded-lg border p-3">
                        <div className="flex-1 min-w-[200px]">
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-xs text-muted-foreground">
                            سعر: {item.price.toFixed(2)} | الكمية: {item.total_quantity}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">مرتجع</Label>
                          <Input
                            type="number"
                            value={item.returned_quantity}
                            min={0}
                            max={item.total_quantity}
                            className="w-24"
                            onChange={(e) => handleReturnQuantityChange(idx, parseInt(e.target.value || "0", 10))}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={returnData.removeShipping}
                    onCheckedChange={(checked) => setReturnData({ ...returnData, removeShipping: Boolean(checked) })}
                  />
                  <span className="text-sm">مرتجع دون شحن</span>
                </div>

                <div className="space-y-2">
                  <Label>ملاحظات</Label>
                  <Textarea
                    value={returnData.notes}
                    onChange={(e) => setReturnData({ ...returnData, notes: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setReturnDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button onClick={handleSubmitReturn}>تسجيل المرتجع</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AgentOrders;

