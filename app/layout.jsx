import './globals.css'
import Providers from '../context/Providers'
import ServiceWorker from './ServiceWorker'
import ChunkErrorHandler from './ChunkErrorHandler'
import SplashScreen from '../components/SplashScreen'
import NavProgress from '../components/NavProgress'
import AppShell from '../components/AppShell'
import { Analytics } from '@vercel/analytics/next'
import { Outfit, Plus_Jakarta_Sans } from 'next/font/google'

// ── Removed force-dynamic from layout ─────────────────────────────────────────
// force-dynamic on layout was making EVERY page hit Supabase on every request.
// Theme and SEO settings change rarely — cache them for 5 minutes.
// Individual pages that need live data (checkout, orders) can still use force-dynamic.

// Cache theme for 5 minutes — it almost never changes
async function getDbTheme() {
  try {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return 'dark'
    const res = await fetch(
      `${url}/rest/v1/site_settings?select=value&key=eq.theme&limit=1`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        next: { revalidate: 300 }, // cache 5 min — theme rarely changes
      }
    )
    if (!res.ok) return 'dark'
    const json = await res.json()
    return json?.[0]?.value?.mode || 'dark'
  } catch { return 'dark' }
}

// Cache SEO settings for 5 minutes
async function getSeoSettings() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return {}
    const res = await fetch(
      `${url}/rest/v1/site_settings?select=value&key=eq.seo_settings&limit=1`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        next: { revalidate: 300 }, // cache 5 min
      }
    )
    if (!res.ok) return {}
    const json = await res.json()
    return json?.[0]?.value || {}
  } catch { return {} }
}

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400','600','700','800','900'],
  variable: '--font-outfit',
  display: 'swap',
})
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400','500','600','700','800'],
  variable: '--font-plus-jakarta',
  display: 'swap',
})

export const metadata = {
  metadataBase: new URL('https://viro.pk'),
  title: {
    default:  'Viro.pk — Online Shopping Pakistan | COD & Free Delivery',
    template: '%s | Viro.pk',
  },
  description: "Pakistan's trusted online store. Shop bags, electronics, women's fashion, watches, jewellery & more. ✅ Cash on delivery everywhere. 🚚 FREE delivery in Burewala Rs.999+, all Pakistan Rs.2499+. 7-day easy returns. Quality guaranteed.",
  keywords: [
    'online shopping pakistan', 'buy online pakistan', 'cash on delivery pakistan',
    'free delivery pakistan', 'viro pk', 'burewala online store', 'shop online punjab',
    'women fashion online pakistan', 'bags online pakistan', 'electronics online pakistan',
    'best deals pakistan', 'cod online shopping', 'viro.pk', 'online store pakistan',
    'buy bags pakistan', 'fashion online cod pakistan', 'new arrivals pakistan',
  ],
  authors:    [{ name: 'Viro.pk', url: 'https://viro.pk' }],
  creator:    'Viro.pk',
  publisher:  'Viro.pk',
  category:   'shopping',
  classification: 'E-commerce, Online Shopping',
  referrer:   'origin-when-cross-origin',
  alternates: {
    canonical: 'https://viro.pk',
    languages: { 'en-PK': 'https://viro.pk', 'ur-PK': 'https://viro.pk' },
  },
  openGraph: {
    type:        'website',
    siteName:    'Viro.pk',
    locale:      'en_PK',
    url:         'https://viro.pk',
    title:       'Viro.pk — Online Shopping Pakistan | COD & Free Delivery',
    description: "Quality products. Free delivery. Cash on delivery. Trusted by shoppers across Pakistan.",
    images: [
      { url: 'https://viro.pk/og-image.jpg', width: 1200, height: 630, alt: 'Viro.pk — Online Shopping Pakistan' },
    ],
  },
  twitter: {
    card:        'summary_large_image',
    site:        '@viropk',
    creator:     '@viropk',
    title:       'Viro.pk — Online Shopping Pakistan',
    description: 'Free delivery. Cash on delivery. Quality products shipped across Pakistan.',
    images:      ['https://viro.pk/og-image.jpg'],
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico',    sizes: 'any',        type: 'image/x-icon' },
      { url: '/favicon-32.png', sizes: '32x32',      type: 'image/png' },
      { url: '/icon-96.png',    sizes: '96x96',      type: 'image/png' },
      { url: '/icon-192.png',   sizes: '192x192',    type: 'image/png' },
    ],
    apple:   '/apple-touch-icon.png',
    shortcut:'/favicon-32.png',
  },
  appleWebApp: {
    capable:         true,
    statusBarStyle:  'black-translucent',
    title:           'Viro.pk',
    startupImage:    '/apple-touch-icon.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  formatDetection: { telephone: true, email: true, address: true },
  robots: {
    index:   true,
    follow:  true,
    nocache: false,
    googleBot: {
      index:             true,
      follow:            true,
      noimageindex:      false,
      'max-video-preview':  -1,
      'max-image-preview': 'large',
      'max-snippet':        -1,
    },
  },
}

