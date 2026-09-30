import { Link } from "react-router-dom";
import { ShoppingBag, Mail, MapPin, Facebook, Instagram, Twitter, Youtube, ArrowUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useCategories } from "@/hooks/use-categories";

function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <Button size="icon" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 rounded-full shadow-xl bg-primary hover:bg-primary/90 h-11 w-11 animate-fade-in" aria-label="Back to top">
      <ArrowUp className="h-5 w-5" />
    </Button>
  );
}

function CategoryLinks() {
  const { data: categories } = useCategories();
  if (!categories?.length) return null;
  return (
    <nav aria-label="Shop by category" className="mt-10 pt-8 border-t border-border/50">
      <h4 className="font-semibold text-sm mb-3 text-foreground uppercase tracking-wider">Shop by Category</h4>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {categories.map((c) => (
          <li key={c.id}><Link to={`/shop/${c.slug}`} className="text-muted-foreground hover:text-primary transition-colors">{c.name}</Link></li>
        ))}
      </ul>
    </nav>
  );
}

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <>
      <ScrollToTop />
      <footer className="border-t border-border/50 bg-card relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="container px-4 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 mb-4"><ShoppingBag className="h-6 w-6 text-primary" /><span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">ShopHub</span></div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2 max-w-xs">ShoppingHub is operated by <strong className="text-foreground">Thirmal Enterprise</strong>.</p>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-xs">Our ecommerce storefront for products, customer orders and connected ordering channels.</p>
              <div className="flex items-center gap-2">
                {[{ icon: Facebook, label: "Facebook" }, { icon: Instagram, label: "Instagram" }, { icon: Twitter, label: "Twitter" }, { icon: Youtube, label: "YouTube" }].map(({ icon: Icon, label }) => (
                  <a key={label} href="#" className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-200 hover:scale-110" aria-label={label}><Icon className="h-4 w-4" /></a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-3 text-foreground uppercase tracking-wider">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                {[{ to: "/products", label: "All Products" }, { to: "/about", label: "About Thirmal Enterprise" }, { to: "/lucky-draw", label: "Lucky Draw" }, { to: "/quiz", label: "Quiz & Win" }, { to: "/blog", label: "Blog" }, { to: "/wishlist", label: "Wishlist" }].map(({ to, label }) => (
                  <li key={to}><Link to={to} className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 group">{label}<ExternalLink className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" /></Link></li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-3 text-foreground uppercase tracking-wider">Policies</h4>
              <ul className="space-y-2 text-sm">
                {[{ to: "/terms", label: "Terms & Conditions" }, { to: "/privacy", label: "Privacy Policy" }, { to: "/shipping", label: "Shipping & Delivery" }, { to: "/refunds", label: "Refunds & Cancellations" }, { to: "/lucky-draw/rules", label: "Contest Rules" }].map(({ to, label }) => (
                  <li key={to}><Link to={to} className="text-muted-foreground hover:text-primary transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-4 text-foreground uppercase tracking-wider">Get in Touch</h4>
              <div className="flex flex-col gap-2.5 text-sm">
                <Link to="/contact" className="flex items-center gap-2.5 text-muted-foreground hover:text-primary transition-colors group"><div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors"><Mail className="h-3.5 w-3.5 text-primary" /></div><span>Contact Thirmal Enterprise</span></Link>
                <div className="flex items-center gap-2.5 text-muted-foreground"><div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center shrink-0"><MapPin className="h-3.5 w-3.5 text-primary" /></div><span>Hyderabad, Telangana, India</span></div>
              </div>
            </div>
          </div>
          <CategoryLinks />
        </div>
        <div className="border-t">
          <div className="container px-4 py-5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">© {currentYear} Thirmal Enterprise — ShoppingHub. All rights reserved.</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground"><Link to="/terms" className="hover:text-primary transition-colors">Terms</Link><span className="text-border">·</span><Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link><span className="text-border">·</span><Link to="/shipping" className="hover:text-primary transition-colors">Shipping</Link><span className="text-border">·</span><Link to="/refunds" className="hover:text-primary transition-colors">Refunds</Link><span className="text-border">·</span><Link to="/contact" className="hover:text-primary transition-colors">Contact</Link></div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
