import { slugify } from "../lib/slugify";

// Always fetch fresh from Supabase on every request
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE = "https://www.viro.pk";

// Direct fetch — same pattern as product/[id]/page.jsx which works correctly
async function fetchFromSupabase(table, selectCols, filters = "") {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("[sitemap] Missing Supabase env vars");
    return null;
  }
  try {
    const res = await fetch(
      `${url}/rest/v1/${table}?select=${encodeURIComponent(selectCols)}${filters}&limit=1000`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      console.error(
        `[sitemap] ${table} fetch failed: ${res.status} ${res.statusText}`,
      );
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[sitemap] ${table} fetch error:`, err.message);
    return null;
  }
}

export default async function sitemap() {
  // ── Static pages ─────────────────────────────────────────────────────────
  const staticPages = [
    {
      url: `${BASE}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE}/shop`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE}/return-policy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  let productUrls = [];
  let categoryUrls = [];

  try {
    // ── Products ─────────────────────────────────────────────────────────────
    const products = await fetchFromSupabase(
      "products",
      "id,name,updated_at,noindex,status",
      "&is_active=eq.true&status=neq.coming_soon&order=updated_at.desc",
    );

    console.log("[sitemap] products fetched:", products?.length ?? 0);

    if (products?.length > 0) {
      productUrls = products
        .filter((p) => !p.noindex)
        .map((p) => ({
          url: `${BASE}/product/${slugify(p.name)}-${p.id}`,
          lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
          changeFrequency: "daily",
          priority: 0.8,
        }));
    }

    // ── Categories ────────────────────────────────────────────────────────────
    const categories = await fetchFromSupabase(
      "categories",
      "slug,updated_at",
      "&is_active=eq.true&slug=not.is.null&slug=neq.",
    );

    console.log("[sitemap] categories fetched:", categories?.length ?? 0);

    if (categories?.length > 0) {
      categoryUrls = categories.map((cat) => ({
        url: `${BASE}/shop/${cat.slug}`,
        lastModified: cat.updated_at ? new Date(cat.updated_at) : new Date(),
        changeFrequency: "weekly",
        priority: 0.85,
      }));
    }
  } catch (err) {
    console.error("[sitemap] unexpected error:", err);
  }

  console.log(
    "[sitemap] total URLs:",
    staticPages.length + categoryUrls.length + productUrls.length,
  );

  return [...staticPages, ...categoryUrls, ...productUrls];
}
