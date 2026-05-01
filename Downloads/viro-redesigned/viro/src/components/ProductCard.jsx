import React from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'

export default function ProductCard({ product }) {
  const { addToCart } = useCart()
  const images = Array.isArray(product.images) ? product.images
    : (typeof product.images === 'string' ? JSON.parse(product.images || '[]') : [])
  const thumb = images[0] || 'https://placehold.co/400x400/F1F5F9/8B5CF6?text=Viro'
  const hasDiscount = product.discount_price && product.discount_price < product.price
  const displayPrice = hasDiscount ? product.discount_price : product.price
  const inStock = product.stock > 0
  const discountPct = hasDiscount ? Math.round((1 - product.discount_price / product.price) * 100) : 0

  return (
    <div className="group rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl slide-up"
      style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>

      <Link to={`/product/${product.id}`} className="block">
        <div className="relative overflow-hidden" style={{ aspectRatio: '1/1', background: '#F8FAFC' }}>
          <img src={thumb} alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />

          {/* Out of stock overlay */}
          {!inStock && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
              <span className="text-red-500 font-bold text-xs px-3 py-1.5 rounded-full border-2 border-red-200 bg-red-50">
                Out of Stock
              </span>
            </div>
          )}

          {/* Discount badge */}
          {hasDiscount && inStock && (
            <div className="absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-bold text-white shadow-lg"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #F97316)' }}>
              -{discountPct}%
            </div>
          )}

          {/* Stock badge */}
          {inStock && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: '#DCFCE7', color: '#16A34A', border: '1px solid #BBF7D0' }}>
              ✓ In Stock
            </div>
          )}
        </div>
      </Link>

      <div className="p-3" style={{ background: '#FFFFFF' }}>
        <Link to={`/product/${product.id}`}>
          <h3 className="font-semibold text-sm leading-snug mb-2 line-clamp-2"
            style={{ color: '#0F172A' }}>
            {product.name}
          </h3>
        </Link>

        {/* Price row */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="font-extrabold text-base" style={{ color: '#7C3AED' }}>
            Rs. {displayPrice?.toLocaleString()}
          </span>
          {hasDiscount && (
            <span className="text-xs line-through" style={{ color: '#94A3B8' }}>
              Rs. {product.price?.toLocaleString()}
            </span>
          )}
        </div>

        <button
          disabled={!inStock}
          onClick={() => addToCart(product)}
          className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: inStock ? 'linear-gradient(135deg, #00BFFF, #8B5CF6, #F97316)' : '#E2E8F0' }}>
          {inStock ? '🛒 Add to Cart' : '⛔ Unavailable'}
        </button>
      </div>
    </div>
  )
}
