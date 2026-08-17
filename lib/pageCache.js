// ── Client-side Page Cache ─────────────────────────────────────────────────
// Stores fetched page data in memory so navigating back feels instant.
// Home → Shop → Back to Home = data already in memory, no Supabase call.
// Cache lives for 5 minutes then expires (fresh data on next visit).

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

const store = {} // { key: { data, ts, scrollY } }

export function cacheSet(key, data) {
  store[key] = { data, ts: Date.now(), scrollY: window.scrollY }
}

export function cacheGet(key) {
  const entry = store[key]
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) { delete store[key]; return null }
  return entry
}

export function cacheSaveScroll(key) {
  if (store[key]) store[key].scrollY = window.scrollY
}

export function cacheHas(key) {
  return !!cacheGet(key)
}
