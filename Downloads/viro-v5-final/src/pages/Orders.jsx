import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STATUS_STYLES = {
  UNPAID:     { bg:'#F9731615', color:'#F97316', border:'#F9731640', icon:'⏳' },
  CONFIRMED:  { bg:'#8B5CF615', color:'#A78BFA', border:'#8B5CF640', icon:'✅' },
  PROCESSING: { bg:'#00BFFF15', color:'#00BFFF', border:'#00BFFF40', icon:'⚙️' },
  SHIPPED:    { bg:'#3B82F615', color:'#60A5FA', border:'#3B82F640', icon:'🚚' },
  DELIVERED:  { bg:'#10B98115', color:'#10B981', border:'#10B98140', icon:'📦' },
  CANCELLED:  { bg:'#EF444415', color:'#F87171', border:'#EF444440', icon:'❌' },
}

export default function Orders() {
  const [orders, setOrders]   = useState([])
  const [phone, setPhone]     = useState('')
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  // On mount: load from localStorage first (immediate, no network needed)
  const localOrders = (() => {
    try { return JSON.parse(localStorage.getItem('viro_orders') || '[]') } catch { return [] }
  })()

  // Try to fetch fresh status from Supabase for known orders
  async function fetchFromSupabase(ph) {
    setLoading(true)
    try {
      // Find customer by phone
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name')
        .eq('phone', ph.trim())

      if (!customers?.length) { setOrders([]); setSearched(true); setLoading(false); return }

      const ids = customers.map(c => c.id)
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*, customers(name, phone, city, address), order_items(quantity, price, products(name))')
        .in('customer_id', ids)
        .order('created_at', { ascending: false })

      setOrders(ordersData || [])
    } catch (e) {
      // Fallback to local
      setOrders(localOrders)
    }
    setSearched(true)
    setLoading(false)
  }

  function handleSearch(e) {
    e.preventDefault()
    if (!input.trim()) return
    setPhone(input.trim())
    fetchFromSupabase(input.trim())
  }

  // Auto-load if we have saved phone
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('viro_user_info') || '{}')
      if (saved.phone) {
        setInput(saved.phone)
        setPhone(saved.phone)
        fetchFromSupabase(saved.phone)
      }
    } catch {}
  }, [])

  return (
    <div className="pb-6 slide-up" style={{ background:'#0F172A', minHeight:'100vh' }}>
      <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor:'#1E293B' }}>
        <h1 className="font-display text-xl font-bold text-white mb-1">My Orders</h1>
        <p className="text-xs" style={{ color:'#64748B' }}>Track your order status in real-time</p>
      </div>

      {/* Phone search */}
      <div className="px-4 pt-4">
        <form onSubmit={handleSearch} className="flex gap-2 mb-5">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Enter your phone number…"
            type="tel"
            className="flex-1"
            style={{ background:'#1E293B', borderColor:'#334155' }}
          />
          <button type="submit"
            className="px-4 py-3 rounded-xl font-bold text-white flex-shrink-0 text-sm"
            style={{ background:'linear-gradient(135deg,#00BFFF,#8B5CF6)' }}>
            🔍 Find
          </button>
        </form>

        {loading && (
          <div className="flex flex-col items-center py-10 gap-3">
            <svg className="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="3"/>
              <path className="opacity-75" fill="#8B5CF6" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <p className="text-sm" style={{ color:'#64748B' }}>Fetching your orders…</p>
          </div>
        )}

        {!loading && searched && orders.length === 0 && (
          <div className="text-center py-12" style={{ color:'#64748B' }}>
            <div className="text-5xl mb-4">📭</div>
            <p className="font-bold text-white">No orders found</p>
            <p className="text-sm mt-1">Try the phone number you used when ordering</p>
            <Link to="/shop" className="btn-primary mt-5 mx-auto px-6 py-3 text-sm w-fit">
              🛍️ Start Shopping
            </Link>
          </div>
        )}

        {!loading && !searched && localOrders.length === 0 && (
          <div className="text-center py-12" style={{ color:'#64748B' }}>
            <div className="text-5xl mb-4">🛒</div>
            <p className="font-bold text-white">No orders yet</p>
            <p className="text-sm mt-1">Your order history will appear here after you place an order</p>
            <Link to="/shop"
              className="inline-flex items-center gap-2 mt-5 px-6 py-3 rounded-xl font-bold text-sm text-white"
              style={{ background:'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)' }}>
              🛍️ Shop Now
            </Link>
          </div>
        )}

        {/* Orders list */}
        {!loading && orders.length > 0 && (
          <div className="space-y-4">
            {orders.map(order => {
              const st = STATUS_STYLES[order.status] || STATUS_STYLES.UNPAID
              const customer = order.customers
              const items = order.order_items || []
              const isFree = (order.delivery_charges || 0) === 0

              return (
                <div key={order.id} className="viro-card overflow-hidden fade-in">
                  {/* Header */}
                  <div className="px-4 py-3 flex items-center justify-between border-b"
                    style={{ background:'#1E2A3B', borderColor:'#334155' }}>
                    <div>
                      <p className="text-xs font-mono" style={{ color:'#64748B' }}>
                        #{order.id?.slice(0,8).toUpperCase()}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color:'#64748B' }}>
                        {new Date(order.created_at).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' })}
                        {' · '}
                        {new Date(order.created_at).toLocaleTimeString('en-PK', { hour:'2-digit', minute:'2-digit' })}
                      </p>
                    </div>
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                      style={{ background: st.bg, color: st.color, border:`1px solid ${st.border}` }}>
                      {st.icon} {order.status}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="px-4 py-3 border-b" style={{ borderColor:'#1E293B' }}>
                    <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color:'#64748B' }}>Items</p>
                    <div className="space-y-1.5">
                      {items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-white truncate flex-1 mr-2">
                            {item.products?.name || 'Product'} <span style={{ color:'#64748B' }}>×{item.quantity}</span>
                          </span>
                          <span className="flex-shrink-0 font-semibold" style={{ color:'#A78BFA' }}>
                            Rs.{(item.price * item.quantity)?.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bill */}
                  <div className="px-4 py-3 border-b" style={{ borderColor:'#1E293B' }}>
                    <div className="flex justify-between text-sm mb-1">
                      <span style={{ color:'#94A3B8' }}>Subtotal</span>
                      <span className="text-white">Rs.{order.total_price?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span style={{ color:'#94A3B8' }}>Delivery</span>
                      <span className={isFree ? 'text-emerald-400 font-semibold' : 'text-white'}>
                        {isFree ? '🎉 FREE' : `Rs.${order.delivery_charges}`}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-2" style={{ borderColor:'#334155' }}>
                      <span className="text-white">Total to Pay</span>
                      <span className="text-lg" style={{ color:'#7C3AED' }}>Rs.{order.final_total?.toLocaleString()}</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color:'#475569' }}>💵 Cash on Delivery</p>
                  </div>

                  {/* Delivery info */}
                  {customer && (
                    <div className="px-4 py-3 border-b" style={{ borderColor:'#1E293B' }}>
                      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color:'#64748B' }}>Delivery To</p>
                      <p className="text-sm text-white">{customer.name}</p>
                      <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>{customer.city} · {customer.address}</p>
                    </div>
                  )}

                  {/* Status message */}
                  <div className="px-4 py-3">
                    <p className="text-xs leading-relaxed" style={{ color:'#64748B' }}>
                      {order.status === 'UNPAID'     && '⏳ Awaiting confirmation from our team. We will call or WhatsApp you shortly.'}
                      {order.status === 'CONFIRMED'  && '✅ Your order is confirmed! We are preparing it for dispatch.'}
                      {order.status === 'PROCESSING' && '⚙️ Your order is being packed and prepared for shipping.'}
                      {order.status === 'SHIPPED'    && '🚚 Your order is on the way! Expect delivery soon.'}
                      {order.status === 'DELIVERED'  && '📦 Order delivered! Thank you for shopping with Viro.'}
                      {order.status === 'CANCELLED'  && '❌ This order was cancelled. Contact us for details.'}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <a href={`https://wa.me/923277796566?text=${encodeURIComponent(`Hi Viro! I want to check my order #${order.id?.slice(0,8).toUpperCase()}`)}`}
                        target="_blank" rel="noopener"
                        className="flex-1 text-center py-2 rounded-xl text-xs font-bold"
                        style={{ background:'#25D36615', color:'#25D366', border:'1px solid #25D36630' }}>
                        💬 WhatsApp
                      </a>
                      <a href="tel:+923277796566"
                        className="flex-1 text-center py-2 rounded-xl text-xs font-bold"
                        style={{ background:'#00BFFF15', color:'#00BFFF', border:'1px solid #00BFFF30' }}>
                        📞 Call Us
                      </a>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Show local orders as fallback if no search yet */}
        {!loading && !searched && localOrders.length > 0 && (
          <div className="mb-4">
            <p className="text-xs mb-3" style={{ color:'#64748B' }}>Showing locally saved orders. Search by phone for live status.</p>
            <div className="space-y-3">
              {localOrders.map((order, idx) => {
                const st = STATUS_STYLES[order.status] || STATUS_STYLES.UNPAID
                return (
                  <div key={idx} className="viro-card p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-xs font-mono" style={{ color:'#64748B' }}>#{order.id?.slice(0,8).toUpperCase()}</p>
                        <p className="text-xs mt-0.5" style={{ color:'#64748B' }}>{new Date(order.created_at).toLocaleDateString('en-PK', { day:'2-digit', month:'short' })}</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                        style={{ background: st.bg, color: st.color, border:`1px solid ${st.border}` }}>
                        {st.icon} {order.status}
                      </span>
                    </div>
                    {order.items?.map((it, i) => (
                      <p key={i} className="text-sm text-white">{it.name} <span style={{ color:'#64748B' }}>×{it.quantity}</span></p>
                    ))}
                    <div className="flex justify-between mt-3 pt-2 border-t text-sm font-bold" style={{ borderColor:'#334155' }}>
                      <span style={{ color:'#94A3B8' }}>Total</span>
                      <span style={{ color:'#7C3AED' }}>Rs.{order.final_total?.toLocaleString()}</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color:'#475569' }}>Search by phone for live status update</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
