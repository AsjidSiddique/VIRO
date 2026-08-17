// Recently Viewed — tracks last 12 products viewed, stored in localStorage
const KEY = 'viro_recently_viewed'
const MAX = 12

export function trackView(product) {
  if (typeof window === 'undefined' || !product?.id) return
  try {
    const existing = getRecentlyViewed()
    const filtered = existing.filter(p => p.id !== product.id)
    const entry = {
      id:             product.id,
      name:           product.name,
      images:         product.images,
      price:          product.price,
      discount_price: product.discount_price,
      sale_active:    product.sale_active,
      sale_ends_at:   product.sale_ends_at,
      avg_rating:     product.avg_rating,
      review_count:   product.review_count,
      viewedAt:       Date.now(),
    }
    const next = [entry, ...filtered].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {}
}

export function getRecentlyViewed() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch { return [] }
}

export function clearRecentlyViewed() {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(KEY) } catch {}
}
