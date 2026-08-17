'use client'
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { showToast, showSimpleToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { useUserAuth } from './UserAuthContext'
import { tagOneSignalSession } from '../lib/tagOneSignalSession'

const CartContext = createContext()

// ── Universal image parser ──────────────────────────────────
export function parseImages(raw) {
  try {
    if (!raw) return []
    if (Array.isArray(raw)) {
      const flat = raw.flat(3)
      const urls = []
      for (const item of flat) {
        if (typeof item === 'string') {
          if (item.startsWith('http')) {
            urls.push(item)
          } else if (item.startsWith('[')) {
            try {
              const parsed = JSON.parse(item)
              const inner = Array.isArray(parsed) ? parsed.flat(2) : [parsed]
              urls.push(...inner.filter(u => typeof u === 'string' && u.startsWith('http')))
            } catch {}
          }
        }
      }
      return urls
    }
    if (typeof raw === 'string') {
      const trimmed = raw.trim()
      if (trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed)
        return parseImages(parsed)
      }
      if (trimmed.startsWith('http')) return [trimmed]
    }
    return []
  } catch {
    return []
  }
}

export function getThumb(raw, fallback = '/logo.jpg') {
  const imgs = parseImages(raw)
  return imgs[0] || fallback
}

// ── Cart Provider ───────────────────────────────────────────
export function CartProvider({ children }) {
  // ── Anonymous session ID for cart analytics (persisted in localStorage) ──
  const sessionIdRef = useRef(null)

  // Logged-in customer id, when available — lets cart analytics distinguish
  // a guest session from one tied to a real account. Safe to call here since
  // UserAuthProvider wraps CartProvider higher up in Providers.jsx.
  const { profile } = useUserAuth()
  const customerIdRef = useRef(null)
  const cartLoadedForRef = useRef(null) // tracks which customer's DB cart was loaded (also gates the merge call)
  // Bumped on every local cart edit (add/remove/qty/clear). The async DB-replace
  // fetch below captures this value before it starts; if it changed by the time
  // the fetch resolves, that means the shopper edited the cart WHILE we were
  // still fetching — so we skip applying the (now-stale) DB snapshot instead of
  // wiping out what they just did. This is what was causing "add to cart, then
  // it vanishes a second later": the login-triggered DB replace was landing
  // AFTER a fresh add and overwriting it with an older DB snapshot.
  const cartMutationGenRef = useRef(0)
  const prevCustomerIdRef = useRef(null) // lets us detect a login->logout transition specifically

  useEffect(() => {
    const newCustomerId = profile?.customer_id || null

    // ── LOGOUT — was logged in, now isn't ───────────────────────────────
    // Two real bugs this fixes:
    //  1. The cart kept showing the previous account's items after logout,
    //     because nothing ever cleared local state — it just stopped syncing.
    //  2. A guest add-to-cart right after logout could silently land on the
    //     OLD session_id, which the DB still had tied to the old customer_id
    //     — the upsert only sets customer_id when one is provided, so a
    //     guest write (customer_id omitted) left the stale link in place.
    // Fix: on logout, clear the cart AND rotate to a brand new session_id,
    // so anything added afterward starts a genuinely fresh, unlinked session
    // — exactly the "yes, a new session after logout" behavior expected.
    if (prevCustomerIdRef.current && !newCustomerId) {
      console.log('[Cart Sync] Logout detected — clearing cart and starting a fresh guest session')
      cartMutationGenRef.current++
      setCart([])
      if (typeof localStorage !== 'undefined') {
        const freshSid = (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36)
        localStorage.setItem('viro_cart_session', freshSid)
        sessionIdRef.current = freshSid
      }
      cartLoadedForRef.current = null
    }
    prevCustomerIdRef.current = newCustomerId
    customerIdRef.current = newCustomerId

    if (!newCustomerId) {
      console.log('[Cart Sync] No customer_id on profile yet — cart stays local/guest.', { profile })
      return
    }
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return

    // Get or create session ID
    let sid = sessionIdRef.current || localStorage.getItem('viro_cart_session')
    if (!sid) {
      sid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem('viro_cart_session', sid)
    }
    sessionIdRef.current = sid

    // ── Cross-device cart sync ──────────────────────────────────────────
    // When a customer logs in, their DB cart (customer_id-scoped, now kept
    // unique per product by the v55 migration) becomes the source of truth
    // for THIS device too — not just "add whatever's missing". Sequence:
    //   1. Merge this device's own guest-session rows into the customer
    //      account first (so anything just added here isn't lost).
    //   2. Fetch the customer's full DB cart and REPLACE local state with
    //      it — this is what makes two devices actually show the same
    //      cart, instead of silently diverging after the first load.
    // Guest (logged-out) carts are untouched by any of this — they stay
    // local + session-scoped exactly as before.
    if (cartLoadedForRef.current !== newCustomerId) {
      cartLoadedForRef.current = newCustomerId
      const genAtFetchStart = cartMutationGenRef.current
      console.log('[Cart Sync] customer_id resolved — merging + fetching DB cart', { customerId: newCustomerId, sessionId: sid })
      fetch('/api/cart-event', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sid, customer_id: newCustomerId }),
      })
        .then(r => r.json()).then(d => console.log('[Cart Sync] merge result:', d)).catch(e => console.log('[Cart Sync] merge FAILED:', e.message))
        .finally(() => {
          fetch(`/api/customer-cart?customer_id=${encodeURIComponent(newCustomerId)}`)
            .then(r => r.json())
            .then(data => {
              console.log('[Cart Sync] DB cart fetch result:', data)
              if (!data.ok) { console.log('[Cart Sync] fetch not ok — keeping local cart untouched'); return }
              // Shopper added/removed/changed something WHILE this fetch was in
              // flight — their local state is now the freshest truth. Applying
              // this DB snapshot on top would silently undo what they just did.
              if (cartMutationGenRef.current !== genAtFetchStart) {
                console.log('[Cart Sync] local cart changed while fetching — skipping replace to avoid clobbering it')
                return
              }
              const dbItems = (data.items || []).map(item => ({
                ...item,
                images: parseImages(item.images),
                _cartKey: cartKey(item),
                _variantStock: item.selected_color?.stock ?? item.stock ?? 999,
              }))
              // Deal Box items are local/guest-only (they don't correspond to
              // a real products.id row, so they're never written to the DB
              // cart) — preserve whatever deal items are already in the local
              // cart instead of letting this DB replace silently wipe them.
              let existingDeals = []
              setCart(prev => { existingDeals = prev.filter(i => i.isDeal); return prev })
              console.log(`[Cart Sync] applying ${dbItems.length} item(s) from DB to local cart (+${existingDeals.length} local deal item(s) preserved)`)
              setCart([...dbItems, ...existingDeals]) // DB is truth for real products once logged in — full replace

              // BUGFIX: the DB-stored cart row can carry whatever
              // price/discount_price was cached at the moment the item was
              // added — it isn't re-priced by this endpoint. On every hard
              // refresh, this whole customer-cart sync re-runs (cartLoadedForRef
              // resets on reload) and did a full setCart() replace with that
              // stale snapshot — silently undoing whatever refreshCartPrices()
              // had already corrected moments earlier on this same page load.
              // That race is exactly why the price flipped between Rs.254 and
              // Rs.345 across refreshes. Re-validating against live product
              // data right after applying the DB snapshot closes that gap.
              if (dbItems.length > 0) {
                console.log('[Cart Sync] re-validating live prices for DB-synced items')
                refreshCartPrices(supabase, dbItems)
              }
            })
            .catch(() => {}) // never break the cart UI on a failed DB load
        })
    }
  }, [profile])

  // ── Hydration-safe: start with [] on server, load from localStorage after mount ──
  const [cart, setCart] = useState([])
  const [cartReady, setCartReady] = useState(false)

  const [priceChanges, setPriceChanges] = useState([])

  // Load cart from localStorage only on client (after hydration)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = JSON.parse(localStorage.getItem('viro_cart') || '[]')
      const parsed = stored.map(item => ({ ...item, images: parseImages(item.images) }))
      if (parsed.length > 0) setCart(parsed)
    } catch {}
    setCartReady(true)
    // Initialise anonymous session ID for cart analytics
    let sid = localStorage.getItem('viro_cart_session')
    if (!sid) {
      sid = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem('viro_cart_session', sid)
    }
    sessionIdRef.current = sid
  }, [])

  // ── Background DB sync helpers (fire-and-forget, never block UI) ──
  // These call /api/cart-event (service-role secured) instead of writing
  // directly to cart_items with the anon key — the anon key has zero
  // permissions on this table by design (RLS: "Service role only"), so a
  // direct write here would silently fail every single time.
  // ── Resolves the cart session ID, generating one on the spot if the mount
  // effect hasn't run yet for some reason — this used to just `return` and
  // silently skip the whole DB write with ZERO console output, which is
  // exactly what made "no ATC call ever fires" so hard to catch. Now it's
  // impossible for this to be silently null when a write is attempted.
  function resolveSessionId() {
    if (sessionIdRef.current) return sessionIdRef.current
    if (typeof localStorage === 'undefined') return null
    let sid = localStorage.getItem('viro_cart_session')
    if (!sid) {
      sid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem('viro_cart_session', sid)
    }
    sessionIdRef.current = sid
    console.warn('[Cart Sync] sessionIdRef was empty at write time — resolved inline:', sid)
    return sid
  }

  function dbUpsertCartItem(productId, quantity, variant = {}) {
    const sid = resolveSessionId()
    if (!sid) { console.error('[Cart Sync] ATC write SKIPPED — no session id available at all (localStorage unavailable?)'); return }
    console.log('[Cart Sync] ATC →', { productId, quantity, sid, customerId: customerIdRef.current, variant })
    fetch('/api/cart-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // BUGFIX: this is very likely THE actual cause of "add to cart, then
      // the item is gone after refresh" — this write is fire-and-forget, and
      // tapping the cart icon (or any navigation) right after adding an item
      // can straight-up CANCEL an in-flight fetch when the browser tears
      // down the page. For a logged-in customer, the cart page's "DB is
      // truth on every reload" logic then fetches the DB cart — which never
      // received this item — and REPLACES local state with it, silently
      // erasing the item that looked like it was added successfully.
      // keepalive tells the browser to finish sending this request even as
      // the page unloads, the same mechanism used for analytics beacons.
      keepalive: true,
      body: JSON.stringify({
        session_id: sid,
        product_id: productId,
        quantity,
        customer_id: customerIdRef.current,
        // BUGFIX: colour/size were tracked in the local cart (cartKey already
        // differentiates by variant) but never reached the server-side
        // cart_items row at all — this is why admin's cart analytics never
        // showed a variant no matter what the customer actually picked.
        selected_color_id:   variant.selected_color_id   || null,
        selected_size_id:    variant.selected_size_id    || null,
        selected_color_name: variant.selected_color_name || null,
        selected_size_name:  variant.selected_size_name  || null,
      }),
    }).then(r => r.json()).then(d => {
      if (!d?.ok) console.error('[Cart Sync] ATC write FAILED server-side:', d)
      else console.log('[Cart Sync] ATC write confirmed ok — server diagnostics:', d._debug)
    }).catch(e => console.error('[Cart Sync] ATC write threw (network/parse error):', e.message)) // analytics-only — never let this affect the cart UI
  }
  function dbRemoveCartItem(productId, variant = {}) {
    const sid = resolveSessionId()
    if (!sid) { console.error('[Cart Sync] Remove write SKIPPED — no session id available'); return }
    fetch('/api/cart-event', {
      method: 'DELETE',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sid, product_id: productId,
        // Now that a product can have multiple variant rows in cart_items,
        // removing one colour must only delete THAT row — otherwise
        // removing "Black" from cart would also silently delete "Red" and
        // "Blue" of the same product still sitting in the customer's cart.
        selected_color_id: variant.selected_color_id || null,
        selected_size_id:  variant.selected_size_id  || null,
      }),
    }).catch(() => {})
  }
  function dbClearCart() {
    const sid = resolveSessionId()
    if (!sid) return
    fetch('/api/cart-event', {
      method: 'DELETE',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sid }),
    }).catch(() => {})
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('viro_cart', JSON.stringify(cart))
    }
  }, [cart])

  // Variant-aware cart key: product:colorId:sizeId
  // Ensures same product in different colours/sizes stays as separate cart items
  function cartKey(product) {
    const colorId = product.selected_color_id || ''
    const sizeId  = product.selected_size_id  || ''
    return `${product.id}:${colorId}:${sizeId}`
  }

  const [showCheckoutNudge, setShowCheckoutNudge] = useState(false)
  const [pulseCartNav, setPulseCartNav] = useState(false)
  const addEventCountRef = useRef(0)      // distinct add-to-cart actions this session (not total quantity)
  const lastNudgeShownAtCountRef = useRef(0) // addEventCount value when the nudge last appeared
  const nudgeShownTimesRef = useRef(0)    // how many times the nudge has actually appeared this session
  const NUDGE_MAX_SHOWS = 3               // after this, just let the pulsing cart icon do the reminding

  const triggerCartPulse = () => {
    setPulseCartNav(true)
    setTimeout(() => setPulseCartNav(false), 2500)
  }

  const addToCart = (product, qty = 1) => {
    cartMutationGenRef.current++
    const cleanImages  = parseImages(product.images)
    // Per-variant stock: color variant stock takes priority over product-level stock
    const variantStock = product.selected_color?.stock ?? product.stock ?? 999
    const isOOS        = variantStock <= 0

    // Block adding out-of-stock variants entirely
    if (isOOS) {
      showSimpleToast('⛔ This variant is out of stock', 'error')
      return
    }

    const cleanProduct = {
      ...product,
      images: cleanImages,
      _cartKey: cartKey(product),
      _variantStock: variantStock,  // store for cart page checks
    }

    setCart(prev => {
      const existing = prev.find(i => i._cartKey === cleanProduct._cartKey)
      const newQty   = existing ? existing.quantity + qty : qty
      // Cap at stock limit
      const cappedQty = Math.min(newQty, variantStock)
      if (existing && existing.quantity >= variantStock) {
        showSimpleToast(`⚠️ Max ${variantStock} in stock`, 'info')
        return prev  // don't change cart
      }
      dbUpsertCartItem(cleanProduct.id, cappedQty, {
        selected_color_id:   cleanProduct.selected_color_id,
        selected_size_id:    cleanProduct.selected_size_id,
        selected_color_name: cleanProduct.selected_color_name,
        selected_size_name:  cleanProduct.selected_size_name,
      })
      if (existing) {
        return prev.map(i =>
          i._cartKey === cleanProduct._cartKey
            ? { ...i, quantity: cappedQty, _variantStock: variantStock }
            : i
        )
      }
      return [...prev, { ...cleanProduct, quantity: cappedQty }]
    })
    try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15) } catch {}
    tagOneSignalSession()
    triggerCartPulse() // immediate "just added" burst — separate from the continuous attract pulse
    // Toast popup removed — ProductCard button shows ✓ Added! animation instead

    // ── Smart checkout nudge ────────────────────────────────────────────
    // Not a static always-visible bar. Fires on the 2nd distinct add-to-cart
    // (real "actually shopping" signal), then AGAIN every 2 more adds after
    // that if they keep shopping without checking out — so someone who adds
    // 6 items gets nudged at 2, 4, and 6, not just once and never again.
    // A minimum 20s gap between shows stops rapid successive taps from
    // spamming it. Skipped entirely on the cart/checkout pages themselves.
    addEventCountRef.current += 1
    try {
      const onCartOrCheckoutPage = typeof window !== 'undefined' && /\/(cart|checkout)(\/|$)/.test(window.location.pathname)
      const eventsSinceLastShown = addEventCountRef.current - lastNudgeShownAtCountRef.current
      const now = Date.now()
      const lastShownAt = Number(sessionStorage.getItem('viro_checkout_nudge_last_shown_at') || 0)
      const cooldownOk = (now - lastShownAt) > 20000
      if (addEventCountRef.current >= 2 && eventsSinceLastShown >= 2 && cooldownOk && !onCartOrCheckoutPage && nudgeShownTimesRef.current < NUDGE_MAX_SHOWS) {
        lastNudgeShownAtCountRef.current = addEventCountRef.current
        nudgeShownTimesRef.current += 1
        sessionStorage.setItem('viro_checkout_nudge_last_shown_at', String(now))
        setTimeout(() => setShowCheckoutNudge(true), 500) // let the add-animation finish first
      }
    } catch {}
  }

  // Deal Boxes are admin-curated bundles (site_settings, not a real
  // products.id row) — added to cart as their own distinct item type so
  // pricing/display logic can special-case them (e.g. free-delivery
  // override) without confusing them for a real product. Local/guest-cart
  // only: never synced to the DB customer-cart table, since there's no
  // matching product row for it to reference — see the DB-merge effect
  // above, which preserves these across a login-cart sync.
  const addDealToCart = (deal, qty = 1) => {
    cartMutationGenRef.current++
    const dealCartKey = `deal:${deal.id}`
    setCart(prev => {
      const existing = prev.find(i => i._cartKey === dealCartKey)
      if (existing) {
        return prev.map(i => i._cartKey === dealCartKey ? { ...i, quantity: i.quantity + qty } : i)
      }
      return [...prev, {
        id: dealCartKey,
        isDeal: true,
        dealId: deal.id,
        name: deal.title,
        images: [deal.image],
        price: deal.bundlePrice,
        discount_price: null,
        deliveryMode: deal.deliveryMode || 'normal',
        customDeliveryPrice: deal.customDeliveryPrice || 0,
        includedProductIds: deal.productIds || [],
        stock: 999,
        is_active: true,
        status: 'active',
        _cartKey: dealCartKey,
        _variantStock: 999,
        quantity: qty,
      }]
    })
    try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15) } catch {}
    triggerCartPulse()
  }

  const dismissCheckoutNudge = (autoDismissed = false) => {
    setShowCheckoutNudge(false)
    // Only pulse the cart nav icon when the shopper IGNORED it (let it time
    // out) — if they tapped X or the checkout button, they've already seen
    // and acted on it, no need to draw more attention.
    if (autoDismissed) triggerCartPulse()
  }

  const removeFromCart = (cartKeyOrId) => {
    cartMutationGenRef.current++
    // Support both _cartKey and plain id for backward compat
    setCart(prev => {
      const filtered = prev.filter(i => i._cartKey !== cartKeyOrId && i.id !== cartKeyOrId)
      // Remove from DB by product id (best effort)
      const removed = prev.find(i => i._cartKey === cartKeyOrId || i.id === cartKeyOrId)
      if (removed) dbRemoveCartItem(removed.id, {
        selected_color_id: removed.selected_color_id,
        selected_size_id:  removed.selected_size_id,
      })
      return filtered
    })
  }

  const updateQty = (cartKeyOrId, qty) => {
    cartMutationGenRef.current++
    if (qty < 1) return removeFromCart(cartKeyOrId)
    setCart(prev => prev.map(i => {
      if (i._cartKey === cartKeyOrId || i.id === cartKeyOrId) {
        const maxStock = i.selected_color?.stock ?? i._variantStock ?? i.stock ?? 999
        const capped   = Math.min(qty, maxStock)
        dbUpsertCartItem(i.id, capped, {
          selected_color_id:   i.selected_color_id,
          selected_size_id:    i.selected_size_id,
          selected_color_name: i.selected_color_name,
          selected_size_name:  i.selected_size_name,
        })
        return { ...i, quantity: capped }
      }
      return i
    }))
  }

  const clearCart = () => {
    cartMutationGenRef.current++
    dbClearCart()
    setCart([])
  }

  // BUGFIX (deep root cause): this used to always read "the current cart"
  // via `setCart(prev => { currentCart = prev; ... })` — reading back
  // React's own state right after JUST calling setCart() elsewhere (e.g.
  // the DB-cart-sync effect calling `setCart(dbItems)` then immediately
  // `refreshCartPrices(supabase)`) is a race: there's no guarantee that
  // updater-function read reflects the just-set dbItems yet, since it
  // depends on exactly how React has queued/batched that other setCart call
  // in this specific async context. When it lost that race, currentCart
  // came back stale/empty, this function returned early with NO console
  // log at all (matching exactly what was reported — the log never fired),
  // and the DB snapshot's stale price silently stuck around uncorrected.
  // Accepting an explicit `itemsOverride` lets a caller that already HAS
  // the right array in hand (like the DB-sync effect, right after building
  // dbItems) hand it over directly — no state-read race possible at all.
  const refreshCartPrices = useCallback(async (supabase, itemsOverride) => {
    if (!supabase) return []
    let currentCart = itemsOverride
    if (!currentCart) {
      setCart(prev => { currentCart = prev; return prev })
    }
    if (!currentCart || currentCart.length === 0) {
      console.log('[Cart Sync] refreshCartPrices: nothing to check (empty cart at read time)')
      return []
    }

    const ids = currentCart.filter(i => !i.isDeal).map(i => i.id)
    if (ids.length === 0) {
      console.log('[Cart Sync] refreshCartPrices: cart only has deal item(s), nothing to check')
      return []
    }
    console.log('[Cart Sync] refreshCartPrices: checking live prices for', ids)
    try {
      const { data: fresh } = await supabase
        .from('products')
        .select('id, price, discount_price, sale_active, sale_ends_at, status, stock, is_active')
        .in('id', ids)

      if (!fresh || fresh.length === 0) { console.log('[Cart Sync] refreshCartPrices: no live product rows returned'); return [] }

      // Admin-configurable: whether to show the price-drop banner at all,
      // and whether to show it only the FIRST time a given item's price
      // drops (rather than every single cart visit while it stays lower).
      // Defaults match the always-on behaviour this had before if the
      // setting row doesn't exist yet.
      let noticeEnabled = true, onceOnly = false
      try {
        const { data: setting } = await supabase
          .from('site_settings').select('value').eq('key', 'price_drop_notice').maybeSingle()
        if (setting?.value) {
          noticeEnabled = setting.value.enabled !== false
          onceOnly = !!setting.value.once_only
        }
      } catch { /* default to enabled, non-fatal */ }

      const SEEN_KEY = 'viro_price_drop_seen'
      const seen = onceOnly ? (() => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') } catch { return {} } })() : {}

      const changes = []
      setCart(prev => prev.map(item => {
        const live = fresh.find(p => p.id === item.id)
        if (!live) return item

        const now = new Date()
        // BUGFIX: this required live.sale_active to be exactly true, in sync
        // with discount_price, before honoring the discount on refresh — if
        // that boolean ever drifts out of sync with discount_price (e.g. a
        // manually-set discount without the toggle being flipped, or any
        // admin-side inconsistency between the two), the discount silently
        // disappeared and the cart reverted to full price on next load, even
        // though the item was correctly showing the discounted price moments
        // earlier. Now trusts discount_price + sale_ends_at (if set) as the
        // source of truth instead of also gating on sale_active.
        // Exact same 3-part formula as app/api/validate-order/route.js (the
        // server-side authoritative check) and CartClient.jsx's
        // effectivePrice() — kept identical across all three on purpose so
        // this class of mismatch can't recur.
        const hasDiscount     = live.discount_price && live.discount_price < live.price
        const saleEndedInPast = live.sale_ends_at && new Date(live.sale_ends_at) <= now
        const timerRunning    = live.sale_active && live.sale_ends_at && new Date(live.sale_ends_at) > now
        const permanentDisc   = !live.sale_ends_at
        const saleStillActive = hasDiscount && !saleEndedInPast && (timerRunning || permanentDisc)
        const liveEffectivePrice = saleStillActive ? live.discount_price : live.price

        const cartEffectivePrice = (item.discount_price && item.discount_price < item.price)
          ? item.discount_price
          : item.price

        // BUGFIX: this used to flag EVERY price change, rise or fall, with
        // the same "⚠️ sale has ended" wording — meaning a price INCREASE
        // got surfaced as an alert right as the customer's deciding whether
        // to buy, which reads as bad news at the worst possible moment. Only
        // price DROPS get flagged now; a rise still updates the cart's price
        // silently (so checkout charges the correct current price either
        // way), it just isn't announced.
        if (noticeEnabled && liveEffectivePrice < cartEffectivePrice - 0.01 && !seen[item.id]) {
          changes.push({
            id: item.id,
            name: item.name,
            oldPrice: cartEffectivePrice,
            newPrice: liveEffectivePrice,
          })
          if (onceOnly) seen[item.id] = true
        }

        return {
          ...item,
          price:         live.price,
          discount_price: saleStillActive ? live.discount_price : null,
          sale_active:   live.sale_active,
          sale_ends_at:  live.sale_ends_at,
          status:        live.status,
          stock:         live.stock,
          is_active:     live.is_active,
        }
      }))

      console.log('[Cart Sync] refreshCartPrices: applied live prices from', fresh.length, 'product row(s), price changes:', changes)

      if (onceOnly && changes.length) {
        try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)) } catch {}
      }

      setPriceChanges(changes)
      return changes
    } catch (err) {
      console.log('[Cart Sync] refreshCartPrices FAILED:', err.message)
      return []
    }
  }, [])

  const clearPriceChanges = useCallback(() => setPriceChanges([]), [])

  // ── Manual sync — lets the Cart page offer a real "Sync my cart" button ──
  // instead of only relying on the invisible login-time effect above. Returns
  // a small status object so the UI can show exactly what happened (useful
  // both for shoppers and for debugging — check the console logs alongside).
  const syncCartFromDB = useCallback(async () => {
    const customerId = customerIdRef.current
    if (!customerId) {
      console.log('[Cart Sync] Manual sync requested but no customer_id — not logged in (or profile not resolved yet)')
      return { ok: false, reason: 'not_logged_in' }
    }
    try {
      const res = await fetch(`/api/customer-cart?customer_id=${encodeURIComponent(customerId)}`)
      const data = await res.json()
      console.log('[Cart Sync] Manual sync fetch result:', data)
      if (!data.ok) return { ok: false, reason: data.error || 'fetch_failed' }
      const dbItems = (data.items || []).map(item => ({
        ...item,
        images: parseImages(item.images),
        _cartKey: cartKey(item),
        _variantStock: item.selected_color?.stock ?? item.stock ?? 999,
      }))
      cartMutationGenRef.current++ // this IS the freshest state now, nothing should undo it
      setCart(dbItems)
      return { ok: true, count: dbItems.length }
    } catch (err) {
      console.log('[Cart Sync] Manual sync FAILED:', err.message)
      return { ok: false, reason: err.message }
    }
  }, [])

  // Trusts discount_price directly (if it's set and lower than price) rather
  // than re-checking sale_active/sale_ends_at here — those get re-validated
  // and cleared server-side by refreshCartPrices() whenever the cart or
  // checkout page loads, so by the time an item is genuinely off-sale its
  // discount_price is already null. Re-deriving "is the sale still active"
  // a second time here — using whatever sale_active/sale_ends_at happen to
  // be cached in this render — was causing the cart total (and the floating
  // mini-cart pill on /shop) to occasionally flip back to full price on a
  // fresh page load, even though the item's discount was still valid.
  const cartTotal = cart.reduce((sum, i) => {
    const price = (i.discount_price && i.discount_price < i.price) ? i.discount_price : i.price
    return sum + price * i.quantity
  }, 0)

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <CartContext.Provider value={{
      cart, addToCart, addDealToCart, removeFromCart, updateQty, clearCart,
      cartTotal, cartCount, cartReady,
      refreshCartPrices, priceChanges, clearPriceChanges,
      syncCartFromDB, isLinkedToAccount: !!profile?.customer_id,
      showCheckoutNudge, dismissCheckoutNudge, pulseCartNav,
    }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
