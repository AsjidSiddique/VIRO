'use client'
import { supabase } from '../lib/supabase'
import Image from 'next/image'
import Link from 'next/link'
import { createPortal } from 'react-dom'
// ── ProductReviews.jsx ─────────────────────────────────────────
// v46 — Full review system:
//   • ProductReviews: animated reviews display on ProductDetail
//   • LeaveReview: post-delivery review form in Orders page
//   • Stars: reusable star widget
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useSite } from '../context/SiteSettingsContext'

// ── Star renderer ─────────────────────────────────────────────
export function Stars({ rating, size = 16, interactive = false, onChange }) {
  const [hovered, setHovered] = useState(0)

  // Non-interactive: render precise half-star fills for decimal ratings (e.g. 4.3)
  if (!interactive) {
    const val = Number(rating) || 0
    return (
      <div style={{ display:'flex', gap:1, flexShrink:0 }}>
        {[1,2,3,4,5].map(n => {
          const filled = val >= n ? 1 : val >= n - 0.5 ? 0.5 : 0
          const uid = `star-${size}-${n}-${Math.round(val*10)}`
          return (
            <span key={n} style={{ position:'relative', display:'inline-block', fontSize:size, lineHeight:1, userSelect:'none' }}>
              {/* background (empty) star */}
              <span style={{ color:'#D1D5DB' }}>★</span>
              {/* filled overlay — width 100% full, 50% half, 0% empty */}
              {filled > 0 && (
                <span style={{
                  position:'absolute', left:0, top:0,
                  overflow:'hidden',
                  width: filled === 1 ? '100%' : '52%',
                  color:'#FBBF24',
                  whiteSpace:'nowrap',
                }}>★</span>
              )}
            </span>
          )
        })}
      </div>
    )
  }

  // Interactive: whole-star click picker (for writing reviews)
  return (
    <div style={{ display:'flex', gap:2, flexShrink:0 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n}
          onClick={(e) => { e.stopPropagation(); onChange?.(n) }}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          style={{
            fontSize: size,
            cursor: 'pointer',
            color: n <= (hovered || rating) ? '#FBBF24' : '#D1D5DB',
            transition: 'color 0.1s, transform 0.1s',
            transform: hovered >= n ? 'scale(1.2)' : 'scale(1)',
            display: 'inline-block',
            userSelect: 'none',
          }}>★</span>
      ))}
    </div>
  )
}

// ── Rating distribution bar ───────────────────────────────────
function RatingBar({ value, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
      <span style={{ fontSize:12, color:'#FBBF24', fontWeight:700, width:10, textAlign:'right', flexShrink:0 }}>{value}</span>
      <span style={{ fontSize:11, color:'#FBBF24', flexShrink:0 }}>★</span>
      <div style={{ flex:1, height:8, borderRadius:4, background:'var(--viro-border)', overflow:'hidden' }}>
        <div style={{
          width:`${pct}%`, height:'100%', borderRadius:4,
          background: pct > 0 ? 'linear-gradient(90deg,#FBBF24,#F59E0B)' : 'transparent',
          transition:'width 0.5s ease',
        }} />
      </div>
      <span style={{ fontSize:11, color:'var(--viro-textSub)', width:24, textAlign:'right', flexShrink:0 }}>{count}</span>
    </div>
  )
}

// Groups reviews by name, then round-robin-interleaves across those
// groups — so a customer who happened to leave several reviews around
// the same time doesn't dominate a run of consecutive cards. Keeps the
// strip reading as "lots of different people", which is the whole point
// of a social-proof section.
function interleaveByName(reviews) {
  const groups = new Map()
  for (const r of reviews) {
    const key = r.name || 'Verified Customer'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  }
  const buckets = [...groups.values()]
  const result = []
  let i = 0
  while (result.length < reviews.length) {
    const bucket = buckets[i % buckets.length]
    if (bucket.length) result.push(bucket.shift())
    i++
  }
  return result
}

