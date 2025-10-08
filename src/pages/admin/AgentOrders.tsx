import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, PackageX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  processing: "قيد التنفيذ",
  shipped: "تم الشحن",
  delivered: "تم التوصيل",
  cancelled: "ملغي",
  returned: "مرتجع",
  partially_returned: "مرتجع جزئي"
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500",
  processing: "bg-blue-500",
  shipped: "bg-purple-500",
  delivered: "bg-green-500",
  cancelled: "bg-red-500",
  returned: "bg-orange-600",
  partially_returned: "bg-orange-400"
};

const AgentOrders = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedOrderForReturn, setSelectedOrderForReturn] = useState<any>(null);
  const [returnData, setReturnData] = useState({
    returned_items: [] as any[],
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
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAgentId
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: status as any })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-orders"] });
      toast.success("تم تحديث الحالة");
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
      setReturnData({ returned_items: [], notes: "" });
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
    setReturnData({ returned_items: items, notes: "" });
    setReturnDialogOpen(true);
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

    // Update order status
    await updateStatusMutation.mutateAsync({
      id: selectedOrderForReturn.id,
      status: allReturned ? "returned" : "partially_returned"
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
            <div className="mt-4">
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
            </div>
          </CardHeader>
          <CardContent>
            {!selectedAgentId ? (
              <p className="text-center text-muted-foreground py-8">اختر مندوب لعرض أوردراته</p>
            ) : isLoading ? (
              <p className="text-center py-8">جاري التحميل...</p>
            ) : !orders || orders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد أوردرات لهذا المندوب</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الأوردر</TableHead>
                      <TableHead>العميل</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>العنوان</TableHead>
                      <TableHead>الإجمالي</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-xs">
                          {order.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="font-medium">
                          {order.customers?.name}
                        </TableCell>
                        <TableCell>{order.customers?.phone}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {order.customers?.address}
                        </TableCell>
                        <TableCell>
                          {parseFloat(order.total_amount.toString()).toFixed(2)} ج.م
                        </TableCell>
                        <TableCell>
                          <Select
                            value={order.status}
                            onValueChange={(value) =>
                              updateStatusMutation.mutate({ id: order.id, status: value })
                            }
                          >
                            <SelectTrigger className="w-40">
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
                        </TableCell>
                        <TableCell>
                          {new Date(order.created_at).toLocaleDateString("ar-EG")}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenReturnDialog(order)}
                          >
                            <PackageX className="ml-2 h-4 w-4" />
                            مرتجع
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Summary */}
                <div className="mt-6 p-4 bg-accent rounded-lg">
                  <h3 className="font-bold mb-2">ملخص الأوردرات</h3>
                  <p>عدد الأوردرات: {orders.length}</p>
                  <p className="font-bold text-lg">
                    الإجمالي: {orders.reduce((sum, order) => sum + parseFloat(order.total_amount.toString()), 0).toFixed(2)} ج.م
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

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

                <div className="p-4 bg-accent rounded-lg">
                  <p className="font-bold text-lg text-destructive">
                    قيمة المرتجع: {returnData.returned_items
                      .reduce((sum, item) => sum + (item.price * item.returned_quantity), 0)
                      .toFixed(2)} ج.م
                  </p>
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