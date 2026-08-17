'use client'
// ── useOneSignal ──────────────────────────────────────────────────────────
// Initializes the OneSignal Web SDK once, client-side only.
//
// The SDK script itself is loaded in app/layout.jsx via:
//   <script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer async />
// That script creates window.OneSignalDeferred and drains it once loaded,
// so we just push our init call onto that queue — safe to call before or
// after the SDK script has actually finished loading.
//
// Service worker: public/OneSignalSDKWorker.js already exists at the site
// root, which is OneSignal's default expected filename/scope, so no custom
// serviceWorkerPath override is needed.
//
// Requires NEXT_PUBLIC_ONESIGNAL_APP_ID to be set (Vercel env vars). If it's
// missing, we skip init entirely rather than throwing — push notifications
// just won't be available, everything else keeps working.
// ─────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react'

export default function useOneSignal() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    if (!appId) {
      console.debug('[OneSignal] NEXT_PUBLIC_ONESIGNAL_APP_ID not set — skipping init')
      return
    }

    // Avoid double-init (e.g. React strict-mode double effect in dev)
    if (window.__viroOneSignalInitStarted) return
    window.__viroOneSignalInitStarted = true

    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        await OneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: true,
        })
      } catch (e) {
        console.debug('[OneSignal] init failed:', e?.message)
      }
    })
  }, [])
}
