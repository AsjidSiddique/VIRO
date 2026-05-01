import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'

export default function Cart() {
  const { cart, removeFromCart, updateQty, cartTotal, cartCount } = useCart()
  const navigate = useNavigate()

  if (cart.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="text-7xl mb-4">🛒</div>
      <h2 className="font-display text-xl font-bold text-white mb-2">Your cart is empty</h2>
      <p className="text-slate-400 text-sm mb-6">Add some products to get started!</p>
      <Link to="/shop" className="btn-primary px-8 py-3">Browse Products</Link>
    </div>
  )

  return (
    <div className="px-4 pb-6">
      <h1 className="font-display text-xl font-bold text-white py-4">
        My Cart <span className="text-slate-500 text-base font-normal">({cartCount} items)</span>
      </h1>

      <div className="space-y-3 mb-6">
        {cart.map(item => {
          const images = Array.isArray(item.images) ? item.images : (typeof item.images === 'string' ? JSON.parse(item.images || '[]') : [])
          const thumb = images[0] || 'https://placehold.co/200x200/0F1629/8B5CF6?text=V'
          const itemPrice = item.discount_price || item.price

          return (
            <div key={item.id} className="viro-card p-3 flex gap-3 items-center slide-up">
              <Link to={`/product/${item.id}`} className="flex-shrink-0">
                <img src={thumb} alt={item.name} className="w-16 h-16 rounded-xl object-cover" />
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/product/${item.id}`}>
                  <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                </Link>
                <p className="text-sm font-bold mt-1" style={{ color: '#00BFFF' }}>
                  Rs. {itemPrice?.toLocaleString()}
                </p>
                {item.discount_price && item.discount_price < item.price && (
                  <p className="text-xs text-slate-500 line-through">Rs. {item.price?.toLocaleString()}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <button onClick={() => removeFromCart(item.id)}
                  className="text-red-400/60 hover:text-red-400 text-xs transition-colors">✕</button>
                <div className="flex items-center gap-1 viro-card px-2 py-1 rounded-xl">
                  <button onClick={() => updateQty(item.id, item.quantity - 1)}
                    className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white font-bold">−</button>
                  <span className="w-6 text-center text-sm font-bold text-white">{item.quantity}</span>
                  <button onClick={() => updateQty(item.id, item.quantity + 1)}
                    className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white font-bold">+</button>
                </div>
                <p className="text-xs text-slate-400 font-semibold">
                  Rs. {(itemPrice * item.quantity)?.toLocaleString()}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary card */}
      <div className="viro-card p-4 mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-400">Subtotal ({cartCount} items)</span>
          <span className="font-semibold text-white">Rs. {cartTotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm mb-3">
          <span className="text-slate-400">Delivery</span>
          <span className="text-purple-400 text-xs">Calculated at checkout</span>
        </div>
        <div className="border-t pt-3" style={{ borderColor: '#1E2A45' }}>
          <div className="flex justify-between font-bold text-white">
            <span>Subtotal</span>
            <span className="text-lg" style={{ color: '#00BFFF' }}>Rs. {cartTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <button onClick={() => navigate('/checkout')} className="btn-primary w-full py-4 text-base font-bold">
        Proceed to Checkout →
      </button>
    </div>
  )
}
