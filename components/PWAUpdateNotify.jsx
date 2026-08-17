'use client'
// ── PWAUpdateNotify ──────────────────────────────────────────────────────────
// Was: shows an "Update Now" banner and waits for the customer to tap it
// before applying a new deployment.
//
// Now: fully automatic, no customer action required at all — the moment a
// genuinely newer version is detected, it applies itself silently. This is
// the actual fix for "works for a first-time visitor, stuck forever for
// anyone who already had the site open" — that only kept happening because
// updates sat waiting for a manual click nobody knew to make. It's safe to
// remove that manual gate now because two independent safety nets exist
// that didn't when the manual-only approach was chosen: the capture-phase
// chunk-error watchdog in app/layout.jsx, and ChunkErrorHandler.jsx — either
// one auto-recovers from a residual mismatch instead of leaving the page
// dead, so there's no longer a good reason to make a human do this by hand.
//
// One safety exception kept: never yank the page out from under someone
// actively filling in checkout — deferred to their next page instead.
import React, { useEffect, useRef } from 'react'

// ⚠️  KEEP THIS IN SYNC WITH public/sw.js SW_VERSION ON EVERY DEPLOY
const CURRENT_SW_VERSION = 62

const SS_JUST_UPDATED = 'viro_just_updated'
const SS_PENDING      = 'viro_update_pending_banner'

export default function PWAUpdateNotify() {
  const appliedRef = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (sessionStorage.getItem(SS_JUST_UPDATED) === '1') return

    const hadController = !!navigator.serviceWorker.controller

    async function applyUpdate(reg) {
      if (appliedRef.current) return
      // Same checkout exception as ServiceWorker.jsx — don't lose a
      // half-typed shipping address to an unexpected reload.
      if (window.location.pathname === '/checkout') {
        try { sessionStorage.setItem(SS_PENDING, '1') } catch {}
        return
      }
      appliedRef.current = true
      try { sessionStorage.setItem(SS_JUST_UPDATED, '1') } catch {}

      try {
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map(k => caches.delete(k)))
        }
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'CLEAR_ALL_CACHES' })
          await new Promise(r => setTimeout(r, 300))
        }
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(r => r.unregister()))
      } catch {}

      window.location.reload()
    }

    function checkWaiting(reg) {
      if (!reg?.waiting) return
      if (!hadController) return // First install — nothing to update from

      try {
        const mc = new MessageChannel()
        mc.port1.onmessage = (e) => {
          const waitingVersion = e?.data?.version
          if (typeof waitingVersion === 'number' && waitingVersion > CURRENT_SW_VERSION) {
            applyUpdate(reg)
          }
        }
        reg.waiting.postMessage({ type: 'GET_VERSION' }, [mc.port2])
      } catch {}
    }

    // Picks up an update that was deferred while on /checkout, the moment
    // they land on any other page.
    if (window.location.pathname !== '/checkout') {
      try {
        if (sessionStorage.getItem(SS_PENDING) === '1') {
          sessionStorage.removeItem(SS_PENDING)
          navigator.serviceWorker.getRegistration().then(r => { if (r) applyUpdate(r) })
        }
      } catch {}
    }

    navigator.serviceWorker.getRegistration().then(r => {
      if (!r) return
      if (r.waiting) { checkWaiting(r); return }
      r.addEventListener('updatefound', () => {
        const nw = r.installing
        if (!nw) return
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed') checkWaiting(r)
        })
      })
    })

    const onFocus = () => {
      if (sessionStorage.getItem(SS_JUST_UPDATED) === '1') return
      navigator.serviceWorker.getRegistration().then(r => {
        if (r?.waiting) checkWaiting(r)
      })
    }
    window.addEventListener('focus', onFocus)

    const interval = setInterval(() => {
      navigator.serviceWorker.getRegistration().then(r => r?.update?.().catch(() => {}))
    }, 10 * 60 * 1000)

    return () => {
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
    }
  }, [])

  return null
}
