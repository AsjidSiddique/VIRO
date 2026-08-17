'use client'
import { supabase } from '../lib/supabase'
import { getThumb } from '../context/CartContext'
import { useSite } from '../context/SiteSettingsContext'
import { buildCartNudgeMessage, buildWaLink } from '../lib/whatsappMessages'
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtRs   = v => v >= 1000000 ? `Rs.${(v/1000000).toFixed(2)}M` : v >= 1000 ? `Rs.${(v/1000).toFixed(1)}k` : `Rs.${Math.round(v).toLocaleString()}`
const fmtDate = d => new Date(d).toLocaleDateString('en-PK', { day:'2-digit', month:'short' })
const fmtDateTime = d => new Date(d).toLocaleString('en-PK', { day:'2-digit', month:'short', hour:'numeric', minute:'2-digit', hour12:true })
const fmtTimeAgo = d => {
  const diffMs = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return fmtDate(d)
}
const STATUS_COLOR = { UNPAID:'#F97316',CONFIRMED:'#8B5CF6',PROCESSING:'#00BFFF',SHIPPED:'#3B82F6',DELIVERED:'#10B981',RETURNED:'#A855F7',CANCELLED:'#94A3B8' }

// Builds a wa.me link pre-filled with a reminder message listing what's in
// their cart — tapping it opens WhatsApp with the message already typed,
// admin just reviews and hits send (Option A: free, one tap per customer,
// no WhatsApp Business API / cost involved).
//
// Message copy itself now lives in lib/whatsappMessages.js, shared with the
// equivalent "reached checkout but didn't order" nudge on the Checkout
// Activity tab — same tone, same free-gift/free-delivery nudge math, one
// place to update both from instead of two copies drifting apart.
function buildCartWhatsAppLink(customer) {
  return buildWaLink(customer.phone, buildCartNudgeMessage(customer))
}


// Hoisted to module scope — this was previously defined INSIDE AnalyticsDashboard's
// render function, which meant React saw a brand-new component type on every
// single re-render. That forces a full unmount+remount of every <Section>
// subtree on every click anywhere in the dashboard (any setState triggers a
// parent re-render) — which is exactly what was causing the "click something,
// screen jumps" bug. A stable module-level reference fixes it for good, not
// just for the cart section specifically.
function Section({ title, subtitle, children }) {
  return (
    <div className="viro-card p-4 md:p-5">
      <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color:'var(--viro-textSub)' }}>{title}</p>
      {subtitle && <p className="text-xs mb-4" style={{ color:'var(--viro-textSub)', opacity:0.75 }}>{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  )
}

