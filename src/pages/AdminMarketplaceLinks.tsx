import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Pencil, Trash2, Plus, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Mapping {
  whatsapp_retailer_id: string;
  product_id: string | null;
  product_name: string | null;
  amazon_url: string | null;
  meesho_url: string | null;
  whatsapp_url: string | null;
  enabled: boolean;
}

const emptyForm = { whatsapp_retailer_id: "", product_id: "", product_name: "", amazon_url: "", meesho_url: "", whatsapp_url: "", enabled: true };

export default function AdminMarketplaceLinks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Mapping | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: products = [] } = useQuery({
    queryKey: ["marketplace-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,name").order("name");
      if (error) throw error;
      return data || [];
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.whatsapp_retailer_id.trim()) throw new Error("WhatsApp Catalog Product ID is required.");
      const payload = {
        whatsapp_retailer_id: form.whatsapp_retailer_id.trim(),
        product_id: form.product_id || null,
        product_name: form.product_name.trim() || products.find((p: any) => p.id === form.product_id)?.name || null,
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
  });

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
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Marketplace Links</h1>
        <p className="text-muted-foreground">Manage Amazon, Meesho and WhatsApp destinations for every WhatsApp catalog product.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>{editing ? "Edit Marketplace Mapping" : "Add Marketplace Mapping"}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label>WhatsApp Catalog Product ID *</Label><Input value={form.whatsapp_retailer_id} disabled={!!editing} onChange={e => setForm(f => ({ ...f, whatsapp_retailer_id: e.target.value }))} placeholder="e.g. w7ivha0s34" /></div>
          <div className="space-y-2"><Label>ShoppingHub Product</Label><Select value={form.product_id || "none"} onValueChange={v => setForm(f => ({ ...f, product_id: v === "none" ? "" : v, product_name: products.find((p: any) => p.id === v)?.name || f.product_name }))}><SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger><SelectContent><SelectItem value="none">Not linked</SelectItem>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2 md:col-span-2"><Label>Product Name</Label><Input value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} placeholder="Shown to admin / customers" /></div>
          <div className="space-y-2"><Label>Amazon URL</Label><Input value={form.amazon_url} onChange={e => setForm(f => ({ ...f, amazon_url: e.target.value }))} placeholder="https://www.amazon.in/..." /></div>
          <div className="space-y-2"><Label>Meesho URL</Label><Input value={form.meesho_url} onChange={e => setForm(f => ({ ...f, meesho_url: e.target.value }))} placeholder="https://www.meesho.com/..." /></div>
          <div className="space-y-2"><Label>WhatsApp URL (optional)</Label><Input value={form.whatsapp_url} onChange={e => setForm(f => ({ ...f, whatsapp_url: e.target.value }))} placeholder="Optional direct ordering URL" /></div>
          <div className="flex items-center gap-3 pt-7"><Switch checked={form.enabled} onCheckedChange={v => setForm(f => ({ ...f, enabled: v }))} /><Label>Enabled</Label></div>
          <div className="md:col-span-2 flex gap-2"><Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>{editing ? "Save Changes" : "Add Mapping"}</Button>{editing && <Button variant="outline" onClick={() => { setEditing(null); setForm(emptyForm); }}>Cancel</Button>}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4"><CardTitle>Configured Products ({filtered.length})</CardTitle><div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search product or catalog ID" value={search} onChange={e => setSearch(e.target.value)} /></div></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Loading mappings...</p> : filtered.length === 0 ? <div className="py-10 text-center text-muted-foreground"><Plus className="mx-auto mb-2 h-8 w-8" /><p>No mappings yet. Add your first WhatsApp catalog product above.</p></div> : <div className="space-y-3">{filtered.map(m => <div key={m.whatsapp_retailer_id} className="rounded-lg border p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><div className="font-semibold">{m.product_name || "Unnamed product"}</div><div className="text-xs text-muted-foreground">WhatsApp ID: {m.whatsapp_retailer_id}</div></div><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full border px-2 py-1">Amazon {m.amazon_url ? "✓" : "—"}</span><span className="rounded-full border px-2 py-1">Meesho {m.meesho_url ? "✓" : "—"}</span><span className="rounded-full border px-2 py-1">WhatsApp {m.whatsapp_url ? "✓" : "—"}</span><span className="rounded-full border px-2 py-1">{m.enabled ? "Enabled" : "Disabled"}</span></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => startEdit(m)}><Pencil className="mr-1 h-4 w-4" />Edit</Button><Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(m.whatsapp_retailer_id)}><Trash2 className="mr-1 h-4 w-4" />Delete</Button></div></div><div className="mt-3 grid gap-2 text-sm md:grid-cols-3">{m.amazon_url && <a className="truncate text-primary hover:underline" href={m.amazon_url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 inline h-3 w-3" />Amazon</a>}{m.meesho_url && <a className="truncate text-primary hover:underline" href={m.meesho_url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 inline h-3 w-3" />Meesho</a>}{m.whatsapp_url && <a className="truncate text-primary hover:underline" href={m.whatsapp_url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 inline h-3 w-3" />WhatsApp</a>}</div></div>)}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
