'use client'
import { supabase } from '../../../lib/supabase'
import { extractId } from '../../../lib/slugify'
/* eslint-disable react-hooks/exhaustive-deps */
import Image from 'next/image'
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ProductReviews from '../../../components/ProductReviews'
import { Stars } from '../../../components/ProductReviews'
import { openWhatsApp } from '../../../lib/whatsapp'
import { trackView } from '../../../lib/recentlyViewed'
import { useCart } from '../../../context/CartContext'
import { useWishlist } from '../../../context/WishlistContext'
import { CountdownFull, LaunchCountdownFull } from '../../../components/CountdownTimer'
import ProductCard from '../../../components/ProductCard'
import { useSite } from '../../../context/SiteSettingsContext'
import VariantPickerPopup from '../../../components/VariantPickerPopup'
import { useImageFallback } from '../../../lib/useImageFallback'
import { useLiveSocialProof } from '../../../lib/socialProof'
import FreeGiftProgress from '../../../components/FreeGiftProgress'
import RecentlyViewedProducts from '../../../components/RecentlyViewedProducts'

// Small wrapper so the quota-aware fallback hook can be used per-thumbnail
// inside a .map() loop — hooks can't be called conditionally/in a loop
// directly, so each thumbnail gets its own tiny component instance instead.
function ThumbImage({ src, alt, style }) {
  const { src: imgSrc, unoptimized, handleError } = useImageFallback(src, { width: 80, quality: 75 })
  return (
    <Image src={imgSrc} alt={alt || ''} width={80} height={80}
      style={style} unoptimized={unoptimized} onError={handleError} />
  )
}

// ── Daraz-style rich details renderer (top-level — stable reference, no #422) ──
// Renders highlights text — every line gets a purple bullet point automatically.
function HighlightDetails({ text }) {
  if (!text) return null
  const lines = text.split('\n').map(l => l.trim().replace(/^[•\-\*]\s*/, '')).filter(Boolean)
  return (
    <div className="text-sm leading-relaxed" style={{ color: 'var(--viro-text)' }}>
      {lines.map((line, i) => (
        <div key={i} className="flex gap-2.5 mb-2">
          <span style={{
            marginTop: 6, flexShrink: 0,
            width: 7, height: 7, borderRadius: '50%',
            background: 'linear-gradient(135deg,#8B5CF6,#A855F7)',
            boxShadow: '0 1px 4px rgba(139,92,246,0.4)',
          }} />
          <span>{line}</span>
        </div>
      ))}
    </div>
  )
}

// Renders product_details text — lines with "Label: value" auto-bold the label.
// Also supports **bold** markdown syntax for manual bold.
function RichDetails({ text }) {
  if (!text) return null
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  function renderLine(line) {
    // Remove manual bullet prefix if present
    const clean = line.replace(/^[•\-\*]\s*/, '')

    // Auto-bold pattern: "Word(s): rest" — text before first colon becomes bold header
    const colonMatch = clean.match(/^([^:]{1,40}):\s*(.+)$/)
    if (colonMatch) {
      return (
        <span>
          <strong style={{ fontWeight: 700, color: 'var(--viro-text)' }}>{colonMatch[1]}:</strong>
          {' '}{colonMatch[2]}
        </span>
      )
    }
    // Fallback: render **bold** markdown
    const parts = clean.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((p, j) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={j} style={{ fontWeight: 700, color: 'var(--viro-text)' }}>{p.slice(2,-2)}</strong>
        : <span key={j}>{p}</span>
    )
  }

  return (
    <div className="text-sm leading-relaxed" style={{ color: 'var(--viro-text)' }}>
      {lines.map((line, i) => {
        const clean = line.replace(/^[•\-\*]\s*/, '')
        const colonMatch = clean.match(/^([^:]{1,40}):\s*(.+)$/)
        // Lines with "Label: value" pattern render as a subtle row with bold label
        if (colonMatch) {
          return (
            <div key={i} className="flex gap-1.5 mb-2" style={{ lineHeight: 1.5 }}>
              <strong style={{ fontWeight: 700, color: 'var(--viro-text)', flexShrink: 0 }}>{colonMatch[1]}:</strong>
              <span style={{ color: 'var(--viro-textSub)' }}>{colonMatch[2]}</span>
            </div>
          )
        }
        return <p key={i} className="mb-1.5">{renderLine(line)}</p>
      })}
    </div>
  )
}

const BLUR_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg=='

