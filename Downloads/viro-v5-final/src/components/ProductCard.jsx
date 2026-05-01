import React from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'

export default function ProductCard({ product }) {
  const { addToCart } = useCart()
  const images = Array.isArray(product.images) ? product.images
    : (typeof product.images === 'string' ? JSON.parse(product.images || '[]') : [])
  const thumb = images[0] || 'https://placehold.co/400x400/F8FAFC/8B5CF6?text=Viro'
  const hasDiscount = product.discount_price && product.discount_price < product.price
  const displayPrice = hasDiscount ? product.discount_price : product.price
  const inStock = product.stock > 0
  const discountPct = hasDiscount ? Math.round((1 - product.discount_price / product.price) * 100) : 0

  return (
    <div
      className="group rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
      }}>

      {/* Image */}
      <Link to={`/product/${product.id}`} className="block flex-shrink-0">
        <div className="relative overflow-hidden" style={{ aspectRatio: '1/1', background: '#F8FAFC' }}>
          <img
            src={thumb}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Out of stock overlay */}
          {!inStock && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
              <span className="text-red-500 font-bold text-xs px-3 py-1 rounded-full border border-red-200 bg-red-50">
                Out of Stock
              </span>
            </div>
          )}

          {/* Discount badge */}
          {hasDiscount && inStock && (
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#F97316)', fontSize: '11px' }}>
              -{discountPct}%
            </div>
          )}

          {/* Stock badge */}
          {inStock && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full font-semibold"
              style={{ background: '#DCFCE7', color: '#16A34A', border: '1px solid #BBF7D0', fontSize: '10px' }}>
              ✓ In Stock
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="p-2.5 flex flex-col flex-1">
        <Link to={`/product/${product.id}`} className="flex-1">
          <h3
            className="font-semibold leading-snug mb-1.5 line-clamp-2"
            style={{ color: '#0F172A', fontSize: '13px' }}>
            {product.name}
          </h3>
        </Link>

        {/* Price */}
        <div className="flex items-baseline gap-1.5 mb-2 flex-wrap">
          <span className="font-extrabold" style={{ color: '#7C3AED', fontSize: '14px' }}>
            Rs.{displayPrice?.toLocaleString()}
          </span>
          {hasDiscount && (
            <span className="line-through" style={{ color: '#94A3B8', fontSize: '11px' }}>
              Rs.{product.price?.toLocaleString()}
            </span>
          )}
        </div>

        {/* Button */}
        <button
          disabled={!inStock}
          onClick={() => addToCart(product)}
          className="w-full rounded-xl font-bold text-white transition-all active:scale-95 disabled:opacity-40 mt-auto"
          style={{
            padding: '8px 0',
            fontSize: '12px',
            background: inStock
              ? 'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)'
              : '#E2E8F0',
            color: inStock ? '#fff' : '#94A3B8',
          }}>
          {inStock ? '🛒 Add to Cart' : '⛔ Unavailable'}
        </button>
      </div>
    </div>
  )
}
