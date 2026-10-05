import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Pencil, Trash2, Plus, ExternalLink, Copy, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

interface WholesaleTier {
  min_quantity: number;
  max_quantity: number | null;
  unit_price: number;
}

interface Mapping {
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
  wholesale_pricing: WholesaleTier[];
  enabled: boolean;
}

interface ProductOption {
  id: string;
  name: string;
}

const emptyForm = {
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
  wholesale_pricing: [] as WholesaleTier[],
  enabled: true,
};

function validUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeProductName(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export default function AdminMarketplaceLinks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Mapping | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [codCharge, setCodCharge] = useState("20");
  const [savingCod, setSavingCod] = useState(false);

  const { data: orderSetting, refetch: refetchCodSetting } = useQuery<{ numeric_value: number | null } | null>({
    queryKey: ["shoppinghub-cod-charge"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("shoppinghub_order_settings" as any) as any)
        .select("numeric_value")
        .eq("setting_key", "cod_charge")
        .maybeSingle();
      if (error) throw error;
      return data || null;
    },
  });

  useEffect(() => {
    if (orderSetting?.numeric_value != null) setCodCharge(String(orderSetting.numeric_value));
  }, [orderSetting]);

  // IMPORTANT: products does NOT have whatsapp_retailer_id in the current
  // database schema. WhatsApp IDs live in shoppinghub_marketplace_map.
  // Only request columns that actually exist in products.
  const {
    data: products = [],
    refetch: refetchProducts,
    isFetching: productsFetching,
  } = useQuery<ProductOption[]>({
    queryKey: ["marketplace-products"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("products" as any) as any)
        .select("id,name")
        .order("name");
      if (error) throw error;
      return (data || []) as ProductOption[];
    },
  });

  const {
    data: mappings = [],
    isLoading,
    refetch: refetchMappings,
  } = useQuery<Mapping[]>({
    queryKey: ["shoppinghub-marketplace-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shoppinghub_marketplace_map" as any)
        .select("*")
        .order("product_name");
      if (error) throw error;
      return (data || []) as Mapping[];
    },
  });

  // The mapping table is the single source of truth for the WhatsApp
  // product_retailer_id. Match it first by product_id, then by product name.
  const getDetectedRetailerId = (product: ProductOption | undefined) => {
    if (!product) return "";

    const byProductId = mappings.find(
      (m) =>
        m.product_id &&
        String(m.product_id) === String(product.id) &&
        m.whatsapp_retailer_id?.trim(),
    );
    if (byProductId?.whatsapp_retailer_id) {
      return byProductId.whatsapp_retailer_id.trim();
    }

    const productName = normalizeProductName(product.name);
    const byName = mappings.find(
      (m) =>
        normalizeProductName(m.product_name) === productName &&
        m.whatsapp_retailer_id?.trim(),
    );
    return byName?.whatsapp_retailer_id?.trim() || "";
  };

  const selectedProduct = products.find((p) => p.id === form.product_id);
  const detectedRetailerId = getDetectedRetailerId(selectedProduct);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const retailerId = form.whatsapp_retailer_id.trim() || detectedRetailerId;
      if (!retailerId) {
        throw new Error(
          "This product has not been detected from WhatsApp yet. Have one customer add it to the WhatsApp cart once, then refresh this page.",
        );
      }

      if (![form.amazon_url, form.meesho_url, form.whatsapp_url].every(validUrl)) {
        throw new Error("Marketplace links must be valid HTTPS URLs.");
      }

      const selected = products.find((p) => p.id === form.product_id);
      const amazonPrice = form.amazon_price.trim() ? Number(form.amazon_price) : null;
      const meeshoPrice = form.meesho_price.trim() ? Number(form.meesho_price) : null;
      const whatsappPrice = form.whatsapp_price.trim() ? Number(form.whatsapp_price) : null;
      if ([amazonPrice, meeshoPrice, whatsappPrice].some((value) => value != null && (!Number.isFinite(value) || value <= 0))) {
        throw new Error("Channel prices must be positive numbers.");
      }

      const payload = {
        whatsapp_retailer_id: retailerId,
        product_id: form.product_id || null,
        product_name: form.product_name.trim() || selected?.name || null,
        amazon_url: form.amazon_url.trim() || null,
        amazon_price: amazonPrice,
        meesho_url: form.meesho_url.trim() || null,
        meesho_price: meeshoPrice,
        whatsapp_url: form.whatsapp_url.trim() || null,
        whatsapp_price: whatsappPrice,
        whatsapp_enabled: form.whatsapp_enabled,
        cod_enabled: form.cod_enabled,
        wholesale_enabled: form.wholesale_enabled,
        wholesale_pricing: form.wholesale_pricing,
        enabled: form.enabled,
      };

      const { error } = await supabase
        .from("shoppinghub_marketplace_map" as any)
        .upsert(payload, { onConflict: "whatsapp_retailer_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shoppinghub-marketplace-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-products"] });
      setEditing(null);
      setForm(emptyForm);
      toast({ title: "Marketplace links saved" });
    },
    onError: (error: any) =>
      toast({
        title: "Could not save mapping",
        description: error.message,
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("shoppinghub_marketplace_map" as any)
        .delete()
        .eq("whatsapp_retailer_id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shoppinghub-marketplace-mappings"] });
      toast({ title: "Mapping deleted" });
    },
    onError: (error: any) =>
      toast({
        title: "Could not delete mapping",
        description: error.message,
        variant: "destructive",
      }),
  });

  const refreshDetectedIds = async () => {
    try {
      // Both queries are refreshed. No products.whatsapp_retailer_id is queried
      // because that column does not exist in this database.
      const [productsResult, mappingsResult] = await Promise.all([
        refetchProducts(),
        refetchMappings(),
      ]);

      if (productsResult.error) throw productsResult.error;
      if (mappingsResult.error) throw mappingsResult.error;

      toast({
        title: "WhatsApp catalog IDs refreshed",
        description:
          "WhatsApp IDs were reloaded from the marketplace mapping table.",
      });
    } catch (error: any) {
      toast({
        title: "Could not refresh WhatsApp IDs",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleProductChange = (value: string) => {
    const selected = products.find((p) => p.id === value);
    const detectedId = getDetectedRetailerId(selected);

    setForm((f) => ({
      ...f,
      product_id: value === "none" ? "" : value,
      product_name: selected?.name || f.product_name,
      whatsapp_retailer_id: detectedId || f.whatsapp_retailer_id,
    }));
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return mappings.filter((m) =>
      !q
        ? true
        : [m.product_name, m.whatsapp_retailer_id, m.amazon_url, m.meesho_url].some(
            (v) => String(v || "").toLowerCase().includes(q),
          ),
    );
  }, [mappings, search]);

  const startEdit = (m: Mapping) => {
    setEditing(m);
    setForm({
      whatsapp_retailer_id: m.whatsapp_retailer_id,
      product_id: m.product_id || "",
      product_name: m.product_name || "",
      amazon_url: m.amazon_url || "",
      amazon_price: m.amazon_price == null ? "" : String(m.amazon_price),
      meesho_url: m.meesho_url || "",
      meesho_price: m.meesho_price == null ? "" : String(m.meesho_price),
      whatsapp_url: m.whatsapp_url || "",
      whatsapp_price: m.whatsapp_price == null ? "" : String(m.whatsapp_price),
      whatsapp_enabled: m.whatsapp_enabled !== false,
      cod_enabled: m.cod_enabled !== false,
      wholesale_enabled: m.wholesale_enabled === true,
      wholesale_pricing: Array.isArray(m.wholesale_pricing) ? m.wholesale_pricing : [],
      enabled: m.enabled,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: "Link copied" });
  };

  const saveCodCharge = async () => {
    const value = Number(codCharge);
    if (!Number.isFinite(value) || value < 0) {
      toast({ title: "Invalid COD charge", description: "Enter zero or a positive amount.", variant: "destructive" });
      return;
    }
    setSavingCod(true);
    try {
      const { error } = await (supabase.from("shoppinghub_order_settings" as any) as any)
        .upsert({ setting_key: "cod_charge", numeric_value: value, updated_at: new Date().toISOString() }, { onConflict: "setting_key" });
      if (error) throw error;
      await refetchCodSetting();
      toast({ title: "COD charge saved", description: `Global COD charge is now ₹${value.toFixed(2)}.` });
    } catch (error: any) {
      toast({ title: "Could not save COD charge", description: error.message, variant: "destructive" });
    } finally {
      setSavingCod(false);
    }
  };

  const addWholesaleTier = () => {
    setForm((current) => ({
      ...current,
      wholesale_pricing: [...current.wholesale_pricing, { min_quantity: 1, max_quantity: null, unit_price: 0 }],
    }));
  };

  const updateWholesaleTier = (index: number, field: keyof WholesaleTier, value: string) => {
    setForm((current) => ({
      ...current,
      wholesale_pricing: current.wholesale_pricing.map((tier, tierIndex) =>
        tierIndex === index
          ? { ...tier, [field]: field === "max_quantity" && value.trim() === "" ? null : Number(value) }
          : tier,
      ),
    }));
  };

  const removeWholesaleTier = (index: number) => {
    setForm((current) => ({
      ...current,
      wholesale_pricing: current.wholesale_pricing.filter((_, tierIndex) => tierIndex !== index),
    }));
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <AdminSidebar activeTab="marketplace-links" onTabChange={() => {}} />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-4 border-b bg-background px-4 sticky top-0 z-40">
            <SidebarTrigger />
            <div>
              <h2 className="font-semibold text-sm">Marketplace Links</h2>
              <p className="text-xs text-muted-foreground">
                WhatsApp catalog → Amazon / Meesho / WhatsApp
              </p>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-auto">
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Marketplace Links</h1>
                  <p className="text-muted-foreground">
                    Configure ordering destinations once for each WhatsApp catalog product.
                    WhatsApp catalog IDs are learned automatically when customers place a cart order.
                  </p>
                </div>

                <Button
                  variant="outline"
                  onClick={refreshDetectedIds}
                  disabled={productsFetching}
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${productsFetching ? "animate-spin" : ""}`}
                  />
                  Refresh WhatsApp IDs
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>
                    {editing ? "Edit Marketplace Mapping" : "Add Marketplace Mapping"}
                  </CardTitle>
                </CardHeader>

                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>ShoppingHub Product</Label>
                    <Select
                      value={form.product_id || "none"}
                      onValueChange={handleProductChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not linked</SelectItem>
                        {products.map((p) => {
                          const detectedId = getDetectedRetailerId(p);
                          return (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                              {detectedId
                                ? " ✓ WhatsApp ID detected"
                                : " — waiting for WhatsApp cart"}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>WhatsApp Catalog Product ID</Label>
                    <Input
                      value={form.whatsapp_retailer_id || detectedRetailerId}
                      disabled={!!editing || !!detectedRetailerId}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          whatsapp_retailer_id: e.target.value,
                        }))
                      }
                      placeholder="Auto-detected after a WhatsApp cart order"
                    />
                    <p className="text-xs text-muted-foreground">
                      {detectedRetailerId
                        ? "Detected automatically from the marketplace mapping. You do not need to copy it from WhatsApp Business."
                        : "Not detected yet. Have a customer add this product to the WhatsApp cart once, then click Refresh WhatsApp IDs."}
                    </p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Product Name</Label>
                    <Input
                      value={form.product_name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, product_name: e.target.value }))
                      }
                      placeholder="Coir Scrubber Pack of 5"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Amazon URL</Label>
                    <Input
                      value={form.amazon_url}
                      onChange={(e) => setForm((f) => ({ ...f, amazon_url: e.target.value }))}
                      placeholder="https://www.amazon.in/..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Amazon Price (₹)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amazon_price}
                      onChange={(e) => setForm((f) => ({ ...f, amazon_price: e.target.value }))}
                      placeholder="219"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Meesho URL</Label>
                    <Input
                      value={form.meesho_url}
                      onChange={(e) => setForm((f) => ({ ...f, meesho_url: e.target.value }))}
                      placeholder="https://www.meesho.com/..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Meesho Price (₹)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.meesho_price}
                      onChange={(e) => setForm((f) => ({ ...f, meesho_price: e.target.value }))}
                      placeholder="229"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>WhatsApp Price (₹)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.whatsapp_price}
                      onChange={(e) => setForm((f) => ({ ...f, whatsapp_price: e.target.value }))}
                      placeholder="199"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>WhatsApp URL (optional)</Label>
                    <Input
                      value={form.whatsapp_url}
                      onChange={(e) => setForm((f) => ({ ...f, whatsapp_url: e.target.value }))}
                      placeholder="Optional direct ordering URL"
                    />
                  </div>

                  <div className="md:col-span-2 rounded-lg border p-4 space-y-4">
                    <div>
                      <div className="font-medium">Ordering Controls</div>
                      <p className="text-xs text-muted-foreground">
                        A channel appears to customers only when it is enabled and has the required price/link configuration.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="flex items-center gap-3">
                        <Switch checked={form.whatsapp_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, whatsapp_enabled: v }))} />
                        <Label>WhatsApp ordering</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch checked={form.cod_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, cod_enabled: v }))} />
                        <Label>COD</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch checked={form.wholesale_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, wholesale_enabled: v }))} />
                        <Label>Wholesale</Label>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2 rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Wholesale Tiers</div>
                        <p className="text-xs text-muted-foreground">Set the unit price for each quantity range.</p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={addWholesaleTier}>
                        <Plus className="mr-1 h-4 w-4" />
                        Add Tier
                      </Button>
                    </div>
                    {form.wholesale_pricing.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No wholesale tiers configured.</p>
                    ) : (
                      <div className="space-y-2">
                        {form.wholesale_pricing.map((tier, index) => (
                          <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto] items-end">
                            <div>
                              <Label>Min Qty</Label>
                              <Input type="number" min="1" step="1" value={tier.min_quantity} onChange={(e) => updateWholesaleTier(index, "min_quantity", e.target.value)} />
                            </div>
                            <div>
                              <Label>Max Qty</Label>
                              <Input type="number" min="1" step="1" value={tier.max_quantity ?? ""} onChange={(e) => updateWholesaleTier(index, "max_quantity", e.target.value)} placeholder="No max" />
                            </div>
                            <div>
                              <Label>Unit Price (₹)</Label>
                              <Input type="number" min="0.01" step="0.01" value={tier.unit_price} onChange={(e) => updateWholesaleTier(index, "unit_price", e.target.value)} />
                            </div>
                            <Button type="button" variant="destructive" size="icon" onClick={() => removeWholesaleTier(index)} aria-label="Remove tier">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-7">
                    <Switch checked={form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
                    <Label>Mapping enabled</Label>
                  </div>

                  <div className="md:col-span-2 flex gap-2">
                    <Button
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                    >
                      {saveMutation.isPending
                        ? "Saving..."
                        : editing
                          ? "Save Changes"
                          : "Add Mapping"}
                    </Button>
                    {editing && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditing(null);
                          setForm(emptyForm);
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <CardTitle>Configured Products ({filtered.length})</CardTitle>
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search product or catalog ID"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </CardHeader>

                <CardContent>
                  {isLoading ? (
                    <p className="text-muted-foreground">Loading mappings...</p>
                  ) : filtered.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground">
                      <Plus className="mx-auto mb-2 h-8 w-8" />
                      <p>No mappings yet. Add your first WhatsApp catalog product above.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filtered.map((m) => (
                        <div
                          key={m.whatsapp_retailer_id}
                          className="rounded-lg border p-4 bg-background"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <div className="font-semibold">
                                {m.product_name || "Unnamed product"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                WhatsApp ID: {m.whatsapp_retailer_id}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full border px-2 py-1">
                                Amazon {m.amazon_url && m.amazon_price != null ? `₹${m.amazon_price}` : "—"}
                              </span>
                              <span className="rounded-full border px-2 py-1">
                                Meesho {m.meesho_url && m.meesho_price != null ? `₹${m.meesho_price}` : "—"}
                              </span>
                              <span className="rounded-full border px-2 py-1">
                                WhatsApp {m.whatsapp_price != null && m.whatsapp_enabled !== false ? `₹${m.whatsapp_price}` : "—"}
                              </span>
                              <span className="rounded-full border px-2 py-1">
                                COD {m.cod_enabled !== false ? "On" : "Off"}
                              </span>
                              <span className="rounded-full border px-2 py-1">
                                Wholesale {m.wholesale_enabled ? "On" : "Off"}
                              </span>
                              <span className="rounded-full border px-2 py-1">
                                {m.enabled ? "Enabled" : "Disabled"}
                              </span>
                            </div>

                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => startEdit(m)}>
                                <Pencil className="mr-1 h-4 w-4" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copy(m.whatsapp_retailer_id)}
                              >
                                <Copy className="mr-1 h-4 w-4" />
                                Copy ID
                              </Button>
                              {m.amazon_url && (
                                <Button size="sm" variant="outline" asChild>
                                  <a href={m.amazon_url} target="_blank" rel="noreferrer">
                                    <ExternalLink className="mr-1 h-4 w-4" />
                                    Amazon
                                  </a>
                                </Button>
                              )}
                              {m.meesho_url && (
                                <Button size="sm" variant="outline" asChild>
                                  <a href={m.meesho_url} target="_blank" rel="noreferrer">
                                    <ExternalLink className="mr-1 h-4 w-4" />
                                    Meesho
                                  </a>
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteMutation.mutate(m.whatsapp_retailer_id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="mr-1 h-4 w-4" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
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
