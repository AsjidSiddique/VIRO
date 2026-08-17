'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from '../context/CartContext'

export default function DealCard({ deal, stockMap = {} }) {
  const { addDealToCart } = useCart()
  const router = useRouter()
  const [added, setAdded] = useState(false)

  const sum      = deal.originalPriceSum || 0
  const savings  = sum > deal.bundlePrice ? sum - deal.bundlePrice : 0
  const pct      = sum > 0 && savings > 0 ? Math.round((savings / sum) * 100) : 0
  const count    = (deal.productIds || []).length

  // Out of stock the instant ANY included product hits 0 — available count
  // is capped by whichever included product has the LEAST stock (buying one
  // bundle uses up a unit of every product inside it), further capped by an
  // optional admin max quantity.
  const productIds = deal.productIds || []
  const stocks = productIds.map(id => stockMap[id] ?? Infinity) // unknown yet → don't falsely say OOS
  const scarcestStock = stocks.length > 0 ? Math.min(...stocks) : 0
  const knownStock = productIds.every(id => stockMap[id] !== undefined)
  const cap = Number(deal.maxQuantity)
  const available = Number.isFinite(cap) && cap > 0 ? Math.min(scarcestStock, cap) : scarcestStock
  const outOfStock = knownStock && scarcestStock <= 0
  const lowStock = knownStock && available > 0 && available <= 5

  function handleAdd(e) {
    e.preventDefault(); e.stopPropagation()
    if (outOfStock) return
    addDealToCart(deal)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  function handleBuyNow(e) {
    e.preventDefault(); e.stopPropagation()
    if (outOfStock) return
    sessionStorage.setItem('viro_quick_order', JSON.stringify([{
      id: `deal:${deal.id}`,
      isDeal: true,
      dealId: deal.id,
      name: deal.title,
      images: [deal.image],
      price: deal.bundlePrice,
      discount_price: null,
      deliveryMode: deal.deliveryMode || 'normal',
      customDeliveryPrice: deal.customDeliveryPrice || 0,
      includedProductIds: deal.productIds || [],
      stock: 999,
      quantity: 1,
    }]))
    router.push('/checkout?quick=1&t=' + Date.now())
  }

  return (
    <Link href={`/deal/${deal.id}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      <div style={{
        position: 'relative', height: '100%', display: 'flex', flexDirection: 'column',
        borderRadius: 16, overflow: 'hidden',
        background: 'linear-gradient(180deg, var(--viro-productWhite,#fff) 0%, var(--viro-productWhite,#fff) 100%)',
        border: '2px solid transparent',
        backgroundImage: 'linear-gradient(var(--viro-productWhite,#fff), var(--viro-productWhite,#fff)), linear-gradient(135deg,#7C3AED,#EC4899,#F97316)',
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
        boxShadow: '0 4px 16px rgba(124,58,237,0.15)',
      }}>
        {/* Ribbon badge */}
        <div style={{
          position: 'absolute', top: 10, left: -6, zIndex: 2,
          background: 'linear-gradient(135deg,#7C3AED,#EC4899)',
          color: '#fff', fontSize: 9.5, fontWeight: 900,
          padding: '3px 10px 3px 12px', borderRadius: '0 6px 6px 0',
          boxShadow: '0 2px 6px rgba(124,58,237,0.4)',
          display: 'flex', alignItems: 'center', gap: 3,
        }}>
          🎁 DEAL BOX
        </div>

        {!outOfStock && (
          <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            {deal.deliveryMode === 'free' && (
              <div style={{
                background: 'linear-gradient(135deg,#10B981,#059669)', color: '#fff',
                fontSize: 9, fontWeight: 900, padding: '3px 7px', borderRadius: 8,
                display: 'flex', alignItems: 'center', gap: 3, boxShadow: '0 2px 6px rgba(16,185,129,0.4)',
              }}>
                🚚 FREE DELIVERY
              </div>
            )}
            {pct > 0 && (
              <div style={{
                background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 900,
                padding: '3px 8px', borderRadius: 8,
              }}>
                -{pct}%
              </div>
            )}
          </div>
        )}

        {outOfStock && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 3,
            background: 'rgba(15,23,42,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 900,
              padding: '5px 12px', borderRadius: 8, letterSpacing: '0.3px',
            }}>⛔ OUT OF STOCK</span>
          </div>
        )}

        {/* Bundle image */}
        <div style={{ position: 'relative', width: '100%', paddingTop: '90%', background: 'var(--viro-bgDeep)' }}>
          {deal.image && (
            <img src={deal.image} alt={deal.title}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 8px',
            background: 'linear-gradient(0deg, rgba(0,0,0,0.55), transparent)',
          }}>
            <span style={{ color: '#fff', fontSize: 9.5, fontWeight: 700 }}>📦 {count} items bundled</span>
          </div>
        </div>

        <div style={{ padding: '8px 9px 9px', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <p style={{
            margin: '0 0 3px', fontWeight: 800, fontSize: 11,
            lineHeight: 1.25, color: 'var(--viro-text,#0F172A)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{deal.title}</p>

          {deal.description && (
            <p style={{
              margin: '0 0 5px', fontSize: 10, color: 'var(--viro-textSub,#94A3B8)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{deal.description}</p>
          )}

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap', marginBottom: 3 }}>
            <span style={{ color: '#7C3AED', fontWeight: 900, fontSize: 13, letterSpacing: '-0.3px' }}>
              Rs.{deal.bundlePrice?.toLocaleString()}
            </span>
            {sum > deal.bundlePrice && (
              <span style={{ color: '#94A3B8', fontSize: 9.5, textDecoration: 'line-through' }}>
                Rs.{sum.toLocaleString()}
              </span>
            )}
          </div>

          {deal.deliveryMode === 'custom' ? (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 3, alignSelf: 'flex-start',
              background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)',
              borderRadius: 6, padding: '2px 6px', marginBottom: 4,
            }}>
              <span style={{ fontSize: 9 }}>🚚</span>
              <span style={{ color: '#7C3AED', fontSize: 8.5, fontWeight: 800 }}>DELIVERY Rs.{deal.customDeliveryPrice}</span>
            </div>
          ) : <div style={{ marginBottom: 4 }} />}

          {lowStock && (
            <p style={{ margin: '0 0 5px', fontSize: 9, fontWeight: 700, color: '#EA6C00' }}>
              ⚠️ Only {available} bundle{available === 1 ? '' : 's'} left
            </p>
          )}

          <div style={{ marginTop: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={handleAdd} disabled={outOfStock}
              style={{
                flex: 1, border: added ? '1.5px solid #10B981' : '1.5px solid #7C3AED50',
                cursor: outOfStock ? 'not-allowed' : 'pointer', borderRadius: 10, padding: '7px 0',
                fontSize: 10.5, fontWeight: 700,
                background: outOfStock ? 'var(--viro-bgDeep)' : added ? 'linear-gradient(135deg,#10B981,#059669)' : 'var(--viro-bgCard,#fff)',
                color: outOfStock ? 'var(--viro-textSub)' : added ? '#fff' : '#7C3AED',
                opacity: outOfStock ? 0.6 : 1,
              }}>
              {added ? '✓ Added!' : '🛒 Add'}
            </button>
            <button onClick={handleBuyNow} disabled={outOfStock}
              style={{
                flex: 1.3, border: 'none', cursor: outOfStock ? 'not-allowed' : 'pointer', borderRadius: 10, padding: '7px 0',
                fontSize: 10.5, fontWeight: 800,
                background: outOfStock ? '#94A3B8' : 'linear-gradient(135deg,#7C3AED,#EC4899)', color: '#fff',
                boxShadow: outOfStock ? 'none' : '0 3px 10px rgba(124,58,237,0.3)',
              }}>
              {outOfStock ? 'Unavailable' : '⚡ Buy Deal'}
            </button>
          </div>
        </div>
      </div>
    </Link>
  )
}
