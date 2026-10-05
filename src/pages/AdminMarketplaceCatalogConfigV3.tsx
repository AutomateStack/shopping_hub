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
type Mapping = { whatsapp_retailer_id: string; product_id: string | null; product_name: string | null; amazon_url: string | null; amazon_price: number | null; meesho_url: string | null; meesho_price: number | null; whatsapp_url: string | null; whatsapp_price: number | null; whatsapp_enabled: boolean; cod_enabled: boolean; wholesale_enabled: boolean; wholesale_pricing: Tier[]; enabled: boolean };
type Form = { whatsapp_retailer_id:string; product_id:string; product_name:string; amazon_url:string; amazon_price:string|number; meesho_url:string; meesho_price:string|number; whatsapp_url:string; whatsapp_price:string|number; whatsapp_enabled:boolean; cod_enabled:boolean; wholesale_enabled:boolean; wholesale_pricing:Tier[]; enabled:boolean };

const pendingId = (id:string) => `pending:${id}`;
const isPending = (id:string|null|undefined) => String(id||"").startsWith("pending:");
const blank:Form = { whatsapp_retailer_id:"", product_id:"", product_name:"", amazon_url:"", amazon_price:"", meesho_url:"", meesho_price:"", whatsapp_url:"", whatsapp_price:"", whatsapp_enabled:true, cod_enabled:true, wholesale_enabled:false, wholesale_pricing:[], enabled:true };
const https = (v:string) => { if (!v.trim()) return true; try { return new URL(v.trim()).protocol === "https:"; } catch { return false; } };
const num = (v:string|number) => { const s=String(v??"").trim(); return s ? Number(s) : null; };

