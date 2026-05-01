import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { supabase } from '../lib/supabase'
import { sendOrderEmail } from '../lib/email'
import { CITY_NAMES, getDeliveryCharge, CONTACT } from '../lib/constants'

export default function Checkout() {
  const { cart, cartTotal, clearCart } = useCart()
  const navigate = useNavigate()

  const [form, setForm] = useState({ name: '', phone: '', email: '', city: '', address: '' })
  const [step, setStep] = useState('form') // form | review | success
  const [loading, setLoading] = useState(false)
  const [orderId, setOrderId] = useState(null)
  const [cityWarning, setCityWarning] = useState(false)

  const deliveryCharge = form.city ? getDeliveryCharge(form.city, cartTotal) : 150
  const finalTotal = cartTotal + deliveryCharge

  const isFreeDelivery = deliveryCharge === 0

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (name === 'city') setCityWarning(false)
  }

  function handleCitySelect(city) {
    setForm(f => ({ ...f, city }))
    setCityWarning(false)
  }

  function handleNotAvailable() {
    setCityWarning(true)
  }

  function goToReview(e) {
    e.preventDefault()
    if (!form.name || !form.phone || !form.city || !form.address) return
    setStep('review')
    window.scrollTo(0, 0)
  }

  async function placeOrder() {
    setLoading(true)
    try {
      // Create customer
      const { data: customer, error: custErr } = await supabase
        .from('customers')
        .insert({ name: form.name, phone: form.phone, city: form.city, address: form.address })
        .select().single()
      if (custErr) throw custErr

      // Create order
      const { data: order, error: ordErr } = await supabase
        .from('orders')
        .insert({
          customer_id: customer.id,
          total_price: cartTotal,
          delivery_charges: deliveryCharge,
          final_total: finalTotal,
          status: 'UNPAID'
        })
        .select().single()
      if (ordErr) throw ordErr

      // Create order items
      const items = cart.map(item => ({
        order_id: order.id,
        product_id: item.id,
        quantity: item.quantity,
        price: item.discount_price || item.price,
      }))
      const { error: itemsErr } = await supabase.from('order_items').insert(items)
      if (itemsErr) throw itemsErr

      // Send email
      if (form.email) {
        await sendOrderEmail({
          name: form.name,
          email: form.email,
          orderId: order.id,
          items: cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.discount_price || i.price })),
          subtotal: cartTotal,
          deliveryCharge,
          finalTotal,
          city: form.city,
        })
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

  if (cart.length === 0 && step !== 'success') {
    navigate('/cart')
    return null
  }

  if (step === 'success') return (
    <div className="px-4 py-10 flex flex-col items-center text-center min-h-[70vh] justify-center slide-up">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 text-4xl"
        style={{ background: 'linear-gradient(135deg,#10B98120,#059669 20)', border: '2px solid #10B981' }}>
        ✅
      </div>
      <h1 className="font-display text-2xl font-bold text-white mb-3">Order Received!</h1>
      <div className="viro-card p-4 mb-6 max-w-sm w-full text-left">
        <p className="text-slate-300 text-sm leading-relaxed mb-3">
          Your order <span className="font-bold text-white">#{orderId?.slice(0, 8)}</span> has been received.
        </p>
        <div className="flex items-center gap-2 p-3 rounded-xl mb-3" style={{ background: '#F9731310', border: '1px solid #F9731340' }}>
          <span className="text-orange-400">⚠️</span>
          <div>
            <p className="text-orange-400 font-semibold text-sm">Status: UNPAID</p>
            <p className="text-slate-400 text-xs">We will confirm via phone or WhatsApp</p>
          </div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">Customer</span><span className="text-white font-medium">{form.name}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">City</span><span className="text-white font-medium">{form.city}</span></div>
          <div className="flex justify-between border-t pt-2 mt-2" style={{ borderColor: '#1E2A45' }}>
            <span className="text-slate-400">Total Paid</span>
            <span className="font-bold text-lg" style={{ color: '#00BFFF' }}>Rs. {finalTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        <a href={`https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(`Hi Viro! I placed order #${orderId?.slice(0,8)}. Name: ${form.name}, City: ${form.city}, Total: Rs.${finalTotal}`)}`}
          target="_blank" rel="noopener"
          className="btn-primary w-full py-3"
          style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)' }}>
          💬 Confirm on WhatsApp
        </a>
        <button onClick={() => navigate('/')} className="btn-ghost w-full py-3">
          🏠 Back to Home
        </button>
      </div>

      <p className="text-xs text-slate-500 mt-6 max-w-xs">
        For queries: <a href={`tel:${CONTACT.phone}`} className="text-blue-400">{CONTACT.phone}</a>
        {' · '}<a href={`mailto:${CONTACT.email}`} className="text-blue-400">{CONTACT.email}</a>
      </p>
    </div>
  )

  if (step === 'review') return (
    <div className="px-4 pb-6 slide-up">
      <div className="py-4 flex items-center gap-2">
        <button onClick={() => setStep('form')} className="text-slate-400 hover:text-white">←</button>
        <h1 className="font-display text-xl font-bold text-white">Order Summary</h1>
      </div>

      {/* Customer info */}
      <div className="viro-card p-4 mb-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Delivery Details</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">Name</span><span className="text-white font-medium">{form.name}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Phone</span><span className="text-white font-medium">{form.phone}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">City</span><span className="text-white font-medium">{form.city}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Address</span><span className="text-white font-medium text-right max-w-[60%]">{form.address}</span></div>
        </div>
      </div>

      {/* Items */}
      <div className="viro-card p-4 mb-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Items ({cart.length})</h3>
        <div className="space-y-3">
          {cart.map(item => {
            const images = Array.isArray(item.images) ? item.images : (typeof item.images === 'string' ? JSON.parse(item.images || '[]') : [])
            const thumb = images[0] || 'https://placehold.co/100x100/0F1629/8B5CF6?text=V'
            const itemPrice = item.discount_price || item.price
            return (
              <div key={item.id} className="flex items-center gap-3">
                <img src={thumb} alt={item.name} className="w-12 h-12 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.name}</p>
                  <p className="text-xs text-slate-400">x{item.quantity}</p>
                </div>
                <span className="text-sm font-bold" style={{ color: '#00BFFF' }}>
                  Rs. {(itemPrice * item.quantity).toLocaleString()}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bill */}
      <div className="viro-card p-4 mb-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Bill</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Subtotal</span>
            <span className="text-white">Rs. {cartTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Delivery ({form.city})</span>
            <span className={isFreeDelivery ? 'text-emerald-400 font-semibold' : 'text-white'}>
              {isFreeDelivery ? '🎉 FREE' : `Rs. ${deliveryCharge}`}
            </span>
          </div>
          <div className="border-t pt-2 flex justify-between font-bold" style={{ borderColor: '#1E2A45' }}>
            <span className="text-white text-base">Total</span>
            <span className="text-xl" style={{ color: '#00BFFF' }}>Rs. {finalTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <button onClick={placeOrder} disabled={loading} className="btn-primary w-full py-4 text-base font-bold">
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Placing Order...
          </span>
        ) : '✅ Place Order'}
      </button>
      <p className="text-center text-xs text-slate-500 mt-3">Cash on Delivery · UNPAID until confirmed</p>
    </div>
  )

  // Form step
  return (
    <div className="px-4 pb-6 slide-up">
      <h1 className="font-display text-xl font-bold text-white py-4">Checkout</h1>

      <form onSubmit={goToReview} className="space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Full Name *</label>
          <input name="name" value={form.name} onChange={handleChange} placeholder="Muhammad Ali" required />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Phone Number *</label>
          <input name="phone" value={form.phone} onChange={handleChange} placeholder="03XX XXXXXXX" type="tel" required />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Email (optional)</label>
          <input name="email" value={form.email} onChange={handleChange} placeholder="you@email.com" type="email" />
        </div>

        {/* City Select */}
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Select City *</label>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {CITY_NAMES.map(city => (
              <button key={city} type="button" onClick={() => handleCitySelect(city)}
                className="p-3 rounded-xl border text-sm font-semibold transition-all text-left"
                style={form.city === city ? {
                  background: 'linear-gradient(135deg,#00BFFF15,#8B5CF620)',
                  borderColor: '#8B5CF6', color: '#fff'
                } : { background: '#0F1629', borderColor: '#1E2A45', color: '#94A3B8' }}>
                <div className="font-bold">{city}</div>
                <div className="text-xs mt-0.5" style={{ color: form.city === city ? '#8B5CF6' : '#64748B' }}>
                  {city === 'Burewala' ? 'Free ≥ Rs.550' :
                   city === 'Chichawatni' ? 'Free ≥ Rs.2000' :
                   city === 'Vehari' ? 'Free ≥ Rs.1500' : 'Free ≥ Rs.1200'}
                </div>
              </button>
            ))}
          </div>

          {/* Other city option */}
          <button type="button" onClick={handleNotAvailable}
            className="w-full p-3 rounded-xl border text-sm text-slate-500 text-left transition-all hover:border-slate-600"
            style={{ background: '#0A0E1A', borderColor: '#1E2A45' }}>
            🔍 My city is not listed
          </button>

          {cityWarning && (
            <div className="mt-3 p-4 rounded-xl fade-in" style={{ background: '#F9731310', border: '1px solid #F9731440' }}>
              <p className="text-orange-400 font-bold text-sm mb-1">🚧 Service Coming Soon!</p>
              <p className="text-slate-300 text-xs leading-relaxed">
                We don't deliver to your city yet, but we're expanding fast!<br />
                Please contact us to stay updated:
              </p>
              <div className="flex gap-2 mt-3">
                <a href="https://wa.me/923277796566" target="_blank" rel="noopener"
                  className="flex-1 py-2 rounded-lg text-xs font-bold text-white text-center"
                  style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)' }}>💬 WhatsApp</a>
                <a href="mailto:support@viro.pk"
                  className="flex-1 py-2 rounded-lg text-xs font-bold text-white text-center"
                  style={{ background: 'linear-gradient(135deg,#8B5CF6,#6366F1)' }}>✉️ Email</a>
              </div>
            </div>
          )}

          {form.city && (
            <div className="mt-2 p-3 rounded-xl text-sm fade-in"
              style={{ background: isFreeDelivery ? '#10B98115' : '#00BFFF10', border: `1px solid ${isFreeDelivery ? '#10B98140' : '#00BFFF30'}` }}>
              {isFreeDelivery
                ? <span className="text-emerald-400 font-semibold">🎉 You qualify for FREE delivery in {form.city}!</span>
                : <span className="text-blue-300">🚚 Delivery to {form.city}: <strong>Rs. {deliveryCharge}</strong></span>
              }
            </div>
          )}
        </div>

        {form.city && (
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Full Address *</label>
            <textarea name="address" value={form.address} onChange={handleChange}
              placeholder="House #, Street, Mohalla, Landmark..."
              rows={3} required style={{ resize: 'none' }} />
          </div>
        )}

        {/* Mini order preview */}
        {form.city && cart.length > 0 && (
          <div className="viro-card p-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Summary</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Subtotal</span>
                <span className="text-white">Rs. {cartTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Delivery</span>
                <span className={isFreeDelivery ? 'text-emerald-400' : 'text-white'}>
                  {isFreeDelivery ? 'FREE 🎉' : `Rs. ${deliveryCharge}`}
                </span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold" style={{ borderColor: '#1E2A45' }}>
                <span className="text-white">Total</span>
                <span style={{ color: '#00BFFF' }}>Rs. {(cartTotal + deliveryCharge).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        <button type="submit" className="btn-primary w-full py-4 text-base font-bold">
          Review Order →
        </button>
      </form>
    </div>
  )
}
