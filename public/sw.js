// ── Viro PWA Service Worker v46 ──────────────────────────────────────────────
// Caching strategy:
//   HTML/pages   → NetworkOnly  (never stale HTML — chunk hash mismatch = crash)
//   _next/static → CacheFirst   (content-addressed, safe forever)
//   _next/data   → NetworkOnly  (NEVER stale — RSC payload mismatch = layout crash)
//   Images/Icons → CacheFirst   (long TTL, content-versioned)
//   API routes   → NetworkOnly  (always live data)
//   Fonts        → CacheFirst   (stable assets)
// ─────────────────────────────────────────────────────────────────────────────

var SW_VERSION = 62

// ── STEP 1: Register our message handler SYNCHRONOUSLY ───────────────────────
// Chrome/Firefox REQUIRE all 'message' handlers to be registered synchronously
// during the initial evaluation of the worker script. Any handler registered
// later triggers "Event handler of 'message' must be added on initial evaluation".
self.addEventListener('message', function viroMessageHandler(e) {
  if (!e.data) return
  if (e.data.type === 'SKIP_WAITING')     { self.skipWaiting(); return }
  if (e.data.type === 'CLEAR_ALL_CACHES') {
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k) }))
    })
    return
  }
  if (e.data.type === 'GET_VERSION') {
    if (e.ports && e.ports[0]) e.ports[0].postMessage({ version: SW_VERSION })
    return
  }
})

// ── STEP 2: OneSignal SDK — imported AFTER our handler ───────────────────────
// importScripts runs synchronously so OneSignal's handler is also registered
// at initial evaluation time, satisfying Chrome's requirement.
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js')

// ── Cache names ───────────────────────────────────────────────────────────────
var CACHE_STATIC = 'viro-static-v' + SW_VERSION
var CACHE_IMAGES = 'viro-images-v' + SW_VERSION
var CACHE_PAGES  = 'viro-pages-v'  + SW_VERSION
var ALL_CACHES   = [CACHE_STATIC, CACHE_IMAGES, CACHE_PAGES]

// ── Install ───────────────────────────────────────────────────────────────────
// BUGFIX (root cause of "works for new visitors, stuck forever for anyone who
// visited before"): this used to deliberately NOT call self.skipWaiting(),
// so a new SW sat in "waiting" state until literally every open tab/window
// of the site was fully closed — something a customer who just keeps
// refreshing the same tab, or has it pinned, may never do. Meanwhile that
// tab keeps running OLD JavaScript that references chunk files an even
// newer deployment has since deleted from the server → permanent 404 →
// stuck page, exactly the bug in the screenshots.
//
// Now calls skipWaiting() immediately so a new deployment takes over the
// moment it's detected — no more "waiting for every tab to close." The
// original concern (HTML/JS mismatch mid-session causing a hydration
// crash) is now covered by two independent safety nets that didn't exist
// when this was written: the capture-phase chunk-error watchdog in
// app/layout.jsx, and ChunkErrorHandler.jsx — either one will catch and
// auto-recover from a residual mismatch instead of leaving the page dead.
self.addEventListener('install', function(e) {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE_PAGES)
      .then(function(c) { return c.addAll(['/offline.html']).catch(function() {}) })
  )
})

// ── Activate: delete old caches, claim all tabs ───────────────────────────────
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return ALL_CACHES.indexOf(k) === -1 })
            .map(function(k) {
              console.log('[Viro SW] Deleting old cache:', k)
              return caches.delete(k)
            })
      )
    }).then(function() {
      return self.clients.claim()
    }).then(function() {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    }).then(function(clients) {
      clients.forEach(function(client) {
        try { client.postMessage({ type: 'SW_ACTIVATED', version: SW_VERSION }) } catch(err) {}
      })
    })
  )
})