export default function AdminMarketplaceCatalogConfigV3() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected,setSelected] = useState("");
  const [search,setSearch] = useState("");
  const [form,setForm] = useState<Form>(blank);

  const {data:products=[],isLoading:loadingProducts} = useQuery<Product[]>({
    queryKey:["marketplace-catalog-products-v3"],
    queryFn:async()=>{ const {data,error}=await supabase.from("products" as any).select("id,name,whatsapp_retailer_id,whatsapp_catalog_id").order("name"); if(error)throw error; return (data||[]) as Product[]; }
  });
  const {data:mappings=[],isLoading:loadingMappings} = useQuery<Mapping[]>({
    queryKey:["shoppinghub-marketplace-mappings-v3"],
    queryFn:async()=>{ const {data,error}=await supabase.from("shoppinghub_marketplace_map" as any).select("*").order("product_name"); if(error)throw error; return (data||[]) as Mapping[]; }
  });
  const byProduct = useMemo(()=>new Map(mappings.filter(m=>m.product_id).map(m=>[String(m.product_id),m])),[mappings]);
  const byRetailer = useMemo(()=>new Map(mappings.map(m=>[m.whatsapp_retailer_id,m])),[mappings]);

  const loadProduct = (p:Product) => {
    const m = byProduct.get(p.id) || (p.whatsapp_retailer_id ? byRetailer.get(p.whatsapp_retailer_id) : undefined);
    const rid = p.whatsapp_retailer_id || m?.whatsapp_retailer_id || "";
    setSelected(p.id);
    setForm({ whatsapp_retailer_id:isPending(rid)?"":rid, product_id:p.id, product_name:m?.product_name||p.name, amazon_url:m?.amazon_url||"", amazon_price:m?.amazon_price??"", meesho_url:m?.meesho_url||"", meesho_price:m?.meesho_price??"", whatsapp_url:m?.whatsapp_url||"", whatsapp_price:m?.whatsapp_price??"", whatsapp_enabled:m?.whatsapp_enabled!==false, cod_enabled:m?.cod_enabled!==false, wholesale_enabled:m?.wholesale_enabled===true, wholesale_pricing:Array.isArray(m?.wholesale_pricing)?m!.wholesale_pricing:[], enabled:m?.enabled!==false });
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const sync = useMutation({
    mutationFn:async()=>{ const {data,error}=await supabase.functions.invoke("sync-whatsapp-catalog",{body:{source:"marketplace-links"}}); if(error)throw error; if(data?.error)throw new Error(data.error); return data; },
    onSuccess:d=>{ qc.invalidateQueries({queryKey:["marketplace-catalog-products-v3"]}); qc.invalidateQueries({queryKey:["shoppinghub-marketplace-mappings-v3"]}); toast({title:"Catalog refreshed",description:`${d?.synced??0} products synchronized.`}); },
    onError:(e:any)=>{ const msg=String(e?.message||"Catalog refresh failed"); const meta=msg.includes("#200")||msg.toLowerCase().includes("not been approved"); toast({title:"WhatsApp catalog refresh unavailable",description:meta?"Meta is rejecting catalog API access (#200). You can still configure products here and add the real Catalog Product ID later.":msg,variant:"destructive"}); }
  });

  const save = useMutation({
    mutationFn:async()=>{
      if(!form.product_id)throw new Error("Select a ShoppingHub product.");
      const actualId=form.whatsapp_retailer_id.trim();
      const retailerId=actualId||pendingId(form.product_id);
      const amazonPrice=num(form.amazon_price), meeshoPrice=num(form.meesho_price), whatsappPrice=num(form.whatsapp_price);
      if(!https(form.amazon_url)||!https(form.meesho_url)||!https(form.whatsapp_url))throw new Error("Marketplace links must be HTTPS URLs.");
      if([amazonPrice,meeshoPrice,whatsappPrice].some(v=>v!=null&&(!Number.isFinite(v)||v<=0)))throw new Error("Prices must be positive numbers.");
      if((form.whatsapp_enabled||form.cod_enabled)&&whatsappPrice==null)throw new Error("WhatsApp Price is required while WhatsApp or COD ordering is enabled.");
      if(actualId){ const other=byRetailer.get(actualId); if(other?.product_id && String(other.product_id)!==String(form.product_id))throw new Error(`WhatsApp Catalog Product ID ${actualId} is already linked to another product.`); }
      const tiers=form.wholesale_pricing.map(t=>({min_quantity:Number(t.min_quantity),max_quantity:t.max_quantity==null?null:Number(t.max_quantity),unit_price:Number(t.unit_price)}));
      if(form.wholesale_enabled&&!tiers.length)throw new Error("Add at least one wholesale tier or disable Wholesale.");
      for(const t of tiers){ if(!Number.isInteger(t.min_quantity)||t.min_quantity<1)throw new Error("Wholesale minimum quantity must be a whole number greater than 0."); if(t.max_quantity!=null&&(!Number.isInteger(t.max_quantity)||t.max_quantity<t.min_quantity))throw new Error("Wholesale maximum quantity must be blank or greater than/equal to the minimum quantity."); if(!Number.isFinite(t.unit_price)||t.unit_price<=0)throw new Error("Wholesale unit price must be greater than 0."); }
      const sorted=[...tiers].sort((a,b)=>a.min_quantity-b.min_quantity); for(let i=1;i<sorted.length;i++){ if(sorted[i-1].max_quantity==null||sorted[i-1].max_quantity>=sorted[i].min_quantity)throw new Error("Wholesale tiers overlap. Set the next minimum above the previous maximum."); }
      const payload={whatsapp_retailer_id:retailerId,product_id:form.product_id,product_name:form.product_name,amazon_url:form.amazon_url.trim()||null,amazon_price:amazonPrice,meesho_url:form.meesho_url.trim()||null,meesho_price:meeshoPrice,whatsapp_url:form.whatsapp_url.trim()||null,whatsapp_price:whatsappPrice,whatsapp_enabled:form.whatsapp_enabled,cod_enabled:form.cod_enabled,wholesale_enabled:form.wholesale_enabled,wholesale_pricing:tiers,enabled:form.enabled,updated_at:new Date().toISOString()};
      const existing=byProduct.get(form.product_id);
      if(existing){ const {error}=await supabase.from("shoppinghub_marketplace_map" as any).update(payload).eq("whatsapp_retailer_id",existing.whatsapp_retailer_id); if(error)throw error; }
      else { const {error}=await supabase.from("shoppinghub_marketplace_map" as any).insert(payload); if(error)throw error; }
      if(actualId){ const {error}=await supabase.from("products" as any).update({whatsapp_retailer_id:actualId}).eq("id",form.product_id); if(error)throw error; }
    },
    onSuccess:()=>{ qc.invalidateQueries({queryKey:["shoppinghub-marketplace-mappings-v3"]}); qc.invalidateQueries({queryKey:["marketplace-catalog-products-v3"]}); toast({title:"Configuration saved"}); },
    onError:(e:any)=>toast({title:"Could not save configuration",description:e.message,variant:"destructive"})
  });

  const rows=products.filter(p=>{const q=search.toLowerCase().trim(); return !q||p.name.toLowerCase().includes(q)||String(p.whatsapp_retailer_id||"").toLowerCase().includes(q);});
  const updateTier=(i:number,key:keyof Tier,value:number|null)=>setForm(f=>({...f,wholesale_pricing:f.wholesale_pricing.map((t,j)=>j===i?{...t,[key]:value}:t)}));

  return <SidebarProvider><div className="min-h-screen flex w-full bg-muted/30"><AdminSidebar activeTab="marketplace-links" onTabChange={()=>{}}/><div className="flex-1 min-w-0"><header className="h-14 flex items-center gap-4 border-b bg-background px-4 sticky top-0 z-40"><SidebarTrigger/><div><h2 className="font-semibold text-sm">Marketplace Links</h2><p className="text-xs text-muted-foreground">WhatsApp catalog → Amazon / Meesho / WhatsApp</p></div></header><main className="p-6"><div className="max-w-7xl mx-auto space-y-6">
    <div className="flex flex-col md:flex-row md:justify-between gap-3"><div><h1 className="text-2xl font-bold">Product Order Channels</h1><p className="text-muted-foreground">Configure every ShoppingHub product even when Meta catalog sync is unavailable.</p></div><Button variant="outline" onClick={()=>sync.mutate()} disabled={sync.isPending}><RefreshCw className={`mr-2 h-4 w-4 ${sync.isPending?"animate-spin":""}`}/>{sync.isPending?"Refreshing...":"Refresh WhatsApp Catalog"}</Button></div>
    <Card><CardHeader><CardTitle>Configure Product</CardTitle></CardHeader><CardContent className="space-y-5">
      <div><Label>Select Product</Label><select className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm" value={selected} onChange={e=>{const p=products.find(x=>x.id===e.target.value); if(p)loadProduct(p); else {setSelected("");setForm(blank);}}}><option value="">Select product...</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div className="rounded-md border bg-muted/30 p-3"><div className="font-semibold">{form.product_name||"No product selected"}</div><div className="text-xs text-muted-foreground mt-1">WhatsApp Catalog Product ID: {form.whatsapp_retailer_id||"Not synchronized yet"}</div></div>
      <div><Label>WhatsApp Catalog Product ID <span className="text-muted-foreground">(optional until sync)</span></Label><Input className="mt-2" value={form.whatsapp_retailer_id} onChange={e=>setForm({...form,whatsapp_retailer_id:e.target.value})} placeholder="e.g. w7ivha0s34"/></div>
      <div className="grid md:grid-cols-2 gap-3"><div><Label>Amazon URL</Label><Input className="mt-2" value={form.amazon_url} onChange={e=>setForm({...form,amazon_url:e.target.value})}/></div><div><Label>Amazon Price (₹)</Label><Input className="mt-2" type="number" min="0" value={form.amazon_price} onChange={e=>setForm({...form,amazon_price:e.target.value})}/></div><div><Label>Meesho URL</Label><Input className="mt-2" value={form.meesho_url} onChange={e=>setForm({...form,meesho_url:e.target.value})}/></div><div><Label>Meesho Price (₹)</Label><Input className="mt-2" type="number" min="0" value={form.meesho_price} onChange={e=>setForm({...form,meesho_price:e.target.value})}/></div><div><Label>WhatsApp Price (₹) <span className="text-destructive">*</span></Label><Input className="mt-2" type="number" min="0" value={form.whatsapp_price} onChange={e=>setForm({...form,whatsapp_price:e.target.value})} placeholder="Required for WhatsApp/COD"/></div><div><Label>WhatsApp URL (optional)</Label><Input className="mt-2" value={form.whatsapp_url} onChange={e=>setForm({...form,whatsapp_url:e.target.value})}/></div></div>
      <div className="rounded-lg border p-4"><div className="font-medium mb-3">Ordering Controls</div><div className="flex flex-wrap gap-6"><label className="flex gap-2 items-center"><Switch checked={form.whatsapp_enabled} onCheckedChange={v=>setForm({...form,whatsapp_enabled:v})}/>WhatsApp</label><label className="flex gap-2 items-center"><Switch checked={form.cod_enabled} onCheckedChange={v=>setForm({...form,cod_enabled:v})}/>COD</label><label className="flex gap-2 items-center"><Switch checked={form.wholesale_enabled} onCheckedChange={v=>setForm({...form,wholesale_enabled:v})}/>Wholesale</label><label className="flex gap-2 items-center"><Switch checked={form.enabled} onCheckedChange={v=>setForm({...form,enabled:v})}/>Enabled</label></div></div>
      <div className="rounded-lg border p-4"><div className="flex items-center justify-between gap-3"><div><div className="font-medium">Wholesale Tiers</div><p className="text-xs text-muted-foreground">Minimum quantity, optional maximum quantity and unit price.</p></div><Button type="button" size="sm" variant="outline" onClick={()=>setForm(f=>({...f,wholesale_pricing:[...f.wholesale_pricing,{min_quantity:1,max_quantity:null,unit_price:0}]}))}><Plus className="mr-1 h-4 w-4"/>Add tier</Button></div><div className="mt-4 space-y-3">{form.wholesale_pricing.length===0?<p className="text-sm text-muted-foreground">No wholesale tiers added.</p>:form.wholesale_pricing.map((t,i)=><div key={i} className="rounded-md border bg-muted/20 p-3"><div className="flex items-center justify-between mb-2"><span className="text-sm font-medium">Tier {i+1}</span><Button type="button" variant="destructive" size="icon" onClick={()=>setForm(f=>({...f,wholesale_pricing:f.wholesale_pricing.filter((_,j)=>j!==i)}))}><Trash2 className="h-4 w-4"/></Button></div><div className="grid md:grid-cols-3 gap-3"><div><Label className="text-xs">Minimum quantity</Label><Input className="mt-1" type="number" min="1" step="1" value={t.min_quantity} onChange={e=>updateTier(i,"min_quantity",Number(e.target.value))}/></div><div><Label className="text-xs">Maximum quantity <span className="text-muted-foreground">(optional)</span></Label><Input className="mt-1" type="number" min="1" step="1" placeholder="No limit" value={t.max_quantity??""} onChange={e=>updateTier(i,"max_quantity",e.target.value?Number(e.target.value):null)}/></div><div><Label className="text-xs">Unit price (₹)</Label><Input className="mt-1" type="number" min="0.01" step="0.01" value={t.unit_price} onChange={e=>updateTier(i,"unit_price",Number(e.target.value))}/></div></div></div>)}</div></div>
      <Button onClick={()=>save.mutate()} disabled={save.isPending||!form.product_id}>{save.isPending?"Saving...":"Save Configuration"}</Button>
    </CardContent></Card>
    <Card><CardHeader className="flex flex-row justify-between gap-4"><CardTitle>All Catalog / ShoppingHub Products ({rows.length})</CardTitle><div className="w-full max-w-sm relative"><Search className="absolute left-3 top-3 h-4 w-4"/><Input className="pl-9" placeholder="Search product or ID" value={search} onChange={e=>setSearch(e.target.value)}/></div></CardHeader><CardContent>{loadingProducts||loadingMappings?<p>Loading...</p>:<div className="space-y-3">{rows.map(p=>{const m=byProduct.get(p.id);const pending=!!m&&isPending(m.whatsapp_retailer_id);return <div className="border rounded-lg p-4" key={p.id}><div className="font-semibold">{p.name}</div><div className="text-xs text-muted-foreground mt-1">{p.whatsapp_retailer_id?`WhatsApp ID: ${p.whatsapp_retailer_id}`:pending?"WhatsApp ID: Pending sync":"WhatsApp ID: Not synchronized"} · {m?(pending?"Configured · pending ID":"Configured"):"Not configured"}</div>{m&&<div className="flex flex-wrap gap-2 mt-2 text-xs"><span className="border rounded-full px-2 py-1">WhatsApp {m.whatsapp_price!=null?`₹${m.whatsapp_price}`:"Missing price"}</span><span className="border rounded-full px-2 py-1">COD {m.cod_enabled?"On":"Off"}</span><span className="border rounded-full px-2 py-1">Wholesale {m.wholesale_enabled?"On":"Off"}</span>{m.amazon_url&&<a className="border rounded-full px-2 py-1" href={m.amazon_url} target="_blank" rel="noreferrer"><ExternalLink className="inline h-3 w-3"/> Amazon</a>}</div>}<div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={()=>loadProduct(p)}><Copy className="mr-1 h-4 w-4"/>Configure</Button>{m&&<Button size="sm" variant="destructive" onClick={async()=>{const {error}=await supabase.from("shoppinghub_marketplace_map" as any).delete().eq("whatsapp_retailer_id",m.whatsapp_retailer_id);if(error)toast({title:"Could not delete mapping",description:error.message,variant:"destructive"});else{qc.invalidateQueries({queryKey:["shoppinghub-marketplace-mappings-v3"]});toast({title:"Mapping deleted"});}}}><Trash2 className="mr-1 h-4 w-4"/>Delete</Button>}</div></div>})}</div>}</CardContent></Card>
  </div></main></div></div></SidebarProvider>;
}
