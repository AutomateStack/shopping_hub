import { Building2, ShoppingBag, MessageCircle, Store } from "lucide-react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/home/Footer";
import { SEOHead } from "@/components/SEOHead";

export default function AboutUs() {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="About ShoppingHub | Thirmal Enterprise"
        description="Learn about ShoppingHub, an ecommerce platform operated by Thirmal Enterprise, connecting product catalogs, WhatsApp ordering and marketplace destinations."
        canonical="/about"
      />
      <Navbar />

      <main id="main-content" className="container px-4 py-12 md:py-16 max-w-4xl">
        <div className="text-center mb-12">
          <div className="mx-auto mb-5 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ShoppingBag className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-2">About ShoppingHub</p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            ShoppingHub is operated by Thirmal Enterprise
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            ShoppingHub is the ecommerce storefront and technology platform operated by Thirmal Enterprise.
            We use ShoppingHub to manage our product catalog, customer orders and ordering channels in one place.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <section className="rounded-2xl border bg-card p-6">
            <Building2 className="h-6 w-6 text-primary mb-4" />
            <h2 className="text-xl font-semibold mb-2">Business relationship</h2>
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Thirmal Enterprise</strong> is the business that operates ShoppingHub.
              ShoppingHub is used as our online shopping storefront and as the internal platform for managing our products and orders.
            </p>
          </section>

          <section className="rounded-2xl border bg-card p-6">
            <Store className="h-6 w-6 text-primary mb-4" />
            <h2 className="text-xl font-semibold mb-2">What ShoppingHub does</h2>
            <p className="text-muted-foreground leading-relaxed">
              ShoppingHub provides a product catalog, ecommerce ordering, order management and connections to external
              marketplace destinations such as Amazon and Meesho when those destinations are available for a product.
            </p>
          </section>

          <section className="rounded-2xl border bg-card p-6">
            <MessageCircle className="h-6 w-6 text-primary mb-4" />
            <h2 className="text-xl font-semibold mb-2">WhatsApp integration</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our WhatsApp integration allows our WhatsApp product catalog to be synchronized with ShoppingHub and
              allows customer cart and order information received through WhatsApp to be managed in ShoppingHub.
            </p>
          </section>

          <section className="rounded-2xl border bg-card p-6">
            <ShoppingBag className="h-6 w-6 text-primary mb-4" />
            <h2 className="text-xl font-semibold mb-2">Our use of platform data</h2>
            <p className="text-muted-foreground leading-relaxed">
              Data received through connected platforms is used to operate our catalog and ordering workflows,
              process customer requests, maintain order status and provide customer support. We do not sell platform data.
            </p>
          </section>
        </div>

        <section className="rounded-2xl border bg-card p-6 md:p-8 mb-10">
          <h2 className="text-2xl font-semibold mb-4">ShoppingHub and Thirmal Enterprise</h2>
          <div className="space-y-3 text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Legal/business operator:</strong> Thirmal Enterprise
            </p>
            <p>
              <strong className="text-foreground">Online platform/storefront:</strong> ShoppingHub
            </p>
            <p>
              <strong className="text-foreground">Location:</strong> Hyderabad, Telangana, India
            </p>
            <p>
              ShoppingHub is not a separate marketplace operated for unrelated businesses. It is our online shopping
              storefront and supporting ecommerce platform operated by Thirmal Enterprise.
            </p>
          </div>
        </section>

        <div className="text-center">
          <Link
            to="/contact"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Contact Thirmal Enterprise
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
