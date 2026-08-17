import { NextResponse } from "next/server";

const SLUG = process.env.ADMIN_SLUG || "adm1n0nly";

// In-memory rate limiter for the admin login page itself
const pageHits = new Map();
const PAGE_MAX = 30;
const PAGE_WIN = 60_000;

function isPageRateLimited(ip) {
  const now = Date.now();
  const entry = pageHits.get(ip);
  if (!entry || now > entry.resetAt) {
    pageHits.set(ip, { count: 1, resetAt: now + PAGE_WIN });
    return false;
  }
  if (entry.count >= PAGE_MAX) return true;
  entry.count++;
  return false;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SOCIAL_CRAWLER_UA =
  /whatsapp|telegrambot|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|applebot|imessageurlpreview|skypeuripreview|vkshare|pinterest/i;

// ── FIX #1b: Separate list for search engine bots — these must NEVER be rewritten
// They must always reach the real server-rendered product page.
const SEARCH_BOT_UA =
  /googlebot|bingbot|yandex|duckduckbot|baiduspider|ahrefsbot|semrushbot|msnbot/i;

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ua = request.headers.get("user-agent") || "";

  // ── Social crawler hitting /product/[id] → rewrite to /p/[id] ─────────────
  // Handles both UUID-only and slug-uuid URLs.
  if (SOCIAL_CRAWLER_UA.test(ua) && !SEARCH_BOT_UA.test(ua)) {
    const productMatch = pathname.match(/^\/product\/(.+)$/);
    if (productMatch) {
      const slug     = productMatch[1];
      const uuidMatch = slug.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/);
      const productId = uuidMatch ? uuidMatch[1] : slug;
      return NextResponse.rewrite(new URL(`/p/${productId}`, request.url));
    }
  }

  // ── Admin login page (the slug itself, no trailing slash) ──────────────────
  if (pathname === `/${SLUG}`) {
    if (isPageRateLimited(ip)) {
      return new NextResponse("Too many requests", { status: 429 });
    }
    return NextResponse.next();
  }

  // ── Admin sub-paths — require valid session cookie ─────────────────────────
  if (!pathname.startsWith(`/${SLUG}/`)) {
    // Not a product page, not an admin page — let it through
    return NextResponse.next();
  }

  const token = request.cookies.get("viro_admin_token")?.value;
  if (!token || !UUID_REGEX.test(token)) {
    return NextResponse.redirect(new URL(`/${SLUG}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/product/:id*", "/adm1n0nly", "/adm1n0nly/:path+"],
};