// Drives a horizontal review strip with real native scrolling instead
// of a CSS transform animation. The old approach (CSS @keyframes +
// overflow-x:auto layered on top for touch) only ever moved one
// direction and only had two copies of the list — drag it far enough
// either way and you'd hit genuine empty space, which is exactly what
// showed up as a blank strip. This drives scrollLeft directly: three
// copies of the list, starting in the middle copy, and the instant the
// scroll position nears either edge it silently jumps by exactly one
// copy-width to the equivalent spot in the next copy over — imperceptible,
// since every copy is identical, but it means there's no direction and
// no distance that ever runs out. Touching the strip pauses the
// auto-increment and hands off to completely normal native scrolling
// (which was always bidirectional); releasing resumes auto-scroll from
// wherever it was left.
function useInfiniteAutoScroll(ref, active, pxPerSecond = 28) {
  useEffect(() => {
    if (!active) return
    const el = ref.current
    if (!el) return

    let raf = null
    let last = null
    let paused = false
    let initialized = false

    function frame(now) {
      if (!el.isConnected) return
      if (!initialized) {
        if (el.scrollWidth > el.clientWidth) {
          el.scrollLeft = el.scrollWidth / 3 // start in the middle copy
          initialized = true
          last = now
        }
        raf = requestAnimationFrame(frame)
        return
      }
      const dt = last == null ? 0 : now - last
      last = now
      if (!paused && dt > 0 && dt < 250) {
        el.scrollLeft += (pxPerSecond * dt) / 1000
        const setWidth = el.scrollWidth / 3
        if (setWidth > 0) {
          if (el.scrollLeft >= setWidth * 2) el.scrollLeft -= setWidth
          else if (el.scrollLeft <= 0) el.scrollLeft += setWidth
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const pause  = () => { paused = true }
    const resume = () => { paused = false; last = null }
    el.addEventListener('mouseenter', pause)
    el.addEventListener('mouseleave', resume)
    el.addEventListener('touchstart', pause, { passive: true })
    el.addEventListener('touchend', resume)
    el.addEventListener('touchcancel', resume)
    el.addEventListener('pointerdown', pause)
    el.addEventListener('pointerup', resume)
    el.addEventListener('pointercancel', resume)
    el.addEventListener('pointerleave', resume)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      el.removeEventListener('mouseenter', pause)
      el.removeEventListener('mouseleave', resume)
      el.removeEventListener('touchstart', pause)
      el.removeEventListener('touchend', resume)
      el.removeEventListener('touchcancel', resume)
      el.removeEventListener('pointerdown', pause)
      el.removeEventListener('pointerup', resume)
      el.removeEventListener('pointercancel', resume)
      el.removeEventListener('pointerleave', resume)
    }
  }, [ref, active, pxPerSecond])
}

// ── Card body for a review pulled from elsewhere in the store (used in
// the "More Viro.pk Customers" strip below) — shows which product it
// was actually about, or a general-customer label for admin's storewide
// entries, and fits any attached screenshot in full rather than cropping
// it to a fixed short strip. ─────────────────────────────────────────
function GlobalReviewCard({ r, onImageClick }) {
  const productImgs = Array.isArray(r.products?.images) ? r.products.images
    : (() => { try { return JSON.parse(r.products?.images || '[]') } catch { return [] } })()
  const thumb = productImgs[0]

  return (
    <>
      <Stars rating={r.rating} size={12} />
      {r.comment && (
        <p style={{ fontSize:11.5, color:'var(--viro-text)', margin:'4px 0 0', lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
          {r.comment}
        </p>
      )}
      {r.screenshot_url && (
        <div onClick={() => onImageClick?.(r.screenshot_url)}
          style={{ marginTop:6, borderRadius:8, overflow:'hidden', background:'var(--viro-bg)', border:'1px solid var(--viro-border)', cursor: onImageClick ? 'zoom-in' : 'default' }}>
          <img src={r.screenshot_url} alt="Customer screenshot" loading="lazy"
            style={{ width:'100%', maxHeight:190, objectFit:'contain', display:'block' }} />
        </div>
      )}
      {r.products?.id ? (
        <Link href={`/product/${r.products.id}`}
          style={{ display:'flex', alignItems:'center', gap:6, marginTop:8, paddingTop:8, borderTop:'1px solid var(--viro-border)', textDecoration:'none' }}>
          {thumb && (
            <img src={thumb} alt="" loading="lazy"
              style={{ width:22, height:22, borderRadius:5, objectFit:'cover', flexShrink:0 }}
              onError={e => { e.target.style.display = 'none' }} />
          )}
          <div style={{ minWidth:0 }}>
            <p style={{ fontSize:10, fontWeight:700, color:'var(--viro-textSub)', margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {r.name || 'Verified Customer'}
            </p>
            <p style={{ fontSize:9.5, color:'var(--viro-textSub)', opacity:0.75, margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              on {r.products.name}
            </p>
          </div>
        </Link>
      ) : (
        <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid var(--viro-border)' }}>
          <p style={{ fontSize:10, fontWeight:700, color:'var(--viro-textSub)', margin:0 }}>
            {r.name || 'Verified Customer'}
          </p>
        </div>
      )}
    </>
  )
}

// Renders one horizontal, always-moving strip via useInfiniteAutoScroll
// (see above) — never stacks vertically: with tall screenshot cards, a
// vertical stack of even 2 of them ate up huge amounts of page height.
// alignItems:'flex-start' stops cards stretching to match whichever one
// in the row is tallest.
function ReviewMarqueeRow({ items, onImageClick }) {
  const scrollRef = useRef(null)
  useInfiniteAutoScroll(scrollRef, items.length > 0)
  if (items.length === 0) return null
  const track = [...items, ...items, ...items]

  return (
    <div
      ref={scrollRef}
      className="scrollbar-hide"
      style={{
        overflowX: 'auto', margin: '0 -16px',
        WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)',
        maskImage: 'linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)',
      }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: 'max-content', padding: '0 16px' }}>
        {track.map((r, i) => (
          <div key={`${r.id}-${i}`} style={{ width: 200, flexShrink: 0, padding: '10px 12px', borderRadius: 12, background: 'var(--viro-bgDeep)', border: '1px solid var(--viro-border)' }}>
            <GlobalReviewCard r={r} onImageClick={onImageClick} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main reviews component (animated strip, no pagination) ────
export function ProductReviews({ productId, productReviewsEnabled = true }) {
  const { reviewsEnabled } = useSite()
  const [all,        setAll]        = useState([]) // "Customer Reviews" below — general/store reviews (product_id IS NULL), same set on every product page, not this product's own
  const [globalReviews, setGlobalReviews] = useState([]) // "More Viro.pk Customers" further down — other individual products' own reviews (kept distinct from `all` so nothing repeats on the page)
  const [siteStats,  setSiteStats]  = useState({ avg: 0, count: 0 }) // sitewide rating avg/count for the "Let customers speak for us" header — same figures Home/Shop show, so it reads consistently everywhere
  const [loading,    setLoading]    = useState(true)
  const [lightbox,   setLightbox]   = useState(null) // screenshot URL currently shown full-size, or null
  const topMarqueeRef = useRef(null)
  // Tripling 3-5 reviews for the infinite-scroll loop meant the same
  // handful of cards reappeared almost immediately — with too little
  // unique content, the "seamless loop" just reads as duplicated cards.
  // Below this count, show the set once (still horizontally
  // swipeable, just not auto-scrolling or repeated).
  const enoughToLoop = all.length >= 6
  useInfiniteAutoScroll(topMarqueeRef, enoughToLoop)

  const load = useCallback(async () => {
    if (!productId) return
    setLoading(true)
    // "Customer Reviews" now intentionally shows the store's general
    // reviews (product_id IS NULL — the same admin-curated pool, shown
    // identically on every product) rather than this specific product's
    // own reviews. A lightly-reviewed product used to look sparse next to
    // a bestseller; now every product page shows the same full, healthy
    // set. `.limit(30)` keeps this bounded — this pool only grows over
    // time (unlike a single product's own review count), and the strip
    // below renders 3 copies of it for the infinite-scroll effect.
    const { data } = await supabase
      .from('reviews')
      // BUGFIX (kept from the earlier fix): was selecting title/body/
      // reviewer_name — none of those columns exist (schema has
      // name/comment, no title at all). Aliased back to the same names
      // the rest of this file already reads.
      .select('id,rating,created_at,screenshot_url,source,reviewer_name:name,body:comment')
      .is('product_id', null)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(30)
    setAll(data || [])
    setLoading(false)

    // Two fetches in parallel: reviews belonging to OTHER specific
    // products (general/null ones are already covered by `all` above, so
    // excluding them here keeps the "More Viro.pk Customers" strip from
    // just repeating the same cards a second time), and the sitewide
    // rating avg/count for the "Let customers speak for us" header (same
    // query TestimonialsCarousel uses, so it reads identically whether
    // someone's on Home, Shop, or here). Run together rather than
    // sequentially so both land in the same render — otherwise the
    // header could briefly flash "from 0 reviews" while globalReviews
    // had already arrived but siteStats hadn't caught up yet.
    const [globalRes, statsRes] = await Promise.all([
      supabase
        .from('reviews')
        .select('id,product_id,rating,created_at,screenshot_url,source,name,comment,products(id,name,images)')
        .eq('status', 'approved')
        .neq('product_id', productId) // SQL <> excludes NULLs automatically, so this is "other real products only"
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('reviews')
        .select('rating')
        .eq('status', 'approved')
        .limit(40),
    ])
    setGlobalReviews(globalRes.data || [])
    const statsData = statsRes.data
    if (statsData && statsData.length > 0) {
      const sum = statsData.reduce((s, r) => s + Number(r.rating || 0), 0)
      setSiteStats({ avg: sum / statsData.length, count: statsData.length })
    }
  }, [productId])

  useEffect(() => { load() }, [load])

  if (!reviewsEnabled || !productReviewsEnabled) return null

  const total  = all.length
  const avg    = total > 0 ? (all.reduce((s,r) => s + r.rating, 0) / total) : 0
  const avgStr = avg > 0 ? avg.toFixed(1) : null
  const dist   = [5,4,3,2,1].map(v => ({ value:v, count: all.filter(r => r.rating === v).length }))

  // "More Viro.pk Customers" data: every approved review from OTHER
  // individual products (rating-only ones included now — with the
  // row-stretch bug fixed, a compact card with just a rating no longer
  // looks broken next to a richer one), split into admin-shared photo
  // proof vs. reviews written directly on the site, each interleaved so
  // one prolific reviewer doesn't fill several slots in a row.
  const socialGlobal = interleaveByName(globalReviews.filter(r => r.source === 'screenshot'))
  const webGlobal    = interleaveByName(globalReviews.filter(r => r.source !== 'screenshot'))

  return (
    <>
    <div style={{ borderRadius:16, overflow:'hidden', border:'1px solid var(--viro-border)', background:'var(--viro-bgCard)' }}>

      {/* ── Header ── */}
      <div style={{
        padding:'18px 16px',
        background:'linear-gradient(135deg, #8B5CF6, #EC4899 55%, #F97316)',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
          <div>
            <h3 style={{ fontWeight:900, fontSize:17, color:'#fff', margin:0, display:'flex', alignItems:'center', gap:6, textShadow:'0 1px 3px rgba(0,0,0,0.15)' }}>
              <span style={{ fontSize:19 }}>⭐</span> Customer Reviews
            </h3>
            {avgStr && (
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6 }}>
                <span style={{ fontSize:28, fontWeight:900, color:'#fff', lineHeight:1, textShadow:'0 1px 3px rgba(0,0,0,0.15)' }}>{avgStr}</span>
                <div>
                  <Stars rating={Number(avg || 0)} size={14} />
                  <p style={{ fontSize:11, color:'rgba(255,255,255,0.9)', marginTop:2, fontWeight:600 }}>
                    {total} review{total !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Rating distribution */}
          {total > 0 && (
            <div style={{ minWidth:160, background:'rgba(255,255,255,0.16)', borderRadius:12, padding:10 }}>
              {dist.map(d => (
                <RatingBar key={d.value} value={d.value} count={d.count} total={total} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding:'14px 16px' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:24 }}>
            <svg style={{ width:24,height:24,margin:'0 auto',display:'block' }} className="animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="3" opacity=".25"/>
              <path fill="#8B5CF6" opacity=".75" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <p style={{ fontSize:12, color:'var(--viro-textSub)', marginTop:8 }}>Loading reviews…</p>
          </div>
        ) : total === 0 && globalReviews.length === 0 ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <p style={{ fontSize:32, marginBottom:8 }}>💬</p>
            <p style={{ fontSize:14, fontWeight:700, color:'var(--viro-text)' }}>No reviews yet</p>
            <p style={{ fontSize:12, color:'var(--viro-textSub)', marginTop:4 }}>
              Be the first to review this after your order is delivered.
            </p>
          </div>
        ) : all.length >= 3 ? (
          // Auto-moving highlight strip — the general reviews (same `all`
          // array the header stats above are computed from). This is now
          // the ONLY presentation of these reviews here: the separate
          // sortable/filterable vertical card list + "See More" pagination
          // that used to sit below this strip was removed — it was just
          // re-showing the exact same reviews (often the same screenshot)
          // a second time in a taller, static format right underneath it.
          // With 6+ reviews this scrolls itself: a real, continuous
          // scrollLeft loop (see useInfiniteAutoScroll above) over 3
          // copies of the list, not a restarting CSS animation — it wraps
          // seamlessly either way you drag it and never visibly "resets."
          // Below 6, tripling would just cycle back to the same few cards
          // almost immediately, so it renders once — still swipeable by
          // hand, just no auto-play and no repeated cards.
          <div
            ref={topMarqueeRef}
            className="scrollbar-hide"
            style={{ overflowX:'auto', margin:'0 -16px 14px', WebkitMaskImage:'linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)', maskImage:'linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)' }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:10, width:'max-content', padding:'0 16px' }}>
              {(enoughToLoop ? [...all, ...all, ...all] : all).map((r, i) => (
                <div key={`${r.id}-${i}`} className="rounded-xl p-3 flex-shrink-0"
                  style={{ width:200, background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                  <Stars rating={r.rating} size={12} />
                  {r.body && (
                    <p style={{ fontSize:11, marginTop:6, color:'var(--viro-text)', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                      {r.body}
                    </p>
                  )}
                  {r.screenshot_url && (
                    <div onClick={() => setLightbox(r.screenshot_url)}
                      style={{ marginTop:6, borderRadius:8, overflow:'hidden', background:'var(--viro-bg)', border:'1px solid var(--viro-border)', cursor:'zoom-in' }}>
                      <img src={r.screenshot_url} alt="Customer screenshot" loading="lazy"
                        style={{ width:'100%', maxHeight:240, objectFit:'contain', display:'block' }} />
                    </div>
                  )}
                  <p style={{ fontSize:10, fontWeight:700, marginTop:6, color:'var(--viro-textSub)' }}>
                    {r.reviewer_name || 'Verified Customer'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* ── "More Viro.pk Customers" — real reviews from OTHER individual
            products across the store (the general pool is already shown
            in the section above, so this stays a distinct set rather than
            repeating the same cards twice on the page). Clearly separated
            and labeled so it never reads as a claim about this item's own
            quality; simply reinforces that real people order from Viro.pk
            and are happy with it. Shows even when total===0, since that's
            exactly when a product needs a trust signal most. Split into
            two sections so a photo-heavy proof card and a plain typed
            review don't sit in the same row looking like mismatched
            heights — each is its own animated strip, Rawayat-style.
            Header carries the "Let customers speak for us" framing that
            used to live in a separate <TestimonialsCarousel/> below this
            on product pages — that was showing the exact same kind of
            storewide social proof a second time right underneath this
            section, so it's been removed from the product page (still
            renders on Home/Shop) and consolidated into this one instead. ── */}
        {!loading && (socialGlobal.length > 0 || webGlobal.length > 0) && (
          <div style={{ marginTop: all.length >= 3 ? 18 : 8, paddingTop: all.length >= 3 ? 16 : 0, borderTop: all.length >= 3 ? '1px solid var(--viro-border)' : 'none' }}>
            <div style={{
              textAlign: 'center', marginBottom: 14, padding: '20px 16px', borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(139,92,246,0.20), rgba(236,72,153,0.16), rgba(249,115,22,0.20))',
              border: '2px solid rgba(139,92,246,0.35)',
            }}>
              <p className="font-display" style={{
                fontSize: 19, fontWeight: 900, margin: 0,
                backgroundImage: 'linear-gradient(135deg,#8B5CF6,#EC4899,#F97316)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text',
                color: 'transparent', WebkitTextFillColor: 'transparent',
              }}>
                Let customers speak for us
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 26, fontWeight: 900, color: '#FBBF24', lineHeight: 1 }}>{siteStats.avg.toFixed(1)}</span>
                <Stars rating={siteStats.avg} size={16} />
              </div>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--viro-textSub)', marginTop: 4 }}>
                from {siteStats.count.toLocaleString()} review{siteStats.count !== 1 ? 's' : ''}
              </p>
            </div>

            {socialGlobal.length > 0 && (
              <div style={{ marginBottom: webGlobal.length > 0 ? 16 : 0 }}>
                <span style={{ display:'inline-block', fontSize:10.5, fontWeight:800, color:'#8B5CF6', background:'#8B5CF615', padding:'3px 10px', borderRadius:20, marginBottom:8 }}>
                  📸 Photo Reviews
                </span>
                <ReviewMarqueeRow items={socialGlobal} onImageClick={setLightbox} />
              </div>
            )}

            {webGlobal.length > 0 && (
              <div>
                <span style={{ display:'inline-block', fontSize:10.5, fontWeight:800, color:'#F97316', background:'#F9731615', padding:'3px 10px', borderRadius:20, marginBottom:8 }}>
                  ✍️ Written Reviews
                </span>
                <ReviewMarqueeRow items={webGlobal} onImageClick={setLightbox} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {/* Screenshot lightbox — tap any review photo to see it full-size.
        Rendered via portal straight into document.body rather than in
        place: this codebase has a documented issue where a CSS
        `transform` on any ancestor (used for hover/fade effects
        elsewhere on the page) turns `position:fixed` into "fixed
        relative to that ancestor" instead of the actual viewport —
        which is exactly why this was rendering scoped to some inner
        container instead of covering the real screen. A portal escapes
        that regardless of what wraps ProductReviews itself. Closes on
        backdrop tap or the × button. */}
    {lightbox && createPortal(
      <div onClick={() => setLightbox(null)}
        style={{
          position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.92)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:24, cursor:'zoom-out',
        }}>
        <button onClick={() => setLightbox(null)} aria-label="Close"
          style={{
            position:'absolute', top:18, right:18, width:44, height:44, borderRadius:22,
            background:'#fff', border:'none', color:'#111', fontSize:20, fontWeight:700, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(0,0,0,0.4)',
          }}>✕</button>
        <img src={lightbox} alt="Review screenshot, full size" onClick={e => e.stopPropagation()}
          style={{ maxWidth:'100%', maxHeight:'90vh', objectFit:'contain', borderRadius:12, cursor:'default' }} />
      </div>,
      document.body
    )}
    </>
  )
}

// ── Leave a Review widget (Orders page — post-delivery) ───────
export function LeaveReview({ orderId, productId, productName, productThumb, customerId, reviewerName, onSubmitted }) {
  const { reviewsEnabled, autoApproveReviews } = useSite()
  const [rating,    setRating]    = useState(0)
  const [title,     setTitle]     = useState('')
  const [body,      setBody]      = useState('')
  const [loading,   setLoading]   = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [existing,  setExisting]  = useState(null)
  const [checked,   setChecked]   = useState(false)
  const [err,       setErr]       = useState('')
  const [open,      setOpen]      = useState(false)

  const LABELS = ['','😞 Poor','😕 Fair','😐 OK','😊 Good','🤩 Excellent!']

  // Check if already reviewed for this order+product — via /api/review
  // (PATCH), not a direct supabase read: reviews' RLS only exposes
  // status='approved' rows to anon, so a customer's own still-pending
  // review was invisible here, making "review submitted ✓" quietly
  // forget itself and show the rating form again after any refresh.
  useEffect(() => {
    if (!orderId || !productId) return
    fetch('/api/review', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_ids: [orderId] }),
    })
      .then(r => r.json())
      .then(({ reviews }) => {
        const match = (reviews || []).find(r => r.product_id === productId)
        setExisting(match || null)
        setChecked(true)
      })
      .catch(() => setChecked(true))
  }, [orderId, productId])

  if (!reviewsEnabled || !checked) return null

  // Already reviewed
  if (existing) return (
    <div style={{ padding:'10px 14px', borderRadius:12, background:'#10B98110', border:'1.5px solid #10B98130' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <Stars rating={existing.rating} size={15} />
        <span style={{ fontSize:12, fontWeight:700, color:'#10B981' }}>Review submitted ✓</span>
      </div>
      {existing.comment && <p style={{ fontSize:11, color:'var(--viro-textSub)', marginTop:2, lineHeight:1.5 }}>{existing.comment}</p>}
      {existing.status === 'pending' && (
        <p style={{ fontSize:10, color:'#EAB308', marginTop:6, fontWeight:600 }}>⏳ Awaiting admin approval before going live</p>
      )}
    </div>
  )

  if (submitted) return (
    <div style={{ padding:'16px', borderRadius:12, background:'#10B98110', border:'1.5px solid #10B98130', textAlign:'center' }}>
      <div style={{ fontSize:28, marginBottom:6 }}>🎉</div>
      <p style={{ fontSize:13, fontWeight:800, color:'#10B981' }}>Thank you for your review!</p>
      <p style={{ fontSize:11, color:'var(--viro-textSub)', marginTop:4 }}>
        {existing?.status === 'approved' ? 'Your review is now live on the product page.' : 'Your review is pending admin approval.'}
      </p>
    </div>
  )

  // Collapsed state — just the rate button
  if (!open) return (
    <button onClick={() => setOpen(true)}
      style={{
        width:'100%', padding:'10px 14px', borderRadius:12, border:'1.5px dashed #FBBF2440',
        background:'#FBBF2408', cursor:'pointer', display:'flex', alignItems:'center', gap:8,
        textAlign:'left',
      }}>
      <span style={{ fontSize:20 }}>⭐</span>
      <div>
        <p style={{ fontSize:13, fontWeight:700, color:'var(--viro-text)', margin:0 }}>Rate {productName}</p>
        <p style={{ fontSize:11, color:'var(--viro-textSub)', margin:0 }}>Tap to leave a review</p>
      </div>
      <span style={{ marginLeft:'auto', fontSize:16, color:'var(--viro-textSub)' }}>›</span>
    </button>
  )

  async function submit() {
    if (rating === 0) { setErr('Please select a star rating'); return }
    setErr(''); setLoading(true)
    // Schema only has a single `comment` field (no separate title/body
    // columns — those never existed; a longstanding mismatch is exactly
    // why this write silently failed before). Fold title into the comment
    // text so nothing the customer typed gets lost.
    const comment = [title.trim(), body.trim()].filter(Boolean).join('\n') || null
    const res = await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: orderId, product_id: productId, rating, comment,
        customer_id: customerId || null, name: reviewerName || null,
      }),
    }).then(r => r.json()).catch(() => ({ ok: false, error: 'network error' }))
    setLoading(false)
    if (!res.ok) {
      setErr('Failed to submit. Please try again.')
      return
    }
    setExisting({ rating, comment, status: res.status })
    setSubmitted(true)
    onSubmitted?.()
  }

  return (
    <div style={{ borderRadius:14, overflow:'hidden', border:'1.5px solid #FBBF2430', background:'var(--viro-bgDeep)' }}>
      {/* Header with product */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom:'1px solid var(--viro-border)', background:'var(--viro-bgCard)' }}>
        {productThumb && (
          // Plain <img>, not next/image — this is a small, already-thumbnail-
          // sized image, doesn't need Vercel's server-side optimization
          // pipeline, and sidesteps it hitting the same image-quota limit
          // that's currently 402-ing full next/image requests sitewide (see
          // note in the deploy summary — that's a Vercel plan/quota issue,
          // not something fixable in code).
          <img src={productThumb} alt={productName} style={{ width:40, height:40, borderRadius:10, objectFit:'cover', flexShrink:0 }} />
        )}
        <div style={{ flex:1 }}>
          <p style={{ fontSize:11, color:'var(--viro-textSub)', margin:0 }}>Rate your purchase</p>
          <p style={{ fontSize:13, fontWeight:700, color:'var(--viro-text)', margin:0 }}>{productName}</p>
        </div>
        <button onClick={() => setOpen(false)}
          style={{ fontSize:16, color:'var(--viro-textSub)', background:'none', border:'none', cursor:'pointer' }}>✕</button>
      </div>

      <div style={{ padding:'14px' }}>
        {/* Star picker */}
        <div style={{ textAlign:'center', marginBottom:14 }}>
          <p style={{ fontSize:11, fontWeight:700, color:'var(--viro-textSub)', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>
            How would you rate this?
          </p>
          <div style={{ display:'flex', justifyContent:'center', gap:6, marginBottom:6 }}>
            {[1,2,3,4,5].map(n => (
              <span key={n}
                onClick={() => setRating(n)}
                style={{
                  fontSize:32, cursor:'pointer', userSelect:'none',
                  color: n <= rating ? '#FBBF24' : '#D1D5DB',
                  transform: n <= rating ? 'scale(1.15)' : 'scale(1)',
                  transition:'all 0.12s', display:'inline-block',
                }}>★</span>
            ))}
          </div>
          {rating > 0 && (
            <p style={{ fontSize:13, fontWeight:800, color:'#FBBF24' }}>{LABELS[rating]}</p>
          )}
        </div>

        {/* Title */}
        <div style={{ marginBottom:10 }}>
          <label style={{ fontSize:11, fontWeight:700, color:'var(--viro-textSub)', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:6 }}>
            Title (optional)
          </label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Great quality, fast delivery!"
            maxLength={80}
            style={{ width:'100%', boxSizing:'border-box' }} />
        </div>

        {/* Body */}
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:11, fontWeight:700, color:'var(--viro-textSub)', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:6 }}>
            Your Review (optional)
          </label>
          <textarea value={body} onChange={e => setBody(e.target.value)}
            placeholder="Tell other customers what you think — quality, fit, value for money…"
            rows={4} maxLength={600}
            style={{ width:'100%', resize:'vertical', fontSize:13, boxSizing:'border-box', lineHeight:1.5 }} />
          <p style={{ fontSize:10, color:'var(--viro-textSub)', marginTop:4, textAlign:'right' }}>{body.length}/600</p>
        </div>

        {err && (
          <div style={{ padding:'8px 12px', borderRadius:10, background:'#EF444415', border:'1px solid #EF444430', marginBottom:10 }}>
            <p style={{ fontSize:12, color:'#EF4444', margin:0 }}>⚠️ {err}</p>
          </div>
        )}

        <button onClick={submit} disabled={loading || rating === 0}
          style={{
            width:'100%', padding:'12px 0', borderRadius:14, border:'none',
            background: rating > 0
              ? 'linear-gradient(135deg,#FBBF24,#F59E0B)'
              : 'var(--viro-bgCard)',
            color: rating > 0 ? '#1a1a1a' : 'var(--viro-textSub)',
            fontWeight:800, fontSize:14,
            cursor: (loading || rating === 0) ? 'not-allowed' : 'pointer',
            boxShadow: rating > 0 ? '0 4px 12px #FBBF2440' : 'none',
            transition:'all 0.2s',
          }}>
          {loading ? (
            <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              <svg style={{ width:16,height:16,flexShrink:0 }} className="animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".25"/>
                <path fill="currentColor" opacity=".75" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Submitting…
            </span>
          ) : rating === 0 ? 'Select stars first'
            : `Submit ${rating}-Star Review`}
        </button>
      </div>
    </div>
  )
}

export default ProductReviews
