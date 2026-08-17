'use client'
import { slugify } from '../../lib/slugify'
import { supabase } from '../../lib/supabase'
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import ProductImage from '../../components/ProductImage'
import { useCart } from '../../context/CartContext'
import dynamic from 'next/dynamic'
const StockCheckPopup = dynamic(() => import('../../components/StockCheckPopup'), { ssr: false })
const GoogleSignInButton = dynamic(() => import('../../components/GoogleSignInButton'), { ssr: false })
import { sendOrderEmail } from '../../lib/email'
import { showSimpleToast } from '../../components/Toast'
import { openWhatsApp } from '../../lib/whatsapp'
import { PK_CITIES } from '../../lib/pakistanCities'
import { useSite } from '../../context/SiteSettingsContext'
import { validateCoupon, redeemCoupon } from '../../lib/couponApi'
import { useUserAuth } from '../../context/UserAuthContext'

const STORAGE_KEY = 'viro_user_info'

// ── Payment details for online/advance payment ────────────────────────────
// These are FALLBACK defaults — actual number/name shown to shoppers comes
// from admin-editable site settings (prepaidAccounts), overriding these below.
const BASE_PAYMENT_ACCOUNTS = [
  {
    method: 'jazzcash',
    label:  'JazzCash',
    icon:   '🔴',
    number: '03184485469',
    name:   'Asjid Siddique',
    color:  '#E63946',
    logoFull: (
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <div style={{width:18,height:18,borderRadius:'50%',background:'#E63946',flexShrink:0}}/>
        <span style={{fontSize:14,fontWeight:700,color:'var(--viro-text)'}}>JazzCash</span>
      </div>
    ),
  },
  {
    method: 'easypaisa',
    label:  'EasyPaisa',
    icon:   '🟢',
    number: '03184485469',
    name:   'Asjid Siddique',
    color:  '#00B562',
    logoFull: (
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <div style={{width:18,height:18,borderRadius:'50%',background:'#00B562',flexShrink:0}}/>
        <span style={{fontSize:14,fontWeight:700,color:'var(--viro-text)'}}>EasyPaisa</span>
      </div>
    ),
  },
]
const WHATSAPP_RECEIPT = '03290081469'
function loadSaved() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} } }

function calcOriginalTotal(items) {
  return items.reduce((s, i) => s + (i.price) * (i.quantity || 1), 0)
}

// Check if a cart item's sale is still active
function isSaleActive(item) {
  if (!item.discount_price || item.discount_price >= item.price) return false
  if (!item.sale_active) return false
  if (item.sale_ends_at && new Date(item.sale_ends_at) <= new Date()) return false
  return true
}

// Effective price respecting sale expiry
function effectivePrice(item) {
  return isSaleActive(item) ? item.discount_price : item.price
}

function calcSaleDiscount(items) {
  return items.reduce((s, i) => {
    const orig = i.price || 0
    const eff  = effectivePrice(i)
    return s + (orig - eff) * (i.quantity || 1)
  }, 0)
}
function calcTotal(items) {
  return items.reduce((s, i) => s + effectivePrice(i) * (i.quantity || 1), 0)
}

// Pakistani phone validator: 03XXXXXXXXX (11 digits) or 923XXXXXXXXX (12 digits)
// BUGFIX: didn't strip a leading "+", so "+923184485469" — the format most
// people type or get from a phone's own paste/autofill — always failed
// with a confusing error even though it's a perfectly valid number.
function validatePkPhone(phone) {
  const digits = phone.replace(/[\s\-()]/g, '').replace(/^\+/, '')
  if (digits.startsWith('92') && digits.length === 12) return true
  if (digits.startsWith('03') && digits.length === 11) return true
  return false
}

