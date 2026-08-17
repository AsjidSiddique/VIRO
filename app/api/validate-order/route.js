// app/api/validate-order/route.js
// ════════════════════════════════════════════════════════════════════════════
// Server-side order price validation — CRITICAL fraud prevention.
//
// A user can modify localStorage prices in DevTools and place orders at Rs. 1.
// This route re-fetches real prices from DB and returns authoritative totals.
// CheckoutClient calls this BEFORE placing the order and uses the SERVER values.
// ════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'

// Rate limiter — prevents scraping product prices/stock via this public endpoint
// Uses Upstash Redis if configured (UPSTASH_REDIS_REST_URL + TOKEN env vars),
// falls back to in-memory Map which resets on cold start.
const RATE_MAX = 20
const RATE_WIN_SEC = 60

async function redisRateLimit(ip) {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const key = `viro_rl_order:${ip}`
  try {
    const res = await fetch(`${url}/incr/${key}`, { headers: { Authorization: `Bearer ${token}` } })
    const count = (await res.json()).result ?? 1
    if (count === 1) await fetch(`${url}/expire/${key}/${RATE_WIN_SEC}`, { headers: { Authorization: `Bearer ${token}` } })
    return count >= RATE_MAX
  } catch { return null }
}
const rateMap = new Map()
async function isRateLimited(ip) {
  const r = await redisRateLimit(ip)
  if (r !== null) return r
  const now = Date.now(), entry = rateMap.get(ip)
  if (!entry || now > entry.resetAt) { rateMap.set(ip, { count: 1, resetAt: now + RATE_WIN_SEC * 1000 }); return false }
  if (entry.count >= RATE_MAX) return true
  entry.count++; return false
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
// Service role key reads RLS-protected tables — MUST be set in Vercel env vars
// Falls back to anon key but will fail if products table has RLS blocking anon reads
// NOTE: SUPABASE_SERVICE_ROLE_KEY is not available at build time — only at runtime.
// The key check is deferred into dbQuery so it never fires during `next build`.

async function dbQuery(table, params = '') {
  // Resolved at request time — env vars are available here
  const SUPABASE_KEY       = process.env.SUPABASE_SERVICE_ROLE_KEY
  const SUPABASE_FETCH_KEY = SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!SUPABASE_FETCH_KEY) throw new Error('Server config error: SUPABASE keys missing')
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    headers: {
      'apikey':        SUPABASE_FETCH_KEY,
      'Authorization': `Bearer ${SUPABASE_FETCH_KEY}`,
      'Content-Type':  'application/json',
    },
  })
  if (!res.ok) throw new Error(`DB error ${res.status} on ${table}`)
  return res.json()
}

async function getDeliveryCharge(city, subtotal) {
  try {
    const rows = await dbQuery('site_settings', '?select=value&key=eq.delivery_rules&limit=1')
    const rules = rows?.[0]?.value || []
    const cityLower = (city || '').trim().toLowerCase()

    // Match exact city first, then wildcard '*' fallback
    // DB stores: { label, cities: ['burewala'] | ['*'], freeThreshold, charge }
    const match =
      rules.find(r => {
        const cities = Array.isArray(r.cities)
          ? r.cities.map(c => c.toLowerCase())
          : String(r.cities || '').split(',').map(c => c.trim().toLowerCase())
        return cities.includes(cityLower)
      }) ||
      rules.find(r => {
        const cities = Array.isArray(r.cities)
          ? r.cities.map(c => c.toLowerCase())
          : String(r.cities || '').split(',').map(c => c.trim().toLowerCase())
        return cities.includes('*')
      })

    if (!match) return 150 // hard fallback

    // Support both naming conventions admin uses: freeThreshold (canonical) and legacy names
    const threshold = match.freeThreshold ?? match.free_threshold ?? match.freeAbove ?? null
    if (threshold !== null && subtotal >= threshold) return 0
    return match.charge ?? 150
  } catch { return 150 }
}

