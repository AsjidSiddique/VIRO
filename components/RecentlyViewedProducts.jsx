'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getRecentlyViewed } from '../lib/recentlyViewed'
import { useSite } from '../context/SiteSettingsContext'
import ProductCard from './ProductCard'

// ── Recently Viewed Products ──────────────────────────────────
// A full content section — grid of real product cards under a bold
// centered heading — for Home / Shop / Product Detail. This is NOT
// the small floating <RecentlyViewedStrip/> (that's now hidden on
// these same three pages, so the same "recently viewed" data doesn't
// show twice on one page in two different formats; the strip still
// appears elsewhere — Wishlist, Account, Orders, etc).
//
// Re-fetches live product rows for whatever IDs are cached in
// localStorage rather than rendering the cached fields directly, so
// price/stock/discount always reflect current state — and reuses the
// same <ProductCard/> every other grid on the site already uses:
// identical look, Add to Cart / wishlist / variant-picker all work
// the same, no separate simplified card to keep in sync with the
// real one.
export default function RecentlyViewedProducts({ excludeId }) {
  const { rawSettings } = useSite()
  const [products, setProducts] = useState([])
  const [loading,  setLoading]  = useState(true)

  // Same admin toggle (Site Settings → Feature Toggles → "Recently Viewed
  // Strip") the floating strip already reads — this is the same underlying
  // feature from the admin's point of view, just a different presentation,
  // so one switch controls both rather than needing a second toggle.
  const featureEnabled = rawSettings?.feature_toggles?.recently_viewed !== false

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!featureEnabled) { if (!cancelled) setLoading(false); return }
      const cached = getRecentlyViewed().filter(p => p.id !== excludeId)
      if (cached.length === 0) {
        if (!cancelled) { setProducts([]); setLoading(false) }
        return
      }
      const ids = cached.map(p => p.id)
      const { data } = await supabase
        .from('products')
        .select('*, categories(id,name,icon)')
        .in('id', ids)
        .or('is_active.eq.true,status.eq.coming_soon')
      if (cancelled) return
      // `.in()` doesn't preserve the id order it was given — re-sort
      // back to the most-recently-viewed-first order localStorage had,
      // and drop any id the query didn't return (deleted/deactivated
      // since it was viewed).
      const byId = Object.fromEntries((data || []).map(p => [p.id, p]))
      setProducts(ids.map(id => byId[id]).filter(Boolean))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [excludeId, featureEnabled])

  // Fewer than 2 isn't worth a whole section
  if (!loading && products.length < 2) return null

  return (
    <div className="px-2 mb-6">
      <div className="rounded-2xl p-2.5 sm:p-5"
        style={{
          background: 'linear-gradient(135deg,#00BFFF08,#8B5CF612,#F9731608)',
          border: '1px solid var(--viro-border)',
        }}>
        <div className="flex items-center justify-center gap-2.5 mb-1">
          <span className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#8B5CF6,#F97316)' }}>
            🕒
          </span>
          <h2 className="font-display font-extrabold"
            style={{ fontSize: 17, letterSpacing: '0.2px', color: 'var(--viro-text)' }}>
            Recently Viewed
          </h2>
        </div>
        <p className="text-center text-xs mb-4" style={{ color: 'var(--viro-textMuted)' }}>
          Pick up right where you left off
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {loading
            ? [...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden" style={{ background: 'var(--viro-productWhite)' }}>
                  <div style={{ paddingTop: '90%' }} className="skeleton" />
                  <div className="p-2 space-y-2">
                    <div className="skeleton h-3 w-3/4 rounded" />
                    <div className="skeleton h-3 w-1/2 rounded" />
                  </div>
                </div>
              ))
            : products.map(p => <ProductCard key={p.id} product={p} compact />)
          }
        </div>
      </div>
    </div>
  )
}