const CityAutocomplete = React.forwardRef(function CityAutocomplete({ value, onChange, isValid, onBlur }, forwardedRef) {
  const [query, setQuery] = useState(value || '')
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const inputRef = useRef()

  // Expose an imperative .focus() to the parent (used when validation fails
  // on submit) that both focuses the real <input> AND opens the suggestion
  // dropdown — so it behaves like tapping the field yourself, not just a
  // scroll-into-view with nothing to actually type into yet.
  React.useImperativeHandle(forwardedRef, () => ({
    focus: () => { inputRef.current?.focus(); setOpen(true) }
  }), [])

  const filtered = query.length > 0
    ? PK_CITIES.filter(c => c.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : []

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function pick(city) { setQuery(city); onChange(city); setOpen(false); onBlur?.() }

  // Determine if we should show red border: typed something but not a valid city
  const showError = query.trim().length >= 2 && isValid === false

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        name="city"
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        placeholder="Type city name…"
        autoComplete="address-level2"
        required
        style={showError ? { borderColor: '#EF4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.15)' } : {}}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)', borderRadius: 12,
          marginTop: 4, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
        }}>
          {filtered.map(city => (
            <button key={city} type="button"
              onMouseDown={() => pick(city)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', fontSize: 13, color: 'var(--viro-text)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: '1px solid var(--viro-border)',
                transition: 'background 0.12s'
              }}
              onMouseEnter={e => e.target.style.background = 'var(--viro-bgDeep)'}
              onMouseLeave={e => e.target.style.background = 'transparent'}>
              📍 {city}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

function CheckoutInner() {
  const { contact, getDeliveryCharge, getFreeThreshold, deliveryRules, couponEnabled, prepaidDiscountPercent, checkoutUpsell, codAdvance, prepaidAccounts, minOrder } = useSite()

  // Merge admin-configured JazzCash/EasyPaisa number+name over the fallback
  // defaults — this is what shoppers actually see and send payment to.
  const PAYMENT_ACCOUNTS = React.useMemo(() => BASE_PAYMENT_ACCOUNTS.map(acc => ({
    ...acc,
    number: prepaidAccounts?.[acc.method]?.number || acc.number,
    name:   prepaidAccounts?.[acc.method]?.name   || acc.name,
  })), [prepaidAccounts])
  const { cart, cartTotal, clearCart, refreshCartPrices, removeFromCart, updateQty, addToCart } = useCart()
  const { user, signIn, profile } = useUserAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // v46: refresh cart prices on mount so stale discounts are corrected before checkout
  useEffect(() => {
    refreshCartPrices(supabase)
  }, [])

  // ── Partner Coins — store credit a logged-in Partner has earned from
  // referrals, spendable on their own orders. Fetched here (not just on
  // the /partner dashboard) so it can be offered right at checkout, where
  // it's actually useful. Silent no-op for guests or non-partners — this
  // never blocks or slows down checkout if it fails.
  const [partnerBalance,   setPartnerBalance]   = useState(0)
  const [usePartnerCoins,  setUsePartnerCoins]  = useState(false)
  useEffect(() => {
    if (!user?.email) { setPartnerBalance(0); return }
    let cancelled = false
    fetch('/api/influencer-dashboard', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email }),
    }).then(r => r.json()).then(data => {
      if (cancelled) return
      if (data?.status === 'approved' && data.influencer?.store_credit_balance > 0) {
        setPartnerBalance(data.influencer.store_credit_balance)
      } else {
        setPartnerBalance(0)
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [user?.email])

  // ── "Reached checkout" tracking — a much stronger buying-intent signal
  // than add-to-cart alone. Fires once per page visit, only when there's
  // actually something to check out with. Analytics-only: wrapped so a
  // failure here can never block or slow down checkout itself.
  const checkoutStartFiredRef = useRef(false)
  useEffect(() => {
    if (checkoutStartFiredRef.current) return
    if (!cart || cart.length === 0) return
    checkoutStartFiredRef.current = true
    try {
      const sessionId = typeof window !== 'undefined' ? localStorage.getItem('viro_cart_session') : null
      if (!sessionId) { console.log('[Checkout Intent] No session_id found — skipping'); return }
      console.log('[Checkout Intent] Firing checkout_start', { sessionId, customerId: profile?.customer_id || null })
      fetch('/api/checkout-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, customer_id: profile?.customer_id || null }),
      })
        .then(r => r.json())
        .then(d => console.log('[Checkout Intent] Response:', d))
        .catch(e => console.log('[Checkout Intent] FAILED (edge function or v59 migration may not be deployed yet):', e.message))
    } catch {}
  }, [cart, profile?.customer_id])

  const emailRef = useRef(null)
  const cityRef  = useRef(null)
  const cityInputRef = useRef(null)
  const nameRef    = useRef(null)
  const phoneRef   = useRef(null)
  const addressRef = useRef(null)
  const paymentMethodRef = useRef(null)
  const isQuick = searchParams.get('quick') === '1'
  // BUGFIX: "Buy Now" always pushed the SAME url ('/checkout?quick=1') no
  // matter which product was clicked. Next's client-side router cache can
  // reuse the already-mounted /checkout instance for a URL it's seen before
  // (e.g. user goes back to a product, taps "Buy Now" on a DIFFERENT item,
  // and lands back on /checkout) — so the effect below never re-ran and the
  // page kept showing the FIRST item. Buy-Now callers now append a unique
  // `t` token per click; reading it here and using it as the effect's
  // dependency forces a fresh sessionStorage read (and fresh capture) every
  // time it changes, even when React reuses the same component instance.
  const quickToken = searchParams.get('t')

  // Fix hydration error #418: DO NOT read sessionStorage in lazy initializer (runs on server too).
  // Instead, start with cart and patch to quick-order on first client render via useEffect.
  const [snapshotCart, setSnapshotCart] = useState(cart)
  // BUGFIX (biggest bug — Buy Now redirecting straight to /shop): on the
  // very FIRST render of a `?quick=1` checkout, snapshotCart is still
  // seeded from the (often empty) live `cart` — the real item only shows
  // up once this effect reads it from sessionStorage below. But
  // `belowMinOrder`/the render-time redirect guard runs on EVERY render,
  // including that first one, and 0 < minOrder.amount is always true —
  // so it fired `router.push('/shop')` before the effect ever got a
  // chance to load the real snapshot. `snapshotReady` blocks that guard
  // from evaluating for a quick checkout until the real snapshot is in.
  const [snapshotReady, setSnapshotReady] = useState(!isQuick)
  const snapshotTokenRef = useRef(undefined) // last `t` token we've already loaded — undefined means "never run yet"
  useEffect(() => {
    if (snapshotTokenRef.current === quickToken) return
    const isFirstRun = snapshotTokenRef.current === undefined
    snapshotTokenRef.current = quickToken
    let resolvedCart = cart
    if (isQuick) {
      try {
        const q = JSON.parse(sessionStorage.getItem('viro_quick_order') || 'null')
        if (q && q.length > 0) {
          setSnapshotCart(q)
          resolvedCart = q
          // Safety-net: merge the Buy-Now item into the REAL cart right
          // away — if the shopper closes the tab, hits back, or just
          // never finishes, it's sitting safely in their cart instead of
          // vanishing (it only ever lived in sessionStorage before this).
          // Pulled back OUT of the cart on successful order placement
          // below, so a completed order never leaves a ghost duplicate —
          // any OTHER items already in the cart are never touched either way.
          for (const item of q) addToCart(item, item.quantity || 1)
        }
      } catch {}
      setSnapshotReady(true)
    }
    // A new token after the first run means the shopper went back and chose
    // a DIFFERENT item — make sure they land back on the info step (not
    // stuck on a stale "Review" screen built from the old item) and allow
    // the mount-capture below to fire again for this new item.
    if (!isFirstRun) {
      setStep('form')
      mountCaptureRef.current = false
    }
    // BUGFIX: this mount-time capture used to live in its own separate
    // effect below (mountCaptureRef) and called captureCheckoutProgress()
    // with no arguments — reading `activeCartItems`/`snapshotTotal` off
    // the render closure. But `setSnapshotCart(q)` above hasn't triggered
    // a re-render yet at this point in the SAME effects pass, so for a
    // returning guest on a "Buy Now" (isQuick) checkout with pre-filled
    // info, that closure still saw the ORIGINAL (empty) snapshotCart —
    // silently saving cart_value: 0 even though the page itself showed
    // the correct total. Passing `resolvedCart` (computed synchronously,
    // right here) sidesteps the stale closure entirely.
    if (!mountCaptureRef.current && (form.phone || form.email)) {
      mountCaptureRef.current = true
      captureCheckoutProgress(resolvedCart)
    }
  }, [quickToken]) /* eslint-disable-line react-hooks/exhaustive-deps */


  // Snapshot totals — derived from snapshotCart (updates when snapshotCart updates)
  const snapshotTotal        = isQuick ? calcTotal(snapshotCart) : cartTotal
  const snapshotOriginalTotal = calcOriginalTotal(snapshotCart)
  const snapshotSaleDiscount  = calcSaleDiscount(snapshotCart)

  // ── Active cart: snapshot (quick/order-now) or live cart ─────────────────
  // These were accidentally removed — used throughout the component for totals,
  // empty-cart guard, and the order summary breakdown.
  const activeCartItems = isQuick ? snapshotCart : cart
  const activeCartTotal = isQuick ? snapshotTotal : cartTotal

  const saved = loadSaved()
  const [form, setForm] = useState({
    name:    saved.name    || '',
    phone:   saved.phone   || '',
    email:   saved.email   || '',
    city:    saved.city    || '',
    address: saved.address || '',
  })

  // Pre-fill email/name from Google auth
  useEffect(() => {
    if (user?.email && !form.email) {
      setForm(f => ({ ...f, email: f.email || user.email, name: f.name || user.name || '' }))
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const [savedAddresses,    setSavedAddresses]    = useState([])
  const [selectedAddrId,    setSelectedAddrId]    = useState(null)  // which card is selected
  const [showAddNewForm,    setShowAddNewForm]     = useState(false) // inline add-new form
  const [newAddrForm,       setNewAddrForm]        = useState({ label:'Home', name:'', phone:'', city:'', address:'', is_default:false })
  const [savingNewAddr,     setSavingNewAddr]      = useState(false)

  // ── Cross-device returning-customer autofill ──────────────────────────────
  // loadSaved() only covers THIS browser/device. A returning customer typing
  // their number on a new phone/browser gets nothing from localStorage — but
  // we already have their name/email/city/address in `customers` from a past
  // order. `autofilledFromServer` drives a small "Welcome back" banner
  // (separate from the localStorage one above) when that lookup fills fields in.
  const [autofilledFromServer, setAutofilledFromServer] = useState(false)

  // Load saved addresses — auto-apply default
  useEffect(() => {
    if (!user?.email) return
    import('../../lib/authClient').then(({ rpcAnon }) => {
      rpcAnon('get_customer_addresses', { p_email: user.email })
        .then(data => {
          if (!Array.isArray(data) || data.length === 0) return
          setSavedAddresses(data)
          // Auto-apply default address to form
          const def = data.find(a => a.is_default) || data[0]
          if (def) {
            setSelectedAddrId(def.id)
            setForm(f => ({ ...f, name: def.name, phone: def.phone, city: def.city, address: def.address }))
          }
        })
        .catch(() => {})
    })
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply selected address to form when user picks one
  function selectSavedAddress(addr) {
    setSelectedAddrId(addr.id)
    setForm(f => ({ ...f, name: addr.name, phone: addr.phone, city: addr.city, address: addr.address }))
    setShowAddNewForm(false)
  }

  // Save new address inline + apply it
  async function saveNewAddress() {
    if (!newAddrForm.name || !newAddrForm.phone || !newAddrForm.city || !newAddrForm.address) {
      showSimpleToast('⚠️ Fill all address fields', 'info'); return
    }
    setSavingNewAddr(true)
    try {
      const { rpcAnon } = await import('../../lib/authClient')
      const res = await rpcAnon('upsert_customer_address', {
        p_email:   user.email,
        p_label:   newAddrForm.label,
        p_name:    newAddrForm.name,
        p_phone:   newAddrForm.phone,
        p_city:    newAddrForm.city,
        p_address: newAddrForm.address,
        p_default: newAddrForm.is_default,
        p_addr_id: null,
      })
      // Reload addresses
      const fresh = await rpcAnon('get_customer_addresses', { p_email: user.email })
      if (Array.isArray(fresh)) {
        setSavedAddresses(fresh)
        // Find and select the newly added address
        const newAddr = res?.address_id ? fresh.find(a => a.id === res.address_id) : fresh[fresh.length-1]
        if (newAddr) selectSavedAddress(newAddr)
      }
      setShowAddNewForm(false)
      setNewAddrForm({ label:'Home', name:'', phone:'', city:'', address:'', is_default:false })
    } catch(e) { showSimpleToast('❌ Could not save address', 'info') }
    setSavingNewAddr(false)
  }
  const [step, setStep]       = useState('form')
  // BUGFIX: the sticky mobile "Review Order"/"Place Order" bar used Tailwind's
  // `hidden`/`md:block` classes to show only ONE of a mobile-fixed vs a
  // desktop-inline version — but both ended up rendering simultaneously in
  // production (the double-button screenshot). Rather than debug whatever
  // CSS specificity/purge issue caused that, this does the show/hide in JS
  // instead — `isDesktop` is used to render EXACTLY one version, ever,
  // guaranteed, regardless of any stylesheet ordering.
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    setIsDesktop(mq.matches)
    const onChange = e => setIsDesktop(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const [loading, setLoading]   = useState(false)

  // ── AOV upsell: "add more, get free delivery" popup ────────────────────
  // Small orders (< Rs.400) heading straight to checkout are exactly the
  // customers most worth nudging toward a bigger cart before they commit —
  // both regular cart checkouts AND single-item "Buy Now" direct-buys.
  // Deliberately does NOT show immediately on page load (that reads as
  // pushy, right when someone's still deciding) — only once they've
  // scrolled down as far as the delivery-address section, i.e. they're
  // already committed enough to be filling in delivery details. Shown at
  // most once per checkout attempt — dismissing (or scrolling past) means
  // it won't nag them again on the same visit.
  const [showUpsell, setShowUpsell] = useState(false)
  const upsellShownRef = useRef(false)
  const upsellTriggerRef = useRef(null)
  useEffect(() => {
    const el = upsellTriggerRef.current
    if (!el || !checkoutUpsell.enabled) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !upsellShownRef.current) {
        upsellShownRef.current = true
        setShowUpsell(true)
      }
    }, { threshold: 0.3 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Adding more from checkout means leaving the page — for a normal cart
  // checkout the items are already safely persisted, nothing to do. But a
  // "Buy Now" (isQuick) checkout only ever existed as a sessionStorage
  // snapshot, never touched the real cart — navigating away would lose it
  // entirely. Merge it into the real cart first so it's still there when
  // they come back from browsing.
  async function goShopForMore() {
    // Flush whatever's currently in the form right now — don't rely on the
    // 900ms debounce having already fired, since a tap on this button can
    // easily land before that timer runs and the info would otherwise be
    // lost for the trip back.
    await captureCheckoutProgress()
    // The Buy-Now item was already merged into the real cart when this
    // checkout page mounted (see the snapshot-loading effect above) — no
    // need to merge it again here, just reassure the shopper it's safe.
    if (isQuick) showSimpleToast('✅ Saved to your cart — go ahead and add more!', 'success')
    router.push('/shop')
  }

  const [oosError, setOosError]  = useState(null)
  const [orderId, setOrderId]   = useState(null)
  const [frozenOrderValues, setFrozenOrderValues] = useState(null)
  const [couponCode,    setCouponCode]    = useState('')
  const [couponResult,  setCouponResult]  = useState(null)
  const [couponLoading, setCouponLoading] = useState(false)

  // Auto-apply coupon from cart — fires once cart total is ready
  const [pendingAutoApply, setPendingAutoApply] = React.useState(null)
  useEffect(() => {
    if (!couponEnabled) return
    const pending = localStorage.getItem('viro_pending_coupon')
    if (!pending) return
    localStorage.removeItem('viro_pending_coupon')
    setCouponCode(pending)
    // Try to use cached result first (saved when user applied in cart)
    try {
      const cached = JSON.parse(localStorage.getItem('viro_pending_coupon_result') || 'null')
      localStorage.removeItem('viro_pending_coupon_result')
      // Only use if fresh (under 10 minutes) and valid
      if (cached?.valid && cached?.savedAt && (Date.now() - cached.savedAt) < 600000) {
        setCouponResult(cached)
        return // skip re-validation
      }
    } catch(_) {}
    setPendingAutoApply(pending) // fallback: re-validate
  }, [couponEnabled])

  // Auto-apply once activeCartTotal is ready (fallback when no cache)
  useEffect(() => {
    if (!pendingAutoApply || !activeCartTotal || activeCartTotal <= 0) return
    setPendingAutoApply(null)
    ;(async () => {
      setCouponLoading(true)
      const result = await validateCoupon(pendingAutoApply, activeCartTotal)
      setCouponResult(result)
      setCouponLoading(false)
    })()
  }, [pendingAutoApply, activeCartTotal])
  const [paymentMethod,  setPaymentMethod]  = useState(null)   // null (no selection yet) | 'cod' | 'jazzcash' | 'easypaisa' | 'online'
  const [selectedAccount, setSelectedAccount] = useState(null)  // PAYMENT_ACCOUNTS entry
  const [snapshotFinal,  setSnapshotFinal]  = useState(null)    // frozen total at order place
  // COD → Prepaid nudge popup — fires once when COD is first picked, only if
  // a prepaid discount is actually active. Doesn't re-fire on every COD tap
  // within the same visit, so it nudges without nagging.
  const [showPrepaidNudge, setShowPrepaidNudge] = useState(false)
  const prepaidNudgeShownRef = useRef(false)

  // Use snapshot for review/success display
  const activeTotal = step === 'form' ? activeCartTotal  : snapshotTotal
  // Admin-set minimum order gate — blocks placing the order below this
  // subtotal (checked against the live cart total while still on the form).
  const belowMinOrder = minOrder?.enabled && activeCartTotal < minOrder.amount

  const cityLower      = form.city.trim().toLowerCase()
  const isBurewala     = cityLower === 'burewala'
  // Live rule match for current city — used for all delivery text display
  const cityRule = React.useMemo(() => {
    if (!cityLower || !deliveryRules?.length) return null
    return deliveryRules.find(r => r.cities?.includes(cityLower))
        || deliveryRules.find(r => r.cities?.includes('*'))
        || null
  }, [cityLower, deliveryRules])
  // Fix #5: Soft validation — any city ≥3 chars is accepted. PK_CITIES list is just an autocomplete helper.
  const isCityKnown    = form.city.trim().length >= 2 && PK_CITIES.some(c => c.toLowerCase() === cityLower)
  const isCityValid    = form.city.trim().length >= 3  // only block if truly too short
  const isPhoneValid   = form.phone.trim().length === 0 ? null : validatePkPhone(form.phone)
  const couponDiscount = couponResult?.valid ? (couponResult.discount || 0) : 0
  const discountedTotal = Math.max(0, activeTotal - couponDiscount)
  // Live preview only — server re-validates this authoritatively on submit.
  // isPrepaidSelected mirrors the server's payment_method check exactly.
  const isPrepaidSelected = paymentMethod === 'jazzcash' || paymentMethod === 'easypaisa' || paymentMethod === 'online'
  const prepaidDiscount = isPrepaidSelected && prepaidDiscountPercent > 0
    ? Math.round((discountedTotal * prepaidDiscountPercent) / 100)
    : 0
  const afterPrepaidTotal = Math.max(0, discountedTotal - prepaidDiscount)
  // Live preview of the deal delivery override — same rule the server
  // authoritatively re-applies in placeOrder(): a Free/Custom-delivery Deal
  // Box in the cart overrides the normal city-based charge for the WHOLE
  // order, not just itself.
  const activeDealDeliveryOverride = (() => {
    const freeDeal = activeCartItems.find(i => i.isDeal && i.deliveryMode === 'free')
    if (freeDeal) return { mode: 'free', amount: 0 }
    const customDeal = activeCartItems.find(i => i.isDeal && i.deliveryMode === 'custom')
    if (customDeal) return { mode: 'custom', amount: Number(customDeal.customDeliveryPrice) || 0 }
    return null
  })()
  const deliveryCharge = activeDealDeliveryOverride
    ? activeDealDeliveryOverride.amount
    // BUGFIX: used to hardcode a Rs.150 guess before the city was typed —
    // out of sync with whatever the admin actually set for "All Other
    // Cities" in Site Settings (e.g. Rs.180). getDeliveryCharge('', ...)
    // has no city to match, so calcCharge falls through to the catch-all
    // ('*') rule on its own — same DB-driven number used everywhere else,
    // just without needing a real city yet.
    : getDeliveryCharge(form.city.trim(), discountedTotal)
  const isFree         = deliveryCharge === 0
  const preCoinsTotal  = afterPrepaidTotal + deliveryCharge
  // Client-side PREVIEW only — capped the same way the server will
  // authoritatively re-cap it in placeOrder() via validate-order. Folding
  // this into `finalTotal` itself (rather than introducing a new variable
  // used in a few places) means every existing usage of `finalTotal`
  // throughout this file — the Place Order button, WhatsApp payment
  // messages, COD advance calc, frozen order snapshots — automatically
  // reflects it correctly with no further changes needed anywhere else.
  const partnerCoinsPreview = usePartnerCoins ? Math.min(partnerBalance, preCoinsTotal) : 0
  const finalTotal     = Math.max(0, preCoinsTotal - partnerCoinsPreview)

  // "Add Rs.X more for free delivery" — surfaces from page load (no city
  // needed, same catch-all-rule fallback pattern as deliveryCharge above)
  // and always shown while not yet free, so the progress bar below has a
  // constant presence nudging shoppers toward a bigger order.
  const freeDeliveryThreshold = getFreeThreshold(form.city.trim())
  const freeDeliveryGap = (!isFree && freeDeliveryThreshold != null)
    ? Math.max(0, freeDeliveryThreshold - discountedTotal)
    : 0
  const freeDeliveryPct = freeDeliveryThreshold ? Math.min(100, Math.round((discountedTotal / freeDeliveryThreshold) * 100)) : 0
  const showFreeDeliveryNudge = !isFree && freeDeliveryThreshold != null && freeDeliveryGap > 0


  // Meta CAPI: InitiateCheckout — fires exactly once per checkout page visit.
  // Using sessionStorage (not just a ref) so it survives any edge-case where
  // the component re-renders with a new ref but the same session is still open.
  // finalTotal changing (e.g. switching COD→Prepaid) must NOT re-fire this
  // event — it already fired when the customer first arrived at checkout.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!cart.length || !finalTotal) return
    const FIRED_KEY = 'viro_ic_fired'
    if (sessionStorage.getItem(FIRED_KEY)) return
    sessionStorage.setItem(FIRED_KEY, '1')
    import("../../lib/metaEvents").then(m => {
      m.trackInitiateCheckout(cart, finalTotal, {})
    }).catch(() => {})
  }, [cart.length > 0, !!finalTotal]) // only re-check if cart goes from empty→populated or total appears

  // Debounce timer for the onChange auto-save below. Declared with a plain
  // ref (not state) since it's just bookkeeping — updating it must never
  // trigger a re-render.
  const pendingSaveTimerRef = useRef(null)
  useEffect(() => () => { if (pendingSaveTimerRef.current) clearTimeout(pendingSaveTimerRef.current) }, [])

  function handleChange(e) {
    const { name, value } = e.target
    // BUGFIX: phone field showed an error the instant someone typed "+92…"
    // — a format their phone's own contact autofill/paste commonly
    // produces — because nothing ever stripped the "+". Silently drop a
    // leading "+" from the STORED value as they type, so it's normalised
    // to the "92…" the validator (and WhatsApp/SMS links downstream)
    // already expects, instead of blocking them with a confusing error.
    const cleanValue = name === 'phone' ? value.replace(/^\+/, '') : value
    const nextForm = { ...form, [name]: cleanValue }
    setForm(f => ({ ...f, [name]: cleanValue }))
    // Save ~900ms after the user stops typing in ANY field — not just on
    // blur. A blur-only save misses a user who types their info and then
    // closes the tab / taps a nav icon / uses the phone's back gesture
    // without ever properly leaving the last field they touched.
    if (pendingSaveTimerRef.current) clearTimeout(pendingSaveTimerRef.current)
    pendingSaveTimerRef.current = setTimeout(() => {
      pendingSaveTimerRef.current = null
      captureCheckoutProgress(undefined, nextForm)
    }, 900)
  }

  async function applyCoupon() {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    const result = await validateCoupon(couponCode, activeTotal)
    setCouponResult(result)
    setCouponLoading(false)
    // BUGFIX: applying a coupon only ever updated the inline banner further
    // down the page — if that banner isn't in view (coupon field is often
    // lower on the page than where the banner renders), it looks like
    // nothing happened at all. A floating toast at the top of the screen
    // gives immediate, unmissable feedback regardless of scroll position.
    if (result?.valid) {
      showSimpleToast(`🎉 Coupon applied! Saving Rs.${result.discount?.toLocaleString()}`, 'success')
    } else {
      showSimpleToast(result?.error || '⚠️ Invalid or expired coupon', 'warn')
    }
  }

  function removeCoupon() {
    setCouponCode('')
    setCouponResult(null)
    showSimpleToast('Coupon removed', 'info')
  }

  // ── Per-attempt identity for checkout_sessions ────────────────────────────
  // session_id alone used to be the upsert key — fine for a normal cart
  // checkout (one evolving intent), but wrong for "Buy Now": the SAME
  // session_id is reused every time on the same device, so buying item A,
  // going back, and buying item B overwrote A's row instead of leaving it
  // as its own history entry. `quickToken` (the unique `t=` on each Buy Now
  // click, see the snapshot-loading effect above) makes each Direct-Buy
  // attempt its own attempt_key → its own row. Regular cart checkout keeps
  // using session_id alone, unchanged.
  function getAttemptKey(cartSessionId) {
    return (isQuick && quickToken) ? `${cartSessionId}:q:${quickToken}` : cartSessionId
  }

  // ── Progressive checkout capture ─────────────────────────────────────────
  // Previously this only fired inside goToReview() — gated behind name+phone+
  // email+city+address ALL being valid AND the user actually clicking
  // "Review Order". Anyone who filled just phone/email and left (never
  // completed the whole form, or never clicked the button) left zero trace —
  // "not every checkout" was being captured. This fires as soon as we have
  // phone OR email (the two fields that actually matter for follow-up), on
  // blur AND on a short debounce after typing in ANY field — so an edit to
  // an already-filled field (e.g. correcting the email after name+phone were
  // already saved) is captured too, not just the first name→phone pass.
  //
  // `formOverride`, when passed by the onChange debounce, is the freshly
  // computed { ...form, [field]: value } object from that exact keystroke —
  // using it instead of the `form` closure avoids saving stale data if more
  // typing happened between when the timer was scheduled and when it fires.
  const captureCheckoutProgress = async (overrideItems, formOverride, stepOverride) => {
    if (pendingSaveTimerRef.current) { clearTimeout(pendingSaveTimerRef.current); pendingSaveTimerRef.current = null }
    const f = formOverride || form
    try {
      if (!f.phone && !f.email) return  // nothing worth saving yet
      // BUGFIX: previously ONLY saved to localStorage inside goToReview() —
      // a shopper who typed their info then left via "Add More & Save"
      // (goShopForMore) without ever clicking "Review Order" had nothing
      // persisted, so the form (and with it the Bill Preview) came back
      // blank next time they reached checkout. This already runs on every
      // field blur and ~900ms after typing stops, so saving here covers
      // that gap without changing when/how often it fires.
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          name: f.name || '', phone: f.phone || '', email: f.email || '',
          city: f.city || '', address: f.address || '',
        }))
      } catch {}
      const cartSessionId = (typeof window !== 'undefined' && localStorage.getItem('viro_cart_session')) || null
      if (!cartSessionId || !supabase) return

      // BUGFIX: a returning customer who's logged OUT of Google but typed
      // (or had pre-filled) their real phone/email was still being written
      // as customer_id: null — a totally fresh "Guest" in admin's eyes,
      // even though we're holding the exact phone number of a real,
      // already-known customer record. Look them up by phone before
      // writing, so repeat guests link back to who they actually are
      // instead of fragmenting into a new anonymous entry every visit.
      let resolvedCustomerId = profile?.customer_id || null
      if (!resolvedCustomerId && f.phone) {
        try {
          const { data: existing } = await supabase
            .from('customers').select('id').eq('phone', f.phone).maybeSingle()
          if (existing?.id) resolvedCustomerId = existing.id
        } catch { /* best-effort — proceed without it if lookup fails */ }
      }

      // BUGFIX: on mount, for a returning guest whose info is already
      // pre-filled AND who came in via "Buy Now" (isQuick), this used to
      // read `snapshotTotal`/`activeCartItems` off the render closure —
      // but the mount effect that populates `snapshotCart` from
      // sessionStorage hasn't flushed a re-render yet at that point, so
      // those still reflected the pre-snapshot (empty) cart. Result:
      // cart_value saved as 0 even though the checkout page itself showed
      // the correct total. `overrideItems`, when passed by the mount
      // effect, is the freshly-resolved array computed in that same tick —
      // bypassing the stale closure entirely.
      const itemsForCapture = overrideItems || activeCartItems
      const valueForCapture = overrideItems ? calcTotal(overrideItems) : (isQuick ? snapshotTotal : cartTotal)

      // Two different signals, both worth keeping: `resolvedCustomerId`
      // links this checkout to a real customer record (even a guest who
      // typed a known phone number) so history doesn't fragment. But
      // `is_authenticated` — true ONLY when there's an active login
      // (`profile.customer_id`) — is what actually answers "was this
      // particular checkout done while logged in?" The admin Checkout
      // Activity tab's Registered/Guest badge reads this, not customer_id,
      // so a guest who happens to share a phone with a known customer
      // doesn't get mislabeled "Registered".
      const isAuthenticated = !!profile?.customer_id

      const payload = {
        attempt_key:  getAttemptKey(cartSessionId),
        session_id:   cartSessionId,
        customer_id:  resolvedCustomerId,
        is_authenticated: isAuthenticated,
        name:         f.name || null,
        phone:        f.phone || null,
        email:        f.email || null,
        city:         f.city || null,
        address:      f.address || null,
        cart_snapshot: itemsForCapture.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: effectivePrice(i) })),
        cart_value:   valueForCapture,
        is_direct_buy: isQuick,
        status:       'reviewing',
        // Which page the shopper is currently on — lets admin tell a guest
        // still typing their name apart from one already at "Review Order".
        checkout_step: stepOverride || (step === 'review' ? 'review' : 'info'),
        updated_at:   new Date().toISOString(),
      }

      // BUGFIX: `.upsert(payload, { onConflict: 'attempt_key' })` depends on
      // PostgREST already knowing attempt_key's unique index exists —
      // PostgREST caches the schema and doesn't always pick up a brand new
      // constraint right away (a `NOTIFY pgrst, 'reload schema'` or project
      // restart fixes it, but there's an awkward window right after any
      // migration where writes 400 with "no unique or exclusion constraint
      // matching the ON CONFLICT specification" even though the constraint
      // is really there). Doing this as an explicit check-then-write
      // instead sidesteps ON CONFLICT — and therefore that cache — entirely.
      const attemptKey = payload.attempt_key
      const { data: existingRow } = await supabase
        .from('checkout_sessions').select('id').eq('attempt_key', attemptKey).maybeSingle()

      let error
      if (existingRow?.id) {
        ({ error } = await supabase.from('checkout_sessions').update(payload).eq('id', existingRow.id))
      } else {
        ({ error } = await supabase.from('checkout_sessions').insert(payload))
      }
      if (error) console.warn('[checkout_sessions] progressive capture failed (non-fatal):', error.message)
    } catch (captureErr) {
      console.warn('[checkout_sessions] progressive capture threw (non-fatal):', captureErr?.message)
    }
  }

  // ── Cross-device returning-customer autofill (by phone) ───────────────────
  // localStorage (loadSaved) only helps a customer who's back on the SAME
  // device. Someone ordering from a new phone/browser gets a blank form even
  // though we already have their name/email/city/address in `customers` from
  // a past order. The moment their phone number validates, look them up —
  // if found, fill in only the fields they haven't already typed themselves
  // (never clobber what the user is actively entering) and show a small
  // "Welcome back" banner so they know why fields just changed.
  const autofillTriedRef = useRef(null) // remembers which phone we already looked up, so we don't re-query on every blur
  async function tryAutofillFromPhone() {
    try {
      if (!supabase || isPhoneValid !== true) return
      if (autofillTriedRef.current === form.phone) return // already tried this exact number
      autofillTriedRef.current = form.phone

      const { data: match, error } = await supabase
        .from('customers')
        .select('name, email, city, address')
        .eq('phone', form.phone)
        .maybeSingle()
      if (error || !match) return

      const willFillSomething =
        (!form.name && match.name) || (!form.email && match.email) ||
        (!form.city && match.city) || (!form.address && match.address)
      if (!willFillSomething) return

      setForm(f => ({
        ...f,
        name:    f.name    || match.name    || '',
        email:   f.email   || match.email   || '',
        city:    f.city    || match.city    || '',
        address: f.address || match.address || '',
      }))
      setAutofilledFromServer(true)
    } catch (e) {
      console.warn('[checkout autofill] phone lookup failed (non-fatal):', e?.message)
    }
  }

  // Phone field's single onBlur handler: try the returning-customer autofill
  // FIRST (so any fields it fills get included), then save progress — same
  // pattern used on every other field below.
  async function handlePhoneBlur() {
    await tryAutofillFromPhone()
    captureCheckoutProgress()
  }

  // BUGFIX: onBlur only fires when a field is actually focused-then-left —
  // a RETURNING guest whose info is already pre-filled from localStorage
  // (see loadSaved()) often never taps phone/email at all, just scrolls
  // straight to "Continue". That guest generated ZERO capture, ever — which
  // is exactly the case in testing: phone showed ✓ valid, email was filled,
  // but nothing reached the server because no blur event ever fired.
  // The actual mount-time capture now happens inside the snapshotCart-load
  // effect above (so it can pass the freshly-resolved cart array instead
  // of racing it) — this ref is declared here only because it's referenced
  // there and needs to exist before that effect's closure runs.
  const mountCaptureRef = useRef(false)

  // ── Shared 3-step progress indicator — used on both the form step and the
  // review step so a first-time guest always sees where they are, not just
  // after reaching review. "Info" is always clickable (jump back to edit).
  // "Review" is only clickable once the form is actually valid — otherwise
  // it's just a label, since jumping there early would only bounce them
  // straight back via goToReview's own validation anyway.
  const canJumpToReview = !!(form.name && form.phone && form.city?.trim().length >= 3 && form.address && isPhoneValid !== false)
  function CheckoutStepper({ current }) {
    return (
      <div className="flex items-center gap-2 mb-4 text-xs font-bold" style={{ color: 'var(--viro-textSub)' }}>
        <button type="button" onClick={() => { captureCheckoutProgress(undefined, undefined, 'info'); setStep('form'); window.scrollTo(0, 0) }}
          style={{ color: current === 'form' ? '#8B5CF6' : '#10B981', cursor: 'pointer', background: 'none', border: 'none', padding: 0, font: 'inherit' }}>
          {current === 'form' ? '●' : '✓'} Info
        </button>
        <span style={{ flex:1, height:2, background: current === 'form' ? 'var(--viro-border)' : '#10B981', borderRadius:2 }} />
        <button type="button"
          disabled={current === 'form' && !canJumpToReview}
          onClick={() => { if (current === 'form' && canJumpToReview) { captureCheckoutProgress(undefined, undefined, 'review'); setStep('review'); window.scrollTo(0, 0) } }}
          style={{ color: current === 'review' ? '#8B5CF6' : (canJumpToReview ? 'var(--viro-textSub)' : 'var(--viro-border)'),
            cursor: current === 'review' ? 'default' : (canJumpToReview ? 'pointer' : 'not-allowed'),
            background: 'none', border: 'none', padding: 0, font: 'inherit' }}>
          {current === 'review' ? '●' : '○'} Review
        </button>
        <span style={{ flex:1, height:2, background: 'var(--viro-border)', borderRadius:2 }} />
        <span>Confirmed</span>
      </div>
    )
  }

  function goToReview(e) {
    e.preventDefault()
    // Scroll to first empty required field
    if (!form.name || !form.phone || !form.city || !form.address) return
    if (isPhoneValid === false) {
      showSimpleToast('⚠️ Enter a valid Pakistani number: 03XXXXXXXXX or 923XXXXXXXXX', 'info')
      return
    }
    // Allow any city ≥3 chars (Fix #5 — soft validation only)
    if (form.city.trim().length < 3) {
      cityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      cityInputRef.current?.focus()
      showSimpleToast('⚠️ Please enter your city name', 'info')
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: form.name, phone: form.phone, email: form.email, city: form.city, address: form.address }))

    // Final, complete capture — same call the field-blur handlers already
    // make progressively, run once more here now that the full form is valid.
    // BUGFIX: this used to call captureCheckoutProgress() with no override,
    // BEFORE setStep('review') below — reading `step` off the render
    // closure, which still said 'form' at this exact instant (React hasn't
    // re-rendered yet). Result: admin's Checkout Activity kept showing
    // "Info" even for a shopper who'd just clicked through to Review.
    // Passing 'review' explicitly means it's correct the moment they click,
    // not dependent on state-update timing.
    captureCheckoutProgress(undefined, undefined, 'review')

    setStep('review')
    window.scrollTo(0, 0)
  }

  // Fix #10: Frozen values captured at place-order time so success screen
  // always shows the correct amounts regardless of any city change mid-flow.
  async function placeOrder() {
    // Single-page checkout means placeOrder() is now the ONLY gate before
    // an order goes out — there's no separate "review" step anymore that
    // used to catch missing name/phone/address first. Check every required
    // field here, scroll+focus the first problem one, and stop.
    if (!form.name.trim()) {
      nameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      nameRef.current?.focus()
      showSimpleToast('⚠️ Please enter your full name', 'info')
      return
    }
    if (!form.phone.trim()) {
      phoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      phoneRef.current?.focus()
      showSimpleToast('⚠️ Please enter your phone number', 'info')
      return
    }
    if (isPhoneValid === false) {
      phoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      phoneRef.current?.focus()
      showSimpleToast('⚠️ Enter a valid Pakistani number: 03XXXXXXXXX or 923XXXXXXXXX', 'info')
      return
    }
    // Allow any city ≥3 chars (Fix #5 — soft validation only)
    if (form.city.trim().length < 3) {
      cityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      cityInputRef.current?.focus()
      showSimpleToast('⚠️ Please enter your city name', 'info')
      return
    }
    if (!form.address.trim()) {
      addressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      addressRef.current?.focus()
      showSimpleToast('⚠️ Please enter your delivery address', 'info')
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: form.name, phone: form.phone, email: form.email, city: form.city, address: form.address }))
    // Safety-net minimum-order gate — the cart page and product buttons
    // already steer shoppers here only once they clear this, but this check
    // guards direct/edge-case entry into checkout too.
    if (belowMinOrder) {
      const remaining = Math.ceil(minOrder.amount - activeCartTotal)
      showSimpleToast(`⚠️ Minimum order is Rs.${minOrder.amount.toLocaleString()} — add Rs.${remaining.toLocaleString()} more to place this order`, 'info')
      return
    }
    // No payment method pre-selected by default anymore — the user must
    // actively choose COD or Prepaid. This is what makes the COD→Prepaid
    // nudge popup actually fire (it triggers on the COD button's onClick,
    // which never ran when COD was silently pre-selected on page load).
    if (!paymentMethod) {
      paymentMethodRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      showSimpleToast('⚠️ Please select a payment method to continue', 'info')
      return
    }
    // Require account selection for prepaid
    const isPrepaid = paymentMethod==='online'||paymentMethod==='jazzcash'||paymentMethod==='easypaisa'
    if (isPrepaid && !selectedAccount) {
      paymentMethodRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      showSimpleToast('⚠️ Please select JazzCash or EasyPaisa to continue', 'info')
      return
    }
    setLoading(true)
    try {
      // ── SERVER-SIDE PRICE VALIDATION (fraud prevention) ────────────────────
      // Client-computed prices are never trusted. We send only item IDs + quantities
      // to /api/validate-order which re-fetches real prices from DB.
      // The server-returned values replace any client-computed ones.
      let serverValidation
      try {
        const valRes = await fetch('/api/validate-order', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: snapshotCart.map(i => ({
              id:                    i.id,
              quantity:              i.quantity,
              selected_color_id:     i.selected_color_id || null,
              selected_size_id:      i.selected_size_id  || null,
              is_deal:               !!i.isDeal,
              deal_id:               i.isDeal ? i.dealId : null,
              included_product_ids:  i.isDeal ? (i.includedProductIds || []) : null,
            })),
            coupon_code: couponResult?.valid ? couponCode.toUpperCase() : undefined,
            city: form.city,
            payment_method: paymentMethod,
            partner_email: (usePartnerCoins && user?.email) ? user.email : undefined,
            partner_coins_requested: (usePartnerCoins && partnerBalance > 0) ? partnerBalance : undefined,
          }),
        })
        serverValidation = await valRes.json()
        if (!valRes.ok || !serverValidation.ok) {
          setLoading(false)
          const errMsg = serverValidation?.error || 'Order validation failed'
          const oosMatch = errMsg.match(/"([^"]+)"\s+only has (\d+) in stock/)
          const noLongerMatch = errMsg.match(/"([^"]+)" is no longer available/)
          if (oosMatch || noLongerMatch) {
            const productName = oosMatch ? oosMatch[1] : noLongerMatch[1]
            const stockLeft = oosMatch ? parseInt(oosMatch[2]) : 0
            const matchedItem = activeCartItems.find(i =>
              i.name?.toLowerCase().includes(productName.toLowerCase().slice(0, 20))
            )
            setOosError({ message: errMsg, productName, stockLeft, cartKey: matchedItem?._cartKey || matchedItem?.id || null, item: matchedItem || null })
          } else {
            showSimpleToast('❌ ' + errMsg, 'error')
          }
          return
        }
      } catch (valErr) {
        setLoading(false)
        showSimpleToast('❌ Could not validate order — check your connection', 'info')
        return
      }

      // Use server-authoritative values — not the client-computed ones
      const frozenDelivery  = serverValidation.delivery_charge ?? deliveryCharge
      const frozenFinal     = serverValidation.final_total
      const frozenFree      = frozenDelivery === 0
      const frozenBurewala  = form.city.trim().toLowerCase() === 'burewala'
      const serverSubtotal  = serverValidation.effective_subtotal
      const serverOrigTotal = serverValidation.original_subtotal
      const serverSaleDisc  = serverValidation.sale_discount
      const serverCouponDisc = serverValidation.coupon_discount
      const serverPreDiscountTotal     = serverValidation.pre_discount_total ?? serverSubtotal
      const serverPrepaidDiscPercent   = serverValidation.prepaid_discount_percent ?? 0
      const serverPrepaidDisc          = serverValidation.prepaid_discount ?? 0

      // Server price is always authoritative — client prices are never trusted.
      // No mismatch check needed: server re-fetches from DB, applies real discounts,
      // validates coupons, and computes delivery. We always use server values.

      // ── Customer resolution — single atomic RPC (see v58 migration) ──
      // Previously this was two separate JS lookups (by email, then by
      // phone) picking whichever matched first. If email and phone each
      // matched a DIFFERENT existing record — e.g. a lightweight record
      // auto-created at login, plus an older order under the same phone
      // with a different/blank email — the old code silently kept one
      // and orphaned the other's cart/order/wishlist history. This RPC
      // does the same lookup server-side and MERGES the two instead,
      // atomically, so nothing is ever lost to a silent overwrite.
      let customer
      const normalizeCity = s => s ? s.trim().charAt(0).toUpperCase() + s.trim().slice(1).toLowerCase() : s
      const { data: resolvedCustomerId, error: resolveErr } = await supabase.rpc('resolve_checkout_customer', {
        p_name: form.name, p_phone: form.phone, p_email: form.email,
        p_city: normalizeCity(form.city), p_address: form.address,
      })
      if (resolveErr || !resolvedCustomerId) {
        // v58 not run yet on this DB — fall back to the old direct lookup
        // so checkout never breaks while migrations are pending.
        console.warn('[placeOrder] resolve_checkout_customer RPC unavailable, using fallback:', resolveErr?.message)
        const customerPayload = { name: form.name, phone: form.phone, email: form.email, city: normalizeCity(form.city), address: form.address }
        const { data: existingByEmail } = form.email
          ? await supabase.from('customers').select('id').ilike('email', form.email.trim()).maybeSingle()
          : { data: null }
        const { data: existingByPhone } = !existingByEmail
          ? await supabase.from('customers').select('id').eq('phone', form.phone).maybeSingle()
          : { data: null }
        const existing = existingByEmail || existingByPhone
        if (existing) {
          const { data: updated, error: uErr } = await supabase
            .from('customers').update(customerPayload).eq('id', existing.id).select().single()
          if (uErr) throw uErr
          customer = updated
        } else {
          const { data: inserted, error: iErr } = await supabase
            .from('customers').insert(customerPayload).select().single()
          if (iErr) {
            // Race guard: two near-simultaneous checkout attempts (e.g. a
            // double-tap on "Place Order") can both see "no existing
            // customer" and both try to insert — only one wins, the other
            // gets a unique constraint conflict (23505) on phone or email.
            // Instead of failing the whole order over this, re-look-up the
            // row that just won and use it.
            if (iErr.message?.includes('23505') || iErr.status === 409) {
              const { data: wonRace } = await supabase
                .from('customers').select('id').eq('phone', form.phone).maybeSingle()
              if (wonRace) {
                customer = wonRace
              } else {
                throw iErr
              }
            } else {
              throw iErr
            }
          } else {
            customer = inserted
          }
        }
      } else {
        customer = { id: resolvedCustomerId }
      }
      if (!customer) throw new Error('Failed to save customer info')

      // ── Give this cart a real identity right now, not just at login ──
      // Previously, a guest who checked out without ever logging in stayed
      // tagged as "Guest (No info)" in cart_items forever — the admin view
      // could only INFER who they were by cross-referencing session_id
      // against their orders (a display-time guess). This does it for real:
      // the moment we know who they are (this order), their cart_items rows
      // get permanently relabeled with customer_id — same reusable merge
      // logic login already uses, so quantities combine correctly if they'd
      // also added things while logged in on another device previously.
      const cartSessionIdForMerge = (typeof window !== 'undefined' && localStorage.getItem('viro_cart_session')) || null
      if (cartSessionIdForMerge) {
        try {
          await supabase.rpc('merge_guest_cart_into_customer', {
            p_session_id: cartSessionIdForMerge, p_customer_id: customer.id,
          })
        } catch (mergeErr) {
          console.warn('[placeOrder] cart identity attach failed (non-fatal):', mergeErr?.message)
        }
      }

      // Attach this browser's cart session_id to the order — lets the admin
      // dashboard later recognize a returning guest cart by matching it
      // against an order they already placed (see v55 migration).
      const cartSessionId = (typeof window !== 'undefined' && localStorage.getItem('viro_cart_session')) || null

      // Auto-detect this order's traffic source from the SAME cart_items.source
      // values already recorded at add-to-cart time (see v60 migration) — the
      // true origin, not a re-guess of the current browser's user-agent (which
      // could be wrong if they were redirected to an external browser between
      // clicking an ad and actually checking out).
      let orderSource = 'direct'
      if (cartSessionId) {
        try {
          const { data: detectedSource } = await supabase.rpc('get_cart_source', { p_session_id: cartSessionId })
          if (detectedSource) orderSource = detectedSource
        } catch { /* v60 not run yet — default to 'direct', never block checkout on this */ }
      }

      // Build order payload — try full payload first (requires v48 migration to have been run).
      // If Supabase returns 400 (columns missing), fall back to minimal columns that always exist.
      const fullOrderPayload = {
        customer_id:       customer.id,
        session_id:        cartSessionId,
        source:            orderSource,
        total_price:       serverSubtotal,
        original_subtotal: serverOrigTotal,
        sale_discount:     serverSaleDisc,
        delivery_charges:  frozenDelivery,
        final_total:       frozenFinal,
        status:            'UNPAID',
        payment_method:    paymentMethod === 'cod' ? 'COD' : paymentMethod.toUpperCase(),
        coupon_code:       serverValidation.coupon ? couponCode.toUpperCase() : null,
        coupon_discount:   serverCouponDisc,
        pre_discount_total:       serverPreDiscountTotal,
        prepaid_discount_percent: serverPrepaidDiscPercent,
        prepaid_discount:         serverPrepaidDisc,
        discount_type:     serverPrepaidDisc > 0 && (serverSaleDisc > 0 || serverCouponDisc > 0) ? 'multiple'
                             : serverPrepaidDisc > 0 ? 'prepaid'
                             : serverSaleDisc > 0 && serverCouponDisc > 0 ? 'both'
                             : serverCouponDisc > 0 ? 'coupon'
                             : serverSaleDisc > 0 ? 'sale'
                             : 'none',
        // New column (migration 036) — only in the "full" tier so a DB
        // that hasn't run that migration yet naturally falls back to the
        // minimal payload below instead of failing the whole order over it.
        partner_credit_used: serverValidation.partner_coins_applied || 0,
      }
      const minimalOrderPayload = {
        customer_id:    customer.id,
        session_id:     cartSessionId,
        source:         orderSource,
        total_price:    frozenFinal,        // final = what customer actually pays
        delivery_charges: frozenDelivery,
        // CONFIRMED via live-DB diagnostic (23502 on final_total): the
        // NOT NULL DEFAULT 0 this column has in the tracked migration files
        // no longer matches the live database — the default was dropped at
        // some point directly on Supabase, outside any committed migration.
        // Every fallback tier must send this explicitly now; it can no
        // longer rely on a DB default that isn't actually there.
        final_total:    frozenFinal,
        status:         'UNPAID',
        payment_method: paymentMethod === 'cod' ? 'COD' : paymentMethod.toUpperCase(),
        coupon_code:    serverValidation.coupon ? couponCode.toUpperCase() : null,
      }

      let order
      const { data: orderFull, error: oErrFull } = await supabase
        .from('orders').insert(fullOrderPayload).select().single()
      if (oErrFull) {
        // 400 = column doesn't exist in DB yet (migration not run) — fall back to minimal
        console.warn('[placeOrder] Full order insert failed, trying minimal payload:', oErrFull.message)
        const { data: orderMin, error: oErrMin } = await supabase
          .from('orders').insert(minimalOrderPayload).select().single()
        if (oErrMin) {
          // Could be session_id missing (v55 not run) OR source missing (v60 not
          // run) OR both — strip each independently so checkout is never blocked
          // by either migration being pending.
          console.warn('[placeOrder] Minimal insert also failed, trying without source:', oErrMin.message)
          const { source, ...minimalNoSource } = minimalOrderPayload
          const { data: orderNoSource, error: oErrNoSource } = await supabase
            .from('orders').insert(minimalNoSource).select().single()
          if (oErrNoSource) {
            console.warn('[placeOrder] Still failing, dropping session_id too:', oErrNoSource.message)
            const { session_id, ...minimalNoSession } = minimalNoSource
            const { data: orderBare, error: oErrBare } = await supabase
              .from('orders').insert(minimalNoSession).select().single()
            if (oErrBare) throw oErrBare
            order = orderBare
          } else {
            order = orderNoSource
          }
        } else {
          order = orderMin
        }
      } else {
        order = orderFull
      }
      if (!order) throw new Error('Order insert returned no data')

      // ── Deduct spent Partner Coins now that the order genuinely exists ──
      // Best-effort, non-fatal: the order (and its total, which already
      // reflects the deduction) is safely placed by this point regardless
      // of whether this bookkeeping call succeeds.
      if (serverValidation.partner_coins_applied > 0 && user?.email) {
        fetch('/api/influencer-redeem', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, amount: serverValidation.partner_coins_applied, order_id: order.id }),
        }).catch(() => {}) // fire-and-forget — never block the success screen over this
      }

      // ── Close the loop on the checkout_sessions row opened at "Review Order" ──
      // Best-effort, non-fatal — the order itself is already safely placed
      // by this point regardless of whether this bookkeeping update works.
      try {
        if (cartSessionId && supabase) {
          const { data: updatedRows, error: markErr } = await supabase.from('checkout_sessions')
            .update({ status: 'completed', completed_order_id: order.id, updated_at: new Date().toISOString() })
            .eq('attempt_key', getAttemptKey(cartSessionId))
            .select('id')
          if (markErr) console.warn('[checkout_sessions] complete-mark failed (non-fatal):', markErr.message)
          // BUGFIX: session_id can ROTATE between "Review Order" and actually
          // placing the order (e.g. logging in/out shifts the stored cart
          // session id — see CartContext.jsx) — so the row captured earlier
          // may no longer match THIS session_id at all, silently updating
          // zero rows with no error. That left completed orders permanently
          // stuck showing as "Reviewing — not placed yet" in admin. Fall
          // back to matching by phone (the one stable identifier across a
          // session change) on the most recent still-open session for this
          // person, so the real completed order gets linked either way.
          if ((!updatedRows || updatedRows.length === 0) && form.phone) {
            const { data: fallbackRows } = await supabase.from('checkout_sessions')
              .select('id').eq('phone', form.phone).neq('status', 'completed')
              .order('updated_at', { ascending: false }).limit(1)
            if (fallbackRows?.[0]?.id) {
              await supabase.from('checkout_sessions')
                .update({ status: 'completed', completed_order_id: order.id, updated_at: new Date().toISOString() })
                .eq('id', fallbackRows[0].id)
            }
          }
        }
      } catch { /* never let bookkeeping break a placed order */ }


      if (!supabase) throw new Error('Supabase not configured')
      // Use server-validated item prices (not client-supplied)
      const orderItemsPayload = serverValidation.items.map(i => {
        // Find matching cart item to get variant selections
        const cartItem = snapshotCart.find(c => c.id === i.id)
        return {
          order_id:           order.id,
          product_id:         i.id,
          quantity:           i.quantity,
          price:              i.effective_price,
          original_price:     i.price,
          selected_color_id:  cartItem?.selected_color_id  || null,
          selected_size_id:   cartItem?.selected_size_id   || null,
          // BUGFIX: cart items store the human-readable variant as a
          // nested object (selected_color.label / selected_size.label —
          // set in ProductDetailClient's addToCart call), never as a flat
          // selected_color_name/selected_size_name string. Reading only
          // the flat field meant this was ALWAYS null, so admin never
          // showed which colour/size was ordered even though the
          // colour/size ID was saved correctly the whole time.
          selected_color_name:cartItem?.selected_color_name || cartItem?.selected_color?.label || null,
          selected_size_name: cartItem?.selected_size_name  || cartItem?.selected_size?.label  || null,
        }
      })
      // BUGFIX: this insert's result was never checked. If it failed for any
      // reason (RLS, a column not existing yet on this DB, a bad FK), the
      // order itself still went through fine (already inserted above,
      // total charged is correct) but ended up with ZERO rows in
      // order_items — admin's Orders tab then shows "0 items" and no
      // product/colour at all, even though stock still got decremented
      // below and the customer really did order something. Now mirrors
      // the same tiered fallback already used for the `orders` insert
      // itself, so a missing column can never silently drop the whole
      // item list — and if every tier fails, we at least log loudly
      // instead of pretending nothing went wrong.
      const { error: itemsErr } = await supabase.from('order_items').insert(orderItemsPayload)
      if (itemsErr) {
        console.warn('[placeOrder] order_items insert failed, retrying without variant name columns:', itemsErr.message)
        const noNamesPayload = orderItemsPayload.map(({ selected_color_name, selected_size_name, ...rest }) => rest)
        const { error: itemsErr2 } = await supabase.from('order_items').insert(noNamesPayload)
        if (itemsErr2) {
          console.warn('[placeOrder] order_items insert still failing, retrying with minimal columns:', itemsErr2.message)
          const minimalPayload = noNamesPayload.map(({ selected_color_id, selected_size_id, original_price, ...rest }) => rest)
          const { error: itemsErr3 } = await supabase.from('order_items').insert(minimalPayload)
          if (itemsErr3) {
            // Last resort — surface loudly instead of silently losing what
            // was ordered. The order (and payment obligation) already
            // exists, so we don't block the success screen over this, but
            // this MUST be visible somewhere for admin to reconcile.
            console.error('[placeOrder] CRITICAL: order_items insert failed completely for order', order.id, itemsErr3.message)
            try {
              await supabase.from('orders').update({
                admin_note: `⚠️ order_items insert failed: ${itemsErr3.message}. Cart snapshot: ${JSON.stringify(snapshotCart.map(c => ({ id:c.id, name:c.name, qty:c.quantity, color:c.selected_color_name||c.selected_color?.label||null, size:c.selected_size_name||c.selected_size?.label||null })))}`,
              }).eq('id', order.id)
            } catch { /* best effort only — never block the success screen */ }
          }
        }
      }

      // v47: Decrement stock immediately when customer places order.
      // Available stock = stock column (already decremented, real-time).
      // On CANCEL or RETURN → stock restored via restore_stock RPC in edge function.
      for (const item of snapshotCart) {
        if (!supabase) return
        // Deal Box items aren't a real product row — decrement EACH included
        // product's stock instead (1 set per bundle × however many bundles
        // were bought), so buying a deal actually consumes real inventory
        // shared with standalone sales of the same products.
        if (item.isDeal) {
          for (const includedId of (item.includedProductIds || [])) {
            await supabase.rpc('decrement_stock', { p_product_id: includedId, p_qty: item.quantity })
          }
          continue
        }
        // Use variant-aware decrement when item has colour/size selection
        if (item.selected_color_id || item.selected_size_id) {
          await supabase.rpc('decrement_variant_stock', {
            p_product_id: item.id,
            p_color_id:   item.selected_color_id || null,
            p_size_id:    item.selected_size_id  || null,
            p_qty:        item.quantity,
          })
        } else {
          await supabase.rpc('decrement_stock', { p_product_id: item.id, p_qty: item.quantity })
        }
      }

      // ── Redeem coupon: increment usage count (AWAITED — prevents infinite-use bug) ──
      if (couponResult?.valid && couponResult?.coupon?.id) {
        try {
          await redeemCoupon(couponResult.coupon.id)
        } catch (couponErr) {
          // Log but don't fail the order — customer already paid (COD)
          // Admin can manually fix usage count if needed
          console.error('[placeOrder] redeemCoupon failed after order placed:', couponErr.message)
        }
      }

      const history = JSON.parse(localStorage.getItem('viro_orders') || '[]')
      history.unshift({
        id: order.id, created_at: new Date().toISOString(), status: 'UNPAID',
        final_total: frozenFinal, delivery_charges: frozenDelivery, total_price: snapshotTotal,
        city: form.city, name: form.name,
        items: snapshotCart.map(i => ({ name: i.name, quantity: i.quantity, price: effectivePrice(i) }))
      })
      localStorage.setItem('viro_orders', JSON.stringify(history.slice(0, 50)))

      await sendOrderEmail({
        name: form.name, email: form.email, orderId: order.id,
        items: snapshotCart.map(i => ({ name: i.name, quantity: i.quantity, price: effectivePrice(i), original_price: i.price })),
        subtotal: snapshotTotal,
        originalSubtotal: snapshotOriginalTotal,
        saleDiscount: snapshotSaleDiscount,
        couponCode: couponResult?.valid ? couponCode.toUpperCase() : null,
        couponDiscount: couponResult?.valid ? (couponResult.discount || 0) : 0,
        // BUGFIX: prepaid discount was never passed to the email at all —
        // the breakdown skipped straight from coupon to delivery, so the
        // itemized rows didn't add up to the total actually charged.
        prepaidDiscount: serverPrepaidDisc,
        prepaidDiscountPercent: serverPrepaidDiscPercent,
        deliveryCharge: frozenDelivery,
        finalTotal: frozenFinal,
        city: form.city,
        contact,
        // BUGFIX: email used to always say "Cash on Delivery" — now reflects
        // the actual payment method, and prepaid orders get the send-money
        // instructions baked into the email itself.
        paymentMethod: paymentMethod === 'cod' ? 'COD' : paymentMethod,
        accountNumber: selectedAccount?.number || null,
        accountName: selectedAccount?.name || null,
      })

      setOrderId(order.id)
      // Meta CAPI: Purchase
      console.log("[CAPI] Calling trackPurchase — orderId:", order.id, "total:", frozenFinal)
      import("../../lib/metaEvents").then(m => m.trackPurchase({ id: order.id, final_total: frozenFinal }, snapshotCart, { email: form.email, phone: form.phone, first_name: form.name?.split(" ")[0], last_name: form.name?.split(" ").slice(1).join(" "), city: form.city, user_id: user?.id })).catch(() => {})
      setSnapshotFinal(frozenFinal)
      setFrozenOrderValues({ delivery: frozenDelivery, total: frozenFinal, isFree: frozenFree, isBurewala: frozenBurewala,
        final_total: frozenFinal, delivery_charge: frozenDelivery, items: serverValidation.items,
        subtotal: snapshotTotal,
        saleDiscount: snapshotSaleDiscount,
        originalSubtotal: snapshotOriginalTotal,
        couponDiscount: couponResult?.valid ? (couponResult.discount || 0) : 0,
        couponCode: couponResult?.valid ? couponCode.toUpperCase() : null,
        prepaidDiscount: serverPrepaidDisc,
        prepaidDiscountPercent: serverPrepaidDiscPercent,
        paymentMethod,
      })

      // ── Auto-save address for Google users (if not already saved) ──────────
      if (user?.email && !selectedAddrId) {
        try {
          const { rpcAnon } = await import('../../lib/authClient')
          await rpcAnon('upsert_customer_address', {
            p_email:   user.email,
            p_label:   'Home',
            p_name:    form.name,
            p_phone:   form.phone,
            p_city:    form.city,
            p_address: form.address,
            p_default: true,
            p_addr_id: null,
          })
        } catch {} // non-blocking
      }

      // ── Order confirmation push notification (non-blocking, non-critical) ───
      // Uses /api/push-order — a server-side route with ONESIGNAL_REST_KEY.
      // Never fails the order flow if push doesn't work.
      fetch('/api/push-order', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          name:    form.name.split(' ')[0],  // first name only
          total:   frozenFinal,
          phone:   form.phone,
        }),
      }).catch(() => {}) // fire-and-forget — push failure must not affect checkout
      if (isQuick) {
        sessionStorage.removeItem('viro_quick_order')
        // These items were auto-merged into the real cart when this Buy-Now
        // checkout mounted (safety net against losing them on abandon) —
        // now that the order's actually placed, remove just these items
        // so they don't sit in the cart as an already-ordered duplicate.
        // Anything else the shopper had in their cart is left exactly as is.
        for (const item of snapshotCart) {
          removeFromCart(`${item.id}:${item.selected_color_id || ''}:${item.selected_size_id || ''}`)
        }
      } else {
        clearCart()
      }

      // ── GTM / GA4 purchase event ───────────────────────────────────
      try {
        const activeItems = isQuick ? snapshotCart : cart
        window.dataLayer = window.dataLayer || []
        window.dataLayer.push({ ecommerce: null }) // clear previous ecommerce data
        window.dataLayer.push({
          event: 'purchase',
          ecommerce: {
            transaction_id: order.id,
            value: frozenFinal,
            currency: 'PKR',
            shipping: frozenDelivery,
            items: (activeItems || []).map((item, i) => ({
              item_id:   item.id,
              item_name:          item.name,
              price:              effectivePrice(item),
              quantity:           item.quantity,
              selected_color_id:  item.selected_color_id  || null,
              selected_size_id:   item.selected_size_id   || null,
              selected_color:     item.selected_color     ? JSON.stringify(item.selected_color) : null,
              selected_size:      item.selected_size      ? JSON.stringify(item.selected_size)  : null,
              index:     i,
            })),
          },
        })
      } catch (gtmErr) {
        console.warn('GTM purchase push failed:', gtmErr)
      }

      setStep('success')
      window.scrollTo(0, 0)
    } catch (err) {
      console.error('[placeOrder] FAILED — full error below:', err)
      // Try to pull a real Postgres error code/message out of whatever shape
      // this error came in (our custom REST client puts the raw response
      // body — often a JSON string — straight into err.message).
      let hint = ''
      try {
        const parsed = typeof err?.message === 'string' && err.message.trim().startsWith('{')
          ? JSON.parse(err.message) : null
        if (parsed?.code) hint = ` (code ${parsed.code}${parsed.message ? ': ' + parsed.message.slice(0, 80) : ''})`
      } catch { /* not JSON, ignore */ }
      showSimpleToast(`❌ Something went wrong${hint}. Please try again or contact us on WhatsApp.`, 'info')
    } finally {
      setLoading(false)
    }
  }

  if (!isQuick && activeCartItems.length === 0 && step === 'form') { router.push('/cart'); return null }

  // Blocks direct URL access to /checkout when the cart doesn't meet the
  // admin's minimum order amount — same rule the cart page and product
  // buttons already enforce, closing the loophole of typing the URL directly.
  if (belowMinOrder && step === 'form' && snapshotReady) { router.push(isQuick ? '/shop' : '/cart'); return null }

  /* ── SUCCESS ── */
  if (step === 'success') return (
    <div className="px-4 py-10 flex flex-col items-center text-center justify-center slide-up"
      style={{ background: 'var(--viro-sectionBg)', minHeight: '85vh' }}>
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 text-4xl border-2 border-emerald-500"
        style={{ background: '#10B98120' }}>✅</div>
      <h1 className="font-display text-2xl font-bold  mb-4">Order Placed!</h1>

      <div className="viro-card p-4 mb-5 max-w-sm w-full text-left">
        <p className="text-sm mb-3" style={{ color: '#CBD5E1' }}>
          Order <span className="font-bold ">#{orderId?.slice(0,8).toUpperCase()}</span>
        </p>

        {/* Status — wording adapts to payment method so prepaid customers who
            already sent money don't see a scary "UNPAID" label; the underlying
            order.status DB value is unchanged (still 'UNPAID' internally,
            matching the CHECK constraint) — this is display-only. */}
        <div className="p-3 rounded-xl mb-3" style={{ background: '#F9731312', border: '1px solid #F9731440' }}>
          {paymentMethod === 'cod' ? (
            <>
              <p className="text-orange-400 font-bold text-sm">⏳ Status: Pending Confirmation</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--viro-textMuted)' }}>We will confirm via phone or WhatsApp</p>
            </>
          ) : (
            <>
              <p className="text-orange-400 font-bold text-sm">🟠 Payment Confirmation Pending</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--viro-textMuted)' }}>We're verifying your payment receipt — you'll be confirmed shortly</p>
            </>
          )}
        </div>

        {/* Payment method on success */}
        {paymentMethod === 'cod' ? (
          <div className="p-3 rounded-xl mb-4" style={{ background:'#8B5CF612', border:'1px solid #8B5CF640' }}>
            <p className="text-purple-400 font-bold text-sm">💵 Payment: Cash on Delivery</p>
            <p className="text-xs mt-0.5" style={{ color:'var(--viro-textMuted)' }}>Pay when your order arrives at your door</p>
          </div>
        ) : selectedAccount ? (
          <div className="p-3 rounded-xl mb-4" style={{ background:'#10B98112', border:'1px solid #10B98140' }}>
            <p className="font-bold text-sm mb-1" style={{ color:'#10B981' }}>
              {selectedAccount.icon} Prepaid via {selectedAccount.label}
            </p>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <p className="text-xs" style={{ color:'var(--viro-textMuted)' }}>
                Send Rs.{snapshotFinal?.toLocaleString() || finalTotal.toLocaleString()} to:
              </p>
              <span className="font-bold text-sm tracking-wide" style={{ color:'var(--viro-text)' }}>{selectedAccount.number}</span>
              <button type="button"
                onClick={() => {
                  if (navigator?.clipboard) {
                    navigator.clipboard.writeText(selectedAccount.number)
                      .then(() => showSimpleToast('✅ Number copied!', 'success'))
                      .catch(() => showSimpleToast('✅ ' + selectedAccount.number, 'info'))
                  } else {
                    showSimpleToast('✅ ' + selectedAccount.number, 'info')
                  }
                }}
                className="px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all"
                style={{ background: '#10B98130', color: '#10B981', border:'1px solid #10B98150' }}>
                📋 Copy
              </button>
              <span className="text-xs" style={{ color:'var(--viro-textMuted)' }}>({selectedAccount.name})</span>
            </div>
            <a href={`https://wa.me/92${WHATSAPP_RECEIPT.replace(/^0/,'')}?text=${encodeURIComponent(
              `Hi! I just placed an order on Viro.pk and paid via ${selectedAccount.label}.

*Order ID:* #${orderId?.slice(0,8).toUpperCase()}
*Amount Sent:* Rs.${(snapshotFinal ?? finalTotal).toLocaleString()}
*Sent To:* ${selectedAccount.number} (${selectedAccount.name})
*Name:* ${form.name}
*Phone:* ${form.phone}

📎 Attaching my payment screenshot below — please confirm my order. 🙏`
            )}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2 rounded-xl font-bold text-xs"
              style={{ background:'#25D366', color:'#fff', textDecoration:'none' }}>
              📤 Send Receipt on WhatsApp
            </a>
            <p className="text-xs text-center mt-1.5" style={{ color:'var(--viro-textMuted)' }}>
              Tap above, then attach your payment screenshot and hit send
            </p>
          </div>
        ) : null}

        {/* Bill — frozen values captured at order placement time */}
        <div className="space-y-1.5 text-sm border-t pt-3" style={{ borderColor: 'var(--viro-border)' }}>
          {/* Original price — strikethrough only when sale discount exists */}
          {snapshotSaleDiscount > 0 && (
            <div className="flex justify-between">
              <span style={{ color: 'var(--viro-textMuted)' }}>Original Price</span>
              <span style={{ color: '#94A3B8', fontWeight: 600, textDecoration: 'line-through' }}>
                Rs.{snapshotOriginalTotal.toLocaleString()}
              </span>
            </div>
          )}
          {/* Sale discount row */}
          {snapshotSaleDiscount > 0 && (
            <div className="flex justify-between">
              <span style={{ color: '#F97316' }}>🏷️ Sale Discount</span>
              <span style={{ color: '#F97316', fontWeight: 700 }}>−Rs.{snapshotSaleDiscount.toLocaleString()}</span>
            </div>
          )}
          {/* Subtotal — always shown */}
          <div className="flex justify-between">
            <span style={{ color: 'var(--viro-textMuted)' }}>Subtotal</span>
            <span style={{ color: 'var(--viro-text)', fontWeight: 600 }}>
              Rs.{(frozenOrderValues?.subtotal ?? snapshotTotal).toLocaleString()}
            </span>
          </div>
          {/* Coupon discount */}
          {(frozenOrderValues?.couponDiscount > 0 || couponResult?.valid) && (
            <div className="flex justify-between">
              <span style={{ color: '#10B981' }}>🎟️ Coupon ({frozenOrderValues?.couponCode || couponResult?.coupon?.code || couponCode})</span>
              <span style={{ color: '#10B981', fontWeight: 700 }}>−Rs.{(frozenOrderValues?.couponDiscount ?? couponResult?.discount ?? 0).toLocaleString()}</span>
            </div>
          )}
          {/* After-coupon subtotal */}
          {(frozenOrderValues?.couponDiscount > 0 || couponResult?.valid) && (
            <div className="flex justify-between">
              <span style={{ color: 'var(--viro-textMuted)' }}>After Coupon</span>
              <span style={{ color: 'var(--viro-text)', fontWeight: 600 }}>
                Rs.{Math.max(0, (frozenOrderValues?.subtotal ?? snapshotTotal) - (frozenOrderValues?.couponDiscount ?? couponResult?.discount ?? 0)).toLocaleString()}
              </span>
            </div>
          )}
          {/* Prepaid discount — only shows for JazzCash/EasyPaisa orders, never for COD */}
          {(frozenOrderValues?.prepaidDiscount ?? 0) > 0 && (
            <div className="flex justify-between items-center" style={{ padding:'5px 8px', borderRadius:8, background:'#10B98112', border:'1px solid #10B98130' }}>
              <span style={{ color:'#10B981', fontWeight:700, fontSize:12 }}>
                💳 Prepaid Discount ({frozenOrderValues.prepaidDiscountPercent}%)
              </span>
              <span style={{ color:'#10B981', fontWeight:800 }}>−Rs.{frozenOrderValues.prepaidDiscount.toLocaleString()}</span>
            </div>
          )}
          {/* Delivery */}
          <div className="flex justify-between">
            <span style={{ color: 'var(--viro-textMuted)' }}>Delivery</span>
            <span className="font-semibold" style={frozenOrderValues?.isFree ? {color:'#10B981'} : {color:'var(--viro-text)'}}>
              {frozenOrderValues?.isFree ? '🎉 FREE' : `Rs.${frozenOrderValues?.delivery ?? deliveryCharge}`}
            </span>
          </div>
          <div className="flex justify-between font-bold border-t pt-2 mt-1" style={{ borderColor: 'var(--viro-border)' }}>
            <span style={{ color: "var(--viro-text)" }} className="text-base">Total to Pay</span>
            <span className="text-xl" style={{ color: '#7C3AED' }}>Rs.{(frozenOrderValues?.total ?? finalTotal).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* ── Google login CTA — only for non-logged-in users ── */}
      {!user && (
        <div className="w-full max-w-sm mb-3 p-4 rounded-2xl"
          style={{ background:'linear-gradient(135deg,#1e1b4b,#0f172a)', border:'1.5px solid #8B5CF650', boxShadow:'0 8px 32px rgba(139,92,246,0.2)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="text-2xl">🔔</div>
            <div>
              <p className="font-bold text-sm" style={{ color:'#E2E8F0',margin:0 }}>Track your order live</p>
              <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>Sign in to see real-time status, no phone needed</p>
            </div>
          </div>
          <GoogleSignInButton
            onSignIn={() => { sessionStorage.setItem('viro_auth_redirect', '/orders'); signIn('/orders') }}
            label="Sign in with Google to Track"
            size="sm"
          />
          <p className="text-xs text-center mt-2" style={{ color:'#475569' }}>You can also track by phone on the orders page</p>
        </div>
      )}

      <div className="flex flex-col gap-3 w-full max-w-sm">
        <button
          onClick={() => {
            const items = (frozenOrderValues?.items ?? snapshotCart)
            const itemLines = items.map(i =>
              `• ${i.name} ×${i.quantity} — Rs.${((i.effective_price ?? i.discount_price ?? i.price) * i.quantity).toLocaleString()}`
            ).join('\n')
            const total = frozenOrderValues?.final_total ?? frozenOrderValues?.total ?? finalTotal
            const delivery = frozenOrderValues?.delivery_charge ?? deliveryCharge
            const subtotal = frozenOrderValues?.subtotal ?? snapshotTotal
            const couponDisc = frozenOrderValues?.couponDiscount ?? 0
            const prepaidDisc = frozenOrderValues?.prepaidDiscount ?? 0
            const prepaidPct = frozenOrderValues?.prepaidDiscountPercent ?? 0
            const isPrepaidOrder = frozenOrderValues?.paymentMethod && frozenOrderValues.paymentMethod !== 'cod'
            const shortId = orderId?.slice(0,8).toUpperCase()
            const orderLink = `${typeof window !== 'undefined' ? window.location.origin : 'https://www.viro.pk'}/orders?id=${orderId}`
            const msg = [
              `🛍️ *New Order — Viro.pk*`,
              `━━━━━━━━━━━━━━`,
              `*Order ID:* #${shortId}`,
              `*Order Link:* ${orderLink}`,
              `*Name:* ${form.name}`,
              `*Phone:* ${form.phone}`,
              `*City:* ${form.city}`,
              `*Address:* ${form.address}`,
              ``,
              `*Items:*`,
              itemLines,
              ``,
              `*Subtotal:* Rs.${subtotal.toLocaleString()}`,
              ...(couponDisc > 0 ? [`*Coupon Discount:* −Rs.${couponDisc.toLocaleString()}`] : []),
              ...(prepaidDisc > 0 ? [`*Prepaid Discount (${prepaidPct}%):* −Rs.${prepaidDisc.toLocaleString()}`] : []),
              `*Delivery:* Rs.${delivery === 0 ? 'FREE' : (delivery ?? 0).toLocaleString()}`,
              `*Total:* Rs.${(total ?? 0).toLocaleString()} (${isPrepaidOrder ? 'Prepaid — Already Paid ✅' : 'COD'})`,
              `━━━━━━━━━━━━━━`,
              `Please confirm this order. 🙏`,
            ].join('\n')
            openWhatsApp(msg, contact.whatsapp)
          }}
          className="w-full py-3.5 rounded-xl font-bold text-center text-sm text-white"
          style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)' }}>
          💬 Confirm via WhatsApp
        </button>
        <button onClick={() => router.push('/orders')} className="btn-ghost w-full py-3">📋 View My Orders</button>
        <button onClick={() => router.push('/')} className="btn-ghost w-full py-3">🏠 Back to Home</button>
      </div>
    </div>
  )

  /* ── REVIEW ── */
  /* ── OOS overlay popup ── */
  const oosPopup = oosError ? (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ width:'100%', maxWidth:520, background:'var(--viro-bg)', borderRadius:'20px 20px 0 0', padding:'0 0 env(safe-area-inset-bottom,20px)' }}>
        <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 4px' }}>
          <div style={{ width:40, height:4, borderRadius:2, background:'var(--viro-border)' }} />
        </div>
        <div style={{ padding:'4px 20px 14px', borderBottom:'1px solid var(--viro-border)', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:'#EF444415', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>📦</div>
          <div>
            <p style={{ margin:0, fontSize:16, fontWeight:900, color:'var(--viro-text)' }}>Item Out of Stock</p>
            <p style={{ margin:0, fontSize:12, color:'var(--viro-textSub)' }}>Someone just bought the last one before your order.</p>
          </div>
        </div>
        <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--viro-border)' }}>
          <div style={{ display:'flex', gap:12, alignItems:'center', padding:'10px 12px', borderRadius:12, background:'var(--viro-bgDeep)', border:'1.5px solid #EF444430' }}>
            <div style={{ width:56, height:56, borderRadius:10, overflow:'hidden', flexShrink:0, position:'relative', background:'var(--viro-bgCard)', border:'1px solid #EF444430' }}>
              {oosError.item?.images && (
                <img src={Array.isArray(oosError.item.images) ? oosError.item.images[0] : oosError.item.images}
                  alt={oosError.productName} style={{ width:'100%', height:'100%', objectFit:'cover' }}
                  onError={e => { e.target.style.display='none' }} />
              )}

            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ margin:'0 0 3px', fontSize:13, fontWeight:800, color:'var(--viro-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{oosError.productName}</p>
              <p style={{ margin:0, fontSize:11, fontWeight:700, color:'#EF4444' }}>
                {oosError.stockLeft === 0 ? '⛔ No stock remaining' : `⚠️ Only ${oosError.stockLeft} left in stock`}
              </p>
            </div>
          </div>
        </div>
        <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:8 }}>
          {oosError.cartKey && oosError.stockLeft > 0 && (
            <button onClick={() => { updateQty(oosError.cartKey, oosError.stockLeft); setOosError(null) }}
              style={{ padding:'14px', borderRadius:14, fontWeight:800, fontSize:14, border:'none', cursor:'pointer', color:'#fff', background:'linear-gradient(135deg,#10B981,#059669)' }}>
              ✅ Keep {oosError.stockLeft} &amp; Continue Order
            </button>
          )}
          {(() => {
            const oosKey = oosError.cartKey
            const remaining = cart.filter(i => (i._cartKey || i.id) !== oosKey)
            const handleRemove = () => {
              if (oosKey) removeFromCart(oosKey)
              setOosError(null)
              if (remaining.length === 0) {
                setTimeout(() => { window.location.href = '/shop' }, 150)
              }
            }
            return (
              <button onClick={handleRemove}
                style={{ padding:'14px', borderRadius:14, fontWeight:800, fontSize:14, border:'none', cursor:'pointer',
                  background: oosError.stockLeft > 0 ? 'var(--viro-bgDeep)' : 'linear-gradient(135deg,#7C3AED,#4F46E5)',
                  color: oosError.stockLeft > 0 ? 'var(--viro-text)' : '#fff',
                  border: oosError.stockLeft > 0 ? '1.5px solid var(--viro-border)' : 'none' }}>
                {remaining.length > 0
                  ? `🗑 Remove & Continue (${remaining.length} item${remaining.length>1?'s':''} left)`
                  : '🛒 Remove & Go Shopping'}
              </button>
            )
          })()}
          <button onClick={() => { setOosError(null); window.location.href='/cart' }}
            style={{ padding:'11px', borderRadius:14, fontWeight:600, fontSize:12, cursor:'pointer', color:'var(--viro-textSub)', background:'transparent', border:'none' }}>
            ← Go Back to Cart
          </button>
        </div>
      </div>
    </div>
  ) : null

  function renderReviewSection() { return (
    <div className="px-4 md:px-8 max-w-5xl mx-auto">
      {/* Prominent coupon banner — always visible at top of review */}
      {couponEnabled && (
        <div style={{
          marginBottom:16, borderRadius:14,
          // BUGFIX: this used to be a near-transparent gradient
          // (#10B98115 → #10B98108 — those trailing 2 hex digits are alpha,
          // ~8% and ~3% opacity) with a single fully-solid stripe in the
          // middle. White text sat fine on that one solid stripe but was
          // almost unreadable everywhere else on the banner, since the
          // background there was nearly the same colour as the page behind
          // it. Now a genuinely solid, fully-opaque green the whole way
          // across, so white text has consistent, strong contrast everywhere.
          background: couponResult?.valid
            ? 'linear-gradient(135deg,#10B981,#059669)'
            : 'linear-gradient(135deg,#7C3AED12,#4F46E508)',
          border: couponResult?.valid ? 'none' : '1.5px dashed #7C3AED40',
          boxShadow: couponResult?.valid ? '0 4px 14px rgba(16,185,129,0.35)' : 'none',
          padding:'12px 14px',
        }}>
          {couponResult?.valid ? (
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:22 }}>🎉</span>
              <div style={{ flex:1 }}>
                <p style={{ margin:0, fontSize:13, fontWeight:800, color:'#fff' }}>
                  Coupon applied! Saving Rs.{couponResult.discount?.toLocaleString()}
                </p>
                <p style={{ margin:0, fontSize:11, color:'rgba(255,255,255,0.85)', fontWeight:600 }}>
                  Code: <span style={{ fontFamily:'monospace', letterSpacing:'0.06em' }}>{couponCode}</span>
                  {couponResult.coupon?.type === 'percent'
                    ? ` · ${couponResult.coupon.value}% off`
                    : ` · Rs.${couponResult.coupon?.value} off`}
                </p>
              </div>
              <button onClick={removeCoupon}
                style={{ fontSize:11, fontWeight:700, color:'#fff', background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.4)', borderRadius:6, padding:'4px 10px', cursor:'pointer' }}>
                Remove
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <span style={{ fontSize:18 }}>🏷️</span>
                <p style={{ margin:0, fontSize:13, fontWeight:800, color:'#7C3AED' }}>Have a coupon code?</p>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <input value={couponCode}
                  onChange={e => { setCouponCode(e.target.value.toUpperCase().replace(/\s/g,'')); setCouponResult(null) }}
                  onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                  placeholder="e.g. VIRO20, EID50"
                  maxLength={20}
                  style={{
                    flex:1, padding:'10px 12px', borderRadius:10,
                    border: couponResult && !couponResult.valid ? '1.5px solid #EF4444' : '1.5px solid #7C3AED40',
                    background:'var(--viro-bg)', fontSize:14, fontWeight:800,
                    fontFamily:'monospace', letterSpacing:'0.08em', color:'var(--viro-text)', outline:'none',
                  }}
                />
                <button onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()}
                  style={{
                    padding:'10px 16px', borderRadius:10, fontWeight:800, fontSize:13,
                    background: couponCode.trim() ? 'linear-gradient(135deg,#7C3AED,#4F46E5)' : 'var(--viro-bgDeep)',
                    color: couponCode.trim() ? '#fff' : 'var(--viro-textSub)',
                    border:'none', cursor: couponCode.trim() ? 'pointer' : 'not-allowed', flexShrink:0,
                    minWidth:72,
                  }}>
                  {couponLoading
                    ? <svg className="animate-spin w-4 h-4 mx-auto" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    : 'Apply'}
                </button>
              </div>
              {couponResult && !couponResult.valid && (
                <p style={{ margin:'5px 0 0', fontSize:11, color:'#EF4444', fontWeight:600 }}>❌ {couponResult.error}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Desktop: 2-col grid */}
      <div className="md:grid md:grid-cols-2 md:gap-6">
      <div className="md:col-span-1 space-y-4">
      {/* Items */}
      <div className="viro-card p-3">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--viro-textSub)' }}>Items</h3>
        <div className="space-y-2.5">
          {snapshotCart.map(item => {
            const price = effectivePrice(item)
            return (
              <div key={item.id} className="flex items-center gap-2.5 cursor-pointer group" onClick={() => router.push(`/product/${slugify(item.name)}-${item.id}`)}>
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"
                    style={{ background: 'var(--viro-bgDeep)', border: '1px solid var(--viro-border)' }}>
                    <ProductImage
                      images={item.images}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                    />
                  </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate group-hover:underline" style={{color:'var(--viro-text)'}}>{item.name}</p>
                  {/* Show selected colour/size if any */}
                  {(item.selected_color || item.selected_size) && (
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      {item.selected_color && (
                        <span style={{ display:'inline-flex', alignItems:'center', gap:3,
                          padding:'0px 6px', borderRadius:20, fontSize:9.5, fontWeight:700,
                          background:'#8B5CF615', color:'#A78BFA', border:'1px solid #8B5CF630' }}>
                          {item.selected_color?.hex && (
                            <span style={{ width:7, height:7, borderRadius:'50%',
                              background: item.selected_color.hex,
                              border:'1px solid rgba(255,255,255,0.3)', flexShrink:0 }} />
                          )}
                          {item.selected_color?.label}
                        </span>
                      )}
                      {item.selected_size && (
                        <span style={{ padding:'0px 6px', borderRadius:20, fontSize:9.5, fontWeight:700,
                          background:'#06B6D415', color:'#22D3EE', border:'1px solid #06B6D430' }}>
                          {item.selected_size.label}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-[11px]" style={{ color: 'var(--viro-textSub)' }}>×{item.quantity} @ Rs.{price?.toLocaleString()}</p>
                </div>
                <span className="text-xs font-bold flex-shrink-0" style={{ color: '#7C3AED' }}>
                  Rs.{(price * item.quantity).toLocaleString()}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      </div>{/* end left col */}
      <div className="md:col-span-1 space-y-4">
      {/* Bill */}
      <div className="viro-card p-3">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--viro-textSub)' }}>Bill Breakdown</h3>

        {/* "Add Rs.X more for FREE delivery" — only when the gap is worth offering (≥ Rs.500) */}
        {showFreeDeliveryNudge && (
          <div className="mb-2.5 flex items-center gap-2 px-2.5 py-2 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #7C3AED15, #A855F710)',
                border: '1.5px solid #7C3AED50',
                animation: 'viro-nudge-pulse 2s ease-in-out infinite',
                cursor: 'default',
              }}>
              <span style={{ fontSize: 20, animation: 'viro-truck-bounce 1.2s ease-in-out infinite', display:'inline-block' }}>🚚</span>
              <div className="flex-1">
                <span className="text-xs font-bold" style={{
                  background: 'linear-gradient(90deg, #7C3AED, #A855F7, #7C3AED)',
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  animation: 'viro-nudge-shimmer 2s linear infinite',
                  display: 'inline',
                }}>
                  Add just <strong>Rs.{freeDeliveryGap.toLocaleString()}</strong> more
                </span>
                <span className="text-xs font-semibold" style={{ color:'#7C3AED' }}> to unlock <strong>FREE delivery! 🎉</strong></span>
              </div>
            </div>
        )}
        {showFreeDeliveryNudge && (
          <div className="mb-2.5" style={{ height: 6, borderRadius: 999, background: 'var(--viro-border)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${freeDeliveryPct}%`, borderRadius: 999,
              background: 'linear-gradient(90deg,#7C3AED,#A855F7)',
              transition: 'width 0.3s ease',
            }} />
          </div>
        )}

        {/* ── Coupon input — only shown when admin enables it ── */}
        {couponEnabled && <div className="mb-4" style={{ borderRadius:14, border: couponResult?.valid ? '1.5px solid #10B98150' : '1.5px dashed #7C3AED40', overflow:'hidden', background: couponResult?.valid ? '#10B98108' : '#7C3AED05' }}>
          <div style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:15 }}>🏷️</span>
            <span style={{ fontSize:12, fontWeight:800, color: couponResult?.valid ? '#065F46' : '#7C3AED' }}>
              {couponResult?.valid ? `Coupon applied — saving Rs.${couponResult.discount?.toLocaleString()}` : 'Have a coupon code?'}
            </span>
          </div>
        </div>}
        {couponEnabled && <div className="mb-3">
          {!couponResult?.valid ? (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    value={couponCode}
                    onChange={e => {
                      setCouponCode(e.target.value.toUpperCase().replace(/\s/g,''))
                      setCouponResult(null) // clear feedback on type
                    }}
                    onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                    placeholder="Enter coupon code"
                    maxLength={20}
                    style={{
                      fontFamily:'monospace', fontWeight:700, fontSize:14,
                      letterSpacing:'0.08em', paddingRight: 32,
                      borderColor: couponResult && !couponResult.valid ? '#EF4444' : undefined,
                    }}
                  />
                  {couponCode && (
                    <button onClick={removeCoupon}
                      style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
                               color:'var(--viro-textSub)', fontSize:14, lineHeight:1 }}>✕</button>
                  )}
                </div>
                <button onClick={applyCoupon}
                  disabled={couponLoading || !couponCode.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold flex-shrink-0 transition-all"
                  style={{
                    background: couponCode.trim() ? 'linear-gradient(135deg,#8B5CF6,#A78BFA)' : 'var(--viro-bgDeep)',
                    color: couponCode.trim() ? '#fff' : 'var(--viro-textSub)',
                    border: '1px solid #8B5CF640',
                    minWidth: 64,
                  }}>
                  {couponLoading ? (
                    <svg className="animate-spin w-4 h-4 mx-auto" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  ) : 'Apply'}
                </button>
              </div>

              {/* Rich feedback — shown immediately after Apply */}
              {couponResult && !couponResult.valid && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl"
                  style={{ background:'#EF444412', border:'1.5px solid #EF444430' }}>
                  <span className="text-sm flex-shrink-0 mt-0.5">
                    {couponResult.error?.includes('expired')   ? '⏰' :
                     couponResult.error?.includes('valid from') ? '📅' :
                     couponResult.error?.includes('Invalid')    ? '❌' :
                     couponResult.error?.includes('Minimum')    ? '💰' :
                     couponResult.error?.includes('limit')      ? '🔴' : '⚠️'}
                  </span>
                  <p className="text-xs font-semibold" style={{ color:'#EF4444' }}>{couponResult.error}</p>
                </div>
              )}
            </div>
          ) : (
            /* Success state */
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
              style={{ background:'#10B98112', border:'1.5px solid #10B98140' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">🎟️</span>
                <div>
                  <p className="text-xs font-black" style={{ color:'#10B981', letterSpacing:'0.08em', fontFamily:'monospace' }}>
                    {couponResult.coupon.code}
                  </p>
                  <p className="text-xs" style={{ color:'#10B981' }}>
                    {couponResult.coupon.type === 'percent'
                      ? `${couponResult.coupon.value}% off — you save Rs.${couponDiscount.toLocaleString()}!`
                      : `Rs.${couponResult.coupon.value} off applied!`}
                  </p>
                </div>
              </div>
              <button onClick={removeCoupon}
                className="text-xs px-2 py-1 rounded-lg flex-shrink-0"
                style={{ color:'#EF4444', background:'#EF444415', border:'1px solid #EF444430' }}>
                ✕ Remove
              </button>
            </div>
          )}
        </div>}

        {/* ── Bill rows ── */}
        <div className="space-y-1.5 text-xs">
          {/* Original price — only shown when sale discount exists */}
          {snapshotSaleDiscount > 0 && (
            <div className="flex justify-between">
              <span style={{ color: 'var(--viro-textMuted)' }}>Original Price</span>
              <span style={{ color: '#94A3B8', textDecoration: 'line-through' }}>
                Rs.{snapshotOriginalTotal.toLocaleString()}
              </span>
            </div>
          )}
          {/* Sale discount */}
          {snapshotSaleDiscount > 0 && (
            <div className="flex justify-between">
              <span style={{ color: '#F97316' }}>🏷️ Sale Discount</span>
              <span className="font-bold" style={{ color: '#F97316' }}>−Rs.{snapshotSaleDiscount.toLocaleString()}</span>
            </div>
          )}
          {/* Subtotal — always shown */}
          <div className="flex justify-between">
            <span style={{ color: 'var(--viro-textMuted)' }}>Subtotal</span>
            <span style={{ color: "var(--viro-text)", fontWeight: 600 }}>Rs.{snapshotTotal.toLocaleString()}</span>
          </div>
          {/* Coupon discount */}
          {couponResult?.valid && (
            <div className="flex justify-between">
              <span style={{ color:'#10B981' }}>🎟️ Coupon ({couponResult.coupon.code})</span>
              <span className="font-bold" style={{ color:'#10B981' }}>−Rs.{couponDiscount.toLocaleString()}</span>
            </div>
          )}
          {/* Subtotal after coupon — replaces "After Coupon" label */}
          {couponResult?.valid && (
            <div className="flex justify-between">
              <span style={{ color: 'var(--viro-textMuted)' }}>Subtotal</span>
              <span style={{ color: 'var(--viro-text)', fontWeight: 600 }}>Rs.{discountedTotal.toLocaleString()}</span>
            </div>
          )}
          {/* Prepaid discount — only shows when JazzCash/EasyPaisa is selected, never for COD */}
          {prepaidDiscount > 0 && (
            <div className="flex justify-between items-center" style={{ padding:'5px 8px', borderRadius:8, background:'#10B98112', border:'1px solid #10B98130' }}>
              <span style={{ color:'#10B981', fontWeight:700, fontSize:12 }}>
                💳 Prepaid Discount ({prepaidDiscountPercent}%)
              </span>
              <span style={{ color:'#10B981', fontWeight:800 }}>−Rs.{prepaidDiscount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span style={{ color: 'var(--viro-textMuted)' }}>Delivery</span>
            <span style={isFree ? {color:'#10B981'} : {color:'var(--viro-text)'}} className="font-semibold">
              {isFree ? '🎉 FREE' : `Rs.${deliveryCharge}`}
            </span>
          </div>
          {isFree && (
            <p className="text-xs text-right" style={{ color: '#6EE7B7' }}>
              {cityRule ? `✓ Free delivery ≥ Rs.${cityRule.freeThreshold?.toLocaleString()}` : '✓ Free delivery'}
            </p>
          )}
          {/* Partner Coins — only shown to a logged-in, approved partner
              with an actual balance. Client-side amount here is a PREVIEW
              only (folded into finalTotal above); the real, capped amount
              is re-validated server-side in placeOrder() and is what
              actually gets charged and deducted. */}
          {partnerBalance > 0 && (
            <div className="flex items-center justify-between px-2.5 py-2 rounded-xl" style={{ background: '#F59E0B10', border: '1px solid #F59E0B30' }}>
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer" style={{ color: '#B45309' }}>
                <input type="checkbox" checked={usePartnerCoins} onChange={e => setUsePartnerCoins(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: '#F59E0B' }} />
                🪙 Use your Rs.{partnerBalance.toLocaleString()} Partner Coins
              </label>
              {usePartnerCoins && partnerCoinsPreview > 0 && (
                <span className="text-xs font-extrabold" style={{ color: '#B45309' }}>−Rs.{partnerCoinsPreview.toLocaleString()}</span>
              )}
            </div>
          )}
          <div className="flex justify-between font-bold border-t pt-2" style={{ borderColor: 'var(--viro-border)' }}>
            <span style={{ color: "var(--viro-text)" }} className="text-base">Total to Pay</span>
            <span className="text-xl" style={{ color: '#7C3AED' }}>Rs.{finalTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* COD → Prepaid nudge popup — fires once when COD is first selected.
          Rendered via createPortal straight into document.body. This is the
          robust fix: no matter what CSS any ancestor has now or gets added
          later (transform, will-change, opacity<1, filter, contain — any of
          these silently break position:fixed for descendants by making the
          ancestor a "containing block"), a portal renders completely outside
          the component tree, so position:fixed is always relative to the
          real, true browser viewport. This stops the "popup centers on the
          whole scrollable page instead of what's currently visible" bug for
          good, instead of chasing down each new CSS property that causes it. */}
      {showPrepaidNudge && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.55)', backdropFilter:'blur(3px)', animation:'vroFadeIn 0.15s ease-out' }}
          onClick={() => setShowPrepaidNudge(false)}>
          <style>{`
            @keyframes vroFadeIn { from { opacity:0; } to { opacity:1; } }
            @keyframes vroPopIn { from { opacity:0; transform:scale(0.92) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
            @keyframes vroPulseGlow { 0%,100% { box-shadow:0 4px 14px rgba(16,185,129,0.35); } 50% { box-shadow:0 4px 24px rgba(16,185,129,0.6); } }
            @keyframes vroShimmer { 0% { transform:translateX(-100%) rotate(20deg); } 100% { transform:translateX(200%) rotate(20deg); } }
          `}</style>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background:'var(--viro-bgCard)', boxShadow:'0 24px 70px rgba(0,0,0,0.35)', animation:'vroPopIn 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}
            onClick={e => e.stopPropagation()}>
            {/* Hero banner — the rupee amount IS the headline, not a footnote */}
            <div style={{ background:'linear-gradient(135deg,#059669,#10B981,#34D399)', padding:'24px 20px 20px', textAlign:'center', position:'relative', overflow:'hidden' }}>
              {/* Decorative shimmer sweep */}
              <div style={{ position:'absolute', top:0, left:0, width:'40%', height:'200%', background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent)', animation:'vroShimmer 3s ease-in-out infinite' }} />
              <button type="button" onClick={() => setShowPrepaidNudge(false)}
                style={{ position:'absolute', top:10, right:12, width:26, height:26, borderRadius:'50%', background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1 }}>✕</button>
              <p style={{ margin:'0 0 6px', fontSize:24, position:'relative', zIndex:1 }}>✨</p>
              <p style={{ margin:'0 0 4px', fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.9)', letterSpacing:'0.03em', textTransform:'uppercase', position:'relative', zIndex:1 }}>
                Pay online and save
              </p>
              <p style={{ margin:0, fontSize:42, fontWeight:900, color:'#fff', lineHeight:1, textShadow:'0 2px 12px rgba(0,0,0,0.15)', position:'relative', zIndex:1 }}>
                Rs. {(prepaidDiscount > 0 ? prepaidDiscount : Math.round((discountedTotal * prepaidDiscountPercent) / 100)).toLocaleString()}
              </p>
              <p style={{ margin:'8px 0 0', fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.95)', position:'relative', zIndex:1, display:'inline-block', padding:'3px 10px', borderRadius:20, background:'rgba(255,255,255,0.18)' }}>
                {prepaidDiscountPercent}% OFF · applied automatically
              </p>
            </div>

            <div style={{ padding:'20px 20px 22px' }}>
              <p className="text-sm text-center mb-4" style={{ color:'var(--viro-textMuted)' }}>
                Pay via <strong style={{ color:'var(--viro-text)' }}>JazzCash or EasyPaisa</strong> instead of Cash on Delivery — no coupon code needed, the discount is already applied.
              </p>
              <button type="button"
                onClick={() => { setPaymentMethod('online'); setSelectedAccount(PAYMENT_ACCOUNTS[0]); setShowPrepaidNudge(false) }}
                className="w-full py-3.5 rounded-xl font-bold text-sm mb-2"
                style={{ background:'linear-gradient(135deg,#10B981,#059669)', color:'#fff', border:'none', cursor:'pointer', animation:'vroPulseGlow 2s ease-in-out infinite' }}>
                💳 Switch to Prepaid — Save Rs. {(prepaidDiscount > 0 ? prepaidDiscount : Math.round((discountedTotal * prepaidDiscountPercent) / 100)).toLocaleString()}
              </button>
              <button type="button"
                onClick={() => setShowPrepaidNudge(false)}
                className="w-full py-2 rounded-xl font-semibold text-sm"
                style={{ background:'transparent', color:'var(--viro-textMuted)', border:'none', cursor:'pointer' }}>
                No thanks, keep Cash on Delivery
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Payment Method Selector ─────────────────────────────────────── */}
      <div className="mb-3" ref={paymentMethodRef}>
        <p className="text-sm font-bold mb-2" style={{ color:'var(--viro-text)' }}>💳 Select Payment Method</p>

        {/* COD Option */}
        <button type="button" onClick={() => {
            setPaymentMethod('cod'); setSelectedAccount(null)
            if (prepaidDiscountPercent > 0 && !prepaidNudgeShownRef.current) {
              prepaidNudgeShownRef.current = true
              setShowPrepaidNudge(true)
            }
          }}
          className="w-full flex items-center gap-2.5 p-2.5 rounded-xl mb-1.5 transition-all"
          style={{
            background: paymentMethod==='cod' ? '#8B5CF620' : 'var(--viro-bgCard)',
            border: paymentMethod==='cod' ? '2px solid #8B5CF6' : '2px solid var(--viro-border)',
            cursor:'pointer', textAlign:'left'
          }}>
          <span className="text-xl">💵</span>
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color:'var(--viro-text)' }}>Cash on Delivery (COD)</p>
            <p className="text-[11px]" style={{ color:'var(--viro-textMuted)' }}>Pay Rs.{finalTotal.toLocaleString()} when order arrives at your door</p>
          </div>
          <div style={{
            width:18, height:18, borderRadius:'50%',
            border: paymentMethod==='cod' ? '5px solid #8B5CF6' : '2px solid var(--viro-border)',
            flexShrink:0, transition:'all 0.2s'
          }} />
        </button>

        {/* Small, informational-only notice — sets expectations before order
            placement rather than surprising them with a WhatsApp ask
            afterward, which is what actually reduces no-show COD returns.
            Doesn't block placing the order either way. */}
        {paymentMethod === 'cod' && codAdvance?.enabled && (
          <div className="mb-1.5 px-2.5 py-1.5 rounded-lg flex items-start gap-2" style={{ background:'#8B5CF610', border:'1px solid #8B5CF630' }}>
            <span style={{ fontSize:13 }}>ℹ️</span>
            <p className="text-[11px]" style={{ color:'var(--viro-textSub)' }}>
              A small Rs.{codAdvance.amount} advance confirms COD orders — deducted from your Rs.{finalTotal.toLocaleString()} total. We'll message you on WhatsApp after placing your order.
            </p>
          </div>
        )}

        {/* Online/Advance Option */}
        <button type="button" onClick={() => { setPaymentMethod('online'); setSelectedAccount(PAYMENT_ACCOUNTS[0]) }}
          className="w-full flex items-center gap-2.5 p-2.5 rounded-xl mb-1.5 transition-all"
          style={{
            background: paymentMethod==='online'||paymentMethod==='jazzcash'||paymentMethod==='easypaisa' ? '#10B98120' : 'var(--viro-bgCard)',
            border: paymentMethod==='online'||paymentMethod==='jazzcash'||paymentMethod==='easypaisa' ? '2px solid #10B981' : '2px solid var(--viro-border)',
            cursor:'pointer', textAlign:'left'
          }}>
          <span className="text-xl">📱</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold" style={{ color:'var(--viro-text)' }}>Prepaid (Online Payment)</p>
              {prepaidDiscountPercent > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:'#10B98120', color:'#10B981' }}>
                  Save {prepaidDiscountPercent}%
                </span>
              )}
            </div>
            <p className="text-[11px]" style={{ color:'var(--viro-textMuted)' }}>JazzCash or EasyPaisa — pay before delivery</p>
          </div>
          <div style={{
            width:18, height:18, borderRadius:'50%',
            border: (paymentMethod==='online'||paymentMethod==='jazzcash'||paymentMethod==='easypaisa') ? '5px solid #10B981' : '2px solid var(--viro-border)',
            flexShrink:0, transition:'all 0.2s'
          }} />
        </button>

        {/* Online payment details — shown when online selected */}
        {(paymentMethod==='online'||paymentMethod==='jazzcash'||paymentMethod==='easypaisa') && (
          <div className="rounded-xl overflow-hidden mt-2 mb-2"
            style={{ border:'1px solid var(--viro-border)', background:'var(--viro-bgCard)' }}>

            <div className="flex items-center justify-between px-3 pt-3 pb-1">
              <p className="text-xs font-bold" style={{ color:'var(--viro-textMuted)' }}>SELECT ACCOUNT TO SEND PAYMENT:</p>
              {!selectedAccount && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{background:'#EF444420',color:'#EF4444'}}>Required ✱</span>}
            </div>

            <div className="grid grid-cols-2 gap-2 px-3">
              {PAYMENT_ACCOUNTS.map(acc => {
                // BUGFIX: this compared paymentMethod (always the generic
                // 'online' value once Prepaid is toggled on) against
                // acc.method ('jazzcash' / 'easypaisa' specifically) — those
                // can never match, so NEITHER card ever visually showed as
                // selected, even though JazzCash was correctly pre-selected
                // in state (PAYMENT_ACCOUNTS[0]). selectedAccount is what
                // actually tracks which specific one is chosen.
                const isSelected = selectedAccount?.method === acc.method
                return (
                <button key={acc.method} type="button"
                  onClick={() => { setPaymentMethod(acc.method); setSelectedAccount(acc) }}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all"
                  style={{
                    background: isSelected ? acc.color+'18' : 'var(--viro-bgDeep)',
                    border: isSelected ? `2px solid ${acc.color}` : '2px solid transparent',
                    cursor:'pointer',
                  }}>
                  {acc.logoFull}
                  <div style={{
                    width:16, height:16, borderRadius:'50%',
                    border: isSelected ? `5px solid ${acc.color}` : '2px solid var(--viro-border)',
                    flexShrink:0, transition:'all 0.2s',
                    boxShadow: isSelected ? `0 0 0 3px ${acc.color}25` : 'none',
                  }} />
                </button>
                )
              })}
            </div>

            {/* Account details after selecting JazzCash or EasyPaisa */}
            {selectedAccount && (
              <div className="mx-3 mb-3 mt-2 p-3 rounded-xl"
                style={{ background: selectedAccount.color+'12', border:`1px solid ${selectedAccount.color}40` }}>

                <p className="text-xs font-bold mb-2" style={{ color: selectedAccount.color }}>
                  {selectedAccount.icon} Send Rs.{finalTotal.toLocaleString()} to:
                </p>

                {/* Account number — copyable */}
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-lg font-bold tracking-widest" style={{ color:'var(--viro-text)' }}>
                    {selectedAccount.number}
                  </p>
                  <button type="button"
                    onClick={() => {
                      if (navigator?.clipboard) {
                        navigator.clipboard.writeText(selectedAccount.number)
                          .then(() => showSimpleToast('✅ Number copied!', 'success'))
                          .catch(() => showSimpleToast('✅ ' + selectedAccount.number, 'info'))
                      } else {
                        showSimpleToast('✅ ' + selectedAccount.number, 'info')
                      }
                    }}
                    className="px-2 py-1 rounded-lg text-xs font-bold transition-all"
                    style={{ background: selectedAccount.color+'30', color: selectedAccount.color, border:`1px solid ${selectedAccount.color}50` }}>
                    Copy
                  </button>
                </div>
                <p className="text-sm mb-3" style={{ color:'var(--viro-textMuted)' }}>
                  Account name: <span className="font-bold" style={{ color:'var(--viro-text)' }}>{selectedAccount.name}</span>
                </p>

                {/* Steps */}
                <div className="space-y-1.5 mb-3">
                  {[
                    `Open ${selectedAccount.label} app`,
                    `Send Rs.${finalTotal.toLocaleString()} to ${selectedAccount.number}`,
                    'Take a screenshot of the receipt',
                    'Send receipt to our WhatsApp to confirm order',
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-xs font-bold rounded-full flex-shrink-0 flex items-center justify-center"
                        style={{ width:18, height:18, background: selectedAccount.color, color:'#fff', fontSize:10 }}>
                        {i+1}
                      </span>
                      <p className="text-xs" style={{ color:'var(--viro-textMuted)' }}>{step}</p>
                    </div>
                  ))}
                </div>

                {/* WhatsApp receipt button */}
                <a href={`https://wa.me/92${WHATSAPP_RECEIPT.replace(/^0/,'')}?text=${encodeURIComponent(
                  `Hi! I sent Rs.${finalTotal.toLocaleString()} via ${selectedAccount.label} to ${selectedAccount.number}.

Name: ${form.name}
Phone: ${form.phone}
City: ${form.city}

📎 Attaching my payment screenshot below — please confirm my order.`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold text-sm transition-all"
                  style={{ background:'#25D366', color:'#fff', textDecoration:'none' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 2.126.556 4.122 1.526 5.853L.057 23.428a.75.75 0 00.921.921l5.526-1.461A11.945 11.945 0 0012 24c6.627 0 12-5.374 12-12S18.627 0 12 0zm0 22c-1.885 0-3.655-.515-5.17-1.41l-.36-.217-3.742.99.999-3.648-.237-.377A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                  </svg>
                  Send Receipt on WhatsApp
                </a>
              </div>
            )}

            <div className="px-3 pb-3">
              <p className="text-xs" style={{ color:'var(--viro-textMuted)' }}>
                ⚠️ Your order will be confirmed after we verify your payment receipt on WhatsApp.
              </p>
            </div>
          </div>
        )}
      </div>

      </div>{/* end right col */}
      </div>{/* end grid */}
      {(() => {
        const isPrepaid = paymentMethod==='online'||paymentMethod==='jazzcash'||paymentMethod==='easypaisa'
        const needsAccount = isPrepaid && !selectedAccount
        const buttonInner = (
          <>
            {belowMinOrder && (
              <div style={{
                display:'flex', alignItems:'center', gap:8, padding:'9px 12px', marginBottom:10,
                borderRadius:12, background:'#EF444412', border:'1px solid #EF444430',
              }}>
                <span style={{ fontSize:16, flexShrink:0 }}>🛒</span>
                <p style={{ margin:0, fontSize:11.5, fontWeight:700, color:'#EF4444' }}>
                  Minimum order is Rs.{minOrder.amount.toLocaleString()} — add Rs.{Math.ceil(minOrder.amount - activeCartTotal).toLocaleString()} more to place this order
                </p>
              </div>
            )}
            <button onClick={placeOrder} disabled={loading}
              className="btn-primary w-full py-4 text-base font-bold"
              style={belowMinOrder ? {background:'linear-gradient(135deg,#94A3B8,#64748B)',cursor:'pointer'} : needsAccount ? {background:'linear-gradient(135deg,#94A3B8,#64748B)',cursor:'pointer'} : {}}>
              {loading
                ? <span className="flex items-center gap-2 justify-center">
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>Placing…
                  </span>
                : belowMinOrder
                  ? `🛒 Add Rs.${Math.ceil(minOrder.amount - activeCartTotal).toLocaleString()} more to order`
                  : needsAccount
                  ? '⬆️ Select JazzCash or EasyPaisa above'
                  : paymentMethod === 'cod'
                    ? `✅ Place Order — Rs.${finalTotal.toLocaleString()} (COD)`
                    : selectedAccount
                    ? `✅ Prepaid Order — Rs.${finalTotal.toLocaleString()} (${selectedAccount.label})`
                    : `✅ Place Order — Rs.${finalTotal.toLocaleString()}`}
            </button>
            {paymentMethod === 'cod'
              ? (codAdvance?.enabled
                  ? <p className="text-center text-xs mt-2" style={{ color:'#475569' }}>💵 Rs.{codAdvance.amount} advance required to confirm · rest on delivery</p>
                  : <p className="text-center text-xs mt-2" style={{ color:'#475569' }}>💵 No payment now · Pay on delivery</p>)
              : <p className="text-center text-xs mt-2" style={{ color:'#10B981' }}>📱 Send payment receipt on WhatsApp to confirm order</p>}
          </>
        )
        return (
          <>
            {/* MOBILE: fixed to the bottom of the viewport, always visible
                regardless of scroll position — was previously only reachable
                by scrolling all the way past the full bill breakdown, address,
                and payment sections, which is a well-documented conversion
                killer on long checkout pages. bottom:58px (not 0) — matches
                the product page's own sticky Buy bar exactly, so it sits
                ABOVE the site's bottom nav instead of fully overlapping it
                (both being bottom:0 would stack them on the same spot).

                THE REAL BUG (why this never actually looked sticky): this
                page's outer wrapper has className="... slide-up", and
                .slide-up's entrance animation ends on transform:translateY(0)
                with fill-mode "both" — so even once the 0.4s animation is
                over, the wrapper is PERMANENTLY left with a non-"none"
                transform. Per the CSS spec, ANY transform other than
                literally `none` — yes, even translateY(0) — turns that
                element into a "containing block" for every position:fixed
                descendant inside it. So this bar was never actually fixed
                to the viewport; it was fixed relative to that transformed
                wrapper instead, which behaves just like position:absolute
                inside a normally-scrolling page — it scrolls away with
                everything else and only appears once you've scrolled all
                the way past it. (Same class of bug the prepaid-nudge popup
                above already works around with a portal — see its comment.)
                Fix: render this bar through a portal straight onto
                document.body, completely outside the transformed wrapper,
                so position:fixed is always relative to the real viewport. */}
            {!isDesktop && typeof document !== 'undefined' && createPortal(
              <div style={{
                position:'fixed', left:0, right:0, bottom:58, zIndex:9999,
                background:'var(--viro-bgCard)', borderTop:'1.5px solid var(--viro-border)',
                borderRadius:'14px 14px 0 0',
                padding:'10px 16px',
                boxShadow:'0 -4px 20px rgba(0,0,0,0.15)',
              }}>
                {buttonInner}
              </div>,
              document.body
            )}
            {/* Spacer so the fixed bar above doesn't cover the last bit of
                content on mobile — desktop doesn't need it (not fixed there). */}
            {!isDesktop && <div style={{ height:150 }} />}
            {/* DESKTOP: normal inline placement, unchanged */}
            {isDesktop && (
              <div style={{ marginTop:16 }}>
                {buttonInner}
              </div>
            )}
          </>
        )
      })()}
      </div>
  ) }

  /* ── FORM ── */
  return (
    <div className="pb-6 slide-up" style={{ background: 'var(--viro-sectionBg)', minHeight: '100vh' }}>
      {oosPopup}
      <StockCheckPopup />
      <div className="px-4 md:px-8 max-w-2xl mx-auto">
      <h1 className="font-display text-xl font-bold py-3 mb-1.5">Checkout</h1>

      {(saved.name || saved.phone) && (
        <div className="mb-3 p-2.5 rounded-xl flex items-center gap-2 text-xs fade-in"
          style={{ background: '#8B5CF610', border: '1px solid #8B5CF640' }}>
          <span>💾</span>
          <span style={{ color: '#A78BFA' }}>Info pre-filled from your last order. Just review and continue!</span>
          <button onClick={() => { setForm({ name:'', phone:'', email:'', city:'', address:'' }); localStorage.removeItem(STORAGE_KEY) }}
            className="ml-auto text-xs underline flex-shrink-0" style={{ color: 'var(--viro-textSub)' }}>Clear</button>
        </div>
      )}

      {/* Shown instead of the banner above — this is a NEW device/browser (nothing in
          localStorage) but the phone number they just typed matched a past customer,
          so we pulled their name/email/city/address in for them. */}
      {!(saved.name || saved.phone) && autofilledFromServer && (
        <div className="mb-3 p-2.5 rounded-xl flex items-center gap-2 text-xs fade-in"
          style={{ background: '#10B98110', border: '1px solid #10B98140' }}>
          <span>👋</span>
          <span style={{ color: '#10B981' }}>Welcome back! We filled in your details from a past order — just double-check and continue.</span>
        </div>
      )}

      <form id="checkout-info-form" onSubmit={e => e.preventDefault()} className="space-y-3">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--viro-textSub)' }}>Full Name <span style={{ color:'#EF4444' }}>*</span></label>
          <input ref={nameRef} name="name" value={form.name} onChange={handleChange} onBlur={captureCheckoutProgress} placeholder="Muhammad Ali" type="text" autoComplete="name" required />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--viro-textSub)' }}>Phone Number <span style={{ color:'#EF4444' }}>*</span></label>
          <div style={{ position: 'relative' }}>
            <input name="phone" value={form.phone} onChange={handleChange}
              ref={phoneRef}
              onBlur={handlePhoneBlur}
              placeholder="03XX XXXXXXX"
              type="tel" inputMode="numeric" autoComplete="tel" required
              style={isPhoneValid === false
                ? { borderColor: '#EF4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.12)' }
                : isPhoneValid === true
                  ? { borderColor: '#10B981', boxShadow: '0 0 0 3px rgba(16,185,129,0.12)' }
                  : {}}
            />
            {isPhoneValid === true && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base" style={{ color: '#10B981' }}>✓</span>
            )}
            {isPhoneValid === false && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base" style={{ color: '#EF4444' }}>✗</span>
            )}
          </div>
          {isPhoneValid === false && (
            <p className="text-[11px] mt-1 font-semibold" style={{ color: '#EF4444' }}>
              ⚠️ Use 03XXXXXXXXX (11 digits) or 923XXXXXXXXX (12 digits starting with 92)
            </p>
          )}
          {isPhoneValid === true && (
            <p className="text-[11px] mt-1 font-semibold" style={{ color: '#10B981' }}>✓ Valid Pakistani number</p>
          )}
        </div>
        <div>
          {/* "(optional)" removed — telling someone a field is optional is
              exactly what gets it skipped, even when (like here) filling it
              in genuinely helps them (order confirmation email). The red
              asterisk convention on the other fields already makes it
              obvious which ones are actually required, without having to
              say so explicitly on this one. */}
          <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--viro-textSub)' }}>Email</label>
          <input ref={emailRef} name="email" value={form.email} onChange={handleChange} onBlur={captureCheckoutProgress} placeholder="you@email.com" type="email" autoComplete="email" />
        </div>

        <div ref={cityRef} style={{ position: 'relative' }}>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--viro-textSub)' }}>City <span style={{ color:'#EF4444' }}>*</span></label>
          <CityAutocomplete ref={cityInputRef} value={form.city} onChange={val => setForm(f => ({ ...f, city: val }))} onBlur={captureCheckoutProgress} isValid={form.city.trim().length < 2 ? null : isCityValid} />

          {/* Fix #5: Soft info banner — doesn't block order, just informs */}
          {form.city.trim().length >= 2 && !isCityKnown && (
            <div className="mt-2 p-2.5 rounded-xl fade-in" style={{ background:'#FFF7ED', border:'1px solid #FED7AA' }}>
              <p style={{ color:'#C2410C', fontWeight:700, fontSize:12.5, margin:'0 0 2px' }}>📍 City not in autocomplete list</p>
              <p style={{ color:'#EA580C', fontSize:11.5, margin:0, lineHeight:1.4 }}>
                No problem — you can still place your order! For delivery enquiries:&nbsp;
                <a href="mailto:support@viro.pk" style={{ color:'#C2410C', fontWeight:700, textDecoration:'underline' }}>support@viro.pk</a>
                &nbsp;/&nbsp;
                <button type="button"
                  onClick={() => openWhatsApp(`Hi Viro! I'm ordering from "${form.city}". Please confirm delivery. Thanks!`, contact.whatsapp)}
                  style={{ color:'#C2410C', fontWeight:700, textDecoration:'underline', background:'none', border:'none', padding:0, cursor:'pointer', fontSize:11.5 }}>
                  WhatsApp
                </button>
              </p>
            </div>
          )}

          {/* Only surface this box when it's GOOD news (free delivery unlocked).
              Previously always showed here — including the delivery CHARGE
              right after typing the city, at the earliest, most fragile point
              in the form. That's a well-documented drop-off trigger: showing
              an extra cost before someone's committed to buying. The actual
              charge still appears in Bill Preview further down before they
              place the order — nothing here is being hidden from the final
              total, just not surfaced twice with the second copy front-loaded
              at the worst possible moment. */}
          {form.city.trim().length > 1 && isCityValid && isFree && (
            <div className="mt-2 p-2.5 rounded-xl text-xs fade-in"
              style={{ background: '#10B98115', border: '1px solid #10B98140' }}>
              <span className="text-emerald-400 font-semibold">🎉 {isBurewala ? 'Free delivery in Burewala!' : 'Free delivery on this order!'}</span>
            </div>
          )}
        </div>

        {/* ── Daraz-style Saved Address Selector ── */}
        {user?.email && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color:'var(--viro-textSub)' }}>
                📍 Delivery Address
              </label>
              {savedAddresses.length > 0 && (
                <button type="button" onClick={() => setShowAddNewForm(!showAddNewForm)}
                  className="text-xs font-bold"
                  style={{ color:'#A78BFA', background:'none', border:'none', cursor:'pointer' }}>
                  {showAddNewForm ? '✕ Cancel' : '+ Add New'}
                </button>
              )}
            </div>

            {/* Saved address cards — Daraz style */}
            {savedAddresses.length > 0 && !showAddNewForm && (
              <div className="flex flex-col gap-2 mb-3">
                {savedAddresses.map(addr => {
                  const isSelected = selectedAddrId === addr.id
                  return (
                    <button key={addr.id} type="button" onClick={() => selectSavedAddress(addr)}
                      className="text-left w-full transition-all"
                      style={{
                        padding:'12px 14px', borderRadius:14,
                        border:`2px solid ${isSelected?'#8B5CF6':'var(--viro-border)'}`,
                        background: isSelected?'#8B5CF610':'var(--viro-bgCard)',
                        cursor:'pointer', position:'relative',
                      }}>
                      {/* Selected checkmark */}
                      {isSelected && (
                        <div style={{ position:'absolute', top:10, right:12, width:20, height:20, borderRadius:'50%', background:'#8B5CF6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#fff', fontWeight:900 }}>✓</div>
                      )}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span style={{ fontSize:11, fontWeight:800, padding:'2px 8px', borderRadius:20, background:'#8B5CF620', color:'#A78BFA', border:'1px solid #8B5CF630' }}>
                          {addr.label==='Home'?'🏠':addr.label==='Office'?'🏢':'📍'} {addr.label}
                        </span>
                        {addr.is_default && (
                          <span style={{ fontSize:10, fontWeight:700, color:'#10B981', background:'#10B98115', padding:'1px 7px', borderRadius:20, border:'1px solid #10B98130' }}>✓ Default</span>
                        )}
                      </div>
                      <p className="text-sm font-bold mb-0.5" style={{ color:'var(--viro-text)', margin:'0 0 3px' }}>{addr.name} · {addr.phone}</p>
                      <p className="text-xs" style={{ color:'var(--viro-textSub)', margin:0 }}>📍 {addr.city} · {addr.address}</p>
                    </button>
                  )
                })}

                {/* Add new address button — shown at bottom of list */}
                <button type="button" onClick={() => setShowAddNewForm(true)}
                  className="w-full text-center py-3 text-xs font-bold transition-all"
                  style={{ border:'1.5px dashed #8B5CF640', borderRadius:14, background:'#8B5CF608', color:'#A78BFA', cursor:'pointer' }}>
                  ＋ Add New Address
                </button>
              </div>
            )}

            {/* Inline add-new address form */}
            {(showAddNewForm || savedAddresses.length === 0) && (
              <div className="mb-3 p-4 rounded-2xl" style={{ border:'1.5px solid #8B5CF640', background:'#8B5CF608' }}>
                <p className="text-xs font-bold mb-3" style={{ color:'#A78BFA', margin:'0 0 10px' }}>
                  {savedAddresses.length === 0 ? '📍 Add your delivery address' : '➕ New Address'}
                </p>
                {/* Label tabs */}
                <div className="flex gap-2 mb-3">
                  {['Home','Office','Other'].map(l => (
                    <button key={l} type="button" onClick={() => setNewAddrForm(f=>({...f,label:l}))}
                      className="flex-1 py-1.5 text-xs font-bold rounded-xl transition-all"
                      style={{ border:`1.5px solid ${newAddrForm.label===l?'#8B5CF6':'var(--viro-border)'}`, background:newAddrForm.label===l?'#8B5CF620':'transparent', color:newAddrForm.label===l?'#A78BFA':'var(--viro-textSub)', cursor:'pointer' }}>
                      {l==='Home'?'🏠':l==='Office'?'🏢':'📍'} {l}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input name="new-address-name" type="text" autoComplete="name" value={newAddrForm.name} onChange={e=>setNewAddrForm(f=>({...f,name:e.target.value}))}
                    placeholder="Full Name *" className="text-sm p-2.5 rounded-xl" style={{ border:'1px solid var(--viro-border)', background:'var(--viro-bgDeep)', color:'var(--viro-text)' }}/>
                  <input name="new-address-phone" type="tel" autoComplete="tel" value={newAddrForm.phone} onChange={e=>setNewAddrForm(f=>({...f,phone:e.target.value}))}
                    placeholder="03XXXXXXXXX *" className="text-sm p-2.5 rounded-xl" style={{ border:'1px solid var(--viro-border)', background:'var(--viro-bgDeep)', color:'var(--viro-text)' }}/>
                </div>
                <input name="new-address-city" type="text" autoComplete="address-level2" value={newAddrForm.city} onChange={e=>setNewAddrForm(f=>({...f,city:e.target.value}))}
                  placeholder="City *" className="w-full text-sm p-2.5 rounded-xl mb-2" style={{ border:'1px solid var(--viro-border)', background:'var(--viro-bgDeep)', color:'var(--viro-text)' }}/>
                <textarea name="new-address-street" autoComplete="street-address" value={newAddrForm.address} onChange={e=>setNewAddrForm(f=>({...f,address:e.target.value}))}
                  placeholder="House #, Street, Mohalla, Landmark…" rows={2}
                  className="w-full text-sm p-2.5 rounded-xl mb-2" style={{ border:'1px solid var(--viro-border)', background:'var(--viro-bgDeep)', color:'var(--viro-text)', resize:'none' }}/>
                <label className="flex items-center gap-2 text-xs mb-3 cursor-pointer" style={{ color:'var(--viro-textSub)' }}>
                  <input type="checkbox" checked={newAddrForm.is_default} onChange={e=>setNewAddrForm(f=>({...f,is_default:e.target.checked}))} style={{ accentColor:'#8B5CF6', width:16, height:16 }}/>
                  Set as default address
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={saveNewAddress} disabled={savingNewAddr}
                    className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white"
                    style={{ background:'linear-gradient(135deg,#8B5CF6,#6366f1)', border:'none', cursor:'pointer', opacity:savingNewAddr?0.7:1 }}>
                    {savingNewAddr ? 'Saving…' : '✓ Save & Use This Address'}
                  </button>
                  {savedAddresses.length > 0 && (
                    <button type="button" onClick={() => setShowAddNewForm(false)}
                      className="px-4 py-2.5 text-xs font-bold rounded-xl"
                      style={{ border:'1px solid var(--viro-border)', background:'transparent', color:'var(--viro-textSub)', cursor:'pointer' }}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Full Address field */}
        <div ref={upsellTriggerRef}>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--viro-textSub)' }}>Full Address <span style={{ color:'#EF4444' }}>*</span></label>
          <textarea ref={addressRef} name="address" value={form.address} onChange={handleChange} onBlur={captureCheckoutProgress}
            placeholder="House #, Street, Mohalla, Landmark…" rows={3} autoComplete="street-address" required style={{ resize: 'none' }} />
        </div>

        {/* AOV upsell trigger stays exactly where it was (this empty marker
            keeps the IntersectionObserver's scroll-position trigger working
            unchanged) — but the popup itself now renders as a proper fixed
            overlay via createPortal below, not inline here. Was inline
            before, which meant it scrolled away with the page instead of

            staying put in the viewport. */}
        {/* BUGFIX: this portal used to live inside the step==='review' render
            block further up the file — which only executes AFTER the
            shopper clicks "Review Order". The trigger (this ref, scroll-into-
            view) correctly fires while still on the Info step, but the
            actual popup JSX had no way to render until they'd already
            advanced past the step it was meant to interrupt. Moved here,
            into the Info step's own render tree, so it shows up exactly
            when intended — while still filling in delivery details, before
            committing to Review. */}
        {showUpsell && checkoutUpsell.enabled && activeCartTotal < checkoutUpsell.min_order_value && typeof document !== 'undefined' && createPortal(
          (() => {
            const freeThreshold = Math.max(...deliveryRules.map(r => r.freeThreshold || 0), 1500)
            const remaining = Math.max(0, freeThreshold - activeCartTotal)
            const pct = Math.min(100, Math.round((activeCartTotal / freeThreshold) * 100))
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.55)', backdropFilter:'blur(3px)', animation:'vroFadeIn 0.15s ease-out' }}
                onClick={() => setShowUpsell(false)}>
                <style>{`
                  @keyframes vroFadeIn { from { opacity:0; } to { opacity:1; } }
                  @keyframes vroPopIn { from { opacity:0; transform:scale(0.92) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
                  @keyframes vroPulseGlow { 0%,100% { box-shadow:0 4px 14px rgba(249,115,22,0.35); } 50% { box-shadow:0 4px 24px rgba(249,115,22,0.6); } }
                  @keyframes vroShimmer { 0% { transform:translateX(-100%) rotate(20deg); } 100% { transform:translateX(200%) rotate(20deg); } }
                  @keyframes vroBounce { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-6px); } }
                `}</style>
                <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background:'var(--viro-bgCard)', boxShadow:'0 24px 70px rgba(0,0,0,0.35)', animation:'vroPopIn 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}
                  onClick={e => e.stopPropagation()}>
                  <div style={{ background:'linear-gradient(135deg,#EA580C,#F97316,#FBBF24)', padding:'24px 20px 20px', textAlign:'center', position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', top:0, left:0, width:'40%', height:'200%', background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent)', animation:'vroShimmer 3s ease-in-out infinite' }} />
                    <button type="button" onClick={() => setShowUpsell(false)}
                      style={{ position:'absolute', top:10, right:12, width:26, height:26, borderRadius:'50%', background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1 }}>✕</button>
                    <p style={{ margin:'0 0 6px', fontSize:32, position:'relative', zIndex:1, display:'inline-block', animation:'vroBounce 1.4s ease-in-out infinite' }}>🎁</p>
                    <p style={{ margin:'0 0 4px', fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.9)', letterSpacing:'0.03em', textTransform:'uppercase', position:'relative', zIndex:1 }}>
                      So close to free delivery
                    </p>
                    <p style={{ margin:0, fontSize:36, fontWeight:900, color:'#fff', lineHeight:1, textShadow:'0 2px 12px rgba(0,0,0,0.15)', position:'relative', zIndex:1 }}>
                      Rs. {remaining.toLocaleString()} away
                    </p>
                    <div style={{ marginTop:14, height:7, borderRadius:4, background:'rgba(255,255,255,0.3)', overflow:'hidden', position:'relative', zIndex:1 }}>
                      <div style={{ height:'100%', borderRadius:4, width:`${pct}%`, background:'#fff', transition:'width 0.4s ease' }} />
                    </div>
                    <p style={{ margin:'6px 0 0', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.95)', position:'relative', zIndex:1 }}>{pct}% of the way there</p>
                  </div>

                  <div style={{ padding:'20px 20px 22px' }}>
                    <p className="text-sm text-center mb-4" style={{ color:'var(--viro-textMuted)' }}>
                      Add a few more items and get <strong style={{ color:'var(--viro-text)' }}>FREE delivery</strong> — save Rs.{deliveryCharge} instead of paying it.
                    </p>
                    <button type="button" onClick={goShopForMore}
                      className="w-full py-3.5 rounded-xl font-bold text-sm mb-2"
                      style={{ background:'linear-gradient(135deg,#F59E0B,#F97316)', color:'#fff', border:'none', cursor:'pointer', animation:'vroPulseGlow 2s ease-in-out infinite' }}>
                      🛍️ Add More & Save →
                    </button>
                    <button type="button" onClick={() => setShowUpsell(false)}
                      className="w-full py-2 rounded-xl font-semibold text-sm"
                      style={{ background:'transparent', color:'var(--viro-textMuted)', border:'none', cursor:'pointer' }}>
                      No thanks, continue as is
                    </button>
                    <div className="mt-3 flex items-center justify-center gap-1.5 py-1.5 rounded-full"
                      style={{ background:'#DCFCE7', border:'1px solid #86EFAC' }}>
                      <span style={{ fontSize:12 }}>✅</span>
                      <p className="text-[10px] font-bold" style={{ color:'#166534' }}>
                        Your current item{activeCartItems.length > 1 ? 's' : ''} {activeCartItems.length > 1 ? 'stay' : 'stays'} saved in your cart
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })(),
          document.body
        )}

        {/* Live bill preview — shown from the moment the page loads (using the
            cart/snapshot items already in hand), not just after the shopper
            starts typing their city. deliveryCharge already falls back to a
            flat Rs.150 estimate until a real city is entered (see above),
            so nothing here depends on the city being filled in first. */}
        {/* Free-delivery progress bar — compact, always visible while not
            yet free, sits right before Review Order so it's the last thing
            a shopper sees before submitting. Same fill-bar visual as the
            product page; "Shop More" reuses goShopForMore (same safety-net
            merge-into-cart behavior as the "Add More & Save" button above,
            just a shorter/lower-key version for here). */}
        {showFreeDeliveryNudge && (
          <div className="rounded-xl p-3.5 fade-in" style={{ background: 'var(--viro-bgDeep)', border: '1px solid var(--viro-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ fontSize: 15 }}>🚚</span>
              <p className="text-xs font-bold flex-1" style={{ color: 'var(--viro-text)' }}>
                Add Rs.{freeDeliveryGap.toLocaleString()} more for FREE delivery
              </p>
              <button type="button" onClick={goShopForMore}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#F59E0B,#F97316)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                🛍️ Shop More
              </button>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'var(--viro-border)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${freeDeliveryPct}%`, borderRadius: 999,
                background: 'linear-gradient(90deg,#F97316,#EA580C)',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        )}
      </form>
      {/* ── Review, payment method, and the real Place Order button — all
          on this same page now, right after the form fields, instead of a
          separate step the shopper had to click through to reach. Brings
          its own sticky bottom bar on mobile (unchanged from before). ── */}
      {renderReviewSection()}
      </div>{/* max-w */}
    </div>
  )
}
export default function CheckoutClient() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--viro-sectionBg)' }} />}>
      <CheckoutInner />
    </Suspense>
  )
}