// Admin-controlled % off for prepaid (JazzCash/EasyPaisa) orders.
// 0 (or missing) = feature is off, COD and prepaid are priced identically.
// Always re-fetched fresh from DB here — never trust a percent the client sends,
// since that would let someone fake a 100% discount by editing a request body.
async function getPrepaidDiscountPercent() {
  try {
    const rows = await dbQuery('site_settings', '?select=value&key=eq.prepaid_discount_percent&limit=1')
    const raw = Number(rows?.[0]?.value ?? 0)
    if (!Number.isFinite(raw)) return 0
    return Math.min(100, Math.max(0, raw)) // clamp 0-100, never trust an out-of-range stored value either
  } catch { return 0 }
}

// Whether the free-delivery threshold is checked against the subtotal BEFORE
// or AFTER the COUPON discount is subtracted. Default = before. Independent
// from the prepaid toggle below — admin can set each separately in Settings.
async function getCouponDeliveryCheckAfter() {
  try {
    const rows = await dbQuery('site_settings', '?select=value&key=eq.coupon_delivery_check_after&limit=1')
    return rows?.[0]?.value === true
  } catch { return false }
}

// Whether the free-delivery threshold is checked against the subtotal BEFORE
// or AFTER the prepaid discount is subtracted. Default = before, so a
// customer's free-delivery eligibility never shrinks just for paying online.
// Admin can flip this in Settings → Prepaid Discount.
async function getDeliveryCheckAfterPrepaid() {
  try {
    const rows = await dbQuery('site_settings', '?select=value&key=eq.prepaid_delivery_check_after&limit=1')
    return rows?.[0]?.value === true
  } catch { return false }
}

// ── Deal Boxes — server-authoritative bundle validation ────────────────────
// Deals aren't a real products.id row, so they can't go through the normal
// per-item lookup above. Instead: fetch the deal's definition from
// site_settings (never trust client-supplied price/delivery-mode for it),
// then expand it into its constituent PRODUCT line items — each priced as a
// proportional share of the bundle price — so downstream code (order_items
// insert, stock decrement) only ever has to deal with real product rows it
// already knows how to handle. A deal is only sellable while EVERY included
// product still has stock; the max sellable bundle count is capped by
// whichever included product has the LEAST stock (e.g. 5 nail sets + 7
// earring pairs in stock → only 5 bundles available, since earrings alone
// don't limit it but nail sets do).
async function getDealBoxes() {
  try {
    const rows = await dbQuery('site_settings', '?select=value&key=eq.deal_boxes&limit=1')
    return Array.isArray(rows?.[0]?.value) ? rows[0].value : []
  } catch { return [] }
}

