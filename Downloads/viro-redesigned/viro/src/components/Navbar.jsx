import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useCart } from '../context/CartContext'

const NAV = [
  { path: '/',      label: 'Home',  icon: '🏠' },
  { path: '/shop',  label: 'Shop',  icon: '🛍️' },
  { path: '/cart',  label: 'Cart',  icon: '🛒' },
  { path: '/admin', label: 'Admin', icon: '⚙️' },
]

export default function Navbar() {
  const { cartCount } = useCart()
  const location = useLocation()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-20 z-40 items-center py-6 gap-6"
        style={{ background: '#080E1C', borderRight: '1px solid #1E293B' }}>
        <Link to="/">
          <img src="/logo.jpg" alt="Viro" className="w-12 h-12 rounded-xl object-cover shadow-lg" />
        </Link>
        <nav className="flex flex-col gap-2 flex-1">
          {NAV.map(n => {
            const active = location.pathname === n.path
            return (
              <Link key={n.path} to={n.path}
                className="flex flex-col items-center gap-1 p-3 rounded-xl transition-all text-xs font-medium"
                style={active ? {
                  background: 'linear-gradient(135deg,#00BFFF15,#8B5CF630)',
                  color: '#A78BFA',
                  border: '1px solid #8B5CF640',
                } : { color: '#475569' }}>
                <span className="text-xl relative">
                  {n.icon}
                  {n.label === 'Cart' && cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
                      style={{ background: 'linear-gradient(135deg,#8B5CF6,#F97316)', fontSize: 9 }}>
                      {cartCount > 9 ? '9+' : cartCount}
                    </span>
                  )}
                </span>
                {n.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex"
        style={{ background: '#080E1C', borderTop: '1px solid #1E293B', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV.map(n => {
          const active = location.pathname === n.path
          return (
            <Link key={n.path} to={n.path} className="flex-1 flex flex-col items-center py-2.5 gap-0.5">
              <span className="text-xl relative">
                {n.icon}
                {n.label === 'Cart' && cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
                    style={{ background: 'linear-gradient(135deg,#8B5CF6,#F97316)', fontSize: 9 }}>
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </span>
              <span className="text-xs font-semibold"
                style={{ color: active ? '#A78BFA' : '#475569' }}>
                {n.label}
              </span>
              {active && (
                <span className="absolute bottom-0 w-8 h-0.5 rounded-full"
                  style={{ background: 'linear-gradient(90deg,#00BFFF,#8B5CF6)' }} />
              )}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
