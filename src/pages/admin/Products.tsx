import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, ArrowLeft, Edit, Tag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Products = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    offer_price: "",
    stock: "",
    is_offer: false,
    category_id: "",
    size_options: "",
    color_options: "",
    details: "",
    quantity_pricing: Array.from({ length: 12 }, (_, i) => ({ quantity: i + 1, price: "" }))
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      let imageUrl = data.image_url;
      
      // Upload image if provided
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(fileName, imageFile);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('products')
          .getPublicUrl(fileName);
        
        imageUrl = publicUrl;
      }
      
      const quantityPricing = data.quantity_pricing
        .filter((qp: any) => qp.price && parseFloat(qp.price) > 0)
        .map((qp: any) => ({ quantity: qp.quantity, price: parseFloat(qp.price) }));

      const productData = {
        ...data,
        image_url: imageUrl,
        price: parseFloat(data.price),
        offer_price: data.offer_price ? parseFloat(data.offer_price) : null,
        stock: parseInt(data.stock),
        size_options: data.size_options ? data.size_options.split(',').map((s: string) => s.trim()) : null,
        color_options: data.color_options ? data.color_options.split(',').map((c: string) => c.trim()) : null,
        details: data.details || null,
        quantity_pricing: quantityPricing.length > 0 ? quantityPricing : null
      };
      
      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("products")
          .insert(productData);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(editingProduct ? "تم تحديث المنتج بنجاح" : "تم إضافة المنتج بنجاح");
      resetForm();
    },
    onError: (error) => {
      console.error(error);
      toast.error("حدث خطأ");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("تم حذف المنتج بنجاح");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء الحذف");
    }
  });

  const resetForm = () => {
    setOpen(false);
    setFormData({
      name: "",
      description: "",
      price: "",
      offer_price: "",
      stock: "",
      is_offer: false,
      category_id: "",
      size_options: "",
      color_options: "",
      details: "",
      quantity_pricing: Array.from({ length: 12 }, (_, i) => ({ quantity: i + 1, price: "" }))
    });
    setEditingProduct(null);
    setImageFile(null);
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    
    const quantityPricingData = Array.from({ length: 12 }, (_, i) => {
      const existingPrice = product.quantity_pricing?.find((qp: any) => qp.quantity === i + 1);
      return { quantity: i + 1, price: existingPrice?.price?.toString() || "" };
    });

    setFormData({
      name: product.name,
      description: product.description || "",
      price: product.price.toString(),
      offer_price: product.offer_price?.toString() || "",
      stock: product.stock.toString(),
      is_offer: product.is_offer,
      category_id: product.category_id || "",
      size_options: product.size_options?.join(', ') || "",
      color_options: product.color_options?.join(', ') || "",
      details: product.details || "",
      quantity_pricing: quantityPricingData
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
            <CardTitle>المنتجات</CardTitle>
            <Dialog open={open} onOpenChange={(isOpen) => {
              if (!isOpen) resetForm();
              else setOpen(isOpen);
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة منتج
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingProduct ? "تعديل منتج" : "إضافة منتج جديد"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">اسم المنتج</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">الوصف</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="category_id">القسم</Label>
                    <select
                      id="category_id"
                      value={formData.category_id}
                      onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background"
                    >
                      <option value="">بدون قسم</option>
                      {categories?.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <Label htmlFor="price">السعر (ج.م)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is_offer"
                      checked={formData.is_offer}
                      onCheckedChange={(checked) => setFormData({...formData, is_offer: checked})}
                    />
                    <Label htmlFor="is_offer">عرض خاص</Label>
                  </div>
                  
                  {formData.is_offer && (
                    <div>
                      <Label htmlFor="offer_price">سعر العرض (ج.م)</Label>
                      <Input
                        id="offer_price"
                        type="number"
                        step="0.01"
                        value={formData.offer_price}
                        onChange={(e) => setFormData({...formData, offer_price: e.target.value})}
                      />
                    </div>
                  )}
                  
                  <div>
                    <Label htmlFor="stock">الكمية المتاحة</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={formData.stock}
                      onChange={(e) => setFormData({...formData, stock: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="size_options">المقاسات المتاحة (مفصولة بفاصلة)</Label>
                    <Input
                      id="size_options"
                      value={formData.size_options}
                      onChange={(e) => setFormData({...formData, size_options: e.target.value})}
                      placeholder="S, M, L, XL"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="color_options">الألوان المتاحة (مفصولة بفاصلة)</Label>
                    <Input
                      id="color_options"
                      value={formData.color_options}
                      onChange={(e) => setFormData({...formData, color_options: e.target.value})}
                      placeholder="أحمر, أزرق, أخضر"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="details">تفاصيل المنتج</Label>
                    <Textarea
                      id="details"
                      value={formData.details}
                      onChange={(e) => setFormData({...formData, details: e.target.value})}
                      rows={3}
                      placeholder="معلومات إضافية عن المنتج..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>التسعير حسب الكمية (اختياري)</Label>
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 border rounded">
                      {formData.quantity_pricing.map((qp, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Label className="text-xs w-20">كمية {qp.quantity}:</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="السعر"
                            value={qp.price}
                            onChange={(e) => {
                              const newPricing = [...formData.quantity_pricing];
                              newPricing[index].price = e.target.value;
                              setFormData({...formData, quantity_pricing: newPricing});
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      حدد السعر لكل كمية (1-12 قطعة). اترك فارغاً لاستخدام السعر الأساسي.
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="image">صورة المنتج</Label>
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  
                  <Button type="submit" className="w-full">
                    {editingProduct ? "تحديث" : "إضافة"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {!products || products.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد منتجات</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map((product) => (
                  <Card key={product.id} className="overflow-hidden">
                    <div className="h-48 bg-muted relative">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Tag className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-bold mb-2 truncate">{product.name}</h3>
                      <p className="text-lg font-bold text-primary mb-2">
                        {parseFloat(product.price.toString()).toFixed(2)} ج.م
                      </p>
                      {product.is_offer && product.offer_price && (
                        <p className="text-sm text-destructive font-bold mb-2">
                          عرض: {parseFloat(product.offer_price.toString()).toFixed(2)} ج.م
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mb-4">
                        الكمية: {product.stock}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleEdit(product)}
                        >
                          <Edit className="h-4 w-4 ml-1" />
                          تعديل
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteMutation.mutate(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Products;
