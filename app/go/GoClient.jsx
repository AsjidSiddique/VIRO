'use client'

import { useEffect, useRef } from 'react'

export default function GoClient({ destination }) {
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true

    let absoluteUrl = destination
    let isAndroid = false

    try {
      absoluteUrl = window.location.origin + destination
      isAndroid = /android/i.test(navigator.userAgent || '')
    } catch {
      // Fall through with relative destination — the redirect below still runs.
    }

    // Fire the intent immediately on load (Android only — this is what
    // triggers Instagram's native "You're leaving our app" popup).
    // CONTINUE on that popup → Chrome opens with the real URL.
    // GO BACK / dismiss → user is left on THIS page, which is why we also
    // navigate this page itself to the real destination right after, so
    // there's a real shop page underneath instead of a dead branded screen.
    try {
      if (isAndroid) {
        const strippedUrl = absoluteUrl.replace(/^https?:\/\//, '')
        const intentUrl =
          `intent://${strippedUrl}#Intent;scheme=https;` +
          `package=com.android.chrome;` +
          `S.browser_fallback_url=${encodeURIComponent(absoluteUrl)};end`
        window.location.href = intentUrl
      }
    } catch {
      // If the intent throws for any reason, we still fall through to the
      // same-page redirect below — nothing is left blank.
    }

    // Immediately replace this page with the real destination, in the SAME
    // browser context (Instagram's in-app browser). This is what's sitting
    // underneath if the user taps "Go Back" on the popup, or on iOS where
    // there's no popup at all — they just see the real shop page directly.
    try {
      window.location.replace(destination)
    } catch {
      try {
        window.location.href = destination
      } catch {}
    }
  }, [destination])

  // This renders for a brief instant before the redirect above completes —
  // kept minimal so there's nothing jarring if it flashes.
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0F172A',
        color: '#F1F5F9',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '15px',
      }}
    >
      Loading Viro.pk…
    </div>
  )
}
