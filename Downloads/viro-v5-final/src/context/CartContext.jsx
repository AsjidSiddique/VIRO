import React, { createContext, useContext, useState, useEffect } from 'react'
import { showToast } from '../components/Toast'

const CartContext = createContext()

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('viro_cart') || '[]') } catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem('viro_cart', JSON.stringify(cart))
  }, [cart])

  const addToCart = (product, qty = 1) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id)
      if (existing) {
        showToast(`+1 more "${product.name.slice(0, 28)}…" in cart — tap Cart to order!`, 'success')
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + qty } : i)
      }
      showToast(`"${product.name.slice(0, 30)}" added! Tap Cart to place order 🎉`, 'success')
      return [...prev, { ...product, quantity: qty }]
    })
  }

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id))

  const updateQty = (id, qty) => {
    if (qty < 1) return removeFromCart(id)
    setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i))
  }

  const clearCart = () => setCart([])

  const cartTotal = cart.reduce((sum, i) => sum + (i.discount_price || i.price) * i.quantity, 0)
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQty, clearCart, cartTotal, cartCount }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
