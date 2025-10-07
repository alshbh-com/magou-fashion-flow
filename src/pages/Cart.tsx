import { useState } from "react";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Cart = () => {
  const { items, removeItem, updateQuantity, clearCart, getTotalPrice } = useCart();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    address: "",
    governorate: "",
    notes: ""
  });

  const handleSubmitOrder = async () => {
    if (!customerInfo.name || !customerInfo.phone || !customerInfo.address) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    if (items.length === 0) {
      toast.error("السلة فارغة");
      return;
    }

    setLoading(true);

    try {
      // Create customer
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          name: customerInfo.name,
          phone: customerInfo.phone,
          address: customerInfo.address,
          governorate: customerInfo.governorate
        })
        .select()
        .single();

      if (customerError) throw customerError;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_id: customer.id,
          total_amount: getTotalPrice(),
          notes: customerInfo.notes,
          status: "pending"
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.id,
        quantity: item.quantity,
        price: item.price
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      toast.success("تم إرسال الطلب بنجاح!");
      clearCart();
      setCustomerInfo({
        name: "",
        phone: "",
        address: "",
        governorate: "",
        notes: ""
      });
      
    } catch (error: any) {
      console.error("Error submitting order:", error);
      toast.error("حدث خطأ أثناء إرسال الطلب");
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 flex items-center justify-center">
        <div className="text-center">
          <ShoppingBag className="w-24 h-24 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">السلة فارغة</h2>
          <p className="text-muted-foreground mb-6">أضف بعض المنتجات للبدء</p>
          <Button onClick={() => navigate("/")}>تصفح المنتجات</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8">السلة</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    {/* Product Image */}
                    <div className="w-24 h-24 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                      {item.image_url ? (
                        <img 
                          src={item.image_url} 
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-2">{item.name}</h3>
                      <p className="text-primary font-bold text-xl">
                        {item.price.toFixed(2)} ج.م
                      </p>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-12 text-center font-bold">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => removeItem(item.id)}
                          className="mr-auto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Order Form */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>معلومات التوصيل</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">الاسم *</Label>
                  <Input
                    id="name"
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                    placeholder="أدخل اسمك"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">رقم الهاتف *</Label>
                  <Input
                    id="phone"
                    value={customerInfo.phone}
                    onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                    placeholder="01XXXXXXXXX"
                  />
                </div>

                <div>
                  <Label htmlFor="governorate">المحافظة</Label>
                  <Input
                    id="governorate"
                    value={customerInfo.governorate}
                    onChange={(e) => setCustomerInfo({...customerInfo, governorate: e.target.value})}
                    placeholder="القاهرة، الإسكندرية..."
                  />
                </div>

                <div>
                  <Label htmlFor="address">العنوان بالتفصيل *</Label>
                  <Textarea
                    id="address"
                    value={customerInfo.address}
                    onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})}
                    placeholder="الشارع، المنطقة، العمارة..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="notes">ملاحظات</Label>
                  <Textarea
                    id="notes"
                    value={customerInfo.notes}
                    onChange={(e) => setCustomerInfo({...customerInfo, notes: e.target.value})}
                    placeholder="ملاحظات إضافية (اختياري)"
                    rows={2}
                  />
                </div>

                {/* Total */}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center text-xl font-bold">
                    <span>الإجمالي:</span>
                    <span className="text-primary">{getTotalPrice().toFixed(2)} ج.م</span>
                  </div>
                </div>
              </CardContent>

              <CardFooter>
                <Button 
                  onClick={handleSubmitOrder} 
                  disabled={loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? "جاري الإرسال..." : "تأكيد الطلب"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
