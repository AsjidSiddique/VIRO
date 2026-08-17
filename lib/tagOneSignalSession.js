// lib/tagOneSignalSession.js
// ════════════════════════════════════════════════════════════════════════════
// Tags the current browser's OneSignal subscription with its cart session id.
//
// Why this matters: an Instagram-referred visitor who adds to cart but never
// checks out or logs in has NO phone number, NO email — nothing we can use
// to reach them via WhatsApp or SMS. But if they granted notification
// permission, OneSignal already has a subscription for that exact browser.
// Tagging it with our own session_id means we can later target "whoever is
// tagged with session X" and send a push — reaching them with zero identity
// captured, just the permission they already granted.
//
// Called from two places for robustness:
//   1. NotificationPrompt.jsx, right after permission is granted (covers the
//      case where a session id already exists)
//   2. CartContext.jsx, on every addToCart (covers the case where permission
//      was granted BEFORE any cart activity — keeps the tag in sync either way)
// ════════════════════════════════════════════════════════════════════════════

export function tagOneSignalSession() {
  try {
    if (typeof window === 'undefined') return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const sid = localStorage.getItem('viro_cart_session')
    if (!sid || !window.OneSignalDeferred) return

    window.OneSignalDeferred.push(async (OneSignal) => {
      try { await OneSignal.User?.addTag?.('viro_session', sid) } catch {}
    })
  } catch {}
}
