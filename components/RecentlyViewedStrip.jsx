'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getRecentlyViewed } from '../lib/recentlyViewed'
import { getThumb } from '../context/CartContext'
import { extractId } from '../lib/slugify'
import { useSite } from '../context/SiteSettingsContext'

const SS_COLLAPSED = 'viro_recent_strip_collapsed'

export default function RecentlyViewedStrip() {
  const { rawSettings } = useSite()
  const [items, setItems] = useState([])
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  // Admin on/off toggle (Site Settings → Feature Toggles). Defaults to ON
  // so existing sites keep current behaviour unless explicitly turned off.
  const featureEnabled = rawSettings?.feature_toggles?.recently_viewed !== false

  // Hide on pages where it'd just be clutter or collide with other fixed UI
  // (MiniCartButton already occupies this same bottom-area real estate on
  // Shop pages), AND on Home/Shop/Product Detail now that
  // <RecentlyViewedProducts/> is a full section on those same three pages —
  // showing both would repeat the exact same "recently viewed" data twice
  // on one page, just in two different formats. Still shown elsewhere
  // (Wishlist, Account, Orders, category browsing outside these three, etc).
  const hidden = !featureEnabled || pathname?.startsWith('/adm') || pathname === '/cart' || pathname === '/checkout' ||
    pathname === '/shop' || pathname?.startsWith('/shop/') ||
    pathname === '/' || pathname?.startsWith('/product/')

  useEffect(() => {
    if (hidden) return
    // Exclude the product currently being viewed (no point suggesting "go back" to where you already are)
    const currentId = pathname?.startsWith('/product/') ? extractId(pathname.split('/product/')[1]) : null
    const all = getRecentlyViewed().filter(p => p.id !== currentId)
    setItems(all.slice(0, 8))
    try { setCollapsed(sessionStorage.getItem(SS_COLLAPSED) === '1') } catch {}
  }, [pathname, hidden])

  function toggleCollapsed() {
    setCollapsed(c => {
      const next = !c
      try { sessionStorage.setItem(SS_COLLAPSED, next ? '1' : '0') } catch {}
      return next
    })
  }

  if (hidden || items.length < 2) return null

  return (
    <div style={{
      position: 'fixed', left: 0, right: 0,
      bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
      zIndex: 40, // below modals/popups (9990+), above normal page content
      background: 'var(--viro-bgCard)', borderTop: '1px solid var(--viro-border)',
      boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
    }}>
      <style>{`.vro-recent-scroll::-webkit-scrollbar{display:none}`}</style>
      <button onClick={toggleCollapsed} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 14px', background: 'none', border: 'none', cursor: 'pointer',
      }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--viro-textSub)' }}>
          🕓 Recently Viewed
        </span>
        <span style={{ fontSize: 11, color: 'var(--viro-textSub)', transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
      </button>
      {!collapsed && (
        <div className="vro-recent-scroll" style={{
          display: 'flex', gap: 10, overflowX: 'auto', padding: '0 12px 10px',
          scrollbarWidth: 'none',
        }}>
          {items.map(p => (
            <button key={p.id} onClick={() => router.push(`/product/${p.id}`)}
              style={{
                flexShrink: 0, width: 58, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer',
              }}>
              <div style={{
                width: 52, height: 52, borderRadius: 12, overflow: 'hidden',
                border: '1px solid var(--viro-border)', flexShrink: 0,
              }}>
                <img src={getThumb(p.images, '/logo.jpg')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <span style={{
                fontSize: 9.5, color: 'var(--viro-textSub)', textAlign: 'center',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%',
              }}>{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
