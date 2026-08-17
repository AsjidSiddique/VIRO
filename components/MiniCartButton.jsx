'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useCart, getThumb } from '../context/CartContext'
import { useSite } from '../context/SiteSettingsContext'

// Small persistent pill that floats above the shop grid so shoppers don't
// have to scroll all the way back down to the bottom nav to check their
// cart. Shown on Shop pages (not product detail — that page already has its
// own sticky Cart/Buy bar), and on the Home page specifically when admin has
// turned OFF the "Recently Viewed" strip — that strip occupies this same
// bottom-area real estate on Home, so this fills the gap instead of leaving
// it empty when Recently Viewed isn't there.
export default function MiniCartButton() {
  const { cart, cartCount, cartTotal, cartReady, showCheckoutNudge } = useCart()
  const { rawSettings } = useSite()
  const pathname = usePathname()
  const router = useRouter()

  const isShopPage = pathname === '/shop' || pathname?.startsWith('/shop/')
  const isHomePage = pathname === '/'
  const recentlyViewedEnabled = rawSettings?.feature_toggles?.recently_viewed !== false
  const showOnHome = isHomePage && !recentlyViewedEnabled

  if (!(isShopPage || showOnHome) || !cartReady || cartCount <= 0 || showCheckoutNudge) return null

  const previewItems = cart.slice(-2).reverse()

  return (
    <>
      <style>{`
        .vro-mini-cart {
          position: fixed; left: 50%; transform: translateX(-50%);
          bottom: calc(64px + env(safe-area-inset-bottom) + 10px);
          z-index: 9996;
          animation: vroMiniCartIn 0.25s cubic-bezier(0.34,1.56,0.64,1);
        }
        @media (min-width: 768px) {
          .vro-mini-cart { left: auto; right: 24px; transform: none; bottom: 24px; }
        }
        @keyframes vroMiniCartIn { from { opacity:0; transform: translate(-50%,12px); } to { opacity:1; transform: translate(-50%,0); } }
        @media (min-width: 768px) {
          @keyframes vroMiniCartIn { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: translateY(0); } }
        }
      `}</style>
      <button
        onClick={() => router.push('/cart')}
        className="vro-mini-cart"
        aria-label={`View cart — ${cartCount} item${cartCount !== 1 ? 's' : ''}, Rs. ${Math.round(cartTotal)}`}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--viro-bgCard, #fff)',
          border: '1px solid var(--viro-border)',
          borderRadius: 999, padding: '6px 14px 6px 6px',
          cursor: 'pointer', boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
        }}
        onTouchStart={e => e.currentTarget.style.transform = 'scale(0.96)'}
        onTouchEnd={e => e.currentTarget.style.transform = ''}
      >
        <div style={{ display: 'flex', position: 'relative', flexShrink: 0 }}>
          {previewItems.map((item, i) => (
            <div key={item._cartKey || item.id} style={{
              width: 32, height: 32, borderRadius: '50%', overflow: 'hidden',
              border: '2px solid var(--viro-bgCard, #fff)',
              marginLeft: i === 0 ? 0 : -12,
              zIndex: previewItems.length - i,
              background: 'var(--viro-border)',
            }}>
              <img src={getThumb(item.images, '/logo.jpg')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
          <span style={{
            position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8,
            background: 'linear-gradient(135deg,#8B5CF6,#F97316)', color: '#fff',
            fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: '0 3px',
          }}>{cartCount > 9 ? '9+' : cartCount}</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--viro-text)', whiteSpace: 'nowrap' }}>
          Rs. {Math.round(cartTotal).toLocaleString()}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--viro-textSub)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </>
  )
}
