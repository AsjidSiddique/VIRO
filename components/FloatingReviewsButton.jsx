'use client'
import { supabase } from '../lib/supabase'
/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSite } from '../context/SiteSettingsContext'
import { Stars } from './ProductReviews'
import { useHideOnScroll } from '../lib/useHideOnScroll'

// Drives a horizontal review strip with real native scrolling instead of
// a CSS transform animation — three copies of the list, starting in the
// middle copy, silently wrapping by exactly one copy-width whenever the
// scroll position nears either edge (imperceptible, since every copy is
// identical). Means there's no direction and no distance that ever runs
// out, unlike a CSS-animation strip which only ever moved one way and
// only had two copies. Touching pauses the auto-increment and hands off
// to completely normal — and fully bidirectional — native scrolling;
// releasing resumes auto-scroll from wherever it was left.
function useInfiniteAutoScroll(ref, active, pxPerSecond = 30) {
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
          el.scrollLeft = el.scrollWidth / 3
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

// Groups reviews by name, then round-robin-interleaves across those
// groups — a customer who left several reviews around the same time
// (visible as several "AberabRasheed" cards in a row under plain
// recency order) no longer dominates a run of consecutive cards.
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

function ReviewCard({ r, onNavigate, onImageClick }) {
  const imgs = Array.isArray(r.products?.images) ? r.products.images
    : (() => { try { return JSON.parse(r.products?.images || '[]') } catch { return [] } })()
  return (
    <div style={{ borderRadius: 14, padding: '12px 14px', background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Stars rating={r.rating} size={13} />
        </div>
        {r.source === 'screenshot' ? (
          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: '#8B5CF615', color: '#8B5CF6', fontWeight: 700, flexShrink: 0 }}>
            {r.screenshot_url ? '📸 Photo Review' : '✍️ Shared Feedback'}
          </span>
        ) : (
          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: '#10B98115', color: '#10B981', fontWeight: 700, flexShrink: 0 }}>
            ✓ Verified Purchase
          </span>
        )}
      </div>

      {r.comment && (
        <p style={{ fontSize: 13, color: 'var(--viro-text)', lineHeight: 1.55, margin: '0 0 8px' }}>{r.comment}</p>
      )}

      {r.screenshot_url && (
        <div onClick={() => onImageClick?.(r.screenshot_url)}
          style={{ width: '100%', marginBottom: 8, borderRadius: 10, overflow: 'hidden', background: 'var(--viro-bg)', border: '1px solid var(--viro-border)', cursor: onImageClick ? 'zoom-in' : 'default' }}>
          <img src={r.screenshot_url} alt="Customer review screenshot" loading="lazy"
            style={{ width: '100%', maxHeight: 210, objectFit: 'contain', display: 'block' }} />
        </div>
      )}

      {r.products?.id ? (
        <Link href={`/product/${r.products.id}`}
          onClick={onNavigate}
          style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px solid var(--viro-border)', textDecoration: 'none' }}>
          {imgs[0] && (
            <img src={imgs[0]} alt={r.products?.name || ''} loading="lazy"
              style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
              onError={e => { e.target.style.display = 'none' }} />
          )}
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--viro-text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {r.name || 'Verified Customer'}
            </p>
            <p style={{ fontSize: 10, color: 'var(--viro-textSub)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              on {r.products.name}
            </p>
          </div>
        </Link>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px solid var(--viro-border)' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--viro-text)', margin: 0 }}>
              {r.name || 'Verified Customer'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// Photo reviews get their own horizontal strip instead of stacking
// vertically — a tall WhatsApp screenshot at full popup width made even
// 2 cards tall enough to dominate the whole scroll. Always moving via
// useInfiniteAutoScroll (see above) — this popup lives inside a
// vertically-scrolling sheet, so the strip needs its own scroll handling
// rather than fighting the sheet's scroll for gestures.
function PhotoReviewStrip({ items, onNavigate, onImageClick }) {
  const scrollRef = useRef(null)
  useInfiniteAutoScroll(scrollRef, items.length > 0, 30)
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
          <div key={`${r.id}-${i}`} style={{ width: 250, flexShrink: 0 }}>
            <ReviewCard r={r} onNavigate={onNavigate} onImageClick={onImageClick} />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * FloatingReviewsButton — small pinned button on the mid-right edge of the
 * screen (every page, storefront-only). Tapping it opens a bottom-sheet
 * popup listing ALL approved reviews site-wide — same source of truth as
 * TestimonialsCarousel (product-joined `reviews` table, status=approved) —
 * whatever their origin: typed by the customer after delivery, a screenshot
 * an admin attached, or a message an admin transcribed on a customer's
 * behalf. Nothing here is invented copy; it only ever reflects real rows
 * from the reviews table.
 */
export default function FloatingReviewsButton() {
  const { reviewsEnabled } = useSite()
  const pathname = usePathname()
  const [open, setOpen]       = useState(false)
  const [reviews, setReviews] = useState([])
  const [stats, setStats]     = useState({ avg: 0, count: 0 })
  const [loaded, setLoaded]   = useState(false)
  const [lightbox, setLightbox] = useState(null) // screenshot URL currently shown full-size, or null
  const hidden = useHideOnScroll()

  const isAdmin        = pathname?.startsWith('/adm')
  const isProductPage  = pathname?.startsWith('/product/')

  useEffect(() => {
    if (isAdmin || !supabase) return
    let cancelled = false
    supabase
      .from('reviews')
      .select('id,rating,comment,name,screenshot_url,source,created_at,products(id,name,images)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (cancelled) return
        const rows = data || []
        setReviews(rows)
        if (rows.length > 0) {
          const sum = rows.reduce((s, r) => s + Number(r.rating || 0), 0)
          setStats({ avg: sum / rows.length, count: rows.length })
        }
        setLoaded(true)
      })
    return () => { cancelled = true }
  }, [isAdmin])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (isAdmin || !reviewsEnabled || !loaded || reviews.length < 3) return null

  // Round down to a friendly "100+" style headline instead of a raw,
  // fluctuating count — still true (never claims more than actually exist).
  const roundedFloor = Math.floor(stats.count / 10) * 10
  const headline = roundedFloor >= 10 ? `${roundedFloor}+ Happy Customers` : `${stats.count} Happy Customers`

  // Two sections — screenshots/messages an admin shared on a customer's
  // behalf vs. reviews typed directly on the site — each interleaved by
  // name so the list doesn't read as "mostly one person" when someone
  // left several reviews close together.
  const social = interleaveByName(reviews.filter(r => r.source === 'screenshot'))
  const web    = interleaveByName(reviews.filter(r => r.source !== 'screenshot'))

  return (
    <>
      {/* ── Pinned tab, vertically centered on the right edge ── */}
      <button
        onClick={() => setOpen(true)}
        aria-label="See all customer reviews"
        style={{
          position: 'fixed',
          top: '50%',
          right: 0,
          transform: hidden ? 'translateY(-50%) translateX(70%)' : 'translateY(-50%) translateX(0)',
          opacity: hidden ? 0 : 1,
          pointerEvents: hidden ? 'none' : 'auto',
          zIndex: 850,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          padding: '10px 7px',
          borderRadius: '12px 0 0 12px',
          border: '1px solid var(--viro-border)',
          borderRight: 'none',
          background: 'var(--viro-bgCard)',
          boxShadow: '-2px 2px 12px rgba(0,0,0,0.12)',
          cursor: 'pointer',
          transition: 'padding 0.15s, transform 0.25s ease, opacity 0.25s ease',
        }}
        onMouseEnter={e => { if (!hidden) e.currentTarget.style.paddingRight = '11px' }}
        onMouseLeave={e => { if (!hidden) e.currentTarget.style.paddingRight = '7px' }}
      >
        <span style={{ fontSize: 15, color: '#FBBF24', lineHeight: 1 }}>★</span>
        <span style={{
          fontSize: 10, fontWeight: 800, color: 'var(--viro-text)',
          writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: '0.02em',
        }}>
          Reviews
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--viro-textSub)' }}>
          {stats.avg.toFixed(1)}
        </span>
      </button>

      {/* ── Popup ── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9995,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 560, background: 'var(--viro-bg)',
              borderRadius: '20px 20px 0 0', maxHeight: '86vh',
              display: 'flex', flexDirection: 'column',
              paddingBottom: 'env(safe-area-inset-bottom,0)',
              animation: 'viro-sheet-up 0.22s ease',
            }}>
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--viro-border)' }} />
            </div>

            {/* Header */}
            <div style={{ position: 'relative', padding: '4px 20px 14px', borderBottom: '1px solid var(--viro-border)', flexShrink: 0, textAlign: 'center' }}>
              <button onClick={() => setOpen(false)} aria-label="Close"
                style={{ position: 'absolute', right: 16, top: 14, width: 30, height: 30, borderRadius: 15, background: 'var(--viro-bgDeep)', border: '1px solid var(--viro-border)', fontSize: 16, color: 'var(--viro-textSub)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: 'var(--viro-text)' }}>
                Let customers speak for us
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#FBBF24', lineHeight: 1 }}>{stats.avg.toFixed(1)}</span>
                <Stars rating={stats.avg} size={16} />
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--viro-textSub)', marginTop: 4 }}>
                {headline} · from {stats.count.toLocaleString()} review{stats.count !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Scrollable review list — two sections */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {social.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--viro-textSub)', marginBottom: 8 }}>
                    📸 Photo Reviews
                  </p>
                  <PhotoReviewStrip items={social} onNavigate={() => setOpen(false)} onImageClick={setLightbox} />
                </div>
              )}
              {web.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--viro-textSub)', marginBottom: 8 }}>
                    ✍️ Written Reviews
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {web.map(r => <ReviewCard key={r.id} r={r} onNavigate={() => setOpen(false)} onImageClick={setLightbox} />)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Screenshot lightbox — tap any review photo to see it full-size.
          Rendered via portal straight into document.body — this popup
          sheet itself uses a slide-up animation (viro-sheet-up), and a
          CSS transform on an ancestor turns position:fixed into "fixed
          relative to that ancestor" instead of the real viewport, which
          is exactly why this was rendering scoped to some inner
          container instead of covering the actual screen. A portal
          escapes that regardless of what wraps it. Closes on backdrop
          tap or the × button, without also closing the popup underneath. */}
      {lightbox && createPortal(
        <div onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out',
          }}>
          <button onClick={() => setLightbox(null)} aria-label="Close"
            style={{
              position: 'absolute', top: 18, right: 18, width: 44, height: 44, borderRadius: 22,
              background: '#fff', border: 'none', color: '#111', fontSize: 20, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}>✕</button>
          <img src={lightbox} alt="Review screenshot, full size" onClick={e => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12, cursor: 'default' }} />
        </div>,
        document.body
      )}
    </>
  )
}