export async function POST(request) {
  // Rate limit: 20 requests/min per IP — prevents price/stock scraping
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (await isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests — try again in a minute' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const { items, coupon_code, city, payment_method, partner_email, partner_coins_requested } = body

    if (!Array.isArray(items) || items.length === 0)
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })

    for (const item of items) {
      if (!item.id || !Number.isInteger(item.quantity) || item.quantity < 1)
        return NextResponse.json({ error: 'Invalid item format' }, { status: 400 })
    }

    const regularItems = items.filter(i => !i.is_deal)
    const dealItems     = items.filter(i => i.is_deal)

    // Deal boxes aren't real products.id rows — resolve them from
    // site_settings, then fold their included product ids into the SAME
    // products query below so one round-trip covers everything.
    const allDealBoxes = dealItems.length > 0 ? await getDealBoxes() : []
    const resolvedDeals = []
    for (const di of dealItems) {
      const deal = allDealBoxes.find(d => d.id === di.deal_id)
      if (!deal) return NextResponse.json({ error: `Deal not found: ${di.deal_id}` }, { status: 422 })
      if (!deal.active) return NextResponse.json({ error: `"${deal.title}" is no longer available` }, { status: 422 })
      if (!Array.isArray(deal.productIds) || deal.productIds.length === 0)
        return NextResponse.json({ error: `"${deal.title}" has no products configured` }, { status: 422 })
      resolvedDeals.push({ cartItemId: di.id, quantity: di.quantity, deal })
    }

    // Fetch real prices from DB — client-supplied prices are IGNORED.
    // Covers both regular cart items AND every product referenced by a deal.
    const dealProductIds = resolvedDeals.flatMap(rd => rd.deal.productIds)
    const allIds = [...new Set([...regularItems.map(i => i.id), ...dealProductIds])]
    const products = allIds.length > 0 ? await dbQuery(
      'products',
      `?select=id,name,price,discount_price,sale_active,sale_ends_at,stock,is_active,status&id=in.(${allIds.map(id => `"${id}"`).join(',')})`
    ) : []

    const productMap = {}
    for (const p of (products || [])) productMap[p.id] = p

    function liveEffectivePrice(p) {
      const hasDiscount     = p.discount_price && p.discount_price < p.price
      const saleEndedInPast = p.sale_ends_at && new Date(p.sale_ends_at) <= new Date()
      const timerRunning    = p.sale_active && p.sale_ends_at && new Date(p.sale_ends_at) > new Date()
      const permanentDisc   = !p.sale_ends_at
      const saleActive      = hasDiscount && !saleEndedInPast && (timerRunning || permanentDisc)
      return { effectivePrice: saleActive ? p.discount_price : p.price, saleActive }
    }

    // Fetch per-color variant stock for items that have a selected_color_id
    const colorIds = [...new Set(regularItems.filter(i => i.selected_color_id).map(i => i.selected_color_id))]
    const colorStockMap = {}
    if (colorIds.length > 0) {
      try {
        const colorRows = await dbQuery(
          'product_colors',
          `?select=id,stock,label&id=in.(${colorIds.map(id => `"${id}"`).join(',')})`
        )
        for (const c of (colorRows || [])) colorStockMap[c.id] = c
      } catch { /* non-fatal — fall back to product stock */ }
    }

    let originalSubtotal  = 0
    let effectiveSubtotal = 0
    const validatedItems  = []
    // Free beats custom if a cart somehow has multiple deals with different
    // modes — whichever is most generous to the shopper wins, never stacked.
    let dealDeliveryOverride = null // { mode: 'free'|'custom', amount }

    for (const item of regularItems) {
      const p = productMap[item.id]
      if (!p)
        return NextResponse.json({ error: `Product not found: ${item.id}` }, { status: 422 })
      if (!p.is_active || p.status === 'inactive')
        return NextResponse.json({ error: `"${p.name}" is no longer available` }, { status: 422 })

      // ── Per-variant stock check ─────────────────────────────────────────────
      // Use color variant stock if available, otherwise product-level stock
      const colorVariant    = item.selected_color_id ? colorStockMap[item.selected_color_id] : null
      const availableStock  = colorVariant ? (colorVariant.stock ?? 0) : (p.stock ?? 0)
      const variantLabel    = colorVariant ? ` (${colorVariant.label})` : ''

      if (availableStock < item.quantity)
        return NextResponse.json({
          error: `"${p.name}${variantLabel}" only has ${availableStock} in stock (you requested ${item.quantity})`
        }, { status: 422 })

      // Match client-side effectiveHasDiscount logic exactly:
      // Discount applies when discount_price < price AND one of:
      //   a) sale_active=true AND sale_ends_at in the future (timer running), OR
      //   b) discount_price is set AND sale_ends_at is null (permanent discount), OR
      //   c) sale_ends_at not set at all
      // If sale_ends_at exists and is in the past → discount expired → use original price.
      const { effectivePrice, saleActive } = liveEffectivePrice(p)

      originalSubtotal  += p.price * item.quantity
      effectiveSubtotal += effectivePrice * item.quantity

      validatedItems.push({
        id: p.id, name: p.name, quantity: item.quantity,
        price: p.price,
        discount_price: saleActive ? p.discount_price : null,
        effective_price: effectivePrice,
      })
    }

    // ── Deal Box items — expanded into their constituent product rows ──────
    // Each deal is only sellable while EVERY included product still has
    // stock; max sellable bundle count = the SCARCEST included product's
    // stock (e.g. 5 nail sets + 7 earring pairs in stock → only 5 bundles
    // available). The bundle price is split across included products
    // proportional to their own live price, so each expanded row still adds
    // up to the authoritative bundle total — and downstream order_items /
    // stock-decrement code just sees ordinary product rows it already knows
    // how to handle, no schema changes needed.
    for (const { cartItemId, quantity, deal } of resolvedDeals) {
      const includedProducts = deal.productIds.map(id => productMap[id]).filter(Boolean)
      if (includedProducts.length !== deal.productIds.length)
        return NextResponse.json({ error: `"${deal.title}" includes a product that no longer exists` }, { status: 422 })

      const inactiveOne = includedProducts.find(p => !p.is_active || p.status === 'inactive')
      if (inactiveOne)
        return NextResponse.json({ error: `"${deal.title}" includes "${inactiveOne.name}", which is no longer available` }, { status: 422 })

      // Whole deal goes out of stock the moment ANY included product hits 0 —
      // and the max bundles sellable is capped by whichever product has the
      // LEAST stock, regardless of an admin-set max quantity.
      const scarcest = Math.min(...includedProducts.map(p => p.stock ?? 0))
      const adminCap = Number.isFinite(deal.maxQuantity) && deal.maxQuantity > 0 ? deal.maxQuantity : Infinity
      const available = Math.min(scarcest, adminCap)

      if (available <= 0)
        return NextResponse.json({ error: `"${deal.title}" is out of stock` }, { status: 422 })
      if (quantity > available)
        return NextResponse.json({ error: `"${deal.title}" only has ${available} bundle(s) available (you requested ${quantity})` }, { status: 422 })

      // Authoritative bundle price — NEVER trust a client-supplied price for it
      const bundlePrice = Number(deal.bundlePrice) || 0
      const liveSum = includedProducts.reduce((s, p) => s + liveEffectivePrice(p).effectivePrice, 0) || 1

      originalSubtotal  += liveSum * quantity
      effectiveSubtotal += bundlePrice * quantity

      // Split the bundle price across included products proportional to
      // their own live price share, rounding so the pieces still sum to the
      // exact bundle price (last item absorbs any rounding remainder).
      let allocatedSoFar = 0
      includedProducts.forEach((p, idx) => {
        const { effectivePrice } = liveEffectivePrice(p)
        const isLast = idx === includedProducts.length - 1
        const share = isLast
          ? bundlePrice - allocatedSoFar
          : Math.round((effectivePrice / liveSum) * bundlePrice)
        allocatedSoFar += share
        validatedItems.push({
          id: p.id, name: `${p.name} (from deal: ${deal.title})`, quantity,
          price: p.price,
          discount_price: null,
          effective_price: Math.max(0, share),
        })
      })

      if (deal.deliveryMode === 'free') {
        dealDeliveryOverride = { mode: 'free', amount: 0 }
      } else if (deal.deliveryMode === 'custom' && !dealDeliveryOverride) {
        dealDeliveryOverride = { mode: 'custom', amount: Number(deal.customDeliveryPrice) || 0 }
      }
    }

    const saleDiscount = originalSubtotal - effectiveSubtotal

    // Validate coupon server-side
    let couponDiscount = 0, couponData = null
    if (coupon_code) {
      const coupons = await dbQuery(
        'coupons',
        `?code=eq.${encodeURIComponent(coupon_code.toUpperCase().trim())}&enabled=eq.true&limit=1`
      )
      const coupon = coupons?.[0]
      if (coupon) {
        const valid =
          !(coupon.starts_at && new Date(coupon.starts_at) > new Date()) &&
          !(coupon.expires_at && new Date(coupon.expires_at) < new Date()) &&
          !(coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) &&
          !(coupon.min_order && effectiveSubtotal < coupon.min_order)
        if (valid) {
          couponDiscount = coupon.type === 'percent'
            ? Math.round((effectiveSubtotal * coupon.value) / 100)
            : Math.min(coupon.value, effectiveSubtotal)
          couponData = coupon
        }
      }
    }

    const discountedSubtotal = effectiveSubtotal - couponDiscount

    // Prepaid discount — only applies when paying via JazzCash/EasyPaisa (not COD).
    // Computed AFTER sale + coupon discounts, so discounts stack in order:
    // original price → sale discount → coupon discount → prepaid discount → delivery.
    const isPrepaidMethod = payment_method === 'jazzcash' || payment_method === 'easypaisa' || payment_method === 'online'
    const prepaidDiscountPercent = isPrepaidMethod ? await getPrepaidDiscountPercent() : 0
    const prepaidDiscount = prepaidDiscountPercent > 0
      ? Math.round((discountedSubtotal * prepaidDiscountPercent) / 100)
      : 0
    const finalSubtotal = discountedSubtotal - prepaidDiscount

    // ── Free-delivery threshold check — two INDEPENDENT admin toggles ──────
    // Each discount (coupon, prepaid) has its own on/off switch deciding
    // whether IT shrinks the amount checked against the free-delivery
    // threshold. They stack: if both are ON, the threshold sees the fully
    // discounted total; if both are OFF (default), it sees the pre-coupon,
    // pre-prepaid amount, so neither discount can cost the customer their
    // free delivery. Mixing is allowed — e.g. coupon ON + prepaid OFF.
    const [checkAfterCoupon, checkAfterPrepaid] = await Promise.all([
      getCouponDeliveryCheckAfter(),
      getDeliveryCheckAfterPrepaid(),
    ])
    let deliveryCheckSubtotal = effectiveSubtotal           // baseline: post-sale, pre-coupon, pre-prepaid
    if (checkAfterCoupon)  deliveryCheckSubtotal -= couponDiscount
    if (checkAfterPrepaid) deliveryCheckSubtotal -= prepaidDiscount
    let deliveryCharge = city ? await getDeliveryCharge(city, deliveryCheckSubtotal) : null

    // A Free/Custom-delivery Deal Box in the cart overrides the normal
    // city-based delivery charge for the WHOLE order — not just itself —
    // per how this feature was scoped: one qualifying deal waives delivery
    // even if the rest of the cart alone wouldn't reach the free threshold.
    if (dealDeliveryOverride) {
      deliveryCharge = dealDeliveryOverride.amount
    }

    // ── Partner Coins (store credit earned from the referral program) ──────
    // Re-validated server-side exactly like everything else in this route —
    // never trust a client-supplied "amount to deduct". Only applied if the
    // email really belongs to an APPROVED partner and really has that much
    // balance; capped to both their real balance AND the order total (can't
    // go negative or redeem more than they've actually earned).
    //
    // BUGFIX: this used to query the `influencers` table directly, which
    // needs a service-role key to read past RLS (that table has zero anon
    // policies by design). If this route's SUPABASE_SERVICE_ROLE_KEY env
    // var was ever missing on this specific deployment, dbQuery silently
    // fell back to the anon key, RLS correctly refused it, the lookup
    // failed, and the catch below swallowed it — so partner coins silently
    // never applied server-side, even though the client's own optimistic
    // preview kept showing the discount. Now calls a narrow SECURITY
    // DEFINER RPC (migration 043) instead, which works with just the anon
    // key regardless of that env var — removes the dependency entirely.
    let partnerCoinsApplied = 0
    const preCoinsTotal = finalSubtotal + (deliveryCharge ?? 0)
    if (partner_email && partner_coins_requested > 0) {
      try {
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_partner_balance_for_checkout`, {
          method: 'POST',
          headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_email: partner_email }),
        })
        if (!rpcRes.ok) {
          console.error('[validate-order] partner balance RPC failed:', rpcRes.status, await rpcRes.text().catch(() => ''))
        } else {
          const rows = await rpcRes.json()
          const inf = Array.isArray(rows) ? rows[0] : null
          if (inf && inf.status === 'approved') {
            partnerCoinsApplied = Math.min(
              Number(partner_coins_requested) || 0,
              Number(inf.store_credit_balance) || 0,
              preCoinsTotal
            )
            partnerCoinsApplied = Math.max(0, Math.round(partnerCoinsApplied))
          }
        }
      } catch (e) {
        // Logged (not silently swallowed like before) so a real problem is
        // actually visible in server logs, while still never blocking
        // checkout over what should be a best-effort discount lookup.
        console.error('[validate-order] partner coins lookup threw:', e)
      }
    }

    return NextResponse.json({
      ok: true,
      // Server-authoritative values — CheckoutClient must use THESE
      original_subtotal:  originalSubtotal,
      effective_subtotal: effectiveSubtotal,
      sale_discount:       saleDiscount,
      coupon_discount:     couponDiscount,
      coupon:              couponData,
      pre_discount_total:        discountedSubtotal,
      prepaid_discount_percent:  prepaidDiscountPercent,
      prepaid_discount:          prepaidDiscount,
      delivery_charge:    deliveryCharge,
      deal_delivery_override: dealDeliveryOverride,
      partner_coins_applied: partnerCoinsApplied,
      final_total:        Math.max(0, preCoinsTotal - partnerCoinsApplied),
      items:              validatedItems,
    })
  } catch (err) {
    console.error('[validate-order]', err)
    return NextResponse.json({ error: 'Validation failed: ' + err.message }, { status: 500 })
  }
}
