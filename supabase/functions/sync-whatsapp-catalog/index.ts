import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type" };
const graphBase = `https://graph.facebook.com/${Deno.env.get("WHATSAPP_GRAPH_VERSION") || "v24.0"}`;
const businessId = Deno.env.get("WHATSAPP_BUSINESS_ID") || "782367400987595";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const clean = (v: unknown) => { const s = String(v ?? "").trim(); return s || null; };
const money = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n / 100 : null; };

async function graph(url: string, token: string) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b?.error?.message || `Meta Graph API ${r.status}`);
  return b;
}
async function catalogProducts(catalogId: string, token: string) {
  const fields = "id,retailer_id,name,description,price,sale_price,currency,image_url,additional_image_urls,url,availability,quantity_to_sell_on_facebook,category,product_type,brand";
  let next = `${graphBase}/${encodeURIComponent(catalogId)}/products?fields=${encodeURIComponent(fields)}&limit=100`;
  const all: any[] = [];
  for (let i = 0; next && i < 100; i++) { const b = await graph(next, token); if (Array.isArray(b.data)) all.push(...b.data); next = b?.paging?.next || ""; }
  return all;
}
async function resolveCatalog(configured: string, token: string) {
  try { await graph(`${graphBase}/${encodeURIComponent(configured)}?fields=id,name,vertical`, token); return configured; }
  catch {
    const b = await graph(`${graphBase}/${encodeURIComponent(businessId)}/owned_product_catalogs?fields=id,name,vertical,product_count&limit=100`, token);
    const cats = Array.isArray(b.data) ? b.data : [];
    if (cats.some((c: any) => String(c.id) === configured)) return configured;
    if (cats.length === 1) return String(cats[0].id);
    throw new Error(`Configured catalog ${configured} is not accessible; accessible catalogs: ${cats.map((c: any) => c.id).join(", ") || "none"}`);
  }
}
function apiKeyAllowed(req: Request) {
  const supplied = req.headers.get("apikey") || "";
  if (!supplied) return false;
  const keys: string[] = [];
  for (const n of ["SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"]) { const v = Deno.env.get(n); if (v) keys.push(v); }
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) { try { const x = JSON.parse(raw); if (Array.isArray(x)) x.forEach(v => keys.push(String(v))); else if (x && typeof x === "object") Object.values(x).forEach(v => keys.push(String(v))); } catch { keys.push(raw); } }
  return keys.includes(supplied);
}
function serviceKey() {
  let key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!key) { const raw = Deno.env.get("SUPABASE_SECRET_KEYS"); if (raw) { try { const x = JSON.parse(raw); key = String(x.default || x.service_role || x.serviceRole || ""); } catch { key = raw; } } }
  return key;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!apiKeyAllowed(req)) return json({ error: "Invalid API key" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL"), token = Deno.env.get("WHATSAPP_ACCESS_TOKEN"), key = serviceKey();
  if (!supabaseUrl || !key) return json({ error: "Supabase server key is not configured" }, 500);
  if (!token) return json({ error: "WHATSAPP_ACCESS_TOKEN is not configured" }, 500);
  const db = createClient(supabaseUrl, key);
  let runId: string | null = null;
  try {
    const { data: cfg, error: cfgError } = await db.from("whatsapp_catalog_sync_config").select("catalog_id,enabled,sync_interval_minutes,last_synced_at").eq("id", true).single();
    if (cfgError) throw cfgError;
    if (!cfg.enabled) return json({ ok: true, skipped: true, reason: "sync disabled" });
    const body = await req.json().catch(() => ({}));
    const force = body?.force === true || body?.source === "admin" || body?.source === "marketplace-links";
    const interval = Math.max(5, Number(cfg.sync_interval_minutes || 15));
    if (!force && cfg.last_synced_at && Date.now() - new Date(cfg.last_synced_at).getTime() < interval * 60000) return json({ ok: true, skipped: true, reason: "sync interval not reached", last_synced_at: cfg.last_synced_at });
    const { data: run, error: runError } = await db.from("whatsapp_catalog_sync_runs").insert({ catalog_id: cfg.catalog_id, status: "running" }).select("id").single();
    if (runError) throw runError;
    runId = run.id;
    const catalogId = await resolveCatalog(String(cfg.catalog_id), token);
    const products = await catalogProducts(catalogId, token);
    let synced = 0, created = 0, updated = 0, unchanged = 0;
    const seen = new Set<string>(), errors: string[] = [];
    for (const item of products) {
      const retailer = clean(item.retailer_id), metaId = clean(item.id), name = clean(item.name);
      if (!retailer || !name) { errors.push(`Skipped ${metaId || "unknown"}: missing retailer_id/name`); continue; }
      seen.add(retailer);
      try {
        let { data: product, error } = await db.from("products").select("id,name,description,price,image_url,stock,whatsapp_retailer_id,whatsapp_product_id").eq("whatsapp_retailer_id", retailer).maybeSingle();
        if (error) throw error;
        if (!product) { const fallback = await db.from("products").select("id,name,description,price,image_url,stock,whatsapp_retailer_id,whatsapp_product_id").ilike("name", name).limit(1).maybeSingle(); if (fallback.error) throw fallback.error; product = fallback.data; }
        const row: any = { name, description: clean(item.description), image_url: clean(item.image_url), category: clean(item.category || item.product_type), stock: Number.isFinite(Number(item.quantity_to_sell_on_facebook)) ? Math.trunc(Number(item.quantity_to_sell_on_facebook)) : 0, whatsapp_catalog_id: catalogId, whatsapp_product_id: metaId, whatsapp_retailer_id: retailer, whatsapp_sync_enabled: true, whatsapp_sync_status: "synced", whatsapp_sync_error: null, whatsapp_last_synced_at: new Date().toISOString(), whatsapp_catalog_source: true, updated_at: new Date().toISOString() };
        const p = money(item.sale_price ?? item.price); if (p !== null) row.price = p;
        let productId: string;
        if (product?.id) { const u = await db.from("products").update(row).eq("id", product.id); if (u.error) throw u.error; updated++; productId = product.id; }
        else { const i = await db.from("products").insert({ ...row, featured: false }).select("id").single(); if (i.error) throw i.error; created++; productId = i.data.id; }
        const urls = [clean(item.image_url), ...(Array.isArray(item.additional_image_urls) ? item.additional_image_urls.map(clean) : [])].filter((x): x is string => !!x);
        if (urls.length) { const d = await db.from("product_images").delete().eq("product_id", productId); if (d.error) throw d.error; const q = await db.from("product_images").insert(urls.map((u, i) => ({ product_id: productId, image_url: u, display_order: i, alt_text: name }))); if (q.error) throw q.error; }
        const mapping = await db.from("shoppinghub_marketplace_map").upsert({ whatsapp_retailer_id: retailer, product_id: productId, product_name: name, enabled: true, updated_at: new Date().toISOString() }, { onConflict: "whatsapp_retailer_id" });
        if (mapping.error) throw mapping.error;
        synced++;
      } catch (e) { const message = e instanceof Error ? e.message : String(e); errors.push(`${retailer}: ${message}`); await db.from("products").update({ whatsapp_sync_status: "error", whatsapp_sync_error: message, whatsapp_last_synced_at: new Date().toISOString() }).eq("whatsapp_retailer_id", retailer); }
    }
    const { data: managed } = await db.from("products").select("id,whatsapp_retailer_id").eq("whatsapp_catalog_id", catalogId).eq("whatsapp_catalog_source", true).eq("whatsapp_sync_enabled", true);
    const stale = (managed || []).filter((p: any) => p.whatsapp_retailer_id && !seen.has(p.whatsapp_retailer_id));
    for (const p of stale) await db.from("products").update({ whatsapp_sync_status: "removed", whatsapp_sync_error: "No longer present in the WhatsApp catalog", updated_at: new Date().toISOString() }).eq("id", p.id);
    const status = errors.length ? "partial" : "success";
    await db.from("whatsapp_catalog_sync_runs").update({ catalog_id: catalogId, status, completed_at: new Date().toISOString(), products_seen: products.length, products_created: created, products_updated: updated, products_unchanged: unchanged, products_removed: stale.length, error_message: errors.length ? errors.slice(0, 20).join(" | ") : null }).eq("id", runId);
    await db.from("whatsapp_catalog_sync_config").update({ catalog_id: catalogId, last_synced_at: new Date().toISOString(), last_sync_status: status, last_sync_error: errors.length ? errors.slice(0, 10).join(" | ") : null, products_synced: synced, updated_at: new Date().toISOString() }).eq("id", true);
    return json({ ok: true, catalog_id: catalogId, total: products.length, synced, created, updated, unchanged, removed: stale.length, errors });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (runId) await db.from("whatsapp_catalog_sync_runs").update({ status: "error", completed_at: new Date().toISOString(), error_message: message }).eq("id", runId);
    await db.from("whatsapp_catalog_sync_config").update({ last_sync_status: "error", last_sync_error: message, updated_at: new Date().toISOString() }).eq("id", true).catch(() => {});
    return json({ ok: false, error: message }, 400);
  }
});
