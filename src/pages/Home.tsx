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
      image_url: product.image_url
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
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-8 shadow-lg">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-center">
            Magou Fashion
          </h1>
          <p className="text-center mt-2 text-primary-foreground/90">
            أفضل الأزياء العصرية
          </p>
        </div>
      </header>

      {/* Products Grid */}
      <div className="container mx-auto px-4 py-8">
        {!products || products.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-muted-foreground">
              لا توجد منتجات متاحة حالياً
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => {
              const hasOffer = product.is_offer && product.offer_price;
              const displayPrice = hasOffer ? product.offer_price : product.price;
              
              return (
                <Card key={product.id} className="group hover:shadow-xl transition-all duration-300 overflow-hidden">
                  {/* Product Image */}
                  <div className="relative h-72 bg-muted overflow-hidden">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Tag className="w-16 h-16 text-muted-foreground" />
                      </div>
                    )}
                    
                    {/* Offer Badge */}
                    {hasOffer && (
                      <Badge className="absolute top-3 right-3 bg-destructive text-destructive-foreground">
                        عرض خاص
                      </Badge>
                    )}
                    
                    {/* Stock Badge */}
                    {product.stock === 0 && (
                      <Badge className="absolute top-3 left-3 bg-muted text-muted-foreground">
                        نفذت الكمية
                      </Badge>
                    )}
                  </div>

                  {/* Product Info */}
                  <CardContent className="p-4">
                    <h3 className="font-bold text-lg mb-2 line-clamp-2">
                      {product.name}
                    </h3>
                    
                    {product.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {product.description}
                      </p>
                    )}
                    
                    {/* Price */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-2xl font-bold text-primary">
                        {parseFloat(displayPrice.toString()).toFixed(2)} ج.م
                      </span>
                      
                      {hasOffer && (
                        <span className="text-sm text-muted-foreground line-through">
                          {parseFloat(product.price.toString()).toFixed(2)} ج.م
                        </span>
                      )}
                    </div>
                  </CardContent>

                  {/* Add to Cart Button */}
                  <CardFooter className="p-4 pt-0">
                    <Button 
                      onClick={() => handleAddToCart(product)}
                      disabled={product.stock === 0}
                      className="w-full group-hover:scale-105 transition-transform"
                    >
                      <ShoppingCart className="ml-2 h-4 w-4" />
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
