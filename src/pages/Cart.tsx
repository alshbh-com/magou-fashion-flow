import { useState, useEffect } from "react";
import { useCart } from "@/hooks/useCart";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft, Check, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

const Cart = () => {
  const { items, removeItem, updateQuantity, updateItemDetails, clearCart, addItem } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [isReturnOrder, setIsReturnOrder] = useState(false);
  const [returnOrderId, setReturnOrderId] = useState<string | null>(null);
  const [returnOrderNumber, setReturnOrderNumber] = useState<number | null>(null);
  const [returnOrderDate, setReturnOrderDate] = useState<string | null>(null);
  const [governorateOpen, setGovernorateOpen] = useState(false);
  
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    phone2: "",
    address: "",
    governorate: "",
    notes: "",
    shippingCost: 0,
    discount: 0,
    orderDetails: ""
  });

  // دالة لتحويل الأرقام العربية إلى إنجليزية
  const convertArabicToEnglishNumbers = (str: string) => {
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const englishNumbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    
    return str.split('').map(char => {
      const index = arabicNumbers.indexOf(char);
      return index !== -1 ? englishNumbers[index] : char;
    }).join('');
  };

  // Load return order data if navigated from AgentOrders
  useEffect(() => {
    const state = location.state as any;
    if (state?.returnOrder && state?.isReturn) {
      const order = state.returnOrder;
      setIsReturnOrder(true);
      setReturnOrderId(order.id);
      setReturnOrderNumber(order.order_number);
      setReturnOrderDate(order.created_at);
      
      // Clear cart and add order items
      clearCart();
      order.order_items?.forEach((item: any) => {
        addItem({
          id: item.product_id,
          name: item.products?.name || '',
          price: parseFloat(item.price?.toString() || "0"),
          image_url: item.products?.image_url,
          size: item.size,
          color: item.color,
          details: item.product_details
        });
        // Set correct quantity
        updateQuantity(item.product_id, item.quantity);
      });

      // Set customer info
      setCustomerInfo({
        name: order.customers?.name || "",
        phone: order.customers?.phone || "",
        phone2: order.customers?.phone2 || "",
        address: order.customers?.address || "",
        governorate: order.customers?.governorate || "",
        notes: order.notes || "",
        shippingCost: parseFloat(order.shipping_cost?.toString() || "0"),
        discount: parseFloat(order.discount?.toString() || "0"),
        orderDetails: order.order_details || ""
      });
    }
  }, [location.state]);

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

  const { data: governorates } = useQuery({
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
    const itemsTotal = items.reduce((sum, item) => {
      const price = getProductPrice(item.id, item.quantity);
      return sum + (price * item.quantity);
    }, 0);
    return itemsTotal - customerInfo.discount;
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
      if (isReturnOrder && returnOrderId) {
        // Update existing order
        const { error: orderError } = await supabase
          .from("orders")
          .update({
            total_amount: getTotalPrice(),
            shipping_cost: customerInfo.shippingCost,
            discount: customerInfo.discount,
            order_details: customerInfo.orderDetails || null,
            notes: customerInfo.notes,
          })
          .eq("id", returnOrderId);

        if (orderError) throw orderError;

        // Delete old order items
        const { error: deleteError } = await supabase
          .from("order_items")
          .delete()
          .eq("order_id", returnOrderId);

        if (deleteError) throw deleteError;

        // Insert new order items
        const orderItems = items.map(item => {
          const price = getProductPrice(item.id, item.quantity);
          
          return {
            order_id: returnOrderId,
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

        toast.success("تم تحديث الأوردر بنجاح!");
        clearCart();
        setIsReturnOrder(false);
        setReturnOrderId(null);
        navigate('/admin/agent-orders');
      } else {
        // Create new order
        const { data: customer, error: customerError } = await supabase
          .from("customers")
          .insert({
            name: customerInfo.name,
            phone: customerInfo.phone,
            phone2: customerInfo.phone2 || null,
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
            discount: customerInfo.discount,
            order_details: customerInfo.orderDetails || null,
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
          phone2: "",
          address: "",
          governorate: "",
          notes: "",
          shippingCost: 0,
          discount: 0,
          orderDetails: ""
        });
      }
      
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
        <h1 className="text-4xl font-bold mb-8 text-center">
          {isReturnOrder ? `تعديل الأوردر #${returnOrderNumber}` : 'فاتورة الطلب'}
        </h1>
        {isReturnOrder && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4 text-center">
            <p className="font-bold">تعديل أوردر مرتجع</p>
            <p className="text-sm">سيتم تحديث الأوردر بنفس الرقم ({returnOrderNumber}) والتاريخ ({new Date(returnOrderDate!).toLocaleDateString('ar-EG')})</p>
          </div>
        )}

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
                    autoComplete="off"
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-base font-semibold mb-2 block">رقم الهاتف *</Label>
                  <Input
                    id="phone"
                    value={customerInfo.phone}
                    onChange={(e) => {
                      const convertedValue = convertArabicToEnglishNumbers(e.target.value);
                      setCustomerInfo({...customerInfo, phone: convertedValue});
                    }}
                    placeholder="01XXXXXXXXX"
                    className="h-12 text-base"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <Label htmlFor="phone2" className="text-base font-semibold mb-2 block">رقم هاتف إضافي (اختياري)</Label>
                  <Input
                    id="phone2"
                    value={customerInfo.phone2}
                    onChange={(e) => {
                      const convertedValue = convertArabicToEnglishNumbers(e.target.value);
                      setCustomerInfo({...customerInfo, phone2: convertedValue});
                    }}
                    placeholder="01XXXXXXXXX"
                    className="h-12 text-base"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <Label htmlFor="governorate" className="text-base font-semibold mb-2 block">المحافظة *</Label>
                  <Popover open={governorateOpen} onOpenChange={setGovernorateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={governorateOpen}
                        className="w-full h-12 justify-between"
                      >
                        {customerInfo.governorate
                          ? `${customerInfo.governorate} - ${customerInfo.shippingCost.toFixed(2)} ج.م شحن`
                          : "اختر المحافظة"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="ابحث عن محافظة..." />
                        <CommandList>
                          <CommandEmpty>لم يتم العثور على محافظة.</CommandEmpty>
                          <CommandGroup>
                            {governorates?.map((gov) => (
                              <CommandItem
                                key={gov.id}
                                value={gov.name}
                                onSelect={(currentValue) => {
                                  const selectedGov = governorates.find(g => g.name.toLowerCase() === currentValue.toLowerCase());
                                  if (selectedGov) {
                                    const shippingCost = parseFloat(selectedGov.shipping_cost.toString());
                                    setCustomerInfo({
                                      ...customerInfo,
                                      governorate: selectedGov.name,
                                      shippingCost: shippingCost
                                    });
                                  }
                                  setGovernorateOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    customerInfo.governorate === gov.name ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {gov.name} - {parseFloat(gov.shipping_cost.toString()).toFixed(2)} ج.م شحن
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
                    autoComplete="off"
                  />
                </div>

                <div>
                  <Label htmlFor="orderDetails" className="text-base font-semibold mb-2 block">تفاصيل الأوردر (اختياري)</Label>
                  <Textarea
                    id="orderDetails"
                    value={customerInfo.orderDetails}
                    onChange={(e) => setCustomerInfo({...customerInfo, orderDetails: e.target.value})}
                    placeholder="أي تفاصيل خاصة بالأوردر..."
                    rows={2}
                    className="text-base"
                    autoComplete="off"
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
                    autoComplete="off"
                  />
                </div>

                <div>
                  <Label htmlFor="shippingCost" className="text-base font-semibold mb-2 block">شحن العميل</Label>
                  <Input
                    id="shippingCost"
                    type="number"
                    value={customerInfo.shippingCost}
                    onChange={(e) => setCustomerInfo({...customerInfo, shippingCost: Number(e.target.value) || 0})}
                    placeholder="0"
                    min="0"
                    className="h-12 text-base"
                    disabled
                  />
                </div>

                <div>
                  <Label htmlFor="discount" className="text-base font-semibold mb-2 block">الخصم (اختياري)</Label>
                  <Input
                    id="discount"
                    type="number"
                    value={customerInfo.discount || ""}
                    onChange={(e) => {
                      const convertedValue = convertArabicToEnglishNumbers(e.target.value);
                      setCustomerInfo({...customerInfo, discount: Number(convertedValue) || 0});
                    }}
                    placeholder="مثال: 50"
                    min="0"
                    className="h-12 text-base"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <Label htmlFor="shipping" className="text-base font-semibold mb-2 block">شحن العميل (اختياري)</Label>
                  <Input
                    id="shipping"
                    type="number"
                    value={customerInfo.shippingCost || ""}
                    onChange={(e) => {
                      const convertedValue = convertArabicToEnglishNumbers(e.target.value);
                      setCustomerInfo({...customerInfo, shippingCost: Number(convertedValue) || 0});
                    }}
                    placeholder="مثال: 30"
                    min="0"
                    className="h-12 text-base"
                    autoComplete="off"
                  />
                </div>

                {/* Total */}
                <div className="border-t-2 pt-6 bg-primary/5 -mx-6 px-6 pb-2">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-lg">
                      <span>المنتجات:</span>
                      <span>{items.reduce((sum, item) => sum + (getProductPrice(item.id, item.quantity) * item.quantity), 0).toFixed(2)} ج.م</span>
                    </div>
                    {customerInfo.discount > 0 && (
                      <div className="flex justify-between items-center text-lg text-green-600">
                        <span>الخصم:</span>
                        <span>- {customerInfo.discount.toFixed(2)} ج.م</span>
                      </div>
                    )}
                    {customerInfo.shippingCost > 0 && (
                      <div className="flex justify-between items-center text-lg">
                        <span>الشحن:</span>
                        <span>{customerInfo.shippingCost.toFixed(2)} ج.م</span>
                      </div>
                    )}
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