import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { WishlistButton } from "@/components/WishlistButton";
import { Minus, Plus, ShoppingCart, Zap, Share2, Check, Star, Users, ShieldCheck, Truck, RotateCcw, TrendingUp } from "lucide-react";
import { useState, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { DeliveryEstimate } from "@/components/product/DeliveryEstimate";
import { BackInStockNotify } from "@/components/product/BackInStockNotify";
import { MarketplaceOrderButtons } from "@/components/product/MarketplaceOrderButtons";

interface VolumeTier {
  min_qty: number;
  discount_percent: number;
}

interface ProductInfoProps {
  product: {
    id: string;
    name: string;
    price: number;
    description: string | null;
    category: string | null;
    stock: number | null;
    volume_tiers?: VolumeTier[] | null;
    amazon_url?: string | null;
    meesho_url?: string | null;
    whatsapp_url?: string | null;
  };
  quantity: number;
  setQuantity: (q: number) => void;
  onAddToCart: () => void;
  onBuyNow: () => void;
  isAddingToCart: boolean;
  children?: ReactNode;
  averageRating?: number;
  totalReviews?: number;
}

export function ProductInfo({ product, quantity, setQuantity, onAddToCart, onBuyNow, isAddingToCart, children, averageRating = 0, totalReviews = 0 }: ProductInfoProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const stock = product.stock ?? 0;
  const [recentViewers] = useState(() => Math.floor(Math.random() * 15 + 5));
  const [purchasesToday] = useState(() => Math.floor(Math.random() * 40 + 12));

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Link copied!", description: "Product link copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Share", description: url });
    }
  };

  const discountPercent = Math.floor(Math.random() * 20 + 10);
  const originalPrice = product.price * (1 + discountPercent / 100);

  return (
    <div className="flex flex-col">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4 animate-fade-in-up">
        <a href="/products" className="hover:text-primary transition-colors">Products</a>
        <span>/</span>
        {product.category && <><a href={`/products?category=${product.category}`} className="hover:text-primary transition-colors">{product.category}</a><span>/</span></>}
        <span className="text-foreground truncate max-w-[200px]">{product.name}</span>
      </nav>

      <div className="flex items-start justify-between gap-4 mb-2 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground leading-tight">{product.name}</h1>
        <div className="flex items-center gap-2 flex-shrink-0">
          <WishlistButton productId={product.id} size="default" className="h-10 w-10" />
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={handleShare}>{copied ? <Check className="h-4 w-4 text-primary" /> : <Share2 className="h-4 w-4" />}</Button>
        </div>
      </div>

      {totalReviews > 0 && <div className="flex items-center gap-2 mb-3 animate-fade-in-up" style={{ animationDelay: '0.1s' }}><div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`h-4 w-4 ${star <= Math.round(averageRating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />)}</div><span className="text-sm font-medium text-foreground">{averageRating.toFixed(1)}</span><span className="text-sm text-muted-foreground">({totalReviews} {totalReviews === 1 ? 'review' : 'reviews'})</span></div>}

      {product.category && <div className="mb-4 animate-fade-in-up" style={{ animationDelay: '0.15s' }}><Badge variant="secondary" className="text-xs font-medium">{product.category}</Badge></div>}

      <div className="mb-5 animate-fade-in-up" style={{ animationDelay: '0.2s' }}><div className="flex items-baseline gap-3"><span className="text-3xl lg:text-4xl font-bold text-primary">₹{product.price.toFixed(2)}</span><span className="text-lg text-muted-foreground line-through">₹{originalPrice.toFixed(2)}</span><Badge variant="secondary" className="text-xs font-medium">{discountPercent}% OFF</Badge></div><p className="text-xs text-muted-foreground mt-1">Inclusive of all taxes</p></div>

      {Array.isArray(product.volume_tiers) && product.volume_tiers.length > 0 && <div className="mb-5 animate-fade-in-up" style={{ animationDelay: '0.21s' }}><h3 className="text-sm font-semibold text-foreground mb-2">Buy More, Save More</h3><div className="flex flex-wrap gap-2">{product.volume_tiers.sort((a, b) => a.min_qty - b.min_qty).map((tier, i) => { const unitPrice = product.price * (1 - tier.discount_percent / 100); const active = quantity >= tier.min_qty; return <div key={i} className={`rounded-lg border px-3 py-2 text-xs transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/50 text-muted-foreground"}`}><span className="font-semibold">{tier.min_qty}+ units</span><span className="mx-1.5">·</span><span>{tier.discount_percent}% off</span><span className="mx-1.5">·</span><span>₹{unitPrice.toFixed(2)}/unit</span></div>; })}</div></div>}

      <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground animate-fade-in-up" style={{ animationDelay: '0.22s' }}><Users className="h-4 w-4 text-primary" /><span>{recentViewers} people are viewing this right now</span></div>
      <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground animate-fade-in-up" style={{ animationDelay: '0.23s' }}><TrendingUp className="h-4 w-4 text-green-600" /><span><strong className="text-foreground">{purchasesToday}+</strong> purchased today</span></div>

      {product.description && <div className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.25s' }}><h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">Key Highlights</h2><ul className="space-y-2">{product.description.split('\n').map(line => line.trim()).filter(line => line.length > 0).slice(0, 6).map((point, i) => { const cleanPoint = point.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1'); return <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground"><Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" /><span>{cleanPoint}</span></li>; })}</ul></div>}

      {children && <div className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>{children}</div>}

      <MarketplaceOrderButtons amazonUrl={product.amazon_url} meeshoUrl={product.meesho_url} whatsappUrl={product.whatsapp_url} productName={product.name} />

      <div className="mb-5 animate-fade-in-up" style={{ animationDelay: '0.35s' }}>{stock > 0 ? <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-600" /><span className="text-sm font-medium text-green-600">In Stock {stock <= 5 && `· Only ${stock} left!`}</span>{stock <= 5 && <Badge variant="destructive" className="text-xs animate-pulse">Low Stock</Badge>}</div> : <div className="space-y-3"><div className="flex items-center gap-2"><span className="flex h-2.5 w-2.5 rounded-full bg-destructive" /><span className="text-sm font-medium text-destructive">Out of Stock</span></div><BackInStockNotify productId={product.id} /></div>}</div>

      {stock > 0 && <div className="mb-5 animate-fade-in-up" style={{ animationDelay: '0.4s' }}><DeliveryEstimate /></div>}

      {stock > 0 && <div className="animate-fade-in-up" style={{ animationDelay: '0.45s' }}><div className="mb-5"><label className="block text-sm font-medium mb-2 text-foreground">Quantity</label><div className="flex items-center gap-2"><Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus className="h-4 w-4" /></Button><Input type="number" min="1" max={stock} value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.min(stock, parseInt(e.target.value) || 1)))} className="w-16 text-center rounded-xl h-10" /><Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setQuantity(Math.min(stock, quantity + 1))}><Plus className="h-4 w-4" /></Button></div></div><div className="flex gap-3"><Button size="lg" variant="outline" onClick={onAddToCart} disabled={isAddingToCart} className="flex-1 h-12 rounded-xl text-base font-semibold"><ShoppingCart className="mr-2 h-5 w-5" />{isAddingToCart ? "Adding..." : "Add to Cart"}</Button><Button size="lg" variant="premium" onClick={onBuyNow} disabled={isAddingToCart} className="flex-1 h-12 rounded-xl text-base font-semibold"><Zap className="mr-2 h-5 w-5" />Buy Now</Button></div><div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground"><div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-green-600 flex-shrink-0" /><span>Secure checkout</span></div><div className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-primary flex-shrink-0" /><span>Fast delivery</span></div><div className="flex items-center gap-1.5"><RotateCcw className="h-3.5 w-3.5 text-primary flex-shrink-0" /><span>7-day returns</span></div></div></div>}
    </div>
  );
}
