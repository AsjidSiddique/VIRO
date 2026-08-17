'use client'
import { supabase } from '../lib/supabase'
import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useMemo, useRef,
} from 'react'

export const DEFAULT_CONTACT = {
  phone:    '+923277796566',
  whatsapp: '923277796566',
  email:    'support@viro.pk',
  address:  'Mandi Burewala, Punjab, Pakistan',
}

export const DEFAULT_DELIVERY_RULES = [
  { label:'Burewala',         cities:['burewala'], freeThreshold:999,  charge:150 },
  { label:'Vehari',           cities:['vehari'],   freeThreshold:1500, charge:150 },
  { label:'All Other Cities', cities:['*'],        freeThreshold:2500, charge:150 },
]

export const DEFAULT_PROMO_POPUP = {
  enabled: false,
  images: [],            // gallery — cycles automatically if more than one
  headline: 'FREE GIFT',
  subtext: 'On orders above Rs. 2,500',
  ctaText: 'Shop Now',
  ctaLink: '/shop',
  trigger: 'time',      // 'time' | 'scroll'
  triggerValue: 8,       // seconds (trigger:'time') or % scrolled (trigger:'scroll')
  frequencyHours: 24,    // don't re-show to the same visitor within this many hours
}

export const DEFAULT_EXIT_POPUP = {
  enabled: false,
  images: [],
  headline: 'Wait! Don\u2019t leave empty-handed',
  subtext: 'Here\u2019s 10% off if you check out now',
  discountCode: '',
  ctaText: 'Claim Offer',
  ctaLink: '/shop',
  frequencyHours: 24,
}

export const DEFAULT_CHECKOUT_UPSELL = {
  enabled: true,
  min_order_value: 400,   // shown to shoppers whose order subtotal is under this
}

export const DEFAULT_COD_ADVANCE = {
  enabled: false,
  amount: 150,      // Rs — deducted from the final COD amount due at delivery
}

// Regular prepaid payment accounts shown at checkout when a customer pays via
// JazzCash/EasyPaisa instead of COD — admin-editable, separate from the
// cod_advance number above.
export const DEFAULT_PREPAID_ACCOUNTS = {
  jazzcash:  { number: '03184485469', name: 'Asjid Siddique' },
  easypaisa: { number: '03184485469', name: 'Asjid Siddique' },
}

// Site-wide minimum order amount — when enabled, blocks checkout below this
// subtotal and hides the direct "Buy Now" button on products cheaper than
// the threshold (only Add to Cart shows), nudging shoppers to build a
// bigger cart instead of placing many tiny low-value orders.
export const DEFAULT_MIN_ORDER = {
  enabled: false,
  amount: 299,
}

// Deal Boxes — admin-curated product bundles shown on /shop. Stored as a
// plain array of deal objects (no DB migration needed): each deal bundles
// 2-4 existing products under one bundle price + its own hero image, and
// can override the delivery charge for the WHOLE cart (not just itself)
// when it's Free — that's why cart/checkout logic checks for this flag
// separately rather than just pricing the deal item on its own.
export const DEFAULT_DEAL_BOXES = []

// Free Gift Reward — spend Rs.X, get an admin-picked product free. Stored as
// one settings object (not an array like deal boxes) since there's only
// ever one active free-gift threshold at a time.
export const DEFAULT_FREE_GIFT = {
  enabled: false,
  threshold: 2000,
  productId: null,
  giftLabel: '', // optional override — blank uses the product's own name
}

function parseRules(raw) {
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_DELIVERY_RULES
  return raw.map(r => ({
    label:         r.label || 'Delivery',
    cities:        Array.isArray(r.cities) ? r.cities.map(c => c.toLowerCase()) : [String(r.cities||'*').toLowerCase()],
    freeThreshold: Number(r.freeThreshold ?? r.free_threshold ?? 2500),
    charge:        Number(r.charge ?? 150),
  }))
}

function calcCharge(city, subtotal, rules) {
  const c = (city || '').trim().toLowerCase()
  const r = rules || DEFAULT_DELIVERY_RULES
  const match = r.find(rule => rule.cities.includes(c)) || r.find(rule => rule.cities.includes('*'))
  if (!match) return 150
  return subtotal >= match.freeThreshold ? 0 : match.charge
}

