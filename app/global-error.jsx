'use client'
// global-error.jsx — catches errors thrown inside RootLayout itself.
// app/error.jsx CANNOT catch layout errors — only this file can.
// This is the last resort: it replaces the entire <html> tree.
//
// FIXED: The previous version auto-reloaded on every layout crash.
// This caused an infinite loop when the crash was a CODE BUG (not stale cache):
//   crash → clear cache → reload → crash again → show spinner forever
//
// New strategy:
// - If this is a FIRST visit (no auto-reload flag): try ONE cache-clear + reload
//   (catches stale SW cache after deploys)
// - If it crashed AGAIN after auto-reload: show the error screen with manual refresh
//   (crash is a code bug, not cache — don't loop)
import { useEffect, useState } from 'react'

const AUTORELOAD_KEY = 'viro_ge_autoreloaded'

export default function GlobalError({ error, reset }) {
  const [didAutoReload, setDidAutoReload] = useState(false)
  const [clearing,      setClearing]      = useState(false)

  useEffect(() => {
    console.error('[Viro] Global layout error:', error)

    // Check if we already auto-reloaded
    let alreadyReloaded = false
    try { alreadyReloaded = sessionStorage.getItem(AUTORELOAD_KEY) === '1' } catch {}

    if (alreadyReloaded) {
      // We already reloaded once and still crashed → code bug, not stale cache.
      // Show the error screen — do NOT auto-reload again (would loop).
      setDidAutoReload(true)
      return
    }

    // First crash: try ONE cache-clear + reload (catches stale-SW-cache after deploys)
    setClearing(true)
    try { sessionStorage.setItem(AUTORELOAD_KEY, '1') } catch {}

    const clearAndReload = async () => {
      try {
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map(k => caches.delete(k)))
        }
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations()
          for (const reg of regs) {
            const url = reg.active?.scriptURL || ''
            if (url.includes('/sw.js') && !url.includes('appId=')) {
              await reg.unregister()
            }
          }
        }
      } catch {}
      window.location.reload()
    }

    clearAndReload()
  }, [error])

  function handleReset() {
    try { sessionStorage.removeItem(AUTORELOAD_KEY) } catch {}
    try { sessionStorage.clear() } catch {}
    reset()
  }

  function handleHardRefresh() {
    try { sessionStorage.clear() } catch {}
    try { localStorage.clear() } catch {}
    // Clear all caches then do a true hard reload
    const doReload = async () => {
      try {
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map(k => caches.delete(k)))
        }
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations()
          await Promise.all(regs.map(r => r.unregister()))
        }
      } catch {}
      window.location.href = window.location.href
    }
    doReload()
  }

  const styles = `
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#0F172A; color:#F1F5F9; font-family:system-ui,sans-serif;
           display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { text-align:center; padding:40px 24px; max-width:400px; }
    h1 { font-size:18px; font-weight:800; margin:16px 0 8px; }
    p  { font-size:13px; color:#94A3B8; line-height:1.6; margin-bottom:20px; }
    .btns { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
    button {
      padding:12px 22px; border-radius:12px; font-size:13px;
      font-weight:700; cursor:pointer; border:none;
    }
    .primary { background:linear-gradient(135deg,#8B5CF6,#F97316); color:#fff; }
    .secondary { background:#1E293B; color:#94A3B8; border:1px solid #334155; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .spinner { width:36px; height:36px; border:3px solid #1E293B;
               border-top-color:#8B5CF6; border-radius:50%;
               animation:spin 0.8s linear infinite; margin:0 auto 16px; }
  `

  // Still clearing/reloading
  if (clearing && !didAutoReload) {
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Viro.pk</title>
          <style>{styles}</style>
        </head>
        <body>
          <div className="card">
            <div className="spinner" />
            <h1>Loading...</h1>
            <p>Clearing cache and reloading.</p>
          </div>
        </body>
      </html>
    )
  }

  // Crashed again after auto-reload — show error with manual options
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Viro.pk — Error</title>
        <style>{styles}</style>
      </head>
      <body>
        <div className="card">
          <div style={{ fontSize: 44, marginBottom: 8 }}>⚡</div>
          <h1>Something went wrong</h1>
          <p>
            {didAutoReload
              ? 'A persistent error was detected. Please try a full refresh or contact support if this keeps happening.'
              : 'This can happen after an update. A quick refresh usually fixes it.'}
          </p>
          <div className="btns">
            <button className="primary" onClick={handleHardRefresh}>
              🔄 Full Refresh
            </button>
            <button className="secondary" onClick={handleReset}>
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
