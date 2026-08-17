'use client'
import { supabase } from '../lib/supabase'
import { cacheGet, cacheSet } from '../lib/pageCache'
import { openWhatsApp } from '../lib/whatsapp'
import { useSite } from '../context/SiteSettingsContext'
import React, { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import ProductCard from '../components/ProductCard'
import HeroBanner from '../components/HeroBanner'
import TestimonialsCarousel from '../components/TestimonialsCarousel'
import RecentlyViewedProducts from '../components/RecentlyViewedProducts'

const FEATURES = [
  { icon:'🚀', title:'Fast Delivery',   sub:'All across Pakistan', color:'#00BFFF' },
  { icon:'✅', title:'Trusted Quality', sub:'Verified products',        color:'#10B981' },
  { icon:'💎', title:'Best Prices',     sub:'Affordable deals',         color:'#8B5CF6' },
  { icon:'🎧', title:'24/7 Support',    sub:'Always here for you',      color:'#F97316' },
]

// Same keyword-matching approach used in the side menu — gives Explore More
// tabs a relevant icon per label (Necklace Sets → 📿, Rings → 💍, …) instead
// of plain text pills, since admin-set tab labels don't carry icon data.
const TAB_ICON_KEYWORDS = [
  [/ring/i, '💍'], [/necklace/i, '📿'], [/earring|jhumki|stud/i, '💎'],
  [/bracelet|bangle|handcuff|kara|cuff/i, '⛓️'], [/pendant/i, '🔮'],
  [/hair|clip|scrunchie|headband|pin/i, '🎀'], [/makeup|cosmetic|lipstick|lip/i, '💄'],
  [/bag|clutch|purse|handbag/i, '👜'], [/watch/i, '⌚'], [/jewel/i, '✨'],
  [/dress|fashion|cloth|wear/i, '👗'], [/shoe|sandal|heel/i, '👠'],
  [/perfume|fragrance/i, '🌸'], [/sunglass|glass/i, '🕶️'], [/scarf|hijab/i, '🧣'],
]
function guessTabIcon(label) {
  const hit = TAB_ICON_KEYWORDS.find(([re]) => re.test(label || ''))
  return hit ? hit[1] : '🏷️'
}

const HomeBlock = React.memo(function HomeBlock({ block, allProducts }) {
  const scrollRef = useRef()
  const startSentinelRef = useRef()
  const endSentinelRef   = useRef()
  const [atStart, setAtStart] = useState(true)
  const [atEnd,   setAtEnd]   = useState(true) // true until proven scrollable — avoids a flash of "active" on rows that never overflow
  const products = (block.productIds || block.product_ids || [])
    .map(id => allProducts.find(p => p.id === id))
    .filter(Boolean)

  // BUGFIX: manually computing "are we at the start/end" from el.scrollLeft
  // math was unreliable — it depends on exactly when it's checked relative
  // to layout settling (fonts, image aspect-ratio boxes, scroll-snap taking
  // a frame to engage), and could read a stale value that never got
  // corrected, leaving the left arrow looking "active" even at the true
  // start. IntersectionObserver sidesteps all of that: it watches two 1px
  // sentinel elements at the very start/end of the row and fires whenever
  // they scroll into or out of view, automatically re-checking itself as
  // images load and the row's real width settles — no manual re-checks,
  // timers, or resize listeners needed.
  useEffect(() => {
    const container = scrollRef.current
    const startEl = startSentinelRef.current
    const endEl   = endSentinelRef.current
    if (!container || !startEl || !endEl) return

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === startEl) setAtStart(entry.isIntersecting)
        if (entry.target === endEl)   setAtEnd(entry.isIntersecting)
      }
    }, { root: container, threshold: 0.98 })

    observer.observe(startEl)
    observer.observe(endEl)
    return () => observer.disconnect()
  }, [products.length])

  if (products.length === 0) return null

  function scrollByAmount(dir) {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: 'smooth' })
  }

  return (
    <div className="mb-2">
      <div className="px-4 flex items-center justify-between mb-3">
        <div>
          <h2 className="font-display text-lg font-extrabold" style={{ color:'var(--viro-text)' }}>
            {block.title}
          </h2>
          {block.subtitle?.trim() && (
            <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>{block.subtitle}</p>
          )}
        </div>
        <Link href={block.viewAllUrl?.trim() || block.view_all_url?.trim() || '/shop'}
          className="text-xs font-bold px-3 py-1.5 rounded-xl flex-shrink-0"
          style={{ background:'#8B5CF620', color:'#A78BFA', border:'1px solid #8B5CF640' }}>
          View all →
        </Link>
      </div>
      <div ref={scrollRef} className="flex gap-2.5 overflow-x-auto px-4 pb-2"
        style={{ scrollSnapType:'x mandatory', WebkitOverflowScrolling:'touch', scrollbarWidth:'none', msOverflowStyle:'none' }}>
        {/* Sentinels — zero-width, purely for the IntersectionObserver above */}
        <div ref={startSentinelRef} style={{ width:1, flexShrink:0 }} aria-hidden="true" />
        {products.map(p => (
          <div key={p.id} style={{ minWidth: 152, maxWidth: 152, scrollSnapAlign:'start', flexShrink: 0 }}>
            <ProductCard product={p} compact />
          </div>
        ))}
        <div ref={endSentinelRef} style={{ width:1, flexShrink:0 }} aria-hidden="true" />
      </div>

      {/* Prev/Next — below the strip. Colourful gradient pills so they
          catch the eye; the side with nothing further to scroll to drops
          to a plain, unmistakable grey (not a themed CSS var, so it can't
          accidentally read as "still colourful" in any theme) so it's
          obvious there's nothing behind/ahead on that side. */}
      <div className="flex items-center justify-center gap-3 px-4 mt-1">
        <button onClick={() => scrollByAmount(-1)} disabled={atStart} aria-label="Scroll left"
          style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0, border: 'none',
            background: atStart ? '#CBD5E1' : 'linear-gradient(135deg,#00BFFF,#8B5CF6)',
            color: atStart ? '#94A3B8' : '#fff',
            cursor: atStart ? 'default' : 'pointer',
            opacity: atStart ? 0.55 : 1,
            boxShadow: atStart ? 'none' : '0 3px 10px rgba(139,92,246,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700,
            transition: 'opacity 0.15s, box-shadow 0.15s, background 0.15s',
          }}>‹</button>
        <button onClick={() => scrollByAmount(1)} disabled={atEnd} aria-label="Scroll right"
          style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0, border: 'none',
            background: atEnd ? '#CBD5E1' : 'linear-gradient(135deg,#8B5CF6,#F97316)',
            color: atEnd ? '#94A3B8' : '#fff',
            cursor: atEnd ? 'default' : 'pointer',
            opacity: atEnd ? 0.55 : 1,
            boxShadow: atEnd ? 'none' : '0 3px 10px rgba(249,115,22,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700,
            transition: 'opacity 0.15s, box-shadow 0.15s, background 0.15s',
          }}>›</button>
        </div>
    </div>
  )
})

