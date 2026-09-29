import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PrefetchLink } from "@/components/PrefetchLink";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Eye } from "lucide-react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { WishlistButton } from "@/components/WishlistButton";
import { CompareButton } from "@/components/product/CompareButton";
import { ProductQuickView } from "@/components/product/ProductQuickView";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { trackEvent } from "@/lib/analytics";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    stock?: number | null;
    category?: string | null;
    description?: string | null;
  };
  badge?: React.ReactNode;
}

export function ProductCard({ product, badge }: ProductCardProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [quickViewOpen, setQuickViewOpen] = useState(false);

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { navigate("/auth"); return; }

    const userId = session.user.id;
    const { data: existing } = await supabase
      .from("cart")
      .select("*")
      .eq("user_id", userId)
      .eq("product_id", product.id)
      .maybeSingle();

    if (existing) {
      await supabase.from("cart").update({ quantity: (existing.quantity || 1) + 1 }).eq("id", existing.id);
    } else {
      await supabase.from("cart").insert({ user_id: userId, product_id: product.id, quantity: 1 });
    }

    queryClient.invalidateQueries({ queryKey: ["cart"] });
    void trackEvent("add_to_cart", {
      product_id: product.id,
      name: product.name,
      price: product.price,
      source: "product_card",
    });
    toast({ title: "Added to cart", description: `${product.name} added successfully` });
  };

  return (
    <>
      <PrefetchLink to={`/products/${product.id}`} className="group block h-full">
        <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border-border/50 hover:border-primary/30 h-full hover:-translate-y-1.5 relative group/card">
          {/* Match the Products page image treatment: fixed square frame + cover image. */}
          <div className="aspect-square overflow-hidden bg-muted relative">
            <OptimizedImage
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
              width={500}
              height={500}
              responsiveWidths={[300, 500, 700]}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
            {badge}
            <div className="product-card-actions absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-foreground/60 to-transparent flex items-end justify-center gap-2">
              <Button
                size="sm"
                onClick={handleQuickAdd}
                className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
                disabled={(product.stock ?? 0) <= 0}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Add to Cart
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5 text-xs shadow-lg"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setQuickViewOpen(true);
                }}
              >
                <Eye className="h-3.5 w-3.5" />
                Quick View
              </Button>
            </div>
            <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5" onClick={(e) => e.preventDefault()}>
              <WishlistButton productId={product.id} />
              <CompareButton productId={product.id} />
            </div>
          </div>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-1 line-clamp-2 group-hover:text-primary transition-colors">
              {product.name}
            </h3>
            <div className="flex items-baseline justify-between mt-2">
              <p className="text-2xl font-bold text-primary">₹{product.price.toFixed(0)}</p>
              {product.stock != null && product.stock > 0 ? (
                <span className="text-xs text-muted-foreground">In Stock</span>
              ) : (
                <span className="text-xs text-destructive font-medium">Out of Stock</span>
              )}
            </div>
          </CardContent>
        </Card>
      </PrefetchLink>
      <ProductQuickView product={product} open={quickViewOpen} onOpenChange={setQuickViewOpen} />
    </>
  );
}
