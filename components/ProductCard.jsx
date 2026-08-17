'use client'
import { slugify } from '../lib/slugify'
import { supabase } from '../lib/supabase'
import Image from 'next/image'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CountdownBadge, LaunchCountdownBadge } from './CountdownTimer'
import { useCart, parseImages } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'
import { useSite } from '../context/SiteSettingsContext'
import { Stars } from './ProductReviews'
import { openWhatsApp } from '../lib/whatsapp'
import VariantPickerPopup from './VariantPickerPopup'
import { useImageFallback } from '../lib/useImageFallback'

const BLUR_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const ProductCard = React.memo(function ProductCard({ product: initialProduct, compact = false, priority = false }) {
  const { contact, ordersBadgeEnabled, minOrder, getFreeThreshold } = useSite()
  const { addToCart } = useCart()
  const { toggleWishlist, isInWishlist } = useWishlist()
  const router = useRouter()

  const [product, setProduct] = useState(initialProduct)
  const [activating, setActivating] = useState(false)
  const [added, setAdded] = useState(false)
  const [variantPopup, setVariantPopup] = useState(null)
  const activatedRef = useRef(false)
  const saleExpiredCardRef = useRef(false)

  useEffect(() => { setProduct(initialProduct) }, [initialProduct])

  const images = parseImages(product.images)
  const thumb = images[0] || 'https://placehold.co/400x300/F1F5F9/8B5CF6?text=Viro'
  // Try Vercel's optimized image first; if the monthly optimization quota is
  // exhausted (402), automatically falls back to the raw file so the photo
  // still shows instead of a broken box — see lib/useImageFallback.js
  const { src: imgSrc, unoptimized: imgUnoptimized, handleError: imgHandleError } = useImageFallback(thumb, { width: 400, quality: 75 })

  // Sale/launch timers use the current time to decide what to show — but
  // computing `new Date()` directly during render is a classic Next.js
  // hydration bug: the server renders at one instant, the client's first
  // paint happens at a slightly later instant, and if a sale's end time
  // falls between those two moments, server and client compute DIFFERENT
  // booleans (badge showing vs not) → React throws hydration error #418.
  // Fix: gate all time-based output behind `mounted`, which is guaranteed
  // false on both the server render AND the client's first paint (identical
  // either way), then flips true via useEffect — a plain client-side update
  // after hydration has already safely completed, not a hydration check.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const now = mounted ? new Date() : null
  const isComingSoon  = product.status === 'coming_soon'
  const isLaunching   = mounted && isComingSoon && !!product.launch_at && new Date(product.launch_at) > now
  const hasSaleTimer  = mounted && product.sale_active && product.sale_ends_at && new Date(product.sale_ends_at) > now
  const hasLegacyTimer= mounted && !hasSaleTimer && product.countdown_ends_at && new Date(product.countdown_ends_at) > now
  const hasDiscount   = product.discount_price && product.discount_price < product.price
  const saleEndedInPast = mounted && product.sale_ends_at && new Date(product.sale_ends_at) <= now
  const effectiveDisc = hasDiscount && (mounted ? (hasSaleTimer || (!product.sale_ends_at && !saleEndedInPast)) : !product.sale_ends_at)
  const displayPrice  = effectiveDisc ? product.discount_price : product.price
  const inStock       = product.stock > 0 && product.status !== 'out_of_stock' && !isComingSoon
  const discountPct   = effectiveDisc ? Math.round((1 - product.discount_price / product.price) * 100) : 0
  const wishlisted    = isInWishlist(product.id)
  // Below the admin's minimum order amount — hide the direct "Buy" button so
  // shoppers can only Add to Cart (encourages building up a bigger cart
  // instead of many tiny single-product orders that can't check out anyway).
  const belowMinOrder = minOrder?.enabled && displayPrice < minOrder.amount
  // Product alone is priced high enough to qualify for free delivery —
  // shown as an attractor badge so shoppers see the win without doing math.
  const freeThreshold = getFreeThreshold('')
  const qualifiesFreeDelivery = freeThreshold != null && displayPrice >= freeThreshold

  const handleSaleExpire = useCallback(async () => {
    if (saleExpiredCardRef.current) return
    saleExpiredCardRef.current = true
    setProduct(prev => ({ ...prev, sale_active: false, discount_price: null, sale_ends_at: null }))
    try {
      if (!supabase) return
      await supabase.rpc('combined_timer_check')
      await new Promise(r => setTimeout(r, 800))
      const { data } = await supabase.from('products').select('*, categories(id,name,icon,parent_id)').eq('id', product.id).single()
      if (data) setProduct(data)
    } catch (_) {}
  }, [product.id])

  const handleLaunchExpire = useCallback(async () => {
    if (activatedRef.current) return
    activatedRef.current = true
    setActivating(true)
    try {
      if (!supabase) return
      await supabase.rpc('combined_timer_check')
      await new Promise(r => setTimeout(r, 800))
      const { data } = await supabase.from('products').select('*, categories(id,name,icon,parent_id)').eq('id', product.id).single()
      if (data) setProduct(data)
    } catch (_) {} finally { setActivating(false) }
  }, [product.id])

  const needsVariantPicker = product.has_colors || product.has_sizes
  const [variantLoading, setVariantLoading] = useState(false)

  async function openVariantPopup(mode) {
    const hasVariants = (product.colors?.length > 0) || (product.sizes?.length > 0)
    if (hasVariants) { setVariantPopup(mode); return }
    setVariantLoading(true)
    try {
      if (!supabase) { setVariantPopup(mode); return }
      const pid = product.id
      const [colorsRes, sizesRes, matrixRes] = await Promise.all([
        supabase.from('product_colors').select('*').eq('product_id', pid).order('sort_order'),
        supabase.from('product_sizes').select('*').eq('product_id', pid).order('sort_order'),
        supabase.from('product_color_size_stock').select('color_id,size_id,stock').eq('product_id', pid),
      ])
      const colorSizeMatrix = {}
      for (const row of (matrixRes.data || [])) colorSizeMatrix[`${row.color_id}:${row.size_id}`] = row.stock
      const colors = (colorsRes.data || []).map(c => ({ ...c, uid: c.id }))
      const sizes  = (sizesRes.data  || []).map(s => ({ ...s, uid: s.id }))
      setProduct(prev => ({ ...prev, colors, sizes, colorSizeMatrix }))
    } catch (_) {} finally { setVariantLoading(false); setVariantPopup(mode) }
  }

  function handleAddToCart(e) {
    e.preventDefault(); e.stopPropagation()
    if (needsVariantPicker) { openVariantPopup('cart'); return }
    addToCart(product)
    import('../lib/metaEvents').then(m => m.trackAddToCart(product, 1, {})).catch(() => {})
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }
  function handleOrderNow(e) {
    e.preventDefault(); e.stopPropagation()
    if (needsVariantPicker) { openVariantPopup('order'); return }
    sessionStorage.setItem('viro_quick_order', JSON.stringify([{ ...product, quantity: 1 }]))
    router.push('/checkout?quick=1&t=' + Date.now())
  }
  function handleVariantConfirm(selectionsArr) {
    // BUGFIX: VariantPickerPopup.onConfirm ALWAYS calls back with an array —
    // onConfirm([{ colorId, sizeId, color, size, qty, stock }]) for a single
    // pick, or onConfirm(selections) for multiple. This function used to
    // destructure { colorId, sizeId, color, size } straight off that array,
    // which silently returns undefined for all four (arrays don't have those
    // named properties) — so the customer's colour/size choice was DROPPED
    // right here, before it ever reached the cart, even though the popup UI
    // showed it selected correctly. This is why colour never showed up in
    // cart, order review, or admin — it was never actually being saved.
    const selections = Array.isArray(selectionsArr) ? selectionsArr : [selectionsArr]
    const enrichedItems = selections.map(({ colorId, sizeId, color, size, qty }) => {
      const variantImg = color?.images?.[0] || null
      return { ...product, selected_color_id: colorId, selected_size_id: sizeId,
        selected_color: color, selected_size: size,
        selected_color_name: color?.label || null, selected_size_name: size?.label || null,
        selected_image: variantImg, quantity: qty || 1 }
    })

    if (variantPopup === 'cart') {
      // Also respects multi-selection — each colour/size combo the customer
      // added in the popup becomes its own cart line, at the qty they set.
      enrichedItems.forEach(item => {
        addToCart(item, item.quantity)
        import('../lib/metaEvents').then(m => m.trackAddToCart(item, item.quantity, {})).catch(() => {})
      })
      setAdded(true)
      setTimeout(() => setAdded(false), 2000)
    } else {
      sessionStorage.setItem('viro_quick_order', JSON.stringify(enrichedItems))
      router.push('/checkout?quick=1&t=' + Date.now())
    }
    setVariantPopup(null)
  }
  function handleWhatsApp(e) {
    e.preventDefault(); e.stopPropagation()
    const msg = isComingSoon
      ? `Hi Viro! I want to pre-register for: ${product.name}. Notify me when it launches!`
      : `Hi Viro! I'd like to book: ${product.name}. Notify me when it's back in stock!`
    openWhatsApp(msg, contact.whatsapp)
    import('../lib/metaEvents').then(m => m.trackContact('whatsapp_product_card')).catch(() => {})
  }
  function handleShare(e) {
    e.preventDefault(); e.stopPropagation()
    const url = `https://viro.pk/product/${slugify(product.name)}-${product.id}`
    import('../lib/metaEvents').then(m => m.trackContact('share_product')).catch(() => {})
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (isMobile && navigator.share) {
      navigator.share({ title: product.name, url }).catch(() => {})
    } else if (isMobile) {
      window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer')
    } else {
      navigator.clipboard?.writeText(url).then(() => {
        if (window.confirm('Link copied! Open in WhatsApp desktop app?')) {
          const a = document.createElement('a'); a.href = `whatsapp://send?text=${encodeURIComponent(url)}`; a.click()
        }
      }).catch(() => { window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer') })
    }
  }

  return (
    <div className="group" style={{
      background: 'var(--viro-bgCard, #fff)',
      border: '1px solid var(--viro-border, #F1F5F9)',
      borderRadius: 16,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      cursor: 'pointer',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(139,92,246,0.13)' }}
      onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.06)' }}
    >
      {/* ── IMAGE AREA ── */}
      <Link href={`/product/${slugify(product.name)}-${product.id}`}
        className="block flex-shrink-0 relative overflow-hidden"
        style={{ paddingTop: '90%', background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 50%, #FEF3C7 100%)', backgroundSize: '200% 200%', animation: 'shimmer-gold 1.5s ease-in-out infinite' }}>

        <Image
          src={imgSrc}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="transition-transform duration-500 group-hover:scale-105"
          style={{ objectFit: 'cover' }}
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          quality={75}
          priority={priority}
          unoptimized={imgUnoptimized}
          onError={imgHandleError}
        />

        {/* Dark gradient overlay at bottom for text legibility */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%',
          background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />

        {/* ── TOP LEFT: Discount badge ── */}
        {effectiveDisc && (
          <div style={{
            position: 'absolute', top: 8, left: 8,
            background: 'linear-gradient(135deg,#7C3AED,#F97316)',
            color: '#fff', fontWeight: 800, fontSize: 11,
            padding: '3px 8px', borderRadius: 20,
            boxShadow: '0 2px 8px rgba(124,58,237,0.4)',
            letterSpacing: '-0.2px',
          }}>-{discountPct}%</div>
        )}

        {/* ── TOP RIGHT: Status — only show if NOT in stock (Out of Stock / Coming Soon) ── */}
        {activating ? (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(254,249,195,0.95)', color: '#92400E',
            fontWeight: 700, fontSize: 10, padding: '3px 8px', borderRadius: 20,
            backdropFilter: 'blur(6px)',
          }}>⏳ Soon</div>
        ) : !inStock && isComingSoon ? (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(237,233,254,0.95)', color: '#6D28D9',
            fontWeight: 700, fontSize: 10, padding: '3px 8px', borderRadius: 20,
            backdropFilter: 'blur(6px)',
          }}>🚀 Coming Soon</div>
        ) : !inStock ? (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(254,226,226,0.95)', color: '#DC2626',
            fontWeight: 700, fontSize: 10, padding: '3px 8px', borderRadius: 20,
            backdropFilter: 'blur(6px)',
          }}>Out of Stock</div>
        ) : qualifiesFreeDelivery ? (
          /* ── TOP RIGHT (in-stock only): Free delivery attractor — same
             row as the -X% badge on the opposite corner, small + emoji ── */
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(16,185,129,0.95)', color: '#fff',
            fontWeight: 800, fontSize: 9, padding: '3px 7px', borderRadius: 20,
            backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', gap: 3,
            boxShadow: '0 2px 8px rgba(16,185,129,0.4)',
          }}>🚚 Free Delivery</div>
        ) : null /* ← In Stock, no free delivery: show nothing */}

        {/* ── BOTTOM LEFT: Wishlist ── */}
        <button
          onClick={e => {
            e.preventDefault(); e.stopPropagation()
            if (!wishlisted) import('../lib/metaEvents').then(m => m.trackAddToWishlist(product)).catch(() => {})
            toggleWishlist(product)
          }}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          style={{
            position: 'absolute', bottom: 8, left: 8,
            width: 30, height: 30, borderRadius: '50%',
            background: wishlisted ? 'rgba(244,63,94,0.18)' : 'rgba(255,255,255,0.18)',
            border: wishlisted ? '1.5px solid rgba(244,63,94,0.7)' : '1.5px solid rgba(255,255,255,0.5)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transition: 'transform 0.15s',
          }}
          onMouseDown={e => e.currentTarget.style.transform='scale(0.85)'}
          onMouseUp={e => e.currentTarget.style.transform='scale(1)'}
          onTouchStart={e => { e.stopPropagation(); e.currentTarget.style.transform='scale(0.85)' }}
          onTouchEnd={e => { e.stopPropagation(); e.currentTarget.style.transform='scale(1)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24"
            fill={wishlisted ? '#F43F5E' : 'none'}
            stroke={wishlisted ? '#F43F5E' : 'white'}
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
        </button>

        {/* ── BOTTOM RIGHT: Orders badge ── */}
        {ordersBadgeEnabled && product.show_order_count && (product.stock_complete ?? 0) > 0 && (
          <div style={{
            position: 'absolute', bottom: 8, right: 8,
            background: 'linear-gradient(135deg,#EF4444,#F97316)',
            color: '#fff', fontWeight: 800, fontSize: 9,
            padding: '2px 7px', borderRadius: 20,
            boxShadow: '0 2px 8px rgba(239,68,68,0.35)',
            display: 'flex', alignItems: 'center', gap: 3,
            backdropFilter: 'blur(4px)',
          }}>🔥 {product.stock_complete} ordered</div>
        )}
      </Link>

      {/* ── CARD BODY ── */}
      <div style={{ padding: '7px 8px 8px', display: 'flex', flexDirection: 'column', flex: 1 }}>

        {/* Category + Share row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          {product.categories ? (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
              background: 'rgba(139,92,246,0.08)', color: '#8B5CF6',
              border: '1px solid rgba(139,92,246,0.15)',
              letterSpacing: '0.1px',
            }}>
              {product.categories.icon} {product.categories.name}
            </div>
          ) : <span />}
          <button onClick={handleShare} title="Share" aria-label="Share product"
            style={{
              width: 24, height: 24, borderRadius: '50%',
              background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#94A3B8', padding: 0, flexShrink: 0, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(139,92,246,0.1)'; e.currentTarget.style.color='#7C3AED'; e.currentTarget.style.borderColor='rgba(139,92,246,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(148,163,184,0.1)'; e.currentTarget.style.color='#94A3B8'; e.currentTarget.style.borderColor='rgba(148,163,184,0.2)' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
        </div>

        {/* Product name — single line only, ellipsis if it doesn't fit
            (never wraps to a 2nd line), smaller font so more of the title
            is visible before truncating */}
        <Link href={`/product/${slugify(product.name)}-${product.id}`} style={{ textDecoration: 'none' }}>
          <p style={{
            margin: '0 0 3px', fontWeight: 700,
            fontSize: compact ? '10px' : '11px',
            lineHeight: 1.25, color: 'var(--viro-text, #0F172A)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{product.name}</p>
        </Link>

        {/* Rating or description — only reserves space when there's actually something to show */}
        {(product.review_count > 0 || product.description?.trim()) && (
          <div style={{ height: 14, display: 'flex', alignItems: 'center', marginBottom: 3 }}>
            {product.review_count > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Stars rating={Number(product.avg_rating || 0)} size={12} />
                <span style={{ fontSize: 11, color: '#FBBF24', fontWeight: 800 }}>{Number(product.avg_rating||0).toFixed(1)}</span>
                <span style={{ fontSize: 10, color: 'var(--viro-textSub, #94A3B8)' }}>({product.review_count})</span>
              </div>
            ) : (
              <span style={{
                fontSize: 10, color: 'var(--viro-textSub, #94A3B8)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', width: '100%',
              }}>
                {product.description.replace(/\n/g,' ').trim().slice(0, 70)}
              </span>
            )}
          </div>
        )}

        {/* Price row — "Only X left" badge sits inline on the same row,
            right after the price, when there's room (typical case). Price
            and strike-through never wrap or clip — for products with large
            numbers (e.g. Rs.2,449) where all three genuinely can't fit on
            one line, the badge wraps to its own line below instead of ever
            clipping the price. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 4, flexWrap: 'wrap', rowGap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, minWidth: 0, flexWrap: 'nowrap' }}>
            <span style={{
              color: '#7C3AED', fontWeight: 900,
              fontSize: compact ? '11.5px' : '12.5px',
              letterSpacing: '-0.3px', whiteSpace: 'nowrap', flexShrink: 0,
            }}>Rs.{displayPrice?.toLocaleString()}</span>
            {effectiveDisc && (
              <span style={{
                color: '#94A3B8', fontWeight: 400,
                fontSize: 9, textDecoration: 'line-through',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>Rs.{product.price?.toLocaleString()}</span>
            )}
          </div>
          {inStock && product.stock <= 5 && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0,
              background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)',
              borderRadius: 5, padding: '1.5px 4px', whiteSpace: 'nowrap',
            }}>
              <span style={{ fontSize: 7 }}>⚠️</span>
              <span style={{ color: '#EA6C00', fontSize: 8, fontWeight: 700, whiteSpace: 'nowrap' }}>{product.stock} left</span>
            </span>
          )}
        </div>

        {/* Timer / countdown */}
        {isComingSoon ? (
          <div style={{ marginBottom: 6 }}>
            {isLaunching
              ? <LaunchCountdownBadge endAt={product.launch_at} onExpire={handleLaunchExpire} />
              : <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  padding: '4px 8px', borderRadius: 8, width: '100%',
                  background: 'linear-gradient(135deg,#8B5CF6,#A78BFA)',
                  boxShadow: '0 2px 8px rgba(139,92,246,0.25)',
                }}>
                  <span style={{ fontSize: 9 }}>🚀</span>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: 10 }}>Coming Soon</span>
                </div>
            }
          </div>
        ) : hasSaleTimer ? (
          <div style={{ marginBottom: 6 }}>
            <CountdownBadge endAt={product.sale_ends_at} label="🔥 Sale" onExpire={handleSaleExpire} />
          </div>
        ) : hasLegacyTimer ? (
          <div style={{ marginBottom: 6 }}>
            <CountdownBadge endAt={product.countdown_ends_at} />
          </div>
        ) : null}

        {/* CTA buttons */}
        <div style={{ marginTop: 'auto', paddingTop: 1 }}>
          {inStock ? (
            belowMinOrder ? (
              <button onClick={handleAddToCart} disabled={variantLoading}
                style={{
                  width: '100%',
                  border: 'none',
                  cursor: variantLoading ? 'wait' : 'pointer',
                  borderRadius: 10, padding: compact ? '7px 0' : '9px 0',
                  fontSize: compact ? '10px' : '11.5px', fontWeight: 800,
                  background: added ? 'linear-gradient(135deg,#10B981,#059669)' : 'linear-gradient(135deg,#7C3AED,#A855F7)',
                  color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  boxShadow: added ? '0 3px 10px rgba(16,185,129,0.3)' : '0 3px 10px rgba(124,58,237,0.3)',
                  transition: 'all 0.3s cubic-bezier(.4,0,.2,1)',
                  opacity: variantLoading ? 0.7 : 1,
                  transform: added ? 'scale(1.02)' : 'scale(1)',
                }}
                onMouseDown={e => e.currentTarget.style.transform='scale(0.96)'}
                onMouseUp={e => e.currentTarget.style.transform= added ? 'scale(1.02)' : ''}
                onTouchStart={e => e.currentTarget.style.transform='scale(0.96)'}
                onTouchEnd={e => e.currentTarget.style.transform= added ? 'scale(1.02)' : ''}
              >
                {variantLoading ? '⏳' : added
                  ? <><span style={{fontSize: compact?11:13}}>✓</span> Added to Cart!</>
                  : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> Add to Cart</>
                }
              </button>
            ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              {/* Add to Cart */}
              <button onClick={handleAddToCart} disabled={variantLoading}
                style={{
                  flex: 1,
                  border: added ? '1.5px solid #10B981' : '1.5px solid var(--viro-border, #E8EAF0)',
                  cursor: variantLoading ? 'wait' : 'pointer',
                  borderRadius: 10, padding: compact ? '6px 0' : '8px 0',
                  fontSize: compact ? '10px' : '11px', fontWeight: 700,
                  background: added ? 'linear-gradient(135deg,#10B981,#059669)' : 'var(--viro-bgCard, #fff)',
                  color: added ? '#fff' : 'var(--viro-text, #1E293B)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  transition: 'all 0.3s cubic-bezier(.4,0,.2,1)',
                  opacity: variantLoading ? 0.7 : 1,
                  transform: added ? 'scale(1.03)' : 'scale(1)',
                }}
                onMouseEnter={e => { if (!added) { e.currentTarget.style.borderColor='#8B5CF6'; e.currentTarget.style.color='#7C3AED' }}}
                onMouseLeave={e => { if (!added) { e.currentTarget.style.borderColor='var(--viro-border, #E8EAF0)'; e.currentTarget.style.color='var(--viro-text, #1E293B)' }}}
                onMouseDown={e => e.currentTarget.style.transform='scale(0.96)'}
                onMouseUp={e => e.currentTarget.style.transform= added ? 'scale(1.03)' : ''}
                onTouchStart={e => e.currentTarget.style.transform='scale(0.96)'}
                onTouchEnd={e => e.currentTarget.style.transform= added ? 'scale(1.03)' : ''}
              >
                {variantLoading ? '⏳' : added
                  ? <><span style={{fontSize: compact?11:13}}>✓</span> Added!</>
                  : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> Add</>
                }
              </button>
              {/* Order Now */}
              <button onClick={handleOrderNow} disabled={variantLoading}
                style={{
                  flex: 1.3, border: 'none',
                  cursor: variantLoading ? 'wait' : 'pointer',
                  borderRadius: 10, padding: compact ? '6px 0' : '8px 0',
                  fontSize: compact ? '10px' : '11px', fontWeight: 800,
                  background: 'linear-gradient(135deg,#7C3AED,#6366F1)',
                  color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  boxShadow: '0 3px 10px rgba(124,58,237,0.3)',
                  transition: 'all 0.15s',
                  opacity: variantLoading ? 0.7 : 1,
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 14px rgba(124,58,237,0.45)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow='0 3px 10px rgba(124,58,237,0.3)'}
                onMouseDown={e => e.currentTarget.style.transform='scale(0.96)'}
                onMouseUp={e => e.currentTarget.style.transform=''}
                onTouchStart={e => e.currentTarget.style.transform='scale(0.96)'}
                onTouchEnd={e => e.currentTarget.style.transform=''}
              >
                {variantLoading ? '⏳' : <><span style={{ fontSize: 13 }}>⚡</span> Buy</>}
              </button>
            </div>
            )
          ) : (
            <button onClick={handleWhatsApp}
              style={{
                width: '100%', border: 'none', cursor: 'pointer', borderRadius: 10,
                padding: compact ? '6px 0' : '8px 0',
                fontSize: compact ? '10px' : '11px', fontWeight: 700,
                background: 'linear-gradient(135deg,#25D366,#128C7E)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                boxShadow: '0 3px 10px rgba(37,211,102,0.3)',
              }}
              onMouseDown={e => e.currentTarget.style.transform='scale(0.97)'}
              onMouseUp={e => e.currentTarget.style.transform=''}
              onTouchStart={e => e.currentTarget.style.transform='scale(0.97)'}
              onTouchEnd={e => e.currentTarget.style.transform=''}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              {isComingSoon ? 'Notify Me' : 'Book via WhatsApp'}
            </button>
          )}
        </div>
      </div>

      {variantPopup && (
        <VariantPickerPopup
          product={product}
          mode={variantPopup}
          onConfirm={handleVariantConfirm}
          onClose={() => setVariantPopup(null)}
        />
      )}
    </div>
  )
})
export default ProductCard