/**
 * "Explore More"-style tab group: a horizontally-scrollable row of category
 * tabs (Jewelry Set / Choker / Necklace / …) — tapping one switches which
 * curated product row shows underneath. Each tab's content is just an
 * existing Product Block's product list, so the same admin curation (Smart
 * Auto-Fill, drag reorder) already used elsewhere powers this too.
 */
const HomeTabGroup = React.memo(function HomeTabGroup({ block, allProducts, homeBlocks }) {
  const tabs = (block.tabs || []).filter(t => homeBlocks.find(b => b.id === t.sourceBlockId))
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id || null)
  const scrollRef = useRef()
  const startSentinelRef = useRef()
  const endSentinelRef = useRef()
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0]
  const sourceBlock = activeTab ? homeBlocks.find(b => b.id === activeTab.sourceBlockId) : null
  const products = sourceBlock
    ? (sourceBlock.productIds || sourceBlock.product_ids || []).map(id => allProducts.find(p => p.id === id)).filter(Boolean)
    : []

  useEffect(() => {
    const container = scrollRef.current
    const startEl = startSentinelRef.current
    const endEl = endSentinelRef.current
    if (!container || !startEl || !endEl) return
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === startEl) setAtStart(entry.isIntersecting)
        if (entry.target === endEl) setAtEnd(entry.isIntersecting)
      }
    }, { root: container, threshold: 0.98 })
    observer.observe(startEl); observer.observe(endEl)
    return () => observer.disconnect()
  }, [products.length])

  if (tabs.length === 0) return null

  function scrollByAmount(dir) {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: 'smooth' })
  }

  return (
    <div className="mb-4">
      {(block.title?.trim() || block.subtitle?.trim()) && (
        <div className="px-4 mb-3 text-center">
          {block.title?.trim() && (
            <h2 className="font-display text-lg font-extrabold tracking-wide" style={{ color:'var(--viro-text)' }}>
              {block.title}
            </h2>
          )}
          {block.subtitle?.trim() && (
            <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>{block.subtitle}</p>
          )}
        </div>
      )}

      {/* Tab bar — wrapped in its own card instead of sitting directly on
          the page background, so it reads as a distinct module rather than
          bare pills floating on white. X-axis scroll for many tabs. */}
      <div className="mx-4 mb-3 rounded-2xl px-3 py-2.5"
        style={{ background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)' }}>
        <div className="flex gap-1.5 overflow-x-auto"
          style={{ scrollbarWidth:'none', msOverflowStyle:'none', WebkitOverflowScrolling:'touch' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTabId(t.id)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all"
              style={t.id === (activeTab?.id)
                ? { background:'linear-gradient(135deg,#8B5CF6,#F97316)', color:'#fff', boxShadow:'0 2px 8px rgba(139,92,246,0.35)' }
                : { background:'#8B5CF60d', color:'#7C3AED', border:'1px solid #8B5CF630' }}>
              <span>{guessTabIcon(t.label)}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {products.length === 0 ? null : (
        <>
          <div ref={scrollRef} className="flex gap-2.5 overflow-x-auto px-4 pb-2"
            style={{ scrollSnapType:'x mandatory', WebkitOverflowScrolling:'touch', scrollbarWidth:'none', msOverflowStyle:'none' }}>
            <div ref={startSentinelRef} style={{ width:1, flexShrink:0 }} aria-hidden="true" />
            {products.map(p => (
              <div key={p.id} style={{ minWidth: 152, maxWidth: 152, scrollSnapAlign:'start', flexShrink: 0 }}>
                <ProductCard product={p} compact />
              </div>
            ))}
            <div ref={endSentinelRef} style={{ width:1, flexShrink:0 }} aria-hidden="true" />
          </div>

          <div className="flex items-center justify-center gap-3 px-4 mt-1 mb-2">
            <button onClick={() => scrollByAmount(-1)} disabled={atStart} aria-label="Scroll left"
              style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0, border: 'none',
                background: atStart ? '#CBD5E1' : 'linear-gradient(135deg,#00BFFF,#8B5CF6)',
                color: atStart ? '#94A3B8' : '#fff', cursor: atStart ? 'default' : 'pointer',
                opacity: atStart ? 0.55 : 1, boxShadow: atStart ? 'none' : '0 3px 10px rgba(139,92,246,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700,
                transition: 'opacity 0.15s, box-shadow 0.15s, background 0.15s',
              }}>‹</button>
            <Link href={sourceBlock?.viewAllUrl?.trim() || sourceBlock?.view_all_url?.trim() || '/shop'}
              className="text-xs font-bold px-3 py-1.5 rounded-xl flex-shrink-0"
              style={{ background:'#8B5CF620', color:'#A78BFA', border:'1px solid #8B5CF640' }}>
              View all →
            </Link>
            <button onClick={() => scrollByAmount(1)} disabled={atEnd} aria-label="Scroll right"
              style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0, border: 'none',
                background: atEnd ? '#CBD5E1' : 'linear-gradient(135deg,#8B5CF6,#F97316)',
                color: atEnd ? '#94A3B8' : '#fff', cursor: atEnd ? 'default' : 'pointer',
                opacity: atEnd ? 0.55 : 1, boxShadow: atEnd ? 'none' : '0 3px 10px rgba(249,115,22,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700,
                transition: 'opacity 0.15s, box-shadow 0.15s, background 0.15s',
              }}>›</button>
          </div>
        </>
      )}
    </div>
  )
})

