import { useState } from "react";
import { useCart } from "@/hooks/useCart";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Cart = () => {
  const { items, removeItem, updateQuantity, updateItemDetails, clearCart } = useCart();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    address: "",
    governorate: "",
    notes: "",
    shippingCost: 0
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*");
      
      if (error) throw error;
      return data;
    },
  });

  const getProductPrice = (productId: string, quantity: number) => {
    const product = products?.find(p => p.id === productId);
    if (!product) return 0;

    // Check for quantity pricing
    if (product.quantity_pricing && Array.isArray(product.quantity_pricing) && product.quantity_pricing.length > 0) {
      const pricing = (product.quantity_pricing as Array<{ quantity: number; price: number }>)
        .filter((qp) => qp.quantity <= quantity)
        .sort((a, b) => b.quantity - a.quantity);
      
      if (pricing.length > 0) {
        return parseFloat(pricing[0].price.toString());
      }
    }

    // Check for offer price
    if (product.is_offer && product.offer_price) {
      return parseFloat(product.offer_price.toString());
    }

    return parseFloat(product.price.toString());
  };

  const getTotalPrice = () => {
    return items.reduce((sum, item) => {
      const price = getProductPrice(item.id, item.quantity);
      return sum + (price * item.quantity);
    }, 0);
  };

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

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_id: customer.id,
          total_amount: getTotalPrice(),
          shipping_cost: customerInfo.shippingCost,
          notes: customerInfo.notes,
          status: "pending"
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = items.map(item => {
        const price = getProductPrice(item.id, item.quantity);
        
        return {
          order_id: order.id,
          product_id: item.id,
          quantity: item.quantity,
          price: price,
          size: item.size || null,
          color: item.color || null,
          product_details: item.details || null
        };
      });

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
        notes: "",
        shippingCost: 0
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
      <div className="container mx-auto px-4 max-w-6xl">
        <Button onClick={() => navigate("/")} variant="ghost" className="mb-4 text-lg">
          <ArrowLeft className="ml-2 h-5 w-5" />
          الرجوع للمتجر
        </Button>
        <h1 className="text-4xl font-bold mb-8 text-center">فاتورة الطلب</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-6">
            {items.map((item) => (
              <Card key={item.id} className="shadow-lg border-2">
                <CardContent className="p-8">
                  <div className="flex gap-6">
                    {/* Product Image */}
                    <div className="w-32 h-32 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                      {item.image_url ? (
                        <img 
                          src={item.image_url} 
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="flex-1">
                      <h3 className="font-bold text-2xl mb-3">{item.name}</h3>
                      <p className="text-primary font-bold text-2xl mb-4">
                        {getProductPrice(item.id, item.quantity).toFixed(2)} ج.م / قطعة
                      </p>
                      <p className="text-lg font-semibold mb-4">
                        الإجمالي: {(getProductPrice(item.id, item.quantity) * item.quantity).toFixed(2)} ج.م
                      </p>

                      {/* Size and Color Selectors */}
                      {item.details && (
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div>
                            <Label className="text-base font-semibold mb-2 block">المقاس</Label>
                            {(() => {
                              const product = products?.find(p => p.id === item.id);
                              return product?.size_options && product.size_options.length > 0 ? (
                                <Select
                                  value={item.size || ""}
                                  onValueChange={(value) => updateItemDetails(item.id, value, item.color)}
                                >
                                  <SelectTrigger className="h-12">
                                    <SelectValue placeholder="اختر المقاس" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {product.size_options.map((size) => (
                                      <SelectItem key={size} value={size}>
                                        {size}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  value={item.size || ""}
                                  onChange={(e) => updateItemDetails(item.id, e.target.value, item.color)}
                                  placeholder="المقاس"
                                  className="h-12 text-base"
                                />
                              );
                            })()}
                          </div>
                          <div>
                            <Label className="text-base font-semibold mb-2 block">اللون</Label>
                            {(() => {
                              const product = products?.find(p => p.id === item.id);
                              return product?.color_options && product.color_options.length > 0 ? (
                                <Select
                                  value={item.color || ""}
                                  onValueChange={(value) => updateItemDetails(item.id, item.size, value)}
                                >
                                  <SelectTrigger className="h-12">
                                    <SelectValue placeholder="اختر اللون" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {product.color_options.map((color) => (
                                      <SelectItem key={color} value={color}>
                                        {color}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  value={item.color || ""}
                                  onChange={(e) => updateItemDetails(item.id, item.size, e.target.value)}
                                  placeholder="اللون"
                                  className="h-12 text-base"
                                />
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-3 mt-4">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="h-12 w-12"
                        >
                          <Minus className="h-5 w-5" />
                        </Button>
                        <span className="w-16 text-center font-bold text-xl">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="h-12 w-12"
                        >
                          <Plus className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => removeItem(item.id)}
                          className="mr-auto h-12 w-12"
                        >
                          <Trash2 className="h-5 w-5" />
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
            <Card className="sticky top-4 shadow-xl border-2">
              <CardHeader className="bg-primary/5">
                <CardTitle className="text-2xl">معلومات التوصيل</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div>
                  <Label htmlFor="name" className="text-base font-semibold mb-2 block">الاسم *</Label>
                  <Input
                    id="name"
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                    placeholder="أدخل اسمك"
                    className="h-12 text-base"
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-base font-semibold mb-2 block">رقم الهاتف *</Label>
                  <Input
                    id="phone"
                    value={customerInfo.phone}
                    onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                    placeholder="01XXXXXXXXX"
                    className="h-12 text-base"
                  />
                </div>

                <div>
                  <Label htmlFor="governorate" className="text-base font-semibold mb-2 block">المحافظة</Label>
                  <Input
                    id="governorate"
                    value={customerInfo.governorate}
                    onChange={(e) => setCustomerInfo({...customerInfo, governorate: e.target.value})}
                    placeholder="القاهرة، الإسكندرية..."
                    className="h-12 text-base"
                  />
                </div>

                <div>
                  <Label htmlFor="address" className="text-base font-semibold mb-2 block">العنوان بالتفصيل *</Label>
                  <Textarea
                    id="address"
                    value={customerInfo.address}
                    onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})}
                    placeholder="الشارع، المنطقة، العمارة..."
                    rows={3}
                    className="text-base"
                  />
                </div>

                <div>
                  <Label htmlFor="notes" className="text-base font-semibold mb-2 block">ملاحظات</Label>
                  <Textarea
                    id="notes"
                    value={customerInfo.notes}
                    onChange={(e) => setCustomerInfo({...customerInfo, notes: e.target.value})}
                    placeholder="ملاحظات إضافية (اختياري)"
                    rows={2}
                    className="text-base"
                  />
                </div>

                <div>
                  <Label htmlFor="shipping" className="text-base font-semibold mb-2 block">شحن العميل</Label>
                  <Input
                    id="shipping"
                    type="number"
                    value={customerInfo.shippingCost}
                    onChange={(e) => setCustomerInfo({...customerInfo, shippingCost: Number(e.target.value) || 0})}
                    placeholder="0"
                    min="0"
                    className="h-12 text-base"
                  />
                </div>

                {/* Total */}
                <div className="border-t-2 pt-6 bg-primary/5 -mx-6 px-6 pb-2">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-lg">
                      <span>المنتجات:</span>
                      <span>{getTotalPrice().toFixed(2)} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center text-lg">
                      <span>الشحن:</span>
                      <span>{customerInfo.shippingCost.toFixed(2)} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center text-2xl font-bold border-t pt-2">
                      <span>الإجمالي:</span>
                      <span className="text-primary">{(getTotalPrice() + customerInfo.shippingCost).toFixed(2)} ج.م</span>
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-2">
                <Button 
                  onClick={handleSubmitOrder} 
                  disabled={loading}
                  className="w-full text-lg py-6"
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