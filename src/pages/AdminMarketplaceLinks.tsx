import { useMemo, useState } from "react";
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

interface Mapping {
  whatsapp_retailer_id: string;
  product_id: string | null;
  product_name: string | null;
  amazon_url: string | null;
  meesho_url: string | null;
  whatsapp_url: string | null;
  enabled: boolean;
}

interface ProductOption {
  id: string;
  name: string;
  whatsapp_retailer_id: string | null;
}

const emptyForm = { whatsapp_retailer_id: "", product_id: "", product_name: "", amazon_url: "", meesho_url: "", whatsapp_url: "", enabled: true };

function validUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function AdminMarketplaceLinks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Mapping | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: products = [], refetch: refetchProducts, isFetching: productsFetching } = useQuery<ProductOption[]>({
    queryKey: ["marketplace-products"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("products" as any) as any)
        .select("id,name,whatsapp_retailer_id")
        .order("name");
      if (error) throw error;
      return (data || []) as ProductOption[];
    },
  });

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ["shoppinghub-marketplace-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shoppinghub_marketplace_map" as any).select("*").order("product_name");
      if (error) throw error;
      return (data || []) as Mapping[];
    },
  });

  const selectedProduct = products.find(p => p.id === form.product_id);
  const detectedRetailerId = selectedProduct?.whatsapp_retailer_id?.trim() || "";

  const saveMutation = useMutation({
    mutationFn: async () => {
      const retailerId = form.whatsapp_retailer_id.trim() || detectedRetailerId;
      if (!retailerId) {
        throw new Error("This product has not been detected from WhatsApp yet. Have one customer add it to the WhatsApp cart once, then refresh this page.");
      }
      if (![form.amazon_url, form.meesho_url, form.whatsapp_url].every(validUrl)) {
        throw new Error("Marketplace links must be valid HTTPS URLs.");
      }
      const selected = products.find(p => p.id === form.product_id);
      const payload = {
        whatsapp_retailer_id: retailerId,
        product_id: form.product_id || null,
        product_name: form.product_name.trim() || selected?.name || null,
        amazon_url: form.amazon_url.trim() || null,
        meesho_url: form.meesho_url.trim() || null,
        whatsapp_url: form.whatsapp_url.trim() || null,
        enabled: form.enabled,
      };
      const { error } = await supabase.from("shoppinghub_marketplace_map" as any).upsert(payload, { onConflict: "whatsapp_retailer_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shoppinghub-marketplace-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-products"] });
      setEditing(null); setForm(emptyForm);
      toast({ title: "Marketplace links saved" });
    },
    onError: (error: any) => toast({ title: "Could not save mapping", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shoppinghub_marketplace_map" as any).delete().eq("whatsapp_retailer_id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shoppinghub-marketplace-mappings"] }); toast({ title: "Mapping deleted" }); },
    onError: (error: any) => toast({ title: "Could not delete mapping", description: error.message, variant: "destructive" }),
  });

  const refreshDetectedIds = async () => {
    await refetchProducts();
    toast({ title: "WhatsApp catalog IDs refreshed" });
  };

  const handleProductChange = (value: string) => {
    const selected = products.find(p => p.id === value);
    setForm(f => ({
      ...f,
      product_id: value === "none" ? "" : value,
      product_name: selected?.name || f.product_name,
      whatsapp_retailer_id: selected?.whatsapp_retailer_id || f.whatsapp_retailer_id,
    }));
  };

  const filtered = useMemo(() => mappings.filter((m) => {
    const q = search.toLowerCase();
    return !q || [m.product_name, m.whatsapp_retailer_id, m.amazon_url, m.meesho_url].some(v => String(v || "").toLowerCase().includes(q));
  }), [mappings, search]);

  const startEdit = (m: Mapping) => {
    setEditing(m);
    setForm({
      whatsapp_retailer_id: m.whatsapp_retailer_id,
      product_id: m.product_id || "",
      product_name: m.product_name || "",
      amazon_url: m.amazon_url || "",
      meesho_url: m.meesho_url || "",
      whatsapp_url: m.whatsapp_url || "",
      enabled: m.enabled,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: "Link copied" });
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
              <p className="text-xs text-muted-foreground">WhatsApp catalog → Amazon / Meesho / WhatsApp</p>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-auto">
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Marketplace Links</h1>
                  <p className="text-muted-foreground">Configure ordering destinations once for each WhatsApp catalog product. WhatsApp catalog IDs are learned automatically when customers place a cart order.</p>
                </div>
                <Button variant="outline" onClick={refreshDetectedIds} disabled={productsFetching}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${productsFetching ? "animate-spin" : ""}`} />
                  Refresh WhatsApp IDs
                </Button>
              </div>

              <Card>
                <CardHeader><CardTitle>{editing ? "Edit Marketplace Mapping" : "Add Marketplace Mapping"}</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>ShoppingHub Product</Label>
                    <Select value={form.product_id || "none"} onValueChange={handleProductChange}>
                      <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not linked</SelectItem>
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}{p.whatsapp_retailer_id ? " ✓ WhatsApp ID detected" : " — waiting for WhatsApp cart"}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>WhatsApp Catalog Product ID</Label>
                    <Input
                      value={form.whatsapp_retailer_id || detectedRetailerId}
                      disabled={!!editing || !!detectedRetailerId}
                      onChange={e => setForm(f => ({ ...f, whatsapp_retailer_id: e.target.value }))}
                      placeholder="Auto-detected after a WhatsApp cart order"
                    />
                    <p className="text-xs text-muted-foreground">
                      {detectedRetailerId
                        ? "Detected automatically from a WhatsApp cart order. You do not need to copy it from WhatsApp Business."
                        : "Not detected yet. Ask one test customer to add this product to the WhatsApp cart once, then click Refresh WhatsApp IDs."}
                    </p>
                  </div>

                  <div className="space-y-2 md:col-span-2"><Label>Product Name</Label><Input value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} placeholder="Coir Scrubber Pack of 5" /></div>
                  <div className="space-y-2"><Label>Amazon URL</Label><Input value={form.amazon_url} onChange={e => setForm(f => ({ ...f, amazon_url: e.target.value }))} placeholder="https://www.amazon.in/..." /></div>
                  <div className="space-y-2"><Label>Meesho URL</Label><Input value={form.meesho_url} onChange={e => setForm(f => ({ ...f, meesho_url: e.target.value }))} placeholder="https://www.meesho.com/..." /></div>
                  <div className="space-y-2"><Label>WhatsApp URL (optional)</Label><Input value={form.whatsapp_url} onChange={e => setForm(f => ({ ...f, whatsapp_url: e.target.value }))} placeholder="Optional direct ordering URL" /></div>
                  <div className="flex items-center gap-3 pt-7"><Switch checked={form.enabled} onCheckedChange={v => setForm(f => ({ ...f, enabled: v }))} /><Label>Enabled</Label></div>
                  <div className="md:col-span-2 flex gap-2"><Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving..." : editing ? "Save Changes" : "Add Mapping"}</Button>{editing && <Button variant="outline" onClick={() => { setEditing(null); setForm(emptyForm); }}>Cancel</Button>}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4"><CardTitle>Configured Products ({filtered.length})</CardTitle><div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search product or catalog ID" value={search} onChange={e => setSearch(e.target.value)} /></div></CardHeader>
                <CardContent>
                  {isLoading ? <p className="text-muted-foreground">Loading mappings...</p> : filtered.length === 0 ? <div className="py-10 text-center text-muted-foreground"><Plus className="mx-auto mb-2 h-8 w-8" /><p>No mappings yet. Add your first WhatsApp catalog product above.</p></div> : <div className="space-y-3">{filtered.map(m => <div key={m.whatsapp_retailer_id} className="rounded-lg border p-4 bg-background"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><div className="font-semibold">{m.product_name || "Unnamed product"}</div><div className="text-xs text-muted-foreground">WhatsApp ID: {m.whatsapp_retailer_id}</div></div><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full border px-2 py-1">Amazon {m.amazon_url ? "✓" : "—"}</span><span className="rounded-full border px-2 py-1">Meesho {m.meesho_url ? "✓" : "—"}</span><span className="rounded-full border px-2 py-1">WhatsApp {m.whatsapp_url ? "✓" : "—"}</span><span className="rounded-full border px-2 py-1">{m.enabled ? "Enabled" : "Disabled"}</span></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => startEdit(m)}><Pencil className="mr-1 h-4 w-4" />Edit</Button><Button size="sm" variant="destructive" onClick={() => { if (confirm("Delete this marketplace mapping?")) deleteMutation.mutate(m.whatsapp_retailer_id); }}><Trash2 className="mr-1 h-4 w-4" />Delete</Button></div></div><div className="mt-3 grid gap-2 text-sm md:grid-cols-3">{m.amazon_url && <div className="flex items-center gap-1 min-w-0"><a className="truncate text-primary hover:underline" href={m.amazon_url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 inline h-3 w-3" />Amazon</a><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copy(m.amazon_url!)}><Copy className="h-3 w-3" /></Button></div>}{m.meesho_url && <div className="flex items-center gap-1 min-w-0"><a className="truncate text-primary hover:underline" href={m.meesho_url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 inline h-3 w-3" />Meesho</a><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copy(m.meesho_url!)}><Copy className="h-3 w-3" /></Button></div>}{m.whatsapp_url && <div className="flex items-center gap-1 min-w-0"><a className="truncate text-primary hover:underline" href={m.whatsapp_url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 inline h-3 w-3" />WhatsApp</a><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copy(m.whatsapp_url!)}><Copy className="h-3 w-3" /></Button></div>}</div></div>)}</div>}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