function BlockSkeleton() {
  return (
    <div className="mb-6 px-4">
      <div className="skeleton h-5 w-36 rounded mb-1" />
      <div className="skeleton h-3 w-48 rounded mb-3" />
      <div className="flex gap-3 overflow-hidden">
        {Array(4).fill(0).map((_,i) => (
          <div key={i} className="rounded-2xl overflow-hidden" style={{ background:'var(--viro-productWhite)', minWidth:180, flexShrink:0 }}>
            <div style={{ paddingTop:'66%' }} className="skeleton" />
            <div className="p-3 space-y-2">
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-3 w-1/2 rounded" />
              <div className="skeleton h-8 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HomeClient({ initialProducts = [] }) {
  const { hotAds, homeBlocks, contact, hideOutOfStock, loaded: siteLoaded } = useSite()
  const [products, setProducts]       = useState(initialProducts)
  const [loading,  setLoading]        = useState(initialProducts.length === 0)
  const [visibleCount, setVisibleCount] = useState(8)
  const sentinelRef = useRef()

  useEffect(() => {
    const CACHE_KEY = '/'

    const load = async () => {
      // ── Check client-side cache first ──────────────────────────────────────
      // If user navigated away and came back within 5 min, use cached data.
      // This makes Home feel instant on back navigation — no Supabase call needed.
      const cached = cacheGet(CACHE_KEY)
      if (cached?.data?.products) {
        setProducts(cached.data.products)
        setLoading(false)
        return
      }

      if (!supabase) return
      try {
        const [{ data, error }, ratingsResult] = await Promise.all([
          supabase.from('products')
            .select('*, categories(id,name,icon)')
            .or('is_active.eq.true,status.eq.coming_soon')
            .order('display_order', { ascending: true, nullsFirst: false })
            .limit(200),
          supabase.from('product_ratings').select('product_id,avg_rating,review_count')
            .then(res => res).catch(() => ({ data: null })),
        ])
        if (error) { console.error('[HomeClient] products fetch error:', error.message); setLoading(false); return }
        if (data) {
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
          const finalProducts = data.map(p => ({ ...p, ...(rMap[p.id] || {}) }))
          setProducts(finalProducts)
          // ── Save to cache so back navigation is instant ──────────────────
          cacheSet(CACHE_KEY, { products: finalProducts })
        }
      } catch (e) {
        console.error('[HomeClient] load error:', e.message)
        // Show stale cache on network error rather than nothing
        const stale = cacheGet(CACHE_KEY)
        if (stale?.data?.products?.length > 0) {
          setProducts(stale.data.products)
        }
        setLoading(false)
        // Retry once silently after 3s
        if (!load._retried) {
          load._retried = true
          setTimeout(() => load(), 3000)
          return
        }
      }
      setLoading(false)
    }

    // If SSR gave us products, cache them immediately for back navigation
    if (initialProducts.length > 0) {
      cacheSet(CACHE_KEY, { products: initialProducts })
      setLoading(false)
    } else {
      load()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sentinelRef.current) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setVisibleCount(n => n + 8)
    }, { threshold: 0.1 })
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [products.length])

  const hasBlocks = Array.isArray(homeBlocks) && homeBlocks.some(b =>
    b.enabled && (b.type === 'tabs' ? (b.tabs||[]).length > 0 : (b.productIds||b.product_ids||[]).length > 0)
  )

  return (
    <div className="pb-4" style={{ background:'var(--viro-sectionBg)', minHeight:'100vh', transition:'background 0.35s' }}>
      <div className="md:max-w-5xl md:mx-auto">
        <HeroBanner />

        {/* ── Sale banner — after the hero, right before the product blocks ── */}
        {hotAds?.enabled && hotAds?.title?.trim() && (
          <div className="mx-4 mt-4 mb-3 rounded-xl overflow-hidden relative"
            style={{ background:'linear-gradient(135deg,#F97316,#EF4444,#F59E0B)', boxShadow:'0 2px 10px #F9731640' }}>
            <div className="flex items-center gap-2 px-4" style={{ height: 42 }}>
              <span className="text-sm flex-shrink-0 animate-bounce">🔥</span>
              <p className="font-extrabold text-white text-xs tracking-wide flex-1 leading-snug truncate">{hotAds.title}</p>
              <span className="text-white text-sm flex-shrink-0 opacity-60">🔥</span>
            </div>
            <div style={{
              position:'absolute', top:0, left:0, right:0, bottom:0,
              background:'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.15) 50%,transparent 100%)',
              animation:'shimmer-sweep 2.4s linear infinite', pointerEvents:'none',
            }} />
          </div>
        )}

        {/* Breathing room so the first product row doesn't sit flush against
            the hero/banner — was reading as cramped/no-space before. */}
        <div className={hotAds?.enabled && hotAds?.title?.trim() ? '' : 'mt-4'}>
        {/* ── Products section — right after the hero, before the feature
            cards, so Meta-ads visitors with buying intent see actual
            products within one swipe instead of scrolling past promo
            content first.
            Show skeletons until BOTH products AND site settings are ready.
            Without siteLoaded check: SSR products arrive instantly (loading=false),
            homeBlocks is still [] → falls to grid → blocks load → but React already
            committed the grid render and won't switch to blocks cleanly.
        */}
        {(loading || !siteLoaded) ? (
          <><BlockSkeleton /><BlockSkeleton /></>
        ) : products.length === 0 ? (
          <div className="text-center py-12 px-4" style={{ color:'var(--viro-textSub)' }}>
            <div className="text-5xl mb-3">📦</div>
            <p className="font-bold" style={{ color:'var(--viro-text)' }}>No products yet</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        ) : hasBlocks ? (
          /* Admin has configured blocks — show them */
          homeBlocks
            .filter(b => b.enabled && (b.type === 'tabs' ? (b.tabs||[]).length > 0 : (b.productIds||b.product_ids||[]).length > 0))
            .map(block => block.type === 'tabs'
              ? <HomeTabGroup key={block.id} block={block} allProducts={products} homeBlocks={homeBlocks} />
              : <HomeBlock key={block.id} block={block} allProducts={products} />
            )
        ) : (
          /* No blocks configured — show flat grid of all products */
          <div className="px-2 mb-6">
            <div className="flex items-center justify-between mb-4 px-2">
              <div>
                <h2 className="font-display text-lg font-extrabold" style={{ color:'var(--viro-text)' }}>Latest Products</h2>
                <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>Fresh arrivals just for you</p>
              </div>
              <Link href="/shop"
                className="text-xs font-bold px-3 py-1.5 rounded-xl"
                style={{ background:'#8B5CF620', color:'#A78BFA', border:'1px solid #8B5CF640' }}>
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {((hideOutOfStock && siteLoaded) ? (products.filter(p=>(p.stock??999)>0&&p.status!=='out_of_stock')||products) : products).slice(0, visibleCount).map(p => <ProductCard key={p.id} product={p} />)}
            </div>
            {visibleCount < products.length && (
              <div ref={sentinelRef} className="flex justify-center py-4">
                <div className="flex items-center gap-2 text-sm" style={{ color:'var(--viro-textSub)' }}>
                  <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor:'#8B5CF6', borderTopColor:'transparent' }} />
                  Loading more…
                </div>
              </div>
            )}
          </div>
        )}
        </div>

        <RecentlyViewedProducts />

        {/* ── Feature cards ── */}
        <div className="px-4 mb-5">
          <div className="grid grid-cols-2 gap-2.5">
            {FEATURES.map(f => (
              <div key={f.title} className="flex items-center gap-2.5 px-3 py-3 rounded-xl"
                style={{ background:'var(--viro-featureBg)', border:'1px solid var(--viro-featureBorder)', transition:'background 0.35s, border-color 0.35s' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                  style={{ background: f.color+'20', border:`1px solid ${f.color}40` }}>
                  {f.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold leading-snug" style={{ color:'var(--viro-text)' }}>{f.title}</p>
                  <p className="text-xs leading-snug" style={{ color:'var(--viro-textMuted)' }}>{f.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>


        <div className="px-4 mb-6">
          <div className="rounded-2xl p-5 text-center relative overflow-hidden flex flex-col items-center justify-center"
              style={{ background:'linear-gradient(135deg,#00BFFF15,#8B5CF625,#F9731615)', border:'1px solid #8B5CF640' }}>
              <p className="text-xs font-bold mb-1" style={{ color:'#A78BFA' }}>🎉 Pakistan-wide Delivery</p>
              <h3 className="font-display text-lg font-extrabold mb-1" style={{ color:'var(--viro-text)' }}>Shop with Confidence</h3>
              <p className="text-xs mb-4" style={{ color:'var(--viro-textMuted)' }}>Trusted by customers across Punjab &amp; Pakistan</p>
              <div className="flex gap-3 justify-center">
                <Link href="/shop"
                  className="px-5 py-2.5 rounded-xl font-bold text-sm text-white"
                  style={{ background:'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)' }}>
                  🛍️ Shop Now
                </Link>
                <button type="button"
                  onClick={() => { openWhatsApp('Hi Viro! I need assistance.', contact?.whatsapp); import('../lib/metaEvents').then(m => m.trackContact('whatsapp_home_support')).catch(() => {}) }}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm text-white"
                  style={{ background:'linear-gradient(135deg,#25D366,#128C7E)' }}>
                  💬 WhatsApp
                </button>
              </div>

              {/* Quick filters — tap one and land straight on Shop with that
                  filter already applied (Shop reads these from the URL). */}
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                <Link href="/shop?freeDelivery=1"
                  className="text-xs font-bold px-3 py-1.5 rounded-full"
                  style={{ background:'#10B98118', color:'#10B981', border:'1px solid #10B98140' }}>
                  🚚 Free Delivery
                </Link>
                <Link href="/shop?deals=1"
                  className="text-xs font-bold px-3 py-1.5 rounded-full"
                  style={{ background:'#F9731618', color:'#F97316', border:'1px solid #F9731640' }}>
                  🔥 On Sale
                </Link>
                <Link href="/shop?sort=top_rated"
                  className="text-xs font-bold px-3 py-1.5 rounded-full"
                  style={{ background:'#FACC1518', color:'#CA8A04', border:'1px solid #FACC1540' }}>
                  ⭐ Top Rated
                </Link>
                <Link href="/shop?max=1000"
                  className="text-xs font-bold px-3 py-1.5 rounded-full"
                  style={{ background:'#8B5CF618', color:'#8B5CF6', border:'1px solid #8B5CF640' }}>
                  💎 Under Rs.1000
                </Link>
              </div>
          </div>
        </div>

        <div className="px-4 mb-6">
          <div className="rounded-2xl overflow-hidden" style={{ background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)' }}>
            <div className="px-4 pt-4 pb-2 border-b" style={{ borderColor:'var(--viro-border)' }}>
              <h3 className="font-bold text-sm flex items-center gap-2" style={{ color:'var(--viro-text)' }}>
                <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs"
                  style={{ background:'linear-gradient(135deg,#8B5CF6,#F97316)' }}>✓</span>
                Why Choose Viro
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-px" style={{ background:'var(--viro-border)' }}>
              {[
                { icon:'🔒', title:'Safe Shopping',     sub:'Secure checkout, no data shared',    color:'#10B981' },
                { icon:'📦', title:'Easy Returns',      sub:'Simple process, no questions asked', color:'#00BFFF' },
                { icon:'💳', title:'Cash on Delivery',  sub:'Pay only when order arrives',        color:'#F97316' },
                { icon:'⭐', title:'Verified Reviews',  sub:'Real buyers, honest feedback',       color:'#F59E0B' },
                { icon:'🚀', title:'Same-Day Dispatch', sub:'Orders confirmed before 4 PM',       color:'#8B5CF6' },
                { icon:'🤝', title:'Live Support',      sub:'WhatsApp & call, 7 days a week',     color:'#EC4899' },
              ].map(b => (
                <div key={b.title} className="flex items-start gap-3 p-3.5" style={{ background:'var(--viro-bgCard)' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: b.color+'18', border:`1px solid ${b.color}35` }}>
                    {b.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold leading-tight" style={{ color:'var(--viro-text)' }}>{b.title}</p>
                    <p className="text-xs mt-0.5 leading-tight" style={{ color:'var(--viro-textMuted)' }}>{b.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <TestimonialsCarousel />
      </div>
    </div>
  )
}
