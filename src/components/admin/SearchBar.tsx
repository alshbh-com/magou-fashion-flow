import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const SearchBar = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<{
    orders: any[];
    customers: any[];
  }>({ orders: [], customers: [] });

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("الرجاء إدخال رقم هاتف أو رقم أوردر");
      return;
    }

    setIsSearching(true);
    try {
      // البحث في العملاء برقم الهاتف
      const { data: customers, error: customersError } = await supabase
        .from("customers")
        .select("*")
        .ilike("phone", `%${searchQuery}%`);

      if (customersError) throw customersError;

      // البحث في الأوردرات برقم الأوردر أو رقم هاتف العميل
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select(`
          *,
          customers (name, phone, address),
          delivery_agents (name, serial_number),
          order_items (
            *,
            products (name, price)
          )
        `)
        .or(`id.ilike.%${searchQuery}%,customers.phone.ilike.%${searchQuery}%`);

      if (ordersError) {
        // إذا فشل البحث المركب، نبحث فقط في معرف الأوردر
        const { data: ordersByIdOnly, error: ordersIdError } = await supabase
          .from("orders")
          .select(`
            *,
            customers (name, phone, address),
            delivery_agents (name, serial_number),
            order_items (
              *,
              products (name, price)
            )
          `)
          .ilike("id", `%${searchQuery}%`);

        if (ordersIdError) throw ordersIdError;

        // البحث في الأوردرات بناءً على معرفات العملاء المطابقة
        const customerIds = customers?.map(c => c.id) || [];
        let ordersByCustomer: any[] = [];
        
        if (customerIds.length > 0) {
          const { data: custOrders, error: custOrdersError } = await supabase
            .from("orders")
            .select(`
              *,
              customers (name, phone, address),
              delivery_agents (name, serial_number),
              order_items (
                *,
                products (name, price)
              )
            `)
            .in("customer_id", customerIds);

          if (!custOrdersError) {
            ordersByCustomer = custOrders || [];
          }
        }

        // دمج النتائج
        const allOrders = [...(ordersByIdOnly || []), ...ordersByCustomer];
        const uniqueOrders = allOrders.filter((order, index, self) =>
          index === self.findIndex((o) => o.id === order.id)
        );

        setResults({
          orders: uniqueOrders,
          customers: customers || []
        });
      } else {
        setResults({
          orders: orders || [],
          customers: customers || []
        });
      }

      setShowResults(true);
    } catch (error) {
      console.error("خطأ في البحث:", error);
      toast.error("حدث خطأ أثناء البحث");
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setResults({ orders: [], customers: [] });
    setShowResults(false);
  };

  const statusLabels: Record<string, string> = {
    pending: "قيد الانتظار",
    processing: "قيد التنفيذ",
    shipped: "تم الشحن",
    delivered: "تم التوصيل",
    cancelled: "ملغي"
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500",
    processing: "bg-blue-500",
    shipped: "bg-purple-500",
    delivered: "bg-green-500",
    cancelled: "bg-red-500"
  };

  return (
    <>
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Input
            placeholder="ابحث برقم الهاتف أو رقم الأوردر..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pl-10"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6"
              onClick={clearSearch}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button onClick={handleSearch} disabled={isSearching}>
          {isSearching ? "جاري البحث..." : "بحث"}
        </Button>
      </div>

      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>نتائج البحث</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {results.customers.length > 0 && (
              <div>
                <h3 className="text-lg font-bold mb-3">العملاء ({results.customers.length})</h3>
                <div className="space-y-2">
                  {results.customers.map((customer) => (
                    <Card key={customer.id} className="cursor-pointer hover:bg-accent" onClick={() => {
                      navigate("/admin/customers");
                      setShowResults(false);
                    }}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold">{customer.name}</p>
                            <p className="text-sm text-muted-foreground">{customer.phone}</p>
                            <p className="text-sm">{customer.address}</p>
                          </div>
                          <Badge variant="outline">{customer.governorate || "-"}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {results.orders.length > 0 && (
              <div>
                <h3 className="text-lg font-bold mb-3">الأوردرات ({results.orders.length})</h3>
                <div className="space-y-2">
                  {results.orders.map((order) => (
                    <Card key={order.id} className="cursor-pointer hover:bg-accent" onClick={() => {
                      navigate("/admin/orders");
                      setShowResults(false);
                    }}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-mono text-xs text-muted-foreground mb-1">
                              {order.id.slice(0, 8)}...
                            </p>
                            <p className="font-bold">{order.customers?.name}</p>
                            <p className="text-sm text-muted-foreground">{order.customers?.phone}</p>
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-lg">
                              {parseFloat(order.total_amount.toString()).toFixed(2)} ج.م
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className={`w-2 h-2 rounded-full ${statusColors[order.status]}`} />
                              <span className="text-sm">{statusLabels[order.status]}</span>
                            </div>
                          </div>
                        </div>
                        {order.delivery_agents && (
                          <Badge variant="outline" className="mt-2">
                            المندوب: {order.delivery_agents.name}
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {results.customers.length === 0 && results.orders.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                لم يتم العثور على نتائج
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SearchBar;
