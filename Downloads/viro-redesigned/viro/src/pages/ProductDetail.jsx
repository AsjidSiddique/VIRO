import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCart } from '../context/CartContext'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToCart } = useCart()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeImg, setActiveImg] = useState(0)
  const [qty, setQty]   = useState(1)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    supabase.from('products').select('*').eq('id', id).single()
      .then(({ data }) => { setProduct(data); setLoading(false) })
  }, [id])

  if (loading) return (
    <div className="px-4 pt-6 animate-pulse" style={{ background: '#0F172A', minHeight: '100vh' }}>
      <div className="skeleton rounded-2xl mb-4" style={{ aspectRatio:'1/1', background:'#1E293B' }} />
      <div className="skeleton h-6 w-3/4 mb-2 rounded" style={{ background:'#1E293B' }} />
      <div className="skeleton h-4 w-1/2 mb-4 rounded" style={{ background:'#1E293B' }} />
      <div className="skeleton h-12 w-full rounded-xl" style={{ background:'#1E293B' }} />
    </div>
  )

  if (!product) return (
    <div className="text-center py-20 px-4" style={{ background:'#0F172A', minHeight:'100vh', color:'#64748B' }}>
      <div className="text-5xl mb-4">😕</div>
      <p className="text-white font-bold">Product not found</p>
      <button onClick={() => navigate('/shop')} className="btn-primary mt-4 mx-auto px-6 py-3">
        ← Back to Shop
      </button>
    </div>
  )

  const images = Array.isArray(product.images) ? product.images
    : (typeof product.images === 'string' ? JSON.parse(product.images || '[]') : [])
  const imgList = images.length > 0 ? images : ['/logo.jpg']
  const hasDiscount = product.discount_price && product.discount_price < product.price
  const displayPrice = hasDiscount ? product.discount_price : product.price
  const inStock = product.stock > 0
  const savings = hasDiscount ? product.price - product.discount_price : 0
  const discountPct = hasDiscount ? Math.round((savings / product.price) * 100) : 0

  function handleAddToCart() {
    for (let i = 0; i < qty; i++) addToCart(product)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <div className="pb-8 slide-up" style={{ background: '#0F172A', minHeight: '100vh' }}>
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm px-4 pt-4 pb-2 transition-colors"
        style={{ color: '#64748B' }}>
        ← Back
      </button>

      {/* Image Gallery */}
      <div className="px-4 mb-4">
        <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio:'1/1', background:'#FFFFFF' }}>
          <img src={imgList[activeImg]} alt={product.name}
            className="w-full h-full object-cover fade-in" key={activeImg} />
          {!inStock && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
              <span className="text-red-500 font-bold text-lg px-5 py-2 rounded-full border-2 border-red-200 bg-red-50">
                Out of Stock
              </span>
            </div>
          )}
          {hasDiscount && (
            <div className="absolute top-3 left-3 px-3 py-1 rounded-xl text-sm font-bold text-white shadow-lg"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#F97316)' }}>
              -{discountPct}% OFF
            </div>
          )}
        </div>

        {imgList.length > 1 && (
          <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide pb-1">
            {imgList.map((img, i) => (
              <button key={i} onClick={() => setActiveImg(i)}
                className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all"
                style={{ borderColor: activeImg === i ? '#8B5CF6' : '#E2E8F0', background: '#F8FAFC' }}>
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h1 className="font-display text-xl font-bold text-white leading-tight flex-1">{product.name}</h1>
          <div className={`px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${
            inStock
              ? 'text-emerald-600 bg-emerald-50 border border-emerald-200'
              : 'text-red-500 bg-red-50 border border-red-200'
          }`}>
            {inStock ? `✓ ${product.stock} left` : '✗ Out of Stock'}
          </div>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-3xl font-extrabold" style={{ color: '#7C3AED' }}>
            Rs. {displayPrice?.toLocaleString()}
          </span>
          {hasDiscount && (
            <div className="flex flex-col">
              <span className="text-slate-500 line-through text-sm">Rs. {product.price?.toLocaleString()}</span>
              <span className="text-xs font-bold" style={{ color: '#10B981' }}>
                Save Rs. {savings?.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {product.description && (
          <div className="viro-card p-4 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#64748B' }}>
              Description
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: '#CBD5E1' }}>{product.description}</p>
          </div>
        )}

        {inStock && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm" style={{ color: '#94A3B8' }}>Quantity:</span>
              <div className="flex items-center gap-2 viro-card px-3 py-2 rounded-xl">
                <button onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg text-white font-bold flex items-center justify-center hover:bg-white/10 transition-colors">
                  −
                </button>
                <span className="w-8 text-center font-bold text-white">{qty}</span>
                <button onClick={() => setQty(q => Math.min(product.stock, q + 1))}
                  className="w-8 h-8 rounded-lg text-white font-bold flex items-center justify-center hover:bg-white/10 transition-colors">
                  +
                </button>
              </div>
            </div>

            <button onClick={handleAddToCart}
              className="w-full py-4 rounded-2xl text-base font-bold text-white transition-all active:scale-98"
              style={added
                ? { background: 'linear-gradient(135deg,#10B981,#059669)' }
                : { background: 'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)' }}>
              {added ? '✓ Added to Cart!' : '🛒 Add to Cart'}
            </button>
          </>
        )}

        {!inStock && (
          <a href={`https://wa.me/923277796566?text=${encodeURIComponent(`Hi Viro! I want ${product.name} but it's out of stock. Will it be back?`)}`}
            target="_blank" rel="noopener"
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl text-base font-bold text-white mt-2"
            style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)' }}>
            💬 Ask on WhatsApp
          </a>
        )}
      </div>
    </div>
  )
}
