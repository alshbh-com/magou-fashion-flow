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
import { 
  Plus, ArrowLeft, TrendingUp, TrendingDown, Wallet, Calendar, 
  Lock, ShieldCheck, FileText, Trash2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useDailyCashbox } from "@/hooks/useDailyCashbox";

const TRANSACTION_REASONS = [
  { value: 'order', label: 'طلب' },
  { value: 'expense', label: 'مصروف' },
  { value: 'salary', label: 'مرتب' },
  { value: 'refund', label: 'استرداد' },
  { value: 'manual', label: 'يدوي' }
];

const ADMIN_PASSWORD = "Magdi17121997";

const Cashbox = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canEdit, canView, currentUser, logActivity } = useAdminAuth();
  
  const [addTransactionOpen, setAddTransactionOpen] = useState(false);
  const [createCashboxOpen, setCreateCashboxOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>("");
  const [monthFilter, setMonthFilter] = useState<string>("");
  const [selectedCashboxId, setSelectedCashboxId] = useState<string>("");
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [pendingAction, setPendingAction] = useState<"transaction" | "cashbox" | "delete" | null>(null);
  const [cashboxToDelete, setCashboxToDelete] = useState<string | null>(null);
  
  const [transactionForm, setTransactionForm] = useState({
    type: "income" as "income" | "expense",
    amount: "",
    reason: "manual",
    description: "",
    payment_method: "cash" as "cash" | "transfer"
  });

  const [newCashboxForm, setNewCashboxForm] = useState({
    name: "",
    opening_balance: ""
  });

  const canManageCashbox = canEdit('cashbox') || canEdit('treasury');
  // المطلوب: مستخدم "مشاهدة" للخزنة يقدر ينشئ خزنة جديدة فقط
  const canCreateCashbox = canManageCashbox || canView('treasury') || canView('cashbox');

  // Use daily cashbox hook (auto-creates today's cashbox)
  const { cashboxes, isLoading: loadingCashboxes } = useDailyCashbox();

  // Fetch transactions for selected cashbox
  const { data: transactions, isLoading: loadingTransactions } = useQuery({
    queryKey: ["cashbox-transactions", selectedCashboxId, dateFilter, monthFilter],
    queryFn: async () => {
      if (!selectedCashboxId) return [];
      
      let query = supabase
        .from("cashbox_transactions")
        .select("*")
        .eq("cashbox_id", selectedCashboxId)
        .order("created_at", { ascending: false });
      
      // Daily filter
      if (dateFilter) {
        const start = new Date(`${dateFilter}T00:00:00.000Z`);
        const end = new Date(`${dateFilter}T23:59:59.999Z`);
        query = query.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
      }
      
      // Monthly filter
      if (monthFilter && !dateFilter) {
        const [year, month] = monthFilter.split("-");
        const start = new Date(parseInt(year), parseInt(month) - 1, 1);
        const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
        query = query.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCashboxId
  });

  // Calculate balance for selected cashbox
  const { data: cashboxBalance } = useQuery({
    queryKey: ["cashbox-balance", selectedCashboxId],
    queryFn: async () => {
      if (!selectedCashboxId) return null;
      
      // Get cashbox opening balance
      const { data: cashbox, error: cashboxError } = await supabase
        .from("cashbox")
        .select("opening_balance, name")
        .eq("id", selectedCashboxId)
        .single();
      
      if (cashboxError) throw cashboxError;
      
      // Get all transactions
      const { data: allTransactions, error: transError } = await supabase
        .from("cashbox_transactions")
        .select("type, amount")
        .eq("cashbox_id", selectedCashboxId);
      
      if (transError) throw transError;
      
      const income = allTransactions?.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0;
      const expenses = allTransactions?.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0;
      const openingBalance = parseFloat(cashbox.opening_balance?.toString() || "0");
      
      return {
        name: cashbox.name,
        openingBalance,
        income,
        expenses,
        currentBalance: openingBalance + income - expenses
      };
    },
    enabled: !!selectedCashboxId
  });

  // Create cashbox mutation
  const createCashboxMutation = useMutation({
    mutationFn: async (data: typeof newCashboxForm) => {
      const { error } = await supabase
        .from("cashbox")
        .insert({
          name: data.name,
          opening_balance: parseFloat(data.opening_balance) || 0,
          created_by: currentUser?.id || null
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashboxes"] });
      toast.success("تم إنشاء الخزنة بنجاح");
      logActivity('إنشاء خزنة', 'cashbox', { name: newCashboxForm.name });
      setCreateCashboxOpen(false);
      setNewCashboxForm({ name: "", opening_balance: "" });
    },
    onError: () => {
      toast.error("حدث خطأ أثناء إنشاء الخزنة");
    }
  });

  // Delete cashbox mutation
  const deleteCashboxMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cashbox")
        .update({ is_active: false })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashboxes"] });
      toast.success("تم حذف الخزنة بنجاح");
      logActivity('حذف خزنة', 'cashbox', { cashbox_id: cashboxToDelete });
      setSelectedCashboxId("");
      setCashboxToDelete(null);
    },
    onError: () => {
      toast.error("حدث خطأ أثناء حذف الخزنة");
    }
  });

  // Create transaction mutation
  const createTransactionMutation = useMutation({
    mutationFn: async (data: typeof transactionForm) => {
      const { error } = await supabase
        .from("cashbox_transactions")
        .insert({
          cashbox_id: selectedCashboxId,
          type: data.type,
          amount: parseFloat(data.amount),
          reason: data.reason,
          description: data.description || null,
          user_id: currentUser?.id || null,
          username: currentUser?.username || null,
          payment_method: data.payment_method,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashbox-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["cashbox-balance"] });
      toast.success("تم إضافة الحركة بنجاح");
      logActivity(
        transactionForm.type === 'income' ? 'إيداع في الخزنة' : 'سحب من الخزنة', 
        'cashbox', 
        { amount: transactionForm.amount, reason: transactionForm.reason }
      );
      setAddTransactionOpen(false);
      setTransactionForm({ type: "income", amount: "", reason: "manual", description: "", payment_method: "cash" });
    },
    onError: (error: any) => {
      console.error('Transaction error:', error);
      toast.error("حدث خطأ أثناء إضافة الحركة");
    }
  });

  const handleCreateCashbox = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCashboxForm.name) {
      toast.error("يرجى إدخال اسم الخزنة");
      return;
    }
    createCashboxMutation.mutate(newCashboxForm);
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionForm.amount || parseFloat(transactionForm.amount) <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
      return;
    }
    if (!selectedCashboxId) {
      toast.error("يرجى اختيار خزنة");
      return;
    }
    createTransactionMutation.mutate(transactionForm);
  };

  const handlePasswordSubmit = () => {
    if (passwordInput !== ADMIN_PASSWORD) {
      toast.error("كلمة السر غير صحيحة");
      logActivity('محاولة دخول فاشلة للخزنة', 'cashbox', { action: pendingAction });
      return;
    }
    setPasswordDialogOpen(false);
    setPasswordInput("");
    if (pendingAction === "transaction") {
      setAddTransactionOpen(true);
    } else if (pendingAction === "cashbox") {
      setCreateCashboxOpen(true);
    } else if (pendingAction === "delete" && cashboxToDelete) {
      deleteCashboxMutation.mutate(cashboxToDelete);
    }
    setPendingAction(null);
  };

  const openWithPassword = (action: "transaction" | "cashbox" | "delete", cashboxId?: string) => {
    setPendingAction(action);
    if (action === "delete" && cashboxId) {
      setCashboxToDelete(cashboxId);
    }
    setPasswordDialogOpen(true);
  };

  const getReasonLabel = (reason: string) => {
    return TRANSACTION_REASONS.find(r => r.value === reason)?.label || reason;
  };

  if (loadingCashboxes) {
    return <div className="p-8 text-center">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <Button onClick={() => navigate("/admin")} variant="ghost" className="mb-4">
          <ArrowLeft className="ml-2 h-4 w-4" />
          رجوع
        </Button>

        {/* Security Notice */}
        <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-amber-500" />
              <div>
                <h3 className="font-bold text-amber-700 dark:text-amber-400">نظام خزنة آمن</h3>
                <p className="text-sm text-muted-foreground">
                  ❌ لا يمكن حذف أو تعديل أي حركة بعد تسجيلها • الرصيد يُحسب تلقائياً • كل العمليات مسجلة
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cashbox Selection & Creation */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              الخزنات
            </CardTitle>
            {canCreateCashbox && (
              <>
                <Button
                  onClick={() => {
                    if (canManageCashbox) return openWithPassword("cashbox");
                    setCreateCashboxOpen(true);
                  }}
                >
                  <Plus className="ml-2 h-4 w-4" />
                  إنشاء خزنة
                </Button>
                <Dialog open={createCashboxOpen} onOpenChange={setCreateCashboxOpen}>
                  <DialogContent>
                  <DialogHeader>
                    <DialogTitle>إنشاء خزنة جديدة</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateCashbox} className="space-y-4">
                    <div>
                      <Label>اسم الخزنة</Label>
                      <Input
                        value={newCashboxForm.name}
                        onChange={(e) => setNewCashboxForm({...newCashboxForm, name: e.target.value})}
                        placeholder="مثال: الخزنة الرئيسية"
                        required
                      />
                    </div>
                    <div>
                      <Label>الرصيد الافتتاحي (ج.م)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newCashboxForm.opening_balance}
                        onChange={(e) => setNewCashboxForm({...newCashboxForm, opening_balance: e.target.value})}
                        placeholder="0.00"
                      />
                    </div>
                    <Button type="submit" className="w-full">إنشاء</Button>
                  </form>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </CardHeader>
          <CardContent>
            {!cashboxes || cashboxes.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">لا توجد خزنات. قم بإنشاء خزنة جديدة.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {cashboxes.map((cashbox: any) => (
                  <div key={cashbox.id} className="flex items-center gap-1">
                    <Button
                      variant={selectedCashboxId === cashbox.id ? "default" : "outline"}
                      onClick={() => setSelectedCashboxId(cashbox.id)}
                      className="flex items-center gap-2"
                    >
                      <Wallet className="h-4 w-4" />
                      {cashbox.name}
                    </Button>
                    {canManageCashbox && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => openWithPassword("delete", cashbox.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cashbox Details */}
        {selectedCashboxId && cashboxBalance && (
          <>
            {/* Balance Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">الرصيد الافتتاحي</CardTitle>
                  <Wallet className="h-5 w-5 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {cashboxBalance.openingBalance.toFixed(2)} ج.م
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">إجمالي الإيداعات</CardTitle>
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    +{cashboxBalance.income.toFixed(2)} ج.م
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">إجمالي المسحوبات</CardTitle>
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    -{cashboxBalance.expenses.toFixed(2)} ج.م
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">الرصيد الحالي</CardTitle>
                  <Lock className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${cashboxBalance.currentBalance >= 0 ? 'text-primary' : 'text-red-600'}`}>
                    {cashboxBalance.currentBalance.toFixed(2)} ج.م
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Payment Method Summary */}
            {transactions && transactions.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Card className="border-amber-500/20 bg-amber-500/5">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">💵 إجمالي الكاش</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-700">
                      {transactions
                        .filter((t: any) => t.payment_method !== 'transfer')
                        .reduce((sum: number, t: any) => {
                          const amt = parseFloat(t.amount);
                          return t.type === 'income' ? sum + amt : sum - amt;
                        }, 0).toFixed(2)} ج.م
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {transactions.filter((t: any) => t.payment_method !== 'transfer').length} حركة
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-blue-500/20 bg-blue-500/5">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">💳 إجمالي النقدي (تحويل)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-700">
                      {transactions
                        .filter((t: any) => t.payment_method === 'transfer')
                        .reduce((sum: number, t: any) => {
                          const amt = parseFloat(t.amount);
                          return t.type === 'income' ? sum + amt : sum - amt;
                        }, 0).toFixed(2)} ج.م
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {transactions.filter((t: any) => t.payment_method === 'transfer').length} حركة
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Transactions Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  حركات الخزنة: {cashboxBalance.name}
                  {!canManageCashbox && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">مشاهدة فقط</span>
                  )}
                </CardTitle>
                <div className="flex gap-2 items-center flex-wrap">
                  {/* Daily Filter */}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => {
                        setDateFilter(e.target.value);
                        setMonthFilter("");
                      }}
                      className="w-40"
                      placeholder="فلتر يومي"
                    />
                  </div>

                  {/* Monthly Filter */}
                  <div className="flex items-center gap-2">
                    <Input
                      type="month"
                      value={monthFilter}
                      onChange={(e) => {
                        setMonthFilter(e.target.value);
                        setDateFilter("");
                      }}
                      className="w-40"
                      placeholder="فلتر شهري"
                    />
                  </div>

                  {(dateFilter || monthFilter) && (
                    <Button size="sm" variant="ghost" onClick={() => {
                      setDateFilter("");
                      setMonthFilter("");
                    }}>
                      إلغاء الفلتر
                    </Button>
                  )}

                  {canManageCashbox && (
                    <>
                      <Button onClick={() => openWithPassword("transaction")}>
                        <Plus className="ml-2 h-4 w-4" />
                        إضافة حركة
                      </Button>
                      <Dialog open={addTransactionOpen} onOpenChange={setAddTransactionOpen}>
                        <DialogContent>
                        <DialogHeader>
                          <DialogTitle>إضافة حركة جديدة</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddTransaction} className="space-y-4">
                          <div>
                            <Label>نوع الحركة</Label>
                            <Select 
                              value={transactionForm.type} 
                              onValueChange={(v) => setTransactionForm({...transactionForm, type: v as "income" | "expense"})}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="income">دخل (إيداع)</SelectItem>
                                <SelectItem value="expense">خرج (سحب)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>المبلغ (ج.م)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={transactionForm.amount}
                              onChange={(e) => setTransactionForm({...transactionForm, amount: e.target.value})}
                              required
                              placeholder="أدخل المبلغ"
                            />
                          </div>
                          <div>
                            <Label>سبب الحركة</Label>
                            <Select 
                              value={transactionForm.reason} 
                              onValueChange={(v) => setTransactionForm({...transactionForm, reason: v})}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TRANSACTION_REASONS.map((reason) => (
                                  <SelectItem key={reason.value} value={reason.value}>
                                    {reason.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>الوصف (اختياري)</Label>
                            <Textarea
                              value={transactionForm.description}
                              onChange={(e) => setTransactionForm({...transactionForm, description: e.target.value})}
                              rows={2}
                              placeholder="تفاصيل إضافية"
                            />
                          </div>
                          <Button type="submit" className="w-full">
                            إضافة الحركة
                          </Button>
                        </form>
                        </DialogContent>
                      </Dialog>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadingTransactions ? (
                  <p className="text-center py-8">جاري التحميل...</p>
                ) : !transactions || transactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">لا توجد حركات</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>النوع</TableHead>
                          <TableHead>المبلغ</TableHead>
                          <TableHead>طريقة الدفع</TableHead>
                          <TableHead>السبب</TableHead>
                          <TableHead>الوصف</TableHead>
                          <TableHead>المستخدم</TableHead>
                          <TableHead>التاريخ والوقت</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((transaction: any) => (
                          <TableRow key={transaction.id}>
                            <TableCell>
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${
                                transaction.type === 'income' 
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              }`}>
                                {transaction.type === 'income' ? (
                                  <><TrendingUp className="h-3 w-3" /> دخل</>
                                ) : (
                                  <><TrendingDown className="h-3 w-3" /> خرج</>
                                )}
                              </span>
                            </TableCell>
                            <TableCell className={`font-bold ${
                              transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {transaction.type === 'income' ? '+' : '-'}
                              {parseFloat(transaction.amount).toFixed(2)} ج.م
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                transaction.payment_method === 'transfer'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              }`}>
                                {transaction.payment_method === 'transfer' ? '💳 نقدي' : '💵 كاش'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="bg-muted px-2 py-1 rounded text-sm">
                                {getReasonLabel(transaction.reason)}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {transaction.description || "-"}
                            </TableCell>
                            <TableCell>{transaction.username || "-"}</TableCell>
                            <TableCell className="text-sm">
                              {new Date(transaction.created_at).toLocaleDateString("ar-EG")}
                              <span className="text-muted-foreground mr-2">
                                {new Date(transaction.created_at).toLocaleTimeString("ar-EG", { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Password Dialog */}
        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                التحقق من كلمة السر
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                أدخل كلمة السر الإدارية للوصول لهذه الميزة
              </p>
              <Input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="كلمة السر"
                onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
              />
              <Button onClick={handlePasswordSubmit} className="w-full">
                تأكيد
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Cashbox;
