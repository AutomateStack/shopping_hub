import { useEffect } from "react";

interface SEOHeadProps {
  title?: string;
  description?: string;
  canonical?: string;
  type?: string;
  image?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const BASE_URL = "https://shopshub.vercel.app";
const DEFAULT_IMAGE = "https://shopshub.vercel.app/og-image.jpg";
const SITE_NAME = "ShoppingHub";
const TWITTER_HANDLE = "@shopshub";

export function SEOHead({
  title = "ShoppingHub — Online Shopping for Electronics, Fashion, Home & More",
  description = "Shop the best deals on electronics, clothing, home essentials & more at ShoppingHub. Curated collections, secure payments, fast delivery & easy returns.",
  canonical,
  type = "website",
  image = DEFAULT_IMAGE,
  noindex = false,
  jsonLd,
}: SEOHeadProps) {
  useEffect(() => {
    document.title = title;

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("name", "description", description);
    if (noindex) {
      setMeta("name", "robots", "noindex, nofollow");
    } else {
      setMeta("name", "robots", "index, follow, max-image-preview:large, max-snippet:-1");
    }
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", type);
    setMeta("property", "og:image", image);
    setMeta("property", "og:image:alt", title);
    setMeta("property", "og:site_name", SITE_NAME);
    setMeta("property", "og:locale", "en_IN");
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", image);
    setMeta("name", "twitter:image:alt", title);
    setMeta("name", "twitter:site", TWITTER_HANDLE);
    setMeta("name", "twitter:creator", TWITTER_HANDLE);

    if (canonical) {
      setMeta("property", "og:url", `${BASE_URL}${canonical}`);
      setMeta("name", "twitter:url", `${BASE_URL}${canonical}`);
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      link.setAttribute("href", `${BASE_URL}${canonical}`);
    }

    if (jsonLd) {
      const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      const ids: string[] = [];
      items.forEach((ld, i) => {
        const id = `dynamic-jsonld-${i}`;
        ids.push(id);
        let script = document.getElementById(id) as HTMLScriptElement;
        if (!script) {
          script = document.createElement("script");
          script.id = id;
          script.type = "application/ld+json";
          document.head.appendChild(script);
        }
        script.textContent = JSON.stringify(ld);
      });
      return () => { ids.forEach(id => document.getElementById(id)?.remove()); };
    }
  }, [title, description, canonical, type, image, noindex, jsonLd]);

  return null;
}