function buildThemeScript(dbTheme) {
  return `(function(){try{
  var D={'--viro-bg':'#0F172A','--viro-bgDeep':'#080E1C','--viro-bgCard':'#1E293B','--viro-bgInput':'#1E293B','--viro-border':'#334155','--viro-text':'#F1F5F9','--viro-textMuted':'#94A3B8','--viro-textSub':'#64748B','--viro-navBg':'#080E1C','--viro-navBorder':'#1E293B','--viro-featureBg':'#1E293B','--viro-featureBorder':'#334155','--viro-sectionBg':'#0F172A','--viro-searchBg':'#0F172A','--viro-productWhite':'#1E293B'};
  var L={'--viro-bg':'#F0F4F8','--viro-bgDeep':'#E2E8F0','--viro-bgCard':'#FFFFFF','--viro-bgInput':'#FFFFFF','--viro-border':'#CBD5E1','--viro-text':'#0F172A','--viro-textMuted':'#334155','--viro-textSub':'#64748B','--viro-navBg':'#FFFFFF','--viro-navBorder':'#E2E8F0','--viro-featureBg':'#FFFFFF','--viro-featureBorder':'#CBD5E1','--viro-sectionBg':'#F0F4F8','--viro-searchBg':'#F8FAFC','--viro-productWhite':'#FFFFFF'};
  var saved=localStorage.getItem('viro_theme');
  var t=saved||'${dbTheme}';
  document.documentElement.setAttribute('data-theme',t);
  var v=t==='light'?L:D;
  Object.keys(v).forEach(function(k){document.documentElement.style.setProperty(k,v[k]);});
  if(document.body){document.body.style.backgroundColor=v['--viro-bg'];document.body.style.color=v['--viro-text'];}
}catch(e){}})()`
}

const GTM_ID = 'GTM-NFZ9956Q'
const GTM_SCRIPT = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`
const GTM_NOSCRIPT = `<iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#00071A',
}

