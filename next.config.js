/** @type {import('next').NextConfig} */
const path = require('path')

const BUILD_ID = `${Date.now()}`

const nextConfig = {
  generateBuildId: async () => `viro-build-${BUILD_ID}`,

  experimental: {
    staleTimes: {
      dynamic: 60,   // cache dynamic pages 60s in browser
      static:  600,  // cache static pages 10 min in browser
    },
  },

  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@supabase/supabase-js':           path.resolve(__dirname, 'lib/supabaseNoop.js'),
      '@supabase/auth-helpers-nextjs':   path.resolve(__dirname, 'lib/supabaseNoop.js'),
      '@supabase/auth-helpers-react':    path.resolve(__dirname, 'lib/supabaseNoop.js'),
    }
    return config
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
    ],
    deviceSizes: [375, 428, 640, 750, 828, 1080, 1200, 1920],
    imageSizes:  [16, 32, 64, 96, 128, 192, 256, 384],
    minimumCacheTTL: 3600,  // 1 hour — prevents broken images being cached for 30 days
    formats: ['image/avif', 'image/webp'],
  },

  async headers() {
    return [
      { source: '/sw.js', headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma',        value: 'no-cache' },
          { key: 'Expires',       value: '0' },
          { key: 'Service-Worker-Allowed', value: '/' },
      ]},
      { source: '/manifest.json', headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      ]},
      { source: '/:file(favicon-32\\.png|icon-96\\.png|icon-192\\.png|icon-512\\.png|apple-touch-icon\\.png|splash-icon\\.png)', headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=86400' },
      ]},
      { source: '/_next/static/:path*', headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ]},
      { source: '/_next/image', headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400' },
          { key: 'Vary', value: 'Accept' },
      ]},
      { source: '/_next/data/:path*', headers: [
          { key: 'Cache-Control', value: 'public, max-age=60, stale-while-revalidate=120' },
      ]},
      { source: '/p/:id*', headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400' },
      ]},
      { source: '/api/og', headers: [
          { key: 'Cache-Control',               value: 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400' },
          { key: 'Access-Control-Allow-Origin',  value: '*' },
      ]},
      // ── ISR pages: allow the CDN edge to cache briefly for speed, but the
      // window must stay SHORT. This is the actual, deeper cause of the
      // stuck "Checking session…" bug — not just stale browser caching.
      //
      // BUGFIX: this was `s-maxage=60, stale-while-revalidate=300` — meaning
      // for up to 5 MINUTES after every single deployment, your CDN edge
      // was allowed to keep serving the PREVIOUS deployment's HTML (which
      // references THAT deployment's JS chunk filenames) to brand-new
      // visitors — even in incognito, even on a phone that's never touched
      // this site before. Once the new deployment finishes, old chunk files
      // eventually stop being served, so anyone who received that stale
      // HTML during the 5-minute window ends up requesting a chunk that no
      // longer exists → the exact 404 + "refused to execute, MIME type
      // text/plain" error in the screenshots. The service worker's
      // NetworkOnly HTML strategy and ChunkErrorHandler.jsx can't fix this
      // on their own because the request never even reaches your origin
      // server during that window — the CDN answers it directly with the
      // stale copy. Cut to 30s here so the exposure window is short enough
      // that it's very unlikely to overlap with a chunk actually being
      // removed, while still getting the CDN speed benefit this was added
      // for in the first place.
      { source: '/', headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=10, stale-while-revalidate=30' },
      ]},
      { source: '/shop', headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=10, stale-while-revalidate=30' },
      ]},
      { source: '/((?!_next/static|_next/image|favicon|icon-|apple-touch|splash|manifest|og-image|logo|screenshot|offline\\.html|sw\\.js|OneSignal|p/|api/og).*)', headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma',        value: 'no-cache' },
          { key: 'Expires',       value: '0' },
      ]},
      { source: '/(.*)', headers: [
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-XSS-Protection',          value: '1; mode=block' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' " +
                "cdn.onesignal.com onesignal.com *.onesignal.com " +
                "https://www.googletagmanager.com https://www.google-analytics.com " +
                "https://ssl.google-analytics.com https://tagmanager.google.com " +
                "https://connect.facebook.net https://www.facebook.com " +
                "https://static.cloudflareinsights.com " +
                "https://snap.licdn.com https://sc-static.net " +
                "https://unpkg.com",
              "script-src-elem 'self' 'unsafe-inline' " +
                "cdn.onesignal.com onesignal.com *.onesignal.com " +
                "https://www.googletagmanager.com https://www.google-analytics.com " +
                "https://ssl.google-analytics.com https://tagmanager.google.com " +
                "https://connect.facebook.net https://www.facebook.com " +
                "https://static.cloudflareinsights.com " +
                "https://snap.licdn.com https://sc-static.net " +
                "https://unpkg.com",
              "style-src 'self' 'unsafe-inline' fonts.googleapis.com https://tagmanager.google.com",
              "font-src 'self' fonts.gstatic.com data:",
              "img-src 'self' *.supabase.co *.supabase.in data: blob: " +
                "https://placehold.co https://via.placeholder.com " +
                "https://www.googletagmanager.com https://ssl.gstatic.com " +
                "https://www.google-analytics.com " +
                "https://www.facebook.com https://www.google.com " +
                "https://img.onesignal.com *.onesignal.com " +
                "https://www.googleadservices.com " +
                "https://*.googleusercontent.com https://lh3.googleusercontent.com " +
                // BUGFIX: the Partner dashboard's QR code (an <img> pointing
                // at api.qrserver.com) was silently blocked by this exact
                // allowlist — it just wasn't on it, so the browser refused
                // to load it and showed nothing but the alt text, with no
                // visible error unless you checked the console.
                "https://api.qrserver.com",
              "connect-src 'self' *.supabase.co *.supabase.in " +
                "onesignal.com *.onesignal.com " +
                "https://www.googletagmanager.com https://tagmanager.google.com " +
                "https://*.google-analytics.com https://analytics.google.com " +
                "https://ssl.google-analytics.com https://stats.g.doubleclick.net " +
                "https://www.facebook.com https://connect.facebook.net " +
                "https://graph.facebook.com " +
                "https://cloudflareinsights.com https://static.cloudflareinsights.com " +
                "https://www.googleadservices.com https://googleads.g.doubleclick.net " +
                "https://unpkg.com https://*.googleapis.com " +
                "https://pagead2.googlesyndication.com " +
                "https://*.run.app https://*.on.aws " +
                "https://*.firebaseapp.com https://*.firebase.com " +
                "wss://*.supabase.co wss://*.supabase.in " +
                "https://region1.analytics.google.com " +
                "https://region1.google-analytics.com " +
                "https://*.ecs.us-east-2.on.aws " +
                "https://*.us-central1.run.app",
              "frame-src https://www.googletagmanager.com https://www.facebook.com https://web.facebook.com",
              "worker-src 'self' blob: cdn.onesignal.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
      ]},
    ]
  },
}

module.exports = nextConfig
