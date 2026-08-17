export default function robots() {
  return {
    rules: [
      // ── Default rule for all crawlers ──────────────────────────────────────
      {
        userAgent: "*",
        allow: [
          "/",
          "/shop",
          "/shop/",
          "/product/",
          "/about",
          "/return-policy",
          "/privacy-policy",
          "/terms",
        ],
        disallow: [
          "/checkout", // transactional — no SEO value
          "/cart", // transactional — no SEO value
          "/orders", // personal data — no SEO value
          "/wishlist", // personal data — no SEO value
          "/api/", // server-side API routes — not pages
          "/clear-cache", // internal utility page
          // ⚠️  Admin panel is intentionally NOT listed here.
          // Listing /adm1n0nly in robots.txt would advertise the secret URL
          // to every crawler and attacker scanning robots.txt.
          // Security-by-obscurity: the slug is only in middleware.js (server code).
        ],
      },

      // ── Specific rule: block AhrefsBot from crawling too aggressively ───────
      // Ahrefs ignores crawl-delay but this limits their indexing of your site
      {
        userAgent: "AhrefsBot",
        disallow: ["/"],
      },

      // ── Specific rule: block SemrushBot similarly ───────────────────────────
      {
        userAgent: "SemrushBot",
        disallow: ["/"],
      },
    ],

    // ── Sitemap — must match BASE in app/sitemap.js exactly ──────────────────
    sitemap: "https://www.viro.pk/sitemap.xml",
  };
}
