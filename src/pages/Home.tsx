import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Tag } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";

const Home = () => {
  const { addItem } = useCart();
  
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

  const handleAddToCart = (product: any) => {
    const price = product.is_offer && product.offer_price 
      ? parseFloat(product.offer_price.toString())
      : parseFloat(product.price.toString());
    
    addItem({
      id: product.id,
      name: product.name,
      price: price,
      image_url: product.image_url,
      details: product.details
    });
    
    toast.success("تم إضافة المنتج إلى السلة");
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-64 bg-muted" />
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded mb-2" />
                <div className="h-3 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="gradient-primary text-primary-foreground py-12 shadow-glow relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/images/magou-bg.jpg')] opacity-10 mix-blend-overlay"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex items-center justify-center gap-4 mb-3">
            <img src="/images/magou-logo.jpg" alt="Magou Fashion" className="h-16 w-16 rounded-full shadow-lg" />
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              Magou Fashion
            </h1>
          </div>
          <p className="text-center text-lg text-primary-foreground/95 font-medium">
            ✨ أناقة لا مثيل لها - أزياء عصرية تناسب ذوقك الرفيع
          </p>
        </div>
      </header>

      {/* Products Grid */}
      <div className="container mx-auto px-4 py-12">
        {!products || products.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-muted-foreground">
              لا توجد منتجات متاحة حالياً
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {products.map((product) => {
              const hasOffer = product.is_offer && product.offer_price;
              const displayPrice = hasOffer ? product.offer_price : product.price;
              
              return (
                <Card key={product.id} className="group hover:shadow-glow transition-all duration-500 overflow-hidden border-2 border-border/50 hover:border-primary/50 bg-card/80 backdrop-blur-sm">
                  {/* Product Image */}
                  <div className="relative h-80 bg-gradient-to-br from-muted to-muted/50 overflow-hidden">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 group-hover:rotate-2 transition-all duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Tag className="w-20 h-20 text-muted-foreground/50" />
                      </div>
                    )}
                    
                    {/* Badges */}
                    <div className="absolute top-3 right-3 flex flex-col gap-2">
                      {hasOffer && (
                        <Badge className="gradient-primary text-white shadow-lg animate-pulse px-3 py-1">
                          🔥 عرض خاص
                        </Badge>
                      )}
                      {product.stock === 0 && (
                        <Badge className="bg-destructive/90 text-white shadow-lg px-3 py-1">
                          نفذت الكمية
                        </Badge>
                      )}
                    </div>
                    
                    {/* Overlay on Hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>

                  {/* Product Info */}
                  <CardContent className="p-5">
                    <h3 className="font-bold text-xl mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                    
                    {product.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {product.description}
                      </p>
                    )}
                    
                    {/* Price */}
                    <div className="flex items-baseline gap-3 flex-wrap mb-4">
                      <span className="text-3xl font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                        {parseFloat(displayPrice.toString()).toFixed(2)}
                      </span>
                      <span className="text-lg font-semibold text-foreground">ج.م</span>
                      
                      {hasOffer && (
                        <span className="text-base text-muted-foreground line-through decoration-destructive decoration-2">
                          {parseFloat(product.price.toString()).toFixed(2)} ج.م
                        </span>
                      )}
                    </div>
                  </CardContent>

                  {/* Add to Cart Button */}
                  <CardFooter className="p-5 pt-0">
                    <Button 
                      onClick={() => handleAddToCart(product)}
                      disabled={product.stock === 0}
                      className="w-full gradient-primary text-white font-bold text-base py-6 rounded-xl shadow-lg hover:shadow-glow hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ShoppingCart className="ml-2 h-5 w-5" />
                      إضافة للسلة
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;