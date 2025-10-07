import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, ArrowLeft, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Agents = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    serial_number: ""
  });

  const { data: agents, isLoading } = useQuery({
    queryKey: ["delivery_agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_agents")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingAgent) {
        const { error } = await supabase
          .from("delivery_agents")
          .update(data)
          .eq("id", editingAgent.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("delivery_agents")
          .insert(data);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      toast.success(editingAgent ? "تم تحديث المندوب بنجاح" : "تم إضافة المندوب بنجاح");
      setOpen(false);
      setFormData({ name: "", phone: "", serial_number: "" });
      setEditingAgent(null);
    },
    onError: () => {
      toast.error("حدث خطأ");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("delivery_agents")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      toast.success("تم حذف المندوب بنجاح");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء الحذف");
    }
  });

  const handleEdit = (agent: any) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      phone: agent.phone,
      serial_number: agent.serial_number
    });
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  if (isLoading) {
    return <div className="p-8">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <Button onClick={() => navigate("/admin")} variant="ghost" className="mb-4">
          <ArrowLeft className="ml-2 h-4 w-4" />
          رجوع
        </Button>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>بيانات المندوبين</CardTitle>
            <Dialog open={open} onOpenChange={(isOpen) => {
              setOpen(isOpen);
              if (!isOpen) {
                setEditingAgent(null);
                setFormData({ name: "", phone: "", serial_number: "" });
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة مندوب
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingAgent ? "تعديل مندوب" : "إضافة مندوب جديد"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">اسم المندوب</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">رقم الهاتف</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="serial_number">السيريال نمبر</Label>
                    <Input
                      id="serial_number"
                      value={formData.serial_number}
                      onChange={(e) => setFormData({...formData, serial_number: e.target.value})}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    {editingAgent ? "تحديث" : "إضافة"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {!agents || agents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا يوجد مندوبين</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الاسم</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>السيريال نمبر</TableHead>
                      <TableHead>إجمالي المستحق</TableHead>
                      <TableHead>إجمالي المدفوع</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell className="font-medium">{agent.name}</TableCell>
                        <TableCell>{agent.phone}</TableCell>
                        <TableCell>{agent.serial_number}</TableCell>
                        <TableCell>{parseFloat(agent.total_owed.toString()).toFixed(2)} ج.م</TableCell>
                        <TableCell>{parseFloat(agent.total_paid.toString()).toFixed(2)} ج.م</TableCell>
                        <TableCell>
                          {new Date(agent.created_at).toLocaleDateString("ar-EG")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleEdit(agent)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => deleteMutation.mutate(agent.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
      </div>
    </div>
  );
};

export default Agents;
