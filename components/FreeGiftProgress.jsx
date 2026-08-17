'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useCart } from '../context/CartContext'
import { useSite } from '../context/SiteSettingsContext'

function firstImage(p) {
  try {
    const imgs = typeof p.images === 'string' ? JSON.parse(p.images) : p.images
    return Array.isArray(imgs) ? imgs[0] : imgs
  } catch { return null }
}

// Spend Rs.X, get a chosen product free — shown as a progress bar wherever
// mounted (product detail page, cart page). Reads live cart total so it
// updates in real time as items are added/removed, same pattern as the
// min-order and free-delivery progress indicators elsewhere in the app.
export default function FreeGiftProgress() {
  const { freeGift } = useSite()
  const { cartTotal } = useCart()
  const [gift, setGift] = useState(null)

  useEffect(() => {
    if (!freeGift?.enabled || !freeGift.productId) { setGift(null); return }
    let cancelled = false
    supabase.from('products').select('id,name,images,price,discount_price')
      .eq('id', freeGift.productId).maybeSingle()
      .then(({ data }) => { if (!cancelled) setGift(data || null) })
    return () => { cancelled = true }
  }, [freeGift?.enabled, freeGift?.productId])

  if (!freeGift?.enabled || !freeGift.productId || !gift) return null

  const threshold = freeGift.threshold || 0
  const unlocked = cartTotal >= threshold
  const pct = threshold > 0 ? Math.min(100, Math.round((cartTotal / threshold) * 100)) : 0
  const remaining = Math.max(0, threshold - cartTotal)
  const giftName = freeGift.giftLabel?.trim() || gift.name

  return (
    <div className="rounded-2xl overflow-hidden mb-4" style={{ border: '1px solid var(--viro-border)', background: 'var(--viro-bgCard)' }}>
      <div className="px-4 py-3 flex items-center gap-2.5" style={{ borderBottom: '1px solid var(--viro-border)' }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: unlocked ? 'linear-gradient(135deg,#10B981,#059669)' : 'linear-gradient(135deg,#F97316,#EA580C)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
        }}>🎁</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: 'var(--viro-text)' }}>Free Gift</p>
          <p className="text-xs" style={{ color: unlocked ? '#10B981' : 'var(--viro-textSub)' }}>
            {unlocked ? '✓ Unlocked — ready to claim at checkout' : `Add Rs.${remaining.toLocaleString()} more to unlock`}
          </p>
        </div>
        {unlocked && (
          <span className="text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0" style={{ background:'#10B98115', color:'#10B981' }}>Ready</span>
        )}
      </div>

      <div className="px-4 pt-3">
        <div style={{ height: 6, borderRadius: 999, background: 'var(--viro-bgDeep)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`, borderRadius: 999,
            background: unlocked ? 'linear-gradient(90deg,#10B981,#059669)' : 'linear-gradient(90deg,#F97316,#EA580C)',
            transition: 'width 0.3s ease',
          }} />
        </div>
        <p className="text-xs mt-1.5 text-right" style={{ color: unlocked ? '#10B981' : '#F97316', fontWeight: 700 }}>
          Rs.{Math.round(cartTotal).toLocaleString()} / Rs.{threshold.toLocaleString()}
        </p>
      </div>

      <div className="flex items-center gap-3 px-4 pb-3 pt-1">
        <img src={firstImage(gift) || '/logo.jpg'} alt={giftName}
          style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0, opacity: unlocked ? 1 : 0.6 }}
          onError={e => { e.target.src = '/logo.jpg' }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: 'var(--viro-text)' }}>{giftName}</p>
          <p className="text-xs">
            <span className="font-bold" style={{ color: '#10B981' }}>FREE</span>{' '}
            <span className="line-through" style={{ color: 'var(--viro-textSub)' }}>Rs.{gift.price?.toLocaleString()}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