export default async function RootLayout({ children }) {
  let dbTheme = 'dark'
  let seoSettings = {}
  try {
    ;[dbTheme, seoSettings] = await Promise.all([getDbTheme(), getSeoSettings()])
  } catch {
    dbTheme = 'dark'
    seoSettings = {}
  }
  
  const googleVerification = seoSettings?.google_verification
  const THEME_SCRIPT = buildThemeScript(dbTheme)

  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Viro",
    "url": "https://www.viro.pk",
    "logo": "https://www.viro.pk/icon-192.png",
    "description": "Online shopping store in Pakistan. Quality products, fast delivery in Burewala and across Pakistan. Cash on delivery.",
    "foundingDate": "2024",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Mandi Burewala",
      "addressLocality": "Burewala",
      "addressRegion": "Punjab",
      "addressCountry": "PK"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+92-327-7796566",
      "contactType": "customer service",
      "areaServed": "PK",
      "availableLanguage": ["Urdu", "English"]
    },
    "sameAs": [
      "https://www.facebook.com/viro.pk",
      "https://www.instagram.com/viro.pk"
    ]
  }

  const siteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Viro",
    "url": "https://www.viro.pk",
    "potentialAction": {
      "@type": "SearchAction",
      "target": { "@type": "EntryPoint", "urlTemplate": "https://www.viro.pk/shop?q={search_term_string}" },
      "query-input": "required name=search_term_string"
    }
  }

  return (
    <html lang="en-PK" suppressHydrationWarning className={`${outfit.variable} ${plusJakarta.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){
  // BUGFIX #1 (the critical one): resource load failures — a <script src>
  // 404ing, exactly what's in the "webpack-XXXX.js net::ERR_ABORTED 404"
  // console errors — do NOT bubble up the DOM tree. They can ONLY be caught
  // with a capture-phase listener (the 3rd "true" argument below). This
  // listener was registered WITHOUT it, so it silently caught ordinary
  // thrown JS errors but never once caught the actual script-load failures
  // this was written to catch in the first place — the exact bug behind
  // the site getting stuck on "Checking session…" forever.
  //
  // BUGFIX #2: BUILD was hardcoded to '46' and never updated across many
  // deployments since. Once this ran (or even just failed silently due to
  // bug #1) on a given browser, it would set localStorage['viro_cr_46']
  // and then NEVER try to reload again on that browser — even after a
  // brand new deployment — because the guard key never changed. Now tied
  // to the real per-deployment build id, so every new deployment gets a
  // fresh, working guard instead of inheriting a stale one.
  var BUILD = ${JSON.stringify(process.env.NEXT_PUBLIC_BUILD_ID || '46')};
  var RELOAD_KEY = 'viro_cr_' + BUILD;
  function tryReload(reason) {
    try {
      if (localStorage.getItem(RELOAD_KEY)) return;
      localStorage.setItem(RELOAD_KEY, '1');
      for (var k in localStorage) {
        if (k.indexOf('viro_cr_') === 0 && k !== RELOAD_KEY) localStorage.removeItem(k);
      }
      if ('caches' in window) {
        caches.keys().then(function(keys) {
          return Promise.all(keys.map(function(k) { return caches.delete(k); }));
        }).then(function() { location.reload(true); }).catch(function() { location.reload(true); });
      } else { location.reload(true); }
    } catch(e) { try { location.reload(true); } catch(_) {} }
  }
  function isChunkError(msg) {
    if (!msg) return false;
    return (msg.indexOf('ChunkLoadError') !== -1 || msg.indexOf('Loading chunk') !== -1 ||
      msg.indexOf('Failed to fetch dynamically') !== -1 || msg.indexOf('Importing a module script failed') !== -1 ||
      msg.indexOf('error loading dynamically imported module') !== -1);
  }
  window.addEventListener('error', function(e) {
    // Covers BOTH failure shapes: a thrown JS error with a chunk-related
    // message, AND a plain <script>/<link> tag that failed to load (which
    // has no useful e.message, so check the failing element itself).
    if (isChunkError(e.message)) { tryReload('script error'); return; }
    var t = e.target;
    if (t && t.tagName && (t.tagName === 'SCRIPT' || t.tagName === 'LINK') &&
        ((t.src || t.href || '').indexOf('/_next/') !== -1)) {
      tryReload('resource load failure');
    }
  }, true); // ← capture phase — REQUIRED for resource errors, see BUGFIX #1 above
  window.addEventListener('unhandledrejection', function(e) {
    var msg = e.reason && (e.reason.message || String(e.reason));
    if (isChunkError(msg)) tryReload('promise rejection');
  });

  // Watchdog: if the app never actually mounts (this is the failure mode
  // that "Checking session…" hanging forever, with no error the two
  // listeners above manage to catch — e.g. the webpack RUNTIME chunk
  // itself failing before React ever gets a chance to run), force one
  // reload after a grace period instead of leaving the tab dead forever.
  // window.__viroMounted is set by a tiny effect once React actually
  // renders anything (see AppShell); if that never happens, we know for
  // certain nothing client-side is going to save this page on its own.
  setTimeout(function() {
    if (!window.__viroMounted) tryReload('app never mounted');
  }, 9000);

  window.addEventListener('load', function() { try { localStorage.removeItem(RELOAD_KEY); } catch(e) {} });
})()` }} />
        {(() => { try { return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} /> } catch { return null } })()}
        {(() => { try { return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteSchema) }} /> } catch { return null } })()}
        {googleVerification && (
          <meta name="google-site-verification" content={googleVerification} />
        )}
      </head>
      <body suppressHydrationWarning style={{ backgroundColor: "var(--viro-sectionBg, #0F172A)", color: "var(--viro-text, #F1F5F9)" }}>
        <noscript dangerouslySetInnerHTML={{ __html: GTM_NOSCRIPT }} />
        <Providers>
          <SplashScreen />
          <ServiceWorker />
          <ChunkErrorHandler />
          <AppShell>{children}</AppShell>
        </Providers>
        <script id="gtm" defer dangerouslySetInnerHTML={{ __html: GTM_SCRIPT }} />
        <script id="onesignal-sdk" src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer async />
        <Analytics />
      </body>
    </html>
  )
}
