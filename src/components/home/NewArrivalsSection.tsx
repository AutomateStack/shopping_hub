import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/product/ProductCard";

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  stock: number | null;
}

export function NewArrivalsSection({ products }: { products: Product[] }) {
  if (!products || products.length === 0) return null;

  return (
    <section className="py-16 bg-muted/30">
      <div className="container px-4">
        <div className="flex items-center justify-between mb-8">
          <div className="animate-fade-in-up">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-primary uppercase tracking-wider">Just In</p>
            </div>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">New Arrivals</h2>
          </div>
          <Link to="/products">
            <Button variant="outline" size="sm">
              View All <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>

        {/* Keep the same card/image rendering as the Products page. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product, i) => (
            <div
              key={product.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <ProductCard
                product={product}
                nativeImage
                badge={
                  <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] z-10">
                    New
                  </Badge>
                }
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
