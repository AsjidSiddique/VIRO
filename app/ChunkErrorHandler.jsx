'use client'
import { useEffect } from 'react'

// ── The actual bug behind "stuck on Checking session… / infinite skeleton,
// but only on a device that already had the site open" ──────────────────────
//
// Sequence: a new deployment goes out → old JS chunk files (e.g.
// webpack-363b92f4a1eee415.js) stop existing on the server → a browser tab
// that already had the OLD version of the site loaded is still running
// that OLD JavaScript in memory → when that old code later tries to
// dynamically load one of its own chunks (Next.js code-splits routes/
// components), it requests a URL that 404s, because that build's chunks are
// gone. The response comes back as a small text/plain 404 body instead of
// JS, so the browser also refuses to execute it as a script — exactly the
// two console errors in the screenshots.
//
// Incognito works because it always starts a brand-new session with the
// CURRENT deployment's JS — there's no stale in-memory bundle to begin with.
//
// This class of failure is a plain <script> load failure / a rejected
// dynamic import() — NOT a thrown React render error — so it never reaches
// app/global-error.jsx (which can only catch actual render-time exceptions).
// That's the real gap: everything else in this app (the service worker's
// NetworkOnly HTML strategy, global-error.jsx's one-time cache-clear-and-
// reload) was already built specifically to survive deployments, except
// this one failure mode, which silently leaves whatever was waiting on that
// chunk (like the session check) unresolved forever.
const RELOAD_KEY = 'viro_chunk_error_reloaded'

function isChunkLoadFailure(message) {
  if (!message) return false
  const m = String(message).toLowerCase()
  return m.includes('loading chunk') || m.includes('failed to fetch dynamically imported module') ||
    m.includes('loading css chunk') || m.includes('chunkloaderror')
}

export default function ChunkErrorHandler() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Tells the inline watchdog script in <head> (app/layout.jsx) that
    // React genuinely booted successfully — if this never runs (e.g. the
    // webpack runtime chunk itself failed, so NOTHING client-side,
    // including this component, ever executes), that watchdog's timeout
    // is the only thing left that can recover the page.
    window.__viroMounted = true

    function reloadOnce() {
      let already = false
      try { already = sessionStorage.getItem(RELOAD_KEY) === '1' } catch {}
      if (already) return // already tried once this session — don't loop forever
      try { sessionStorage.setItem(RELOAD_KEY, '1') } catch {}

      const doReload = async () => {
        try {
          if ('caches' in window) {
            const keys = await caches.keys()
            await Promise.all(keys.map(k => caches.delete(k)))
          }
        } catch {}
        window.location.reload()
      }
      doReload()
    }

    // Plain <script src="..."> 404s (what actually happened in the
    // screenshots) surface here — resource load errors don't bubble, so
    // this MUST be a capture-phase listener or it will never fire.
    function onResourceError(e) {
      const target = e.target
      if (!target || target === window) return
      if (target.tagName === 'SCRIPT' && target.src && target.src.includes('/_next/')) {
        reloadOnce()
      }
    }

    // Dynamic import() failures (client-side navigation triggering a
    // route's own chunk) usually surface as an unhandled promise rejection
    // instead, with a recognizable message.
    function onUnhandledRejection(e) {
      if (isChunkLoadFailure(e?.reason?.message || e?.reason)) {
        reloadOnce()
      }
    }

    window.addEventListener('error', onResourceError, true)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () => {
      window.removeEventListener('error', onResourceError, true)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  return null
}
