import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search, ExternalLink, Copy, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

type Tier = { min_quantity: number; max_quantity: number | null; unit_price: number };
type Product = { id: string; name: string; whatsapp_retailer_id: string | null; whatsapp_catalog_id: string | null };
type Mapping = {
  whatsapp_retailer_id: string;
  product_id: string | null;
  product_name: string | null;
  amazon_url: string | null;
  amazon_price: number | null;
  meesho_url: string | null;
  meesho_price: number | null;
  whatsapp_url: string | null;
  whatsapp_price: number | null;
  whatsapp_enabled: boolean;
  cod_enabled: boolean;
  wholesale_enabled: boolean;
  wholesale_pricing: Tier[];
  enabled: boolean;
};

type Form = Omit<Mapping, "whatsapp_retailer_id" | "product_id" | "product_name" | "amazon_price" | "meesho_price" | "whatsapp_price"> & {
  whatsapp_retailer_id: string;
  product_id: string;
  product_name: string;
  amazon_price: string | number;
  meesho_price: string | number;
  whatsapp_price: string | number;
};

const PENDING_PREFIX = "pending:";
const isPendingRetailerId = (value: string | null | undefined) => String(value || "").startsWith(PENDING_PREFIX);
const pendingRetailerId = (productId: string) => `${PENDING_PREFIX}${productId}`;
const validUrl = (value: string) => {
  if (!value.trim()) return true;
  try {
    return new URL(value.trim()).protocol === "https:";
  } catch {
    return false;
  }
};

const emptyForm: Form = {
  whatsapp_retailer_id: "",
  product_id: "",
  product_name: "",
  amazon_url: "",
  amazon_price: "",
  meesho_url: "",
  meesho_price: "",
  whatsapp_url: "",
  whatsapp_price: "",
  whatsapp_enabled: true,
  cod_enabled: true,
  wholesale_enabled: false,
  wholesale_pricing: [],
  enabled: true,
};

