'use client'
import { slugify } from '../../lib/slugify'
import Image from 'next/image'
import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useWishlist } from '../../context/WishlistContext'
import { useCart, parseImages } from '../../context/CartContext'

export default function WishlistClient() {
  const { wishlist, removeFromWishlist, priceAlerts } = useWishlist()
  const { addToCart } = useCart()
  const router = useRouter()
  const [addedMap, setAddedMap] = useState({})
  const [removingMap, setRemovingMap] = useState({})

  function handleAddToCart(product) {
    addToCart(product)
    setAddedMap(m => ({ ...m, [product.id]: true }))
    setTimeout(() => setAddedMap(m => ({ ...m, [product.id]: false })), 1400)
  }

  function handleRemove(id) {
    setRemovingMap(m => ({ ...m, [id]: true }))
    setTimeout(() => {
      removeFromWishlist(id)
      setRemovingMap(m => ({ ...m, [id]: false }))
    }, 280)
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (wishlist.length === 0) {
    return (
      <div style={{
        minHeight: '85vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 16px', textAlign: 'center',
        background: 'var(--viro-sectionBg)',
      }}>
        <style>{`
          @keyframes heartFloat {
            0%,100% { transform: translateY(0) scale(1) }
            50%      { transform: translateY(-10px) scale(1.08) }
          }
          .empty-heart { animation: heartFloat 2.4s ease-in-out infinite }
        `}</style>
        <div className="empty-heart" style={{ fontSize: 80, marginBottom: 20 }}>🤍</div>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: 'var(--viro-text)', margin: '0 0 10px' }}>
          Your Wishlist is Empty
        </h2>
        <p style={{ color: 'var(--viro-textSub)', fontSize: 14, marginBottom: 32, maxWidth: 280, lineHeight: 1.6 }}>
          Tap the ❤️ on any product to save it here for later.
        </p>
        <Link href="/shop" style={{
          padding: '13px 36px', borderRadius: 50, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)',
          color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none',
          display: 'inline-block', boxShadow: '0 8px 24px rgba(139,92,246,0.35)',
          letterSpacing: '0.3px',
        }}>
          🛍️ Explore Shop
        </Link>
      </div>
    )
  }

  // ── Wishlist grid ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--viro-sectionBg)' }}>
      <style>{`
        @keyframes wishCardIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97) }
          to   { opacity: 1; transform: translateY(0)    scale(1) }
        }
        @keyframes wishCardOut {
          from { opacity: 1; transform: scale(1) }
          to   { opacity: 0; transform: scale(0.88) }
        }
        .wish-card {
          animation: wishCardIn 0.32s cubic-bezier(.4,0,.2,1) both;
          transition: transform 0.22s, box-shadow 0.22s;
        }
        .wish-card:hover {
          transform: translateY(-5px) !important;
          box-shadow: 0 16px 40px rgba(139,92,246,0.18) !important;
        }
        .wish-card.removing {
          animation: wishCardOut 0.28s cubic-bezier(.4,0,.2,1) both;
        }
        .wish-cart-btn {
          transition: all 0.18s;
        }
        .wish-cart-btn:active { transform: scale(0.94) }
        .wish-order-btn {
          transition: all 0.18s;
        }
        .wish-order-btn:hover { filter: brightness(1.08) }
        .wish-order-btn:active { transform: scale(0.94) }
        .wish-heart-btn {
          transition: transform 0.15s, background 0.15s;
        }
        .wish-heart-btn:hover { transform: scale(1.15) !important }
        .wish-heart-btn:active { transform: scale(0.88) !important }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 14px 40px' }}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 24, paddingBottom: 16,
          borderBottom: '1px solid var(--viro-border)',
        }}>
          <div>
            <h1 style={{
              fontSize: 26, fontWeight: 900, color: 'var(--viro-text)',
              margin: 0, display: 'flex', alignItems: 'center', gap: 10,
            }}>
              ❤️ My Wishlist
            </h1>
            <p style={{ fontSize: 13, color: 'var(--viro-textSub)', margin: '5px 0 0' }}>
              {wishlist.length} saved item{wishlist.length !== 1 ? 's' : ''} · tap to manage
            </p>
          </div>
          <Link href="/shop" style={{
            fontSize: 12, fontWeight: 700,
            color: '#8B5CF6', textDecoration: 'none',
            padding: '7px 14px', borderRadius: 20,
            border: '1.5px solid #8B5CF640',
            background: '#8B5CF608',
            whiteSpace: 'nowrap',
          }}>
            + Add More
          </Link>
        </div>

        {/* ── Price Alerts ──────────────────────────────────────────────────── */}
        {priceAlerts?.length > 0 && (
          <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {priceAlerts.map(alert => (
              <div key={alert.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 12,
                background: alert.type === 'drop'
                  ? 'linear-gradient(135deg,rgba(16,185,129,0.1),rgba(5,150,105,0.08))'
                  : 'linear-gradient(135deg,rgba(249,115,22,0.1),rgba(239,68,68,0.08))',
                border: `1.5px solid ${alert.type === 'drop' ? 'rgba(16,185,129,0.3)' : 'rgba(249,115,22,0.3)'}`,
              }}>
                <span style={{ fontSize: 22 }}>{alert.type === 'drop' ? '🎉' : '📈'}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: 'var(--viro-text)', lineHeight: 1.3 }}>
                    {alert.type === 'drop'
                      ? `Price dropped on "${alert.name.slice(0,30)}${alert.name.length>30?'…':''}"`
                      : `Price updated on "${alert.name.slice(0,30)}${alert.name.length>30?'…':''}"`
                    }
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: alert.type === 'drop' ? '#10B981' : '#F97316', fontWeight: 700 }}>
                    {alert.type === 'drop'
                      ? `Rs.${alert.oldPrice?.toLocaleString()} → Rs.${alert.newPrice?.toLocaleString()} · Save Rs.${alert.saving?.toLocaleString()} (${alert.pct}% off!)`
                      : `Rs.${alert.oldPrice?.toLocaleString()} → Rs.${alert.newPrice?.toLocaleString()} · Price rose by ${alert.pct}%`
                    }
                  </p>
                </div>
                <a href={`/product/${alert.id}`} style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800,
                  background: alert.type === 'drop' ? '#10B981' : '#F97316',
                  color: '#fff', textDecoration: 'none', whiteSpace: 'nowrap',
                }}>
                  {alert.type === 'drop' ? 'Buy Now' : 'View'}
                </a>
              </div>
            ))}
          </div>
        )}

        {/* ── Product Grid ───────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
          gap: 14,
        }}>
          {wishlist.map((product, idx) => {
            const images = parseImages(product.images)
            const thumb = images[0] || 'https://placehold.co/400x300/F1F5F9/8B5CF6?text=Viro'
            const hasDiscount = product.discount_price && product.discount_price < product.price
            const displayPrice = hasDiscount ? product.discount_price : product.price
            const inStock = product.stock > 0 && product.status !== 'out_of_stock' && product.status !== 'coming_soon'
            const discPct = hasDiscount ? Math.round((1 - product.discount_price / product.price) * 100) : 0
            const isAdded = addedMap[product.id]
            const isRemoving = removingMap[product.id]

            return (
              <div
                key={product.id}
                className={`wish-card${isRemoving ? ' removing' : ''}`}
                style={{
                  animationDelay: `${idx * 0.04}s`,
                  background: 'var(--viro-bgCard)',
                  border: '1px solid var(--viro-border)',
                  borderRadius: 18,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 3px 14px rgba(0,0,0,0.08)',
                }}
              >
                {/* ── Image ── */}
                <div style={{
                  position: 'relative', paddingTop: '72%',
                  background: 'var(--viro-bgDeep)', overflow: 'hidden',
                }}>
                  <Link href={`/product/${slugify(product.name)}-${product.id}`}>
                    <Image
                      src={thumb} alt={product.name}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      style={{ objectFit: 'cover', transition: 'transform 0.5s ease' }}
                    />
                  </Link>

                  {/* Discount badge */}
                  {hasDiscount && (
                    <div style={{
                      position: 'absolute', top: 8, left: 8,
                      background: 'linear-gradient(135deg,#EF4444,#F97316)',
                      color: '#fff', fontWeight: 900, fontSize: 9,
                      padding: '3px 7px', borderRadius: 6,
                      boxShadow: '0 2px 8px rgba(239,68,68,0.4)',
                      letterSpacing: '0.3px',
                    }}>
                      -{discPct}%
                    </div>
                  )}

                  {/* Remove heart button */}
                  <button
                    className="wish-heart-btn"
                    onClick={() => handleRemove(product.id)}
                    title="Remove from wishlist"
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.95)',
                      border: '1.5px solid #FECDD3',
                      cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, boxShadow: '0 2px 8px rgba(239,68,68,0.2)',
                    }}
                  >❤️</button>

                  {/* Stock badge */}
                  {!inStock && (
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      padding: '5px 8px', textAlign: 'center', fontSize: 10, fontWeight: 700,
                      background: product.status === 'coming_soon'
                        ? 'rgba(124,58,237,0.85)'
                        : 'rgba(220,38,38,0.82)',
                      color: '#fff', backdropFilter: 'blur(4px)',
                    }}>
                      {product.status === 'coming_soon' ? '🚀 Coming Soon' : '❌ Out of Stock'}
                    </div>
                  )}
                </div>

                {/* ── Body ── */}
                <div style={{ padding: '10px 11px 12px', display: 'flex', flexDirection: 'column', flex: 1 }}>

                  {/* Category pill */}
                  {product.categories && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5,
                      background: '#8B5CF612', color: '#A78BFA',
                      border: '1px solid #8B5CF625',
                      marginBottom: 5, alignSelf: 'flex-start',
                    }}>
                      {product.categories.icon} {product.categories.name}
                    </div>
                  )}

                  {/* Name */}
                  <Link href={`/product/${slugify(product.name)}-${product.id}`} style={{ textDecoration: 'none' }}>
                    <p style={{
                      margin: '0 0 6px', color: 'var(--viro-text)', fontWeight: 700,
                      fontSize: 12, lineHeight: 1.38,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>{product.name}</p>
                  </Link>

                  {/* Price — show change indicator if price moved */}
                  {(() => {
                    const alert = priceAlerts?.find(a => a.id === product.id)
                    return (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                          <span style={{ color: '#7C3AED', fontWeight: 900, fontSize: 14, letterSpacing: '-0.3px' }}>
                            Rs.{displayPrice?.toLocaleString()}
                          </span>
                          {hasDiscount && (
                            <span style={{ color: '#94A3B8', fontSize: 10, textDecoration: 'line-through' }}>
                              Rs.{product.price?.toLocaleString()}
                            </span>
                          )}
                        </div>
                        {alert && (
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 3,
                            fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 6,
                            background: alert.type === 'drop' ? 'rgba(16,185,129,0.1)' : 'rgba(249,115,22,0.1)',
                            color: alert.type === 'drop' ? '#10B981' : '#F97316',
                            border: `1px solid ${alert.type === 'drop' ? 'rgba(16,185,129,0.3)' : 'rgba(249,115,22,0.3)'}`,
                          }}>
                            {alert.type === 'drop' ? `↓ ${alert.pct}% DROP` : `↑ ${alert.pct}% RISE`}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Low stock warning */}
                  {inStock && product.stock <= 5 && (
                    <p style={{ color: '#F97316', fontSize: 10, fontWeight: 700, margin: '-4px 0 8px', }}>
                      ⚠️ Only {product.stock} left!
                    </p>
                  )}

                  {/* CTA Buttons */}
                  <div style={{ marginTop: 'auto', display: 'flex', gap: 6 }}>
                    {inStock ? (
                      <>
                        <button
                          className="wish-cart-btn"
                          onClick={() => handleAddToCart(product)}
                          style={{
                            flex: 1, border: '1.5px solid var(--viro-border)',
                            cursor: 'pointer', borderRadius: 10,
                            padding: '7px 0', fontSize: 11, fontWeight: 700,
                            background: isAdded
                              ? 'linear-gradient(135deg,#10B981,#059669)'
                              : 'var(--viro-bgDeep)',
                            color: isAdded ? '#fff' : 'var(--viro-text)',
                          }}
                        >
                          {isAdded ? '✓ Added' : '🛒 Cart'}
                        </button>
                        <button
                          className="wish-order-btn"
                          onClick={() => {
                            sessionStorage.setItem('viro_quick_order', JSON.stringify([{ ...product, quantity: 1 }]))
                            router.push('/checkout?quick=1&t=' + Date.now())
                          }}
                          style={{
                            flex: 1.4, border: 'none', cursor: 'pointer', borderRadius: 10,
                            padding: '7px 0', fontSize: 11, fontWeight: 800,
                            background: 'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)',
                            color: '#fff',
                            boxShadow: '0 3px 10px rgba(139,92,246,0.3)',
                          }}
                        >
                          ⚡ Buy
                        </button>
                      </>
                    ) : (
                      <div style={{
                        flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 700,
                        color: product.status === 'coming_soon' ? '#7C3AED' : '#DC2626',
                        padding: '7px 0',
                        background: product.status === 'coming_soon' ? '#EDE9FE' : '#FEE2E2',
                        borderRadius: 10,
                      }}>
                        {product.status === 'coming_soon' ? '🚀 Coming Soon' : '📵 Unavailable'}
                      </div>
                    )}
                  </div>

                  {/* View detail link */}
                  <Link href={`/product/${slugify(product.name)}-${product.id}`} style={{
                    display: 'block', textAlign: 'center', marginTop: 8,
                    fontSize: 10, color: 'var(--viro-textSub)', textDecoration: 'none',
                    fontWeight: 600, opacity: 0.75,
                  }}>
                    View Details →
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Bottom CTA ──────────────────────────────────────────────────────── */}
        <div style={{
          marginTop: 40, textAlign: 'center',
          padding: '28px 20px',
          background: 'var(--viro-bgCard)',
          borderRadius: 20,
          border: '1px solid var(--viro-border)',
        }}>
          <p style={{ color: 'var(--viro-textSub)', fontSize: 13, margin: '0 0 16px', fontWeight: 500 }}>
            Looking for more? Explore our full collection.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/shop" style={{
              padding: '11px 28px', borderRadius: 50,
              background: 'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)',
              color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none',
              boxShadow: '0 6px 20px rgba(139,92,246,0.3)',
            }}>
              🛍️ Browse Shop
            </Link>
            <Link href="/" style={{
              padding: '11px 28px', borderRadius: 50,
              background: 'var(--viro-bgDeep)',
              border: '1.5px solid var(--viro-border)',
              color: 'var(--viro-text)', fontWeight: 700, fontSize: 14, textDecoration: 'none',
            }}>
              🏠 Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
