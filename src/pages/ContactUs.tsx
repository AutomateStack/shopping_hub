import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Mail, MapPin, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/SEOHead";

export default function ContactUs() {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const orderId = searchParams.get("orderId");
    const subject = searchParams.get("subject");
    if (orderId || subject) {
      const intro = subject
        ? `${subject}\n\nHi team, I'd like to ${/return/i.test(subject) ? "request a return" : "get help"} for order #${orderId ?? "________"}. Reason:\n\n`
        : `Hi, I need help with my order #${orderId}.\n\n`;
      setForm((f) => ({ ...f, message: f.message || intro }));
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-contact-email', {
        body: { name: form.name, email: form.email, message: form.message },
      });
      if (error || !data?.success) throw new Error(data?.error || 'Failed to send');
      toast({ title: "Message sent! ✉️", description: "We'll get back to you within 24 hours." });
      setForm({ name: "", email: "", message: "" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Contact Thirmal Enterprise | ShoppingHub"
        description="Contact Thirmal Enterprise, the business operating ShoppingHub, for product, order and customer support."
        canonical="/contact"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "ContactPage",
            name: "Contact Thirmal Enterprise",
            url: "https://shopshub.lovable.app/contact",
            mainEntity: {
              "@type": "Organization",
              name: "Thirmal Enterprise",
              alternateName: "ShoppingHub",
              email: "ShopsHub@gmail.com",
              address: {
                "@type": "PostalAddress",
                addressLocality: "Hyderabad",
                addressRegion: "Telangana",
                addressCountry: "IN",
              },
            },
          },
        ]}
      />
      <Navbar />
      <main id="main-content" className="container px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">Contact Thirmal Enterprise</h1>
        <p className="text-muted-foreground mb-8">ShoppingHub is operated by Thirmal Enterprise. Reach out for product, order or customer support.</p>

        <div className="grid md:grid-cols-2 gap-8">
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">ShopsHub@gmail.com</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Business location</p>
                  <p className="text-sm text-muted-foreground">Hyderabad, Telangana, India</p>
                </div>
              </div>
              <div>
                <p className="font-medium">Business</p>
                <p className="text-sm text-muted-foreground">Thirmal Enterprise</p>
                <p className="text-sm text-muted-foreground">Online platform: ShoppingHub</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div>
                  <Label>Message</Label>
                  <Textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows={4} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</> : "Send Message"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