function StatCard({ icon, label, value, sub, color, onClick, trend }) {
  return (
    <div onClick={onClick}
      style={{ background:'var(--viro-bgCard)',border:'1px solid var(--viro-border)',borderRadius:14,
        padding:'14px 16px',cursor:onClick?'pointer':'default',transition:'all 0.15s' }}
      onMouseEnter={e=>{if(onClick){e.currentTarget.style.borderColor='#8B5CF660';e.currentTarget.style.transform='translateY(-2px)'}}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor='';e.currentTarget.style.transform=''}}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
        <span style={{ fontSize:20 }}>{icon}</span>
        {trend !== undefined && (
          <span style={{ fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:20,
            background: trend >= 0 ? '#10B98120' : '#EF444420',
            color: trend >= 0 ? '#10B981' : '#EF4444' }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div style={{ fontSize:22,fontWeight:900,color,lineHeight:1.1,marginTop:6 }}>{value}</div>
      <div style={{ fontSize:12,fontWeight:600,color:'var(--viro-text)',marginTop:2 }}>{label}</div>
      {sub && <div style={{ fontSize:10,color:'var(--viro-textSub)',marginTop:2 }}>{sub}</div>}
      {onClick && <div style={{ fontSize:9,color:'#8B5CF6',marginTop:4,fontWeight:600 }}>tap to explore →</div>}
    </div>
  )
}

function MiniBar({ pct, color }) {
  return (
    <div style={{ flex:1,height:6,borderRadius:3,overflow:'hidden',background:'var(--viro-bgDeep)' }}>
      <div style={{ height:'100%',borderRadius:3,transition:'width 0.7s ease',
        width:`${Math.max(pct,1)}%`,background:color }} />
    </div>
  )
}

export default function AnalyticsDashboard({ onNavigate }) {
  const { rawSettings } = useSite()
  const whatsappRecoveryEnabled = rawSettings?.feature_toggles?.whatsapp_cart_recovery !== false
  const today = new Date()
  const fmt   = d => d.toISOString().slice(0,10)
  const [dateFrom, setDateFrom] = useState(fmt(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [dateTo,   setDateTo]   = useState(fmt(today))
  const [loading,  setLoading]  = useState(true)

  // Data
  const [orders,    setOrders]    = useState([])
  const [customers, setCustomers] = useState([])
  const [products,  setProducts]  = useState([])
  // product_id -> raw images value, used to render thumbnails anywhere we only
  // have a product_id (ranked lists, customer-wise breakdown) without needing
  // a separate query — `products` is already fetched for the rest of the panel.
  const productImagesById = useMemo(() => Object.fromEntries(products.map(p => [p.id, p.images])), [products])
  // Effective price (discount price if actually active/lower, else regular price)
  const effectivePrice = (p) => (p?.discount_price && p.discount_price > 0 && p.discount_price < p.price) ? p.discount_price : (p?.price || 0)
  const productPriceById = useMemo(() => Object.fromEntries(products.map(p => [p.id, effectivePrice(p)])), [products])
  const [allOrders, setAllOrders] = useState([]) // for sparklines comparison
  const [cartData,     setCartData]     = useState([]) // [{product_id,product_name,in_cart_qty,cart_sessions}]
  const [cartDetail,   setCartDetail]   = useState([]) // [{session_id,product_id,quantity,source,customer_id,products,customers}]
  const [checkoutSessionMap, setCheckoutSessionMap] = useState({}) // session_id -> {name,phone,email} from checkout_sessions
  const [cartByCustomer, setCartByCustomer] = useState([]) // [{identity_key,is_registered,name,phone,city,has_identity,total_qty,product_count,products}]
  const [expandedCustomer, setExpandedCustomer] = useState(null) // identity_key of the customer row currently expanded
  // ── Cart-section-specific controls — independent of the dashboard-wide
  // date picker above, since cart activity often needs its own window
  // ('what got added today' vs 'orders this month' are different questions).
  const [cartDateFilter, setCartDateFilter] = useState('all') // 'all' | 'today' | '7d' | '30d'
  const [cartSortBy, setCartSortBy] = useState('qty')          // 'qty' | 'value' | 'recent' | 'name'
  const [cartFilterLoading, setCartFilterLoading] = useState(false)

  const fetchCartWithFilter = useCallback(async (filter) => {
    setCartFilterLoading(true)
    try {
      let since = null
      const now = new Date()
      if (filter === 'today') { since = new Date(now); since.setHours(0,0,0,0) }
      else if (filter === '7d')  { since = new Date(now.getTime() - 7*24*60*60*1000) }
      else if (filter === '30d') { since = new Date(now.getTime() - 30*24*60*60*1000) }

      const url = since
        ? `/api/admin-cart?since=${encodeURIComponent(since.toISOString())}&until=${encodeURIComponent(now.toISOString())}`
        : '/api/admin-cart'
      const res = await fetch(url).then(r => r.json()).catch(() => ({ ok: false }))

      const detail = Array.isArray(res?.cartDetail) ? res.cartDetail : []
      setCartDetail(detail)
      let byCustomer = Array.isArray(res?.cartByCustomer) ? res.cartByCustomer : []
      if (byCustomer.length === 0 && detail.length > 0) {
        const map = {}
        detail.forEach(r => {
          const isRegistered = !!r.customer_id
          const key = isRegistered ? `c:${r.customer_id}` : `g:${r.session_id}`
          if (!map[key]) {
            map[key] = {
              identity_key: key, is_registered: isRegistered,
              name: r.customers?.name || checkoutSessionMap[r.session_id]?.name || null,
              phone: r.customers?.phone || checkoutSessionMap[r.session_id]?.phone || null,
              email: r.customers?.email || checkoutSessionMap[r.session_id]?.email || null,
              city: r.customers?.city || null,
              has_checkout_info: !r.customer_id && !!checkoutSessionMap[r.session_id],
              has_identity: !!r.customers, total_qty: 0, product_count: 0, net_value: 0, products: [], latest_added_at: null, sources: [],
            }
          }
          const rowSource = r.source || 'direct'
          if (!map[key].sources.includes(rowSource)) map[key].sources.push(rowSource)
          const unitPrice = r.products?.discount_price > 0 && r.products.discount_price < r.products?.price
            ? r.products.discount_price : (r.products?.price || 0)
          const lineTotal = unitPrice * (r.quantity || 1)
          map[key].total_qty += r.quantity || 1
          map[key].product_count += 1
          map[key].net_value += lineTotal
          if (!map[key].latest_added_at || (r.updated_at || r.added_at) > map[key].latest_added_at) map[key].latest_added_at = r.updated_at || r.added_at
          map[key].products.push({ product_id: r.product_id, product_name: r.products?.name || 'Product', quantity: r.quantity, unit_price: unitPrice, line_total: lineTotal, added_at: r.updated_at || r.added_at,
            selected_color_name: r.selected_color_name || null, selected_size_name: r.selected_size_name || null })
        })
        byCustomer = Object.values(map)
      } else {
        // Server-computed cartByCustomer doesn't carry latest_added_at yet —
        // derive it from cartDetail so "Most recent" sort still works.
        const latestByKey = {}
        detail.forEach(r => {
          const key = r.customer_id ? `c:${r.customer_id}` : `g:${r.session_id}`
          const t = r.updated_at || r.added_at
          if (!latestByKey[key] || t > latestByKey[key]) latestByKey[key] = t
        })
        byCustomer = byCustomer.map(c => ({ ...c, latest_added_at: latestByKey[c.identity_key] || null }))
      }
      setCartByCustomer(byCustomer)

      const countMap = {}
      detail.forEach(r => {
        const pid = r.product_id
        if (!pid) return
        if (!countMap[pid]) countMap[pid] = { product_id: pid, product_name: r.products?.name || 'Unknown', in_cart_qty: 0, cart_sessions: new Set() }
        countMap[pid].in_cart_qty += r.quantity || 1
        countMap[pid].cart_sessions.add(r.session_id)
      })
      const counts = Object.values(countMap).map(r => ({ ...r, cart_sessions: r.cart_sessions.size })).sort((a,b) => b.in_cart_qty - a.in_cart_qty)
      if (counts.length) setCartData(counts)
    } finally {
      setCartFilterLoading(false)
    }
  }, [checkoutSessionMap])

  useEffect(() => {
    if (cartDateFilter !== 'all') fetchCartWithFilter(cartDateFilter)
    // 'all' falls back to whatever the main dashboard fetchAll() already loaded
  }, [cartDateFilter, fetchCartWithFilter])

  const sortedCartByCustomer = useMemo(() => {
    const arr = [...cartByCustomer]
    if (cartSortBy === 'value')  return arr.sort((a,b) => (b.net_value||0) - (a.net_value||0))
    if (cartSortBy === 'recent') return arr.sort((a,b) => (b.latest_added_at||'').localeCompare(a.latest_added_at||''))
    if (cartSortBy === 'name')   return arr.sort((a,b) => (a.name||'Guest').localeCompare(b.name||'Guest'))
    if (cartSortBy === 'intent') return arr.sort((a,b) => (b.reached_checkout?1:0) - (a.reached_checkout?1:0) || (b.total_qty||0) - (a.total_qty||0))
    return arr.sort((a,b) => (b.total_qty||0) - (a.total_qty||0)) // 'qty' default — max cart items first
  }, [cartByCustomer, cartSortBy])
  const [wishlistData, setWishlistData] = useState([]) // [{product_id,product_name,wishlist_count}]

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const from = new Date(dateFrom); from.setHours(0,0,0,0)
    const to   = new Date(dateTo);   to.setHours(23,59,59,999)

    const [ordsRes, allOrdsRes, custsRes, prodsRes, wishRes, cartApiRes, checkoutSessRes] = await Promise.all([
      (async () => {
        // 'source' is a new column (v60) — if it doesn't exist yet on this DB,
        // PostgREST fails the WHOLE select, not just that field. Try with it
        // first; silently drop it and retry if that's the failure, so the
        // entire Recent Orders table doesn't break for anyone who hasn't run
        // that migration yet.
        const withSource = await supabase.from('orders')
          .select('id,created_at,final_total,status,payment_method,payment_status,delivery_charges,total_price,coupon_code,coupon_discount,source,customers(id,name,phone,city,email,auth_user_id),order_items(quantity,price,products(name,id))')
          .gte('created_at', from.toISOString()).lte('created_at', to.toISOString())
        if (!withSource.error) return withSource
        return supabase.from('orders')
          .select('id,created_at,final_total,status,payment_method,payment_status,delivery_charges,total_price,coupon_code,coupon_discount,customers(id,name,phone,city,email,auth_user_id),order_items(quantity,price,products(name,id))')
          .gte('created_at', from.toISOString()).lte('created_at', to.toISOString())
      })(),
      supabase.from('orders').select('created_at,final_total,status'),
      supabase.from('customers').select('id,created_at,city,auth_user_id,name,phone'),
      supabase.from('products').select('id,name,images,stock,price,discount_price,is_active,status,category_id,created_at,is_featured'),
      supabase.from('product_wishlist_counts').select('product_id,product_name,wishlist_count').order('wishlist_count', { ascending: false }).limit(20),
      // Cart data via service-role endpoint — the anon key has no SELECT
      // permission on cart_items (RLS: "service role only"), so querying
      // via supabase.from() here with the anon key always returns empty.
      // This endpoint uses the service role key server-side to bypass that.
      // Scoped to the SAME date range as the rest of this dashboard (the
      // picker above) — so "Today" shows today's ATC activity, "Last 7
      // days" shows that window, etc.
      fetch(`/api/admin-cart?since=${encodeURIComponent(from.toISOString())}&until=${encodeURIComponent(to.toISOString())}`)
        .then(r => r.json()).catch(() => ({ ok: false })),
      // Gives an anonymous cart a real identity as soon as they've typed
      // phone/email at checkout — even if they never placed an order, so
      // "Guest" carts can show a name/phone instead of nothing at all.
      supabase.from('checkout_sessions').select('session_id,name,phone,email').order('updated_at', { ascending: false }).limit(500),
    ])
    setOrders(ordsRes.data || [])
    setAllOrders(allOrdsRes.data || [])
    setCustomers(custsRes.data || [])
    setProducts(prodsRes.data || [])
    setWishlistData(Array.isArray(wishRes?.data) ? wishRes.data.filter(r=>r.wishlist_count>0) : [])
    const checkoutSessMap = {}
    ;(checkoutSessRes?.data || []).forEach(s => { if (s.session_id && !checkoutSessMap[s.session_id]) checkoutSessMap[s.session_id] = s })
    setCheckoutSessionMap(checkoutSessMap)
    const detail = Array.isArray(cartApiRes?.cartDetail) ? cartApiRes.cartDetail : []
    setCartDetail(detail)
    // Prefer the server-computed grouping (includes guest-identification via
    // past orders). Fall back to deriving it client-side from `detail` if the
    // Edge Function hasn't been redeployed with the newer _actions.ts yet —
    // `detail` rows already carry customer_id + the joined `customers` record,
    // so registered-customer grouping still works even on the older deploy;
    // only the "guest recognized from a past order" enrichment is skipped.
    let byCustomer = Array.isArray(cartApiRes?.cartByCustomer) ? cartApiRes.cartByCustomer : []
    if (byCustomer.length === 0 && detail.length > 0) {
      const map = {}
      detail.forEach(r => {
        const isRegistered = !!r.customer_id
        const key = isRegistered ? `c:${r.customer_id}` : `g:${r.session_id}`
        if (!map[key]) {
          map[key] = {
            identity_key: key,
            is_registered: isRegistered,
            name:  r.customers?.name  || null,
            phone: r.customers?.phone || null,
            city:  r.customers?.city  || null,
            has_identity: !!r.customers,
            total_qty: 0,
            product_count: 0,
            net_value: 0,
            products: [],
            sources: [],
          }
        }
        const rowSource = r.source || 'direct'
        if (!map[key].sources.includes(rowSource)) map[key].sources.push(rowSource)
        const unitPrice = r.products?.discount_price > 0 && r.products.discount_price < r.products?.price
          ? r.products.discount_price : (r.products?.price || 0)
        const lineTotal = unitPrice * (r.quantity || 1)
        map[key].total_qty += r.quantity || 1
        map[key].product_count += 1
        map[key].net_value += lineTotal
        map[key].products.push({
          product_id: r.product_id, product_name: r.products?.name || 'Product',
          quantity: r.quantity, unit_price: unitPrice, line_total: lineTotal, added_at: r.updated_at || r.added_at,
          selected_color_name: r.selected_color_name || null, selected_size_name: r.selected_size_name || null,
        })
      })
      byCustomer = Object.values(map).sort((a, b) => b.total_qty - a.total_qty)
    } else {
      // Server-computed cartByCustomer (edge function) doesn't carry
      // latest_added_at — derive it from cartDetail here too, same as
      // fetchCartWithFilter already does for the date-sub-filtered path.
      // Needed to tell a genuinely-current "reached checkout" apart from
      // a stale one (see the reached_checkout badge logic below).
      const latestByKey = {}
      detail.forEach(r => {
        const key = r.customer_id ? `c:${r.customer_id}` : `g:${r.session_id}`
        const t = r.updated_at || r.added_at
        if (!latestByKey[key] || t > latestByKey[key]) latestByKey[key] = t
      })
      byCustomer = byCustomer.map(c => ({ ...c, latest_added_at: latestByKey[c.identity_key] || null }))
    }
    setCartByCustomer(byCustomer)
    // Try view-based counts first; if empty but detail rows exist, derive counts from detail
    let counts = Array.isArray(cartApiRes?.cartCounts) ? cartApiRes.cartCounts.filter(r=>r.in_cart_qty>0) : []
    if (counts.length === 0 && detail.length > 0) {
      const map = {}
      detail.forEach(r => {
        const pid = r.product_id
        if (!pid) return
        if (!map[pid]) map[pid] = { product_id: pid, product_name: r.products?.name || 'Product', in_cart_qty: 0, cart_sessions: new Set() }
        map[pid].in_cart_qty += r.quantity || 1
        map[pid].cart_sessions.add(r.session_id)
      })
      counts = Object.values(map)
        .map(r => ({ ...r, cart_sessions: r.cart_sessions.size }))
        .filter(r => r.in_cart_qty > 0)
        .sort((a, b) => b.in_cart_qty - a.in_cart_qty)
    }
    setCartData(counts)
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Derived ───────────────────────────────────────────────────────────────
  const active    = orders.filter(o => o.status !== 'CANCELLED')
  const revenue   = active.reduce((s,o) => s+(o.final_total||0), 0)
  const delivered = orders.filter(o => o.status === 'DELIVERED').length
  const returned  = orders.filter(o => o.status === 'RETURNED').length
  const cancelled = orders.filter(o => o.status === 'CANCELLED').length
  const pending   = orders.filter(o => ['UNPAID','CONFIRMED','PROCESSING'].includes(o.status)).length
  const shipped   = orders.filter(o => o.status === 'SHIPPED').length
  const avgOrder  = active.length ? Math.round(revenue/active.length) : 0
  const cod       = orders.filter(o => !o.payment_method || o.payment_method === 'COD').length
  const prepaid   = orders.length - cod
  const prepPending = orders.filter(o => o.payment_method && o.payment_method !== 'COD' && o.payment_status !== 'PAID').length
  const delivRate  = orders.length ? Math.round((delivered/orders.length)*100) : 0
  const returnRate = orders.length ? Math.round((returned/orders.length)*100) : 0
  const cancelRate = orders.length ? Math.round((cancelled/orders.length)*100) : 0

  // ── Cart activity, scoped to the SAME date range as everything above ──
  // cartData/cartByCustomer are already fetched with since=from&until=to in
  // fetchAll, so these numbers automatically respect Today/7d/30d/custom —
  // no separate fetch needed here.
  const cartTotalUnits    = cartData.reduce((s,r) => s + (r.in_cart_qty||0), 0)
  const cartTotalShoppers = cartByCustomer.length
  const cartNetValue      = cartByCustomer.reduce((s,c) => s + (c.net_value||0), 0)

  // ── Orders by source — "what's actually working" ──────────────────────
  // Requires v60 migration (orders.source). Falls back to all-'direct' if
  // that column isn't populated yet, rather than breaking.
  const ordersBySource = { instagram: { count:0, revenue:0 }, facebook: { count:0, revenue:0 }, direct: { count:0, revenue:0 } }
  active.forEach(o => {
    const src = ordersBySource[o.source] ? o.source : 'direct'
    ordersBySource[src].count += 1
    ordersBySource[src].revenue += (o.final_total || 0)
  })

  // Daily breakdown
  const byDay = {}
  orders.forEach(o => {
    const d = o.created_at?.slice(0,10); if (!d) return
    if (!byDay[d]) byDay[d] = { date:d, rev:0, orders:0, delivered:0, returned:0 }
    if (o.status !== 'CANCELLED') byDay[d].rev += (o.final_total||0)
    byDay[d].orders++
    if (o.status === 'DELIVERED') byDay[d].delivered++
    if (o.status === 'RETURNED')  byDay[d].returned++
  })
  const days     = Object.values(byDay).sort((a,b) => a.date.localeCompare(b.date))
  const maxRev   = Math.max(...days.map(d=>d.rev), 1)
  const maxOrds  = Math.max(...days.map(d=>d.orders), 1)

  // Top products by quantity
  const prodSales = {}
  const prodRevMap = {}
  active.forEach(o => o.order_items?.forEach(i => {
    const n = i.products?.name || 'Unknown'
    prodSales[n] = (prodSales[n]||0) + (i.quantity||1)
    prodRevMap[n] = (prodRevMap[n]||0) + (i.price||0)*(i.quantity||1)
  }))
  const topByQty = Object.entries(prodSales).sort((a,b)=>b[1]-a[1]).slice(0,8)
  const topByRev = Object.entries(prodRevMap).sort((a,b)=>b[1]-a[1]).slice(0,5)

  // City stats
  const cityMap = {}
  active.forEach(o => {
    const c = o.customers?.city || 'Unknown'
    if (!cityMap[c]) cityMap[c] = { city:c, rev:0, orders:0 }
    cityMap[c].rev    += (o.final_total||0)
    cityMap[c].orders++
  })
  const topCities = Object.values(cityMap).sort((a,b)=>b.rev-a.rev).slice(0,6)
  const maxCityRev = topCities[0]?.rev || 1

  // Best customers
  const custMap = {}
  active.forEach(o => {
    const id = o.customers?.id
    if (!id) return
    if (!custMap[id]) custMap[id] = { ...o.customers, rev:0, orders:0, returned:0 }
    custMap[id].rev    += (o.final_total||0)
    custMap[id].orders++
  })
  orders.filter(o=>o.status==='RETURNED').forEach(o => {
    const id = o.customers?.id; if (id && custMap[id]) custMap[id].returned++
  })
  const topCustomers = Object.values(custMap).sort((a,b)=>b.rev-a.rev).slice(0,5)

  // Inventory
  const activeProds  = products.filter(p => p.is_active && p.status==='active')
  const outOfStock   = products.filter(p => (p.stock||0) === 0 && p.is_active)
  const lowStock     = products.filter(p => (p.stock||0) > 0 && (p.stock||0) <= 3 && p.is_active)
  const onSale       = products.filter(p => p.discount_price && p.discount_price < p.price)
  const totalStock   = products.reduce((s,p) => s+(p.stock||0), 0)
  const stockValue   = products.reduce((s,p) => s + (p.stock||0)*(p.price||0), 0)

  // Customers
  const newCusts  = customers.filter(c => c.created_at?.slice(0,10) >= dateFrom && c.created_at?.slice(0,10) <= dateTo)
  const googleC   = customers.filter(c => !!c.auth_user_id)
  const guestC    = customers.filter(c => !c.auth_user_id)

  // Status counts
  const statusCounts = {}
  const statusList = ['UNPAID','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','RETURNED','CANCELLED']
  statusList.forEach(s => { statusCounts[s] = orders.filter(o=>o.status===s).length })

  // Quick ranges
  const RANGES = [
    { label:'Today',      from:fmt(today),                                             to:fmt(today) },
    { label:'Yesterday',  from:fmt(new Date(today-864e5)),                             to:fmt(new Date(today-864e5)) },
    { label:'7d',         from:fmt(new Date(today-6*864e5)),                           to:fmt(today) },
    { label:'30d',        from:fmt(new Date(today-29*864e5)),                          to:fmt(today) },
    { label:'90d',        from:fmt(new Date(today-89*864e5)),                          to:fmt(today) },
    { label:'This month', from:fmt(new Date(today.getFullYear(),today.getMonth(),1)),  to:fmt(today) },
    { label:'Last month', from:fmt(new Date(today.getFullYear(),today.getMonth()-1,1)),to:fmt(new Date(today.getFullYear(),today.getMonth(),0)) },
    { label:'All time',   from:'2024-01-01',                                           to:fmt(today) },
  ]
  const isActive = r => dateFrom === r.from && dateTo === r.to

  return (
    <div className="px-3 md:px-5 pb-20 space-y-5 fade-in">

      {/* ── Date picker ── */}
      <div className="viro-card p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {RANGES.map(r => (
            <button type="button" key={r.label} onClick={() => { setDateFrom(r.from); setDateTo(r.to) }}
              className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
              style={{ background: isActive(r)?'#8B5CF6':'var(--viro-bgDeep)',
                color: isActive(r)?'#fff':'var(--viro-textSub)',
                border:`1px solid ${isActive(r)?'#8B5CF6':'var(--viro-border)'}` }}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>From</label>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{ colorScheme:'dark' }} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>To</label>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{ colorScheme:'dark' }} />
          </div>
          {loading && <div className="text-xs animate-pulse mt-4" style={{ color:'var(--viro-textSub)' }}>⟳ Loading…</div>}
        </div>
      </div>

      {/* ── Revenue KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="💰" label="Total Revenue"   value={fmtRs(revenue)}   color="#10B981" sub={`avg ${fmtRs(avgOrder)} / order`}   onClick={()=>onNavigate?.('Orders')} />
        <StatCard icon="📋" label="Total Orders"    value={orders.length}    color="#8B5CF6" sub={`${pending} pending · ${shipped} shipped`} onClick={()=>onNavigate?.('Orders')} />
        <StatCard icon="📦" label="Delivered"       value={delivered}        color="#10B981" sub={`${delivRate}% delivery rate`}        onClick={()=>onNavigate?.('Orders',{type:'order_status',status:'DELIVERED'})} />
        <StatCard icon="↩️" label="Returned"        value={returned}         color="#EF4444" sub={`${returnRate}% return rate`}         onClick={()=>onNavigate?.('Orders',{type:'order_status',status:'RETURNED'})} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="⏳" label="Pending"         value={pending}          color="#F97316" sub="awaiting action"                     onClick={()=>onNavigate?.('Orders',{type:'order_status',status:'UNPAID'})} />
        <StatCard icon="❌" label="Cancelled"       value={cancelled}        color="#94A3B8" sub={`${cancelRate}% cancel rate`}        />
        <StatCard icon="💳" label="Prepaid Orders"  value={prepaid}          color="#EC4899" sub={prepPending > 0 ? `⚠️ ${prepPending} unverified` : '✅ all verified'} onClick={()=>onNavigate?.('Orders',{type:'order_status',status:'UNPAID'})} />
        <StatCard icon="💵" label="COD Orders"      value={cod}              color="#A78BFA" sub="cash on delivery"                    />
      </div>

      {/* ── Cart activity + source performance — same date filter as above ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="🛒" label="Cart Units"      value={cartTotalUnits}    color="#7C3AED" sub={`in this period`} />
        <StatCard icon="👥" label="Cart Shoppers"   value={cartTotalShoppers} color="#7C3AED" sub={`unique people`} />
        <StatCard icon="💰" label="Cart Net Value"  value={fmtRs(Math.round(cartNetValue))} color="#7C3AED" sub={`sitting in carts now`} />
        <StatCard icon="📊" label="Cart→Order Rate" value={cartTotalShoppers ? `${Math.round((active.length/cartTotalShoppers)*100)}%` : '—'} color="#7C3AED" sub={`${active.length} orders / ${cartTotalShoppers} shoppers`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard icon="📷" label="Instagram Orders" value={ordersBySource.instagram.count} color="#E11341" sub={`${fmtRs(ordersBySource.instagram.revenue)} revenue`} />
        <StatCard icon="👍" label="Facebook Orders"  value={ordersBySource.facebook.count}  color="#1877F2" sub={`${fmtRs(ordersBySource.facebook.revenue)} revenue`} />
        <StatCard icon="🌐" label="Direct Orders"    value={ordersBySource.direct.count}    color="#64748B" sub={`${fmtRs(ordersBySource.direct.revenue)} revenue`} />
      </div>

      {/* ── Revenue chart ── */}
      {days.length > 0 && (
        <Section title="📈 Daily Revenue & Orders">
          <div className="flex items-end gap-0.5 overflow-x-auto mb-1" style={{ height:100 }}>
            {days.map(d => (
              <div key={d.date} className="flex flex-col items-center gap-0 flex-1 group" style={{ minWidth:20 }}
                title={`${fmtDate(d.date)}: ${fmtRs(d.rev)} · ${d.orders} orders`}>
                <div style={{ width:'100%',background:'#8B5CF680',borderRadius:'2px 2px 0 0',
                  height:`${(d.orders/maxOrds)*40}%`,minHeight:2 }} />
                <div style={{ width:'100%',background:'#10B981',borderRadius:'2px 2px 0 0',
                  height:`${(d.rev/maxRev)*60}%`,minHeight:2 }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between">
            <div className="flex items-center gap-3 text-xs" style={{ color:'var(--viro-textSub)' }}>
              <span><span style={{ color:'#10B981' }}>■</span> Revenue</span>
              <span><span style={{ color:'#8B5CF6' }}>■</span> Orders</span>
            </div>
            <div className="flex gap-4 text-xs font-bold">
              <span style={{ color:'#10B981' }}>{fmtRs(revenue)}</span>
              <span style={{ color:'#8B5CF6' }}>{orders.length} orders</span>
            </div>
          </div>
          {/* Date labels */}
          <div className="flex justify-between mt-1 overflow-hidden">
            {days.filter((_,i) => i===0 || i===Math.floor(days.length/2) || i===days.length-1).map(d => (
              <span key={d.date} style={{ fontSize:9,color:'var(--viro-textSub)' }}>{fmtDate(d.date)}</span>
            ))}
          </div>
        </Section>
      )}

      {/* ── Status + Payment split ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="📊 Order Status Breakdown">
          <div className="space-y-2">
            {statusList.map(s => {
              const cnt = statusCounts[s]||0
              const pct = orders.length ? Math.round((cnt/orders.length)*100) : 0
              return (
                <div key={s} className="flex items-center gap-2 cursor-pointer" title={`Show ${s} orders`}
                  onClick={() => onNavigate?.('Orders', {type:'order_status',status:s})}>
                  <span className="text-xs font-bold w-24 flex-shrink-0" style={{ color:STATUS_COLOR[s] }}>{s}</span>
                  <MiniBar pct={pct} color={STATUS_COLOR[s]} />
                  <span className="text-xs font-bold w-6 text-right" style={{ color:'var(--viro-text)' }}>{cnt}</span>
                  <span className="text-xs w-8 flex-shrink-0" style={{ color:'var(--viro-textSub)' }}>{pct}%</span>
                </div>
              )
            })}
          </div>
        </Section>

        <Section title="💳 Payment Analytics">
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label:'COD',     value:cod,        color:'#A78BFA', bg:'#8B5CF618', b:'#8B5CF640' },
              { label:'Prepaid', value:prepaid,    color:'#10B981', bg:'#10B98118', b:'#10B98140' },
              { label:'Unverified', value:prepPending, color:'#F59E0B', bg:'#F59E0B18', b:'#F59E0B40' },
            ].map(s => (
              <div key={s.label} className="text-center p-3 rounded-xl"
                style={{ background:s.bg, border:`1px solid ${s.b}` }}>
                <div className="text-lg font-extrabold" style={{ color:s.color }}>{s.value}</div>
                <div className="text-xs" style={{ color:'var(--viro-textSub)' }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* COD vs Prepaid bar */}
          {orders.length > 0 && (
            <div>
              <div className="flex h-3 rounded-full overflow-hidden mb-1">
                <div style={{ width:`${(cod/orders.length)*100}%`, background:'#8B5CF6' }} />
                <div style={{ width:`${(prepaid/orders.length)*100}%`, background:'#10B981' }} />
              </div>
              <div className="flex justify-between text-xs" style={{ color:'var(--viro-textSub)' }}>
                <span style={{ color:'#A78BFA' }}>COD {Math.round((cod/orders.length)*100)}%</span>
                <span style={{ color:'#10B981' }}>Prepaid {Math.round((prepaid/orders.length)*100)}%</span>
              </div>
            </div>
          )}
          {/* Revenue metrics */}
          <div className="mt-4 space-y-2">
            {[
              { label:'Avg Order Value',  value:fmtRs(avgOrder),  color:'#00BFFF' },
              { label:'Total Delivery Revenue', value:fmtRs(orders.reduce((s,o)=>s+(o.delivery_charges||0),0)), color:'#A78BFA' },
              { label:'Total Discounts Given', value:fmtRs(orders.reduce((s,o)=>s+(o.coupon_discount||0),0)), color:'#F97316' },
            ].map(m => (
              <div key={m.label} className="flex justify-between text-sm">
                <span style={{ color:'var(--viro-textSub)' }}>{m.label}</span>
                <span className="font-bold" style={{ color:m.color }}>{m.value}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── Top products ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="🏆 Top Products by Quantity Sold">
          {topByQty.length === 0
            ? <p className="text-sm py-4 text-center" style={{ color:'var(--viro-textSub)' }}>No sales in period</p>
            : topByQty.map(([name,qty],i) => (
              <div key={name} className="flex items-center gap-3 py-2 border-b last:border-0"
                style={{ borderColor:'var(--viro-border)' }}>
                <span className="text-sm font-extrabold w-5 flex-shrink-0"
                  style={{ color:['#F59E0B','#94A3B8','#CD7C2F','#8B5CF6','#10B981','#00BFFF','#F97316','#EC4899'][i] }}>
                  #{i+1}
                </span>
                <span className="flex-1 text-sm truncate" style={{ color:'var(--viro-text)' }}>{name}</span>
                <MiniBar pct={(qty/(topByQty[0][1]||1))*100} color="#F97316" />
                <span className="text-xs font-bold flex-shrink-0" style={{ color:'#F97316' }}>{qty} sold</span>
              </div>
            ))
          }
        </Section>

        <Section title="💰 Top Products by Revenue">
          {topByRev.length === 0
            ? <p className="text-sm py-4 text-center" style={{ color:'var(--viro-textSub)' }}>No sales in period</p>
            : topByRev.map(([name,rev],i) => (
              <div key={name} className="flex items-center gap-3 py-2 border-b last:border-0"
                style={{ borderColor:'var(--viro-border)' }}>
                <span className="text-sm font-extrabold w-5 flex-shrink-0"
                  style={{ color:['#F59E0B','#94A3B8','#CD7C2F','#8B5CF6','#10B981'][i] }}>
                  #{i+1}
                </span>
                <span className="flex-1 text-sm truncate" style={{ color:'var(--viro-text)' }}>{name}</span>
                <MiniBar pct={(rev/(topByRev[0][1]||1))*100} color="#10B981" />
                <span className="text-xs font-bold flex-shrink-0" style={{ color:'#10B981' }}>{fmtRs(rev)}</span>
              </div>
            ))
          }
        </Section>
      </div>

      {/* ── City rankings ── */}
      <Section title="📍 City Performance Ranking">
        {topCities.length === 0
          ? <p className="text-sm py-4 text-center" style={{ color:'var(--viro-textSub)' }}>No data</p>
          : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {topCities.map((c,i) => (
                <div key={c.city} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
                  title={`See orders from ${c.city}`}
                  style={{ background:'var(--viro-bgDeep)',transition:'all 0.15s' }}
                  onClick={() => onNavigate?.('Orders', {type:'customer_search',name:c.city})}
                  onMouseEnter={e=>e.currentTarget.style.background='#8B5CF618'}
                  onMouseLeave={e=>e.currentTarget.style.background='var(--viro-bgDeep)'}>
                  <span className="text-base font-extrabold w-6 flex-shrink-0"
                    style={{ color:i===0?'#F59E0B':i===1?'#94A3B8':i===2?'#CD7C2F':'var(--viro-textSub)' }}>
                    #{i+1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-bold" style={{ color:'var(--viro-text)' }}>{c.city}</span>
                      <span className="text-xs font-bold" style={{ color:'#A78BFA' }}>{c.orders} orders</span>
                    </div>
                    <MiniBar pct={(c.rev/maxCityRev)*100} color="linear-gradient(90deg,#7C3AED,#00BFFF)" />
                    <div className="text-xs font-bold mt-1" style={{ color:'#10B981' }}>{fmtRs(c.rev)}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </Section>

      {/* ── Best customers ── */}
      <Section title="👑 Top Customers by Spend">
        {topCustomers.length === 0
          ? <p className="text-sm py-4 text-center" style={{ color:'var(--viro-textSub)' }}>No orders in period</p>
          : (
            <div className="space-y-2">
              {topCustomers.map((c,i) => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
                  style={{ background:'var(--viro-bgDeep)' }}
                  onClick={() => onNavigate?.('Customers')}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                    style={{ background: c.auth_user_id ? 'linear-gradient(135deg,#10B981,#059669)' : 'linear-gradient(135deg,#8B5CF6,#00BFFF)' }}>
                    {(c.name||'?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold truncate" style={{ color:'var(--viro-text)' }}>{c.name}</span>
                      {c.auth_user_id && <span style={{ fontSize:8,fontWeight:800,padding:'1px 5px',borderRadius:10,background:'#10B98115',color:'#10B981',border:'1px solid #10B98140' }}>🟢</span>}
                      {c.returned > 0 && <span style={{ fontSize:8,fontWeight:800,padding:'1px 5px',borderRadius:10,background:'#EF444415',color:'#EF4444',border:'1px solid #EF444430' }}>↩️ {c.returned}</span>}
                    </div>
                    <div className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                      📍 {c.city} · {c.orders} order{c.orders!==1?'s':''}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-extrabold" style={{ color:'#10B981' }}>{fmtRs(c.rev)}</div>
                    <div className="text-xs" style={{ color:'var(--viro-textSub)' }}>#{i+1}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </Section>

      {/* ── Customer insights ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="👥 Customer Breakdown">
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { icon:'🆕', label:'New (period)',   value:newCusts.length,    color:'#00BFFF' },
              { icon:'👥', label:'Total',          value:customers.length,   color:'#8B5CF6' },
              { icon:'🟢', label:'Google Accounts',value:googleC.length,     color:'#10B981' },
              { icon:'⚪', label:'Guest / Phone',  value:guestC.length,      color:'#64748B' },
            ].map(s => (
              <div key={s.label} className="p-3 rounded-xl text-center"
                style={{ background:'var(--viro-bgDeep)' }}>
                <div className="text-lg">{s.icon}</div>
                <div className="text-base font-extrabold" style={{ color:s.color }}>{s.value}</div>
                <div className="text-xs" style={{ color:'var(--viro-textSub)' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div className="flex h-2 rounded-full overflow-hidden">
            <div style={{ width:`${customers.length?(googleC.length/customers.length)*100:0}%`, background:'#10B981' }} />
            <div style={{ flex:1, background:'#64748B' }} />
          </div>
          <div className="flex justify-between text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
            <span style={{ color:'#10B981' }}>Google {customers.length?Math.round((googleC.length/customers.length)*100):0}%</span>
            <span>Guest {customers.length?Math.round((guestC.length/customers.length)*100):0}%</span>
          </div>
        </Section>

        {/* Inventory health */}
        <Section title="📦 Inventory Health">
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { icon:'✅', label:'Active Products',   value:activeProds.length,  color:'#10B981' },
              { icon:'⛔', label:'Out of Stock',      value:outOfStock.length,   color:'#EF4444' },
              { icon:'⚠️', label:'Low Stock (≤3)',    value:lowStock.length,     color:'#F97316' },
              { icon:'🔥', label:'On Sale',           value:onSale.length,       color:'#EC4899' },
            ].map(s => (
              <div key={s.label} className="p-3 rounded-xl text-center"
                style={{ background:'var(--viro-bgDeep)' }}>
                <div className="text-lg">{s.icon}</div>
                <div className="text-base font-extrabold" style={{ color:s.color }}>{s.value}</div>
                <div className="text-xs" style={{ color:'var(--viro-textSub)' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span style={{ color:'var(--viro-textSub)' }}>Total stock units</span>
            <span className="font-bold" style={{ color:'#00BFFF' }}>{totalStock.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color:'var(--viro-textSub)' }}>Est. stock value</span>
            <span className="font-bold" style={{ color:'#10B981' }}>{fmtRs(stockValue)}</span>
          </div>
          {(outOfStock.length > 0 || lowStock.length > 0) && (
            <div className="mt-3 p-3 rounded-xl" style={{ background:'#EF444410',border:'1px solid #EF444430' }}>
              <p className="text-xs font-bold mb-2" style={{ color:'#EF4444' }}>⚠️ Needs Attention</p>
              {[...outOfStock.slice(0,2), ...lowStock.slice(0,2)].map(p => (
                <div key={p.id} className="flex justify-between text-xs py-0.5">
                  <span className="truncate flex-1 mr-2" style={{ color:'var(--viro-text)' }}>{p.name}</span>
                  <span className="font-bold flex-shrink-0"
                    style={{ color:(p.stock||0)===0?'#EF4444':'#F97316' }}>
                    {(p.stock||0)===0?'OUT':`${p.stock} left`}
                  </span>
                </div>
              ))}
              <div className="mt-2 flex flex-wrap gap-1">
                {[...outOfStock.slice(0,2),...lowStock.slice(0,2)].map(p => (
                  <button type="button" key={p.id} onClick={() => onNavigate?.('Products',{type:'product_search',name:p.name})}
                    style={{ fontSize:9,padding:'2px 6px',borderRadius:6,background:'#8B5CF618',
                      color:'#A78BFA',border:'1px solid #8B5CF630',cursor:'pointer' }}>
                    {p.name.slice(0,20)}… →
                  </button>
                ))}
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* ── Recent orders table ── */}
      <Section title={`🕐 Recent Orders (${orders.length} in period)`}>
        {orders.length === 0
          ? <p className="text-sm py-6 text-center" style={{ color:'var(--viro-textSub)' }}>No orders in selected period</p>
          : (
            <>
              <div className="overflow-x-auto">
                <table style={{ width:'100%',borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid var(--viro-border)' }}>
                      {['#','Customer','City','Amount','Status','Payment','Source','Date'].map(h => (
                        <th key={h} style={{ padding:'6px 8px',textAlign:'left',fontSize:9,fontWeight:900,
                          textTransform:'uppercase',letterSpacing:1,color:'var(--viro-textSub)',whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...orders].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,15).map(o => {
                      const sc = STATUS_COLOR[o.status]||'#94A3B8'
                      const isPre = o.payment_method && o.payment_method!=='COD'
                      return (
                        <tr key={o.id} style={{ borderBottom:'1px solid var(--viro-border)' }}
                          className="cursor-pointer"
                          onClick={()=>onNavigate?.('Orders',o.id)}
                          onMouseEnter={e=>e.currentTarget.style.background='var(--viro-bgDeep)'}
                          onMouseLeave={e=>e.currentTarget.style.background=''}>
                          <td style={{ padding:'6px 8px',fontFamily:'monospace',fontSize:10,color:'#A78BFA',whiteSpace:'nowrap' }}>
                            #{o.id?.slice(0,8).toUpperCase()}
                          </td>
                          <td style={{ padding:'6px 8px',fontWeight:600,color:'var(--viro-text)',whiteSpace:'nowrap' }}>
                            {o.customers?.name||'—'}
                            {o.customers?.auth_user_id && <span style={{ marginLeft:4,fontSize:8,color:'#10B981' }}>🟢</span>}
                          </td>
                          <td style={{ padding:'6px 8px',color:'var(--viro-textSub)',fontSize:11 }}>{o.customers?.city||'—'}</td>
                          <td style={{ padding:'6px 8px',fontWeight:700,color:'#10B981',whiteSpace:'nowrap' }}>Rs.{o.final_total?.toLocaleString()}</td>
                          <td style={{ padding:'6px 8px',whiteSpace:'nowrap' }}>
                            <span style={{ fontSize:9,fontWeight:800,padding:'2px 6px',borderRadius:10,
                              background:sc+'20',color:sc,border:`1px solid ${sc}40` }}>{o.status}</span>
                          </td>
                          <td style={{ padding:'6px 8px',whiteSpace:'nowrap' }}>
                            {isPre
                              ? <span style={{ fontSize:9,fontWeight:800,padding:'2px 6px',borderRadius:10,
                                  background:o.payment_status==='PAID'?'#10B98120':'#F9731620',
                                  color:o.payment_status==='PAID'?'#10B981':'#F97316',
                                  border:`1px solid ${o.payment_status==='PAID'?'#10B98140':'#F9731640'}` }}>
                                  💳 {o.payment_status==='PAID'?'✅ Paid':'⏳ Pending'}
                                </span>
                              : <span style={{ fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:10,
                                  background:'#8B5CF618',color:'#A78BFA',border:'1px solid #8B5CF640' }}>💵 COD</span>
                            }
                          </td>
                          <td style={{ padding:'6px 8px',whiteSpace:'nowrap' }}>
                            {(() => {
                              const SRC = { instagram:{icon:'📷',color:'#E11341'}, facebook:{icon:'👍',color:'#1877F2'}, direct:{icon:'🌐',color:'var(--viro-textSub)'} }
                              const s = SRC[o.source] || SRC.direct
                              return <span style={{ fontSize:9,fontWeight:800,padding:'2px 6px',borderRadius:10, background:`${s.color}18`, color:s.color, border:`1px solid ${s.color}40` }}>{s.icon} {o.source ? (o.source.charAt(0).toUpperCase()+o.source.slice(1)) : 'Direct'}</span>
                            })()}
                          </td>
                          <td style={{ padding:'6px 8px',fontSize:10,color:'var(--viro-textSub)',whiteSpace:'nowrap' }}>
                            {fmtDate(o.created_at)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {orders.length > 15 && (
                <button type="button" onClick={()=>onNavigate?.('Orders')}
                  className="w-full mt-3 py-2 rounded-xl text-xs font-bold"
                  style={{ background:'var(--viro-bgDeep)',color:'#8B5CF6',border:'1px solid #8B5CF640',cursor:'pointer' }}>
                  View all {orders.length} orders →
                </button>
              )}
            </>
          )
        }
      </Section>

      {/* ── Wishlist & Cart Interest Section ── */}
      <Section title="🛒 Cart & ♥ Wishlist Insights" subtitle="What customers are saving and buying — demand signals">
        {(() => {
          const [wishCartFilter, setWishCartFilter] = React.useState('combined') // 'combined'|'cart'|'wishlist'
          const [sourceFilter, setSourceFilter] = React.useState('all') // 'all'|'instagram'|'facebook'|'direct' — which traffic source box is active
          const [expandedDay, setExpandedDay] = React.useState(null) // which 'By day' row is drilled into, e.g. '2026-07-05'
          const [expandedSession, setExpandedSession] = React.useState(null) // which session_id is drilled into within a day
          const cartMap = Object.fromEntries(cartData.map(r => [r.product_id, r]))
          const wishMap = Object.fromEntries(wishlistData.map(r => [r.product_id, r]))
          const allIds = [...new Set([...cartData.map(r=>r.product_id), ...wishlistData.map(r=>r.product_id)])]
          const combined = allIds.map(id => ({
            id, name: cartMap[id]?.product_name || wishMap[id]?.product_name || id,
            cart: cartMap[id]?.in_cart_qty || 0,
            sessions: cartMap[id]?.cart_sessions || 0,
            wishlist: wishMap[id]?.wishlist_count || 0,
            score: (cartMap[id]?.in_cart_qty || 0)*2 + (wishMap[id]?.wishlist_count || 0),
          })).sort((a,b) => b.score - a.score)

          const displayed = wishCartFilter === 'cart'
            ? combined.filter(p=>p.cart>0).sort((a,b)=>b.cart-a.cart)
            : wishCartFilter === 'wishlist'
              ? combined.filter(p=>p.wishlist>0).sort((a,b)=>b.wishlist-a.wishlist)
              : combined.slice(0,12)

          const totalCartUnits = cartData.reduce((s,r)=>s+r.in_cart_qty,0)
          // FIXED: this used to be cartData.reduce((s,r)=>s+r.cart_sessions,0) — summing
          // each PRODUCT's session count. A single shopper with 7 different products in
          // their cart got counted 7 times toward this total. What actually answers
          // "how many shoppers have something in a cart" is the number of unique
          // identities (customer_id, or session_id for guests) — exactly what
          // cartByCustomer already computes one row per person for.
          const totalShoppers = cartByCustomer.length > 0
            ? cartByCustomer.length
            : new Set(cartDetail.map(r => r.customer_id || r.session_id)).size
          const totalWish      = wishlistData.reduce((s,r)=>s+r.wishlist_count,0)

          // cartData comes from product_cart_counts view (may be empty if view has stale data)
          // cartDetail comes from raw cart_items rows directly — use it as fallback
          // to check if there's ANY cart data at all
          const hasAnyCartData = cartData.length > 0 || cartDetail.length > 0

          if (allIds.length === 0 && !hasAnyCartData) return (
            <div style={{ textAlign:'center', padding:'40px 0' }}>
              <div style={{ fontSize:40, marginBottom:10 }}>📊</div>
              <p style={{ fontSize:14, fontWeight:700, color:'var(--viro-text)', margin:0 }}>No data yet</p>
              <p style={{ fontSize:12, color:'var(--viro-textSub)', margin:'6px 0 0' }}>Appears as customers browse, wishlist, and add to cart</p>
              <p style={{ fontSize:11, color:'var(--viro-textSub)', margin:'4px 0 0', opacity:0.6 }}>
                Cart writes activate after deploying the latest code and adding items to cart
              </p>
            </div>
          )

          return (
            <div>
              <style>{`
                .vro-row { cursor:pointer; }
                .vro-row:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(124,58,237,0.12); border-color: #7C3AED50 !important; }
                .vro-tab-btn:hover { opacity: 0.85; }
                .vro-cust-btn:hover { background: rgba(124,58,237,0.06); }
                .vro-prod-link { transition: all 0.15s ease; }
                .vro-prod-link:hover { background: rgba(124,58,237,0.08) !important; border-color: #7C3AED40 !important; transform: translateX(2px); }
                .vro-expand-in { animation: vroExpandIn 0.18s ease-out; }
                @keyframes vroExpandIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
                .vro-select:hover { border-color: #7C3AED60 !important; }
                .vro-select:focus { outline: none; border-color: #7C3AED !important; box-shadow: 0 0 0 3px rgba(124,58,237,0.15); }
              `}</style>
              {/* KPI row */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:16 }}>
                {[
                  { icon:'🛒', label:'Products in Carts', value:cartData.length, sub:`${totalCartUnits} units · ${totalShoppers} shoppers`, color:'#7C3AED', bg:'#7C3AED' },
                  { icon:'♥',  label:'Products Wishlisted', value:wishlistData.length, sub:`${totalWish} total saves`, color:'#EC4899', bg:'#EC4899' },
                ].map(k => (
                  <div key={k.label} style={{ padding:'14px', borderRadius:14, background:`linear-gradient(135deg,${k.bg}15,${k.bg}06)`, border:`1px solid ${k.bg}25`, display:'flex', gap:12, alignItems:'center' }}>
                    <div style={{ width:44, height:44, borderRadius:12, background:`${k.bg}20`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{k.icon}</div>
                    <div>
                      <div style={{ fontSize:24, fontWeight:900, color:k.color, lineHeight:1 }}>{k.value}</div>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--viro-textSub)', marginTop:2 }}>{k.label}</div>
                      <div style={{ fontSize:10, color:k.color, fontWeight:600, opacity:0.8, marginTop:1 }}>{k.sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Filter tabs */}
              <div style={{ display:'flex', gap:6, marginBottom:14, background:'var(--viro-bgDeep)', borderRadius:12, padding:4 }}>
                {[
                  { v:'combined', l:'🔥 Combined Interest' },
                  { v:'cart',     l:'🛒 In Carts' },
                  { v:'wishlist', l:'♥ Wishlisted' },
                ].map(tab => (
                  <button type="button" key={tab.v} onClick={() => setWishCartFilter(tab.v)} className="vro-tab-btn"
                    style={{ flex:1, padding:'7px 4px', borderRadius:9, fontSize:11, fontWeight:800, border:'none', cursor:'pointer', transition:'all 0.2s',
                      background: wishCartFilter===tab.v ? 'linear-gradient(135deg,#7C3AED,#4F46E5)' : 'transparent',
                      color: wishCartFilter===tab.v ? '#fff' : 'var(--viro-textSub)',
                    }}>{tab.l}
                  </button>
                ))}
              </div>

              {/* Cart-specific filters — right at the top where the cart view starts,
                  not buried further down. Only relevant to the 'In Carts' tab. */}
              {wishCartFilter === 'cart' && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center', marginBottom:14, padding:'8px 10px', borderRadius:10, background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                  <span style={{ fontSize:10, fontWeight:800, color:'var(--viro-textSub)', textTransform:'uppercase', letterSpacing:'0.03em' }}>Filter</span>
                  <select
                    value={cartDateFilter}
                    onChange={e => setCartDateFilter(e.target.value)}
                    className="vro-select"
                    style={{ fontSize:11, fontWeight:700, padding:'6px 10px', borderRadius:8, border:'1px solid var(--viro-border)', background:'var(--viro-bg,#fff)', color:'var(--viro-text)', cursor:'pointer', transition:'all 0.15s' }}
                  >
                    <option value="all">All time</option>
                    <option value="today">Today</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                  </select>
                  <select
                    value={cartSortBy}
                    onChange={e => setCartSortBy(e.target.value)}
                    className="vro-select"
                    style={{ fontSize:11, fontWeight:700, padding:'6px 10px', borderRadius:8, border:'1px solid var(--viro-border)', background:'var(--viro-bg,#fff)', color:'var(--viro-text)', cursor:'pointer', transition:'all 0.15s' }}
                  >
                    <option value="qty">Sort: Most items</option>
                    <option value="intent">Sort: Very interested first</option>
                    <option value="value">Sort: Highest value</option>
                    <option value="recent">Sort: Most recent</option>
                    <option value="name">Sort: Name</option>
                  </select>
                  {/* BUGFIX: the global "↻ Refresh" button in the admin header
                      only refreshes top-line stat counts — it never reaches
                      this component's own cart data fetch, so cart activity
                      could sit stale indefinitely with no visible way to
                      force a reload. This button calls the exact same fetch
                      this view already uses for its current filter. */}
                  <button type="button"
                    onClick={() => cartDateFilter === 'all' ? fetchAll() : fetchCartWithFilter(cartDateFilter)}
                    disabled={cartFilterLoading}
                    style={{ fontSize:11, fontWeight:700, padding:'6px 12px', borderRadius:8, border:'1px solid var(--viro-border)', background:'var(--viro-bg,#fff)', color:'#8B5CF6', cursor: cartFilterLoading ? 'not-allowed' : 'pointer' }}>
                    {cartFilterLoading ? '⏳' : '↻'} Refresh
                  </button>
                  {cartFilterLoading && <span style={{ fontSize:10, color:'var(--viro-textSub)' }}>Loading…</span>}
                </div>
              )}

              {/* Product list */}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {displayed.length === 0 && (
                  <p style={{ textAlign:'center', fontSize:12, color:'var(--viro-textSub)', padding:'20px 0' }}>No {wishCartFilter} data yet</p>
                )}
                {displayed.map((p, i) => {
                  const maxCart = Math.max(...displayed.map(x=>x.cart),1)
                  const maxWish = Math.max(...displayed.map(x=>x.wishlist),1)
                  const medal   = i===0?'🥇':i===1?'🥈':i===2?'🥉':null
                  const isTop   = i < 3
                  const thumb   = getThumb(productImagesById[p.id], '')
                  return (
                    <a key={p.id} href={`/product/${p.id}`} target="_blank" rel="noopener noreferrer" className="vro-row" style={{
                      display:'block', textDecoration:'none', borderRadius:14, overflow:'hidden',
                      background: 'var(--viro-bgDeep)',
                      border: isTop ? '1px solid #7C3AED20' : '1px solid var(--viro-border)',
                      transition:'all 0.2s',
                    }}>
                      {/* Top gradient accent for top 3 */}
                      {isTop && <div style={{ height:2, background:`linear-gradient(90deg,#7C3AED,#EC4899,#7C3AED)`, opacity: 1-i*0.25 }} />}
                      <div style={{ padding:'10px 12px', display:'flex', alignItems:'center', gap:10 }}>
                        {/* Rank */}
                        <div style={{ width:26, height:26, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                          background: medal ? 'linear-gradient(135deg,#FDE68A,#F59E0B15)' : 'var(--viro-border)' }}>
                          {medal
                            ? <span style={{ fontSize:14 }}>{medal}</span>
                            : <span style={{ fontSize:10, fontWeight:800, color:'var(--viro-textSub)' }}>{i+1}</span>
                          }
                        </div>
                        {/* Thumbnail */}
                        <div style={{ width:36, height:36, borderRadius:8, overflow:'hidden', flexShrink:0, background:'var(--viro-border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {thumb
                            ? <img src={thumb} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            : <span style={{ fontSize:14 }}>📦</span>
                          }
                        </div>
                        {/* Info */}
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ margin:'0 0 2px', fontSize:12, fontWeight:700, color:'var(--viro-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</p>
                          {productPriceById[p.id] > 0 && (
                            <p style={{ margin:'0 0 4px', fontSize:11, fontWeight:700, color:'#10B981' }}>Rs. {productPriceById[p.id].toLocaleString()}</p>
                          )}
                          {/* Cart bar */}
                          {p.cart > 0 && (
                            <div style={{ marginBottom:4 }}>
                              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                                <span style={{ fontSize:9, fontWeight:700, color:'#7C3AED' }}>🛒 {p.cart} unit{p.cart!==1?'s':''} in {p.sessions} cart{p.sessions!==1?'s':''}</span>
                              </div>
                              <div style={{ height:5, borderRadius:3, background:'var(--viro-border)' }}>
                                <div style={{ height:'100%', width:`${Math.round(p.cart/maxCart*100)}%`, borderRadius:3, background:'linear-gradient(90deg,#7C3AED,#4F46E5)', minWidth:4 }} />
                              </div>
                            </div>
                          )}
                          {/* Wishlist bar */}
                          {p.wishlist > 0 && (
                            <div>
                              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                                <span style={{ fontSize:9, fontWeight:700, color:'#EC4899' }}>♥ {p.wishlist} saved</span>
                              </div>
                              <div style={{ height:5, borderRadius:3, background:'var(--viro-border)' }}>
                                <div style={{ height:'100%', width:`${Math.round(p.wishlist/maxWish*100)}%`, borderRadius:3, background:'linear-gradient(90deg,#EC4899,#BE185D)', minWidth:4 }} />
                              </div>
                            </div>
                          )}
                        </div>
                        {/* Score badge */}
                        {wishCartFilter === 'combined' && (
                          <div style={{ flexShrink:0, padding:'4px 8px', borderRadius:8, background: isTop?'linear-gradient(135deg,#7C3AED20,#EC489920)':'var(--viro-border)', textAlign:'center' }}>
                            <div style={{ fontSize:13, fontWeight:900, color: isTop?'#7C3AED':'var(--viro-textSub)' }}>{p.score}</div>
                            <div style={{ fontSize:8, color:'var(--viro-textSub)', fontWeight:600 }}>score</div>
                          </div>
                        )}
                      </div>
                    </a>
                  )
                })}
              </div>

              {/* Conversion tip */}
              {cartData.length > 0 && (
                <div style={{ marginTop:16, padding:'12px 14px', borderRadius:12, background:'linear-gradient(135deg,#F59E0B12,#EAB30808)', border:'1px solid #F59E0B30', display:'flex', gap:10, alignItems:'flex-start' }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>💡</span>
                  <div>
                    <p style={{ margin:0, fontSize:12, fontWeight:800, color:'#D97706' }}>Conversion Opportunity</p>
                    <p style={{ margin:'4px 0 0', fontSize:11, color:'var(--viro-textSub)', lineHeight:1.5 }}>
                      <strong>{cartData.slice(0,2).map(r=>r.product_name).join(' & ')}</strong>
                      {cartData.length > 2 ? ` +${cartData.length-2} more` : ''} are in active carts.
                      Send a WhatsApp nudge or a flash coupon to convert them before they abandon.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Customer-wise ATC breakdown — one block per PERSON, not per product ── */}
              {wishCartFilter === 'cart' && cartByCustomer.length > 0 && (
                <div style={{ marginTop:16 }}>
                  <p style={{ fontSize:13, fontWeight:800, color:'var(--viro-textSub)', textTransform:'uppercase', letterSpacing:'0.04em', margin:'0 0 8px' }}>
                    Customer-wise cart activity
                  </p>
                  {cartFilterLoading && (
                    <p style={{ fontSize:13, color:'var(--viro-textSub)', margin:'0 0 8px' }}>Loading…</p>
                  )}
                  <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
                    {sortedCartByCustomer.map((c) => {
                      // Priority: registered account name > name recovered from a past
                      // guest order placed on the same browser session > plain "Guest"
                      const label = c.name
                        ? c.name
                        : 'Guest'
                      const tag = c.is_registered
                        ? null
                        : (c.has_identity ? '(Unregistered)' : '(No info)')
                      const isOpen = expandedCustomer === c.identity_key
                      const hasProducts = Array.isArray(c.products) && c.products.length > 0
                      const initial = (label || 'G').trim().charAt(0).toUpperCase()
                      const avatarColor = c.is_registered ? '#10B981' : c.has_identity ? '#D97706' : '#94A3B8'
                      const SOURCE_META = {
                        instagram: { icon:'📷', label:'Instagram', color:'#E11341' },
                        facebook:  { icon:'👍', label:'Facebook',  color:'#1877F2' },
                        direct:    { icon:'🌐', label:'Direct',    color:'var(--viro-textSub)' },
                      }
                      const sourceTags = Array.isArray(c.sources) && c.sources.length
                        ? c.sources.map(s => SOURCE_META[s] || SOURCE_META.direct)
                        : [SOURCE_META.direct]
                      return (
                        <div key={c.identity_key} style={{ borderRadius:12, overflow:'hidden', transition:'box-shadow 0.15s',
                          background: c.is_registered ? 'linear-gradient(135deg,#10B98112,#10B98106)' : 'var(--viro-bgDeep)',
                          border: c.is_registered ? '1px solid #10B98130' : '1px solid var(--viro-border)',
                          boxShadow: isOpen ? '0 4px 14px rgba(0,0,0,0.08)' : 'none',
                        }}>
                          <button type="button"
                            onClick={() => hasProducts && setExpandedCustomer(isOpen ? null : c.identity_key)}
                            className="vro-cust-btn"
                            style={{
                              width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10,
                              padding:'10px 12px', background:'none', border:'none', textAlign:'left',
                              cursor: hasProducts ? 'pointer' : 'default', transition:'background 0.15s',
                            }}>
                            <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0, flex:1 }}>
                              {/* Avatar */}
                              <div style={{ width:32, height:32, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                                background:`${avatarColor}22`, color:avatarColor, fontSize:15, fontWeight:800 }}>
                                {initial}
                              </div>
                              <div style={{ minWidth:0, flex:1 }}>
                                <p style={{ margin:0, fontSize:14, fontWeight:800, color:'var(--viro-text)', display:'flex', alignItems:'center', flexWrap:'wrap', gap:5 }}>
                                  <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</span>
                                  {tag && <span style={{ fontWeight:600, color:'var(--viro-textSub)', fontSize:12 }}>{tag}</span>}
                                  {sourceTags.map((s, si) => (
                                    <span key={si} style={{ fontSize:10, fontWeight:700, color:s.color, background:`${s.color}18`, padding:'1px 6px', borderRadius:8, whiteSpace:'nowrap' }}>
                                      {s.icon} {s.label}
                                    </span>
                                  ))}
                                </p>
                                {c.reached_checkout && (() => {
                                  // A checkout attempt only reflects genuine
                                  // CURRENT interest if nothing was added to
                                  // the cart afterward. If the customer kept
                                  // shopping and added more items AFTER that
                                  // checkout attempt, the "reached checkout"
                                  // signal is about an old cart snapshot, not
                                  // this one — showing 🔥 "Very interested"
                                  // for that is misleading (exactly the 5-day-
                                  // old guest case that prompted this: still
                                  // flagged hot despite being long stale).
                                  const isStale = c.latest_added_at && c.checkout_started_at
                                    && new Date(c.latest_added_at) > new Date(c.checkout_started_at)
                                  if (isStale) {
                                    return (
                                      <p style={{ margin:'2px 0 0', fontSize:11, fontWeight:700, color:'var(--viro-textSub)', display:'flex', alignItems:'center', gap:3, flexWrap:'wrap' }}>
                                        🕓 Checked out {fmtTimeAgo(c.checkout_started_at)} — added more to cart since
                                      </p>
                                    )
                                  }
                                  return (
                                    <p style={{ margin:'2px 0 0', fontSize:11, fontWeight:800, color:'#DC2626', display:'flex', alignItems:'center', gap:3, flexWrap:'wrap' }}>
                                      🔥 Very interested — reached checkout
                                      {c.checkout_started_at && (
                                        <span style={{ fontWeight:600, color:'var(--viro-textSub)' }}> · {fmtDateTime(c.checkout_started_at)} ({fmtTimeAgo(c.checkout_started_at)})</span>
                                      )}
                                    </p>
                                  )
                                })()}
                                {(c.phone || c.city || c.email) && (
                                  <p style={{ margin:'2px 0 0', fontSize:12, color:'var(--viro-textSub)' }}>
                                    {[c.phone, c.email, c.city].filter(Boolean).join(' · ')}
                                  </p>
                                )}
                                <p style={{ margin:'2px 0 0', fontSize:12, color:'var(--viro-textSub)' }}>
                                  {c.product_count} product{c.product_count!==1?'s':''}
                                  {c.net_value > 0 && (
                                    <span style={{ fontWeight:700, color:'#10B981' }}> · Rs. {Math.round(c.net_value).toLocaleString()}</span>
                                  )}
                                  {c.latest_added_at && (
                                    <span> · last activity {fmtTimeAgo(c.latest_added_at)}</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                              {whatsappRecoveryEnabled && c.phone && hasProducts && (
                                <a
                                  href={buildCartWhatsAppLink(c)}
                                  target="_blank" rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  title="Send a WhatsApp reminder with their cart items"
                                  style={{
                                    display:'flex', alignItems:'center', justifyContent:'center',
                                    width:30, height:30, borderRadius:'50%', flexShrink:0,
                                    background:'linear-gradient(135deg,#25D366,#128C7E)', color:'#fff', fontSize:14,
                                  }}>
                                  📱
                                </a>
                              )}
                              <div style={{ textAlign:'center', padding:'4px 10px', borderRadius:8,
                                background: c.is_registered ? '#10B98120' : 'var(--viro-border)' }}>
                                <div style={{ fontSize:14, fontWeight:900, color: c.is_registered ? '#10B981' : 'var(--viro-textSub)' }}>{c.total_qty}</div>
                                <div style={{ fontSize:10, fontWeight:700, color:'var(--viro-textSub)' }}>ATC</div>
                              </div>
                              {hasProducts && (
                                <span style={{ fontSize:14, color:'var(--viro-textSub)', transform: isOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▾</span>
                              )}
                            </div>
                          </button>
                          {isOpen && hasProducts && (
                            <div className="vro-expand-in" style={{ padding:'0 10px 10px', display:'flex', flexDirection:'column', gap:5 }}>
                              {[...c.products].sort((a,b) => (b.added_at||'').localeCompare(a.added_at||'')).map((prod, pi) => {
                                const thumb = getThumb(productImagesById[prod.product_id], '')
                                const unitPrice = prod.unit_price ?? productPriceById[prod.product_id] ?? 0
                                const lineTotal = prod.line_total ?? (unitPrice * prod.quantity)
                                return (
                                  <a key={`${prod.product_id}-${pi}`} href={`/product/${prod.product_id}`} target="_blank" rel="noopener noreferrer" className="vro-prod-link"
                                    style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:8,
                                      background:'var(--viro-bg, #fff)', border:'1px solid var(--viro-border)', textDecoration:'none' }}>
                                    <div style={{ width:34, height:34, borderRadius:6, overflow:'hidden', flexShrink:0, background:'var(--viro-border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                      {thumb
                                        ? <img src={thumb} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                        : <span style={{ fontSize:13 }}>📦</span>
                                      }
                                    </div>
                                    <div style={{ flex:1, minWidth:0 }}>
                                      <p style={{ margin:0, fontSize:13, fontWeight:600, color:'var(--viro-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                        {prod.product_name}
                                      </p>
                                      {unitPrice > 0 && (
                                        <p style={{ margin:0, fontSize:12, color:'var(--viro-textSub)' }}>
                                          Rs. {unitPrice.toLocaleString()} × {prod.quantity}
                                          <span style={{ fontWeight:700, color:'#10B981' }}> = Rs. {Math.round(lineTotal).toLocaleString()}</span>
                                        </p>
                                      )}
                                      {prod.added_at && (
                                        <p style={{ margin:'2px 0 0', fontSize:11, color:'var(--viro-textSub)', opacity:0.8 }}>
                                          🕐 {fmtDateTime(prod.added_at)} <span style={{ opacity:0.7 }}>· {fmtTimeAgo(prod.added_at)}</span>
                                        </p>
                                      )}
                                    </div>
                                  </a>
                                )
                              })}
                              <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:2 }}>
                                <p style={{ margin:0, fontSize:13, fontWeight:800, color:'var(--viro-text)' }}>
                                  Total: <span style={{ color:'#10B981' }}>Rs. {Math.round(c.net_value || 0).toLocaleString()}</span>
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Detailed cart breakdown — who has what, from where ── */}
              {wishCartFilter === 'cart' && cartDetail.length > 0 && (() => {
                const igCount = cartDetail.filter(r => r.source === 'instagram').length
                const fbCount = cartDetail.filter(r => r.source === 'facebook').length
                const directCount = cartDetail.length - igCount - fbCount

                // Rows matching the currently selected source box (or everything, if none selected)
                const bySource = sourceFilter === 'all' ? cartDetail
                  : sourceFilter === 'direct' ? cartDetail.filter(r => r.source !== 'instagram' && r.source !== 'facebook')
                  : cartDetail.filter(r => r.source === sourceFilter)

                // Date/time + session breakdown for whatever's currently selected —
                // this is the "total cart by date/time, total sessions" view.
                const sourceStats = (() => {
                  const totalQty = bySource.reduce((s, r) => s + (r.quantity || 1), 0)
                  const uniqueSessions = new Set(bySource.map(r => r.session_id)).size
                  const byDay = {}
                  bySource.forEach(r => {
                    const t = r.updated_at || r.added_at
                    if (!t) return
                    const day = t.slice(0, 10) // YYYY-MM-DD
                    if (!byDay[day]) byDay[day] = { day, qty: 0, sessions: new Set(), rows: [] }
                    byDay[day].qty += r.quantity || 1
                    byDay[day].sessions.add(r.session_id)
                    byDay[day].rows.push(r)
                  })
                  const days = Object.values(byDay)
                    .map(d => ({ day: d.day, qty: d.qty, sessions: d.sessions.size, rows: d.rows.sort((a,b) => (b.added_at||'').localeCompare(a.added_at||'')) }))
                    .sort((a, b) => b.day.localeCompare(a.day))
                    .slice(0, 10)
                  return { totalItems: bySource.length, totalQty, uniqueSessions, days }
                })()

                const sourceBoxes = [
                  { key:'instagram', count:igCount, color:'#E11341', icon:'📷', label:'via Instagram' },
                  { key:'facebook',  count:fbCount, color:'#1877F2', icon:'👍', label:'via Facebook' },
                  { key:'direct',    count:directCount, color:'var(--viro-text)', icon:'🌐', label:'Direct/Other' },
                ]

                // Which sessions/customers reached checkout — used to tag rows
                // in the day drill-down below with the same 🔥 signal shown
                // in the customer-wise block, so it's visible everywhere.
                const reachedCheckoutSessions = new Set(
                  cartByCustomer.filter(c => c.reached_checkout).map(c => c.identity_key)
                )
                const rowReachedCheckout = (r) => {
                  const key = r.customer_id ? `c:${r.customer_id}` : `g:${r.session_id}`
                  return reachedCheckoutSessions.has(key)
                }

                return (
                  <div style={{ marginTop:16 }}>
                    {/* Source split — clickable */}
                    <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                      {sourceBoxes.map(box => {
                        const isActive = sourceFilter === box.key
                        return (
                          <button type="button" key={box.key}
                            onClick={() => setSourceFilter(isActive ? 'all' : box.key)}
                            className="vro-row"
                            style={{
                              flex:1, padding:'8px 10px', borderRadius:10, textAlign:'left', cursor:'pointer',
                              background: isActive ? `${box.color}22` : `${box.color}12`,
                              border: isActive ? `2px solid ${box.color}` : `1px solid ${box.color}30`,
                              transition:'all 0.15s',
                            }}>
                            <p style={{ margin:0, fontSize:14, fontWeight:900, color:box.color }}>{box.count}</p>
                            <p style={{ margin:0, fontSize:9, fontWeight:700, color:'var(--viro-textSub)' }}>{box.icon} {box.label}</p>
                          </button>
                        )
                      })}
                    </div>

                    {/* Date/time + session breakdown for the selected source */}
                    {sourceFilter !== 'all' && (
                      <div className="vro-expand-in" style={{ marginBottom:14, padding:'10px 12px', borderRadius:12, background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                          <p style={{ margin:0, fontSize:11, fontWeight:800, color:'var(--viro-text)' }}>
                            {sourceBoxes.find(b => b.key === sourceFilter)?.icon} {sourceBoxes.find(b => b.key === sourceFilter)?.label} — full breakdown
                          </p>
                          <button type="button" onClick={() => setSourceFilter('all')} style={{ fontSize:10, fontWeight:700, color:'var(--viro-textSub)', background:'none', border:'none', cursor:'pointer' }}>✕ clear</button>
                        </div>
                        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                          <div style={{ flex:1, textAlign:'center', padding:'6px', borderRadius:8, background:'var(--viro-border)' }}>
                            <div style={{ fontSize:15, fontWeight:900, color:'var(--viro-text)' }}>{sourceStats.totalItems}</div>
                            <div style={{ fontSize:8, color:'var(--viro-textSub)', fontWeight:700 }}>cart lines</div>
                          </div>
                          <div style={{ flex:1, textAlign:'center', padding:'6px', borderRadius:8, background:'var(--viro-border)' }}>
                            <div style={{ fontSize:15, fontWeight:900, color:'var(--viro-text)' }}>{sourceStats.totalQty}</div>
                            <div style={{ fontSize:8, color:'var(--viro-textSub)', fontWeight:700 }}>units</div>
                          </div>
                          <div style={{ flex:1, textAlign:'center', padding:'6px', borderRadius:8, background:'var(--viro-border)' }}>
                            <div style={{ fontSize:15, fontWeight:900, color:'var(--viro-text)' }}>{sourceStats.uniqueSessions}</div>
                            <div style={{ fontSize:8, color:'var(--viro-textSub)', fontWeight:700 }}>sessions</div>
                          </div>
                        </div>
                        {sourceStats.days.length > 0 && (
                          <div>
                            <p style={{ margin:'0 0 6px', fontSize:10, fontWeight:700, color:'var(--viro-textSub)', textTransform:'uppercase' }}>By day → session → items</p>
                            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                              {sourceStats.days.map(d => {
                                const dayOpen = expandedDay === d.day
                                return (
                                  <div key={d.day} style={{ borderRadius:8, overflow:'hidden', background:'var(--viro-bg,#fff)', border: dayOpen ? '1px solid #7C3AED40' : '1px solid transparent' }}>
                                    <button type="button" onClick={() => setExpandedDay(dayOpen ? null : d.day)}
                                      style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12, padding:'6px 8px', background:'none', border:'none', cursor:'pointer', textAlign:'left' }}>
                                      <span style={{ fontWeight:700, color:'var(--viro-text)' }}>
                                        {dayOpen ? '▾' : '▸'} {new Date(d.day + 'T00:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                                      </span>
                                      <span style={{ color:'var(--viro-textSub)' }}>{d.qty} units · {d.sessions} session{d.sessions!==1?'s':''}</span>
                                    </button>
                                    {dayOpen && (() => {
                                      // Group this day's rows by session — one guest/customer visit = one session,
                                      // shown as its own drillable row instead of a flat item list.
                                      const bySession = {}
                                      d.rows.forEach(r => {
                                        if (!bySession[r.session_id]) bySession[r.session_id] = {
                                          session_id: r.session_id, customer_id: r.customer_id, customers: r.customers,
                                          rows: [], qty: 0, value: 0,
                                        }
                                        bySession[r.session_id].rows.push(r)
                                        bySession[r.session_id].qty += r.quantity || 1
                                        bySession[r.session_id].value += (productPriceById[r.product_id] || 0) * (r.quantity || 1)
                                      })
                                      const sessions = Object.values(bySession).sort((a,b) => b.qty - a.qty)
                                      return (
                                        <div className="vro-expand-in" style={{ padding:'0 8px 8px', display:'flex', flexDirection:'column', gap:4 }}>
                                          {sessions.map(s => {
                                            const sessionOpen = expandedSession === s.session_id
                                            const sLabel = s.customer_id ? (s.customers?.name || 'Registered') : 'Guest'
                                            return (
                                              <div key={s.session_id} style={{ borderRadius:6, overflow:'hidden', background:'var(--viro-bgDeep)', border: sessionOpen ? '1px solid #7C3AED40' : '1px solid var(--viro-border)' }}>
                                                <button type="button" onClick={() => setExpandedSession(sessionOpen ? null : s.session_id)}
                                                  style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:11, padding:'6px 8px', background:'none', border:'none', cursor:'pointer', textAlign:'left' }}>
                                                  <span style={{ fontWeight:700, color:'var(--viro-text)' }}>
                                                    {sessionOpen ? '▾' : '▸'} {s.customer_id ? '🟢' : '⚪'} {sLabel}
                                                    {rowReachedCheckout(s) && <span style={{ color:'#DC2626', fontWeight:700 }}> 🔥</span>}
                                                  </span>
                                                  <span style={{ color:'var(--viro-textSub)' }}>{s.rows.length} item{s.rows.length!==1?'s':''} · Rs. {Math.round(s.value).toLocaleString()}</span>
                                                </button>
                                                {sessionOpen && (
                                                  <div className="vro-expand-in" style={{ padding:'0 6px 6px', display:'flex', flexDirection:'column', gap:4 }}>
                                                    {s.rows.map((r, ri) => (
                                                      <a key={`${r.id || r.product_id}-${ri}`} href={`/product/${r.product_id}`} target="_blank" rel="noopener noreferrer" className="vro-prod-link"
                                                        style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:6, background:'var(--viro-bg,#fff)', border:'1px solid var(--viro-border)', textDecoration:'none' }}>
                                                        <div style={{ width:26, height:26, borderRadius:5, overflow:'hidden', flexShrink:0, background:'var(--viro-border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                                          {(() => { const t = getThumb(r.products?.images, ''); return t ? <img src={t} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ fontSize:11 }}>📦</span> })()}
                                                        </div>
                                                        <div style={{ flex:1, minWidth:0 }}>
                                                          <p style={{ margin:0, fontSize:12, fontWeight:600, color:'var(--viro-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                                            {r.products?.name || 'Product'} <span style={{ color:'var(--viro-textSub)', fontWeight:500 }}>×{r.quantity}</span>
                                                            {(r.selected_color_name || r.selected_size_name) && (
                                                              <span style={{ marginLeft:6, padding:'1px 6px', borderRadius:999, fontSize:9, fontWeight:800, background:'#8B5CF620', color:'#8B5CF6' }}>
                                                                {[r.selected_color_name, r.selected_size_name].filter(Boolean).join(' / ')}
                                                              </span>
                                                            )}
                                                          </p>
                                                          <p style={{ margin:0, fontSize:10, color:'var(--viro-textSub)' }}>
                                                            {fmtDateTime(r.updated_at || r.added_at)} · {fmtTimeAgo(r.updated_at || r.added_at)}
                                                          </p>
                                                        </div>
                                                      </a>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      )
                                    })()}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <p style={{ fontSize:11, fontWeight:800, color:'var(--viro-textSub)', textTransform:'uppercase', letterSpacing:'0.04em', margin:'0 0 8px' }}>
                      Who has items in cart {sourceFilter !== 'all' && <span style={{ fontWeight:600, textTransform:'none' }}>— filtered</span>}
                    </p>

                    <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:420, overflowY:'auto' }}>
                      {bySource.map((row, idx) => {
                        // Plain <img>, NOT next/image — this is a deliberate choice for
                        // this admin analytics view specifically. next/image runs every
                        // new image through Vercel's optimizer, which has a monthly
                        // request quota (see the earlier 402 Payment Required issue);
                        // an admin-only list of up to 200 small thumbnails is exactly
                        // the kind of place that quota gets burned for no real benefit
                        // — nobody but you sees this page, so there's nothing to gain
                        // from resizing/WebP-converting it, only quota to lose.
                        const thumb = getThumb(row.products?.images, '')
                        const isGuest = !row.customer_id
                        // Enrich an anonymous cart with whatever they've typed at
                        // checkout so far (even if they never placed an order) —
                        // previously this was always a blank "Guest" with zero
                        // way to tell shoppers apart or follow up with them.
                        const checkoutInfo = isGuest ? checkoutSessionMap[row.session_id] : null
                        const who = isGuest
                          ? (checkoutInfo?.name || 'Guest')
                          : (row.customers?.name || 'Account holder')
                        const sourceTag = row.source === 'instagram' ? '📷 IG'
                          : row.source === 'facebook' ? '👍 FB' : null

                        return (
                          <a key={`${row.session_id}-${row.product_id}-${idx}`}
                            href={row.products?.id ? `/product/${row.products.id}` : undefined}
                            target="_blank" rel="noopener noreferrer"
                            style={{
                              display:'flex', alignItems:'center', gap:10, padding:'8px 10px',
                              borderRadius:10, background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)',
                              textDecoration:'none', cursor: row.products?.id ? 'pointer' : 'default',
                            }}>
                            <div style={{ width:36, height:36, borderRadius:8, overflow:'hidden', flexShrink:0, background:'var(--viro-border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                              {thumb
                                ? <img src={thumb} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                : <span style={{ fontSize:14 }}>📦</span>
                              }
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <p style={{ margin:0, fontSize:11, fontWeight:700, color:'var(--viro-text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                                {row.products?.name || 'Unknown product'} <span style={{ color:'var(--viro-textSub)', fontWeight:500 }}>×{row.quantity}</span>
                                {(row.selected_color_name || row.selected_size_name) && (
                                  <span style={{ marginLeft:5, padding:'1px 5px', borderRadius:999, fontSize:9, fontWeight:800, background:'#8B5CF620', color:'#8B5CF6' }}>
                                    {[row.selected_color_name, row.selected_size_name].filter(Boolean).join(' / ')}
                                  </span>
                                )}
                              </p>
                              <p style={{ margin:0, fontSize:10, color:'var(--viro-textSub)' }}>
                                {isGuest
                                  ? (checkoutInfo
                                      ? <span style={{ color:'#F59E0B', fontWeight:700 }}>🟡 {who}</span>
                                      : <span style={{ color:'#94A3B8', fontWeight:700 }}>⚪ Guest</span>)
                                  : <span style={{ color:'#10B981', fontWeight:700 }}>🟢 {who}</span>}
                                {isGuest && checkoutInfo?.phone && ` · ${checkoutInfo.phone}`}
                                {!isGuest && row.customers?.phone && ` · ${row.customers.phone}`}
                                {!isGuest && row.customers?.city && ` · ${row.customers.city}`}
                                {sourceTag && <span style={{ marginLeft:6 }}>{sourceTag}</span>}
                              </p>
                              {(row.updated_at || row.added_at) && (
                                <p style={{ margin:'2px 0 0', fontSize:9, color:'var(--viro-textMuted)' }}>
                                  🕐 {fmtDateTime(row.updated_at || row.added_at)} · {fmtTimeAgo(row.updated_at || row.added_at)}
                                </p>
                              )}
                            </div>
                          </a>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          )
        })()}
      </Section>

    </div>
  )
}