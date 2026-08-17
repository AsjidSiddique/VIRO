'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useCart, getThumb } from '../context/CartContext'
import { useSite } from '../context/SiteSettingsContext'

export default function CheckoutNudge() {
  const { cart, cartTotal, cartCount, showCheckoutNudge, dismissCheckoutNudge } = useCart()
  const { deliveryRules, minOrder } = useSite()
  const router = useRouter()
  const pathname = usePathname()
  const [closing, setClosing] = useState(false)

  // Highest threshold across all delivery rules — the one figure that's
  // true for EVERY city, regardless of which one the shopper is actually
  // in (we don't know their city yet at this point in the flow).
  const maxFreeThreshold = (deliveryRules || [])
    .map(r => r.freeThreshold || 0)
    .reduce((a, b) => Math.max(a, b), 0)
  const amountToFreeDelivery = maxFreeThreshold - cartTotal
  const belowMinOrder = minOrder?.enabled && cartTotal < minOrder.amount
  const amountToMinOrder = belowMinOrder ? Math.ceil(minOrder.amount - cartTotal) : 0

  // Product detail pages have their own sticky "Cart / Buy Now" bar pinned
  // to the bottom (~155px tall). A bottom:0 popup would sit right on top of
  // it, covering the buttons. Lift the nudge above that bar on those pages;
  // everywhere else it sits at the normal bottom:0.
  const isProductPage = pathname?.startsWith('/product/')
  const bottomOffset = isProductPage ? 158 : 0

  useEffect(() => {
    if (!showCheckoutNudge) return
    const t = setTimeout(() => handleDismiss(true), 4500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCheckoutNudge])

  if (!showCheckoutNudge) return null

  function handleDismiss(autoDismissed = false) {
    setClosing(true)
    setTimeout(() => { dismissCheckoutNudge(autoDismissed); setClosing(false) }, 200)
  }
  function handleCheckout() {
    dismissCheckoutNudge(false)
    router.push('/cart')
  }

  const previewItems = cart.slice(-3).reverse() // most recently added first

  return (
    <div
      role="dialog" aria-live="polite"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: bottomOffset, zIndex: 9998,
        display: 'flex', justifyContent: 'center', padding: '0 12px 12px',
        pointerEvents: 'none', // only the card itself is interactive
        transition: 'bottom 0.2s ease',
      }}>
      <style>{`
        @keyframes vroNudgeUp   { from { transform: translateY(120%); opacity:0; } to { transform: translateY(0); opacity:1; } }
        @keyframes vroNudgeDown { from { transform: translateY(0); opacity:1; } to { transform: translateY(120%); opacity:0; } }
      `}</style>
      <div
        style={{
          pointerEvents: 'auto',
          width: '100%', maxWidth: 420,
          borderRadius: 18,
          background: 'var(--viro-bgCard, #fff)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.1)',
          overflow: 'hidden',
          animation: `${closing ? 'vroNudgeDown' : 'vroNudgeUp'} 0.32s cubic-bezier(0.34,1.56,0.64,1)`,
        }}>
        {/* Top accent strip */}
        <div style={{ height: 3, background: 'linear-gradient(90deg,#7C3AED,#EC4899,#7C3AED)' }} />

        <div style={{ padding: '14px 14px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Stacked product thumbnails */}
          <div style={{ display: 'flex', flexShrink: 0 }}>
            {previewItems.map((item, i) => (
              <div key={item._cartKey || item.id} style={{
                width: 40, height: 40, borderRadius: 10, overflow: 'hidden',
                border: '2px solid var(--viro-bgCard,#fff)', background: 'var(--viro-border)',
                marginLeft: i === 0 ? 0 : -14, position: 'relative', zIndex: previewItems.length - i,
              }}>
                <img src={getThumb(item.images, '/logo.jpg')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--viro-text)' }}>
              🎉 Nice picks! {cartCount} item{cartCount !== 1 ? 's' : ''} ready
            </p>
            <p style={{ margin: '1px 0 0', fontSize: 12, color: 'var(--viro-textSub)' }}>
              Your cart total is <strong style={{ color: '#10B981' }}>Rs. {Math.round(cartTotal).toLocaleString()}</strong>
            </p>
            {!belowMinOrder && maxFreeThreshold > 0 && (
              amountToFreeDelivery > 0 ? (
                <p style={{ margin: '2px 0 0', fontSize: 11.5, fontWeight: 700, color: '#7C3AED' }}>
                  🚚 Add Rs. {Math.ceil(amountToFreeDelivery).toLocaleString()} more for FREE delivery
                </p>
              ) : (
                <p style={{ margin: '2px 0 0', fontSize: 11.5, fontWeight: 700, color: '#10B981' }}>
                  🎉 You've unlocked FREE delivery!
                </p>
              )
            )}
          </div>

          <button type="button" onClick={() => handleDismiss(false)} aria-label="Dismiss"
            style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'var(--viro-border)', color: 'var(--viro-textSub)', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}>
            ✕
          </button>
        </div>

        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {belowMinOrder ? (() => {
            const pct = Math.min(100, Math.round((cartTotal / minOrder.amount) * 100))
            return (
              <>
                <div style={{
                  padding: '12px 14px', borderRadius: 14,
                  background: 'var(--viro-bgDeep)',
                  border: '1px solid var(--viro-border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 9 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 9, flexShrink: 0,
                      background: 'linear-gradient(135deg,#7C3AED15,#EC489915)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                    }}>🛒</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: 'var(--viro-text)' }}>
                        Almost there — add Rs.{amountToMinOrder.toLocaleString()} more
                      </p>
                      <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--viro-textSub)' }}>
                        Minimum order to checkout is Rs.{minOrder.amount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div style={{ height: 5, borderRadius: 999, background: 'var(--viro-border)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`, borderRadius: 999,
                      background: 'linear-gradient(90deg,#7C3AED,#EC4899)',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                  <p style={{ margin: '5px 0 0', fontSize: 10, fontWeight: 700, color: '#7C3AED', textAlign: 'right' }}>
                    Rs.{Math.round(cartTotal).toLocaleString()} / Rs.{minOrder.amount.toLocaleString()}
                  </p>
                </div>
                <button type="button" onClick={() => handleDismiss(false)}
                  className="w-full py-3 rounded-xl font-bold text-sm"
                  style={{
                    background: 'linear-gradient(135deg,#7C3AED,#EC4899)', color: '#fff', border: 'none', cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                  ✨ Continue Shopping →
                </button>
              </>
            )
          })() : (
            <>
              <button type="button" onClick={handleCheckout}
                className="w-full py-3 rounded-xl font-bold text-sm"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#4F46E5)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(124,58,237,0.4)' }}>
                🛍️ Review Cart & Checkout →
              </button>
              <button type="button" onClick={() => handleDismiss(false)}
                className="w-full text-xs font-semibold"
                style={{ background: 'transparent', border: 'none', color: 'var(--viro-textSub)', cursor: 'pointer', padding: '2px 0' }}>
                Keep shopping
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
