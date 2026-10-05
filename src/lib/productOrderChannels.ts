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
  price?: number;
}

export const DEFAULT_COD_CHARGE = 20;
export const MAX_RETAIL_BUTTONS = 3;

function hasPrice(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function hasUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Build the first screen. We intentionally keep this to two choices so the
 * customer chooses intent before seeing retail-specific actions.
 */
export function buildCustomerTypeButtons(config: ProductOrderConfig) {
  const buttons: Array<{ type: CustomerType; label: string }> = [
    { type: "retail", label: "Retail" },
  ];

  if (config.wholesaleEnabled) {
    buttons.push({ type: "wholesale", label: "Wholesale" });
  }

  return buttons;
}

/**
 * Retail has at most three buttons:
 * 1. WhatsApp
 * 2. COD
 * 3. Amazon / Meesho marketplace message
 *
 * Missing/disabled channels are omitted. Marketplace is one logical button
 * even when both Amazon and Meesho links exist.
 */
export function buildRetailButtons(
  config: ProductOrderConfig,
  codCharge = DEFAULT_COD_CHARGE,
): RetailButton[] {
  const buttons: RetailButton[] = [];

  if (config.whatsappEnabled !== false && hasPrice(config.whatsappPrice)) {
    buttons.push({
      channel: "whatsapp",
      label: `Order on WhatsApp — ₹${formatPrice(config.whatsappPrice)}`,
      price: config.whatsappPrice,
    });
  }

  if (config.codEnabled && hasPrice(config.whatsappPrice)) {
    buttons.push({
      channel: "cod",
      label: `COD — ₹${formatPrice(config.whatsappPrice + codCharge)}`,
      price: config.whatsappPrice + codCharge,
    });
  }

  if (getMarketplaceLinks(config).length > 0) {
    buttons.push({
      channel: "marketplace",
      label: "Amazon / Meesho",
    });
  }

  return buttons.slice(0, MAX_RETAIL_BUTTONS);
}

export function getMarketplaceLinks(config: ProductOrderConfig): MarketplaceLink[] {
  const links: MarketplaceLink[] = [];

  if (hasUrl(config.amazonUrl)) {
    links.push({
      name: "Amazon",
      url: config.amazonUrl,
      ...(hasPrice(config.amazonPrice) ? { price: config.amazonPrice } : {}),
    });
  }

  if (hasUrl(config.meeshoUrl)) {
    links.push({
      name: "Meesho",
      url: config.meeshoUrl,
      ...(hasPrice(config.meeshoPrice) ? { price: config.meeshoPrice } : {}),
    });
  }

  return links;
}

export function buildMarketplaceMessage(config: ProductOrderConfig): string {
  const links = getMarketplaceLinks(config);

  if (links.length === 0) return "";

  const lines = ["🛍️ You can also order this product from:", ""];
  for (const link of links) {
    const price = hasPrice(link.price) ? ` — ₹${formatPrice(link.price)}` : "";
    lines.push(`${link.name}${price}`);
    lines.push(link.url);
    lines.push("");
  }

  return lines.join("\n").trim();
}

export function getWholesaleUnitPrice(
  config: ProductOrderConfig,
  quantity: number,
): number | null {
  if (!config.wholesaleEnabled || !Number.isInteger(quantity) || quantity <= 0) {
    return null;
  }

  const tiers = (config.wholesalePricing || [])
    .filter(
      (tier) =>
        Number.isFinite(tier.min_quantity) &&
        tier.min_quantity > 0 &&
        Number.isFinite(tier.unit_price) &&
        tier.unit_price >= 0,
    )
    .sort((a, b) => b.min_quantity - a.min_quantity);

  const tier = tiers.find(
    (candidate) =>
      quantity >= candidate.min_quantity &&
      (candidate.max_quantity == null || quantity <= candidate.max_quantity),
  );

  return tier ? tier.unit_price : null;
}

export function buildWholesaleQuote(
  config: ProductOrderConfig,
  quantity: number,
) {
  const unitPrice = getWholesaleUnitPrice(config, quantity);
  if (unitPrice == null) return null;

  return {
    customerType: "wholesale" as const,
    channel: "wholesale" as const,
    quantity,
    unitPrice,
    total: roundMoney(unitPrice * quantity),
  };
}

export function buildRetailQuote(
  config: ProductOrderConfig,
  channel: "whatsapp" | "cod",
  quantity = 1,
  codCharge = DEFAULT_COD_CHARGE,
) {
  if (!Number.isInteger(quantity) || quantity <= 0 || !hasPrice(config.whatsappPrice)) {
    return null;
  }

  if (channel === "whatsapp" && config.whatsappEnabled === false) return null;
  if (channel === "cod" && !config.codEnabled) return null;

  const unitPrice = config.whatsappPrice;
  const subtotal = roundMoney(unitPrice * quantity);
  const totalCodCharge = channel === "cod" ? codCharge : 0;

  return {
    customerType: "retail" as const,
    channel,
    quantity,
    unitPrice,
    subtotal,
    codCharge: totalCodCharge,
    total: roundMoney(subtotal + totalCodCharge),
  };
}

function formatPrice(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
