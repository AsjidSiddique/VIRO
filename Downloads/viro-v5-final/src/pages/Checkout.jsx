import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { supabase } from '../lib/supabase'
import { sendOrderEmail } from '../lib/email'
import { getDeliveryCharge, OTHER_CITIES_FREE_THRESHOLD, CONTACT } from '../lib/constants'

const STORAGE_KEY = 'viro_user_info'

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}

export default function Checkout() {
  const { cart, cartTotal, clearCart } = useCart()
  const navigate = useNavigate()

  const saved = loadSaved()
  const [form, setForm] = useState({
    name:    saved.name    || '',
    phone:   saved.phone   || '',
    email:   saved.email   || '',
    city:    saved.city    || '',
    address: saved.address || '',
  })
  const [step, setStep]     = useState('form')
  const [loading, setLoading] = useState(false)
  const [orderId, setOrderId] = useState(null)
  const [savedBanner, setSavedBanner] = useState(false)

  const isBurewala     = form.city.trim().toLowerCase() === 'burewala'
  const deliveryCharge = form.city.trim() ? getDeliveryCharge(form.city.trim(), cartTotal) : 150
  const isFree         = deliveryCharge === 0
  const finalTotal     = cartTotal + deliveryCharge

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  function goToReview(e) {
    e.preventDefault()
    if (!form.name || !form.phone || !form.city || !form.address) return
    // Save user info to localStorage for next time
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: form.name, phone: form.phone, email: form.email, city: form.city, address: form.address }))
    setSavedBanner(true)
    setStep('review')
    window.scrollTo(0, 0)
  }

  async function placeOrder() {
    setLoading(true)
    try {
      const { data: customer, error: cErr } = await supabase
        .from('customers')
        .insert({ name: form.name, phone: form.phone, city: form.city, address: form.address })
        .select().single()
      if (cErr) throw cErr

      const { data: order, error: oErr } = await supabase
        .from('orders')
        .insert({ customer_id: customer.id, total_price: cartTotal, delivery_charges: deliveryCharge, final_total: finalTotal, status: 'UNPAID' })
        .select().single()
      if (oErr) throw oErr

      await supabase.from('order_items').insert(
        cart.map(i => ({ order_id: order.id, product_id: i.id, quantity: i.quantity, price: i.discount_price || i.price }))
      )

      // Save order to local orders history
      const history = JSON.parse(localStorage.getItem('viro_orders') || '[]')
      history.unshift({ id: order.id, created_at: new Date().toISOString(), status: 'UNPAID', final_total: finalTotal, delivery_charges: deliveryCharge, city: form.city, name: form.name, items: cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.discount_price || i.price })) })
      localStorage.setItem('viro_orders', JSON.stringify(history.slice(0, 20)))

      if (form.email) {
        await sendOrderEmail({ name: form.name, email: form.email, orderId: order.id,
          items: cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.discount_price || i.price })),
          subtotal: cartTotal, deliveryCharge, finalTotal, city: form.city })
      }

      setOrderId(order.id)
      clearCart()
      setStep('success')
      window.scrollTo(0, 0)
    } catch (err) {
      console.error(err)
      alert('Something went wrong. Please try again or contact us on WhatsApp.')
    } finally {
      setLoading(false)
    }
  }

  if (cart.length === 0 && step !== 'success') { navigate('/cart'); return null }

  /* ── SUCCESS ── */
  if (step === 'success') return (
    <div className="px-4 py-10 flex flex-col items-center text-center justify-center slide-up"
      style={{ background: '#0F172A', minHeight: '80vh' }}>
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 text-4xl border-2 border-emerald-500"
        style={{ background: '#10B98120' }}>✅</div>
      <h1 className="font-display text-2xl font-bold text-white mb-3">Order Placed!</h1>
      <div className="viro-card p-4 mb-5 max-w-sm w-full text-left">
        <p className="text-sm mb-3" style={{ color: '#CBD5E1' }}>
          Order <span className="font-bold text-white">#{orderId?.slice(0,8).toUpperCase()}</span>
        </p>
        <div className="p-3 rounded-xl mb-3" style={{ background: '#F9731310', border: '1px solid #F9731440' }}>
          <p className="text-orange-400 font-bold text-sm">⚠️ Status: UNPAID</p>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>We will confirm via phone or WhatsApp</p>
        </div>
        {/* COD badge */}
        <div className="p-3 rounded-xl mb-3" style={{ background: '#8B5CF610', border: '1px solid #8B5CF640' }}>
          <p className="text-purple-400 font-bold text-sm">💵 Payment: Cash on Delivery</p>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Pay when your order arrives at your door</p>
        </div>
        <div className="space-y-1 text-sm border-t pt-3" style={{ borderColor: '#334155' }}>
          <div className="flex justify-between"><span style={{ color:'#94A3B8' }}>Subtotal</span><span className="text-white">Rs.{cartTotal.toLocaleString()}</span></div>
          <div className="flex justify-between">
            <span style={{ color:'#94A3B8' }}>Delivery</span>
            <span className={isFree ? 'text-emerald-400 font-bold' : 'text-white'}>{isFree ? 'FREE 🎉' : `Rs.${deliveryCharge}`}</span>
          </div>
          <div className="flex justify-between font-bold pt-1 border-t" style={{ borderColor: '#334155' }}>
            <span className="text-white text-base">Total to Pay</span>
            <span className="text-xl" style={{ color: '#7C3AED' }}>Rs.{finalTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-sm">
        <a href={`https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(`Hi Viro! I placed order #${orderId?.slice(0,8).toUpperCase()}. Name: ${form.name}, City: ${form.city}, Total: Rs.${finalTotal}. Please confirm.`)}`}
          target="_blank" rel="noopener"
          className="w-full py-3 rounded-xl font-bold text-white text-center"
          style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)' }}>
          💬 Confirm via WhatsApp
        </a>
        <button onClick={() => navigate('/orders')} className="btn-ghost w-full py-3">📋 View My Orders</button>
        <button onClick={() => navigate('/')} className="btn-ghost w-full py-3">🏠 Back to Home</button>
      </div>
    </div>
  )

  /* ── REVIEW ── */
  if (step === 'review') return (
    <div className="px-4 pb-6 slide-up" style={{ background: '#0F172A', minHeight: '100vh' }}>
      <div className="py-4 flex items-center gap-2">
        <button onClick={() => setStep('form')} style={{ color:'#64748B' }} className="text-lg">←</button>
        <h1 className="font-display text-xl font-bold text-white">Order Review</h1>
      </div>

      {/* Customer */}
      <div className="viro-card p-4 mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color:'#64748B' }}>Delivery Details</h3>
        {[['Name',form.name],['Phone',form.phone],['City',form.city],['Address',form.address]].map(([k,v]) => (
          <div key={k} className="flex justify-between gap-3 py-1 text-sm border-b last:border-0" style={{ borderColor:'#1E293B' }}>
            <span style={{ color:'#94A3B8' }}>{k}</span>
            <span className="text-white font-medium text-right flex-1">{v}</span>
          </div>
        ))}
      </div>

      {/* Items */}
      <div className="viro-card p-4 mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color:'#64748B' }}>Items ({cart.length})</h3>
        <div className="space-y-3">
          {cart.map(item => {
            const imgs = Array.isArray(item.images) ? item.images : JSON.parse(item.images || '[]')
            const price = item.discount_price || item.price
            return (
              <div key={item.id} className="flex items-center gap-3">
                <img src={imgs[0] || '/logo.jpg'} alt={item.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" style={{ background:'#F8FAFC' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.name}</p>
                  <p className="text-xs" style={{ color:'#64748B' }}>×{item.quantity} @ Rs.{price?.toLocaleString()}</p>
                </div>
                <span className="text-sm font-bold flex-shrink-0" style={{ color:'#7C3AED' }}>Rs.{(price*item.quantity).toLocaleString()}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bill breakdown */}
      <div className="viro-card p-4 mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color:'#64748B' }}>Bill Breakdown</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span style={{ color:'#94A3B8' }}>Items subtotal</span><span className="text-white">Rs.{cartTotal.toLocaleString()}</span></div>
          <div className="flex justify-between items-center">
            <span style={{ color:'#94A3B8' }}>Delivery charge</span>
            <span className={`font-semibold ${isFree ? 'text-emerald-400' : 'text-white'}`}>
              {isFree ? '🎉 FREE' : `Rs.${deliveryCharge}`}
            </span>
          </div>
          {isFree && (
            <p className="text-xs text-emerald-400/70 text-right">
              {isBurewala ? 'Burewala free ≥ Rs.550 ✓' : 'Free delivery ≥ Rs.2500 ✓'}
            </p>
          )}
          <div className="flex justify-between font-bold pt-2 border-t" style={{ borderColor:'#334155' }}>
            <span className="text-white text-base">Total to Pay</span>
            <span className="text-xl" style={{ color:'#7C3AED' }}>Rs.{finalTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* COD notice */}
      <div className="viro-card p-3 mb-5 flex items-center gap-3"
        style={{ background:'#8B5CF610', borderColor:'#8B5CF640' }}>
        <span className="text-2xl">💵</span>
        <div>
          <p className="text-sm font-bold text-white">Cash on Delivery</p>
          <p className="text-xs" style={{ color:'#94A3B8' }}>Pay Rs.{finalTotal.toLocaleString()} when order arrives</p>
        </div>
      </div>

      <button onClick={placeOrder} disabled={loading}
        className="btn-primary w-full py-4 text-base font-bold">
        {loading
          ? <span className="flex items-center gap-2 justify-center"><svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Placing Order…</span>
          : `✅ Place Order — Rs.${finalTotal.toLocaleString()}`}
      </button>
      <p className="text-center text-xs mt-2" style={{ color:'#475569' }}>💵 Cash on Delivery · No payment now</p>
    </div>
  )

  /* ── FORM ── */
  return (
    <div className="px-4 pb-6 slide-up" style={{ background: '#0F172A', minHeight: '100vh' }}>
      <h1 className="font-display text-xl font-bold text-white py-4">Checkout</h1>

      {/* Saved info banner */}
      {(saved.name || saved.phone) && (
        <div className="mb-4 p-3 rounded-xl flex items-center gap-2 text-xs fade-in"
          style={{ background:'#8B5CF610', border:'1px solid #8B5CF640' }}>
          <span>💾</span>
          <span style={{ color:'#A78BFA' }}>Your saved info is pre-filled. Just review and continue!</span>
          <button onClick={() => { setForm({ name:'', phone:'', email:'', city:'', address:'' }); localStorage.removeItem(STORAGE_KEY) }}
            className="ml-auto text-xs underline" style={{ color:'#64748B' }}>
            Clear
          </button>
        </div>
      )}

      <form onSubmit={goToReview} className="space-y-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color:'#64748B' }}>Full Name *</label>
          <input name="name" value={form.name} onChange={handleChange} placeholder="Muhammad Ali" required />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color:'#64748B' }}>Phone Number *</label>
          <input name="phone" value={form.phone} onChange={handleChange} placeholder="03XX XXXXXXX" type="tel" required />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color:'#64748B' }}>Email <span className="normal-case font-normal text-slate-600">(optional — for order confirmation)</span></label>
          <input name="email" value={form.email} onChange={handleChange} placeholder="you@email.com" type="email" />
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color:'#64748B' }}>City *</label>
          <input name="city" value={form.city} onChange={handleChange} placeholder="Burewala, Lahore, Multan…" required />
          {form.city.trim().length > 1 && (
            <div className="mt-2 p-3 rounded-xl text-sm fade-in"
              style={isFree ? { background:'#10B98115', border:'1px solid #10B98140' } : { background:'#1E293B', border:'1px solid #334155' }}>
              {isFree ? (
                <span className="text-emerald-400 font-semibold">
                  🎉 {isBurewala ? 'Free delivery in Burewala!' : 'Free delivery on your order!'}
                </span>
              ) : (
                <span style={{ color:'#94A3B8' }}>
                  🚚 Rs.150 delivery charge
                  <span className="ml-1" style={{ color:'#60A5FA' }}>
                    {isBurewala ? '(Free ≥ Rs.550)' : `(Free ≥ Rs.${OTHER_CITIES_FREE_THRESHOLD})`}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color:'#64748B' }}>Full Address *</label>
          <textarea name="address" value={form.address} onChange={handleChange}
            placeholder="House #, Street, Mohalla, Landmark…" rows={3} required style={{ resize:'none' }} />
        </div>

        {/* Quick bill preview */}
        {form.city.trim().length > 1 && (
          <div className="viro-card p-4 fade-in">
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color:'#64748B' }}>Order Total</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span style={{ color:'#94A3B8' }}>Items</span><span className="text-white">Rs.{cartTotal.toLocaleString()}</span></div>
              <div className="flex justify-between">
                <span style={{ color:'#94A3B8' }}>Delivery</span>
                <span className={isFree ? 'text-emerald-400 font-bold' : 'text-white'}>{isFree ? 'FREE 🎉' : `Rs.${deliveryCharge}`}</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-2" style={{ borderColor:'#334155' }}>
                <span className="text-white">Total</span>
                <span style={{ color:'#7C3AED' }}>Rs.{(cartTotal + deliveryCharge).toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t flex items-center gap-1.5" style={{ borderColor:'#334155' }}>
              <span className="text-xs" style={{ color:'#64748B' }}>💵 Cash on Delivery</span>
            </div>
          </div>
        )}

        <button type="submit" className="btn-primary w-full py-4 text-base font-bold">Review Order →</button>
      </form>
    </div>
  )
}
