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
    delivery_agent_id: "",
    amount: "",
    payment_type: "payment",
    notes: ""
  });

  const [editFormData, setEditFormData] = useState({
    amount: "",
    payment_type: "payment",
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

  // Get payments and recalculate totals from orders
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["agent_payments", selectedAgentId],
    queryFn: async () => {
      if (!selectedAgentId) return [];
      
      // Get all orders for this agent
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, total_amount, shipping_cost, agent_shipping_cost, status")
        .eq("delivery_agent_id", selectedAgentId);
      
      if (ordersError) throw ordersError;

      // Calculate totals from orders
      let totalOwed = 0;
      orders?.forEach(order => {
        const amount = parseFloat(order.total_amount?.toString() || "0") + 
                      parseFloat(order.shipping_cost?.toString() || "0") - 
                      parseFloat(order.agent_shipping_cost?.toString() || "0");
        totalOwed += amount;
      });

      // Get payment records
      const { data: paymentRecords, error } = await supabase
        .from("agent_payments")
        .select("*")
        .eq("delivery_agent_id", selectedAgentId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;

      // Calculate total paid from payment records
      const totalPaid = paymentRecords?.reduce((sum, p) => {
        if (p.payment_type === "payment") {
          return sum + parseFloat(p.amount.toString());
        }
        return sum;
      }, 0) || 0;

      // Update agent totals to match actual orders
      await supabase
        .from("delivery_agents")
        .update({
          total_owed: totalOwed,
          total_paid: totalPaid
        })
        .eq("id", selectedAgentId);

      return paymentRecords;
    },
    enabled: !!selectedAgentId
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from("agent_payments")
        .insert({
          delivery_agent_id: data.delivery_agent_id,
          amount: parseFloat(data.amount),
          payment_type: data.payment_type,
          notes: data.notes || null
        });
      
      if (error) throw error;

      // Update agent totals
      const agent = agents?.find(a => a.id === data.delivery_agent_id);
      if (agent) {
        const newTotal = data.payment_type === "payment"
          ? parseFloat(agent.total_paid.toString()) + parseFloat(data.amount)
          : parseFloat(agent.total_owed.toString()) + parseFloat(data.amount);

        const updateData = data.payment_type === "payment"
          ? { total_paid: newTotal }
          : { total_owed: newTotal };

        const { error: updateError } = await supabase
          .from("delivery_agents")
          .update(updateData)
          .eq("id", data.delivery_agent_id);

        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_payments"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      toast.success("تم الحفظ بنجاح");
      setOpen(false);
      setFormData({
        delivery_agent_id: "",
        amount: "",
        payment_type: "payment",
        notes: ""
      });
    },
    onError: (error) => {
      console.error("خطأ في الحفظ:", error);
      toast.error("حدث خطأ في الحفظ");
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, oldData, newData }: { id: string, oldData: any, newData: typeof editFormData }) => {
      // First, reverse the old totals
      const agent = agents?.find(a => a.id === oldData.delivery_agent_id);
      if (agent) {
        const oldAmount = parseFloat(oldData.amount.toString());
        const newAmount = parseFloat(newData.amount);
        
        // Reverse old values
        let currentPaid = parseFloat(agent.total_paid.toString());
        let currentOwed = parseFloat(agent.total_owed.toString());

        if (oldData.payment_type === "payment") {
          currentPaid -= oldAmount;
        } else {
          currentOwed -= oldAmount;
        }

        // Add new values
        if (newData.payment_type === "payment") {
          currentPaid += newAmount;
        } else {
          currentOwed += newAmount;
        }

        // Update agent totals
        const { error: agentError } = await supabase
          .from("delivery_agents")
          .update({
            total_paid: currentPaid,
            total_owed: currentOwed
          })
          .eq("id", oldData.delivery_agent_id);

        if (agentError) throw agentError;
      }

      // Update the payment record
      const { error } = await supabase
        .from("agent_payments")
        .update({
          amount: parseFloat(newData.amount),
          payment_type: newData.payment_type,
          notes: newData.notes || null
        })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_payments"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      toast.success("تم التعديل بنجاح");
      setEditOpen(false);
      setEditingPayment(null);
    },
    onError: (error) => {
      console.error("خطأ في التعديل:", error);
      toast.error("حدث خطأ في التعديل");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (payment: any) => {
      // First update agent totals
      const agent = agents?.find(a => a.id === payment.delivery_agent_id);
      if (agent) {
        const amount = parseFloat(payment.amount.toString());
        const newTotal = payment.payment_type === "payment"
          ? parseFloat(agent.total_paid.toString()) - amount
          : parseFloat(agent.total_owed.toString()) - amount;

        const updateData = payment.payment_type === "payment"
          ? { total_paid: Math.max(0, newTotal) }
          : { total_owed: Math.max(0, newTotal) };

        const { error: agentError } = await supabase
          .from("delivery_agents")
          .update(updateData)
          .eq("id", payment.delivery_agent_id);

        if (agentError) throw agentError;
      }

      const { error } = await supabase
        .from("agent_payments")
        .delete()
        .eq("id", payment.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_payments"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      toast.success("تم الحذف بنجاح");
    },
    onError: (error) => {
      console.error("خطأ في الحذف:", error);
      toast.error("حدث خطأ أثناء الحذف");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.delivery_agent_id || !formData.amount) {
      toast.error("يرجى ملء جميع الحقول");
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.amount || !editingPayment) {
      toast.error("يرجى ملء جميع الحقول");
      return;
    }
    updateMutation.mutate({
      id: editingPayment.id,
      oldData: editingPayment,
      newData: editFormData
    });
  };

  const handleEdit = (payment: any) => {
    setEditingPayment(payment);
    setEditFormData({
      amount: payment.amount.toString(),
      payment_type: payment.payment_type,
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
            <CardTitle>مستحقات المندوب</CardTitle>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة سجل
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>إضافة سجل جديد</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="agent">المندوب</Label>
                    <Select
                      value={formData.delivery_agent_id}
                      onValueChange={(value) => setFormData({...formData, delivery_agent_id: value})}
                    >
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
                    <Label htmlFor="payment_type">النوع</Label>
                    <Select
                      value={formData.payment_type}
                      onValueChange={(value) => setFormData({...formData, payment_type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payment">دفعة (مدفوع)</SelectItem>
                        <SelectItem value="owed">مستحق (عليه)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="amount">المبلغ (ج.م)</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="notes">ملاحظات</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      rows={2}
                    />
                  </div>
                  
                  <Button type="submit" className="w-full">
                    حفظ
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
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

            {selectedAgent && (
              <Card className="mb-6 bg-accent">
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-3">{selectedAgent.name}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">إجمالي المدفوع</p>
                      <p className="text-2xl font-bold text-green-600">
                        {parseFloat(selectedAgent.total_paid.toString()).toFixed(2)} ج.م
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">إجمالي المستحق</p>
                      <p className="text-2xl font-bold text-red-600">
                        {parseFloat(selectedAgent.total_owed.toString()).toFixed(2)} ج.م
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">الرصيد</p>
                      <p className="text-2xl font-bold">
                        {(parseFloat(selectedAgent.total_owed.toString()) - parseFloat(selectedAgent.total_paid.toString())).toFixed(2)} ج.م
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {!selectedAgentId ? (
              <p className="text-center text-muted-foreground py-8">اختر مندوب لعرض سجلاته</p>
            ) : isLoading ? (
              <p className="text-center py-8">جاري التحميل...</p>
            ) : !payments || payments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد سجلات</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>النوع</TableHead>
                      <TableHead>المبلغ</TableHead>
                      <TableHead>ملاحظات</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments?.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <span className={payment.payment_type === "payment" ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                            {payment.payment_type === "payment" ? "دفعة" : "مستحق"}
                          </span>
                        </TableCell>
                        <TableCell className="font-bold">
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
                                <Button
                                  variant="destructive"
                                  size="icon"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    هل أنت متأكد من حذف هذا السجل؟ هذا الإجراء لا يمكن التراجع عنه.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate(payment)}>
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
                <Label htmlFor="edit_payment_type">النوع</Label>
                <Select
                  value={editFormData.payment_type}
                  onValueChange={(value) => setEditFormData({...editFormData, payment_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payment">دفعة (مدفوع)</SelectItem>
                    <SelectItem value="owed">مستحق (عليه)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
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
