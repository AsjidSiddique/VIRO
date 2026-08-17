'use client'
import { slugify } from '../../lib/slugify'
import { supabase } from '../../lib/supabase'
import { cacheGet, cacheSet } from '../../lib/pageCache'
/* eslint-disable react-hooks/exhaustive-deps, no-unused-vars */
import Image from 'next/image'
import React, { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { parseImages } from '../../context/CartContext'
import { useImageFallback } from '../../lib/useImageFallback'
import { useSite } from '../../context/SiteSettingsContext'
import ProductCard from '../../components/ProductCard'
import DealCard from '../../components/DealCard'
import { showSimpleToast } from '../../components/Toast'
import TestimonialsCarousel from '../../components/TestimonialsCarousel'
import RecentlyViewedProducts from '../../components/RecentlyViewedProducts'
import PriceRangeSlider from '../../components/PriceRangeSlider'

const SORT_OPTIONS = [
  { value: 'newest',     label: 'New Arrivals',  icon: '🆕' },
  { value: 'price_asc',  label: 'Price: Low',    icon: '💰' },
  { value: 'price_desc', label: 'Price: High',   icon: '💎' },
  { value: 'discount',   label: 'Most Discount', icon: '🔥' },
  { value: 'top_rated',  label: 'Top Rated',     icon: '⭐' },
  { value: 'az',         label: 'A → Z',         icon: '🔤' },
]

const BLUR_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg=='

function useOutsideClick(ref, cb) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) cb() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [cb])
}

// ── CatGridCard defined BEFORE Shop to avoid hoisting error ──────────────────

function ListCard({ product, priority = false }) {
  const hasDiscount = product.discount_price && product.discount_price < product.price
  const timerExpired = product.countdown_ends_at && new Date(product.countdown_ends_at) <= new Date()
  const effectiveHasDiscount = hasDiscount && !timerExpired
  const displayPrice = effectiveHasDiscount ? product.discount_price : product.price
  const discount = effectiveHasDiscount ? Math.round((1 - product.discount_price / product.price) * 100) : 0
  // Fix #13: Use shared parseImages for consistent image parsing
  const thumb = parseImages(product.images)[0] || null
  const { src: thumbSrc, unoptimized: thumbUnoptimized, handleError: thumbError } =
    useImageFallback(thumb || 'https://placehold.co/90x90/F1F5F9/8B5CF6?text=Viro', { width: 90, quality: 75 })
  // isComingSoon = DB status only. launch_at only controls countdown display.
  const isComingSoon = product.status === 'coming_soon'
  const isSoldOut = !isComingSoon && (product.stock <= 0 || product.status === 'out_of_stock')
  const isLowStock = !isComingSoon && !isSoldOut && product.stock > 0 && product.stock <= 5

  // Status badge config
  const statusBadge = isComingSoon
    ? { label: '🚀 Coming Soon', bg: '#EDE9FE', color: '#7C3AED', border: '#DDD6FE' }
    : isSoldOut
    ? { label: 'Sold Out', bg: '#FEE2E2', color: '#DC2626', border: '#FECACA' }
    : isLowStock
    ? { label: `⚠️ Only ${product.stock} left`, bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' }
    : { label: '✓ In Stock', bg: '#DCFCE7', color: '#16A34A', border: '#BBF7D0' }

  return (
    <Link href={`/product/${slugify(product.name)}-${product.id}`} className="list-card">
      <div className="relative flex-shrink-0" style={{ width: 90, height: 90 }}>
        <Image src={thumbSrc} alt={product.name}
          width={90} height={90}
          style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 14 }}
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          quality={75}
          priority={priority}
          sizes="90px"
          unoptimized={thumbUnoptimized}
          onError={thumbError}
        />
        {effectiveHasDiscount && (
          <span className="absolute top-1 left-1 text-white font-black px-1.5 py-0.5 rounded-lg"
            style={{ background: '#EF4444', fontSize: 10 }}>-{discount}%</span>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          {product.categories && (
            <div className="flex items-center gap-1 mb-0.5">
              {product.categories.image_url
                ? <Image src={product.categories.image_url} alt="" width={14} height={14} className="w-3.5 h-3.5 rounded-full object-cover" style={{ objectFit:"cover" }} />
                : <span style={{ fontSize: 11 }}>{product.categories.icon}</span>}
              <span className="text-xs font-bold" style={{ color: '#A78BFA' }}>{product.categories.name}</span>
            </div>
          )}
          <p className="font-bold text-sm leading-snug line-clamp-2" style={{ color: 'var(--viro-text)' }}>{product.name}</p>
          {product.description && (
            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--viro-textSub)' }}>{product.description}</p>
          )}
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="font-extrabold text-base" style={{ color: '#7C3AED' }}>Rs.{displayPrice?.toLocaleString()}</span>
            {effectiveHasDiscount && <span className="line-through text-xs" style={{ color: '#94A3B8' }}>Rs.{product.price?.toLocaleString()}</span>}
          </div>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: statusBadge.bg, color: statusBadge.color, border: `1px solid ${statusBadge.border}` }}>
            {statusBadge.label}
          </span>
        </div>
      </div>
    </Link>
  )
}