export default function AdminMarketplaceCatalogConfigV3() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [form, setForm] = useState<Form>(emptyForm);

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["marketplace-catalog-products-v3"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products" as any)
        .select("id,name,whatsapp_retailer_id,whatsapp_catalog_id")
        .order("name");
      if (error) throw error;
      return (data || []) as Product[];
    },
  });

  const { data: mappings = [], isLoading: mappingsLoading } = useQuery<Mapping[]>({
    queryKey: ["shoppinghub-marketplace-mappings-v3"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shoppinghub_marketplace_map" as any)
        .select("*")
        .order("product_name");
      if (error) throw error;
      return (data || []) as Mapping[];
    },
  });

  const byProduct = useMemo(
    () => new Map(mappings.filter((mapping) => mapping.product_id).map((mapping) => [String(mapping.product_id), mapping])),
    [mappings],
  );
  const byRetailer = useMemo(
    () => new Map(mappings.map((mapping) => [mapping.whatsapp_retailer_id, mapping])),
    [mappings],
  );

  const getMapping = (product: Product) => {
    if (product.whatsapp_retailer_id) {
      return byRetailer.get(product.whatsapp_retailer_id) || byProduct.get(product.id);
    }
    return byProduct.get(product.id);
  };

  const setProduct = (product: Product, mapping?: Mapping) => {
    const retailerId = product.whatsapp_retailer_id || mapping?.whatsapp_retailer_id || "";
    const displayRetailerId = isPendingRetailerId(retailerId) ? "" : retailerId;
    setSelected(product.id);
    setForm({
      whatsapp_retailer_id: displayRetailerId,
      product_id: product.id,
      product_name: mapping?.product_name || product.name,
      amazon_url: mapping?.amazon_url || "",
      amazon_price: mapping?.amazon_price ?? "",
      meesho_url: mapping?.meesho_url || "",
      meesho_price: mapping?.meesho_price ?? "",
      whatsapp_url: mapping?.whatsapp_url || "",
      whatsapp_price: mapping?.whatsapp_price ?? "",
      whatsapp_enabled: mapping?.whatsapp_enabled !== false,
      cod_enabled: mapping?.cod_enabled !== false,
      wholesale_enabled: mapping?.wholesale_enabled === true,
      wholesale_pricing: Array.isArray(mapping?.wholesale_pricing) ? mapping!.wholesale_pricing : [],
      enabled: mapping?.enabled !== false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pick = (productId: string) => {
    if (!productId) {
      setSelected("");
      setForm(emptyForm);
      return;
    }
    const product = products.find((item) => item.id === productId);
    if (product) setProduct(product, getMapping(product));
  };

  const sync = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-whatsapp-catalog", {
        body: { source: "marketplace-links" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-catalog-products-v3"] });
      queryClient.invalidateQueries({ queryKey: ["shoppinghub-marketplace-mappings-v3"] });
      toast({ title: "Catalog refreshed", description: `${data?.synced ?? 0} products synchronized.` });
    },
    onError: (error: any) => {
      const message = String(error?.message || "Catalog refresh failed");
      const metaBlocked = message.includes("#200") || message.toLowerCase().includes("not been approved to use this api");
      toast({
        title: "WhatsApp catalog refresh unavailable",
        description: metaBlocked
          ? "Meta is rejecting catalog API access for this app (#200). You can still configure products here and add the WhatsApp Catalog Product ID when Meta access is available."
          : message,
        variant: "destructive",
      });
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.product_id) throw new Error("Select a ShoppingHub product.");

      const actualRetailerId = form.whatsapp_retailer_id.trim();
      const retailerId = actualRetailerId || pendingRetailerId(form.product_id);
      const prices = [form.amazon_price, form.meesho_price, form.whatsapp_price].map((value) => {
        const text = String(value ?? "").trim();
        return text ? Number(text) : null;
      });

      if (![form.amazon_url, form.meesho_url, form.whatsapp_url].every(validUrl)) {
        throw new Error("Marketplace links must be HTTPS URLs.");
      }
      if (prices.some((value) => value != null && (!Number.isFinite(value) || value <= 0))) {
        throw new Error("Prices must be positive numbers.");
      }

      const tiers = Array.isArray(form.wholesale_pricing) ? form.wholesale_pricing : [];
      if (form.wholesale_enabled && !tiers.length) {
        throw new Error("Add at least one wholesale tier or disable Wholesale.");
      }
      for (const tier of tiers) {
        if (!Number.isInteger(tier.min_quantity) || tier.min_quantity < 1) {
          throw new Error("Wholesale minimum quantity must be a whole number greater than 0.");
        }
        if (tier.max_quantity != null && (!Number.isInteger(tier.max_quantity) || tier.max_quantity < tier.min_quantity)) {
          throw new Error("Wholesale maximum quantity must be blank or greater than/equal to the minimum quantity.");
        }
        if (!Number.isFinite(tier.unit_price) || tier.unit_price <= 0) {
          throw new Error("Wholesale unit price must be greater than 0.");
        }
      }

      const payload = {
        whatsapp_retailer_id: retailerId,
        product_id: form.product_id,
        product_name: form.product_name,
        amazon_url: String(form.amazon_url || "").trim() || null,
        amazon_price: prices[0],
        meesho_url: String(form.meesho_url || "").trim() || null,
        meesho_price: prices[1],
        whatsapp_url: String(form.whatsapp_url || "").trim() || null,
        whatsapp_price: prices[2],
        whatsapp_enabled: form.whatsapp_enabled,
        cod_enabled: form.cod_enabled,
        wholesale_enabled: form.wholesale_enabled,
        wholesale_pricing: tiers,
        enabled: form.enabled,
        updated_at: new Date().toISOString(),
      };

      const existing = byProduct.get(form.product_id);
      if (existing && existing.whatsapp_retailer_id !== retailerId) {
        const { error } = await supabase
          .from("shoppinghub_marketplace_map" as any)
          .update(payload)
          .eq("whatsapp_retailer_id", existing.whatsapp_retailer_id);
        if (error) throw error;
      } else if (existing) {
        const { error } = await supabase
          .from("shoppinghub_marketplace_map" as any)
          .update(payload)
          .eq("whatsapp_retailer_id", existing.whatsapp_retailer_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shoppinghub_marketplace_map" as any).insert(payload);
        if (error) throw error;
      }

      if (actualRetailerId) {
        const { error } = await supabase
          .from("products" as any)
          .update({ whatsapp_retailer_id: actualRetailerId })
          .eq("id", form.product_id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shoppinghub-marketplace-mappings-v3"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-catalog-products-v3"] });
      toast({ title: "Configuration saved", description: "The product is ready for channel configuration." });
    },
    onError: (error: any) => toast({ title: "Could not save configuration", description: error.message, variant: "destructive" }),
  });

  const removeTier = (index: number) => {
    setForm((current) => ({
      ...current,
      wholesale_pricing: current.wholesale_pricing.filter((_, tierIndex) => tierIndex !== index),
    }));
  };

  const rows = products.filter((product) => {
    const query = search.toLowerCase().trim();
    return !query || [product.name, product.whatsapp_retailer_id, product.whatsapp_catalog_id].some((value) => String(value || "").toLowerCase().includes(query));
  });

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <AdminSidebar activeTab="marketplace-links" onTabChange={() => {}} />
        <div className="flex-1 min-w-0">
          <header className="h-14 flex items-center gap-4 border-b bg-background px-4 sticky top-0 z-40">
            <SidebarTrigger />
            <div>
              <h2 className="font-semibold text-sm">Marketplace Links</h2>
              <p className="text-xs text-muted-foreground">WhatsApp catalog → Amazon / Meesho / WhatsApp</p>
            </div>
          </header>

          <main className="p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold">Product Order Channels</h1>
                  <p className="text-muted-foreground">All ShoppingHub products are shown, including products not yet synchronized with WhatsApp.</p>
                </div>
                <Button variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} />
                  {sync.isPending ? "Refreshing..." : "Refresh WhatsApp Catalog"}
                </Button>
              </div>

              <Card>
                <CardHeader><CardTitle>Configure Product</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <Label>Select Product</Label>
                    <select
                      className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm"
                      value={selected}
                      onChange={(event) => pick(event.target.value)}
                    >
                      <option value="">Select product...</option>
                      {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                    </select>
                    <p className="mt-2 text-xs text-muted-foreground">Every ShoppingHub product can be configured, even while WhatsApp catalog sync is unavailable.</p>
                  </div>

                  <div className="rounded-md border bg-muted/30 p-3">
                    <div className="font-semibold">{form.product_name || "No product selected"}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      WhatsApp Catalog Product ID: {form.whatsapp_retailer_id || "Not synchronized yet"}
                    </div>
                  </div>

                  <div>
                    <Label>WhatsApp Catalog Product ID <span className="text-muted-foreground">(optional until sync)</span></Label>
                    <Input
                      className="mt-2"
                      value={form.whatsapp_retailer_id}
                      onChange={(event) => setForm({ ...form, whatsapp_retailer_id: event.target.value })}
                      placeholder="e.g. w7ivha0s34"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">Leave blank if Meta has not supplied the ID yet. The configuration will be linked to this ShoppingHub product and can be connected automatically later.</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div><Label>Amazon URL</Label><Input className="mt-2" value={form.amazon_url || ""} onChange={(event) => setForm({ ...form, amazon_url: event.target.value })} placeholder="https://www.amazon.in/..." /></div>
                    <div><Label>Amazon Price (₹)</Label><Input className="mt-2" type="number" min="0" value={form.amazon_price ?? ""} onChange={(event) => setForm({ ...form, amazon_price: event.target.value })} /></div>
                    <div><Label>Meesho URL</Label><Input className="mt-2" value={form.meesho_url || ""} onChange={(event) => setForm({ ...form, meesho_url: event.target.value })} placeholder="https://www.meesho.com/..." /></div>
                    <div><Label>Meesho Price (₹)</Label><Input className="mt-2" type="number" min="0" value={form.meesho_price ?? ""} onChange={(event) => setForm({ ...form, meesho_price: event.target.value })} /></div>
                    <div><Label>WhatsApp Price (₹)</Label><Input className="mt-2" type="number" min="0" value={form.whatsapp_price ?? ""} onChange={(event) => setForm({ ...form, whatsapp_price: event.target.value })} /></div>
                    <div><Label>WhatsApp URL (optional)</Label><Input className="mt-2" value={form.whatsapp_url || ""} onChange={(event) => setForm({ ...form, whatsapp_url: event.target.value })} /></div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="font-medium mb-3">Ordering Controls</div>
                    <div className="flex flex-wrap gap-6">
                      <label className="flex gap-2 items-center"><Switch checked={form.whatsapp_enabled !== false} onCheckedChange={(value) => setForm({ ...form, whatsapp_enabled: value })} />WhatsApp</label>
                      <label className="flex gap-2 items-center"><Switch checked={form.cod_enabled !== false} onCheckedChange={(value) => setForm({ ...form, cod_enabled: value })} />COD</label>
                      <label className="flex gap-2 items-center"><Switch checked={form.wholesale_enabled === true} onCheckedChange={(value) => setForm({ ...form, wholesale_enabled: value })} />Wholesale</label>
                      <label className="flex gap-2 items-center"><Switch checked={form.enabled !== false} onCheckedChange={(value) => setForm({ ...form, enabled: value })} />Enabled</label>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">Wholesale Tiers</div>
                        <p className="text-xs text-muted-foreground">Quantity-based pricing. Maximum quantity is optional for the final/open-ended tier.</p>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={() => setForm((current) => ({ ...current, wholesale_pricing: [...current.wholesale_pricing, { min_quantity: 1, max_quantity: null, unit_price: 0 }] }))}>
                        <Plus className="mr-1 h-4 w-4" /> Add tier
                      </Button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {form.wholesale_pricing.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No wholesale tiers added. Turn Wholesale off if this product is retail-only.</p>
                      ) : form.wholesale_pricing.map((tier, index) => (
                        <div key={index} className="rounded-md border bg-muted/20 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Tier {index + 1}</span>
                            <Button type="button" variant="destructive" size="icon" onClick={() => removeTier(index)} aria-label={`Delete tier ${index + 1}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid md:grid-cols-3 gap-3">
                            <div><Label className="text-xs">Minimum quantity</Label><Input className="mt-1" type="number" min="1" step="1" value={tier.min_quantity} onChange={(event) => setForm((current) => ({ ...current, wholesale_pricing: current.wholesale_pricing.map((item, i) => i === index ? { ...item, min_quantity: Number(event.target.value) } : item) }))} /></div>
                            <div><Label className="text-xs">Maximum quantity <span className="text-muted-foreground">(optional)</span></Label><Input className="mt-1" type="number" min="1" step="1" placeholder="No limit" value={tier.max_quantity ?? ""} onChange={(event) => setForm((current) => ({ ...current, wholesale_pricing: current.wholesale_pricing.map((item, i) => i === index ? { ...item, max_quantity: event.target.value ? Number(event.target.value) : null } : item) }))} /></div>
                            <div><Label className="text-xs">Unit price (₹)</Label><Input className="mt-1" type="number" min="0.01" step="0.01" value={tier.unit_price} onChange={(event) => setForm((current) => ({ ...current, wholesale_pricing: current.wholesale_pricing.map((item, i) => i === index ? { ...item, unit_price: Number(event.target.value) } : item) }))} /></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button onClick={() => save.mutate()} disabled={save.isPending || !form.product_id}>
                    {save.isPending ? "Saving..." : "Save Configuration"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row justify-between gap-4">
                  <CardTitle>All Catalog / ShoppingHub Products ({rows.length})</CardTitle>
                  <div className="w-full max-w-sm relative">
                    <Search className="absolute left-3 top-3 h-4 w-4" />
                    <Input className="pl-9" placeholder="Search product or ID" value={search} onChange={(event) => setSearch(event.target.value)} />
                  </div>
                </CardHeader>
                <CardContent>
                  {productsLoading || mappingsLoading ? <p>Loading...</p> : (
                    <div className="space-y-3">
                      {rows.map((product) => {
                        const mapping = getMapping(product);
                        const linked = Boolean(product.whatsapp_retailer_id || product.whatsapp_catalog_id);
                        return (
                          <div className="border rounded-lg p-4" key={product.id}>
                            <div className="font-semibold">{product.name}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {linked ? `WhatsApp ID: ${product.whatsapp_retailer_id || "Catalog linked"}` : "WhatsApp ID: Not synchronized"} · {mapping ? "Configured" : "Not configured"}
                            </div>
                            {mapping && <div className="flex flex-wrap gap-2 mt-2 text-xs">
                              <span className="border rounded-full px-2 py-1">WhatsApp {mapping.whatsapp_price != null ? `₹${mapping.whatsapp_price}` : "On"}</span>
                              <span className="border rounded-full px-2 py-1">COD {mapping.cod_enabled ? "On" : "Off"}</span>
                              <span className="border rounded-full px-2 py-1">Wholesale {mapping.wholesale_enabled ? "On" : "Off"}</span>
                              {mapping.amazon_url && <a className="border rounded-full px-2 py-1" href={mapping.amazon_url} target="_blank" rel="noreferrer"><ExternalLink className="inline h-3 w-3" /> Amazon {mapping.amazon_price != null ? `₹${mapping.amazon_price}` : ""}</a>}
                              {mapping.meesho_url && <a className="border rounded-full px-2 py-1" href={mapping.meesho_url} target="_blank" rel="noreferrer"><ExternalLink className="inline h-3 w-3" /> Meesho {mapping.meesho_price != null ? `₹${mapping.meesho_price}` : ""}</a>}
                            </div>}
                            <div className="mt-3 flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => setProduct(product, mapping)}><Copy className="mr-1 h-4 w-4" /> Configure</Button>
                              {mapping && <Button size="sm" variant="destructive" onClick={async () => {
                                const { error } = await supabase.from("shoppinghub_marketplace_map" as any).delete().eq("whatsapp_retailer_id", mapping.whatsapp_retailer_id);
                                if (error) toast({ title: "Could not delete mapping", description: error.message, variant: "destructive" });
                                else { queryClient.invalidateQueries({ queryKey: ["shoppinghub-marketplace-mappings-v3"] }); toast({ title: "Mapping deleted" }); }
                              }}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