// Returns just the free-delivery threshold Rs amount for a city (no charge
// calc) — used by the checkout "add Rs.X more for free delivery" suggestion,
// which needs the raw threshold number to compute how far the cart is from it.
function findFreeThreshold(city, rules) {
  const c = (city || '').trim().toLowerCase()
  const r = rules || DEFAULT_DELIVERY_RULES
  const match = r.find(rule => rule.cities.includes(c)) || r.find(rule => rule.cities.includes('*'))
  return match?.freeThreshold ?? null
}

function deepEqual(a, b) {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null) return a === b
  try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
}

// ── Module-level cache — persists across navigations (React keeps module alive) ──
// This means SiteSettings are fetched ONCE per browser session, not on every page.
let _settingsCache = null
let _settingsFetchedAt = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

const Ctx = createContext(null)

export function SiteSettingsProvider({ children }) {
  const [contact,            setContact]            = useState(DEFAULT_CONTACT)
  const [deliveryRules,      setDeliveryRules]      = useState(DEFAULT_DELIVERY_RULES)
  const [rawSettings,        setRawSettings]        = useState({})
  const [couponEnabled,      setCouponEnabled]      = useState(false)
  const [ordersBadgeEnabled, setOrdersBadgeEnabled] = useState(false)
  const [hideOutOfStock,     setHideOutOfStock]     = useState(false)
  const [reviewsEnabled,     setReviewsEnabled]     = useState(true)
  const [autoApproveReviews, setAutoApproveReviews] = useState(false)
  const [hotAds,             setHotAds]             = useState({ enabled: false, title: '' })
  const [homeBlocks,         setHomeBlocks]         = useState([])
  const [sideMenu,           setSideMenu]           = useState([])
  const [promoPopup,         setPromoPopup]         = useState(DEFAULT_PROMO_POPUP)
  const [exitPopup,          setExitPopup]          = useState(DEFAULT_EXIT_POPUP)
  const [checkoutUpsell,     setCheckoutUpsell]      = useState(DEFAULT_CHECKOUT_UPSELL)
  const [codAdvance,         setCodAdvance]          = useState(DEFAULT_COD_ADVANCE)
  const [prepaidAccounts,    setPrepaidAccounts]     = useState(DEFAULT_PREPAID_ACCOUNTS)
  const [minOrder,           setMinOrder]            = useState(DEFAULT_MIN_ORDER)
  const [dealBoxes,          setDealBoxes]           = useState(DEFAULT_DEAL_BOXES)
  const [freeGift,           setFreeGift]            = useState(DEFAULT_FREE_GIFT)
  const [prepaidDiscountPercent, setPrepaidDiscountPercent] = useState(0)
  const [loaded,             setLoaded]             = useState(false)

  const applySettings = useCallback((data) => {
    if (!Array.isArray(data)) { setLoaded(true); return }
    const map = Object.fromEntries(data.map(r => [r.key, r.value]))

    const newContact = { ...DEFAULT_CONTACT, ...(map.contact || {}) }
    setContact(prev => deepEqual(prev, newContact) ? prev : newContact)

    const newRules = parseRules(map.delivery_rules)
    setDeliveryRules(prev => deepEqual(prev, newRules) ? prev : newRules)

    setRawSettings(prev => deepEqual(prev, map) ? prev : map)
    setCouponEnabled(!!map.coupon_enabled)
    setHideOutOfStock(!!map.hide_out_of_stock)
    setOrdersBadgeEnabled(!!map.orders_badge_enabled)
    setReviewsEnabled(map.reviews_enabled !== false)
    setAutoApproveReviews(!!map.auto_approve_reviews)

    const newHotAds = map.hot_ads || { enabled: false, title: '' }
    setHotAds(prev => deepEqual(prev, newHotAds) ? prev : newHotAds)

    const newBlocks = Array.isArray(map.home_blocks) ? map.home_blocks : []
    setHomeBlocks(prev => deepEqual(prev, newBlocks) ? prev : newBlocks)

    const newSideMenu = Array.isArray(map.side_menu) ? map.side_menu : []
    setSideMenu(prev => deepEqual(prev, newSideMenu) ? prev : newSideMenu)

    const rawPromoPopup = map.promo_popup || {}
    const migratedImages = Array.isArray(rawPromoPopup.images)
      ? rawPromoPopup.images
      : (rawPromoPopup.image ? [rawPromoPopup.image] : [])
    const newPromoPopup = { ...DEFAULT_PROMO_POPUP, ...rawPromoPopup, images: migratedImages }
    setPromoPopup(prev => deepEqual(prev, newPromoPopup) ? prev : newPromoPopup)

    const newExitPopup = { ...DEFAULT_EXIT_POPUP, ...(map.exit_intent_popup || {}) }
    setExitPopup(prev => deepEqual(prev, newExitPopup) ? prev : newExitPopup)

    const newCheckoutUpsell = { ...DEFAULT_CHECKOUT_UPSELL, ...(map.checkout_upsell || {}) }
    setCheckoutUpsell(prev => deepEqual(prev, newCheckoutUpsell) ? prev : newCheckoutUpsell)

    const newCodAdvance = { ...DEFAULT_COD_ADVANCE, ...(map.cod_advance || {}) }
    setCodAdvance(prev => deepEqual(prev, newCodAdvance) ? prev : newCodAdvance)

    const rawPrepaidAccounts = map.prepaid_accounts || {}
    const newPrepaidAccounts = {
      jazzcash:  { ...DEFAULT_PREPAID_ACCOUNTS.jazzcash,  ...(rawPrepaidAccounts.jazzcash  || {}) },
      easypaisa: { ...DEFAULT_PREPAID_ACCOUNTS.easypaisa, ...(rawPrepaidAccounts.easypaisa || {}) },
    }
    setPrepaidAccounts(prev => deepEqual(prev, newPrepaidAccounts) ? prev : newPrepaidAccounts)

    const newMinOrder = { ...DEFAULT_MIN_ORDER, ...(map.min_order_amount || {}) }
    setMinOrder(prev => deepEqual(prev, newMinOrder) ? prev : newMinOrder)

    const newDealBoxes = Array.isArray(map.deal_boxes) ? map.deal_boxes : DEFAULT_DEAL_BOXES
    setDealBoxes(prev => deepEqual(prev, newDealBoxes) ? prev : newDealBoxes)

    const newFreeGift = { ...DEFAULT_FREE_GIFT, ...(map.free_gift || {}) }
    setFreeGift(prev => deepEqual(prev, newFreeGift) ? prev : newFreeGift)

    // Prepaid discount % — clamp to 0-100 so a bad value in the DB can
    // never accidentally discount an order by more than 100% or go negative.
    const rawPercent = Number(map.prepaid_discount_percent ?? 0)
    const newPercent = Number.isFinite(rawPercent) ? Math.min(100, Math.max(0, rawPercent)) : 0
    setPrepaidDiscountPercent(prev => prev === newPercent ? prev : newPercent)

    setLoaded(true)
  }, [])

  const reload = useCallback(async () => {
    // Use module-level cache — don't re-fetch if data is fresh (< 5 min old)
    const now = Date.now()
    if (_settingsCache && (now - _settingsFetchedAt) < CACHE_TTL) {
      applySettings(_settingsCache)
      return
    }

    if (!supabase) { setLoaded(true); return }
    const { data, error } = await supabase.from('site_settings').select('*')
    if (error) { console.error('[SiteSettings] fetch error:', error.message); setLoaded(true); return }

    // Store in module cache
    _settingsCache = data
    _settingsFetchedAt = now
    applySettings(data)
  }, [applySettings])

  useEffect(() => { reload() }, [reload])

  const getDeliveryCharge = useCallback(
    (city, subtotal) => calcCharge(city, subtotal, deliveryRules),
    [deliveryRules]
  )

  const getFreeThreshold = useCallback(
    (city) => findFreeThreshold(city, deliveryRules),
    [deliveryRules]
  )

  const value = useMemo(() => ({
    contact, deliveryRules, rawSettings,
    couponEnabled, setCouponEnabled, ordersBadgeEnabled, hideOutOfStock, setHideOutOfStock,
    reviewsEnabled, autoApproveReviews,
    hotAds, homeBlocks, sideMenu, promoPopup, exitPopup, checkoutUpsell, codAdvance, prepaidAccounts, minOrder, dealBoxes, freeGift, loaded,
    prepaidDiscountPercent, setPrepaidDiscountPercent,
    getDeliveryCharge, getFreeThreshold, reload,
  }), [
    contact, deliveryRules, rawSettings,
    couponEnabled, ordersBadgeEnabled, hideOutOfStock,
    reviewsEnabled, autoApproveReviews,
    hotAds, homeBlocks, sideMenu, promoPopup, exitPopup, checkoutUpsell, codAdvance, prepaidAccounts, minOrder, dealBoxes, freeGift, loaded,
    prepaidDiscountPercent,
    getDeliveryCharge, getFreeThreshold, reload,
  ])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSite() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSite must be used inside SiteSettingsProvider')
  return ctx
}
