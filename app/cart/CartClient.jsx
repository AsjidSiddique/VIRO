'use client'
import { slugify } from '../../lib/slugify'
import { supabase } from '../../lib/supabase'
/* eslint-disable react-hooks/exhaustive-deps */
import { Suspense } from 'react'
import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from '../../context/CartContext'
import { useWishlist } from '../../context/WishlistContext'
import { useSite } from '../../context/SiteSettingsContext'
import StockCheckPopup from '../../components/StockCheckPopup'
import { validateCoupon } from '../../lib/couponApi'
import ProductImage from '../../components/ProductImage'
import FreeGiftProgress from '../../components/FreeGiftProgress'

function CartInner() {
  const {
    cart, removeFromCart, updateQty, cartTotal, cartCount,
    refreshCartPrices, priceChanges, clearPriceChanges, cartReady,
    syncCartFromDB, isLinkedToAccount,
  } = useCart()
  const { toggleWishlist, isInWishlist } = useWishlist()
  const { couponEnabled, minOrder } = useSite()
  const router = useRouter()
  const refreshedRef = useRef(false)
  const [problemPopup, setProblemPopup] = useState(null) // 'hidden' | 'oos'
  const [couponCode,    setCouponCode]    = useState('')
  const [couponShown,  setCouponShown]   = useState(false)
  const [couponResult, setCouponResult]  = useState(null)
  const [couponLoading,setCouponLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [pricesSynced, setPricesSynced] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null) // {type:'ok'|'empty'|'error', text}

  async function handleSyncCart() {
    if (syncing) return
    setSyncing(true)
    setSyncMsg(null)
    const result = await syncCartFromDB()
    setSyncing(false)
    if (!result.ok) {
      setSyncMsg({ type: 'error', text: result.reason === 'not_logged_in'
        ? 'Log in first to sync your saved cart.'
        : "Couldn't reach your account cart — try again in a moment." })
    } else if (result.count === 0) {
      setSyncMsg({ type: 'empty', text: 'Your account cart is empty on our end too — nothing to pull in.' })
    } else {
      setSyncMsg({ type: 'ok', text: `Synced — ${result.count} item${result.count !== 1 ? 's' : ''} loaded from your account.` })
    }
    setTimeout(() => setSyncMsg(null), 5000)
  }

  async function applyCartCoupon() {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    const result = await validateCoupon(couponCode, cartTotal)
    setCouponResult(result)
    if (result.valid) {
      localStorage.setItem('viro_pending_coupon', couponCode)
      // Also save result so checkout can display instantly without re-validating
      localStorage.setItem('viro_pending_coupon_result', JSON.stringify({ ...result, savedAt: Date.now() }))
    }
    setCouponLoading(false)
  }
  function removeCartCoupon() {
    setCouponResult(null)
    setCouponCode('')
    localStorage.removeItem('viro_pending_coupon')
    localStorage.removeItem('viro_pending_coupon_result')
  }

  // v46: refresh prices on mount — catches any stale discount prices
  // (e.g. user added item during sale, sale expired, they open cart later)
  //
  // v47: on a hard page refresh, the cart is repopulated from localStorage
  // instantly (synchronous), but that cached copy can still hold a stale
  // price/discount from whenever the item was added — refreshCartPrices()
  // is what corrects it, and that's a network call, not instant. Rendering
  // the (possibly wrong) cached price immediately and then silently
  // swapping it out a moment later was exactly the "shows Rs.345, flips to
  // Rs.254 a second later" flash being reported. Now the price is held back
  // behind a short skeleton until that first sync actually resolves, so the
  // shopper only ever sees the correct number — never a wrong one first.
  useEffect(() => {
    if (refreshedRef.current) return
    refreshedRef.current = true
    if (cart.length === 0) { setPricesSynced(true); return }
    const safetyNet = setTimeout(() => setPricesSynced(true), 4000)
    ;(async () => {
      try { await refreshCartPrices(supabase) } finally { clearTimeout(safetyNet); setPricesSynced(true) }
    })()
    return () => clearTimeout(safetyNet)
  }, [cart.length])

  // Helper: get live effective price for a cart item
  // BUGFIX (round 2): my earlier fix here still required item.sale_active
  // to be true. Turns out that's wrong per the actual authoritative source
  // of truth — app/api/validate-order/route.js, the server-side check that
  // decides what a customer is really charged — which explicitly does NOT
  // require sale_active for a permanent (no sale_ends_at) discount:
  //   permanentDisc = !p.sale_ends_at   (no expiry set — permanent discount,
  //                                       independent of sale_active)
  // Copied that exact three-part logic here now instead of a fourth
  // slightly-different guess: hasDiscount, saleEndedInPast, timerRunning,
  // permanentDisc, combined the same way the server combines them.
  function effectivePrice(item) {
    const now = new Date()
    const hasDiscount     = item.discount_price && item.discount_price < item.price
    const saleEndedInPast = item.sale_ends_at && new Date(item.sale_ends_at) <= now
    const timerRunning    = item.sale_active && item.sale_ends_at && new Date(item.sale_ends_at) > now
    const permanentDisc   = !item.sale_ends_at
    const saleOk = hasDiscount && !saleEndedInPast && (timerRunning || permanentDisc)
    return saleOk ? item.discount_price : item.price
  }

  // Wait for localStorage cart to load before rendering anything — prevents
  // React hydration mismatch (#418) where server renders empty cart but
  // client immediately has items from localStorage.
  if (!cartReady) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="animate-pulse text-4xl mb-4">🛒</div>
    </div>
  )

  if (cart.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="text-7xl mb-4">🛒</div>
      <h2 className="font-display text-xl font-bold mb-2" style={{ color: 'var(--viro-text)' }}>Your cart is empty</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--viro-textSub)' }}>Add some products to get started!</p>
      <Link href="/shop" className="btn-primary px-8 py-3">Browse Products</Link>
      {isLinkedToAccount && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            onClick={handleSyncCart}
            disabled={syncing}
            className="text-sm font-semibold underline"
            style={{ color: 'var(--viro-accent, #7C3AED)', opacity: syncing ? 0.5 : 1 }}
          >
            {syncing ? 'Checking your account…' : "Expecting items here? Sync from your account"}
          </button>
          {syncMsg && (
            <p className="text-xs" style={{ color: syncMsg.type === 'error' ? '#DC2626' : 'var(--viro-textSub)' }}>
              {syncMsg.text}
            </p>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="px-4 pb-24 md:pb-8 pt-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-xl font-bold" style={{ color: 'var(--viro-text)' }}>
          My Cart <span className="text-base font-normal" style={{ color: 'var(--viro-textSub)' }}>({cartCount} items)</span>
        </h1>
        {isLinkedToAccount && (
          <button
            onClick={handleSyncCart}
            disabled={syncing}
            className="text-xs font-semibold flex items-center gap-1"
            style={{ color: 'var(--viro-textSub)', opacity: syncing ? 0.5 : 1 }}
            title="Pull the latest cart saved to your account"
          >
            <span className={syncing ? 'animate-spin' : ''}>🔄</span> {syncing ? 'Syncing…' : 'Sync'}
          </button>
        )}
      </div>
      {syncMsg && (
        <p className="text-xs mb-3 -mt-2" style={{ color: syncMsg.type === 'error' ? '#DC2626' : 'var(--viro-textSub)' }}>
          {syncMsg.text}
        </p>
      )}

      {/* Price-drop banner — now only ever fires for a DROP (see
          CartContext's refreshCartPrices), so framed as good news rather
          than the old "⚠️ sale has ended" warning tone, which no longer
          fits since a price rise never reaches this banner at all. */}
      {priceChanges.length > 0 && (
        <div className="mb-4 rounded-2xl p-4" style={{
          background: 'linear-gradient(135deg,#D1FAE5,#ECFDF5)',
          border: '1.5px solid #10B981',
          boxShadow: '0 2px 12px rgba(16,185,129,0.15)',
        }}>
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0">🎉</span>
            <div className="flex-1">
              <p className="font-bold text-sm mb-1" style={{ color: '#065F46' }}>
                Price drop! Good news for your cart
              </p>
              {priceChanges.map(c => (
                <p key={c.id} className="text-xs mb-0.5" style={{ color: '#047857' }}>
                  <strong>{c.name}</strong>: <span style={{textDecoration:'line-through',opacity:0.7}}>Rs.{c.oldPrice?.toLocaleString()}</span>
                  {' → '}
                  <strong>Rs.{c.newPrice?.toLocaleString()}</strong>
                </p>
              ))}
            </div>
            <button
              onClick={clearPriceChanges}
              className="text-emerald-700 hover:text-emerald-900 text-lg leading-none flex-shrink-0 mt-0.5"
              title="Dismiss"
            >✕</button>
          </div>
        </div>
      )}

      <div className="md:flex md:gap-6 md:items-start">

        {/* Cart items */}
        <div className="space-y-3 mb-6 md:mb-0 md:flex-1">
          {cart.map(item => {
            const itemPrice = effectivePrice(item)
            // BUGFIX: this used to be its own independent copy of the sale
            // check (same "requires sale_ends_at to be truthy" bug fixed in
            // effectivePrice() above) — controlling whether the strikethrough
            // original-price badge shows. Now derived directly from
            // itemPrice itself, which effectivePrice() already computed
            // correctly — impossible for this to disagree with the actual
            // displayed price since it's the same calculation, not a
            // separate guess at it.
            const showStrike = itemPrice < item.price
            const wasChanged = priceChanges.some(c => c.id === item.id)

            // ── Per-variant stock check ──────────────────────
            const cartKey = item._cartKey || item.id
            const variantStock = item.selected_color?.stock ?? item.stock ?? 999
            const isOOS   = variantStock <= 0
            const isLow   = !isOOS && variantStock <= 5
            const maxQty  = isOOS ? 0 : Math.min(variantStock, 99)
            const qtyOver = item.quantity > maxQty && maxQty > 0

            const isHidden = item.is_active === false

            return (
              <div key={cartKey}
                className="viro-card p-3 flex gap-3 items-start slide-up"
                style={{
                  ...(wasChanged ? { border: '1.5px solid #F59E0B', boxShadow: '0 0 0 3px rgba(245,158,11,0.08)' } : {}),
                  ...(isHidden ? { border: '1.5px solid #7C3AED60', opacity: 0.75 } : isOOS ? { opacity: 0.75 } : {}),
                }}
              >
                {/* Product image — show variant colour image if available */}
                <Link href={item.isDeal ? `/deal/${item.dealId}` : `/product/${slugify(item.name)}-${item.id}`} className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 relative"
                    style={{ background: 'var(--viro-bgDeep)', border: '1px solid var(--viro-border)' }}>
                    <ProductImage
                      images={item.selected_image ? [item.selected_image, ...(Array.isArray(item.images) ? item.images : [])] : item.images}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                    {isHidden && (
                      <div style={{ position:'absolute',inset:0,background:'rgba(124,58,237,0.65)',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:12 }}>
                        <span style={{ fontSize:9,fontWeight:900,color:'#fff',textAlign:'center',lineHeight:1.2 }}>UNAVAILABLE</span>
                      </div>
                    )}
                    {!isHidden && isOOS && (
                      <div style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:12 }}>
                        <span style={{ fontSize:9,fontWeight:900,color:'#fff',textAlign:'center',lineHeight:1.2 }}>OUT OF STOCK</span>
                      </div>
                    )}
                  </div>
                </Link>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <Link href={item.isDeal ? `/deal/${item.dealId}` : `/product/${slugify(item.name)}-${item.id}`}>
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--viro-text)' }}>
                      {item.isDeal && <span style={{ marginRight: 4 }}>🎁</span>}{item.name}
                    </p>
                  </Link>

                  {/* Variant chips — colour + size */}
                  {(item.selected_color_name || item.selected_size_name) && (
                    <div className="flex gap-1 mt-0.5 flex-wrap">
                      {item.selected_color_name && (
                        <span style={{ fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:20,background:'var(--viro-bgDeep)',border:'1px solid var(--viro-border)',color:'var(--viro-textSub)',display:'inline-flex',alignItems:'center',gap:4 }}>
                          {item.selected_color?.hex && (
                            <span style={{ width:8,height:8,borderRadius:'50%',background:item.selected_color.hex,flexShrink:0,border:'1px solid rgba(0,0,0,0.15)' }}/>
                          )}
                          {item.selected_color_name}
                        </span>
                      )}
                      {item.selected_size_name && (
                        <span style={{ fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:20,background:'var(--viro-bgDeep)',border:'1px solid var(--viro-border)',color:'var(--viro-textSub)' }}>
                          {item.selected_size_name}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-baseline gap-2 mt-0.5">
                    {pricesSynced ? (
                      <>
                        <p className="text-sm font-bold" style={{ color: '#00BFFF' }}>
                          Rs. {itemPrice?.toLocaleString()}
                        </p>
                        {showStrike && (
                          <p className="text-xs line-through" style={{ color: 'var(--viro-textSub)' }}>
                            Rs. {item.price?.toLocaleString()}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="animate-pulse" style={{ display:'inline-block', width:64, height:16, borderRadius:6, background:'var(--viro-border)' }} />
                    )}
                  </div>

                  {/* Stock warnings */}
                  {isOOS && <p className="text-xs font-bold mt-0.5" style={{ color:'#EF4444' }}>⛔ Out of stock — remove to checkout</p>}
                  {isLow && !isOOS && <p className="text-xs font-semibold mt-0.5" style={{ color:'#F59E0B' }}>⚠️ Only {variantStock} left</p>}
                  {qtyOver && <p className="text-xs font-semibold mt-0.5" style={{ color:'#F59E0B' }}>⚠️ Only {maxQty} in stock</p>}
                  {wasChanged && <p className="text-xs font-semibold mt-0.5" style={{ color: '#D97706' }}>⚠️ Price updated</p>}
                </div>

                {/* Controls */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <button onClick={() => removeFromCart(cartKey)}
                    className="text-red-400/60 hover:text-red-400 text-xs transition-colors leading-none">✕</button>
                  <div className="flex items-center gap-1 rounded-xl px-2 py-1"
                    style={{ background: 'var(--viro-bgDeep)', border: '1px solid var(--viro-border)' }}>
                    <button onClick={() => updateQty(cartKey, item.quantity - 1)}
                      className="w-6 h-6 flex items-center justify-center font-bold"
                      style={{ color: 'var(--viro-textSub)' }}>−</button>
                    <span className="w-6 text-center text-sm font-bold" style={{ color: 'var(--viro-text)' }}>{item.quantity}</span>
                    <button onClick={() => updateQty(cartKey, item.quantity + 1)}
                      disabled={item.quantity >= maxQty}
                      className="w-6 h-6 flex items-center justify-center font-bold"
                      style={{ color: item.quantity >= maxQty ? 'var(--viro-border)' : 'var(--viro-textSub)', cursor: item.quantity >= maxQty ? 'not-allowed' : 'pointer' }}>+</button>
                  </div>
                  {pricesSynced ? (
                    <p className="text-xs font-semibold" style={{ color: 'var(--viro-textSub)' }}>
                      Rs. {(itemPrice * item.quantity)?.toLocaleString()}
                    </p>
                  ) : (
                    <span className="animate-pulse" style={{ display:'inline-block', width:44, height:12, borderRadius:5, background:'var(--viro-border)' }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Order Summary */}
        <div className="md:w-72 md:sticky md:top-16 flex-shrink-0">
          <FreeGiftProgress />
          <div className="viro-card p-5 mb-4">
            <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--viro-text)' }}>Order Summary</h3>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span style={{ color: 'var(--viro-textSub)' }}>Subtotal ({cartCount} items)</span>
                {pricesSynced ? (
                  <span className="font-semibold" style={{ color: 'var(--viro-text)' }}>Rs. {cartTotal.toLocaleString()}</span>
                ) : (
                  <span className="animate-pulse" style={{ display:'inline-block', width:60, height:14, borderRadius:6, background:'var(--viro-border)' }} />
                )}
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--viro-textSub)' }}>Delivery</span>
                <span className="text-xs" style={{ color: '#A78BFA' }}>Calculated at checkout</span>
              </div>
            </div>
            <div className="border-t pt-4 mb-5" style={{ borderColor: 'var(--viro-border)' }}>
              <div className="flex justify-between font-bold">
                <span style={{ color: 'var(--viro-text)' }}>Total</span>
                {pricesSynced ? (
                  <span className="text-lg" style={{ color: '#00BFFF' }}>Rs. {cartTotal.toLocaleString()}</span>
                ) : (
                  <span className="animate-pulse" style={{ display:'inline-block', width:72, height:18, borderRadius:6, background:'var(--viro-border)' }} />
                )}
              </div>
            </div>

            {/* Coupon teaser — only when admin enables coupons */}
            {couponEnabled && !couponShown && (
              <button onClick={() => setCouponShown(true)}
                style={{
                  width:'100%', marginBottom:12, padding:'10px 14px',
                  borderRadius:12, background:'linear-gradient(135deg,#7C3AED10,#4F46E510)',
                  border:'1.5px dashed #7C3AED50', textAlign:'left', cursor:'pointer',
                  display:'flex', alignItems:'center', gap:8,
                }}>
                <span style={{ fontSize:18 }}>🏷️</span>
                <div>
                  <p style={{ fontSize:12, fontWeight:800, color:'#7C3AED', margin:0 }}>Have a coupon code?</p>
                  <p style={{ fontSize:10, color:'var(--viro-textSub)', margin:0 }}>Tap to apply discount at checkout</p>
                </div>
                <span style={{ marginLeft:'auto', fontSize:14, color:'#7C3AED' }}>›</span>
              </button>
            )}
            {couponEnabled && couponShown && (
              <div style={{ marginBottom:12, borderRadius:14, overflow:'hidden',
                border: couponResult?.valid ? '1.5px solid #10B98150' : '1.5px solid #7C3AED30',
                background: couponResult?.valid ? 'linear-gradient(135deg,#10B98110,#05966910)' : '#7C3AED06',
              }}>
                {/* Header */}
                <div style={{ padding:'10px 12px 6px', display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:15 }}>🏷️</span>
                  <span style={{ fontSize:12, fontWeight:800, color: couponResult?.valid ? '#10B981' : '#7C3AED' }}>
                    {couponResult?.valid ? 'Coupon Applied!' : 'Coupon Code'}
                  </span>
                  <button onClick={() => { setCouponShown(false); removeCartCoupon() }}
                    style={{ marginLeft:'auto', fontSize:13, color:'var(--viro-textSub)', background:'none', border:'none', cursor:'pointer' }}>✕</button>
                </div>

                {couponResult?.valid ? (
                  /* ── Applied state ── */
                  <div style={{ padding:'0 12px 12px' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', borderRadius:10, background:'#10B98115', border:'1px solid #10B98130' }}>
                      <div>
                        <p style={{ margin:0, fontSize:13, fontWeight:900, color:'#10B981', fontFamily:'monospace', letterSpacing:'0.08em' }}>{couponCode}</p>
                        <p style={{ margin:0, fontSize:10, color:'#059669', fontWeight:600 }}>
                          {couponResult.coupon?.type === 'percent'
                            ? `${couponResult.coupon.value}% off`
                            : `Rs.${couponResult.coupon?.value} off`} · Saving Rs.{couponResult.discount?.toLocaleString()}
                        </p>
                      </div>
                      <button onClick={removeCartCoupon}
                        style={{ fontSize:10, fontWeight:700, color:'#EF4444', background:'#EF444415', border:'1px solid #EF444430', borderRadius:6, padding:'3px 8px', cursor:'pointer' }}>
                        Remove
                      </button>
                    </div>
                    {/* Updated bill preview */}
                    <div style={{ marginTop:10, padding:'8px 10px', borderRadius:10, background:'var(--viro-bgDeep)', fontSize:11 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                        <span style={{ color:'var(--viro-textSub)' }}>Subtotal</span>
                        <span style={{ fontWeight:700, color:'var(--viro-text)' }}>Rs.{cartTotal.toLocaleString()}</span>
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                        <span style={{ color:'#10B981', fontWeight:700 }}>🏷️ Coupon Discount</span>
                        <span style={{ fontWeight:800, color:'#10B981' }}>−Rs.{couponResult.discount?.toLocaleString()}</span>
                      </div>
                      <div style={{ borderTop:'1px solid var(--viro-border)', paddingTop:4, display:'flex', justifyContent:'space-between' }}>
                        <span style={{ fontWeight:800, color:'var(--viro-text)' }}>New Total</span>
                        <span style={{ fontWeight:900, color:'#7C3AED', fontSize:13 }}>Rs.{(cartTotal - (couponResult.discount||0)).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── Input state ── */
                  <div style={{ padding:'0 12px 12px' }}>
                    <div style={{ display:'flex', gap:6 }}>
                      <input value={couponCode}
                        onChange={e => { setCouponCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'')); setCouponResult(null) }}
                        onKeyDown={e => e.key === 'Enter' && applyCartCoupon()}
                        placeholder="e.g. VIRO20, EID50"
                        maxLength={20}
                        style={{ flex:1, padding:'9px 11px', borderRadius:9,
                          border: couponResult && !couponResult.valid ? '1.5px solid #EF4444' : '1.5px solid #7C3AED30',
                          background:'var(--viro-bg)', fontSize:13, fontWeight:800,
                          fontFamily:'monospace', letterSpacing:'0.08em', color:'var(--viro-text)', outline:'none' }}
                      />
                      <button onClick={applyCartCoupon} disabled={couponLoading || !couponCode.trim()}
                        style={{ padding:'9px 14px', borderRadius:9, fontWeight:800, fontSize:12, border:'none', cursor:'pointer', flexShrink:0,
                          background: couponCode.trim() ? 'linear-gradient(135deg,#7C3AED,#4F46E5)' : 'var(--viro-bgDeep)',
                          color: couponCode.trim() ? '#fff' : 'var(--viro-textSub)',
                        }}>
                        {couponLoading
                          ? <svg style={{width:14,height:14,animation:'spin 1s linear infinite'}} viewBox="0 0 24 24" fill="none"><circle opacity=".25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path opacity=".75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                          : 'Apply'}
                      </button>
                    </div>
                    {couponResult && !couponResult.valid && (
                      <p style={{ margin:'5px 0 0', fontSize:11, color:'#EF4444', fontWeight:600 }}>❌ {couponResult.error}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Problem items — clickable banners */}
            {(() => {
              const hiddenItems = cart.filter(i => i.is_active === false)
              const oosItems = cart.filter(i => (i.selected_color?.stock ?? i.stock ?? 999) <= 0)
              const overQtyItems = cart.filter(i => {
                const stock = i.selected_color?.stock ?? i.stock ?? 999
                return stock > 0 && i.quantity > stock
              })
              if (hiddenItems.length > 0) return (
                <button onClick={() => setProblemPopup('hidden')}
                  style={{ width:'100%',marginBottom:12,padding:'10px 14px',borderRadius:12,background:'#7C3AED12',border:'1px solid #7C3AED40',textAlign:'left',cursor:'pointer' }}>
                  <p style={{ fontSize:12,fontWeight:700,color:'#7C3AED',margin:'0 0 2px' }}>🚫 {hiddenItems.length} item{hiddenItems.length>1?'s are':' is'} no longer available</p>
                  <p style={{ fontSize:11,color:'var(--viro-textSub)',margin:0 }}>Tap to review and remove → </p>
                </button>
              )
              if (oosItems.length > 0) return (
                <button onClick={() => setProblemPopup('oos')}
                  style={{ width:'100%',marginBottom:12,padding:'10px 14px',borderRadius:12,background:'#EF444412',border:'1px solid #EF444430',textAlign:'left',cursor:'pointer' }}>
                  <p style={{ fontSize:12,fontWeight:700,color:'#EF4444',margin:'0 0 2px' }}>⛔ {oosItems.length} item{oosItems.length>1?'s are':' is'} out of stock</p>
                  <p style={{ fontSize:11,color:'var(--viro-textSub)',margin:0 }}>Tap to review and remove → </p>
                </button>
              )
              if (overQtyItems.length > 0) return (
                <div style={{ marginBottom:12,padding:'10px 14px',borderRadius:12,background:'#F59E0B12',border:'1px solid #F59E0B30' }}>
                  <p style={{ fontSize:12,fontWeight:700,color:'#F59E0B',margin:'0 0 4px' }}>⚠️ Quantity exceeds stock</p>
                  <p style={{ fontSize:11,color:'var(--viro-textSub)',margin:0 }}>Please reduce quantity for highlighted items.</p>
                </div>
              )
              return null
            })()}

            {!pricesSynced ? (
              <div className="animate-pulse w-full py-3.5 rounded-xl" style={{ background: 'var(--viro-border)', height: 48 }} />
            ) : (() => {
              const hasHidden = cart.some(i => i.is_active === false)
              const hasOOS = cart.some(i => (i.selected_color?.stock ?? i.stock ?? 999) <= 0)
              const blocked = hasHidden || hasOOS
              const belowMinOrder = !blocked && minOrder?.enabled && cartTotal < minOrder.amount
              const remaining = belowMinOrder ? Math.ceil(minOrder.amount - cartTotal) : 0
              const pct = belowMinOrder ? Math.min(100, Math.round((cartTotal / minOrder.amount) * 100)) : 100
              return (
                <>
                  {belowMinOrder && (
                    <div style={{
                      marginBottom: 14, padding: '14px 16px', borderRadius: 16,
                      background: 'var(--viro-bgCard)',
                      border: '1.5px solid var(--viro-border)',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                          background: 'linear-gradient(135deg,#7C3AED15,#EC489915)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                        }}>🛒</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--viro-text)' }}>
                            Almost there — add Rs.{remaining.toLocaleString()} more
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--viro-textSub)' }}>
                            Minimum order to checkout is Rs.{minOrder.amount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: 'var(--viro-bgDeep)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${pct}%`, borderRadius: 999,
                          background: 'linear-gradient(90deg,#7C3AED,#EC4899)',
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: 10.5, fontWeight: 700, color: '#7C3AED', textAlign: 'right' }}>
                        Rs.{Math.round(cartTotal).toLocaleString()} / Rs.{minOrder.amount.toLocaleString()}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      if (blocked) { setProblemPopup(hasHidden ? 'hidden' : 'oos'); return }
                      if (belowMinOrder) {
                        try {
                          sessionStorage.setItem('viro_min_order_reminder', JSON.stringify({ remaining, amount: minOrder.amount }))
                        } catch {}
                        router.push('/shop')
                        return
                      }
                      router.push('/checkout')
                    }}
                    className="w-full py-3.5 text-sm font-bold"
                    onClickCapture={() => { if (couponEnabled && couponCode) localStorage.setItem('viro_pending_coupon', couponCode) }}
                    style={
                      blocked ? { borderRadius: 14, border:'none', color:'#fff', opacity:0.7, background:'linear-gradient(135deg,#7C3AED,#4F46E5)', cursor:'pointer' }
                      : belowMinOrder ? {
                          borderRadius: 14, border:'none', color:'#fff', cursor:'pointer',
                          background:'linear-gradient(135deg,#7C3AED,#EC4899)',
                          boxShadow:'0 4px 16px rgba(124,58,237,0.3)',
                          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                        }
                      : { borderRadius: 14, border:'none', color:'#fff', cursor:'pointer', background:'linear-gradient(135deg,#7C3AED,#4F46E5)' }
                    }>
                    {hasHidden ? '🚫 Fix unavailable items →'
                      : hasOOS ? '⛔ Fix out-of-stock items →'
                      : belowMinOrder ? <>✨ Continue Shopping →</>
                      : 'Proceed to Checkout →'}
                  </button>
                </>
              )
            })()}
          </div>

          <StockCheckPopup />
          {/* ── Problem items popup ── */}
          {problemPopup && (() => {
            const isHiddenMode = problemPopup === 'hidden'
            const items = cart.filter(i =>
              isHiddenMode
                ? i.is_active === false
                : (i.selected_color?.stock ?? i.stock ?? 999) <= 0
            )
            const accentColor = isHiddenMode ? '#7C3AED' : '#EF4444'
            const title = isHiddenMode ? '🚫 Unavailable Items' : '⛔ Out of Stock Items'
            const subtitle = isHiddenMode
              ? 'These products are no longer sold. Remove them to checkout.'
              : 'These products are out of stock. Remove or save for later.'
            return (
              <div style={{ position:'fixed',inset:0,zIndex:999,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center' }}
                onClick={() => setProblemPopup(null)}>
                <div style={{ width:'100%',maxWidth:480,background:'var(--viro-bg)',borderRadius:'20px 20px 0 0',padding:'20px 16px 32px',maxHeight:'80vh',overflowY:'auto' }}
                  onClick={e => e.stopPropagation()}>
                  {/* Handle */}
                  <div style={{ width:40,height:4,borderRadius:4,background:'var(--viro-border)',margin:'0 auto 16px' }}/>
                  <h3 style={{ fontSize:16,fontWeight:800,color:accentColor,margin:'0 0 4px' }}>{title}</h3>
                  <p style={{ fontSize:12,color:'var(--viro-textSub)',margin:'0 0 16px' }}>{subtitle}</p>

                  <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                    {items.map(item => {
                      const cartKey = item._cartKey || item.id
                      const inWish = isInWishlist(item.id)
                      return (
                        <div key={cartKey} style={{ display:'flex',gap:12,alignItems:'center',padding:'10px 12px',borderRadius:14,background:'var(--viro-bgDeep)',border:`1px solid ${accentColor}30` }}>
                          {/* Image */}
                          <div style={{ width:52,height:52,borderRadius:10,overflow:'hidden',flexShrink:0,border:'1px solid var(--viro-border)',position:'relative' }}>
                            <ProductImage images={item.selected_image ? [item.selected_image,...(Array.isArray(item.images)?item.images:[])] : item.images} alt={item.name} className="w-full h-full object-cover" />
                            <div style={{ position:'absolute',inset:0,background:`${accentColor}99`,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:10 }}>
                              <span style={{ fontSize:8,fontWeight:900,color:'#fff' }}>{isHiddenMode?'N/A':'OOS'}</span>
                            </div>
                          </div>
                          {/* Info */}
                          <div style={{ flex:1,minWidth:0 }}>
                            <p style={{ fontSize:13,fontWeight:700,color:'var(--viro-text)',margin:'0 0 2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{item.name}</p>
                            {item.selected_color_name && <p style={{ fontSize:11,color:'var(--viro-textSub)',margin:0 }}>{item.selected_color_name}{item.selected_size_name ? ` · ${item.selected_size_name}` : ''}</p>}
                            <p style={{ fontSize:12,fontWeight:600,color:accentColor,margin:'2px 0 0' }}>Rs.{((item.discount_price||item.price)*item.quantity).toLocaleString()}</p>
                          </div>
                          {/* Actions */}
                          <div style={{ display:'flex',flexDirection:'column',gap:6,flexShrink:0 }}>
                            <button onClick={() => { toggleWishlist(item); removeFromCart(cartKey) }}
                              style={{ padding:'5px 10px',borderRadius:8,fontSize:11,fontWeight:700,background:'#7C3AED15',color:'#7C3AED',border:'1px solid #7C3AED30',cursor:'pointer',whiteSpace:'nowrap' }}>
                              {inWish ? '♥ Wishlisted' : '♡ Wishlist'}
                            </button>
                            <button onClick={() => removeFromCart(cartKey)}
                              style={{ padding:'5px 10px',borderRadius:8,fontSize:11,fontWeight:700,background:'#EF444415',color:'#EF4444',border:'1px solid #EF444430',cursor:'pointer' }}>
                              🗑 Remove
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Remove all */}
                  <button
                    onClick={() => { items.forEach(i => removeFromCart(i._cartKey || i.id)); setProblemPopup(null) }}
                    style={{ width:'100%',marginTop:16,padding:'13px',borderRadius:12,background:`linear-gradient(135deg,${accentColor},${isHiddenMode?'#4F46E5':'#DC2626'})`,color:'#fff',fontWeight:800,fontSize:14,border:'none',cursor:'pointer' }}>
                    🗑 Remove All {isHiddenMode ? 'Unavailable' : 'Out-of-Stock'} Items
                  </button>
                  <button onClick={() => setProblemPopup(null)}
                    style={{ width:'100%',marginTop:8,padding:'11px',borderRadius:12,background:'var(--viro-bgDeep)',color:'var(--viro-textSub)',fontWeight:600,fontSize:13,border:'1px solid var(--viro-border)',cursor:'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )
          })()}

        </div>
      </div>
    </div>
  )
}

export default function CartClient() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--viro-sectionBg)' }} />}>
      <CartInner />
    </Suspense>
  )
}
