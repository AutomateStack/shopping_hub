import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { ProductImageGallery } from "@/components/product/ProductImageGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { ProductTrustBadges } from "@/components/product/ProductTrustBadges";
import { ProductDetailTabs } from "@/components/product/ProductDetailTabs";
import { RelatedProducts } from "@/components/product/RelatedProducts";
import { ProductVariantSelector } from "@/components/product/ProductVariantSelector";
import { ProductShareButtons } from "@/components/product/ProductShareButtons";
import { CompareButton } from "@/components/product/CompareButton";
import { PriceDropAlert } from "@/components/product/PriceDropAlert";
import { RecentlyViewed } from "@/components/product/RecentlyViewed";
import { AIRecommendations } from "@/components/product/AIRecommendations";
import { FrequentlyBoughtTogether } from "@/components/product/FrequentlyBoughtTogether";
import { StickyAddToCartBar } from "@/components/product/StickyAddToCartBar";
import { SEOHead } from "@/components/SEOHead";
import { Footer } from "@/components/home/Footer";
import { trackEvent, startDwellTimer } from "@/lib/analytics";
import { recordCategoryView } from "@/lib/affinity";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(1);
  const [user, setUser] = useState<any>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [variantPriceAdjustments, setVariantPriceAdjustments] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fire `view_product` once per product load + measure dwell time
  useEffect(() => {
    if (!product?.id) return;
    void trackEvent("view_product", {
      product_id: product.id,
      product_name: product.name,
      name: product.name,
      price: product.price,
      category: product.category,
    });
    recordCategoryView(product.category);
    const stop = startDwellTimer({ product_id: product.id, product_name: product.name });
    return stop;
  }, [product?.id, product?.name, product?.price, product?.category]);

  const { data: orderConfig } = useQuery({
    queryKey: ["product-order-config", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("shoppinghub_marketplace_map" as any).select("whatsapp_url, wholesale_enabled, wholesale_pricing").eq("product_id", id).eq("enabled", true).maybeSingle();
      if (error) throw error;
      return data as { whatsapp_url: string | null; wholesale_enabled: boolean; wholesale_pricing: Array<{ min_quantity: number; max_quantity?: number | null; unit_price: number }> | null } | null;
    },
    enabled: !!id,
  });

  const { data: reviewStats } = useQuery({
    queryKey: ["product-review-stats", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_reviews")
        .select("rating")
        .eq("product_id", id!);
      if (error) throw error;
      const total = data.length;
      const avg = total > 0 ? data.reduce((sum, r) => sum + r.rating, 0) / total : 0;
      return { averageRating: avg, totalReviews: total };
    },
    enabled: !!id,
  });

  // Latest reviews for SEO snippets (Review schema items)
  const { data: recentReviews } = useQuery({
    queryKey: ["product-recent-reviews", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_reviews")
        .select("rating, comment, reviewer_name, created_at")
        .eq("product_id", id!)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const handleVariantChange = (type: string, value: string, priceAdj: number) => {
    setSelectedVariants(prev => ({ ...prev, [type]: value }));
    setVariantPriceAdjustments(prev => ({ ...prev, [type]: priceAdj }));
  };

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      if (!user) { navigate("/auth"); return; }
      const { data: existing } = await supabase
        .from("cart")
        .select("*")
        .eq("user_id", user.id)
        .eq("product_id", id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("cart")
          .update({ quantity: existing.quantity + quantity })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cart")
          .insert({ user_id: user.id, product_id: id, quantity });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast({ title: "Added to cart", description: `${quantity} item(s) added successfully` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add item to cart", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container px-4 py-8">
          <div className="grid lg:grid-cols-2 gap-10">
            <div className="space-y-4">
              <div className="aspect-square bg-muted animate-pulse rounded-2xl" />
              <div className="flex gap-3">
                {[1, 2, 3].map(i => <div key={i} className="w-20 h-20 bg-muted animate-pulse rounded-xl" />)}
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-5 bg-muted animate-pulse rounded w-1/3" />
              <div className="h-8 bg-muted animate-pulse rounded w-3/4" />
              <div className="h-10 bg-muted animate-pulse rounded w-1/3" />
              <div className="h-24 bg-muted animate-pulse rounded" />
              <div className="h-12 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4 text-foreground">Product not found</h1>
          <Button onClick={() => navigate("/products")}>Back to Products</Button>
        </div>
      </div>
    );
  }

  const effectivePrice = product.price + Object.values(variantPriceAdjustments).reduce((total, adjustment) => total + adjustment, 0);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <SEOHead
        title={`${product.name} — Buy Online at ShopHub`}
        description={product.description || `Buy ${product.name} at the best price on ShopHub. Fast delivery, secure payments & easy returns.`}
        canonical={`/products/${product.id}`}
        image={product.image_url || undefined}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.name,
            description: product.description || "",
            image: product.image_url || "",
            sku: product.id,
            mpn: product.id,
            brand: { "@type": "Brand", name: "ShopHub" },
            category: product.category || undefined,
            offers: {
              "@type": "Offer",
              url: `https://shopshub.lovable.app/products/${product.id}`,
              price: effectivePrice,
              priceCurrency: "INR",
              itemCondition: "https://schema.org/NewCondition",
              availability: (product.stock ?? 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              seller: { "@type": "Organization", name: "ShopHub" },
            },
            ...(reviewStats && reviewStats.totalReviews > 0
              ? {
                  aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: reviewStats.averageRating.toFixed(1),
                    reviewCount: reviewStats.totalReviews,
                    bestRating: 5,
                    worstRating: 1,
                  },
                }
              : {}),
            ...(recentReviews && recentReviews.length > 0
              ? {
                  review: recentReviews.map((r: any) => ({
                    "@type": "Review",
                    reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
                    author: { "@type": "Person", name: r.reviewer_name || "Customer" },
                    datePublished: r.created_at,
                    reviewBody: r.comment || "",
                  })),
                }
              : {}),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://shopshub.lovable.app/" },
              { "@type": "ListItem", position: 2, name: "Products", item: "https://shopshub.lovable.app/products" },
              { "@type": "ListItem", position: 3, name: product.name },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              { "@type": "Question", name: "Is this product genuine?", acceptedAnswer: { "@type": "Answer", text: "Yes, all products on ShopHub are 100% genuine and sourced directly from authorized distributors." } },
              { "@type": "Question", name: "What is the return policy?", acceptedAnswer: { "@type": "Answer", text: "We offer a 7-day easy return policy. If you're not satisfied, you can return the product in its original condition." } },
              { "@type": "Question", name: "How long does delivery take?", acceptedAnswer: { "@type": "Answer", text: "Standard delivery takes 3-7 business days depending on your location. Express delivery is available in select cities." } },
              { "@type": "Question", name: "Is Cash on Delivery available?", acceptedAnswer: { "@type": "Answer", text: "Yes, COD is available for orders up to ₹10,000 in most serviceable areas." } },
            ],
          },
        ]}
      />
      <Navbar />

      {/* Visual Breadcrumbs */}
      <div className="container px-4 pt-4 pb-0 max-w-7xl mx-auto">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <ol className="flex items-center gap-1.5 flex-wrap">
            <li><a href="/" className="hover:text-primary transition-colors">Home</a></li>
            <li className="text-muted-foreground/50">/</li>
            <li><a href="/products" className="hover:text-primary transition-colors">Products</a></li>
            <li className="text-muted-foreground/50">/</li>
            <li className="text-foreground font-medium truncate max-w-[200px]">{product.name}</li>
          </ol>
        </nav>
      </div>

      <div className="container px-4 py-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14">
          {/* Left: Image Gallery */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <ProductImageGallery
              mainImage={product.image_url || "/placeholder.svg"}
              productName={product.name}
              productId={product.id}
              activeVariant={
                selectedVariants["Color"] || selectedVariants["color"] ||
                selectedVariants["Colour"] || selectedVariants["colour"]
              }
            />
          </div>

          {/* Right: Product Info */}
          <div>
            <ProductInfo
              product={{ ...product, price: effectivePrice, volume_tiers: (Array.isArray(product.volume_tiers) ? product.volume_tiers : []) as any }}
              quantity={quantity}
              setQuantity={setQuantity}
              onAddToCart={() => addToCartMutation.mutate()}
              onBuyNow={() => {
                if (!user) { navigate("/auth"); return; }
                addToCartMutation.mutate(undefined, { onSuccess: () => navigate("/checkout") });
              }}
              isAddingToCart={addToCartMutation.isPending}
              averageRating={reviewStats?.averageRating}
              totalReviews={reviewStats?.totalReviews}
              orderConfig={orderConfig}
            >
              {/* Variant Selector injected between description and stock */}
              <ProductVariantSelector
                productId={product.id}
                selectedVariants={selectedVariants}
                onVariantChange={handleVariantChange}
              />
            </ProductInfo>
            <div className="mt-4">
              <ProductShareButtons productName={product.name} productUrl={`/products/${product.id}`} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <PriceDropAlert productId={product.id} productName={product.name} currentPrice={effectivePrice} />
              <CompareButton productId={product.id} withLabel />
            </div>
            <ProductTrustBadges />
          </div>
        </div>

        <ProductDetailTabs
          productId={product.id}
          description={product.description}
          category={product.category}
        />

        <RelatedProducts productId={product.id} category={product.category} />
        <FrequentlyBoughtTogether productId={product.id} />
        <AIRecommendations productId={product.id} />
        <RecentlyViewed currentProductId={product.id} />
      </div>

      <Footer />

      {/* Sticky mobile action bar */}
      {(product.stock ?? 0) > 0 && (
        <div className="md:hidden fixed bottom-14 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border px-3 py-2 flex gap-2 safe-area-bottom">
          <Button
            size="lg"
            variant="outline"
            className="flex-1 h-11 rounded-xl text-sm font-semibold"
            onClick={() => addToCartMutation.mutate()}
            disabled={addToCartMutation.isPending}
          >
            {addToCartMutation.isPending ? "Adding..." : "Add to Cart"}
          </Button>
          <Button
            size="lg"
            variant="premium"
            className="flex-1 h-11 rounded-xl text-sm font-semibold"
            onClick={() => {
              if (!user) { navigate("/auth"); return; }
              addToCartMutation.mutate(undefined, { onSuccess: () => navigate("/checkout") });
            }}
            disabled={addToCartMutation.isPending}
          >
            Buy Now · ₹{effectivePrice.toFixed(0)}
          </Button>
        </div>
      )}

      {/* Desktop sticky action bar (appears after scroll) */}
      <StickyAddToCartBar
        productName={product.name}
        imageUrl={product.image_url}
        price={effectivePrice}
        inStock={(product.stock ?? 0) > 0}
        isAddingToCart={addToCartMutation.isPending}
        onAddToCart={() => addToCartMutation.mutate()}
        onBuyNow={() => {
          if (!user) { navigate("/auth"); return; }
          addToCartMutation.mutate(undefined, { onSuccess: () => navigate("/checkout") });
        }}
      />
    </div>
  );
}
