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
import { Trash2, Plus, ArrowLeft, Pencil } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const AgentPayments = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [editingPayment, setEditingPayment] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    amount: "",
    notes: ""
  });

  const [editFormData, setEditFormData] = useState({
    amount: "",
    notes: ""
  });

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

  // Calculate totals dynamically from orders, returns, and payments
  const { data: agentData, isLoading } = useQuery({
    queryKey: ["agent_payments_summary", selectedAgentId],
    queryFn: async () => {
      if (!selectedAgentId) return null;
      
      // Get all orders for this agent
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("total_amount, shipping_cost, agent_shipping_cost, status")
        .eq("delivery_agent_id", selectedAgentId);
      
      if (ordersError) throw ordersError;

      // Calculate totals
      const calcOrderAmount = (o: any) => {
        const totalAmount = parseFloat(o.total_amount?.toString() || "0");
        const shippingCost = parseFloat(o.shipping_cost?.toString() || "0");
        const agentShippingCost = parseFloat(o.agent_shipping_cost?.toString() || "0");
        return totalAmount + shippingCost - agentShippingCost;
      };

      // Delivered sum
      const totalDelivered = (orders || []).reduce((sum, order) => {
        if (order.status === 'delivered') {
          return sum + calcOrderAmount(order);
        }
        return sum;
      }, 0);

      // Open receivables: assigned but not delivered/returned/cancelled
      const totalOpen = (orders || []).reduce((sum, order) => {
        if (order.status !== 'delivered' && order.status !== 'returned' && order.status !== 'cancelled') {
          return sum + calcOrderAmount(order);
        }
        return sum;
      }, 0);

      // Manual advance payments
      const { data: payments, error: paymentsError } = await supabase
        .from("agent_payments")
        .select("*")
        .eq("delivery_agent_id", selectedAgentId)
        .eq("payment_type", "payment")
        .order("created_at", { ascending: false });
      if (paymentsError) throw paymentsError;

      const totalPaid = payments?.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0) || 0;

      // Settlements to zero receivables
      const { data: settlements, error: settlementsError } = await supabase
        .from("agent_payments")
        .select("amount")
        .eq("delivery_agent_id", selectedAgentId)
        .eq("payment_type", "settlement");
      if (settlementsError) throw settlementsError;
      const totalSettled = settlements?.reduce((sum, s) => sum + parseFloat(s.amount.toString()), 0) || 0;

      // Delivered resets
      const { data: deliveredResets, error: deliveredResetsError } = await supabase
        .from("agent_payments")
        .select("amount")
        .eq("delivery_agent_id", selectedAgentId)
        .eq("payment_type", "delivered_reset");
      if (deliveredResetsError) throw deliveredResetsError;
      const deliveredReset = deliveredResets?.reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0) || 0;

      const agentReceivables = Math.max(0, totalOpen - totalPaid - totalSettled);
      const totalDeliveredNet = Math.max(0, totalDelivered - deliveredReset);

      return {
        payments,
        totalDelivered,
        totalDeliveredNet,
        totalPaid,
        totalSettled,
        deliveredReset,
        totalOpen,
        agentReceivables,
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
      setOpen(false);
      setFormData({ amount: "", notes: "" });
    },
    onError: () => {
      toast.error("حدث خطأ أثناء الإضافة");
    }
  });

  const resetDeliveredMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAgentId) throw new Error("لم يتم اختيار مندوب");
      
      // Record a delivered reset to zero the displayed delivered total
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
    },
    onError: () => {
      toast.error("حدث خطأ أثناء إعادة التعيين");
    }
  });

  const settleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAgentId) throw new Error("لم يتم اختيار مندوب");

      // 1) Update all agent's orders to "delivered" status
      const { error: ordersError } = await supabase
        .from("orders")
        .update({ status: "delivered" })
        .eq("delivery_agent_id", selectedAgentId)
        .in("status", ["pending", "shipped"]);
      if (ordersError) throw ordersError;

      // 2) Insert a settlement to zero out receivables
      const settleAmount = agentData?.agentReceivables || 0;
      if (settleAmount > 0) {
        const { error: insertError } = await supabase
          .from("agent_payments")
          .insert({
            delivery_agent_id: selectedAgentId,
            amount: settleAmount,
            payment_type: "settlement",
            notes: "تقفيل - تسوية المستحقات"
          });
        if (insertError) throw insertError;
      }

      // 3) Delete all manual advance payments so advance shows 0
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
      toast.success("تم التقفيل بنجاح - تم تحويل جميع الطلبات إلى تم التوصيل");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء التقفيل");
    }
  });

  // Reset only the advance payments (manual payments)
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
      setEditOpen(false);
      setEditingPayment(null);
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
            <CardTitle>دفعات المندوب</CardTitle>
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
                      هل أنت متأكد من تقفيل حساب المندوب؟ سيتم حذف جميع سجلات الدفعات.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={() => settleMutation.mutate()}>
                      موافق
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
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <Label>اختر مندوب لعرض سجلاته</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="w-64 mt-2">
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

            {selectedAgent && agentData && (
              <Card className="mb-6 bg-accent">
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-3">{selectedAgent.name}</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">مستحقات المندوب</p>
                      <p className="text-2xl font-bold text-primary">
                        {agentData.agentReceivables.toFixed(2)} ج.م
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-muted-foreground">إجمالي الطلبات المسلمة</p>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              إعادة تعيين
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>تأكيد إعادة التعيين</AlertDialogTitle>
                              <AlertDialogDescription>
                                هل أنت متأكد من إعادة تعيين إجمالي الطلبات المسلمة؟ سيتم تصفير المبلغ.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={() => resetDeliveredMutation.mutate()}>
                                موافق
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">
                        {agentData.totalDeliveredNet.toFixed(2)} ج.م
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-muted-foreground">دفعة مقدمة</p>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              إعادة تعيين
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>تأكيد إعادة تعيين الدفعة المقدمة</AlertDialogTitle>
                              <AlertDialogDescription>
                                سيتم تصفير إجمالي الدفعات المقدمة ويمكنك إدخال مبلغ جديد لاحقًا.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={() => resetAdvanceMutation.mutate()}>
                                موافق
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                      <p className="text-2xl font-bold text-green-600">
                        {agentData.totalPaid.toFixed(2)} ج.م
                      </p>
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
                      <TableHead>إجراءات</TableHead>
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
              <DialogTitle>تعديل السجل</DialogTitle>
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
