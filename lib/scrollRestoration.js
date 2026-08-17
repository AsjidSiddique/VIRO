// ── Scroll Position Restoration ──────────────────────────────────────────────
// Saves scroll position when user leaves a page.
// Restores it when they come back (back button / nav click to same page).
// Works like Daraz/Shopify — instant feel on back navigation.

const positions = {}  // in-memory: { '/': 1240, '/shop': 320 }

export function saveScrollPosition(pathname) {
  if (typeof window === 'undefined') return
  positions[pathname] = window.scrollY
}

export function restoreScrollPosition(pathname) {
  if (typeof window === 'undefined') return
  const y = positions[pathname]
  if (!y) return
  // Use requestAnimationFrame to wait for DOM paint before scrolling
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: y, behavior: 'instant' })
    })
  })
}

export function clearScrollPosition(pathname) {
  delete positions[pathname]
}

export function getScrollPosition(pathname) {
  return positions[pathname] || 0
}
