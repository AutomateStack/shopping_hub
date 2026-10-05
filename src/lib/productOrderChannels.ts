export type CustomerType = "retail" | "wholesale";
export type RetailChannel = "whatsapp" | "cod" | "marketplace";

export interface WholesaleTier {
  min_quantity: number;
  max_quantity?: number | null;
  unit_price: number;
}

export interface ProductOrderConfig {
  productId?: string | null;
  productName: string;
  amazonUrl?: string | null;
  amazonPrice?: number | null;
  meeshoUrl?: string | null;
  meeshoPrice?: number | null;
  whatsappPrice?: number | null;
  whatsappEnabled?: boolean;
  codEnabled?: boolean;
  wholesaleEnabled?: boolean;
  wholesalePricing?: WholesaleTier[] | null;
}

export interface RetailButton {
  channel: RetailChannel;
  label: string;
  price?: number;
}

export interface MarketplaceLink {
  name: "Amazon" | "Meesho";
  url: string;
  price: number;
}

export const DEFAULT_COD_CHARGE = 20;
export const MAX_RETAIL_BUTTONS = 3;

const hasPrice = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const hasUrl = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.trim().length > 0;

export function buildCustomerTypeButtons(config: ProductOrderConfig) {
  const buttons: Array<{ type: CustomerType; label: string }> = [
    { type: "retail", label: "Retail" },
  ];

  if (config.wholesaleEnabled) {
    buttons.push({ type: "wholesale", label: "Wholesale" });
  }

  return buttons;
}

/** Retail exposes at most three actions: WhatsApp, COD, and marketplace links. */
export function buildRetailButtons(config: ProductOrderConfig, codCharge = DEFAULT_COD_CHARGE): RetailButton[] {
  const buttons: RetailButton[] = [];

  if (config.whatsappEnabled !== false && hasPrice(config.whatsappPrice)) {
    buttons.push({ channel: "whatsapp", label: `Order on WhatsApp — ₹${formatPrice(config.whatsappPrice)}`, price: config.whatsappPrice });
  }

  if (config.codEnabled !== false && hasPrice(config.whatsappPrice)) {
    buttons.push({ channel: "cod", label: `COD — ₹${formatPrice(config.whatsappPrice + codCharge)}`, price: config.whatsappPrice + codCharge });
  }

  if (getMarketplaceLinks(config).length > 0) {
    buttons.push({ channel: "marketplace", label: "Amazon / Meesho" });
  }

  return buttons.slice(0, MAX_RETAIL_BUTTONS);
}

/** A marketplace option is valid only when both its URL and price exist. */
export function getMarketplaceLinks(config: ProductOrderConfig): MarketplaceLink[] {
  const links: MarketplaceLink[] = [];

  if (hasUrl(config.amazonUrl) && hasPrice(config.amazonPrice)) {
    links.push({ name: "Amazon", url: config.amazonUrl, price: config.amazonPrice });
  }

  if (hasUrl(config.meeshoUrl) && hasPrice(config.meeshoPrice)) {
    links.push({ name: "Meesho", url: config.meeshoUrl, price: config.meeshoPrice });
  }

  return links;
}

export function buildMarketplaceMessage(config: ProductOrderConfig): string {
  const links = getMarketplaceLinks(config);
  if (!links.length) return "";

  const lines = ["🛍️ You can also order this product from:", ""];
  for (const link of links) {
    lines.push(`${link.name} — ₹${formatPrice(link.price)}`, link.url, "");
  }
  return lines.join("\n").trim();
}

export function getWholesaleUnitPrice(config: ProductOrderConfig, quantity: number): number | null {
  if (!config.wholesaleEnabled || !Number.isInteger(quantity) || quantity <= 0) return null;

  const tiers = (config.wholesalePricing || [])
    .filter(t => Number.isFinite(t.min_quantity) && t.min_quantity > 0 && Number.isFinite(t.unit_price) && t.unit_price >= 0)
    .sort((a, b) => b.min_quantity - a.min_quantity);

  const tier = tiers.find(t => quantity >= t.min_quantity && (t.max_quantity == null || quantity <= t.max_quantity));
  return tier?.unit_price ?? null;
}

export function buildWholesaleQuote(config: ProductOrderConfig, quantity: number) {
  const unitPrice = getWholesaleUnitPrice(config, quantity);
  if (unitPrice == null) return null;

  return { customerType: "wholesale" as const, channel: "wholesale" as const, quantity, unitPrice, total: roundMoney(unitPrice * quantity) };
}

export function buildRetailQuote(config: ProductOrderConfig, channel: "whatsapp" | "cod", quantity = 1, codCharge = DEFAULT_COD_CHARGE) {
  if (!Number.isInteger(quantity) || quantity <= 0 || !hasPrice(config.whatsappPrice)) return null;
  if (channel === "whatsapp" && config.whatsappEnabled === false) return null;
  if (channel === "cod" && !config.codEnabled) return null;

  const subtotal = roundMoney(config.whatsappPrice * quantity);
  const appliedCodCharge = channel === "cod" ? codCharge : 0;

  return {
    customerType: "retail" as const,
    channel,
    quantity,
    unitPrice: config.whatsappPrice,
    subtotal,
    codCharge: appliedCodCharge,
    total: roundMoney(subtotal + appliedCodCharge),
  };
}

function formatPrice(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
