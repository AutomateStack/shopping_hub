import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BASE_URL = "https://shopshub.vercel.app";

const headers = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=3600",
  "Access-Control-Allow-Origin": "*",
};

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
const strip = (s: string) => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: products, error } = await supabase.from("products").select("id, name, description, price, image_url, stock, category").limit(5000);
  if (error) return new Response(`<?xml version="1.0"?><error>feed unavailable</error>`, { status: 500, headers });
  const items = (products || []).filter((p: any) => p.name && Number(p.price) > 0).map((p: any) => {
    const desc = strip(p.description || p.name).slice(0, 4900) || p.name;
    const image = p.image_url ? `\n      <g:image_link>${esc(p.image_url)}</g:image_link>` : "";
    return `    <item>\n      <g:id>${esc(p.id)}</g:id>\n      <g:title>${esc(String(p.name).slice(0, 150))}</g:title>\n      <g:description>${esc(desc)}</g:description>\n      <g:link>${BASE_URL}/products/${esc(p.id)}</g:link>${image}\n      <g:availability>${(p.stock ?? 0) > 0 ? "in_stock" : "out_of_stock"}</g:availability>\n      <g:price>${Number(p.price).toFixed(2)} INR</g:price>\n      <g:condition>new</g:condition>\n      <g:brand>ShopHub</g:brand>\n      <g:identifier_exists>no</g:identifier_exists>\n      ${p.category ? `<g:product_type>${esc(p.category)}</g:product_type>` : ""}\n      <g:shipping>\n        <g:country>IN</g:country>\n        <g:service>Standard</g:service>\n        <g:price>0.00 INR</g:price>\n      </g:shipping>\n    </item>`;
  }).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n  <channel>\n    <title>ShopHub Product Feed</title>\n    <link>${BASE_URL}</link>\n    <description>Product feed for Google Merchant Center</description>\n${items}\n  </channel>\n</rss>`;
  return new Response(xml, { headers });
});
