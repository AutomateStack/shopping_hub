import { ExternalLink, MessageCircle, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface MarketplaceOrderButtonsProps {
  amazonUrl?: string | null;
  meeshoUrl?: string | null;
  whatsappUrl?: string | null;
  productName: string;
}

export function MarketplaceOrderButtons({
  amazonUrl,
  meeshoUrl,
  whatsappUrl,
  productName,
}: MarketplaceOrderButtonsProps) {
  const links = [
    amazonUrl ? { label: "Order on Amazon", href: amazonUrl, icon: <ShoppingBag className="h-4 w-4" /> } : null,
    meeshoUrl ? { label: "Order on Meesho", href: meeshoUrl, icon: <ShoppingBag className="h-4 w-4" /> } : null,
    whatsappUrl ? { label: "Order on WhatsApp", href: whatsappUrl, icon: <MessageCircle className="h-4 w-4" /> } : null,
  ].filter(Boolean) as { label: string; href: string; icon: ReactNode }[];

  if (links.length === 0) return null;

  return (
    <div className="mt-5 space-y-2">
      <p className="text-sm font-semibold text-foreground">Order from</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {links.map((link) => (
          <Button key={link.label} asChild variant="outline" className="w-full rounded-xl">
            <a href={link.href} target="_blank" rel="noopener noreferrer" aria-label={`${link.label} - ${productName}`}>
              {link.icon}
              <span>{link.label}</span>
              <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-60" />
            </a>
          </Button>
        ))}
      </div>
    </div>
  );
}
