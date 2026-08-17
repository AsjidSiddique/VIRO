'use client'
import { supabase } from '../lib/supabase'
import React, { useEffect, useState } from 'react'

function Stars({ rating, size = 14 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{ fontSize: size, color: n <= Math.round(rating) ? '#10B981' : '#E2E8F0' }}>★</span>
      ))}
    </span>
  )
}

// Groups reviews by name, then round-robin-interleaves across those
// groups, so a customer who left several reviews around the same time
// doesn't fill several consecutive slots in the strip.
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

/**
 * "Let customers speak for us" — site-wide social proof, Rawayat-style.
 *
 * IMPORTANT: unlike the per-product review widget, this pulls from EVERY
 * product's approved reviews — but each card keeps ITS OWN product name +
 * photo right there next to it (see productName/productImage below). It
 * never re-labels a review as being about a different product than the one
 * the customer actually reviewed — that's the line between honest
 * storewide social proof and misleading per-product reviews.
 */
export default function TestimonialsCarousel() {
  const [reviews, setReviews] = useState([])
  const [stats, setStats]     = useState({ avg: 0, count: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!supabase) return
      const { data } = await supabase
        .from('reviews')
        .select('id,rating,comment,name,screenshot_url,created_at,products(name,images)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(40)
      if (cancelled) return
      const rows = interleaveByName((data || []).filter(r => r.comment || r.screenshot_url)) // skip star-only, nothing to show
      setReviews(rows)
      if (data && data.length > 0) {
        const sum = data.reduce((s, r) => s + Number(r.rating || 0), 0)
        setStats({ avg: sum / data.length, count: data.length })
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading || reviews.length < 3) return null // not enough real reviews yet — nothing to show

  // Duplicate the list once so the marquee can loop seamlessly (translateX
  // -50% lines up with the duplicate's start with no visible seam/jump).
  const track = [...reviews, ...reviews]

  return (
    <div className="px-4 mb-6">
      <div className="text-center mb-5">
        <h2 className="font-display text-xl font-extrabold" style={{ color: 'var(--viro-text)' }}>
          Let customers speak for us
        </h2>
        <div className="flex items-center justify-center gap-1.5 mt-1.5">
          <Stars rating={stats.avg} size={17} />
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--viro-textSub)' }}>
          from {stats.count.toLocaleString()} review{stats.count !== 1 ? 's' : ''}
        </p>
      </div>

      <div style={{ overflow: 'hidden', WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)', maskImage: 'linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)' }}>
        <div
          className="viro-testimonial-track"
          style={{ display: 'flex', alignItems: 'flex-start', gap: 12, width: 'max-content', animation: `viro-marquee ${track.length * 6}s linear infinite` }}
          onMouseEnter={e => { e.currentTarget.style.animationPlayState = 'paused' }}
          onMouseLeave={e => { e.currentTarget.style.animationPlayState = 'running' }}
        >
          {track.map((r, i) => {
            const imgs = Array.isArray(r.products?.images) ? r.products.images
              : (() => { try { return JSON.parse(r.products?.images || '[]') } catch { return [] } })()
            return (
              <div key={`${r.id}-${i}`} className="rounded-2xl p-4 flex-shrink-0"
                style={{ width: 240, background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)' }}>
                <Stars rating={r.rating} size={14} />
                {r.comment && (
                  <p className="text-xs mt-2 leading-snug" style={{
                    color: 'var(--viro-text)', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {r.comment}
                  </p>
                )}
                {r.screenshot_url && (
                  <div style={{ marginTop: 8, borderRadius: 10, overflow: 'hidden', background: 'var(--viro-bg)', border: '1px solid var(--viro-border)' }}>
                    <img src={r.screenshot_url} alt="Customer screenshot" loading="lazy"
                      style={{ width: '100%', maxHeight: 260, objectFit: 'contain', display: 'block' }} />
                  </div>
                )}
                <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--viro-border)' }}>
                  {imgs[0] && (
                    <img src={imgs[0]} alt={r.products?.name || ''} loading="lazy"
                      style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                      onError={e => { e.target.style.display = 'none' }} />
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold truncate" style={{ color: 'var(--viro-text)' }}>{r.name || 'Verified Customer'}</p>
                    {r.products?.name ? (
                      <p className="text-[10px] truncate" style={{ color: 'var(--viro-textSub)' }}>{r.products.name}</p>
                    ) : (
                      <p className="text-[10px] truncate" style={{ color: 'var(--viro-textSub)' }}>🏬 Viro.pk Customer</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