export default function ProductDetailClient({ initialProduct = null }) {
  const params = useParams()
  const id = extractId(params.id) // slug param may be "red-shoes-abc123"; extract real id
  const router = useRouter()
  const { contact, deliveryRules, ordersBadgeEnabled, rawSettings, minOrder, getFreeThreshold } = useSite()
  const { addToCart, cartTotal } = useCart()
  const { toggleWishlist, isInWishlist } = useWishlist()
  const [product, setProduct]     = useState(initialProduct)
  const [loading, setLoading]     = useState(!initialProduct)

  // ── Live stock sync ─────────────────────────────────────────────────────
  // Someone else buying the last unit while THIS customer already has the
  // product page open used to only surface as a rude surprise at checkout
  // (StockCheckPopup's final safety check). This keeps the open page itself
  // current: polls this product's stock/status regularly, and reactively
  // updates `product` state so every derived bit of UI — the "X left"
  // badge, the disabled Buy Now button, the Out of Stock banner — updates
  // on its own, since they're all computed from `product` already.
  //
  // This is polling, not true push (see note on the custom fetch-only
  // supabase client — no WebSocket/Realtime support by design, to keep
  // bundle size down), but paired with the visibility-triggered instant
  // check below, it's fast enough that it reads as live in practice: worst
  // case ~8s while actively browsing, and an immediate check the moment
  // someone tabs back in — exactly when a stale answer would matter most.
  useEffect(() => {
    if (!id || !supabase) return
    let cancelled = false
    async function refreshStock() {
      try {
        const [{ data }, variantRes] = await Promise.all([
          supabase.from('products').select('stock, status, is_active, stock_complete').eq('id', id).maybeSingle(),
          fetch(`/api/product-variants?id=${encodeURIComponent(id)}`).then(r => r.ok ? r.json() : null).catch(() => null),
        ])
        if (cancelled) return
        setProduct(prev => {
          if (!prev) return prev
          const next = data ? { ...prev, ...data } : prev
          // Variant stock (colors/sizes/colorSizeMatrix) lives behind its own
          // endpoint, not the products row — only merge it in if that fetch
          // actually succeeded, so a transient failure there doesn't wipe out
          // variant data that was already loaded correctly.
          if (variantRes) {
            const { colorSizeMatrix = {}, colors = [], sizes = [] } = variantRes
            return { ...next, colors, sizes, colorSizeMatrix }
          }
          return next
        })
      } catch { /* non-fatal — next poll or the checkout-time check catches it */ }
    }
    const interval = setInterval(() => { if (document.visibilityState === 'visible') refreshStock() }, 8000)
    function onVisible() { if (document.visibilityState === 'visible') refreshStock() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [id])
  const [mounted, setMounted]     = useState(false) // see hydration-safety note near the timer logic below
  useEffect(() => { setMounted(true) }, [])
  const [activeImg, setActiveImg] = useState(0)
  // Called unconditionally here (rules-of-hooks) — the live-ticking social
  // proof numbers (viewers drifting, sold count ticking up) computed once
  // per product/stock and self-updating on their own timers.
  const socialProof = useLiveSocialProof(product?.id, product?.stock ?? 0)
  // Description and "Product details of X" both default to collapsed —
  // cuts a lot of scroll length on the product page, especially on mobile,
  // so Frequently Bought Together and the reviews are reachable much sooner.
  const [descExpanded, setDescExpanded] = useState(false)
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const [swipeDx, setSwipeDx]    = useState(0)
  const touchStartX = React.useRef(null)
  const [zoomed, setZoomed]       = useState(false)
  const zoomRef                   = React.useRef(null)
  const [qty, setQty]             = useState(1)
  const [selectedColor, setSelectedColor] = useState(null)
  const [selectedSize,  setSelectedSize]  = useState(null)
  const [variantPopup, setVariantPopup]   = useState(null) // null | 'cart' | 'order'

  // ── Image zoom handlers ───────────────────────────────────────────────────
  // handleZoomClick: tap/click toggles 2.2× CSS zoom on mobile & desktop
  function handleZoomClick() {
    setZoomed(z => !z)
  }
  // handleZoomLeave: on desktop, un-zoom when mouse leaves the image
  function handleZoomLeave() {
    setZoomed(false)
  }
  const [added, setAdded]         = useState(false)
  // _reviewStats value unused — ProductReviews fetches its own data.
  // Declared so setReviewStats() calls in timer handlers don't throw ReferenceError.
  // eslint-disable-next-line no-unused-vars
  const [_reviewStats, setReviewStats] = useState(null)

  // Fix #8: abort guard prevents state updates on unmounted component
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let alive = true
    setLoading(true)
    const fetchProduct = async () => {
      if (!supabase) return
      try {
        // Fetch product + variants + live rating stats in parallel.
        const [{ data }, variantRes, ratingResult] = await Promise.all([
          supabase.from('products')
            .select('*, categories(id,name,icon,parent_id, parent:parent_id(id,name,icon))')
            .eq('id', id).single(),
          fetch(`/api/product-variants?id=${encodeURIComponent(id)}`).then(r => r.ok ? r.json() : { colors: [], sizes: [], colorSizeMatrix: {} }),
          // Try product_ratings view first (requires FIX_RATINGS_AND_ORDER_COUNT.sql to be run)
          supabase.from('product_ratings')
            .select('avg_rating,review_count')
            .eq('product_id', id)
            .maybeSingle()
            .then(res => res)
            .catch(() => ({ data: null, error: 'view_unavailable' })),
        ])
        if (!alive) return
        const { colorSizeMatrix = {}, colors: rawColors = [], sizes: rawSizes = [] } = variantRes
        const colors = rawColors.map(c => ({ ...c, uid: c.id }))
        const sizes  = rawSizes.map(s => ({ ...s, uid: s.id }))

        // Build live rating — fallback: query reviews table directly if view unavailable
        let liveRating = {}
        const ratingRow = ratingResult?.data
        if (ratingRow) {
          liveRating = { avg_rating: parseFloat(ratingRow.avg_rating) || 0, review_count: parseInt(ratingRow.review_count) || 0 }
        } else {
          // Fallback: count approved reviews directly (works even if product_ratings GRANT not run)
          try {
            const { data: fallbackReviews } = await supabase
              .from('reviews')
              .select('rating')
              .eq('product_id', id)
              .eq('status', 'approved')
            if (fallbackReviews && fallbackReviews.length > 0) {
              const avg = fallbackReviews.reduce((s, r) => s + Number(r.rating), 0) / fallbackReviews.length
              liveRating = { avg_rating: Math.round(avg * 100) / 100, review_count: fallbackReviews.length }
            }
          } catch (_) { /* ignore fallback error */ }
        }
        setProduct(prev => data ? { ...data, ...liveRating, colors, sizes, colorSizeMatrix } : prev)
        setLoading(false)
        if (data) trackView(data)  // track recently viewed
        if (data) import('../../../lib/metaEvents').then(m => m.trackViewContent(data, {})).catch(() => {})  // Meta CAPI
        if (data) {
          const hasActiveTimer = (
            (data.launch_at   && new Date(data.launch_at)   > new Date()) ||
            (data.sale_ends_at && new Date(data.sale_ends_at) > new Date()) ||
            (data.countdown_ends_at && new Date(data.countdown_ends_at) > new Date())
          )
          if (!hasActiveTimer && timer) { clearInterval(timer); timer = null }
        }
      } catch (_) { if (alive) setLoading(false) }
    }
    fetchProduct()
    let timer = setInterval(fetchProduct, 30000)
    return () => { alive = false; if (timer) clearInterval(timer) }
  }, [id])

  // Auto-select first available color/size when product data arrives
  useEffect(() => {
    if (!product) return
    const colors = Array.isArray(product.colors) ? product.colors : []
    const sizes  = Array.isArray(product.sizes)  ? product.sizes  : []
    if (colors.length > 0 && !selectedColor) setSelectedColor(colors[0])
    if (sizes.length > 0  && !selectedSize)  setSelectedSize(sizes[0])
  }, [product?.id]) /* eslint-disable-line react-hooks/exhaustive-deps */

  // v46: When launch_at expires, immediately call combined_timer_check() RPC so the DB
  // flips status→active right now (no waiting for the 1-min cron job).
  // Then refetch the product to reflect the new active status in the UI.
  const activatedDetailRef = React.useRef(false)
  const handleDetailLaunchExpire = useCallback(async () => {
    if (activatedDetailRef.current) return
    activatedDetailRef.current = true
    try {
      if (!supabase) return
      await supabase.rpc('combined_timer_check')
      await new Promise(r => setTimeout(r, 800))
      const { data } = await supabase
        .from('products')
        .select('*, categories(id,name,icon,parent_id, parent:parent_id(id,name,icon))')
        .eq('id', id).single()
      if (data) {
        setProduct(data)
        // Fetch approved review stats
        const { data: revs } = await supabase
          .from('reviews')
          .select('rating')
          .eq('product_id', id)
          .eq('status', 'approved')
        if (revs?.length) {
          const avg = revs.reduce((s,r) => s+r.rating, 0) / revs.length
          setReviewStats({ avg: avg.toFixed(1), total: revs.length })
        }
      }
    } catch (_) {
      // Silently fail — 30s poll will catch it
    }
  }, [id])

  // v46: when sale timer hits zero → call RPC + refetch so price reverts to original live
  const saleExpiredRef = React.useRef(false)
  const handleSaleExpire = useCallback(async () => {
    if (saleExpiredRef.current) return
    saleExpiredRef.current = true
    // v46 fix: immediately clear sale fields in local state so price reverts NOW
    // (don't wait for the DB round-trip — user sees original price instantly)
    setProduct(prev => prev ? {
      ...prev,
      sale_active:    false,
      discount_price: null,
      sale_ends_at:   null,   // ← critical: clear so future discounts aren't blocked
    } : prev)
    try {
      if (!supabase) return
      await supabase.rpc('combined_timer_check')
      await new Promise(r => setTimeout(r, 800))
      const { data } = await supabase
        .from('products')
        .select('*, categories(id,name,icon,parent_id, parent:parent_id(id,name,icon))')
        .eq('id', id).single()
      if (data) {
        setProduct(data)
        // Fetch approved review stats
        const { data: revs } = await supabase
          .from('reviews')
          .select('rating')
          .eq('product_id', id)
          .eq('status', 'approved')
        if (revs?.length) {
          const avg = revs.reduce((s,r) => s+r.rating, 0) / revs.length
          setReviewStats({ avg: avg.toFixed(1), total: revs.length })
        }
      }
    } catch (_) {}
  }, [id])

  // When selected color changes, jump to first image of that color in unified list
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!selectedColor) return
    const idx = allImageEntries.findIndex(e => e.colorUid === selectedColor.uid)
    if (idx >= 0) setActiveImg(idx)
    else setActiveImg(0)
  }, [selectedColor?.uid])

  // BUGFIX: qty was never re-clamped when the shopper switched colour/size
  // to a variant with LESS stock than the quantity already dialled in —
  // e.g. bump qty to 2 while "Maroon" (2 left) is selected, then switch to
  // "Cream" (1 left): qty silently stayed at 2. Combined with the + button
  // previously capping against the product's TOTAL stock instead of the
  // selected variant's (fixed separately below), this is exactly how a
  // customer could add 2 of a colour that only had 1 unit in stock.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!product) return
    const hasBothV = product.has_colors && product.has_sizes
    let stock
    if (hasBothV && selectedColor && selectedSize) {
      stock = product.colorSizeMatrix?.[`${selectedColor.uid}:${selectedSize.uid}`] ?? 0
    } else if (selectedColor) {
      stock = selectedColor.stock ?? 0
    } else if (selectedSize) {
      stock = selectedSize.stock ?? 0
    } else {
      stock = product.stock ?? 0
    }
    setQty(q => (stock > 0 ? Math.min(q, stock) : 1))
  }, [selectedColor?.uid, selectedSize?.uid, product?.id])

  const baseImages = React.useMemo(() => {
    if (!product) return []
    return Array.isArray(product.images) ? product.images
      : (typeof product.images === 'string' ? JSON.parse(product.images || '[]') : [])
  }, [product?.id, product?.images])

  // Build unified image gallery: all base images + all color-specific images
  // Each entry: { url, colorUid, colorLabel } so clicking a thumbnail selects that color
  const allImageEntries = React.useMemo(() => {
    if (!product) return [{ url: '/logo.jpg', colorUid: null, colorLabel: null }]
    const entries = baseImages.map(url => ({ url, colorUid: null, colorLabel: null }))
    const colorsList = Array.isArray(product.colors) ? product.colors : []
    for (const c of colorsList) {
      for (const url of (c.images || [])) {
        if (!entries.find(e => e.url === url)) {
          entries.push({ url, colorUid: c.uid, colorLabel: c.label })
        }
      }
    }
    return entries.length > 0 ? entries : [{ url: '/logo.jpg', colorUid: null, colorLabel: null }]
  }, [product?.id, product?.colors, baseImages])

  // ── Hook must be called here — BEFORE any early returns below ──
  // Rules of Hooks requires hooks to run in the same order on every render,
  // regardless of whether the component eventually returns early (loading,
  // not found, etc.). allImageEntries always has at least one entry (falls
  // back to '/logo.jpg'), so imgList[activeImg] is always a defined string
  // even in loading states — useImageFallback safely handles any input.
  const _imgListForHook = allImageEntries.map(e => e.url)
  const { src: mainImgSrc, unoptimized: mainImgUnoptimized, handleError: mainImgError } =
    useImageFallback(_imgListForHook[activeImg] || null, { width: 600, quality: 80 })

  if (loading) return (
    <div className="p-4 animate-pulse" style={{ background: 'var(--viro-sectionBg)', minHeight: '100vh' }}>
      <div className="skeleton rounded-xl mb-3" style={{ height: '60vw', maxHeight: 480 }} />
      <div className="skeleton h-6 w-3/4 mb-2 rounded" />
      <div className="skeleton h-4 w-1/2 rounded" />
    </div>
  )

  if (!product) return (
    <div className="text-center py-20 px-4" style={{ background: 'var(--viro-sectionBg)', minHeight: '100vh' }}>
      <div className="text-5xl mb-4">😕</div>
      <p className="font-bold" style={{ color: 'var(--viro-text)' }}>Product not found</p>
      <button onClick={() => router.push('/shop')} className="btn-primary mt-4 mx-auto px-6 py-3">← Back to Shop</button>
    </div>
  )

  if (product.is_active === false && product.status !== 'coming_soon') {
    router.push('/shop'); return null
  }

  // When selected color changes, jump to that color's first image
  const imgList = allImageEntries.map(e => e.url)
  const hasDiscount = product.discount_price && product.discount_price < product.price
  // v46 Timer priority logic:
  // launch_at  → Coming Soon timer (purple, PRIORITY). On end → product goes active.
  // sale_ends_at → Sale/deal timer (red). Hidden while coming_soon timer runs.
  // Discount PRICE is visible during coming_soon, but the sale COUNTDOWN is not.
  //
  // Hydration-safety note: `now` is gated behind `mounted` (declared near the
  // top of this component) for the same reason as ProductCard.jsx — computing
  // new Date() directly during render can differ between the server's render
  // moment and the client's hydration moment, and if a sale's end time falls
  // in that gap, server/client compute different booleans → React hydration
  // error #418. Gating behind `mounted` (false identically on both server and
  // the client's first paint) avoids that; the real time kicks in via a plain
  // client-side update right after hydration finishes, not during it.
  const now = mounted ? new Date() : null
  // isComingSoon = DB status only. Never flip it client-side from launch_at expiry.
  // When launch_at hits zero, keep showing "Coming Soon" until DB cron flips
  // status → 'active' and our poll (or scheduled refetch above) picks it up.
  const isComingSoon    = product.status === 'coming_soon'
  const isLaunching     = mounted && isComingSoon && !!product.launch_at && new Date(product.launch_at) > now
  const hasSaleTimer    = mounted && product.sale_active && product.sale_ends_at && new Date(product.sale_ends_at) > now
  const hasLegacyCountdown = mounted && !hasSaleTimer && product.countdown_ends_at && new Date(product.countdown_ends_at) > now

  // v46 fix: discount is effective ONLY when:
  //   a) sale_active=true AND sale_ends_at is in the future (timer running), OR
  //   b) discount_price is set AND there is NO sale_ends_at at all (permanent discount), OR
  //   c) product is coming_soon (discount reserved for launch)
  // If sale_ends_at exists but is in the past → discount is EXPIRED, show original price.
  // This fixes the bug where bulk-applying a new discount on a product with an old
  // expired sale_ends_at would still fail to show the discount.
  const saleEndedInPast = mounted && product.sale_ends_at && new Date(product.sale_ends_at) <= now
  const effectiveHasDiscount = hasDiscount && (
    mounted ? (
      hasSaleTimer ||                           // timer actively running
      (!product.sale_ends_at && !saleEndedInPast) || // permanent (no expiry set)
      isComingSoon                              // coming soon pre-launch discount
    ) : (!product.sale_ends_at || isComingSoon)  // pre-mount: only show for non-timed discounts
  )
  // const hasCountdown = hasSaleTimer || hasLegacyCountdown
  const displayPrice = effectiveHasDiscount ? product.discount_price : product.price
  // This product alone clears the free-delivery threshold — computed once
  // here so both the image badge and the price-area badge below share it.
  const freeDeliveryThreshold = getFreeThreshold('')
  const qualifiesFreeDelivery = freeDeliveryThreshold != null && (displayPrice || 0) >= freeDeliveryThreshold
  // Below the admin's minimum order amount for the currently selected quantity
  // — hide the direct "Buy Now" button so shoppers can only Add to Cart.
  const belowMinOrder = minOrder?.enabled && (displayPrice || 0) * qty < minOrder.amount
  const inStock     = product.stock > 0 && product.status !== 'out_of_stock' && !isComingSoon
  const isOutOfStock = !inStock && !isComingSoon
  const savings     = effectiveHasDiscount ? product.price - product.discount_price : 0
  const discountPct = effectiveHasDiscount ? Math.round((savings / product.price) * 100) : 0

  const autoHideOos = product.auto_hide_oos === true
  const allColors = Array.isArray(product.colors) ? product.colors : []
  const allSizes  = Array.isArray(product.sizes)  ? product.sizes  : []
  const hasBoth = product.has_colors && product.has_sizes

  // When auto_hide_oos: filter out zero-stock variants entirely
  const colors = autoHideOos
    ? allColors.filter(c => {
        if (!hasBoth) return (c.stock ?? 0) > 0
        return allSizes.some(s => (product.colorSizeMatrix?.[`${c.uid}:${s.uid}`] ?? 0) > 0)
      })
    : allColors
  const sizes = autoHideOos
    ? allSizes.filter(s => {
        if (!hasBoth) return (s.stock ?? 0) > 0
        return allColors.some(c => (product.colorSizeMatrix?.[`${c.uid}:${s.uid}`] ?? 0) > 0)
      })
    : allSizes

  const needsVariantPicker = product.has_colors || product.has_sizes

  // Stock helpers for inline picker
  function getInlineStock() {
    if (hasBoth && selectedColor && selectedSize) {
      return product.colorSizeMatrix?.[`${selectedColor.uid}:${selectedSize.uid}`] ?? 0
    }
    if (selectedColor) return selectedColor.stock ?? 0
    if (selectedSize)  return selectedSize.stock ?? 0
    return product.stock ?? 0
  }
  function colorStock(c) {
    if (!hasBoth) return c.stock ?? 0
    if (!selectedSize) return c.stock ?? 0
    return product.colorSizeMatrix?.[`${c.uid}:${selectedSize.uid}`] ?? 0
  }
  function sizeStock(s) {
    if (!hasBoth) return s.stock ?? 0
    if (!selectedColor) return s.stock ?? 0
    return product.colorSizeMatrix?.[`${selectedColor.uid}:${s.uid}`] ?? 0
  }
  function isLightHex(hex) {
    if (!hex) return false
    const h = hex.replace('#','')
    return (parseInt(h.slice(0,2),16)*299 + parseInt(h.slice(2,4),16)*587 + parseInt(h.slice(4,6),16)*114) / 1000 > 160
  }
  const inlineStock = getInlineStock()
  const inlineOutOfStock = inlineStock <= 0
  const inlineLowStock   = !inlineOutOfStock && inlineStock <= 5

  function buildEnrichedProduct(color, size) {
    const c = color || selectedColor
    const s = size  || selectedSize
    const variantImg = c?.images?.[0] || null
    return {
      ...product,
      selected_color_id:   c?.uid   || null,
      selected_size_id:    s?.uid   || null,
      selected_color:      c        || null,
      selected_size:       s        || null,
      selected_color_name: c?.label || null,
      selected_size_name:  s?.label || null,
      selected_image:      variantImg,
      quantity: qty,
    }
  }
  function handleAddToCart() {
    // If product has variants, always show popup to confirm before adding
    if (needsVariantPicker) { setVariantPopup('cart'); return }
    const p = buildEnrichedProduct()
    for (let i = 0; i < qty; i++) addToCart(p)
    import('../../../lib/metaEvents').then(m => m.trackAddToCart(p, qty, {})).catch(() => {})  // Meta CAPI
    setAdded(true); setTimeout(() => setAdded(false), 2000)
  }
  function handleOrderNow() {
    // If product has variants, always show popup to confirm before ordering
    if (needsVariantPicker) { setVariantPopup('order'); return }
    const p = buildEnrichedProduct()
    sessionStorage.setItem('viro_quick_order', JSON.stringify([p]))
    router.push('/checkout?quick=1&t=' + Date.now())
  }
  // onConfirm now receives an ARRAY of selections (multi-variant support)
  // Each selection: { colorId, sizeId, color, size, qty }
  function handleVariantConfirm(selections) {
    // Normalize — wrap single object in array for backward compat
    const list = Array.isArray(selections) ? selections : [selections]

    if (variantPopup === 'cart') {
      list.forEach(sel => {
        const p = buildEnrichedProduct(sel.color, sel.size)
        for (let i = 0; i < (sel.qty || 1); i++) addToCart(p)
      })
      setAdded(true); setTimeout(() => setAdded(false), 2000)
    } else {
      // Quick order: flatten all selections into an item array
      const items = list.flatMap(sel => {
        const p = buildEnrichedProduct(sel.color, sel.size)
        return Array.from({ length: sel.qty || 1 }, () => p)
      })
      sessionStorage.setItem('viro_quick_order', JSON.stringify(items))
      router.push('/checkout?quick=1&t=' + Date.now())
    }
    setVariantPopup(null)
  }

  // Non-looping — clamps at the first/last image instead of wrapping around,
  // so the prev/next arrows can show a real disabled state at the edges
  // (previously wrapped infinitely, meaning both arrows always "worked" and
  // neither ever looked inactive, even on the very first image).
  function prevImg() { setActiveImg(i => Math.max(0, i - 1)) }
  function nextImg() { setActiveImg(i => Math.min(imgList.length - 1, i + 1)) }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
    setSwipeDx(0)
  }
  function handleTouchMove(e) {
    if (touchStartX.current === null) return
    const dx = e.touches[0].clientX - touchStartX.current
    setSwipeDx(dx)
  }
  function handleTouchEnd() {
    if (touchStartX.current === null) return
    const dx = swipeDx
    if (dx < -40) nextImg()
    else if (dx > 40) prevImg()
    touchStartX.current = null
    setSwipeDx(0)
  }

  const waBookMsg  = `Hi Viro! I'd like to book in advance: ${product.name}. Please notify me when it's back in stock!`
  const waPreMsg   = `Hi Viro! I want to pre-register for: ${product.name}. Please notify me when it launches!`

  // ── Info panel — JSX variable (not a hook, not a component) ──
  const infoContent = (
    <div className="flex flex-col gap-2">

      {/* Name + stock badge */}
      <div className="flex items-start justify-between gap-2">
        <h1 className="font-display font-bold leading-tight flex-1"
          style={{ color: 'var(--viro-text)', fontSize: 'clamp(17px,2.5vw,24px)' }}>
          {product.name}
        </h1>
        <div className="px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 mt-0.5 whitespace-nowrap"
          style={isComingSoon
            ? { background:'#8B5CF620', color:'#A78BFA', border:'1px solid #8B5CF640' }
            : inStock
              ? { background:'#10B98115', color:'#10B981', border:'1px solid #10B98140' }
              : { background:'#EF444415', color:'#EF4444', border:'1px solid #EF444440' }}>
          {/* BUGFIX: was showing product.stock (the SUM across every colour/
              size combo) instead of the stock for the variant actually
              selected. On a 2-colour product with 1 unit of each, this
              badge said "2 left" even while the customer had one specific
              colour selected that only had 1 — letting them believe (and
              the qty stepper below actually allow) ordering more of that
              single colour than existed. Now uses the same variant-aware
              inlineStock everywhere, falling back to product.stock only
              when the product has no colour/size variants at all. */}
          {isComingSoon ? '🚀 Soon' : inStock ? `✓ ${needsVariantPicker ? inlineStock : product.stock} left` : '✗ Out of Stock'}
        </div>
      </div>

      {/* Social proof — small, believable numbers that tick up/down live
          every 15-30s (viewers) and 45-90s (sold count), instead of sitting
          frozen for the whole visit. Skipped for out-of-stock/coming-soon. */}
      {!isComingSoon && socialProof && (
        <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: -2 }}>
          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--viro-textSub)' }}>
            👀 <strong style={{ color: 'var(--viro-text)' }}>{socialProof.viewing}</strong> viewing now
          </span>
          {socialProof.sold > 0 && (
            <span className="text-xs flex items-center gap-1" style={{ color: '#F97316' }}>
              🔥 <strong>{socialProof.sold}</strong> sold in the last {socialProof.hoursAgo}h
            </span>
          )}
        </div>
      )}

      {/* Price */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="font-extrabold" style={{ color: '#7C3AED', fontSize: 'clamp(22px,3vw,30px)' }}>
          Rs. {displayPrice?.toLocaleString()}
        </span>
        {effectiveHasDiscount && (
          <div className="flex flex-col">
            <span className="line-through text-sm" style={{ color: 'var(--viro-textSub)' }}>
              Rs. {product.price?.toLocaleString()}
            </span>
            <span className="text-xs font-bold" style={{ color: '#10B981' }}>
              Save Rs. {savings?.toLocaleString()}
              {discountPct > 0 && <span style={{ color:'#F97316' }}> ({discountPct}% OFF)</span>}
            </span>
          </div>
        )}
      </div>

      {/* Free delivery attractor — this exact product alone clears the
          threshold, so the shopper doesn't have to do the math themselves */}
      {qualifiesFreeDelivery && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl w-fit mt-1"
          style={{
            background: 'linear-gradient(135deg,#10B981,#059669)',
            boxShadow: '0 3px 12px -2px rgba(16,185,129,0.5)',
          }}>
          <span style={{
            width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: '#fff', fontWeight: 900,
          }}>✓</span>
          <span className="text-xs font-bold" style={{ color: '#fff' }}>Qualifies for FREE Delivery</span>
        </div>
      )}

      {/* ── Avg rating + order count row ── */}
      {((product.review_count > 0) || (ordersBadgeEnabled && product.show_order_count && (product.stock_complete ?? 0) > 0)) && (
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          {product.review_count > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <Stars rating={Number(product.avg_rating || 0)} size={19} />
              <span style={{ fontSize:16, fontWeight:800, color:'#FBBF24' }}>{Number(product.avg_rating||0).toFixed(1)}</span>
              <span style={{ fontSize:11, color:'var(--viro-textSub)' }}>({product.review_count} reviews)</span>
            </div>
          )}
          {ordersBadgeEnabled && product.show_order_count && (product.stock_complete ?? 0) > 0 && (
            <div style={{
              display:'inline-flex', alignItems:'center', gap:4,
              padding:'3px 10px', borderRadius:20,
              background:'linear-gradient(135deg,#EF444415,#F9731615)',
              border:'1.5px solid #F9731640',
            }}>
              <span style={{ fontSize:12 }}>🔥</span>
              <span style={{ fontSize:11, fontWeight:800, color:'#F97316' }}>
                {product.stock_complete} ordered
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── v45 Timer Display Logic ──
          Priority rules:
          1. coming_soon + launch timer active → show ONLY launch countdown
             (customer sees discounted price but NOT the sale countdown)
          2. NOT coming_soon + sale timer active → show sale countdown
          3. Legacy countdown_ends_at fallback
      ── */}
      {isComingSoon && isLaunching && (
        <LaunchCountdownFull endAt={product.launch_at} label="🚀 Launching In" onExpire={handleDetailLaunchExpire} />
      )}
      {/* v45: sale countdown only visible AFTER coming_soon timer expires */}
      {!isComingSoon && !isLaunching && hasSaleTimer && (
        <CountdownFull endAt={product.sale_ends_at} label={product.countdown_label || 'Deal Ends In'} onExpire={handleSaleExpire} />
      )}
      {/* Legacy compat — old countdown_ends_at field */}
      {!isComingSoon && !isLaunching && !hasSaleTimer && hasLegacyCountdown && (
        <CountdownFull endAt={product.countdown_ends_at} label={product.countdown_label || 'Deal Ends In'} onExpire={handleSaleExpire} />
      )}

      {/* ── Inline Daraz-style Color & Size Picker ── */}
      {needsVariantPicker && (
        <div style={{ padding:'2px 0', display:'flex', flexDirection:'column', gap:10 }}>

          {/* COLOUR SECTION */}
          {product.has_colors && colors.length > 0 && (
            <div>
              <p style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'var(--viro-textSub)' }}>
                Colour:&nbsp;<span style={{ color:'#7C3AED', fontWeight:800 }}>{selectedColor?.label || '—'}</span>
              </p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {colors.map(c => {
                  const cOut   = colorStock(c) <= 0
                  const active = selectedColor?.uid === c.uid
                  const thumb  = c.images?.[0] || null
                  const showHex = !thumb && c.hex
                  return (
                    <button key={c.uid} type="button"
                      onClick={() => { if (!cOut) { setSelectedColor(c); setActiveImg(0) } }}
                      title={c.label + (cOut ? ' — Out of Stock' : '')}
                      style={{
                        position:'relative', flexShrink:0,
                        cursor: cOut ? 'not-allowed' : 'pointer',
                        borderRadius: thumb ? 12 : 999,
                        overflow: thumb ? 'hidden' : 'visible',
                        border: active ? '3px solid #7C3AED' : '2px solid var(--viro-border)',
                        boxShadow: active ? '0 0 0 3px #7C3AED35' : 'none',
                        opacity: cOut ? 0.45 : 1,
                        transition:'all 0.18s',
                        width: thumb ? 44 : 'auto',
                        height: thumb ? 44 : 'auto',
                        padding: thumb ? 0 : '7px 14px',
                        background: showHex ? c.hex : (thumb ? '#F8FAFC' : 'var(--viro-bgCard)'),
                        display:'flex', alignItems:'center', gap: showHex ? 6 : 0,
                      }}>
                      {/* Hex dot only (no image) */}
                      {showHex && (
                        <>
                          <span style={{ width:14, height:14, borderRadius:7, background:c.hex,
                            border:'1.5px solid rgba(0,0,0,0.15)', flexShrink:0 }} />
                          <span style={{ fontSize:12, fontWeight:700,
                            color: isLightHex(c.hex) ? '#1A1A1A' : 'var(--viro-text)' }}>
                            {c.label}
                          </span>
                        </>
                      )}
                      {/* No hex, no image → text label */}
                      {!showHex && !thumb && (
                        <span style={{ fontSize:12, fontWeight:700, color:'var(--viro-text)' }}>{c.label}</span>
                      )}
                      {/* Image thumbnail */}
                      {thumb && (
                        <img src={thumb} alt={c.label}
                          style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      )}
                      {/* Out of stock overlay */}
                      {cOut && (
                        <div style={{ position:'absolute', inset:0, display:'flex',
                          alignItems:'center', justifyContent:'center',
                          background:'rgba(255,255,255,0.55)', borderRadius: thumb ? 10 : 999 }}>
                          <span style={{ fontSize:13, color:'#EF4444', fontWeight:900 }}>✕</span>
                        </div>
                      )}
                      {/* Active checkmark */}
                      {active && !cOut && (
                        <div style={{ position:'absolute', top:2, right:2, width:14, height:14,
                          borderRadius:7, background:'#7C3AED',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:8, color:'#fff', fontWeight:900 }}>✓</div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* SIZE SECTION */}
          {product.has_sizes && sizes.length > 0 && (
            <div>
              <p style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'var(--viro-textSub)' }}>
                Size:&nbsp;<span style={{ color:'#7C3AED', fontWeight:800 }}>{selectedSize?.label || '—'}</span>
              </p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {sizes.map(s => {
                  const sOut   = sizeStock(s) <= 0
                  const active = selectedSize?.uid === s.uid
                  return (
                    <button key={s.uid} type="button"
                      onClick={() => !sOut && setSelectedSize(s)}
                      style={{
                        padding:'8px 18px', borderRadius:999,
                        cursor: sOut ? 'not-allowed' : 'pointer',
                        border: active ? '2.5px solid #7C3AED' : '1.5px solid var(--viro-border)',
                        background: active ? '#7C3AED' : sOut ? 'var(--viro-bgDeep)' : 'var(--viro-bgCard)',
                        color: active ? '#fff' : sOut ? 'var(--viro-textSub)' : 'var(--viro-text)',
                        fontWeight:700, fontSize:13,
                        opacity: sOut ? 0.55 : 1,
                        boxShadow: active ? '0 2px 10px #7C3AED40' : 'none',
                        transition:'all 0.15s',
                        textDecoration: sOut ? 'line-through' : 'none',
                      }}>
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Stock status for selected combination */}
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:4,
              padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700,
              background: inlineOutOfStock ? '#FEE2E2' : inlineLowStock ? '#FEF3C7' : '#DCFCE7',
              color:      inlineOutOfStock ? '#DC2626' : inlineLowStock ? '#D97706' : '#16A34A',
            }}>
              {inlineOutOfStock
                ? '⛔ Out of Stock for this variant'
                : inlineLowStock
                  ? `⚠️ Only ${inlineStock} left`
                  : `✅ ${inlineStock} in stock`}
            </div>
          </div>
        </div>
      )}

      {/* In Stock: qty + CTAs */}
      {inStock && (
        <>
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: 'var(--viro-textMuted)' }}>Qty:</span>
            <div className="flex items-center gap-2 rounded-xl px-2 py-1"
              style={{ background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)' }}>
              <button onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-6 h-6 rounded-lg font-bold flex items-center justify-center"
                style={{ color: 'var(--viro-text)' }}>−</button>
              <span className="w-6 text-center font-bold" style={{ color: 'var(--viro-text)' }}>{qty}</span>
              {/* BUGFIX: capped against product.stock (the total across all
                  colours/sizes) instead of the selected variant's own stock
                  — this is exactly what let a shopper with "Cream" (1 left)
                  selected tap + up to 2, because Cream+Maroon combined = 2.
                  Now capped to the same variant-aware number shown above. */}
              <button onClick={() => setQty(q => Math.min(needsVariantPicker ? inlineStock : product.stock, q + 1))}
                className="w-6 h-6 rounded-lg font-bold flex items-center justify-center"
                style={{ color: 'var(--viro-text)' }}>+</button>
            </div>
            {inStock && (needsVariantPicker ? inlineStock : product.stock) <= 5 && (
              <span className="text-xs font-semibold" style={{ color: '#F97316' }}>⚠️ Only {needsVariantPicker ? inlineStock : product.stock} left!</span>
            )}
          </div>

          {/* Buy Now + Add to Cart — hidden on mobile (sticky bar handles it) */}
          <div className="hidden md:flex" style={{ gap:10 }}>
            <button onClick={handleAddToCart}
              style={belowMinOrder ? {
                flex:1, padding:'13px 0', borderRadius:14, fontWeight:900, fontSize:14,
                border:'none',
                background: added ? 'linear-gradient(135deg,#10B981,#059669)' : 'linear-gradient(135deg,#7C3AED,#A855F7)',
                color:'#fff',
                cursor:'pointer', transition:'all 0.18s',
                display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                boxShadow: added ? '0 4px 14px rgba(16,185,129,0.35)' : '0 4px 14px rgba(124,58,237,0.35)',
              } : {
                flex:1, padding:'12px 0', borderRadius:14, fontWeight:800, fontSize:14,
                border: added ? '2px solid #10B98160' : '2px solid var(--viro-border)',
                background: added ? '#10B98115' : 'var(--viro-bgCard)',
                color: added ? '#10B981' : 'var(--viro-text)',
                cursor:'pointer', transition:'all 0.18s',
                display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              }}
              onMouseDown={e=>e.currentTarget.style.transform='scale(0.97)'}
              onMouseUp={e=>e.currentTarget.style.transform=''}
              onTouchStart={e=>e.currentTarget.style.transform='scale(0.97)'}
              onTouchEnd={e=>e.currentTarget.style.transform=''}>
              {added ? '✓ Added!' : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/></svg> Add to Cart</>}
            </button>
            {!belowMinOrder && (
            <button onClick={handleOrderNow}
              style={{
                flex:1.3, padding:'12px 0', borderRadius:14, fontWeight:900, fontSize:14,
                background:'linear-gradient(135deg,#7C3AED,#A855F7)',
                color:'#fff', border:'none', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                boxShadow:'0 4px 14px rgba(124,58,237,0.35)',
                transition:'all 0.18s',
              }}
              onMouseDown={e=>e.currentTarget.style.transform='scale(0.97)'}
              onMouseUp={e=>e.currentTarget.style.transform=''}
              onTouchStart={e=>e.currentTarget.style.transform='scale(0.97)'}
              onTouchEnd={e=>e.currentTarget.style.transform=''}>
              ⚡ Buy Now — Rs.{((displayPrice || 0) * qty).toLocaleString()}
            </button>
            )}
          </div>
          {belowMinOrder && (
            <p className="hidden md:block text-xs text-center -mt-1" style={{ color:'var(--viro-textSub)' }}>
              🛒 Add Rs.{Math.ceil(minOrder.amount - (displayPrice||0)*qty).toLocaleString()} more to your cart to unlock Buy Now (min. order Rs.{minOrder.amount})
            </p>
          )}
          {!belowMinOrder && (
            <p className="hidden md:block text-xs text-center -mt-1" style={{ color:'var(--viro-textSub)' }}>
              🧺 "Add to Cart" saves it in your basket to buy later · "Buy Now" takes you straight to checkout
            </p>
          )}

          {/* Wishlist + Share — hidden on mobile (sticky bar handles it) */}
          <div className="hidden md:flex" style={{ gap:8 }}>
            <button
              onClick={() => { if (!isInWishlist(product?.id)) import('../../../lib/metaEvents').then(m => m.trackAddToWishlist(product)).catch(() => {}); toggleWishlist(product) }}
              style={{
                flex:1, padding:'9px 0', borderRadius:12, fontWeight:700, fontSize:12,
                border: isInWishlist(product.id) ? '1.5px solid #FECDD3' : '1.5px solid var(--viro-border)',
                background: isInWishlist(product.id) ? '#FFF1F2' : 'var(--viro-bgCard)',
                color: isInWishlist(product.id) ? '#F43F5E' : 'var(--viro-textSub)',
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                transition:'all 0.18s',
              }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill={isInWishlist(product.id)?'#F43F5E':'none'} stroke={isInWishlist(product.id)?'#F43F5E':'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
              {isInWishlist(product.id) ? 'Saved' : 'Wishlist'}
            </button>
            <button
              id="share-btn-main"
              onClick={() => {
                const shareUrl = `https://viro.pk/p/${product.id}`
                const isMob = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
                if (isMob && navigator.share) {
                  navigator.share({ title: product.name, url: shareUrl }).catch(() => { window.open(`https://wa.me/?text=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener') })
                } else if (isMob) {
                  window.open(`https://wa.me/?text=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener')
                } else {
                  navigator.clipboard?.writeText(shareUrl).then(() => {
                    const btn = document.getElementById('share-btn-main')
                    if (btn) { btn.textContent = '✅ Copied!'; setTimeout(() => { btn.textContent = '🔗 Share' }, 2000) }
                    if (window.confirm('Link copied! Open in WhatsApp desktop app?')) { const a = document.createElement('a'); a.href = `whatsapp://send?text=${encodeURIComponent(shareUrl)}`; a.click() }
                  }).catch(() => { window.open(`https://wa.me/?text=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener') })
                }
              }}
              style={{
                flex:1, padding:'9px 0', borderRadius:12, fontWeight:700, fontSize:12,
                border:'1.5px solid var(--viro-border)', background:'var(--viro-bgCard)',
                color:'var(--viro-textSub)', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                transition:'all 0.18s',
              }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              Share
            </button>
          </div>

          <FreeGiftProgress />
        </>
      )}

      {/* Out of Stock */}
      {isOutOfStock && (
        <div className="rounded-2xl p-4 text-center"
          style={{ background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)' }}>
          <p className="text-base font-bold mb-1" style={{ color: 'var(--viro-text)' }}>😔 Currently Out of Stock</p>
          <p className="text-sm mb-3" style={{ color: 'var(--viro-textMuted)' }}>
            Book in advance via WhatsApp — we'll notify you when it's back!
          </p>
          <button type="button" onClick={() => { openWhatsApp(waBookMsg, contact.whatsapp); import('../../../lib/metaEvents').then(m => m.trackContact('whatsapp_order')).catch(() => {}) }}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-base font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)' }}>
            💬 Book in Advance via WhatsApp
          </button>
        </div>
      )}
      {/* Wishlist — always visible on out-of-stock and coming-soon too */}
      {(isOutOfStock || isComingSoon) && (
        <button
          onClick={() => toggleWishlist(product)}
          className="w-full py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
          style={isInWishlist(product.id)
            ? { background:'#FFF1F2', color:'#F43F5E', border:'1.5px solid #FECDD3' }
            : { background:'transparent', color:'var(--viro-textSub)', border:'1.5px solid var(--viro-border)' }}>
          {isInWishlist(product.id) ? (<><svg width="14" height="14" viewBox="0 0 24 24" fill="#F43F5E" stroke="#F43F5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:6}}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>Saved to Wishlist</>) : (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:6}}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>Save to Wishlist</>)}
        </button>
      )}

      {/* Coming Soon */}
      {isComingSoon && (
        <div className="rounded-2xl p-4 text-center"
          style={{ background: '#8B5CF610', border: '1px solid #8B5CF640' }}>
          <p className="text-2xl mb-1">🚀</p>
          <p className="text-base font-bold mb-1" style={{ color: '#A78BFA' }}>Coming Soon!</p>
          <p className="text-sm mb-3" style={{ color: 'var(--viro-textMuted)' }}>
            Launching soon — pre-register to be first!
          </p>
          <button type="button" onClick={() => openWhatsApp(waPreMsg, contact.whatsapp)}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-base font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)' }}>
            💬 Pre-Register via WhatsApp
          </button>
        </div>
      )}

      {/* Free delivery progress bar — replaces the old plain "Free ≥ Rs.X ·
          Otherwise Rs.Y" text strip with a Rawayat-style fill bar showing
          how close the current cart is to unlocking free delivery. Delivery
          rule data (threshold/charge) is the same DB-driven `deliveryRules`
          used everywhere else — only the presentation changed. */}
      {(() => {
        const rules  = deliveryRules || []
        const local  = rules.find(r => r.cities && !r.cities.includes('*'))
        const other  = rules.find(r => r.cities && r.cities.includes('*'))
        const threshold = other?.freeThreshold ?? 2500
        const unlocked   = cartTotal >= threshold
        const pct        = threshold > 0 ? Math.min(100, Math.round((cartTotal / threshold) * 100)) : 0
        const remaining  = Math.max(0, threshold - cartTotal)
        return (
          <div className={`rounded-xl p-3.5 ${unlocked ? '' : 'pd-delivery-glow'}`} style={unlocked ? {
            background: 'linear-gradient(135deg,#10B98122,#05966916)',
            border: '1px solid #10B98158',
            boxShadow: '0 4px 14px -4px #10B98150',
          } : {
            background: 'linear-gradient(135deg,#F9731638,#FB923C26)',
            border: '1.5px solid #F9731665',
            boxShadow: '0 4px 14px -4px #F9731650',
          }}>
            <div className="flex items-center gap-2 mb-2">
              <span style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: unlocked ? 'linear-gradient(135deg,#10B981,#059669)' : 'linear-gradient(135deg,#F97316,#EA580C)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: '#fff', fontWeight: 700,
                boxShadow: unlocked ? '0 2px 6px -1px #10B98170' : '0 2px 6px -1px #F9731670',
              }}>{unlocked ? '✓' : '🚚'}</span>
              {/* Text stays the normal dark/light theme colour regardless of
                  state — only the card itself (background/border/glow) carries
                  the colour, so the message stays easy to read either way. */}
              <p className="text-xs font-bold flex-1" style={{ color: 'var(--viro-text)' }}>
                {unlocked ? 'Free delivery unlocked!' : `Add Rs.${remaining.toLocaleString()} more for FREE delivery`}
              </p>
            </div>
            <div style={{ height: 7, borderRadius: 999, background: unlocked ? '#10B98130' : 'rgba(255,255,255,0.45)', overflow: 'hidden' }}>
              {/* No artificial minimum width here — an empty cart should
                  honestly show an empty bar, not a fake sliver of "progress"
                  that was never actually made. */}
              {(unlocked || pct > 0) && (
                <div className={unlocked ? '' : 'pd-delivery-fill'} style={{
                  height: '100%', width: `${unlocked ? 100 : pct}%`, borderRadius: 999, position: 'relative', overflow: 'hidden',
                  background: unlocked ? 'linear-gradient(90deg,#10B981,#059669)' : 'linear-gradient(90deg,#FB923C,#F97316,#EA580C)',
                  transition: 'width 0.3s ease',
                }} />
              )}
            </div>
            {local && (
              <p className="text-[10px] mt-1.5" style={{ color: unlocked ? '#10B981AA' : 'var(--viro-textSub)' }}>
                Free {local.label} ≥ Rs.{local.freeThreshold?.toLocaleString()} · {other?.label ?? 'Other cities'} ≥ Rs.{threshold.toLocaleString()}
              </p>
            )}
          </div>
        )
      })()}

      {/* Frequently Bought Together — moved up here (was much further down
          the page as "Complete the Set") so it's visible without having to
          scroll past Description/Product Details first. Renders nothing if
          this product has no pairs_with_ids configured in admin. Site
          Settings → Feature Toggles can still turn this off site-wide. */}
      {rawSettings?.feature_toggles?.complete_the_set !== false && (
        <CompleteTheSet pairIds={product.pairs_with_ids} currentProduct={product} />
      )}

      {/* Description — collapsed by default (2-line preview + toggle) to
          keep the page short; full text is one tap away. */}
      {product.description && (
        <div className="rounded-2xl p-4"
          style={{ background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)' }}>
          <button onClick={() => setDescExpanded(v => !v)}
            className="w-full flex items-center justify-between"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--viro-textSub)' }}>
              Description
            </h3>
            <span style={{ color: 'var(--viro-textSub)', fontSize: 12, transition: 'transform 0.2s', transform: descExpanded ? 'rotate(180deg)' : 'none' }}>▾</span>
          </button>
          <p className="text-sm leading-relaxed whitespace-pre-line mt-2" style={{
            color: 'var(--viro-textMuted)',
            ...(descExpanded ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }),
          }}>
            {product.description}
          </p>
          {product.description.length > 100 && (
            <button onClick={() => setDescExpanded(v => !v)}
              className="text-xs font-bold mt-1" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7C3AED', padding: 0 }}>
              {descExpanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      )}
    </div>
  )

  return (
    <>
    <div style={{ background: 'var(--viro-sectionBg)', minHeight: '100vh', paddingBottom: 'calc(env(safe-area-inset-bottom) + 140px)' }}>
      <style>{`
        .pd-thumb { transition: all 0.18s; cursor: pointer; }
        .pd-thumb:hover { opacity: 0.85; transform: scale(1.03); }
        .pd-arrow { transition: background 0.15s, transform 0.15s; }
        .pd-arrow:hover { transform: scale(1.1); }
        .pd-arrow:active { transform: scale(0.94); }
        .pd-atc-pulse { animation: pdAtcPulse 2.2s ease-in-out infinite; }
        @keyframes pdAtcPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.35); }
          50%      { box-shadow: 0 0 0 6px rgba(124,58,237,0); }
        }
        .pd-delivery-fill::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
          transform: translateX(-100%);
          animation: pdDeliveryShimmer 2.4s ease-in-out infinite;
        }
        @keyframes pdDeliveryShimmer {
          0%, 15%  { transform: translateX(-100%); }
          85%, 100% { transform: translateX(220%); }
        }
        .pd-delivery-glow { animation: pdDeliveryGlow 2.6s ease-in-out infinite; }
        @keyframes pdDeliveryGlow {
          0%, 100% { box-shadow: 0 4px 14px -4px #F9731650, 0 0 0 0 #F9731645; }
          50%      { box-shadow: 0 4px 14px -4px #F9731650, 0 0 0 5px #F9731600; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pd-delivery-fill::after, .pd-delivery-glow { animation: none; }
        }
        .viro-sticky-bar {
          position: fixed !important;
          bottom: 58px !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 9999 !important;
          background: var(--viro-bgCard) !important;
          border-top: 1.5px solid var(--viro-border);
          border-radius: 14px 14px 0 0;
          padding: 6px 12px 8px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
        }
        @media (min-width: 768px) {
          .viro-sticky-bar { display: none !important; }
        }
      `}</style>

      {/* Breadcrumb: Home > Category > Sub > Product */}
      <div className="flex items-center gap-1.5 px-4 pt-3 pb-1 overflow-x-auto mb-3"
        style={{ background: 'var(--viro-bgCard)', borderBottom: '1px solid var(--viro-border)' }}>
        <style>{`.bc-sep{color:var(--viro-textSub);font-size:11px;flex-shrink:0}.bc-link{font-size:12px;font-weight:600;white-space:nowrap;flex-shrink:0;color:var(--viro-textSub)}.bc-link:hover{color:var(--viro-text)}.bc-cur{font-size:12px;font-weight:700;white-space:nowrap;color:var(--viro-text);overflow:hidden;text-overflow:ellipsis}`}</style>
        <Link href="/" className="bc-link">Home</Link>
        <span className="bc-sep">›</span>
        <Link href="/shop" className="bc-link">Shop</Link>
        {product.categories?.parent && (
          <>
            <span className="bc-sep">›</span>
            <Link href={`/shop?cat=${product.categories.parent.id}`} className="bc-link">
              {product.categories.parent.icon} {product.categories.parent.name}
            </Link>
          </>
        )}
        {product.categories && (
          <>
            <span className="bc-sep">›</span>
            <Link href={product.categories.parent
              ? `/shop?cat=${product.categories.parent.id}&sub=${product.categories.id}`
              : `/shop?cat=${product.categories.id}`} className="bc-link">
              {product.categories.icon} {product.categories.name}
            </Link>
          </>
        )}
        <span className="bc-sep">›</span>
        <span className="bc-cur">{product.name}</span>
      </div>

      {/* ════════════════════════════════════════════
          MOBILE layout: image full-width top, info below
          DESKTOP layout: thumbnails left | image center | info right
      ════════════════════════════════════════════ */}

      {/* ── DESKTOP (md+): 3-column layout ── */}
      <div className="hidden md:flex gap-4 px-4 items-start">

        {/* Col 1: Thumbnail strip — vertical, shifted down, larger */}
        {imgList.length > 1 && (
          <div className="flex flex-col gap-2.5 flex-shrink-0 mt-10" style={{ width: 96 }}>
            {imgList.map((img, i) => (
              <div key={i} onClick={() => {
                  setActiveImg(i)
                  // If this image belongs to a color variant, select that color
                  if (product.has_colors && allImageEntries[i]?.colorUid) {
                    const matchingColor = (Array.isArray(product.colors) ? product.colors : [])
                      .find(c => c.uid === allImageEntries[i].colorUid)
                    if (matchingColor) setSelectedColor(matchingColor)
                  }
                }}
                className="pd-thumb rounded-xl overflow-hidden border-2"
                style={{ width: 90, height: 90, flexShrink: 0, position: 'relative',
                  borderColor: i === activeImg ? '#8B5CF6' : 'var(--viro-border)',
                  background: 'var(--viro-productWhite)',
                  boxShadow: i === activeImg ? '0 0 0 3px #8B5CF650' : 'none',
                  transition: 'all 0.18s' }}>
                <ThumbImage src={img} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                {allImageEntries[i]?.colorLabel && (
                  <div style={{ position:'absolute', bottom:0, left:0, right:0,
                    background:'rgba(0,0,0,0.55)', color:'#fff',
                    fontSize:8, fontWeight:700, textAlign:'center', padding:'2px 2px',
                    lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {allImageEntries[i].colorLabel}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Col 2: Main image — tap/click to zoom (2.2×) */}
        <div className="flex-shrink-0 relative rounded-2xl overflow-hidden"
          style={{ width: 'clamp(300px, 45vw, 560px)', background: 'var(--viro-productWhite)' }}>
          <div
            ref={zoomRef}
            className={`viro-zoom-wrap${zoomed ? ' zoomed' : ''}`}
            onClick={handleZoomClick}
            onMouseLeave={handleZoomLeave}
            title={zoomed ? 'Click to zoom out' : 'Click to zoom in'}
          >
            <Image src={mainImgSrc} alt={product.name}
              width={600} height={600}
              priority={activeImg === 0}
              key={activeImg}
              className={`viro-zoom-img fade-in${zoomed ? ' zoomed' : ''}`}
              style={{ objectFit: 'contain' }}
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
              quality={80}
              sizes="(max-width: 768px) 100vw, 45vw"
              unoptimized={mainImgUnoptimized}
              onError={mainImgError}
            />
          </div>

          {hasDiscount && (
            <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#F97316)', fontSize: '11px' }}>
              -{discountPct}%
            </div>
          )}

          {qualifiesFreeDelivery && (
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md font-bold text-white flex items-center gap-1"
              style={{ background: 'linear-gradient(135deg,#10B981,#059669)', fontSize: '11px', boxShadow:'0 2px 8px rgba(16,185,129,0.4)' }}>
              🚚 Free Delivery
            </div>
          )}

          {imgList.length > 1 && (
            <>
              <button onClick={prevImg} disabled={activeImg === 0}
                className="pd-arrow absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-white text-xl font-bold z-10"
                style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
                  opacity: activeImg === 0 ? 0.35 : 1, cursor: activeImg === 0 ? 'default' : 'pointer',
                  transition: 'opacity 0.15s' }}>‹</button>
              <button onClick={nextImg} disabled={activeImg === imgList.length - 1}
                className="pd-arrow absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-white text-xl font-bold z-10"
                style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
                  opacity: activeImg === imgList.length - 1 ? 0.35 : 1, cursor: activeImg === imgList.length - 1 ? 'default' : 'pointer',
                  transition: 'opacity 0.15s' }}>›</button>
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
                {imgList.map((_, i) => (
                  <span key={i} className="rounded-full transition-all"
                    style={{ width: i === activeImg ? 16 : 6, height: 6,
                      background: i === activeImg ? '#8B5CF6' : 'rgba(139,92,246,0.3)' }} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Col 3: Info + buttons */}
        <div className="flex-1 min-w-0">
          {infoContent}
        </div>
      </div>

      {/* ── MOBILE: stacked layout ── */}
      <div className="md:hidden">

        {/* Full-width swipeable image gallery */}
        <div className="relative overflow-hidden w-full"
          style={{ background: 'var(--viro-productWhite)' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className={`viro-zoom-wrap${zoomed ? ' zoomed' : ''}`}
            onClick={handleZoomClick}
            onMouseLeave={handleZoomLeave}
            style={{
              transform: swipeDx !== 0 && !zoomed ? `translateX(${Math.max(-60,Math.min(60,swipeDx * 0.3))}px)` : undefined,
              transition: swipeDx === 0 ? 'transform 0.25s ease' : 'none',
            }}
          >
            <Image src={mainImgSrc} alt={product.name}
              width={600} height={600}
              key={activeImg}
              className={`viro-zoom-img fade-in${zoomed ? ' zoomed' : ''}`}
              style={{ maxHeight: '85vw', objectFit: 'cover', objectPosition: 'center' }}
              unoptimized={mainImgUnoptimized}
              onError={mainImgError}
            />
          </div>

          {hasDiscount && (
            <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#F97316)', fontSize: '10px' }}>
              -{discountPct}%
            </div>
          )}

          {qualifiesFreeDelivery && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md font-bold text-white flex items-center gap-1"
              style={{ background: 'linear-gradient(135deg,#10B981,#059669)', fontSize: '10px', boxShadow:'0 2px 8px rgba(16,185,129,0.4)' }}>
              🚚 Free Delivery
            </div>
          )}

          {imgList.length > 1 && (
            <>
              <button onClick={prevImg} disabled={activeImg === 0}
                className="pd-arrow absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-white text-xl font-bold z-10"
                style={{ background: 'rgba(0,0,0,0.38)', backdropFilter: 'blur(3px)',
                  opacity: activeImg === 0 ? 0.35 : 1, cursor: activeImg === 0 ? 'default' : 'pointer',
                  transition: 'opacity 0.15s' }}>‹</button>
              <button onClick={nextImg} disabled={activeImg === imgList.length - 1}
                className="pd-arrow absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-white text-xl font-bold z-10"
                style={{ background: 'rgba(0,0,0,0.38)', backdropFilter: 'blur(3px)',
                  opacity: activeImg === imgList.length - 1 ? 0.35 : 1, cursor: activeImg === imgList.length - 1 ? 'default' : 'pointer',
                  transition: 'opacity 0.15s' }}>›</button>
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
                {imgList.map((_, i) => (
                  <span key={i} className="rounded-full transition-all"
                    style={{ width: i === activeImg ? 16 : 6, height: 6,
                      background: i === activeImg ? '#8B5CF6' : 'rgba(139,92,246,0.3)' }} />
                ))}
              </div>
            </>
          )}

          {/* Wishlist button — bottom left of mobile image */}
          <button
            onClick={() => toggleWishlist(product)}
            style={{
              position:'absolute', bottom:10, left:10,
              width:34, height:34, borderRadius:'50%',
              background: isInWishlist(product.id) ? 'rgba(244,63,94,0.15)' : 'rgba(0,0,0,0.35)',
              border: isInWishlist(product.id) ? '1.5px solid #F43F5E' : '1.5px solid rgba(255,255,255,0.3)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:16, backdropFilter:'blur(6px)',
              boxShadow:'0 2px 8px rgba(0,0,0,0.15)',
              cursor:'pointer', zIndex:10,
              transition:'transform 0.15s',
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24"
              fill={isInWishlist(product.id) ? '#F43F5E' : 'none'}
              stroke={isInWishlist(product.id) ? '#F43F5E' : 'white'}
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          </button>

          {/* Share button — bottom right of mobile image */}
          <button
            onClick={() => {
              // Always use /p/[id] — the social preview URL with correct OG tags
              const url = `https://viro.pk/p/${product.id}`
              const isMob2 = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
              if (isMob2 && navigator.share) {
                navigator.share({ title: product.name, url }).catch(() => {
                  window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank', 'noopener')
                })
              } else {
                navigator.clipboard?.writeText(url)
                  .then(() => alert('Link copied!'))
                  .catch(() => window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank'))
              }
            }}
            style={{
              position:'absolute', bottom:10, right:10,
              width:34, height:34, borderRadius:'50%',
              background:'rgba(255,255,255,0.88)',
              border:'1.5px solid rgba(226,232,240,0.8)',
              display:'flex', alignItems:'center', justifyContent:'center',
              backdropFilter:'blur(6px)',
              boxShadow:'0 2px 8px rgba(0,0,0,0.15)',
              cursor:'pointer', zIndex:10,
              transition:'transform 0.15s',
            }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
        </div>

        {/* Horizontal thumbnail strip — mobile */}
        {imgList.length > 1 && (
          <div className="flex gap-1.5 px-3 pt-2 pb-1 overflow-x-auto scrollbar-hide">
            {imgList.map((img, i) => (
              <div key={i} onClick={() => {
                  setActiveImg(i)
                  // If this image belongs to a color variant, select that color
                  if (product.has_colors && allImageEntries[i]?.colorUid) {
                    const matchingColor = (Array.isArray(product.colors) ? product.colors : [])
                      .find(c => c.uid === allImageEntries[i].colorUid)
                    if (matchingColor) setSelectedColor(matchingColor)
                  }
                }}
                className="pd-thumb flex-shrink-0 rounded-xl overflow-hidden border-2"
                style={{ width: 52, height: 52, position: 'relative',
                  borderColor: i === activeImg ? '#8B5CF6' : 'var(--viro-border)',
                  background: 'var(--viro-productWhite)' }}>
                <ThumbImage src={img} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                {allImageEntries[i]?.colorLabel && (
                  <div style={{ position:'absolute', bottom:0, left:0, right:0,
                    background:'rgba(0,0,0,0.55)', color:'#fff',
                    fontSize:7, fontWeight:700, textAlign:'center', padding:'1px 2px',
                    lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {allImageEntries[i].colorLabel}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Info below image */}
        <div className="px-4 pt-3">
          {infoContent}
        </div>
      </div>

      {/* ── Product Details (Daraz-style) — collapsed by default to keep
          the page short; tap to expand full spec list ── */}
      {(product.product_details || product.highlights) && (
        <div className="px-4 mt-4">
          <div className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid var(--viro-border)', background: 'var(--viro-bgCard)' }}>
            <button onClick={() => setDetailsExpanded(v => !v)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5"
              style={{ borderBottom: detailsExpanded ? '1px solid var(--viro-border)' : 'none', background: 'var(--viro-sectionBg)', border: 'none', cursor: 'pointer' }}>
              <h2 className="font-bold text-base flex items-center gap-2" style={{ color: 'var(--viro-text)' }}>
                <span style={{ fontSize: 17 }}>📋</span> Product Details
              </h2>
              <span style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px -1px #8B5CF670',
                transition: 'transform 0.25s ease',
                transform: detailsExpanded ? 'rotate(180deg)' : 'none',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>
            {detailsExpanded && (
              <div className="px-4 py-4">
                {product.highlights && (
                  <div className="mb-4 pb-4" style={{ borderBottom: product.product_details ? '1px solid var(--viro-border)' : 'none' }}>
                    <HighlightDetails text={product.highlights} />
                  </div>
                )}
                {product.product_details && (
                  <div>
                    <RichDetails text={product.product_details} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Customer Reviews — before recommendations ── */}
      {product.reviews_enabled !== false && (
        <div className="px-4 md:px-8 pb-2 mt-4 max-w-5xl mx-auto">
          <ProductReviews
            productId={product.id}
            productReviewsEnabled={product.reviews_enabled !== false}
          />
        </div>
      )}

      {/* TestimonialsCarousel intentionally NOT rendered here anymore —
          ProductReviews' "More Viro.pk Customers" section above now
          carries its own "Let customers speak for us" header and shows
          the same storewide social proof (photo + written reviews from
          every other product), so this was duplicating that content
          directly underneath it. Still rendered on Home and Shop. */}

      {/* ── Recommended For You ── */}
      <RecommendedProducts
        categoryId={product.category_id}
        parentCategoryId={product.categories?.parent_id || product.categories?.parent?.id || null}
        currentId={product.id}
        currentKeywords={product.search_keywords}
      />

      {/* ── Recently Viewed Products ── */}
      <RecentlyViewedProducts excludeId={product.id} />

      {/* ── Variant confirmation popup — fires when user clicks Order/Add to Cart ── */}
      {variantPopup && (
        <VariantPickerPopup
          product={product}
          mode={variantPopup}
          onConfirm={handleVariantConfirm}
          onClose={() => setVariantPopup(null)}
        />
      )}


    </div>

    {/* ── Sticky bottom action bar — OUTSIDE wrapper so fixed positioning works ── */}
    <div className="viro-sticky-bar" style={{ display: variantPopup ? 'none' : undefined }}>
        {/* Row 1: Price + wishlist + share icons */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
              <span style={{ fontSize:17, fontWeight:900, color: displayPrice < (product.price||0) ? '#7C3AED' : 'var(--viro-text)', letterSpacing:'-0.3px' }}>
                Rs.{((displayPrice||0)*qty).toLocaleString()}
              </span>
              {displayPrice < (product.price||0) && (
                <span style={{ fontSize:12, color:'var(--viro-textSub)', textDecoration:'line-through' }}>
                  Rs.{((product.price||0)*qty).toLocaleString()}
                </span>
              )}
            </div>
            {(selectedColor?.label || selectedSize?.label) && (
              <div style={{ display:'flex', gap:4, marginTop:2 }}>
                {selectedColor?.label && (
                  <span style={{ fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:20, background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)', color:'var(--viro-textSub)', display:'flex', alignItems:'center', gap:3 }}>
                    {selectedColor.hex && <span style={{ width:7, height:7, borderRadius:'50%', background:selectedColor.hex, flexShrink:0 }}/>}
                    {selectedColor.label}
                  </span>
                )}
                {selectedSize?.label && (
                  <span style={{ fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:20, background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)', color:'var(--viro-textSub)' }}>
                    {selectedSize.label}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => { if (!isInWishlist(product?.id)) import('../../../lib/metaEvents').then(m => m.trackAddToWishlist(product)).catch(() => {}); toggleWishlist(product) }}
            style={{ width:34, height:34, borderRadius:10, border:'1.5px solid var(--viro-border)', background: isInWishlist(product.id) ? '#FFF1F2' : 'var(--viro-bgDeep)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={isInWishlist(product.id)?'#F43F5E':'none'} stroke={isInWishlist(product.id)?'#F43F5E':'var(--viro-textSub)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
          </button>
          <button
            onClick={() => {
              const shareUrl = `https://viro.pk/p/${product.id}`
              const isMob = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
              if (isMob && navigator.share) { navigator.share({ title: product.name, url: shareUrl }).catch(() => {}) }
              else { navigator.clipboard?.writeText(shareUrl).then(() => alert('Link copied!')).catch(() => {}) }
            }}
            style={{ width:34, height:34, borderRadius:10, border:'1.5px solid var(--viro-border)', background:'var(--viro-bgDeep)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--viro-textSub)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
        </div>
        {inStock ? (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={handleAddToCart} className={added ? '' : 'pd-atc-pulse'}
                style={belowMinOrder ? { flex:1, height:44, borderRadius:12, fontWeight:900, fontSize:14, border:'none', background: added ? '#10B981' : 'linear-gradient(135deg,#7C3AED,#A855F7)', color:'#fff', cursor:'pointer', transition:'all 0.18s', display:'flex', alignItems:'center', justifyContent:'center', gap:6, boxShadow: added ? '0 3px 12px rgba(16,185,129,0.4)' : '0 3px 12px rgba(124,58,237,0.4)' }
                  : { flex:1, height:40, borderRadius:12, fontWeight:800, fontSize:13, border: added ? '1.5px solid #10B98160' : '1.5px solid #7C3AED50', background: added ? '#10B98115' : 'var(--viro-bgDeep)', color: added ? '#10B981' : 'var(--viro-text)', cursor:'pointer', transition:'all 0.18s', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}
                onTouchStart={e=>e.currentTarget.style.transform='scale(0.97)'} onTouchEnd={e=>e.currentTarget.style.transform=''}>
                {added ? '✓ Added!' : belowMinOrder
                  ? <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/></svg> Add to Cart</>
                  : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/></svg> Cart</>}
              </button>
              {!belowMinOrder && (
              <button onClick={handleOrderNow}
                style={{ flex:1.6, height:40, borderRadius:12, fontWeight:900, fontSize:14, background:'linear-gradient(135deg,#7C3AED,#A855F7)', color:'#fff', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5, boxShadow:'0 3px 12px rgba(124,58,237,0.4)', transition:'all 0.18s' }}
                onTouchStart={e=>e.currentTarget.style.transform='scale(0.97)'} onTouchEnd={e=>e.currentTarget.style.transform=''}>
                ⚡ Buy Now — Rs.{((displayPrice||0)*qty).toLocaleString()}
              </button>
              )}
            </div>
            {belowMinOrder && (
              <p style={{ margin:0, fontSize:10.5, textAlign:'center', color:'var(--viro-textSub)', fontWeight:600 }}>
                🛒 Add Rs.{Math.ceil(minOrder.amount - (displayPrice||0)*qty).toLocaleString()} more to unlock Buy Now (min. order Rs.{minOrder.amount})
              </p>
            )}
          </div>
        ) : (
          <div style={{ textAlign:'center', padding:'8px 0', fontSize:13, fontWeight:800, color:'#EF4444' }}>⛔ Out of Stock</div>
        )}
    </div>
    </>
  )
}

// ── Recommended Products — vertical infinite-scroll grid ──────
const REC_PAGE = 6   // products per page

function RecommendedProducts({ categoryId, parentCategoryId, currentId, currentKeywords }) {
  const [products,  setProducts]  = useState([])
  const [tier,       setTier]      = useState(1)   // 1 = same category, 2 = sibling categories, 3 = everything else
  const [tierPage,   setTierPage]  = useState(0)
  const [hasMore,    setHasMore]   = useState(true)
  const [loading,    setLoading]   = useState(false)
  const [siblingIds, setSiblingIds] = useState(null) // null = not fetched yet, [] = no siblings
  const shownIdsRef  = useRef(new Set())
  const sentinelRef  = useRef(null)
  const retryCountRef = useRef(0)

  // Bigger batch for tier 1 specifically, so a category's keyword-tagged
  // products are very likely all captured in the first load or two — the
  // sorting below (not a DB-side filter) is what actually prioritizes them.
  const TIER1_PAGE = 30

  // Current product's own keyword list, lowercased, in rank order (first = highest priority)
  const myKeywords = (currentKeywords || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean)

  // Rank-aware affinity: a shared keyword matters more when it's a HIGH-rank
  // keyword on both sides — not just "any" shared keyword. If the viewed
  // product's #1 keyword is "earring" and another product also has "earring"
  // as ITS #1 keyword, that's a much stronger match than a product that only
  // has "earring" buried as its 4th, lowest-priority tag.
  function keywordAffinity(p) {
    if (!myKeywords.length || !p.search_keywords) return 0
    const theirs = p.search_keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
    let score = 0
    myKeywords.forEach((k, myIdx) => {
      const theirIdx = theirs.indexOf(k)
      if (theirIdx === -1) return
      const myWeight    = Math.max(50 - myIdx * 10, 10)
      const theirWeight = Math.max(50 - theirIdx * 10, 10)
      score += myWeight + theirWeight
    })
    return score
  }

  // Fetch sibling category ids once (other subcategories under the same parent) —
  // this is tier 2's scope, e.g. viewing a Ring → siblings are Earrings, Necklaces...
  useEffect(() => {
    if (!parentCategoryId) { setSiblingIds([]); return }
    let cancelled = false
    supabase.from('categories').select('id').eq('parent_id', parentCategoryId).neq('id', categoryId)
      .then(({ data }) => { if (!cancelled) setSiblingIds((data || []).map(c => c.id)) })
    return () => { cancelled = true }
  }, [parentCategoryId, categoryId])

  const appendResults = useCallback((data) => {
    if (!data?.length) return
    setProducts(prev => {
      const fresh = data.filter(p => !shownIdsRef.current.has(p.id))
      fresh.forEach(p => shownIdsRef.current.add(p.id))
      const merged = [...prev, ...fresh]
      if (!myKeywords.length) return merged
      // Keyword-matching products bubble up within whatever's loaded so far,
      // but tiers themselves never reorder — tier 1 items always precede tier 2, etc.
      return merged
        .map((p, i) => ({ p, i, score: keywordAffinity(p) }))
        .sort((a, b) => b.score - a.score || a.i - b.i)
        .map(x => x.p)
    })
  }, [myKeywords]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load one page for whichever tier is currently active. Deliberately kept
  // as simple as possible — a single .or() call at most, no dynamically-built
  // ilike keyword filters. Keyword prioritization happens entirely client-side
  // in appendResults() above, using whatever's already loaded. A previous
  // version tried to push the keyword match into the DB query itself, which
  // produced a request Supabase's edge network consistently rejected before
  // attaching CORS headers — same pattern every other working query in this
  // app avoids, so removed rather than patched further.
  const loadTierPage = useCallback(async (activeTier, pageNum) => {
    if (activeTier === 2 && siblingIds === null) return // wait for sibling fetch
    if (activeTier === 2 && siblingIds.length === 0) { setTier(3); setTierPage(0); return }

    setLoading(true)
    const pageSize = activeTier === 1 ? TIER1_PAGE : REC_PAGE
    const from = pageNum * pageSize
    const to   = from + pageSize - 1

    let query = supabase.from('products')
      .select('*, categories(id,name,icon)')
      .or('is_active.eq.true,status.eq.coming_soon')
      .neq('id', currentId)

    if (activeTier === 1) {
      query = query.eq('category_id', categoryId)
    } else if (activeTier === 2) {
      query = query.in('category_id', siblingIds)
    } else {
      // Tier 3 — everything else: exclude current category + siblings so it's a genuine "rest of the store" mix
      const excludeIds = [categoryId, ...(siblingIds || [])].filter(Boolean)
      if (excludeIds.length) query = query.not('category_id', 'in', `(${excludeIds.join(',')})`)
    }
    // .order('id') as a secondary/tiebreaker sort — without it, rows with an
    // identical created_at (e.g. products added in the same bulk batch) can
    // come back in a different order on every call, since Postgres doesn't
    // guarantee tie order on its own.
    query = activeTier === 3
      ? query.order('avg_rating', { ascending: false }).order('id', { ascending: true })
      : query.order('created_at', { ascending: false }).order('id', { ascending: true })

    let data, error
    try {
      const result = await query.range(from, to)
      data = result.data; error = result.error
    } catch (e) {
      error = e
    }
    setLoading(false)
    if (error) {
      console.warn('[rec]', error.message)
      const retries = retryCountRef.current
      if (retries < 3) {
        retryCountRef.current = retries + 1
        setTimeout(() => loadTierPage(activeTier, pageNum), 700 * (retries + 1))
      } else {
        retryCountRef.current = 0
        setHasMore(false)
      }
      return
    }
    retryCountRef.current = 0
    appendResults(data)
    if ((data?.length || 0) < pageSize) {
      if (activeTier < 3) { setTier(activeTier + 1); setTierPage(0) }
      else setHasMore(false)
    }
  }, [categoryId, siblingIds, currentId, appendResults]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset everything when the viewed product changes
  useEffect(() => {
    setProducts([]); shownIdsRef.current = new Set()
    setTier(1); setTierPage(0); setHasMore(true)
  }, [categoryId, currentId])

  // Fire the load whenever tier/page changes (or sibling ids finally arrive)
  useEffect(() => {
    if (!categoryId || !hasMore) return
    loadTierPage(tier, tierPage)
  }, [tier, tierPage, siblingIds]) // eslint-disable-line react-hooks/exhaustive-deps

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        setTierPage(p => p + 1)
      }
    }, { rootMargin: '200px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, loading])

  if (!products.length && !loading) return null

  return (
    <div style={{ paddingBottom:24, maxWidth:1024, margin:'0 auto' }}>
      {/* Header */}
      <div style={{ padding:'20px 16px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h3 style={{ fontWeight:800, fontSize:16, color:'var(--viro-text)', margin:'0 0 2px' }}>
            ✨ You May Also Like
          </h3>
          <p style={{ fontSize:12, color:'var(--viro-textSub)', margin:0 }}>More from this category</p>
        </div>
        <Link href="/shop" prefetch={false}
          style={{ fontSize:12, fontWeight:700, padding:'6px 12px', borderRadius:10, flexShrink:0,
            background:'#8B5CF620', color:'#A78BFA', border:'1px solid #8B5CF640', textDecoration:'none' }}>
          View all →
        </Link>
      </div>

      {/* Responsive grid: 2 col mobile → 3 col md → 4 col lg → 5 col xl */}
      <div className="rec-grid" style={{ padding:'0 12px' }}>
        <style>{`
          .rec-grid {
            display: grid;
            gap: 10px;
            grid-template-columns: repeat(2, 1fr);
          }
          @media (min-width: 640px)  { .rec-grid { grid-template-columns: repeat(3, 1fr); } }
          @media (min-width: 1024px) { .rec-grid { grid-template-columns: repeat(4, 1fr); } }
          @media (min-width: 1280px) { .rec-grid { grid-template-columns: repeat(5, 1fr); } }
        `}</style>
        {products.map(p => <ProductCard key={p.id} product={p} compact />)}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} style={{ height:40, display:'flex', alignItems:'center', justifyContent:'center' }}>
        {loading && (
          <svg style={{ animation:'spin 0.8s linear infinite' }} width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="3" opacity="0.25"/>
            <path fill="#8B5CF6" d="M4 12a8 8 0 018-8v8z" opacity="0.75"/>
          </svg>
        )}
        {!hasMore && products.length > 0 && (
          <p style={{ fontSize:11, color:'var(--viro-textSub)' }}>All products shown</p>
        )}
      </div>
    </div>
  )
}

// ── Complete the Set — admin-picked complementary products, with a
// one-tap "Add Both to Cart" so upgrading the order takes zero extra effort ──
// Renamed from "Complete the Set" — same data source (product.pairs_with_ids,
// already fully built in the admin product editor via PairsWithPicker, no
// new admin work needed), but redesigned to match the combined-checkbox,
// single-total pattern (current product + suggested items, each toggleable,
// one running total, one Add-to-Cart / Buy Now for everything checked) —
// rather than the old one-row-per-pair "Add Both" buttons.
function CompleteTheSet({ pairIds, currentProduct }) {
  const router = useRouter()
  const { addToCart } = useCart()
  const [pairs, setPairs] = useState([])
  const [checked, setChecked] = useState({}) // { [productId]: boolean } — pairs only; current product is always included
  const [variantData, setVariantData] = useState({}) // { [productId]: { sizes, colors, colorSizeMatrix } }
  const [selections, setSelections] = useState({})   // { [productId]: { colorId, sizeId } }
  const [added, setAdded] = useState(false)

  useEffect(() => {
    if (!pairIds?.length) return
    let cancelled = false
    supabase.from('products')
      .select('id,name,images,price,discount_price,sale_active,sale_ends_at,stock,has_sizes,has_colors')
      .in('id', pairIds)
      .eq('is_active', true)
      .then(async ({ data }) => {
        if (cancelled) return
        // Keep admin's chosen display order (pairIds), not whatever order the DB returns
        const byId = Object.fromEntries((data || []).map(p => [p.id, p]))
        const rows = pairIds.map(id => byId[id]).filter(Boolean)
        setPairs(rows)
        setChecked(Object.fromEntries(rows.map(p => [p.id, true]))) // all pre-checked, like Rawayat

        // Fetch variant tables only for pairs that actually have variants
        const withVariants = rows.filter(p => p.has_sizes || p.has_colors)
        if (withVariants.length === 0) return
        const ids = withVariants.map(p => p.id)
        const [sizesRes, colorsRes, matrixRes] = await Promise.all([
          supabase.from('product_sizes').select('*').in('product_id', ids).order('sort_order'),
          supabase.from('product_colors').select('*').in('product_id', ids).order('sort_order'),
          supabase.from('product_color_size_stock').select('color_id,size_id,stock').in('product_id', ids),
        ])
        if (cancelled) return
        const vd = {}
        const initSel = {}
        for (const p of withVariants) {
          const sizes  = (sizesRes.data  || []).filter(s => s.product_id === p.id)
          const colors = (colorsRes.data || []).filter(c => c.product_id === p.id)
          const matrix = {}
          for (const row of (matrixRes.data || [])) matrix[`${row.color_id}:${row.size_id}`] = row.stock
          vd[p.id] = { sizes, colors, matrix }
          // Default-select the first option of each axis, same behaviour as the main PDP —
          // means a linked item is addable immediately without forcing an extra tap first.
          initSel[p.id] = { colorId: colors[0]?.id || null, sizeId: sizes[0]?.id || null }
        }
        setVariantData(vd)
        setSelections(prev => ({ ...initSel, ...prev }))
      })
    return () => { cancelled = true }
  }, [pairIds])

  if (!pairs.length) return null

  function priceOf(p) {
    const saleOk = p.discount_price && p.discount_price < p.price && p.sale_active &&
      (!p.sale_ends_at || new Date(p.sale_ends_at) > new Date())
    return saleOk ? p.discount_price : p.price
  }

  // Effective stock for a pair item given its currently-selected size/colour —
  // mirrors the main PDP's getInlineStock so "Free Delivery"/"Buy Now" never
  // add something the matrix actually shows as 0.
  function stockOf(p) {
    const vd = variantData[p.id]
    if (!vd) return p.stock ?? 999
    const sel = selections[p.id] || {}
    const { sizes, colors, matrix } = vd
    if (sizes.length && colors.length) {
      if (!sel.colorId || !sel.sizeId) return 0
      return matrix[`${sel.colorId}:${sel.sizeId}`] ?? 0
    }
    if (colors.length) return colors.find(c => c.id === sel.colorId)?.stock ?? 0
    if (sizes.length)  return sizes.find(s => s.id === sel.sizeId)?.stock ?? 0
    return p.stock ?? 999
  }

  const selectedPairs = pairs.filter(p => checked[p.id] && stockOf(p) > 0)
  const allItems = [currentProduct, ...selectedPairs]
  const combinedTotal = allItems.reduce((sum, p) => sum + priceOf(p), 0)
  const combinedOriginal = allItems.reduce((sum, p) => sum + (p.price || 0), 0)
  const savings = combinedOriginal - combinedTotal

  function toggle(id) {
    if (stockOf(pairs.find(p => p.id === id)) <= 0) return // out-of-stock rows aren't toggleable
    setChecked(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function setVariant(productId, axis, value) {
    setSelections(prev => ({ ...prev, [productId]: { ...prev[productId], [axis]: value } }))
  }

  // Builds the exact same shape CartContext/order_items expect (selected_color,
  // selected_size, etc.) so a linked item with variants behaves identically
  // in the cart/checkout to one added from its own PDP.
  function enrichedPair(p) {
    const vd = variantData[p.id]
    if (!vd) return p
    const sel = selections[p.id] || {}
    const c = vd.colors.find(x => x.id === sel.colorId) || null
    const s = vd.sizes.find(x => x.id === sel.sizeId) || null
    return {
      ...p,
      selected_color_id:   c?.id    || null,
      selected_size_id:    s?.id    || null,
      selected_color:      c ? { ...c, uid: c.id } : null,
      selected_size:       s ? { ...s, uid: s.id } : null,
      selected_color_name: c?.label || null,
      selected_size_name:  s?.label || null,
    }
  }

  function handleAddSelected() {
    addToCart(currentProduct, 1)
    selectedPairs.forEach(p => addToCart(enrichedPair(p), 1))
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  function handleBuySelected() {
    const items = allItems.map(raw => {
      const p = raw.id === currentProduct.id ? raw : enrichedPair(raw)
      return {
        id: p.id, name: p.name, images: p.images,
        price: p.price, discount_price: p.discount_price,
        sale_active: p.sale_active, sale_ends_at: p.sale_ends_at,
        stock: p.stock ?? 999, quantity: 1,
        selected_color: p.selected_color || null, selected_size: p.selected_size || null,
        selected_color_id: p.selected_color_id || null, selected_size_id: p.selected_size_id || null,
      }
    })
    try { sessionStorage.setItem('viro_quick_order', JSON.stringify(items)) } catch {}
    router.push('/checkout?quick=1&t=' + Date.now())
  }

  function thumbOf(p) {
    try {
      const imgs = typeof p.images === 'string' ? JSON.parse(p.images) : p.images
      return (Array.isArray(imgs) ? imgs[0] : imgs) || '/logo.jpg'
    } catch { return '/logo.jpg' }
  }

  return (
    <div className="rounded-2xl p-4 md:p-6 mb-2 md:mb-3" style={{
      background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(249,115,22,0.06))',
      border: '1px solid var(--viro-border)',
    }}>
      <p className="font-extrabold text-sm md:text-base mb-3 md:mb-4" style={{ color: 'var(--viro-text)' }}>
        🛍️ Frequently Bought Together
      </p>

      {/* Thumbnail row with "+" connectors — visual "this + that" framing */}
      <div className="flex items-center gap-2 md:gap-3 mb-3.5 md:mb-5 overflow-x-auto">
        {allItems.map((p, i) => (
          <React.Fragment key={p.id}>
            {i > 0 && <span className="text-base md:text-xl flex-shrink-0" style={{ color: 'var(--viro-textSub)' }}>+</span>}
            <img src={thumbOf(p)} alt="" className="w-14 h-14 md:w-20 md:h-20 rounded-xl object-cover flex-shrink-0"
              style={{ border: '2px solid var(--viro-bgCard)', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }} />
          </React.Fragment>
        ))}
      </div>

      {/* Checklist — current product always included (locked), pairs toggleable.
          Each pair with size/colour options gets its own compact dropdown(s),
          same pattern as Rawayat's per-item variant picker. */}
      <div className="flex flex-col gap-2.5 md:gap-3.5 mb-3 md:mb-4">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-[18px] h-[18px] md:w-5 md:h-5 rounded-[5px] flex-shrink-0 flex items-center justify-center text-[11px] md:text-xs"
            style={{ background: '#8B5CF6', color: '#fff' }}>✓</div>
          <span className="text-xs md:text-sm font-bold flex-1 whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: 'var(--viro-text)' }}>
            {currentProduct.name} <span className="font-normal" style={{ color: 'var(--viro-textSub)' }}>(this item)</span>
          </span>
          <span className="text-xs md:text-sm font-bold flex-shrink-0" style={{ color: '#7C3AED' }}>
            Rs.{Math.round(priceOf(currentProduct)).toLocaleString()}
          </span>
        </div>
        {pairs.map(p => {
          const vd = variantData[p.id]
          const sel = selections[p.id] || {}
          const oos = stockOf(p) <= 0
          const eff = priceOf(p)
          const hasDiscount = eff < p.price
          const pct = hasDiscount ? Math.round((1 - eff / p.price) * 100) : 0
          return (
            <div key={p.id} className="rounded-lg md:hover:bg-black/[0.02] md:-mx-2 md:px-2 md:py-1 transition-colors" style={{ opacity: oos ? 0.5 : 1 }}>
              <div onClick={() => !oos && toggle(p.id)} className="flex items-center gap-2 md:gap-3" style={{ cursor: oos ? 'not-allowed' : 'pointer' }}>
                <div className="w-[18px] h-[18px] md:w-5 md:h-5 rounded-[5px] flex-shrink-0 flex items-center justify-center text-[11px] md:text-xs"
                  style={{
                    border: checked[p.id] ? 'none' : '1.5px solid var(--viro-border)',
                    background: checked[p.id] && !oos ? '#8B5CF6' : 'transparent', color: '#fff',
                  }}>{checked[p.id] && !oos ? '✓' : ''}</div>
                <span className="text-xs md:text-sm font-semibold flex-1 whitespace-nowrap overflow-hidden text-ellipsis"
                  style={{ color: checked[p.id] && !oos ? 'var(--viro-text)' : 'var(--viro-textSub)' }}>
                  {p.name}{oos && <span className="font-bold" style={{ color: '#F87171' }}> · Out of stock</span>}
                </span>
                <span className="text-xs md:text-sm font-bold flex-shrink-0 text-right" style={{ color: checked[p.id] && !oos ? '#7C3AED' : 'var(--viro-textSub)' }}>
                  {hasDiscount && (
                    <span className="font-medium text-[10.5px] md:text-xs mr-1" style={{ textDecoration: 'line-through', color: 'var(--viro-textSub)' }}>
                      Rs.{Math.round(p.price).toLocaleString()}
                    </span>
                  )}
                  Rs.{Math.round(eff).toLocaleString()}
                  {hasDiscount && <span className="text-[10px] md:text-xs font-extrabold ml-1" style={{ color: '#EF4444' }}>-{pct}%</span>}
                </span>
              </div>
              {vd && (vd.sizes.length > 0 || vd.colors.length > 0) && (
                <div className="flex gap-1.5 md:gap-2 ml-[26px] md:ml-8 mt-1.5">
                  {vd.colors.length > 0 && (
                    <select value={sel.colorId || ''} onChange={e => setVariant(p.id, 'colorId', e.target.value)}
                      className="text-[11px] md:text-xs py-1 px-1.5 md:px-2 rounded-lg max-w-[120px] md:max-w-[150px]"
                      style={{ border: '1px solid var(--viro-border)', background: 'var(--viro-bgCard)', color: 'var(--viro-text)' }}>
                      {vd.colors.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  )}
                  {vd.sizes.length > 0 && (
                    <select value={sel.sizeId || ''} onChange={e => setVariant(p.id, 'sizeId', e.target.value)}
                      className="text-[11px] md:text-xs py-1 px-1.5 md:px-2 rounded-lg max-w-[120px] md:max-w-[150px]"
                      style={{ border: '1px solid var(--viro-border)', background: 'var(--viro-bgCard)', color: 'var(--viro-text)' }}>
                      {vd.sizes.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Combined total + savings */}
      <div className="flex items-baseline justify-between rounded-xl px-3 py-2.5 md:px-4 md:py-3.5 mb-2.5 md:mb-3"
        style={{ background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)' }}>
        <span className="text-xs md:text-sm font-semibold" style={{ color: 'var(--viro-textSub)' }}>
          Total for {allItems.length} item{allItems.length === 1 ? '' : 's'}
        </span>
        <div className="text-right">
          <span className="text-[17px] md:text-2xl font-black" style={{ color: '#7C3AED' }}>
            Rs.{Math.round(combinedTotal).toLocaleString()}
          </span>
          {savings > 0 && (
            <span className="text-[11px] md:text-sm font-bold ml-1.5 md:ml-2" style={{ color: '#10B981' }}>
              Save Rs.{Math.round(savings).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 md:gap-3">
        <button onClick={handleAddSelected}
          className="flex-1 py-2.5 md:py-3.5 rounded-xl cursor-pointer text-xs md:text-sm font-bold transition-colors md:hover:brightness-95"
          style={{
            border: added ? '1.5px solid #10B98160' : '1.5px solid #8B5CF650',
            background: added ? '#10B98115' : 'var(--viro-bgCard)',
            color: added ? '#10B981' : 'var(--viro-text)',
          }}>
          {added ? '✓ Added!' : '🛒 Add Selected'}
        </button>
        <button onClick={handleBuySelected}
          className="flex-[1.3] py-2.5 md:py-3.5 rounded-xl border-none cursor-pointer text-xs md:text-sm font-extrabold text-white transition-transform md:hover:scale-[1.015]"
          style={{
            background: 'linear-gradient(135deg,#8B5CF6,#F97316)',
            boxShadow: '0 3px 10px rgba(139,92,246,0.3)',
          }}>
          ⚡ Buy Now — Rs.{Math.round(combinedTotal).toLocaleString()}
        </button>
      </div>
    </div>
  )
}