// ── Main Shop component ────────────────────────────────────────────────────────
function ShopInner({ initialProducts = [] }) {
  const [products,     setProducts]     = useState(initialProducts)
  const [categories,   setCategories]   = useState([])
  const [loading,      setLoading]      = useState(initialProducts.length === 0)
  const searchParams = useSearchParams()
  const router = useRouter()
  const [search,       setSearch]       = useState(() => searchParams.get('q') || '')
  const [activeCat,    setActiveCat]    = useState(() => searchParams.get('cat') || 'all')
  const [activeSubCat, setActiveSubCat] = useState(() => searchParams.get('sub') || 'all')
  const [sortBy,       setSortBy]       = useState('newest')
  const [minPrice,     setMinPrice]     = useState('')
  const [maxPrice,     setMaxPrice]     = useState('')
  const [onlyDeals,    setOnlyDeals]    = useState(false)
  const [dealsView,    setDealsView]    = useState(false)
  const [dealStockMap, setDealStockMap] = useState({})
  const [onlyInStock,  setOnlyInStock]  = useState(false)
  const [onlyFreeDelivery, setOnlyFreeDelivery] = useState(false)
  const [blockFilter,  setBlockFilter]  = useState(() => searchParams.get('block') || '')
  const [gridCols,     setGridCols]     = useState(2)
  const [drawerOpen,   setDrawerOpen]   = useState(false)
  const { hideOutOfStock, loaded: settingsLoaded, dealBoxes, getFreeThreshold, homeBlocks } = useSite()
  const filterBarRef = useRef(null)
  const lastScrollY = useRef(0)
  const filterBarHidden = useRef(false)
  const [visibleCount, setVisibleCount] = useState(12)

  // A partner/referral link (e.g. /shop?coupon=CODE) drops the code into
  // the same localStorage key the Cart page's own "apply coupon" button
  // already uses — checkout then auto-applies it exactly like a manually
  // typed-in code would, no separate mechanism needed. Doesn't touch the
  // active cart's applied coupon here; just queues it for when they reach
  // checkout, same as the existing cart-page flow.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const refCoupon = searchParams.get('coupon')
    if (refCoupon && typeof window !== 'undefined') {
      localStorage.setItem('viro_pending_coupon', refCoupon.toUpperCase())
    }
  }, [])

  // ── Search suggestions ───────────────────────────────────────────────────────
  const [searchSugg,    setSearchSugg]    = useState([])
  const [searchSuggLoading, setSearchSuggLoading] = useState(false)
  const [showSugg,      setShowSugg]      = useState(false)
  const searchDebRef    = useRef(null)
  const searchInputRef  = useRef(null)
  const searchBoxRef    = useRef(null)

  // Close suggestions on outside click
  useEffect(() => {
    const fn = e => { if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) setShowSugg(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  // If the shopper landed here via "Continue Shopping" from a cart that
  // hadn't hit the minimum order amount yet, remind them why they're here —
  // otherwise they land on /shop with no idea what to do next.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('viro_min_order_reminder')
      if (!raw) return
      sessionStorage.removeItem('viro_min_order_reminder')
      const { remaining, amount } = JSON.parse(raw)
      if (remaining > 0 && amount > 0) {
        showSimpleToast(`🛒 Add Rs.${remaining.toLocaleString()} more to your cart to unlock checkout (min. order Rs.${amount.toLocaleString()})`, 'warn', 1400)
      }
    } catch {}
  }, [])

  // Deal Boxes show live "available" / "out of stock" state based on the
  // SCARCEST included product's real stock — fetch once per set of active
  // deals rather than per-card, to keep this to one query.
  useEffect(() => {
    const ids = [...new Set(dealBoxes.filter(d => d.active).flatMap(d => d.productIds || []))]
    if (ids.length === 0) { setDealStockMap({}); return }
    supabase.from('products').select('id,stock').in('id', ids).then(({ data }) => {
      const map = {}
      for (const p of (data || [])) map[p.id] = p.stock ?? 0
      setDealStockMap(map)
    })
  }, [dealBoxes])

  // Word-boundary match — critical for search relevance: plain .includes()
  // treats "ring" as present inside "earring" (it IS a substring), which is
  // why ring searches used to surface earrings first. \b anchors require
  // "ring" to be its own word, not buried inside a longer one.
  function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
  function wordBoundaryIncludes(hay, needle) {
    if (!hay || !needle) return false
    // Boundary before the term only (not after) — matches a word that
    // STARTS with this term, so partial typing ("ha" while typing
    // "handbags") still works, while "ring" still can't match mid-word
    // inside "during"/"spring"/"wearing" (no word boundary immediately
    // before "ring" in any of those).
    try { return new RegExp(`\\b${escapeRegex(needle)}`, 'i').test(hay) } catch { return hay.includes(needle) }
  }

  // Fuzzy search variants helper (same as navbar)
  function getSearchVariants(word) {
    const w = word.toLowerCase().trim()
    const v = new Set([w])
    if (w.endsWith('s') && w.length > 3)   v.add(w.slice(0,-1))
    if (w.endsWith('es') && w.length > 4)  v.add(w.slice(0,-2))
    if (w.endsWith('ies') && w.length > 4) v.add(w.slice(0,-3)+'y')
    v.add(w + 's')
    if (w.length > 4) v.add(w.slice(0,-1))
    return [...v]
  }

  // Typo tolerance — plurals are handled above, but a genuine misspelling
  // like "earing" (missing an r) or "neclace" (missing an k) isn't a plural
  // variant, it's an edit-distance-1 typo. Small Levenshtein distance catches
  // those without being loose enough to false-match unrelated short words.
  function levenshtein(a, b) {
    if (a === b) return 0
    const m = a.length, n = b.length
    if (!m) return n
    if (!n) return m
    const dp = Array(n + 1)
    for (let j = 0; j <= n; j++) dp[j] = j
    for (let i = 1; i <= m; i++) {
      let prev = dp[0]
      dp[0] = i
      for (let j = 1; j <= n; j++) {
        const tmp = dp[j]
        dp[j] = a[i-1] === b[j-1] ? prev : 1 + Math.min(prev, dp[j], dp[j-1])
        prev = tmp
      }
    }
    return dp[n]
  }
  function fuzzyMatch(a, b) {
    if (!a || !b) return false
    if (a === b) return true
    const maxLen = Math.max(a.length, b.length)
    if (maxLen < 4) return false // too short — "ear" vs "eat" shouldn't match
    const threshold = maxLen <= 6 ? 1 : 2
    return levenshtein(a, b) <= threshold
  }

  // Live suggestions — computed instantly from the products already loaded
  // for the main grid (select('*') above already includes every field used
  // here), NOT a fresh network request per keystroke. The previous version
  // re-queried Supabase on every debounce tick, which on a slow connection
  // could take seconds or never visibly resolve — this is now zero-latency
  // regardless of connection speed, and only needs `products` to exist.
  useEffect(() => {
    clearTimeout(searchDebRef.current)
    if (!search.trim() || search.trim().length < 2) { setSearchSugg([]); setShowSugg(false); return }
    if (!products.length) return // still loading initial product list — nothing to suggest from yet
    setSearchSuggLoading(true)
    // Tiny debounce purely to avoid recomputing on every single keystroke
    // while someone's typing fast — not waiting on any network round-trip.
    searchDebRef.current = setTimeout(() => {
      const q = search.trim().toLowerCase()
      const words = q.split(/\s+/).filter(Boolean)
      const now = new Date()
      const scored = products
        .filter(p => p.is_active !== false)
        .map(p => {
          const nameL = (p.name||'').toLowerCase()
          const catL  = (p.categories?.name||'').toLowerCase()
          const tagL  = (p.meta_keywords||'').toLowerCase()
          const keywordList = (p.search_keywords || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
          const hay   = [nameL, catL, tagL, keywordList.join(' ')].join(' ')
          // All words must match (via any variant) — word-boundary, not raw substring
          if (!words.every(w => getSearchVariants(w).some(v => wordBoundaryIncludes(hay, v)))) return null
          let score = 0
          const exactIdx = keywordList.indexOf(q)
          if (exactIdx !== -1) score += Math.max(300 - exactIdx * 25, 100)
          words.forEach(w => {
            getSearchVariants(w).forEach(v => {
              keywordList.forEach((k, idx) => {
                if (k === v)                        score += Math.max(200 - idx * 20, 70)
                else if (wordBoundaryIncludes(k, v)) score += Math.max(90 - idx * 10, 35)
              })
              if (wordBoundaryIncludes(nameL, v)) score += 55
              else if (nameL.startsWith(v))        score += 60
              else if (nameL.includes(v))          score += 15
              if (wordBoundaryIncludes(catL, v))   score += 18
              if (tagL.includes(v))                score += 12
            })
          })
          const saleOk = p.discount_price && p.discount_price < p.price &&
            p.sale_active && (!p.sale_ends_at || new Date(p.sale_ends_at) > now)
          const dispPrice = saleOk ? p.discount_price : p.price
          const img = (() => { try { const imgs = typeof p.images==='string' ? JSON.parse(p.images) : p.images; return Array.isArray(imgs)?imgs[0]:imgs } catch { return p.images } })()
          return { ...p, _score: score, _dispPrice: dispPrice, _img: img, _saleOk: saleOk }
        })
        .filter(Boolean)
        .sort((a,b) => b._score - a._score)
        .slice(0, 6)
      setSearchSugg(scored)
      setShowSugg(scored.length > 0)
      setSearchSuggLoading(false)
    }, 60)
  }, [search, products])
  const [isDesktop,    setIsDesktop]    = useState(null)
  const sentinelRef = useRef()
  const drawerRef = useRef()
  useOutsideClick(drawerRef, useCallback(() => setDrawerOpen(false), []))
  useEffect(() => {
    const fn = () => setIsDesktop(window.innerWidth >= 768)
    fn()  // set real value immediately on mount (client only)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  useEffect(() => {
    if (!supabase) return
    const CACHE_KEY = '/shop'

    // Load categories (fast, small)
    supabase.from('categories').select('*').order('sort_order')
      .then(({ data }) => setCategories(data || []))

    const load = async () => {
      // ── Check cache first — instant on back navigation ──────────────────
      const cached = cacheGet(CACHE_KEY)
      if (cached?.data?.products) {
        setProducts(cached.data.products)
        setLoading(false)
        return
      }

      if (!supabase) return
      let fetchAttempts = 0
      const fetchWithRetry = async () => {
        fetchAttempts++
        try {
          const [prodsResult, ratingsResult, configResult] = await Promise.all([
            supabase.from('products').select('*, categories(id,name,icon,image_url,parent_id,status,is_visible)')
              .eq('is_active', true).order('display_order', { ascending: true, nullsFirst: false }),
            supabase.from('product_ratings').select('product_id,avg_rating,review_count')
              .then(res => res).catch(() => ({ data: null })),
            supabase.from('shop_config').select('key,value').then(r=>r).catch(()=>({data:[]})),
          ])
          const prods = prodsResult?.data
          if (!prods || prods.length === 0) throw new Error('empty response')
          const rMap = {}
          let ratings = ratingsResult?.data
          if (!ratings) {
            try {
              const { data: revRows } = await supabase.from('reviews').select('product_id,rating').eq('status', 'approved')
              if (revRows) {
                const agg = {}
                revRows.forEach(r => { if (!agg[r.product_id]) agg[r.product_id] = { sum: 0, count: 0 }; agg[r.product_id].sum += Number(r.rating); agg[r.product_id].count++ })
                ratings = Object.entries(agg).map(([product_id, v]) => ({ product_id, avg_rating: Math.round(v.sum/v.count*100)/100, review_count: v.count }))
              }
            } catch(_) {}
          }
          ;(ratings || []).forEach(r => { rMap[r.product_id] = { avg_rating: parseFloat(r.avg_rating)||0, review_count: parseInt(r.review_count)||0 } })
          const merged = prods.map(p => ({ ...p, ...(rMap[p.id] || {}) }))
          const configRows = configResult?.data || []
          const adminDefaultSort = configRows.find(r => r.key === 'default_sort')?.value || 'newest'
          // For random mode: shuffle once on load and store as manual order
          // so products don't disappear on every re-render
          if (adminDefaultSort === 'random') {
            const shuffled = [...merged].sort(() => Math.random() - 0.5)
            shuffled.forEach((p, i) => { p._shuffleOrder = i })
            setSortBy(prev => prev === 'newest' ? 'random_stable' : prev)
          } else {
            setSortBy(prev => prev === 'newest' ? adminDefaultSort : prev)
          }
          setProducts(merged)
          cacheSet(CACHE_KEY, { products: merged })
          setLoading(false)
        } catch(err) {
          // Try stale cache first — show old data rather than nothing
          const stale = cacheGet(CACHE_KEY)
          if (stale?.data?.products?.length > 0) {
            setProducts(stale.data.products)
            setLoading(false)
            // Retry silently in background after 3s
            setTimeout(() => fetchWithRetry(), 3000)
            return
          }
          // Retry once after 2s, then give up gracefully
          if (fetchAttempts < 2) {
            setTimeout(() => fetchWithRetry(), 2000)
          } else {
            // Minimal fallback — try without ratings/config
            try {
              const { data } = await supabase.from('products')
                .select('id,name,price,discount_price,images,stock,status,is_active,slug,display_order')
                .eq('is_active', true).order('display_order', { ascending: true, nullsFirst: false })
                .limit(50)
              if (data?.length > 0) setProducts(data)
            } catch(_) {}
            setLoading(false)
          }
        }
      }
      fetchWithRetry()
    }
    load()
    // Removed 60s polling timer — cache + ISR handles freshness
  }, [])

  // Reset visible count when filters change
  useEffect(() => { setVisibleCount(12) }, [search, activeCat, activeSubCat, sortBy, minPrice, maxPrice, onlyDeals, onlyFreeDelivery, onlyInStock])

  // Filter bar: hide on scroll down, show on scroll up — uses transform, zero re-renders
  useEffect(() => {
    let ticking = false
    function onScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        const el = filterBarRef.current
        if (el) {
          if (y < 80) {
            el.style.transform = 'translateY(0)'
          } else if (y > lastScrollY.current + 10) {
            el.style.transform = 'translateY(-110%)'  // slide up and hide
          } else if (lastScrollY.current > y + 10) {
            el.style.transform = 'translateY(0)'      // slide back down
          }
        }
        lastScrollY.current = y
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])



  // Has the one-time "arrived from a URL" hydration happened yet? Guards
  // against the write-back effect firing on mount and stomping a deep link
  // (e.g. /shop?freeDelivery=1 from Home) before we've read it into state.
  const hydratedFromUrl = useRef(false)

  // When arriving from global search OR a "quick filter" link from Home
  // (e.g. /shop?freeDelivery=1, /shop?deals=1, /shop?sort=top_rated,
  // /shop?max=2000), sync state from the URL. This runs once categories are
  // loaded so cat/sub slugs resolve correctly.
  useEffect(() => {
    const q        = searchParams.get('q')   || ''
    const catParam = searchParams.get('cat') || 'all'
    const subParam = searchParams.get('sub') || 'all'
    const sortParam = searchParams.get('sort')
    const minParam  = searchParams.get('min')
    const maxParam  = searchParams.get('max')
    const dealsParam    = searchParams.get('deals')
    const deliveryParam = searchParams.get('freeDelivery')
    const stockParam     = searchParams.get('inStock')
    const blockParam     = searchParams.get('block')
    // Resolve slug → id (fall back to raw value for legacy UUID links)
    const catId = catParam === 'all' ? 'all'
      : (categories.find(c => c.slug === catParam)?.id || catParam)
    const subId = subParam === 'all' ? 'all'
      : (categories.find(c => c.slug === subParam)?.id || subParam)
    if (q     !== search)       setSearch(q)
    if (catId !== activeCat)    setActiveCat(catId)
    if (subId !== activeSubCat) setActiveSubCat(subId)
    if (sortParam && SORT_OPTIONS.some(s => s.value === sortParam)) setSortBy(sortParam)
    if (minParam !== null) setMinPrice(minParam)
    if (maxParam !== null) setMaxPrice(maxParam)
    if (dealsParam    === '1') setOnlyDeals(true)
    if (deliveryParam === '1') setOnlyFreeDelivery(true)
    if (stockParam     === '1') setOnlyInStock(true)
    if (blockParam !== null) setBlockFilter(blockParam)
    hydratedFromUrl.current = true
  }, [searchParams, categories]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync filters → URL so search results are bookmarkable, shareable, and SEO-crawlable.
  // Also makes the Shop page linkable-with-filters from anywhere (e.g. Home's
  // quick-filter shortcuts) since every applied filter round-trips through the URL.
  // Uses replace (not push) so Back button works naturally
  useEffect(() => {
    if (!hydratedFromUrl.current) return // wait for the read-in effect above first
    const params = new URLSearchParams()
    if (search)              params.set('q',   search)
    if (activeCat !== 'all') {
      const catObj = categories.find(c => c.id === activeCat)
      params.set('cat', catObj?.slug || activeCat)
    }
    if (activeSubCat !== 'all') {
      const subObj = categories.find(c => c.id === activeSubCat)
      params.set('sub', subObj?.slug || activeSubCat)
    }
    if (sortBy !== 'newest')      params.set('sort', sortBy)
    if (minPrice !== '')         params.set('min', minPrice)
    if (maxPrice !== '')         params.set('max', maxPrice)
    if (onlyDeals)               params.set('deals', '1')
    if (onlyFreeDelivery)        params.set('freeDelivery', '1')
    if (onlyInStock)             params.set('inStock', '1')
    if (blockFilter)             params.set('block', blockFilter)
    const qs = params.toString()
    const newUrl = qs ? `/shop?${qs}` : '/shop'
    // Only push history if URL actually changes (avoids infinite loop)
    const current = window.location.pathname + (window.location.search || '')
    if (current !== newUrl) {
      router.replace(newUrl, { scroll: false })
    }
  }, [search, activeCat, activeSubCat, sortBy, minPrice, maxPrice, onlyDeals, onlyFreeDelivery, onlyInStock, blockFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  // ── Category visibility logic ──────────────────────────────────────────────
  // For each category, compute its "effective status" considering:
  //   1. If parent is hidden → child is hidden
  //   2. If parent is coming_soon → child is coming_soon (unless already hidden)
  //   3. If category has no sort_order (null/0) → auto-hidden (not shown)
  //   4. If category has no products and no coming_soon override → coming_soon
  //   5. The admin-set status takes priority for individual overrides

  function getRawProductCount(catId) {
    const childIds = categories.filter(c => c.parent_id === catId).map(c => c.id)
    return products.filter(p => p.category_id === catId || childIds.includes(p.category_id)).length
  }

  function getEffectiveStatus(cat) {
    // Hidden if admin explicitly hid it
    if (cat.status === 'hidden' || cat.is_visible === false) return 'hidden'

    // Check parent status — parent hidden/coming_soon cascades down
    if (cat.parent_id) {
      const parent = categories.find(c => c.id === cat.parent_id)
      if (parent) {
        const parentStatus = getEffectiveStatus(parent)
        if (parentStatus === 'hidden') return 'hidden'
        if (parentStatus === 'coming_soon' && cat.status !== 'active') return 'coming_soon'
      }
    }

    // If no sort_order set (null), treat as hidden until admin orders it
    if (cat.sort_order === null || cat.sort_order === undefined) return 'hidden'

    // If admin explicitly set coming_soon, honour it
    if (cat.status === 'coming_soon') return 'coming_soon'

    // If no products, auto show as coming_soon
    const count = getRawProductCount(cat.id)
    if (count === 0) return 'coming_soon'

    return 'active'
  }

  // Build enriched category list with effective status
  const enrichedCats = (categories || []).map(cat => ({
    ...cat,
    _effectiveStatus: getEffectiveStatus(cat),
  }))

  // Only visible or coming_soon categories shown in shop (hidden = fully invisible)
  const visibleCats = enrichedCats.filter(c => c._effectiveStatus !== 'hidden')
  const parentCats  = visibleCats.filter(c => !c.parent_id)
  const subCats     = (parentId) => visibleCats.filter(c => c.parent_id === parentId)
  const activeParent = parentCats.find(c => c.id === activeCat)
  const activeSubs   = activeParent ? subCats(activeParent.id) : []
  // Sub-subcategories: if a subcategory is selected, show ITS children
  const activeSubParent = activeSubs.find(s => s.id === activeSubCat)
  const activeSubSubs   = activeSubParent ? subCats(activeSubParent.id) : []

  // Count active (purchasable) products for a category
  function countForCat(catId) {
    const cat = enrichedCats.find(c => c.id === catId)
    if (!cat) return 0
    const catStatus = cat._effectiveStatus

    // If category is coming_soon, count only individually-visible products
    if (catStatus === 'coming_soon') {
      const childIds = enrichedCats.filter(c => c.parent_id === catId && c._effectiveStatus !== 'hidden').map(c => c.id)
      // Products individually marked active in a coming_soon cat show as purchasable
      return products.filter(p =>
        (p.category_id === catId || childIds.includes(p.category_id)) &&
        p.status === 'active' && p.is_active
      ).length
    }

    const childIds = enrichedCats.filter(c => c.parent_id === catId && c._effectiveStatus !== 'hidden').map(c => c.id)
    return products.filter(p => p.category_id === catId || childIds.includes(p.category_id)).length
  }

  // ── Product visibility logic ───────────────────────────────────────────────
  // A product is visible if:
  //   - Its category is not hidden
  //   - If category is coming_soon, only show product if product.status === 'active' (individually overridden)
  //   - If category is active, show product normally
  function isProductVisible(product) {
    const cat = enrichedCats.find(c => c.id === product.category_id)
    if (!cat) return false // no category = hidden
    const catStatus = cat._effectiveStatus
    if (catStatus === 'hidden') return false
    if (catStatus === 'coming_soon') {
      // Only show if product is individually marked active/visible
      return product.status === 'active' && product.is_active !== false
    }
    return true
  }

  const getDisplayPrice = p => (p.discount_price && p.discount_price < p.price) ? p.discount_price : p.price

  // Resolve the side-menu "block" filter (?block=<id>) to a Set of product
  // ids for O(1) lookups in the filter loop below — same data source as the
  // Home Blocks / Tab Groups feature, just applied as a Shop-page filter.
  const blockProductIdSet = (() => {
    if (!blockFilter || !Array.isArray(homeBlocks)) return null
    const block = homeBlocks.find(b => b.id === blockFilter)
    if (!block) return null
    return new Set(block.productIds || block.product_ids || [])
  })()

  // Price slider bounds — real min/max across the catalogue, rounded outward
  // to clean Rs.10 steps so the slider always spans the actual product range
  // instead of an arbitrary guessed ceiling.
  const priceBounds = (() => {
    if (!products.length) return [0, 5000]
    const prices = products.map(getDisplayPrice).filter(p => typeof p === 'number' && p > 0)
    if (!prices.length) return [0, 5000]
    const lo = Math.floor(Math.min(...prices) / 10) * 10
    const hi = Math.ceil(Math.max(...prices) / 10) * 10
    return [Math.max(0, lo), Math.max(hi, lo + 100)]
  })()

  // Hide OOS — plain inline, safe for SSR
  console.log('[Shop] hideOutOfStock=', hideOutOfStock, 'settingsLoaded=', settingsLoaded, 'products=', products.length)
  const shopProducts = (hideOutOfStock && settingsLoaded)
    ? (() => { const f = products.filter(p => (p.stock ?? 999) > 0 && p.status !== 'out_of_stock'); return f.length ? f : products })()
    : products

  const filtered = shopProducts
    .filter(p => {
      if (!isProductVisible(p)) return false
      if (search) {
        const words = search.toLowerCase().trim().split(/\s+/).filter(Boolean)
        const searchPhrase = search.toLowerCase().trim()
        const catName = p.categories?.name?.toLowerCase() || ''
        const nameStr = (p.name || '').toLowerCase()
        const catStr  = catName
        const tagStr  = (p.meta_keywords || '').toLowerCase()
        const descStr = [p.description, p.highlights, p.meta_title, p.meta_description].filter(Boolean).join(' ').toLowerCase()
        const keywordList = (p.search_keywords || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
        const fullHay = [nameStr, catStr, tagStr, descStr, keywordList.join(' ')].join(' ')

        // Require ALL words to match (any variant, OR a close-enough typo against a tagged keyword).
        // Word-boundary matching, not raw substring — "ring" must appear as
        // its own word, not merely as a substring inside "during", "spring",
        // "wearing", "keyring" etc., which was previously letting totally
        // unrelated products (e.g. handbags) qualify as "ring" matches.
        const allMatch = words.every(w =>
          getSearchVariants(w).some(v => wordBoundaryIncludes(fullHay, v)) ||
          keywordList.some(k => fuzzyMatch(k, w))
        )
        if (!allMatch) return false

        // Tier flag: does EVERY word have a genuine exact match against an
        // admin-tagged keyword (word-for-word, not fuzzy/substring/description)?
        // This is the "the admin explicitly tagged this product as a ring"
        // signal — strong enough that these should always show as a block
        // ahead of loose matches (an earring whose description happens to
        // mention "ring"), regardless of which sort is chosen.
        p._exactTagMatch = words.every(w =>
          getSearchVariants(w).some(v => keywordList.includes(v))
        )

        let score = 0

        // Exact full-phrase match against an admin-tagged keyword — the strongest signal there is.
        // Rank-weighted: first keyword in the list gets the biggest bonus.
        const exactIdx = keywordList.indexOf(searchPhrase)
        if (exactIdx !== -1) score += Math.max(300 - exactIdx * 25, 100)

        words.forEach(w => {
          getSearchVariants(w).forEach(v => {
            keywordList.forEach((k, idx) => {
              if (k === v)                          score += Math.max(220 - idx * 20, 80)  // exact keyword match, rank-weighted
              else if (wordBoundaryIncludes(k, v))   score += Math.max(100 - idx * 10, 40)  // word inside a multi-word keyword
              else if (fuzzyMatch(k, v))             score += Math.max(70 - idx * 10, 25)   // typo, e.g. "earing" → "earring"
            })
            if (wordBoundaryIncludes(nameStr, v))     score += 45   // "Ring" matches product named "...Ring..." as a real word
            else if (nameStr.includes(v))              score += 12   // weak fallback so partial/substring matches still surface, just lower
            if (wordBoundaryIncludes(catStr, v))       score += 20
            if (wordBoundaryIncludes(tagStr, v))       score += 12
            if (descStr.includes(v))                    score += 4
            if (nameStr.startsWith(v))                  score += 10
          })
        })
        if (words.every(w => getSearchVariants(w).some(v => wordBoundaryIncludes(nameStr, v)))) score += 30
        p._searchScore = score
      }

      if (activeCat !== 'all') {
        if (activeSubCat !== 'all') {
          if (p.category_id !== activeSubCat) return false
        } else {
          const childIds = enrichedCats.filter(c => c.parent_id === activeCat).map(c => c.id)
          if (p.category_id !== activeCat && !childIds.includes(p.category_id)) return false
        }
      }

      const dp = getDisplayPrice(p)
      if (minPrice !== '' && dp < Number(minPrice)) return false
      if (maxPrice !== '' && dp > Number(maxPrice)) return false
      if (onlyDeals && !(p.discount_price && p.discount_price < p.price)) return false
      if (onlyFreeDelivery) {
        const freeThreshold = getFreeThreshold('')
        if (freeThreshold == null || dp < freeThreshold) return false
      }
      if (onlyInStock) {
        if (p.stock <= 0 || p.status === 'out_of_stock' || p.status === 'coming_soon') return false
      }
      if (blockProductIdSet && !blockProductIdSet.has(p.id)) return false
      return true
    })
    .sort((a, b) => {
      // Tier grouping comes first, before any other ordering — every
      // exact-tagged match (admin explicitly keyworded this product for
      // this search term) shows before every loose match, full stop. The
      // chosen sort (price/rating/etc.) then applies WITHIN each tier
      // separately, so "Price: High" sorts the 15 genuine rings by price
      // among themselves, then the loosely-related items by price among
      // themselves — never interleaved.
      if (search) {
        const tierA = a._exactTagMatch ? 1 : 0
        const tierB = b._exactTagMatch ? 1 : 0
        if (tierA !== tierB) return tierB - tierA
      }
      // Relevance-first ordering is only the right default when the user
      // HASN'T explicitly picked a sort — e.g. fresh search results should
      // lead with the best match. Once they choose "Price: Low" etc., that
      // choice should win outright; previously relevance score was compared
      // first regardless, and since scores are rarely exactly equal between
      // two products, the chosen sort almost never actually got to run.
      if (search && sortBy === 'newest' && a._searchScore != null && b._searchScore != null) {
        if (b._searchScore !== a._searchScore) return b._searchScore - a._searchScore
      }
      const pa = getDisplayPrice(a), pb = getDisplayPrice(b)
      if (sortBy === 'price_asc'  || sortBy === 'price_low')  return pa - pb
      if (sortBy === 'price_desc' || sortBy === 'price_high') return pb - pa
      if (sortBy === 'discount') {
        const da = a.discount_price && a.price ? (a.price - a.discount_price) / a.price : 0
        const db = b.discount_price && b.price ? (b.price - b.discount_price) / b.price : 0
        return db - da
      }
      if (sortBy === 'top_rated')    return (b.avg_rating || 0) - (a.avg_rating || 0)
      if (sortBy === 'most_ordered') return (b.review_count || 0) - (a.review_count || 0)
      if (sortBy === 'stock_desc')   return (b.stock || 0) - (a.stock || 0)
      if (sortBy === 'az' || sortBy === 'name') return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'za')           return (b.name || '').localeCompare(a.name || '')
      if (sortBy === 'oldest')       return new Date(a.created_at) - new Date(b.created_at)
      if (sortBy === 'random' || sortBy === 'random_stable') return (a._shuffleOrder ?? 0) - (b._shuffleOrder ?? 0)
      if (sortBy === 'featured') {
        const fa = a.is_featured ? 1 : 0, fb = b.is_featured ? 1 : 0
        return fb - fa || new Date(b.created_at) - new Date(a.created_at)
      }
      if (sortBy === 'manual') return (a.display_order || 9999) - (b.display_order || 9999)
      // newest (default)
      return new Date(b.created_at) - new Date(a.created_at)
    })

  // Where exact-tagged matches end and loosely-related results begin —
  // only meaningful when search results are actually a mix of both tiers.
  const tierBoundaryIdx = (() => {
    if (!search) return -1
    const idx = filtered.findIndex(p => !p._exactTagMatch)
    return (idx > 0 && idx < filtered.length) ? idx : -1
  })()

  const activeFilterCount =
    (activeCat !== 'all' ? 1 : 0) + (activeSubCat !== 'all' ? 1 : 0) +
    (minPrice !== '' ? 1 : 0) + (maxPrice !== '' ? 1 : 0) +
    (onlyDeals ? 1 : 0) + (onlyFreeDelivery ? 1 : 0) + (onlyInStock ? 1 : 0) +
    (blockFilter ? 1 : 0)

  // Category breakdown for the current search results — "33 items" alone
  // doesn't say where they live; this shows e.g. "18 Rings · 9 Earrings · 6 Necklaces"
  const categoryBreakdown = search
    ? Object.values(
        filtered.reduce((acc, p) => {
          const name = p.categories?.name || 'Other'
          if (!acc[name]) acc[name] = { name, count: 0 }
          acc[name].count++
          return acc
        }, {})
      ).sort((a, b) => b.count - a.count)
    : []

  // Debounced search-term analytics — logs what people actually search once
  // they've paused typing for ~1.5s (a "completed" search, not every keystroke),
  // so the admin Search Analytics panel shows real intent, not partial words.
  // Endpoint deliberately named "search-log" not "search-track" — ad blockers
  // and privacy extensions commonly filter any URL containing "track", which
  // would silently drop this with zero trace. If analytics still isn't
  // showing up after deploy, test in an Incognito window with extensions off.
  useEffect(() => {
    if (!search || search.trim().length < 2) return
    const t = setTimeout(() => {
      fetch('/api/search-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: search.trim(), result_count: filtered.length }),
      }).catch(err => console.warn('[search-log] failed to send (likely blocked by a browser extension):', err.message))
    }, 1500)
    return () => clearTimeout(t)
  }, [search, filtered.length])

  function resetFilters() {
    setActiveCat('all'); setActiveSubCat('all')
    setMinPrice(''); setMaxPrice('')
    setOnlyDeals(false); setOnlyFreeDelivery(false); setOnlyInStock(false); setSortBy('newest')
    setBlockFilter('')
  }

  function selectParentCat(id) {
    setActiveCat(id === activeCat ? 'all' : id)
    setActiveSubCat('all')
  }

  // Infinite scroll via IntersectionObserver
  // Re-run whenever visibleCount or filtered.length changes so the sentinel
  // element (which mounts/unmounts) always has a fresh observer on it.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setVisibleCount(n => n + 12)
      }
    }, { rootMargin: '200px', threshold: 0 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [visibleCount, filtered.length])

  return (
    <div style={{ background: 'var(--viro-sectionBg)', minHeight: '100vh', paddingBottom: 96 }}>
      <style>{`
        .sb::-webkit-scrollbar{display:none}.sb{-ms-overflow-style:none;scrollbar-width:none}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes fadeBg{from{opacity:0}to{opacity:1}}
        .drawer-panel{animation:slideUp 0.28s cubic-bezier(.32,0,.15,1)}
        .drawer-bg{animation:fadeBg 0.22s ease}
        .cat-img-pill{flex-shrink:0;display:flex;align-items:center;gap:7px;padding:5px 11px 5px 5px;border-radius:40px;font-size:12.5px;font-weight:700;white-space:nowrap;cursor:pointer;transition:all 0.18s;border:2px solid transparent}
        .cat-img-pill.on{background:linear-gradient(135deg,#8B5CF6,#7C3AED);color:#fff;box-shadow:0 3px 12px rgba(139,92,246,0.4)}
        .cat-img-pill.off{background:var(--viro-bgCard);color:var(--viro-textSub);border-color:var(--viro-border)}
        .sub-pill{flex-shrink:0;padding:3.5px 10px;border-radius:30px;font-size:10.5px;font-weight:700;white-space:nowrap;cursor:pointer;transition:all 0.15s;border:1.5px solid transparent}
        .sub-pill.on{background:#00BFFF;color:#0B1221;border-color:transparent}
        .sub-pill.off{background:var(--viro-bgCard);color:var(--viro-textSub);border-color:var(--viro-border)}
        .sort-chip{flex-shrink:0;display:flex;align-items:center;gap:5px;padding:6px 12px;border-radius:30px;font-size:11.5px;font-weight:700;cursor:pointer;transition:all 0.15s}
        .sort-chip.on{background:#00BFFF;color:#0B1221}
        .sort-chip.off{background:var(--viro-bgCard);color:var(--viro-textSub);border:1.5px solid var(--viro-border)}
        .toggle-track{width:44px;height:24px;border-radius:12px;position:relative;cursor:pointer;transition:background 0.2s;flex-shrink:0}
        .toggle-thumb{position:absolute;top:2px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform 0.2s cubic-bezier(.4,0,.2,1);box-shadow:0 1px 4px rgba(0,0,0,0.3)}
        .filter-tag{display:inline-flex;align-items:center;gap:5px;padding:5px 8px 5px 11px;border-radius:20px;font-size:11px;font-weight:700;background:var(--viro-bgCard);color:#7C3AED;border:1px solid #8B5CF640;cursor:pointer;line-height:1.4;box-shadow:0 1px 3px rgba(139,92,246,0.15)}
        .filter-tag .x{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;background:#8B5CF61c;font-size:9px;font-weight:800;flex-shrink:0}
        .cat-grid-card{position:relative;border-radius:18px;overflow:hidden;cursor:pointer;transition:all 0.2s;aspect-ratio:1}
        .cat-grid-card:hover{transform:scale(1.03);box-shadow:0 6px 20px rgba(0,0,0,0.3)}
        .cat-grid-card.selected{box-shadow:0 0 0 3px #8B5CF6,0 6px 20px rgba(139,92,246,0.4)}
        .list-card{display:flex;gap:12px;padding:12px;border-radius:16px;background:var(--viro-bgCard);border:1px solid var(--viro-border);text-decoration:none}
        @media(min-width:768px){
          .pc-header-title{font-size:15px!important;padding-top:8px!important;padding-bottom:4px!important}
          .pc-search-row{padding-bottom:4px!important}
          .pc-sort-row{padding-bottom:4px!important}
          .pc-cat-row{padding-bottom:4px!important}
          .sort-chip{padding:4px 10px!important;font-size:11px!important}
          .cat-img-pill{padding:4px 10px 4px 4px!important;font-size:11px!important;gap:5px!important}
          .sub-pill{padding:3px 10px!important;font-size:11px!important}
        }
      `}</style>

      {/* ══ STICKY HEADER ══════════════════════════════════════════ */}
      <div className="sticky top-9 z-30" style={{ background: 'var(--viro-searchBg)', borderBottom: '1px solid var(--viro-border)' }}>

        {/* Title + count + grid toggle */}
        <div className="pc-header-title flex items-center justify-between px-3 pt-2 pb-1.5">
          <h1 className="font-display text-lg font-extrabold" style={{ color: 'var(--viro-text)' }}>Shop</h1>
          <div className="flex items-center gap-2">
            {!loading && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: '#8B5CF615', color: '#A78BFA', border: '1px solid #8B5CF630' }}>
                {filtered.length} items
              </span>
            )}
            <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--viro-border)' }}>
              {[2, 1].map(n => (
                <button key={n} onClick={() => setGridCols(n)}
                  className="w-8 h-8 flex items-center justify-center transition-all"
                  style={gridCols === n ? { background: '#8B5CF6', color: '#fff' } : { background: 'var(--viro-bgCard)', color: 'var(--viro-textSub)' }}>
                  {n === 2
                    ? <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><rect x="0" y="0" width="5.5" height="5.5" rx="1"/><rect x="7.5" y="0" width="5.5" height="5.5" rx="1"/><rect x="0" y="7.5" width="5.5" height="5.5" rx="1"/><rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1"/></svg>
                    : <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><rect x="0" y="0" width="13" height="3.5" rx="1"/><rect x="0" y="4.75" width="13" height="3.5" rx="1"/><rect x="0" y="9.5" width="13" height="3.5" rx="1"/></svg>
                  }
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search + Filter button */}
        <div className="pc-search-row flex gap-2 px-3 pb-1.5">
          <div className="relative flex-1" ref={searchBoxRef}>
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--viro-textSub)', fontSize: 15, zIndex:1 }}>
              {searchSuggLoading ? (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="3" opacity="0.3"/>
                  <path fill="#8B5CF6" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : '🔍'}
            </span>
            <input ref={searchInputRef} type="search" placeholder="Search products…" value={search}
              onChange={e => { setSearch(e.target.value); setShowSugg(true) }}
              onFocus={() => { if (search.trim().length >= 2) setShowSugg(true) }}
              onKeyDown={e => { if (e.key==='Escape') { setShowSugg(false); searchInputRef.current?.blur() } }}
              style={{ paddingLeft: '2.4rem', paddingRight: search ? '2rem' : '1rem', borderRadius: 30, height: 38, fontSize: 13 }} />
            {search && (
              <button onClick={() => { setSearch(''); setShowSugg(false); searchInputRef.current?.focus() }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-lg leading-none"
                style={{ color: 'var(--viro-textSub)' }}>×</button>
            )}

            {/* Suggestions dropdown */}
            {showSugg && searchSugg.length > 0 && (
              <div style={{
                position:'absolute', top:'calc(100% + 6px)', left:0, right:0, zIndex:100,
                background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)',
                borderRadius:16, overflow:'hidden', boxShadow:'0 16px 40px rgba(0,0,0,0.35)',
              }}>
                <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--viro-textSub)', padding:'8px 14px 4px' }}>
                  Suggestions
                </p>
                {searchSugg.map(p => (
                  <Link key={p.id}
                    href={`/product/${(p.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}-${p.id}`}
                    onClick={() => { setShowSugg(false); setSearch(p.name) }}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', textDecoration:'none', borderBottom:'1px solid var(--viro-border)' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--viro-bgDeep)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <div style={{ width:38, height:38, borderRadius:10, overflow:'hidden', flexShrink:0, background:'var(--viro-bgDeep)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {p._img
                        ? <img src={p._img} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                        : <span style={{ fontSize:18 }}>📦</span>
                      }
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, fontWeight:700, color:'var(--viro-text)', margin:'0 0 1px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</p>
                      <p style={{ fontSize:11, color:'var(--viro-textSub)', margin:0 }}>
                        {p.categories?.icon} {p.categories?.name}
                      </p>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <p style={{ fontSize:13, fontWeight:800, color: p._saleOk?'#8B5CF6':'var(--viro-text)', margin:0 }}>
                        Rs.{(p._dispPrice||0).toLocaleString()}
                      </p>
                      {p._saleOk && (
                        <p style={{ fontSize:10, color:'var(--viro-textSub)', textDecoration:'line-through', margin:0 }}>
                          Rs.{(p.price||0).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
                <button onClick={() => { setShowSugg(false) }}
                  style={{ display:'block', width:'100%', padding:'9px 14px', fontSize:12, fontWeight:700, color:'#A78BFA', background:'transparent', border:'none', cursor:'pointer', textAlign:'center' }}>
                  See all results for "{search}" →
                </button>
              </div>
            )}
          </div>
          <button onClick={() => setDrawerOpen(true)}
            className="relative flex items-center gap-1.5 px-4 rounded-3xl font-bold text-sm flex-shrink-0 transition-all"
            style={activeFilterCount > 0
              ? { background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', color: '#fff', boxShadow: '0 3px 12px rgba(139,92,246,0.35)' }
              : { background: 'var(--viro-bgCard)', color: 'var(--viro-textSub)', border: '1px solid var(--viro-border)' }}>
            <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor">
              <rect x="0" y="0" width="14" height="2" rx="1"/><rect x="2" y="5" width="10" height="2" rx="1"/><rect x="4" y="10" width="6" height="2" rx="1"/>
            </svg>
            Filter
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center font-black text-white"
                style={{ background: '#EF4444', fontSize: 10 }}>{activeFilterCount}</span>
            )}
          </button>
        </div>

        {/* Category breakdown for search results — "33 items" alone doesn't say where they live */}
        {search && categoryBreakdown.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 pb-2 overflow-x-auto no-scrollbar">
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--viro-textSub)' }}>Found in:</span>
            {categoryBreakdown.map(c => (
              <span key={c.name} className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 whitespace-nowrap"
                style={{ background: 'var(--viro-bgCard)', color: 'var(--viro-textSub)', border: '1px solid var(--viro-border)' }}>
                {c.name} <span style={{ color: '#A78BFA', fontWeight: 800 }}>{c.count}</span>
              </span>
            ))}
          </div>
        )}

      </div>{/* ── end main sticky header ── */}

      {/* ══ FILTER BAR — sort + category pills, hides on scroll down ══ */}
      <div ref={filterBarRef} className="sticky z-20" style={{
        top: 'calc(2.25rem + 90px)',
        background: 'var(--viro-searchBg)',
        borderBottom: '1px solid var(--viro-border)',
        transform: 'translateY(0)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        willChange: 'transform',
      }}>

        {/* Sort + category — hides on scroll down like Daraz */}

        {/* Sort chips */}
        <div className="pc-sort-row flex gap-1.5 px-3 pb-1 overflow-x-auto sb">
          {dealBoxes.some(d => d.active) && (
            <button onClick={() => setDealsView(v => !v)}
              className="sort-chip"
              style={{
                background: dealsView ? 'linear-gradient(135deg,#7C3AED,#EC4899)' : 'var(--viro-bgCard)',
                color: dealsView ? '#fff' : 'var(--viro-text)',
                border: dealsView ? 'none' : '1.5px solid #7C3AED40',
                fontWeight: 800,
              }}>
              🎁 Deals
            </button>
          )}
          <button onClick={() => setSortBy(SORT_OPTIONS[0].value)}
            className={`sort-chip ${sortBy === SORT_OPTIONS[0].value ? 'on' : 'off'}`}>
            {SORT_OPTIONS[0].icon} {SORT_OPTIONS[0].label}
          </button>
          {!dealsView && (
            <button onClick={() => setOnlyFreeDelivery(v => !v)}
              className="sort-chip"
              style={{
                background: onlyFreeDelivery ? 'linear-gradient(135deg,#10B981,#059669)' : 'var(--viro-bgCard)',
                color: onlyFreeDelivery ? '#fff' : 'var(--viro-text)',
                border: onlyFreeDelivery ? 'none' : '1.5px solid #10B98140',
                fontWeight: 800,
              }}>
              🚚 Free Delivery
            </button>
          )}
          {SORT_OPTIONS.slice(1).map(s => (
            <button key={s.value} onClick={() => setSortBy(s.value)}
              className={`sort-chip ${sortBy === s.value ? 'on' : 'off'}`}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {/* Category pills with images — only active categories (not coming_soon) in pills */}
        {!dealsView && parentCats.filter(c => c._effectiveStatus === 'active').length > 0 && (
          <div className="pc-cat-row flex gap-1.5 px-3 pb-1 overflow-x-auto sb">
            <button onClick={() => { setActiveCat('all'); setActiveSubCat('all'); setDealsView(false) }}
              className={`cat-img-pill ${activeCat === 'all' ? 'on' : 'off'}`}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: activeCat === 'all' ? 'rgba(255,255,255,0.2)' : 'var(--viro-border)', fontSize: 16 }}>🏷️</div>
              All
            </button>

            {parentCats.filter(c => c._effectiveStatus === 'active').map(cat => {
              const count = countForCat(cat.id)
              const isOn = activeCat === cat.id
              return (
                <button key={cat.id} onClick={() => selectParentCat(cat.id)}
                  className={`cat-img-pill ${isOn ? 'on' : 'off'}`}>
                  <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
                    style={{ background: isOn ? 'rgba(255,255,255,0.2)' : 'var(--viro-border)' }}>
                    {cat.image_url
                      ? <Image src={cat.image_url} alt={cat.name} width={48} height={48} className="w-full h-full object-cover" style={{ objectFit:"cover" }} />
                      : <span style={{ fontSize: 16 }}>{cat.icon}</span>
                    }
                  </div>
                  {cat.name}
                  <span style={{ opacity: 0.65, fontWeight: 400, fontSize: 11 }}>({count})</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Sub-category pills */}
        {activeSubs.filter(c => c._effectiveStatus === 'active').length > 0 && (
          <div className="flex gap-1.5 px-3 pb-1 overflow-x-auto sb">
            <button onClick={() => setActiveSubCat('all')}
              className={`sub-pill ${activeSubCat === 'all' ? 'on' : 'off'}`}>
              All {activeParent?.name}
            </button>
            {activeSubs.filter(c => c._effectiveStatus === 'active').map(sub => {
              const count = products.filter(p => p.category_id === sub.id && isProductVisible(p)).length
              if (!count) return null
              return (
                <button key={sub.id} onClick={() => setActiveSubCat(activeSubCat === sub.id ? 'all' : sub.id)}
                  className={`sub-pill ${activeSubCat === sub.id ? 'on' : 'off'}`}>
                  {sub.image_url
                    ? <Image src={sub.image_url} alt={sub.name} width={16} height={16} className="inline-block w-4 h-4 rounded-full object-cover mr-1" style={{ objectFit:"cover" }} />
                    : <span className="mr-1">{sub.icon}</span>
                  }
                  {sub.name}
                  <span style={{ opacity: 0.6, fontWeight: 400 }}> ({count})</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Sub-sub-category pills — shown when a subcategory is selected and has its own children */}
        {activeSubSubs.filter(c => c._effectiveStatus === 'active').length > 0 && (
          <div className="flex gap-1.5 px-3 pb-1 overflow-x-auto sb" style={{ borderTop: '1px solid var(--viro-border)', paddingTop: 6 }}>
            <span style={{ fontSize:10, color:'var(--viro-textSub)', fontWeight:700, flexShrink:0, alignSelf:'center', paddingRight:4 }}>
              ↳ IN:
            </span>
            {activeSubSubs.filter(c => c._effectiveStatus === 'active').map(sub => {
              const count = products.filter(p => p.category_id === sub.id && isProductVisible(p)).length
              if (!count) return null
              return (
                <button key={sub.id}
                  onClick={() => setActiveSubCat(activeSubCat === sub.id ? activeSubParent.id : sub.id)}
                  className={`sub-pill ${activeSubCat === sub.id ? 'on' : 'off'}`}
                  style={{ fontSize: 11 }}>
                  {sub.image_url
                    ? <Image src={sub.image_url} alt={sub.name} width={14} height={14} className="inline-block w-3.5 h-3.5 rounded-full object-cover mr-1" style={{ objectFit:"cover" }} />
                    : <span className="mr-1">{sub.icon}</span>
                  }
                  {sub.name}
                  <span style={{ opacity: 0.6, fontWeight: 400 }}> ({count})</span>
                </button>
              )
            })}
          </div>
        )}


        {/* Active filters — every applied filter gets a one-tap ✕ here, so
            removing a filter never requires re-finding the same pill above
            or opening the drawer. Category/subcategory are included too
            (previously only removable by re-tapping the highlighted pill,
            which wasn't obvious as a "remove" action). */}
        {activeFilterCount > 0 && (
          <div className="flex gap-1 px-3 pb-1 pt-0.5 flex-wrap items-center">
            {activeCat !== 'all' && (
              <span className="filter-tag" onClick={() => { setActiveCat('all'); setActiveSubCat('all') }}>
                {categories.find(c => c.id === activeCat)?.icon} {categories.find(c => c.id === activeCat)?.name || 'Category'} <span className="x">✕</span>
              </span>
            )}
            {blockFilter && (
              <span className="filter-tag" onClick={() => setBlockFilter('')}>
                📦 {homeBlocks.find(b => b.id === blockFilter)?.title || 'Collection'} <span className="x">✕</span>
              </span>
            )}
            {activeSubCat !== 'all' && (
              <span className="filter-tag" onClick={() => setActiveSubCat('all')}>
                {categories.find(c => c.id === activeSubCat)?.icon} {categories.find(c => c.id === activeSubCat)?.name || 'Sub-category'} <span className="x">✕</span>
              </span>
            )}
            {onlyDeals    && <span className="filter-tag" onClick={() => setOnlyDeals(false)}>🔥 Sale <span className="x">✕</span></span>}
            {onlyFreeDelivery && <span className="filter-tag" onClick={() => setOnlyFreeDelivery(false)}>🚚 Free Del. <span className="x">✕</span></span>}
            {onlyInStock  && <span className="filter-tag" onClick={() => setOnlyInStock(false)}>✅ In Stock <span className="x">✕</span></span>}
            {/* One combined chip instead of separate Min/Max — clears both at once, half the width */}
            {(minPrice !== '' || maxPrice !== '') && (
              <span className="filter-tag" onClick={() => { setMinPrice(''); setMaxPrice('') }}>
                Rs.{minPrice || 0}–{maxPrice || `${priceBounds[1]}+`} <span className="x">✕</span>
              </span>
            )}
            <button onClick={resetFilters} className="filter-tag" style={{ background: '#EF444410', color: '#EF4444', border: '1px solid #EF444440' }}>
              Clear All ({activeFilterCount})
            </button>
          </div>
        )}
      </div>{/* ── end filter bar ── */}

      {/* ══ CATEGORY CIRCLES — removed per request, was taking too much
          vertical space on first load. The category pills row in the
          filter bar below (All / Women's Fashion / etc) already covers
          the same navigation job in a single compact line. ══ */}

      {/* ══ DEAL BOXES — bundle deals, sorted with the same Price chips ═══ */}
      {dealsView && (
        <div className="px-2 pt-2 pb-6">
          {(() => {
            const activeDeals = dealBoxes.filter(d => d.active)
            const sorted = [...activeDeals].sort((a, b) => {
              if (sortBy === 'price_asc')  return (a.bundlePrice||0) - (b.bundlePrice||0)
              if (sortBy === 'price_desc') return (b.bundlePrice||0) - (a.bundlePrice||0)
              return (b.createdAt||0) - (a.createdAt||0) // newest first, default
            })
            if (sorted.length === 0) return (
              <div className="flex flex-col items-center py-16 gap-3">
                <div style={{ fontSize: 52 }}>🎁</div>
                <p className="font-bold text-base" style={{ color: 'var(--viro-text)' }}>No deals available right now</p>
                <p className="text-sm" style={{ color: 'var(--viro-textSub)' }}>Check back soon for bundle offers</p>
              </div>
            )
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-1.5 sm:gap-3">
                {sorted.map(deal => <DealCard key={deal.id} deal={deal} stockMap={dealStockMap} />)}
              </div>
            )
          })()}
        </div>
      )}

      {/* ══ PRODUCTS with infinite scroll ═══════════════════════════ */}
      {!dealsView && <div className="px-2 pt-1 pb-6">
        {loading ? (
          <div>
            {/* Animated loading banner */}
            <div style={{
              textAlign:'center', padding:'12px 0 16px',
              background:'linear-gradient(135deg,#7C3AED08,#4F46E508)',
              borderRadius:16, marginBottom:12,
              border:'1px solid #7C3AED15'
            }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                <div style={{ display:'flex', gap:4 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width:8, height:8, borderRadius:'50%',
                      background:'#7C3AED',
                      animation:`viro-bounce 1.2s ease-in-out ${i*0.2}s infinite`,
                    }}/>
                  ))}
                </div>
                <span style={{ fontSize:13, fontWeight:600, color:'var(--viro-textSub)' }}>Loading products...</span>
              </div>
            </div>
            <style>{`
              @keyframes viro-bounce {
                0%,80%,100%{transform:translateY(0);opacity:.4}
                40%{transform:translateY(-6px);opacity:1}
              }
              @keyframes viro-shimmer {
                0%{background-position:-400px 0}
                100%{background-position:400px 0}
              }
              .viro-skel {
                background: linear-gradient(90deg, var(--viro-bgDeep) 25%, var(--viro-border) 50%, var(--viro-bgDeep) 75%);
                background-size: 400px 100%;
                animation: viro-shimmer 1.4s ease-in-out infinite;
                border-radius: 8px;
              }
            `}</style>
            <div className={`grid gap-1.5 sm:gap-3 ${gridCols === 2 ? 'grid-cols-2 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
              {Array(gridCols === 2 ? 10 : 4).fill(0).map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden" style={{
                  background: 'var(--viro-productWhite)',
                  boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
                  opacity: 1 - i*0.06,
                  transform: `scale(${1 - i*0.005})`,
                  transformOrigin:'top center',
                }}>
                  <div className="viro-skel" style={{ paddingTop:'72%', borderRadius:0 }} />
                  <div className="p-3" style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <div className="viro-skel" style={{ height:14, width:'75%' }} />
                    <div className="viro-skel" style={{ height:11, width:'50%' }} />
                    <div style={{ display:'flex', gap:6, marginTop:2 }}>
                      <div className="viro-skel" style={{ height:13, width:'35%' }} />
                      <div className="viro-skel" style={{ height:13, width:'25%' }} />
                    </div>
                    <div className="viro-skel" style={{ height:34, width:'100%', borderRadius:10, marginTop:2 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div style={{ fontSize: 52 }}>🛍️</div>
            <p className="font-bold text-base" style={{ color: 'var(--viro-text)' }}>No products found</p>
            <p className="text-sm" style={{ color: 'var(--viro-textSub)' }}>Try adjusting filters or search</p>
            <button onClick={resetFilters} className="mt-1 px-6 py-2.5 rounded-full text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>Reset Filters</button>
          </div>
        ) : (
          <>
            {gridCols === 2 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-1.5 sm:gap-3">
                {filtered.slice(0, visibleCount).map((p, idx) => (
                  <React.Fragment key={p.id}>
                    {idx === tierBoundaryIdx && (
                      <div style={{ gridColumn: '1 / -1' }} className="flex items-center gap-2 py-2 mt-1">
                        <div style={{ flex: 1, height: 1, background: 'var(--viro-border)' }} />
                        <span className="text-xs font-bold px-2" style={{ color: 'var(--viro-textSub)' }}>Related results</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--viro-border)' }} />
                      </div>
                    )}
                    <ProductCard product={p} priority={idx < 2} />
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.slice(0, visibleCount).map((p, idx) => (
                  <React.Fragment key={p.id}>
                    {idx === tierBoundaryIdx && (
                      <div className="flex items-center gap-2 py-1">
                        <div style={{ flex: 1, height: 1, background: 'var(--viro-border)' }} />
                        <span className="text-xs font-bold px-2" style={{ color: 'var(--viro-textSub)' }}>Related results</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--viro-border)' }} />
                      </div>
                    )}
                    <ListCard product={p} priority={idx < 2} />
                  </React.Fragment>
                ))}
              </div>
            )}
            {/* Infinite scroll sentinel */}
            {visibleCount < filtered.length && (
              <div ref={sentinelRef} className="flex justify-center py-6">
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--viro-textSub)' }}>
                  <div className="w-4 h-4 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                  Loading more…
                </div>
              </div>
            )}
            {visibleCount >= filtered.length && filtered.length > 12 && (
              <p className="text-center text-xs py-4" style={{ color: 'var(--viro-textSub)' }}>
                ✅ All {filtered.length} products loaded
              </p>
            )}
          </>
        )}
      </div>}

      <RecentlyViewedProducts />

      <TestimonialsCarousel />

      {/* ══ FILTER DRAWER ═════════════════════════════════════════ */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[200]">
          <div className="drawer-bg absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', bottom: 60 }}
            onClick={() => setDrawerOpen(false)} />

          <div ref={drawerRef}
            className="drawer-panel absolute left-0 right-0 flex flex-col rounded-t-3xl overflow-hidden"
            style={{ background: 'var(--viro-bg)', maxHeight: 'calc(100vh - 90px)', bottom: 60, boxShadow: '0 -8px 40px rgba(0,0,0,0.4)' }}>

            <div className="flex justify-center pt-3 pb-1">
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--viro-border)' }} />
            </div>

            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--viro-border)' }}>
              <div>
                <h2 className="font-extrabold text-base" style={{ color: 'var(--viro-text)' }}>Filters</h2>
                {activeFilterCount > 0 && <p className="text-xs" style={{ color: '#A78BFA' }}>{activeFilterCount} active</p>}
              </div>
              <div className="flex items-center gap-3">
                {activeFilterCount > 0 && (
                  <button onClick={resetFilters} className="text-xs font-bold" style={{ color: '#EF4444' }}>Reset all</button>
                )}
                <button onClick={() => setDrawerOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--viro-bgCard)', color: 'var(--viro-textSub)', border: '1px solid var(--viro-border)' }}>✕</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Sort */}
              <div className="px-5 py-2.5" style={{ borderBottom: '1px solid var(--viro-border)' }}>
                <p className="text-xs font-extrabold uppercase tracking-widest mb-2" style={{ color: 'var(--viro-textSub)' }}>Sort By</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {SORT_OPTIONS.map(s => (
                    <button key={s.value} onClick={() => setSortBy(s.value)}
                      className="flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg font-bold text-center transition-all"
                      style={sortBy === s.value
                        ? { background: '#8B5CF6', color: '#fff', boxShadow: '0 2px 8px rgba(139,92,246,0.35)' }
                        : { background: 'var(--viro-bgCard)', color: 'var(--viro-textSub)', border: '1px solid var(--viro-border)' }}>
                      <span style={{ fontSize: 11 }}>{s.icon}</span>
                      <span style={{ fontSize: 9 }}>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Category in drawer — horizontal scroll row, active only */}
              {parentCats.filter(c => c._effectiveStatus === 'active').length > 0 && (
                <div className="py-2.5" style={{ borderBottom: '1px solid var(--viro-border)' }}>
                  <p className="text-xs font-extrabold uppercase tracking-widest mb-2 px-5" style={{ color: 'var(--viro-textSub)' }}>Category</p>
                  <div className="overflow-x-auto sb" style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 2 }}>
                    <div className="flex gap-2" style={{ width: 'max-content' }}>
                      {/* All button */}
                      <button onClick={() => { setActiveCat('all'); setActiveSubCat('all') }}
                        className="flex flex-col items-center gap-1 flex-shrink-0 transition-all active:scale-95"
                        style={{ background: 'none', border: 'none', padding: 0, width: 46 }}>
                        <div className="flex items-center justify-center"
                          style={{ width: 38, height: 38, borderRadius: '50%', fontSize: 17,
                            background: activeCat === 'all' ? '#8B5CF6' : 'var(--viro-bgCard)',
                            border: activeCat === 'all' ? '2px solid #8B5CF6' : '1.5px solid var(--viro-border)',
                            boxShadow: activeCat === 'all' ? '0 3px 10px rgba(139,92,246,0.4)' : 'none' }}>
                          🏷️
                        </div>
                        <span className="text-center font-bold" style={{ fontSize: 8.5, color: activeCat === 'all' ? '#8B5CF6' : 'var(--viro-text)', width: 46 }}>All</span>
                      </button>

                      {parentCats.filter(c => c._effectiveStatus === 'active').map(cat => {
                        const count = countForCat(cat.id)
                        const isOn = activeCat === cat.id
                        return (
                          <button key={cat.id} onClick={() => selectParentCat(cat.id)}
                            className="flex flex-col items-center gap-1 flex-shrink-0 transition-all active:scale-95"
                            style={{ background: 'none', border: 'none', padding: 0, width: 46, opacity: count ? 1 : 0.4 }}>
                            <div className="relative overflow-hidden"
                              style={{ width: 38, height: 38, borderRadius: '50%',
                                border: isOn ? '2px solid #8B5CF6' : '1.5px solid var(--viro-border)',
                                background: isOn ? '#8B5CF615' : 'var(--viro-bgCard)',
                                boxShadow: isOn ? '0 3px 10px rgba(139,92,246,0.35)' : '0 1px 4px rgba(0,0,0,0.08)' }}>
                              {cat.image_url
                                ? <Image src={cat.image_url} alt={cat.name} width={38} height={38} className="w-full h-full object-cover" style={{ objectFit:"cover" }} />
                                : <div className="w-full h-full flex items-center justify-center" style={{ fontSize: 17 }}>{cat.icon}</div>
                              }
                            </div>
                            <span className="text-center leading-tight line-clamp-2 font-semibold"
                              style={{ fontSize: 8.5, color: isOn ? '#8B5CF6' : 'var(--viro-text)', width: 46 }}>
                              {cat.name}
                              {count > 0 && <span style={{ color: isOn ? '#A78BFA' : 'var(--viro-textSub)', display: 'block', fontSize: 7.5 }}>{count}</span>}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {activeSubs.filter(c => c._effectiveStatus === 'active').length > 0 && (
                    <div>
                      <p className="text-xs font-bold mb-2" style={{ color: 'var(--viro-textSub)' }}>
                        {activeParent?.icon} {activeParent?.name} — Sub-categories
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setActiveSubCat('all')}
                          className="sub-pill" style={activeSubCat==='all'?{background:'#00BFFF',color:'#0B1221'}:{background:'var(--viro-bgCard)',color:'var(--viro-textSub)',border:'1.5px solid var(--viro-border)'}}>
                          All
                        </button>
                        {activeSubs.filter(c => c._effectiveStatus === 'active').map(sub => {
                          const cnt = products.filter(p => p.category_id === sub.id && isProductVisible(p)).length
                          if (!cnt) return null
                          return (
                            <button key={sub.id} onClick={() => setActiveSubCat(activeSubCat===sub.id?'all':sub.id)}
                              className="sub-pill" style={activeSubCat===sub.id?{background:'#00BFFF',color:'#0B1221'}:{background:'var(--viro-bgCard)',color:'var(--viro-textSub)',border:'1.5px solid var(--viro-border)'}}>
                              {sub.icon} {sub.name} ({cnt})
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Price range — drag either dot, or type an exact amount */}
              <div className="px-5 py-2.5" style={{ borderBottom: '1px solid var(--viro-border)' }}>
                <p className="text-xs font-extrabold uppercase tracking-widest mb-3" style={{ color: 'var(--viro-textSub)' }}>Price Range (Rs.)</p>
                <PriceRangeSlider bounds={priceBounds} minPrice={minPrice} maxPrice={maxPrice}
                  onChange={(mn, mx) => { setMinPrice(mn); setMaxPrice(mx) }} />
                <div className="grid grid-cols-2 gap-3 mt-3 mb-2.5">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--viro-textSub)' }}>Min</label>
                    <input type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)}
                      placeholder={`Rs. ${priceBounds[0]}`} min={0} style={{ borderRadius: 14, fontSize: 14 }} />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--viro-textSub)' }}>Max</label>
                    <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)}
                      placeholder="Any" min={0} style={{ borderRadius: 14, fontSize: 14 }} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[['Under 1k','','1000'],['1k–3k','1000','3000'],['3k–5k','3000','5000'],['5k+','5000','']].map(([lbl,mn,mx]) => (
                    <button key={lbl} onClick={() => { setMinPrice(mn); setMaxPrice(mx) }}
                      className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                      style={minPrice===mn&&maxPrice===mx
                        ? { background: '#8B5CF6', color: '#fff' }
                        : { background: 'var(--viro-bgCard)', color: 'var(--viro-textSub)', border: '1px solid var(--viro-border)' }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="px-5 py-2">
                <p className="text-xs font-extrabold uppercase tracking-widest mb-1" style={{ color: 'var(--viro-textSub)' }}>More</p>
                {[
                  { label: '🔥 On Sale Only', sub: 'Discounted products only', val: onlyDeals, set: setOnlyDeals, color: '#F97316' },
                  { label: '🚚 Free Delivery', sub: `Rs.${getFreeThreshold('') ?? '—'}+ qualifies`, val: onlyFreeDelivery, set: setOnlyFreeDelivery, color: '#10B981' },
                  { label: '✅ In Stock Only', sub: 'Hide sold-out items', val: onlyInStock, set: setOnlyInStock, color: '#10B981' },
                ].map(t => (
                  <div key={t.label} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--viro-border)' }}>
                    <div>
                      <p className="text-sm font-bold" style={{ color: 'var(--viro-text)' }}>{t.label}</p>
                      <p className="text-xs" style={{ color: 'var(--viro-textSub)' }}>{t.sub}</p>
                    </div>
                    <div className="toggle-track" onClick={() => t.set(v => !v)}
                      style={{ background: t.val ? t.color : 'var(--viro-border)' }}>
                      <div className="toggle-thumb" style={{ transform: t.val ? 'translateX(20px)' : 'translateX(0)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 pt-3 pb-3" style={{ borderTop: '1px solid var(--viro-border)' }}>
              <button onClick={() => setDrawerOpen(false)}
                className="w-full py-4 rounded-2xl font-extrabold text-base text-white"
                style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', boxShadow: '0 4px 16px rgba(139,92,246,0.35)' }}>
                ✓ Show {filtered.length} Result{filtered.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ShopClient({ initialProducts = [] }) {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--viro-sectionBg)' }} />}>
      <ShopInner initialProducts={initialProducts} />
    </Suspense>
  )
}