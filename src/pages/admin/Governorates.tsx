import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Governorates = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shippingCosts, setShippingCosts] = useState<Record<string, number>>({});

  const { data: governorates, isLoading } = useQuery({
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

  const updateShippingCostMutation = useMutation({
    mutationFn: async ({ id, shippingCost }: { id: string; shippingCost: number }) => {
      const { error } = await supabase
        .from("governorates")
        .update({ shipping_cost: shippingCost })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governorates"] });
      toast.success("تم تحديث سعر الشحن");
      setEditingId(null);
    },
  });

  const handleSave = (id: string) => {
    const cost = shippingCosts[id];
    if (cost !== undefined && cost >= 0) {
      updateShippingCostMutation.mutate({ id, shippingCost: cost });
    }
  };

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
            <CardTitle>المحافظات وأسعار الشحن</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المحافظة</TableHead>
                    <TableHead>سعر الشحن (ج.م)</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {governorates?.map((gov) => (
                    <TableRow key={gov.id}>
                      <TableCell className="font-medium">{gov.name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={editingId === gov.id ? (shippingCosts[gov.id] ?? gov.shipping_cost) : gov.shipping_cost}
                          onChange={(e) => {
                            setEditingId(gov.id);
                            setShippingCosts({
                              ...shippingCosts,
                              [gov.id]: Number(e.target.value) || 0
                            });
                          }}
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        {editingId === gov.id && (
                          <Button
                            size="sm"
                            onClick={() => handleSave(gov.id)}
                            disabled={updateShippingCostMutation.isPending}
                          >
                            <Save className="ml-2 h-4 w-4" />
                            حفظ
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Governorates;
