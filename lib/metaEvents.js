// ─────────────────────────────────────────────────────────────────────────────
// Meta Events — CAPI + Browser Pixel helper
// ALL functions check typeof window first — safe to dynamic-import anywhere.
// Never imported statically — always via import('...').then(m => m.trackXxx())
// ─────────────────────────────────────────────────────────────────────────────

function genEventId(name) {
  return `${name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// Stable per-device visitor ID — same key CartContext already uses for cart
// analytics (viro_cart_session). Reused here as Meta's recommended
// `external_id` for events from GUEST visitors who have no logged-in user.id
// yet. Without this, every guest event (the majority of traffic) has zero
// external_id, which is exactly the "0% coverage" gap Meta's EMQ tool flags.
function getVisitorId() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null
  try {
    let vid = localStorage.getItem('viro_cart_session')
    if (!vid) {
      vid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `v_${Date.now()}_${Math.random().toString(36).slice(2)}`
      localStorage.setItem('viro_cart_session', vid)
    }
    return vid
  } catch { return null }
}

function readCookie(name) {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? match[1] : null
}

function writeCookie(name, value, days = 90) {
  if (typeof document === 'undefined') return
  try {
    const expires = new Date(Date.now() + days * 864e5).toUTCString()
    document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
  } catch {}
}

// Meta's Events Manager flags "Server sending modified fbclid value" when the
// fbc it receives has been lowercased or truncated somewhere before reaching
// the Conversions API — fbclid is case-sensitive and must be forwarded
// byte-for-byte. Nothing in THIS function ever calls .toLowerCase()/.trim()
// on the value, by design.
//
// The likelier real gap: the actual Meta Pixel base script (whatever sets
// the _fbc cookie) isn't loaded anywhere in this codebase — it depends on
// something external (GTM). If that hasn't fired yet when an event goes out
// (ad blockers, slow GTM load, cookie-consent delay), _fbc simply doesn't
// exist and CAPI events silently go out with no fbc at all. This adds the
// same fallback Meta's own "Conversions API parameter builder" tool does:
// build fbc straight from the URL's fbclid, in Meta's documented format
// (fb.1.<click_time_ms>.<fbclid>), and persist it so later events on this
// visit (e.g. Purchase, which can fire minutes after the ad click and after
// SPA navigation drops the query string) still carry it.
function getFbCookies() {
  if (typeof document === 'undefined') return {}
  try {
    let fbc = readCookie('_fbc')
    const fbp = readCookie('_fbp')

    if (!fbc) {
      const fbclid = new URLSearchParams(window.location.search).get('fbclid') // verbatim, untouched
      if (fbclid) {
        fbc = `fb.1.${Date.now()}.${fbclid}`
        writeCookie('_fbc', fbc)
      }
    }

    return { fbc: fbc || undefined, fbp: fbp || undefined }
  } catch { return {} }
}

function currentUrl() {
  if (typeof window === 'undefined') return 'https://www.viro.pk'
  return window.location.href
}

async function sendCAPI(event_name, event_id, event_source_url, custom_data, user_data_raw) {
  if (typeof window === 'undefined') return  // never runs on server
  try {
    console.log('[CAPI] Sending to /api/meta-event:', event_name, 'value:', custom_data?.value)
    const res = await fetch('/api/meta-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name,
        event_id,
        event_source_url: event_source_url || currentUrl(),
        custom_data,
        user_data_raw: { ...user_data_raw, ...getFbCookies() },
      }),
    })
    const json = await res.json()
    console.log('[CAPI] Response for', event_name, ':', json)
  } catch (e) {
    console.error('[CAPI] Fetch error for', event_name, ':', e.message)
  }
}

function firePixel(event_name, event_id, custom_data) {
  if (typeof window === 'undefined') return
  try {
    console.log('[Pixel] Firing fbq:', event_name, custom_data)
    if (window.dataLayer) {
      window.dataLayer.push({
        event: 'meta_event',
        meta_event_name: event_name,
        meta_event_id: event_id,
        ...custom_data,
      })
    }
    if (window.fbq) {
      window.fbq('track', event_name, custom_data || {}, { eventID: event_id })
    } else {
      console.warn('[Pixel] fbq not available for event:', event_name)
    }
  } catch (e) {
    console.error('[Pixel] Error firing:', event_name, e.message)
  }
}

// Merges a stable external_id into whatever userData the caller passed.
// If the caller already supplied user_id (logged-in customer), that takes
// priority — external_id should be the most STABLE identifier available,
// and a real account id is more durable than a per-device localStorage id.
// Otherwise falls back to the persistent guest visitor id, so every event —
// even from a first-time guest with no email yet — carries SOME external_id.
function withVisitorId(userData) {
  const ud = userData || {}
  if (ud.user_id) return ud
  const vid = getVisitorId()
  return vid ? { ...ud, user_id: vid } : ud
}

// ── Public event functions ────────────────────────────────────────────────────

export function trackViewContent(product, userData) {
  if (typeof window === 'undefined') return
  console.log('[CAPI] trackViewContent called for:', product?.name)
  const event_id = genEventId('ViewContent')
  const now = new Date()
  const saleOk = product.discount_price && product.discount_price < product.price &&
    product.sale_active && (!product.sale_ends_at || new Date(product.sale_ends_at) > now)
  const price = saleOk ? product.discount_price : product.price
  const custom_data = {
    content_ids: [String(product.id)],   // Meta requires strings
    content_type: 'product',
    content_name: product.name,
    currency: 'PKR',
    value: Number(price) || 0,
    // contents gives Meta the per-item price explicitly, rather than relying
    // solely on the rolled-up `value` — improves catalog matching/attribution.
    contents: [{ id: String(product.id), quantity: 1, item_price: Number(price) || 0 }],
  }
  firePixel('ViewContent', event_id, custom_data)
  sendCAPI('ViewContent', event_id, currentUrl(), custom_data, withVisitorId(userData))
}

export function trackAddToCart(product, qty = 1, userData) {
  if (typeof window === 'undefined') return
  console.log('[CAPI] trackAddToCart called for:', product?.name, 'qty:', qty)
  const event_id = genEventId('AddToCart')
  const now = new Date()
  const saleOk = product.discount_price && product.discount_price < product.price &&
    product.sale_active && (!product.sale_ends_at || new Date(product.sale_ends_at) > now)
  const price = saleOk ? product.discount_price : product.price
  const custom_data = {
    content_ids: [String(product.id)],
    content_type: 'product',
    content_name: product.name,
    currency: 'PKR',
    value: (Number(price) || 0) * qty,
    num_items: qty,
    contents: [{ id: String(product.id), quantity: qty, item_price: Number(price) || 0 }],
  }
  firePixel('AddToCart', event_id, custom_data)
  sendCAPI('AddToCart', event_id, currentUrl(), custom_data, withVisitorId(userData))
}

export function trackInitiateCheckout(cart, totalValue, userData) {
  if (typeof window === 'undefined') return
  console.log('[CAPI] trackInitiateCheckout called — items:', cart?.length, 'total:', totalValue)
  const event_id = genEventId('InitiateCheckout')
  const now = new Date()
  // Per-item sale-aware price — same logic CheckoutClient uses for the bill itself,
  // so the contents array Meta sees always matches what the customer actually sees.
  const itemPrice = (i) => {
    const saleOk = i.discount_price && i.discount_price < i.price &&
      i.sale_active && (!i.sale_ends_at || new Date(i.sale_ends_at) > now)
    return Number(saleOk ? i.discount_price : i.price) || 0
  }
  const custom_data = {
    content_ids: (cart || []).map(i => String(i.id)),
    content_type: 'product',
    currency: 'PKR',
    value: Number(totalValue) || 0,
    num_items: (cart || []).reduce((s, i) => s + (i.quantity || 1), 0),
    contents: (cart || []).map(i => ({
      id: String(i.id), quantity: i.quantity || 1, item_price: itemPrice(i),
    })),
  }
  firePixel('InitiateCheckout', event_id, custom_data)
  sendCAPI('InitiateCheckout', event_id, 'https://www.viro.pk/checkout', custom_data, withVisitorId(userData))
}

export function trackPurchase(order, cart, userData) {
  if (typeof window === 'undefined') return
  console.log('[CAPI] trackPurchase called — orderId:', order?.id, 'total:', order?.final_total)
  const event_id = genEventId('Purchase')
  const now = new Date()
  // Same sale-aware per-item price logic as checkout's own bill — Meta's `contents`
  // should reflect the price the catalog/sale actually charged per unit, so Purchase
  // value and per-item contents stay consistent with what the customer was billed.
  const itemPrice = (i) => {
    const saleOk = i.discount_price && i.discount_price < i.price &&
      i.sale_active && (!i.sale_ends_at || new Date(i.sale_ends_at) > now)
    return Number(saleOk ? i.discount_price : i.price) || 0
  }
  const custom_data = {
    content_ids: (cart || []).map(i => String(i.id)),
    content_type: 'product',
    currency: 'PKR',
    // value = the ACTUAL amount charged on this order (post sale + coupon + prepaid
    // discount, plus delivery) — this is order.final_total, the same number shown
    // on the receipt and stored on the order row. This is correct as-is.
    value: Number(order.final_total || order.total) || 0,
    num_items: (cart || []).reduce((s, i) => s + (i.quantity || 1), 0),
    order_id: order.id,
    contents: (cart || []).map(i => ({
      id: String(i.id), quantity: i.quantity || 1, item_price: itemPrice(i),
    })),
  }
  firePixel('Purchase', event_id, custom_data)
  sendCAPI('Purchase', event_id, 'https://www.viro.pk/checkout', custom_data, withVisitorId(userData))
}

export function trackSearch(searchQuery) {
  if (typeof window === 'undefined' || !searchQuery?.trim()) return
  console.log('[CAPI] trackSearch:', searchQuery)
  const event_id = genEventId('Search')
  const custom_data = { search_string: searchQuery.trim() }
  firePixel('Search', event_id, custom_data)
  sendCAPI('Search', event_id, currentUrl(), custom_data, withVisitorId({}))
}

export function trackAddToWishlist(product, userData) {
  if (typeof window === 'undefined') return
  console.log('[CAPI] trackAddToWishlist:', product?.name)
  const event_id = genEventId('AddToWishlist')
  const now = new Date()
  const saleOk = product.discount_price && product.discount_price < product.price &&
    product.sale_active && (!product.sale_ends_at || new Date(product.sale_ends_at) > now)
  const price = saleOk ? product.discount_price : product.price
  const custom_data = {
    content_ids: [String(product.id)],
    content_type: 'product',
    content_name: product.name,
    currency: 'PKR',
    value: Number(price) || 0,
    contents: [{ id: String(product.id), quantity: 1, item_price: Number(price) || 0 }],
  }
  firePixel('AddToWishlist', event_id, custom_data)
  sendCAPI('AddToWishlist', event_id, currentUrl(), custom_data, withVisitorId(userData))
}

export function trackContact(source) {
  if (typeof window === 'undefined') return
  console.log('[CAPI] trackContact:', source)
  const event_id = genEventId('Contact')
  firePixel('Contact', event_id, { content_name: source || 'whatsapp' })
  sendCAPI('Contact', event_id, currentUrl(), { content_name: source || 'whatsapp' }, withVisitorId({}))
}

export function trackCompleteRegistration(userData) {
  if (typeof window === 'undefined') return
  console.log('[CAPI] trackCompleteRegistration')
  const event_id = genEventId('CompleteRegistration')
  firePixel('CompleteRegistration', event_id, { status: 'google_login' })
  sendCAPI('CompleteRegistration', event_id, currentUrl(), { status: 'google_login' }, withVisitorId(userData))
}
