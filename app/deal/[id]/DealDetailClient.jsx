'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { useCart } from '../../../context/CartContext'
import { useSite } from '../../../context/SiteSettingsContext'
import { slugify } from '../../../lib/slugify'

function firstImage(p) {
  try {
    const imgs = typeof p.images === 'string' ? JSON.parse(p.images) : p.images
    return Array.isArray(imgs) ? imgs[0] : imgs
  } catch { return null }
}

export default function DealDetailClient({ dealId }) {
  const { dealBoxes, loaded } = useSite()
  const { addDealToCart } = useCart()
  const router = useRouter()
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [added, setAdded] = useState(false)

  const deal = dealBoxes.find(d => d.id === dealId)

  useEffect(() => {
    if (!deal) return
    supabase.from('products').select('id,name,images,price,discount_price,stock,is_active,status')
      .in('id', deal.productIds || [])
      .then(({ data }) => { setProducts(data || []); setLoadingProducts(false) })
  }, [deal?.id])

  if (!loaded) return <div className="px-4 py-16 text-center" style={{ color: 'var(--viro-textSub)' }}>⏳ Loading…</div>

  if (!deal) return (
    <div className="px-4 py-16 flex flex-col items-center gap-3 text-center">
      <div style={{ fontSize: 48 }}>🎁</div>
      <p className="font-bold" style={{ color: 'var(--viro-text)' }}>This deal isn't available</p>
      <Link href="/shop" className="text-sm font-bold" style={{ color: '#7C3AED' }}>← Back to Shop</Link>
    </div>
  )

  const sum     = deal.originalPriceSum || 0
  const savings = sum > deal.bundlePrice ? sum - deal.bundlePrice : 0
  const pct     = sum > 0 && savings > 0 ? Math.round((savings / sum) * 100) : 0

  const stocks = products.map(p => p.stock ?? 0)
  const scarcest = products.reduce((min, p) => (p.stock ?? 0) < (min?.stock ?? Infinity) ? p : min, null)
  const cap = Number(deal.maxQuantity)
  const rawAvailable = stocks.length > 0 ? Math.min(...stocks) : 0
  const available = Number.isFinite(cap) && cap > 0 ? Math.min(rawAvailable, cap) : rawAvailable
  const outOfStock = !loadingProducts && available <= 0

  function handleAdd() {
    if (outOfStock) return
    addDealToCart(deal)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  function handleBuyNow() {
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
    <div className="pb-24 md:pb-10">
      <div className="max-w-5xl mx-auto px-4 pt-4 grid md:grid-cols-2 gap-8">
        {/* Bundle image */}
        <div>
          <div style={{
            position: 'relative', width: '100%', paddingTop: '100%', borderRadius: 20, overflow: 'hidden',
            background: 'var(--viro-bgDeep)',
            border: '2px solid transparent',
            backgroundImage: 'linear-gradient(var(--viro-bgDeep), var(--viro-bgDeep)), linear-gradient(135deg,#7C3AED,#EC4899,#F97316)',
            backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box',
          }}>
            {deal.image && (
              <img src={deal.image} alt={deal.title}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
            <div style={{
              position: 'absolute', top: 12, left: -6,
              background: 'linear-gradient(135deg,#7C3AED,#EC4899)', color: '#fff',
              fontSize: 12, fontWeight: 900, padding: '5px 14px 5px 16px', borderRadius: '0 8px 8px 0',
              boxShadow: '0 2px 8px rgba(124,58,237,0.4)',
            }}>🎁 DEAL BOX</div>
            {outOfStock && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ background: '#EF4444', color: '#fff', fontSize: 14, fontWeight: 900, padding: '8px 16px', borderRadius: 10 }}>⛔ OUT OF STOCK</span>
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div>
          <h1 className="text-xl font-extrabold mb-1" style={{ color: 'var(--viro-text)' }}>{deal.title}</h1>
          {deal.description && <p className="text-sm mb-3" style={{ color: 'var(--viro-textSub)' }}>{deal.description}</p>}

          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-2xl font-extrabold" style={{ color: '#7C3AED' }}>Rs.{deal.bundlePrice?.toLocaleString()}</span>
            {sum > deal.bundlePrice && <span className="text-base line-through" style={{ color: 'var(--viro-textSub)' }}>Rs.{sum.toLocaleString()}</span>}
            {pct > 0 && <span className="text-sm font-bold px-2 py-0.5 rounded-lg" style={{ background: '#EF444415', color: '#EF4444' }}>Save {pct}%</span>}
          </div>

          {deal.deliveryMode === 'free' && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl mb-3" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <span>🚚</span><span className="text-sm font-bold" style={{ color: '#10B981' }}>FREE Delivery on this deal</span>
            </div>
          )}
          {deal.deliveryMode === 'custom' && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl mb-3" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)' }}>
              <span>🚚</span><span className="text-sm font-bold" style={{ color: '#7C3AED' }}>Delivery Rs.{deal.customDeliveryPrice} on this deal</span>
            </div>
          )}

          {!outOfStock && available > 0 && available <= 5 && (
            <p className="text-sm font-bold mb-3" style={{ color: '#EA6C00' }}>⚠️ Only {available} bundle{available === 1 ? '' : 's'} left</p>
          )}

          {/* Desktop buttons */}
          <div className="hidden md:flex gap-3 mb-6">
            <button onClick={handleAdd} disabled={outOfStock}
              className="flex-1 py-3 rounded-2xl font-bold text-sm"
              style={{
                border: added ? '2px solid #10B98160' : '2px solid var(--viro-border)',
                background: outOfStock ? 'var(--viro-bgDeep)' : added ? '#10B98115' : 'var(--viro-bgCard)',
                color: outOfStock ? 'var(--viro-textSub)' : added ? '#10B981' : 'var(--viro-text)',
                cursor: outOfStock ? 'not-allowed' : 'pointer',
              }}>
              {added ? '✓ Added to Cart!' : '🛒 Add to Cart'}
            </button>
            <button onClick={handleBuyNow} disabled={outOfStock}
              className="flex-1 py-3 rounded-2xl font-bold text-sm text-white"
              style={{
                background: outOfStock ? '#94A3B8' : 'linear-gradient(135deg,#7C3AED,#EC4899)',
                border: 'none', cursor: outOfStock ? 'not-allowed' : 'pointer',
                boxShadow: outOfStock ? 'none' : '0 4px 14px rgba(124,58,237,0.35)',
              }}>
              {outOfStock ? 'Unavailable' : `⚡ Buy Deal — Rs.${deal.bundlePrice?.toLocaleString()}`}
            </button>
          </div>

          {/* What's included */}
          <p className="text-sm font-bold mb-2" style={{ color: 'var(--viro-text)' }}>📦 What's Included ({(deal.productIds || []).length} items)</p>
          <div className="space-y-2">
            {loadingProducts ? (
              <p className="text-xs" style={{ color: 'var(--viro-textSub)' }}>Loading products…</p>
            ) : products.map(p => {
              const price = (p.discount_price && p.discount_price < p.price) ? p.discount_price : p.price
              return (
                <Link key={p.id} href={`/product/${slugify(p.name)}-${p.id}`}
                  className="flex items-center gap-3 p-2 rounded-xl"
                  style={{ background: 'var(--viro-bgDeep)', border: '1px solid var(--viro-border)', textDecoration: 'none' }}>
                  <img src={firstImage(p) || '/logo.jpg'} alt={p.name}
                    style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--viro-text)' }}>{p.name}</p>
                    <p className="text-xs font-bold" style={{ color: '#7C3AED' }}>Rs.{price?.toLocaleString()}</p>
                  </div>
                  {(p.stock ?? 0) <= 0 && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-lg flex-shrink-0" style={{ background: '#EF444415', color: '#EF4444' }}>Out of stock</span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Mobile sticky bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-4 py-3"
        style={{ background: 'var(--viro-bgCard)', borderTop: '1px solid var(--viro-border)', boxShadow: '0 -4px 16px rgba(0,0,0,0.08)' }}>
        {outOfStock ? (
          <div className="text-center py-2 font-bold text-sm" style={{ color: '#EF4444' }}>⛔ Out of Stock</div>
        ) : (
          <div className="flex gap-2">
            <button onClick={handleAdd}
              className="flex-1 py-2.5 rounded-xl font-bold text-xs"
              style={{ border: added ? '1.5px solid #10B98160' : '1.5px solid #7C3AED50', background: added ? '#10B98115' : 'var(--viro-bgDeep)', color: added ? '#10B981' : 'var(--viro-text)' }}>
              {added ? '✓ Added!' : '🛒 Add'}
            </button>
            <button onClick={handleBuyNow}
              className="flex-[1.6] py-2.5 rounded-xl font-bold text-sm text-white"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)', border: 'none', boxShadow: '0 3px 12px rgba(124,58,237,0.4)' }}>
              ⚡ Buy Deal — Rs.{deal.bundlePrice?.toLocaleString()}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
