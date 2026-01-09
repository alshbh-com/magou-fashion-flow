import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, ArrowLeft, Pencil, Calendar, RefreshCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

const AgentPayments = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canEdit, logActivity } = useAdminAuth();
  
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [dateFilter, setDateFilter] = useState<string>("");
  
  // State for editing summary values
  const [editingSummary, setEditingSummary] = useState<{type: string; value: string} | null>(null);
  
  const [formData, setFormData] = useState({
    amount: "",
    notes: ""
  });

  const [editFormData, setEditFormData] = useState({
    amount: "",
    notes: ""
  });

  const canEditPayments = canEdit('agent_payments');

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

  const { data: agentData, isLoading } = useQuery({
    queryKey: ["agent_payments_summary", selectedAgentId, dateFilter],
    queryFn: async () => {
      if (!selectedAgentId) return null;
      
      let query = supabase
        .from("agent_payments")
        .select("*")
        .eq("delivery_agent_id", selectedAgentId)
        .order("created_at", { ascending: false });
      
      if (dateFilter) {
        const start = new Date(`${dateFilter}T00:00:00.000Z`);
        const end = new Date(`${dateFilter}T23:59:59.999Z`);
        query = query.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
      }
      
      const { data: allPayments, error: paymentsError } = await query;
      
      if (paymentsError) throw paymentsError;

      // Get all payments for totals (not filtered by date)
      const { data: allPaymentsForTotals } = await supabase
        .from("agent_payments")
        .select("*")
        .eq("delivery_agent_id", selectedAgentId);

      const owedPayments = allPaymentsForTotals?.filter(p => p.payment_type === 'owed') || [];
      const manualPayments = allPaymentsForTotals?.filter(p => p.payment_type === 'payment') || [];
      const deliveredPayments = allPaymentsForTotals?.filter(p => p.payment_type === 'delivered') || [];
      const deliveredResets = allPaymentsForTotals?.filter(p => p.payment_type === 'delivered_reset') || [];
      const returnPayments = allPaymentsForTotals?.filter(p => p.payment_type === 'return') || [];
      const returnResets = allPaymentsForTotals?.filter(p => p.payment_type === 'return_reset') || [];

      const totalOwed = owedPayments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
      const totalPaid = manualPayments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
      const totalDelivered = deliveredPayments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
      const deliveredReset = deliveredResets.reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0);
      // المبالغ المرتجعة (سالبة في قاعدة البيانات)
      const totalReturns = returnPayments.reduce((sum, p) => sum + Math.abs(parseFloat(p.amount.toString())), 0);
      const totalReturnResets = returnResets.reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0);

      // باقي من المرتجع = إجمالي المرتجعات - ما تم تصفيره
      const remainingReturns = Math.max(0, totalReturns - totalReturnResets);

      // مستحقات على المندوب = المطلوب منه - المسلم - المدفوع مقدماً - المرتجعات
      const agentReceivables = totalOwed - totalDelivered - totalPaid - totalReturns;
      const totalDeliveredNet = Math.max(0, totalDelivered - deliveredReset);

      return {
        payments: allPayments?.filter(p => p.payment_type === 'payment') || [],
        totalDelivered,
        totalDeliveredNet,
        totalPaid,
        deliveredReset,
        totalOwed,
        agentReceivables,
        totalReturns,
        remainingReturns,
      };
    },
    enabled: !!selectedAgentId,
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
    staleTime: 0
  });

  const createMutation = useMutation({
    mutationFn: async (data: { amount: string; notes: string }) => {
      if (!selectedAgentId) throw new Error("لم يتم اختيار مندوب");
      
      const { error } = await supabase
        .from("agent_payments")
        .insert({
          delivery_agent_id: selectedAgentId,
          amount: parseFloat(data.amount),
          payment_type: "payment",
          notes: data.notes || null
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_payments_summary"] });
      queryClient.invalidateQueries({ queryKey: ["agent_orders_summary"] });
      toast.success("تم إضافة الدفعة بنجاح");
      logActivity('إضافة دفعة مندوب', 'agent_payments', { agentId: selectedAgentId, amount: formData.amount });
      setFormData({ amount: "", notes: "" });
      setOpen(false);
    },
    onError: () => {
      toast.error("حدث خطأ أثناء الإضافة");
    }
  });

  const resetDeliveredMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAgentId) throw new Error("لم يتم اختيار مندوب");
      
      const { error } = await supabase
        .from("agent_payments")
        .insert({
          delivery_agent_id: selectedAgentId,
          amount: (agentData?.totalDeliveredNet || 0),
          payment_type: "delivered_reset",
          notes: "إعادة تعيين - تصفير إجمالي الطلبات المسلمة"
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_payments_summary"] });
      queryClient.invalidateQueries({ queryKey: ["agent_orders_summary"] });
      toast.success("تم إعادة التعيين بنجاح");
      logActivity('إعادة تعيين المسلم', 'agent_payments', { agentId: selectedAgentId });
    },
    onError: () => {
      toast.error("حدث خطأ أثناء إعادة التعيين");
    }
  });

  const resetReturnsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAgentId) throw new Error("لم يتم اختيار مندوب");
      
      const { error } = await supabase
        .from("agent_payments")
        .insert({
          delivery_agent_id: selectedAgentId,
          amount: (agentData?.remainingReturns || 0),
          payment_type: "return_reset",
          notes: "إعادة تعيين - تصفير باقي من المرتجع"
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_payments_summary"] });
      queryClient.invalidateQueries({ queryKey: ["agent_orders_summary"] });
      toast.success("تم إعادة تعيين باقي المرتجع بنجاح");
      logActivity('إعادة تعيين باقي المرتجع', 'agent_payments', { agentId: selectedAgentId });
    },
    onError: () => {
      toast.error("حدث خطأ أثناء إعادة التعيين");
    }
  });

  const settleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAgentId) throw new Error("لم يتم اختيار مندوب");

      const { error: ordersError } = await supabase
        .from("orders")
        .update({ status: "delivered" })
        .eq("delivery_agent_id", selectedAgentId)
        .in("status", ["pending", "shipped"]);
      if (ordersError) throw ordersError;

      const { error: deleteError } = await supabase
        .from("agent_payments")
        .delete()
        .eq("delivery_agent_id", selectedAgentId)
        .eq("payment_type", "payment");
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_payments_summary"] });
      queryClient.invalidateQueries({ queryKey: ["agent_orders_summary"] });
      toast.success("تم التقفيل بنجاح");
      logActivity('تقفيل حساب مندوب', 'agent_payments', { agentId: selectedAgentId });
    },
    onError: () => {
      toast.error("حدث خطأ أثناء التقفيل");
    }
  });

  const resetAdvanceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAgentId) throw new Error("لم يتم اختيار مندوب");

      const { error } = await supabase
        .from("agent_payments")
        .delete()
        .eq("delivery_agent_id", selectedAgentId)
        .eq("payment_type", "payment");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_payments_summary"] });
      toast.success("تمت إعادة تعيين الدفعة المقدمة");
      logActivity('إعادة تعيين دفعة مقدمة', 'agent_payments', { agentId: selectedAgentId });
    },
    onError: () => {
      toast.error("حدث خطأ أثناء إعادة تعيين الدفعة المقدمة");
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, amount, notes }: { id: string, amount: string, notes: string }) => {
      const { error } = await supabase
        .from("agent_payments")
        .update({
          amount: parseFloat(amount),
          notes: notes || null
        })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_payments_summary"] });
      toast.success("تم التعديل بنجاح");
      logActivity('تعديل دفعة', 'agent_payments', { paymentId: editingPayment?.id });
      setEditOpen(false);
      setEditingPayment(null);
    },
    onError: () => {
      toast.error("حدث خطأ أثناء التعديل");
    }
  });

  // Mutation for updating summary values (adding adjustment payment)
  const adjustSummaryMutation = useMutation({
    mutationFn: async ({ type, newValue, currentValue }: { type: string; newValue: number; currentValue: number }) => {
      if (!selectedAgentId) throw new Error("لم يتم اختيار مندوب");
      
      const difference = newValue - currentValue;
      if (difference === 0) return;

      const paymentType = type === 'receivables' ? 'owed' : 
                         type === 'delivered' ? 'delivered' : 
                         type === 'advance' ? 'payment' : 'return';

      const { error } = await supabase
        .from("agent_payments")
        .insert({
          delivery_agent_id: selectedAgentId,
          amount: Math.abs(difference),
          payment_type: paymentType,
          notes: `تعديل يدوي - ${difference > 0 ? 'إضافة' : 'خصم'} ${Math.abs(difference)} ج.م`
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_payments_summary"] });
      toast.success("تم التعديل بنجاح");
      setEditingSummary(null);
    },
    onError: () => {
      toast.error("حدث خطأ أثناء التعديل");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("agent_payments")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_payments_summary"] });
      queryClient.invalidateQueries({ queryKey: ["agent_orders_summary"] });
      toast.success("تم الحذف بنجاح");
      logActivity('حذف دفعة', 'agent_payments');
    },
    onError: () => {
      toast.error("حدث خطأ أثناء الحذف");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId || !formData.amount) {
      toast.error("يرجى ملء جميع الحقول");
      return;
    }
    createMutation.mutate({ amount: formData.amount, notes: formData.notes });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.amount || !editingPayment) {
      toast.error("يرجى ملء المبلغ");
      return;
    }
    updateMutation.mutate({
      id: editingPayment.id,
      amount: editFormData.amount,
      notes: editFormData.notes
    });
  };

  const handleEdit = (payment: any) => {
    setEditingPayment(payment);
    setEditFormData({
      amount: payment.amount.toString(),
      notes: payment.notes || ""
    });
    setEditOpen(true);
  };

  const handleSummaryEdit = (type: string, currentValue: number) => {
    if (!canEditPayments) return;
    setEditingSummary({ type, value: currentValue.toString() });
  };

  const handleSummarySubmit = () => {
    if (!editingSummary) return;
    
    const newValue = parseFloat(editingSummary.value);
    let currentValue = 0;
    
    switch (editingSummary.type) {
      case 'receivables':
        currentValue = agentData?.agentReceivables || 0;
        break;
      case 'returns':
        currentValue = agentData?.remainingReturns || 0;
        break;
      case 'delivered':
        currentValue = agentData?.totalDeliveredNet || 0;
        break;
      case 'advance':
        currentValue = agentData?.totalPaid || 0;
        break;
    }

    adjustSummaryMutation.mutate({ type: editingSummary.type, newValue, currentValue });
  };

  const selectedAgent = agents?.find(a => a.id === selectedAgentId);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <Button onClick={() => navigate("/admin")} variant="ghost" className="mb-4">
          <ArrowLeft className="ml-2 h-4 w-4" />
          رجوع
        </Button>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              مستحقات على المندوب
              {!canEditPayments && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">مشاهدة فقط</span>
              )}
            </CardTitle>
            {canEditPayments && (
              <div className="flex gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      disabled={!selectedAgentId}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      تقفيل
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>تأكيد التقفيل</AlertDialogTitle>
                      <AlertDialogDescription>
                        سيتم تحويل جميع الطلبات إلى "تم التوصيل" وحذف الدفعات المقدمة
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <AlertDialogAction onClick={() => settleMutation.mutate()}>
                        تأكيد
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button disabled={!selectedAgentId}>
                      <Plus className="ml-2 h-4 w-4" />
                      إضافة دفعة
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>إضافة دفعة جديدة</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="amount">المبلغ (ج.م)</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          value={formData.amount}
                          onChange={(e) => setFormData({...formData, amount: e.target.value})}
                          required
                          placeholder="أدخل المبلغ المدفوع"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="notes">ملاحظات</Label>
                        <Textarea
                          id="notes"
                          value={formData.notes}
                          onChange={(e) => setFormData({...formData, notes: e.target.value})}
                          rows={2}
                          placeholder="أضف ملاحظات (اختياري)"
                        />
                      </div>
                      
                      <Button type="submit" className="w-full">
                        إضافة دفعة
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Label>اختر مندوب لعرض سجلاته</Label>
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger className="w-full mt-2">
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
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-40"
                />
                {dateFilter && (
                  <Button size="sm" variant="ghost" onClick={() => setDateFilter("")}>
                    إلغاء
                  </Button>
                )}
              </div>
            </div>

            {selectedAgent && agentData && (
              <Card className="mb-6 bg-accent">
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-3">{selectedAgent.name}</h3>
                  <p className="text-xs text-muted-foreground mb-4">اضغط على أي قيمة لتعديلها</p>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* مستحقات على المندوب */}
                    <div 
                      className={`p-3 rounded-lg transition-colors ${canEditPayments ? 'cursor-pointer hover:bg-primary/10' : ''}`}
                      onClick={() => handleSummaryEdit('receivables', agentData.agentReceivables)}
                    >
                      <p className="text-sm text-muted-foreground">مستحقات على المندوب</p>
                      {editingSummary?.type === 'receivables' ? (
                        <div className="flex gap-2 mt-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={editingSummary.value}
                            onChange={(e) => setEditingSummary({...editingSummary, value: e.target.value})}
                            className="h-8"
                            autoFocus
                          />
                          <Button size="sm" onClick={handleSummarySubmit}>حفظ</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingSummary(null)}>إلغاء</Button>
                        </div>
                      ) : (
                        <>
                          <p className={`text-2xl font-bold ${agentData.agentReceivables >= 0 ? 'text-primary' : 'text-red-600'}`}>
                            {agentData.agentReceivables.toFixed(2)} ج.م
                          </p>
                          {agentData.agentReceivables < 0 && (
                            <p className="text-xs text-red-500 mt-1">المندوب له رصيد عندك</p>
                          )}
                        </>
                      )}
                    </div>

                    {/* باقي من المرتجع */}
                    <div className="p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-muted-foreground">باقي من المرتجع</p>
                        {canEditPayments && agentData.remainingReturns > 0 && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="h-6 px-2">
                                <RefreshCw className="h-3 w-3 ml-1" />
                                تصفير
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>تأكيد إعادة التعيين</AlertDialogTitle>
                                <AlertDialogDescription>
                                  سيتم تصفير باقي من المرتجع ({agentData.remainingReturns.toFixed(2)} ج.م)
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={() => resetReturnsMutation.mutate()}>
                                  تأكيد
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                      <div 
                        className={`${canEditPayments ? 'cursor-pointer hover:opacity-80' : ''}`}
                        onClick={() => handleSummaryEdit('returns', agentData.remainingReturns)}
                      >
                        {editingSummary?.type === 'returns' ? (
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={editingSummary.value}
                              onChange={(e) => setEditingSummary({...editingSummary, value: e.target.value})}
                              className="h-8"
                              autoFocus
                            />
                            <Button size="sm" onClick={handleSummarySubmit}>حفظ</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingSummary(null)}>إلغاء</Button>
                          </div>
                        ) : (
                          <p className="text-2xl font-bold text-orange-600">
                            {agentData.remainingReturns.toFixed(2)} ج.م
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">إجمالي المرتجعات: {agentData.totalReturns.toFixed(2)} ج.م</p>
                    </div>

                    {/* إجمالي الطلبات المسلمة */}
                    <div className="p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-muted-foreground">إجمالي الطلبات المسلمة</p>
                        {canEditPayments && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="h-6 px-2">
                                <RefreshCw className="h-3 w-3 ml-1" />
                                تصفير
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>تأكيد إعادة التعيين</AlertDialogTitle>
                                <AlertDialogDescription>
                                  سيتم تصفير إجمالي الطلبات المسلمة
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={() => resetDeliveredMutation.mutate()}>
                                  تأكيد
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                      <div 
                        className={`${canEditPayments ? 'cursor-pointer hover:opacity-80' : ''}`}
                        onClick={() => handleSummaryEdit('delivered', agentData.totalDeliveredNet)}
                      >
                        {editingSummary?.type === 'delivered' ? (
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={editingSummary.value}
                              onChange={(e) => setEditingSummary({...editingSummary, value: e.target.value})}
                              className="h-8"
                              autoFocus
                            />
                            <Button size="sm" onClick={handleSummarySubmit}>حفظ</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingSummary(null)}>إلغاء</Button>
                          </div>
                        ) : (
                          <p className="text-2xl font-bold text-blue-600">
                            {agentData.totalDeliveredNet.toFixed(2)} ج.م
                          </p>
                        )}
                      </div>
                    </div>

                    {/* دفعة مقدمة */}
                    <div className="p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-muted-foreground">دفعة مقدمة</p>
                        {canEditPayments && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="h-6 px-2">
                                <RefreshCw className="h-3 w-3 ml-1" />
                                تصفير
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>تأكيد إعادة التعيين</AlertDialogTitle>
                                <AlertDialogDescription>
                                  سيتم حذف جميع الدفعات المقدمة
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={() => resetAdvanceMutation.mutate()}>
                                  تأكيد
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                      <div 
                        className={`${canEditPayments ? 'cursor-pointer hover:opacity-80' : ''}`}
                        onClick={() => handleSummaryEdit('advance', agentData.totalPaid)}
                      >
                        {editingSummary?.type === 'advance' ? (
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={editingSummary.value}
                              onChange={(e) => setEditingSummary({...editingSummary, value: e.target.value})}
                              className="h-8"
                              autoFocus
                            />
                            <Button size="sm" onClick={handleSummarySubmit}>حفظ</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingSummary(null)}>إلغاء</Button>
                          </div>
                        ) : (
                          <p className="text-2xl font-bold text-green-600">
                            {agentData.totalPaid.toFixed(2)} ج.م
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {!selectedAgentId ? (
              <p className="text-center text-muted-foreground py-8">اختر مندوب لعرض المستحقات والدفعات</p>
            ) : isLoading ? (
              <p className="text-center py-8">جاري التحميل...</p>
            ) : !agentData?.payments || agentData.payments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد دفعات مسجلة</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المبلغ</TableHead>
                      <TableHead>ملاحظات</TableHead>
                      <TableHead>التاريخ</TableHead>
                      {canEditPayments && <TableHead>إجراءات</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentData.payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-bold text-green-600">
                          {parseFloat(payment.amount.toString()).toFixed(2)} ج.م
                        </TableCell>
                        <TableCell>{payment.notes || "-"}</TableCell>
                        <TableCell>
                          {new Date(payment.created_at).toLocaleDateString("ar-EG")}
                        </TableCell>
                        {canEditPayments && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleEdit(payment)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="icon">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      هل أنت متأكد من حذف هذه الدفعة؟
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteMutation.mutate(payment.id)}>
                                      حذف
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تعديل الدفعة</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <Label htmlFor="edit_amount">المبلغ (ج.م)</Label>
                <Input
                  id="edit_amount"
                  type="number"
                  step="0.01"
                  value={editFormData.amount}
                  onChange={(e) => setEditFormData({...editFormData, amount: e.target.value})}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="edit_notes">ملاحظات</Label>
                <Textarea
                  id="edit_notes"
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                  rows={2}
                />
              </div>
              
              <Button type="submit" className="w-full">
                حفظ التعديلات
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AgentPayments;