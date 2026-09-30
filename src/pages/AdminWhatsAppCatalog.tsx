import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, CheckCircle2, AlertCircle, Clock3, Package, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  stock: number;
  whatsapp_catalog_id: string | null;
  whatsapp_product_id: string | null;
  whatsapp_retailer_id: string | null;
  whatsapp_sync_enabled: boolean;
  whatsapp_sync_status: string;
  whatsapp_sync_error: string | null;
  whatsapp_last_synced_at: string | null;
  whatsapp_catalog_source: boolean;
}

interface Config {
  id: boolean;
  catalog_id: string | null;
  enabled: boolean;
  sync_interval_minutes: number;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  products_synced: number;
}

interface SyncRun {
  id: string;
  catalog_id: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  products_seen: number;
  products_created: number;
  products_updated: number;
  products_unchanged: number;
  products_removed: number;
  error_message: string | null;
}

const statusIcon = (status: string) => {
  if (status === "synced" || status === "success") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "error" || status === "partial") return <AlertCircle className="h-4 w-4" />;
  return <Clock3 className="h-4 w-4" />;
};

export default function AdminWhatsAppCatalog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: config, isLoading: configLoading } = useQuery<Config | null>({
    queryKey: ["whatsapp-catalog-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_catalog_sync_config" as any)
        .select("*")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return data as Config | null;
    },
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["whatsapp-catalog-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products" as any)
        .select("id,name,price,image_url,stock,whatsapp_catalog_id,whatsapp_product_id,whatsapp_retailer_id,whatsapp_sync_enabled,whatsapp_sync_status,whatsapp_sync_error,whatsapp_last_synced_at,whatsapp_catalog_source")
        .not("whatsapp_catalog_id", "is", null)
        .order("name");
      if (error) throw error;
      return (data || []) as Product[];
    },
  });

  const { data: runs = [] } = useQuery<SyncRun[]>({
    queryKey: ["whatsapp-catalog-sync-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_catalog_sync_runs" as any)
        .select("*")
        .order("started_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as SyncRun[];
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-whatsapp-catalog", { body: { source: "admin" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-catalog-config"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-catalog-products"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-catalog-sync-runs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: "WhatsApp catalog sync completed", description: `${data?.synced ?? 0} products synchronized.` });
    },
    onError: (error: any) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-catalog-config"] });
      toast({ title: "WhatsApp catalog sync failed", description: error?.message || "Check the sync configuration and Meta access approval.", variant: "destructive" });
    },
  });

  const configMutation = useMutation({
    mutationFn: async (patch: Partial<Config>) => {
      const { error } = await supabase
        .from("whatsapp_catalog_sync_config" as any)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp-catalog-config"] }),
    onError: (error: any) => toast({ title: "Could not update sync settings", description: error.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => [p.name, p.whatsapp_retailer_id, p.whatsapp_product_id].some((v) => String(v || "").toLowerCase().includes(q)));
  }, [products, search]);

  const syncedCount = products.filter((p) => p.whatsapp_sync_status === "synced").length;
  const errorCount = products.filter((p) => p.whatsapp_sync_status === "error").length;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <AdminSidebar activeTab="whatsapp-catalog" onTabChange={() => {}} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-4 border-b bg-background px-4 sticky top-0 z-40">
            <SidebarTrigger />
            <div>
              <h2 className="font-semibold text-sm">WhatsApp Catalog</h2>
              <p className="text-xs text-muted-foreground">WhatsApp Catalog → ShoppingHub products</p>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-auto">
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Catalog Management</h1>
                  <p className="text-muted-foreground">WhatsApp is the catalog source. ShoppingHub mirrors its product information automatically.</p>
                </div>
                <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending || configLoading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                  {syncMutation.isPending ? "Syncing..." : "Sync Now"}
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">WhatsApp Products</p><p className="text-2xl font-bold mt-1">{products.length}</p></CardContent></Card>
                <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Synced</p><p className="text-2xl font-bold mt-1">{syncedCount}</p></CardContent></Card>
                <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Errors</p><p className="text-2xl font-bold mt-1">{errorCount}</p></CardContent></Card>
                <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Last Sync</p><p className="text-sm font-medium mt-2">{config?.last_synced_at ? new Date(config.last_synced_at).toLocaleString() : "Never"}</p></CardContent></Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" /> Sync Settings</CardTitle>
                  {config && <Switch checked={config.enabled} onCheckedChange={(enabled) => configMutation.mutate({ enabled })} />}
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div><Label>WhatsApp Catalog ID</Label><Input className="mt-2" value={config?.catalog_id || ""} readOnly /></div>
                  <div><Label>Interval (minutes)</Label><Input className="mt-2" type="number" min={5} max={1440} value={config?.sync_interval_minutes || 15} onChange={(e) => configMutation.mutate({ sync_interval_minutes: Math.max(5, Math.min(1440, Number(e.target.value) || 15)) })} /></div>
                  <div><Label>Status</Label><div className="mt-2 flex items-center gap-2"><Badge variant={config?.last_sync_status === "success" ? "default" : "secondary"}>{config?.last_sync_status || "not run"}</Badge>{config?.last_sync_error && <span className="text-xs text-destructive line-clamp-2">{config.last_sync_error}</span>}</div></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4"><CardTitle>WhatsApp Catalog Products ({filtered.length})</CardTitle><Input className="max-w-sm" placeholder="Search product or WhatsApp ID" value={search} onChange={(e) => setSearch(e.target.value)} /></CardHeader>
                <CardContent>
                  {productsLoading ? <p className="text-muted-foreground">Loading catalog...</p> : filtered.length === 0 ? <div className="py-12 text-center text-muted-foreground"><Package className="mx-auto h-10 w-10 mb-3" /><p>No WhatsApp-synced products yet.</p><p className="text-sm mt-1">Use Sync Now after Meta catalog API access is approved.</p></div> : <div className="space-y-3">{filtered.map((p) => <div key={p.id} className="flex flex-col gap-3 rounded-lg border bg-background p-4 md:flex-row md:items-center"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted">{p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : <Package className="h-7 w-7 m-4 text-muted-foreground" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium truncate">{p.name}</h3><Badge variant="outline" className="gap-1">{statusIcon(p.whatsapp_sync_status)} {p.whatsapp_sync_status}</Badge></div><p className="text-sm text-muted-foreground">₹{Number(p.price || 0).toFixed(2)} · Stock {p.stock ?? 0} · Retailer ID: {p.whatsapp_retailer_id || "—"}</p>{p.whatsapp_sync_error && <p className="text-xs text-destructive mt-1">{p.whatsapp_sync_error}</p>}</div><div className="text-xs text-muted-foreground text-right">{p.whatsapp_last_synced_at ? new Date(p.whatsapp_last_synced_at).toLocaleString() : "Not synced"}</div></div>)}</div>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Recent Sync Runs</CardTitle></CardHeader>
                <CardContent>{runs.length === 0 ? <p className="text-sm text-muted-foreground">No sync history yet.</p> : <div className="space-y-2">{runs.map((r) => <div key={r.id} className="grid gap-2 rounded-md border p-3 text-sm md:grid-cols-6"><div className="font-medium">{r.status}</div><div>Seen: {r.products_seen}</div><div>Created: {r.products_created}</div><div>Updated: {r.products_updated}</div><div>Removed: {r.products_removed}</div><div className="text-muted-foreground">{new Date(r.started_at).toLocaleString()}</div>{r.error_message && <div className="md:col-span-6 text-xs text-destructive">{r.error_message}</div>}</div>)}</div>}</CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
