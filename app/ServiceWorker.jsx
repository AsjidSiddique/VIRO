'use client'
import { useEffect } from 'react'

// Must match SW_VERSION in public/sw.js
const SW_VERSION = 62

export default function ServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    async function initSW() {
      try {
        // 1. Unregister any rogue SWs (not sw.js or OneSignal)
        const regs = await navigator.serviceWorker.getRegistrations()
        for (const reg of regs) {
          const scriptURL = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || ''
          if (scriptURL.includes('/sw.js')) continue
          if (scriptURL.toLowerCase().includes('onesignal')) continue
          await reg.unregister()
        }

        // 2. Register our SW with updateViaCache: 'none'
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })

        // 3. Force check for updates
        reg.update().catch(() => {})

      } catch (err) {
        console.warn('[Viro] SW init error:', err)
      }
    }

    initSW()

    // ── FIX: Only reload on SW_ACTIVATED if the new version is STRICTLY NEWER
    // AND we are not in the middle of first-install (controller was already present)
    let hasReloaded = false
    const hadControllerOnLoad = !!navigator.serviceWorker.controller

    const onMessage = (e) => {
      if (e.data?.type !== 'SW_ACTIVATED') return
      if (hasReloaded) return
      // NEVER auto-reload on first install (no prior controller)
      if (!hadControllerOnLoad) return
      const incomingVersion = e.data?.version
      if (!incomingVersion || incomingVersion <= SW_VERSION) return

      // ── Fully automatic from here — no "Update Now" click needed anymore.
      // One safety exception: don't yank the page out from under someone
      // actively filling in checkout (losing a half-typed address is worse
      // than a brief delay). Defer to their next page load instead — the
      // new SW is already active and controlling by this point regardless,
      // so the very next navigation picks it up automatically anyway.
      if (window.location.pathname === '/checkout') {
        try { sessionStorage.setItem('viro_update_pending', '1') } catch {}
        return
      }
      hasReloaded = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('message', onMessage)

    // Catches the deferred checkout case above — applies the moment they
    // land on any other page after leaving checkout.
    if (window.location.pathname !== '/checkout') {
      try {
        if (sessionStorage.getItem('viro_update_pending') === '1') {
          sessionStorage.removeItem('viro_update_pending')
          window.location.reload()
        }
      } catch {}
    }

    // ── controllerchange itself still doesn't trigger a reload directly —
    // that's deliberate, avoids a double-reload race with the SW_ACTIVATED
    // message handler above and PWAUpdateNotify's own detection, both of
    // which already apply updates automatically now (with the same
    // /checkout exception) without needing a manual click.

    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage)
    }
  }, [])

  return null
}