// ── Fetch routing ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', function(e) {
  var request = e.request
  var url

  try { url = new URL(request.url) } catch(err) { return }

  // Only handle GET
  if (request.method !== 'GET') return

  // Only handle same-origin + specific CDNs
  if (url.origin !== self.location.origin &&
      !url.hostname.includes('googleapis') &&
      !url.hostname.includes('gstatic')) return

  // API routes → NetworkOnly
  if (url.pathname.startsWith('/api/')) return

  // Supabase → NetworkOnly (never cache DB calls)
  if (url.hostname.includes('supabase')) return

  // _next/static → CacheFirst (content-addressed with hash, safe forever)
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(cacheFirst(request, CACHE_STATIC))
    return
  }

  // Local images & icons → CacheFirst
  if (/\.(png|jpg|jpeg|gif|webp|svg|ico)$/.test(url.pathname)) {
    e.respondWith(cacheFirst(request, CACHE_IMAGES))
    return
  }

  // Google Fonts → CacheFirst
  if (url.hostname.includes('googleapis') || url.hostname.includes('gstatic')) {
    e.respondWith(cacheFirst(request, CACHE_STATIC))
    return
  }

  // _next/data → NetworkOnly (NEVER stale RSC payloads)
  if (url.pathname.startsWith('/_next/data/')) {
    e.respondWith(networkOnly(request))
    return
  }

  // HTML pages → NetworkOnly (stale HTML causes chunk hash mismatch crash)
  var accept = request.headers.get('Accept') || ''
  if (accept.includes('text/html')) {
    e.respondWith(networkOnly(request))
    return
  }
})

// ── Strategy: CacheFirst ──────────────────────────────────────────────────────
// ── Strategy: CacheFirst, with a size cap so the cache can never grow
// unbounded and hit the browser's storage quota ─────────────────────────────
var MAX_CACHE_ENTRIES = { }
MAX_CACHE_ENTRIES[CACHE_IMAGES] = 150 // images are the biggest growth risk
MAX_CACHE_ENTRIES[CACHE_STATIC] = 300

function trimCache(cache, cacheName) {
  var limit = MAX_CACHE_ENTRIES[cacheName]
  if (!limit) return Promise.resolve()
  return cache.keys().then(function(keys) {
    if (keys.length <= limit) return
    // Oldest entries first (Cache API preserves insertion order) — delete
    // enough to get back under the limit, freeing room for new entries.
    var toDelete = keys.slice(0, keys.length - limit)
    return Promise.all(toDelete.map(function(k) { return cache.delete(k) }))
  }).catch(function() {}) // trimming itself must never break the response
}

function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then(function(cache) {
    return cache.match(request).then(function(cached) {
      if (cached) return cached
      return fetch(request).then(function(response) {
        if (response.ok) {
          // BUGFIX: this call was never caught. When the cache was full
          // (QuotaExceededError — exactly what was spamming the console),
          // it became an unhandled promise rejection on every single image
          // load from that point on, forever, on that device. The actual
          // page kept working (the real response below was still returned
          // fine either way), but the console filled with uncaught errors.
          // Also now trims old entries proactively so the quota is far less
          // likely to be hit in the first place.
          cache.put(request, response.clone())
            .then(function() { return trimCache(cache, cacheName) })
            .catch(function() { /* caching is a nice-to-have, never fatal */ })
        }
        return response
      }).catch(function() {
        return new Response('Network error', { status: 503 })
      })
    })
  })
}

// ── Strategy: NetworkOnly ─────────────────────────────────────────────────────
// Always fetch fresh. For HTML: returns offline fallback page if offline.
function networkOnly(request) {
  return fetch(request).catch(function() {
    var accept = request.headers.get('Accept') || ''
    if (accept.includes('text/html')) {
      return caches.open(CACHE_PAGES).then(function(cache) {
        return cache.match('/offline.html').then(function(cached) {
          return cached || new Response('Offline', { status: 503 })
        })
      })
    }
    return new Response('Network error', { status: 503 })
  })
}
