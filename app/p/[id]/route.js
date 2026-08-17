export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── Bot detection patterns ────────────────────────────────────────────────────

// Search engine bots — must ALWAYS get a clean 308 redirect, never the OG page.
// A meta-refresh or JS redirect from /p/ to /product/ counts as a "Redirect error"
// in Google Search Console and prevents product pages from being indexed.
const SEARCH_BOT_UA =
  /googlebot|bingbot|yandex|duckduckbot|baiduspider|msnbot|teoma|slurp/i;

// Social media crawlers — serve the OG card HTML to these.
const SOCIAL_CRAWLER_UA =
  /whatsapp|telegrambot|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|applebot|imessageurlpreview|skypeuripreview|vkshare|pinterest/i;

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFirstImage(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    return (
      raw.find((u) => typeof u === "string" && u.startsWith("http")) ?? null
    );
  }
  if (typeof raw === "string") {
    if (raw.startsWith("http")) return raw;
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr))
        return (
          arr.find((u) => typeof u === "string" && u.startsWith("http")) ?? null
        );
    } catch {}
  }
  return null;
}

async function fetchProduct(id) {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supaUrl || !supaKey) return null;
  try {
    const r = await fetch(
      `${supaUrl}/rest/v1/products?id=eq.${encodeURIComponent(id)}&select=id,name,price,discount_price,images,description,meta_title,meta_description,og_title,og_description&limit=1`,
      {
        headers: {
          apikey: supaKey,
          Authorization: `Bearer ${supaKey}`,
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
      },
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return rows?.[0] ?? null;
  } catch {
    return null;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(request, { params }) {
  const { id } = await params;
  const ua = request.headers.get("user-agent") || "";

  // ── FIX: Search bots get an immediate 308 permanent redirect ─────────────
  // This is the fix for the Google Search Console "Redirect error" affecting
  // 54 product pages. Previously, Googlebot would occasionally discover /p/ URLs
  // (via shared WhatsApp links crawled from the web) and receive a meta-refresh
  // page — which Google treats as a soft redirect error, not a proper 301/308.
  // With this 308, Google immediately resolves /p/<uuid> → /product/<uuid> and
  // never reports a redirect error for those URLs.
  if (SEARCH_BOT_UA.test(ua)) {
    return new Response(null, {
      status: 308,
      headers: {
        Location: `https://www.viro.pk/product/${id}`,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  }

  // Social bots and humans continue to the full OG card logic below.
  const p = await fetchProduct(id);

  const productUrl = `https://www.viro.pk/product/${id}`;
  // UTM params added to product URL so Google Analytics tracks WhatsApp share traffic
  const productUrlUtm = `https://www.viro.pk/product/${id}?utm_source=whatsapp&utm_medium=share&utm_campaign=product_share`;
  // og:url should be the canonical product URL — when WhatsApp user taps the card,
  // they go to the full product page, not the /p/ share stub.
  const ogUrl = productUrl;

  // ── Build OG values ──────────────────────────────────────────────────────
  // og:image goes through /api/og which returns 1200×630 landscape JPEG bytes.
  // WhatsApp large banner requires landscape ratio ≥1.91:1.
  // Product images are 800×800 square → small card without this proxy.
  // /api/og uses sharp to composite the product image onto a branded canvas.
  const rawImg = p
    ? (parseFirstImage(p.images) ?? "https://www.viro.pk/og-image.jpg")
    : "https://www.viro.pk/og-image.jpg";
  // Use /api/og?id= to get a 1200×630 LANDSCAPE image.
  // WhatsApp shows large banner cards ONLY for landscape images (≥1.91:1 ratio).
  // Square product images (800×800) trigger the small "summary" card.
  // /api/og composes the product image onto a 1200×630 branded canvas using sharp.
  // It never redirects — always returns image bytes directly.
  const ogImage = p
    ? `https://www.viro.pk/api/og?id=${id}`
    : "https://www.viro.pk/og-image.jpg";

  const hasDisc =
    p && p.discount_price && Number(p.discount_price) < Number(p.price);
  const price = p ? (hasDisc ? p.discount_price : p.price) : null;
  const origPr = p?.price;
  const discPct = hasDisc
    ? Math.round((1 - p.discount_price / p.price) * 100)
    : 0;
  const savings = hasDisc ? Math.round(p.price - p.discount_price) : 0;

  const name = p?.name ?? "Product";

  // og:title = what WhatsApp shows in BOLD below the image
  // Keep it short: product name only (WhatsApp truncates long titles)
  const ogTitle = p
    ? p.og_title || p.meta_title || name
    : "Viro.pk — Online Shopping Pakistan";

  // og:description = 1-2 lines WhatsApp shows below the bold title
  // Lead with price + discount — that's what drives clicks
  const ogDesc = p
    ? p.og_description ||
      p.meta_description ||
      (hasDisc
        ? `Rs.${Number(price).toLocaleString()} ✦ ${discPct}% OFF — Save Rs.${Number(savings).toLocaleString()} | ✅ COD • 🚚 Fast Delivery`
        : `Rs.${Number(price).toLocaleString()} | ✅ Cash on Delivery • 🚚 FREE Delivery across Pakistan`)
    : "Quality products. Free delivery. Cash on delivery. Trusted by shoppers across Pakistan.";

  // ── Render card for humans (visible < 0.5s before redirect) ─────────────
  const cardHtml = p
    ? `
    <div class="card">
      <img src="${rawImg}" alt="${name.replace(/"/g, "&quot;")}" class="img" />
      <div class="name">${name}</div>
      <div class="price">
        <span class="cur">Rs.${Number(price).toLocaleString()}</span>
        ${
          hasDisc
            ? `
          <span class="orig">Rs.${Number(origPr).toLocaleString()}</span>
          <span class="badge">-${discPct}% OFF</span>
        `
            : ""
        }
      </div>
      <a href="${productUrl}" class="btn">View Product →</a>
      <p class="meta">✅ Cash on Delivery &nbsp;·&nbsp; 🚚 Fast Delivery</p>
      <div class="brand">viro.pk</div>
    </div>
  `
    : `<div class="card"><div class="name">Viro.pk</div><a href="https://www.viro.pk" class="btn">Go to Store →</a></div>`;

  // ── Raw HTML — exactly what the crawler receives ─────────────────────────
  // CRITICAL: every og: and twitter: tag must be in <head>.
  // No Next.js metadata merging. No layout wrapping. This IS the entire response.
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
 
  <!-- Prevent search engines from indexing /p/ share URLs -->
  <meta name="robots" content="noindex, nofollow" />
 
  <!-- WhatsApp / Telegram / Instagram / Facebook OG tags -->
  <meta property="og:type"                content="product" />
  <meta property="og:site_name"           content="Viro.pk" />
  <meta property="og:url"                 content="${ogUrl}" />
  <meta property="og:title"              content="${ogTitle.replace(/"/g, "&quot;")}" />
  <meta property="og:description"        content="${ogDesc.replace(/"/g, "&quot;")}" />
  <meta property="og:image"              content="${ogImage}" />
  <meta property="og:image:secure_url"   content="${ogImage}" />
  <meta property="og:image:type"         content="image/jpeg" />
  <meta property="og:image:width"        content="1080" />
  <meta property="og:image:height"       content="1920" />
  <meta property="og:locale"             content="en_PK" />
 
  <!-- Twitter Card -->
  <meta name="twitter:card"              content="summary_large_image" />
  <meta name="twitter:site"              content="@viropk" />
  <meta name="twitter:title"             content="${ogTitle.replace(/"/g, "&quot;")}" />
  <meta name="twitter:description"       content="${ogDesc.replace(/"/g, "&quot;")}" />
  <meta name="twitter:image"             content="${ogImage}" />
 
  <!-- Redirect humans to full product page -->
  <meta http-equiv="refresh" content="0; url=${productUrlUtm}" />
 
  <title>${ogTitle.replace(/</g, "&lt;")}</title>
  <link rel="canonical" href="${productUrl}" />
 
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{min-height:100vh;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .card{max-width:360px;width:90%;text-align:center;padding:2rem 1rem}
    .img{width:100%;max-width:280px;aspect-ratio:1/1;object-fit:cover;border-radius:20px;margin-bottom:1.2rem;box-shadow:0 20px 60px rgba(0,0,0,.5);display:block;margin-left:auto;margin-right:auto}
    .name{font-size:1.3rem;font-weight:800;line-height:1.3;margin-bottom:.75rem}
    .price{margin-bottom:1.25rem;display:flex;align-items:center;justify-content:center;gap:.5rem;flex-wrap:wrap}
    .cur{font-size:1.6rem;font-weight:900;color:#a78bfa}
    .orig{font-size:1rem;text-decoration:line-through;color:#64748b}
    .badge{background:#dc2626;color:#fff;font-size:.75rem;font-weight:700;border-radius:6px;padding:2px 8px}
    .btn{display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7);color:#fff;font-weight:800;font-size:1rem;padding:14px 36px;border-radius:999px;text-decoration:none;box-shadow:0 8px 30px rgba(139,92,246,.4);margin-bottom:1rem}
    .meta{font-size:.75rem;color:#475569;margin-top:.5rem}
    .brand{margin-top:1.5rem;font-size:1.1rem;font-weight:800;color:#6366f1}
  </style>
</head>
<body>
  ${cardHtml}
  <script>window.location.replace(${JSON.stringify(productUrlUtm)})</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Allow crawlers to cache for 1 hour — prevents rate-limiting on viral links
      "Cache-Control":
        "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
