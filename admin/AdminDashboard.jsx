'use client'
import Portal from './Portal'
import { supabase } from '../lib/supabase'
/* eslint-disable @next/next/no-img-element */
import React, { useState, useCallback, useEffect } from 'react'
import { sendOrderPush } from '../lib/pushNotify'
import { adminApi } from '../lib/adminApi'
import Toast, { showSimpleToast } from '../components/Toast'
import { useTheme } from '../context/ThemeContext'
import { _ORDER_STATUSES, ORDER_STATUS_META } from '../lib/constants'
import { isoToLocalInput, localDateToISO, adminConfirm } from './adminUtils'
import AdminConfirmDialog from './AdminConfirmDialog'
import ImageUploader from './ImageUploader'
import ProductVariantsEditor from './ProductVariantsEditor'
import ProductsTab from './ProductsTab'
import OrdersTab from './OrdersTab'
import AnalyticsDashboard from './AnalyticsDashboard'
import CategoriesTab from './CategoriesTab'
import SiteSettingsTab from './SiteSettingsTab'
import DealBoxTab from './DealBoxTab'
import CustomersTab from './CustomersTab'
import AnalyticsTab from './AnalyticsTab'
import AnalyticsModal from './AnalyticsModal'
import CouponsTab from './CouponsTab'
import InfluencersTab from './InfluencersTab'
import ReviewsTab from './ReviewsTab'
import CheckoutActivityTab from './CheckoutActivityTab'

// ── "Complete the Set" — pick 1-2 complementary products for this one ──
function PairsWithPicker({ selectedIds, onChange, allProducts, currentProductId, categories }) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  // Mirrors the same light/dark palette AdminDashboard itself uses (cardBg/cardBdr/
  // textPrimary/textMuted below) — the previous version hardcoded dark-theme hex
  // values, which is why text nearly disappeared against the light admin theme.
  const cBg     = isLight ? '#FFFFFF' : '#1E293B'
  const cBdr    = isLight ? '#E2E8F0' : '#334155'
  const cBgDeep = isLight ? '#F8FAFC' : '#0F172A'
  const tPrimary = isLight ? '#0F172A' : '#F1F5F9'
  const tMuted   = isLight ? '#475569' : '#94A3B8'
  const tSub     = isLight ? '#94A3B8' : '#64748B'

  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState(null)   // 'newest'|'cheapest'|'expensive'|'discount'|null
  const [catFilter, setCatFilter] = useState(null) // category id or null (= all)
  const MAX_LINKED = 5
  const cats = categories || []
  const pool = allProducts.filter(p => p.id !== currentProductId && (p.is_active || p.status === 'coming_soon'))

  // Preserve the admin-chosen order exactly — this becomes the display
  // order in the storefront's thumbnail row and checklist, so ordering
  // here IS the "arranging" step, not just bookkeeping.
  const selected = selectedIds.map(id => allProducts.find(p => p.id === id)).filter(Boolean)

  function toggleOne(id) {
    if (selectedIds.includes(id)) { onChange(selectedIds.filter(x => x !== id)); return }
    if (selectedIds.length >= MAX_LINKED) { showSimpleToast(`Max ${MAX_LINKED} linked products — keep it focused`, 'info'); return }
    onChange([...selectedIds, id])
  }
  function removeProduct(id) {
    onChange(selectedIds.filter(x => x !== id))
  }

  function thumbOf(p) {
    try { const imgs = typeof p.images === 'string' ? JSON.parse(p.images) : p.images; return (Array.isArray(imgs) ? imgs[0] : imgs) || '/logo.jpg' }
    catch { return '/logo.jpg' }
  }

  // Filters/sort chips act on the browse list below — they don't add anything
  // by themselves. Pick a sort and/or a category, then tick the checkboxes for
  // whichever of the (now filtered & sorted) products actually belong here.
  let filteredPool = pool.filter(p => !query.trim() || p.name?.toLowerCase().includes(query.trim().toLowerCase()))
  if (catFilter) {
    const childIds = cats.filter(c => c.parent_id === catFilter).map(c => c.id)
    filteredPool = filteredPool.filter(p => p.category_id === catFilter || childIds.includes(p.category_id))
  }
  if (sortBy === 'discount') filteredPool = filteredPool.filter(p => p.discount_price && Number(p.discount_price) < Number(p.price))
  filteredPool = [...filteredPool]
  if (sortBy === 'cheapest')  filteredPool.sort((a, b) => Number(a.price) - Number(b.price))
  if (sortBy === 'expensive') filteredPool.sort((a, b) => Number(b.price) - Number(a.price))
  if (sortBy === 'newest')    filteredPool.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  if (sortBy === 'discount')  filteredPool.sort((a, b) => (1 - b.discount_price / b.price) - (1 - a.discount_price / a.price))

  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: tMuted }}>
        🛍️ Frequently Bought Together <span className="normal-case font-normal" style={{ color: tSub }}>(shown on this product's page only — linking is one-directional; adding this product to B's list here does not add B to this product's list)</span>
      </label>
      <p className="text-xs mb-2" style={{ color: tSub }}>
        Pick up to {MAX_LINKED} products that genuinely go with this one ({selectedIds.length}/{MAX_LINKED} selected). Drag chips below to set the order they appear in — first item shown first.
      </p>

      {/* Filter/sort the browse list below — these narrow down what you see,
          they never add anything on their own. Tick a checkbox to actually link. */}
      <div className="mb-2.5 p-2.5 rounded-xl" style={{ background: cBgDeep, border: `1px solid ${cBdr}` }}>
        <p className="text-xs font-extrabold uppercase tracking-wide mb-2" style={{ color: tMuted, letterSpacing: '0.06em' }}>🔎 Filter &amp; Sort the list below</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {[['🆕 Newest', 'newest'], ['💸 Lowest Price', 'cheapest'], ['💎 Highest Price', 'expensive'], ['🔥 Max Discount', 'discount']].map(([label, s]) => {
            const active = sortBy === s
            return (
              <button key={s} type="button" onClick={() => setSortBy(active ? null : s)}
                className="text-xs font-bold px-2.5 py-1 rounded-lg transition-colors"
                style={active
                  ? { background: '#8B5CF6', color: '#fff', border: '1px solid #8B5CF6' }
                  : { background: '#6366f115', color: '#8B5CF6', border: '1px solid #6366f130' }}>
                {label}
              </button>
            )
          })}
        </div>
        {cats.filter(c => !c.parent_id).length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs font-bold flex-shrink-0" style={{ color: tMuted }}>BY CATEGORY:</span>
            {cats.filter(c => !c.parent_id).slice(0, 8).map(cat => {
              const active = catFilter === cat.id
              return (
                <button key={cat.id} type="button" onClick={() => setCatFilter(active ? null : cat.id)}
                  className="text-xs font-bold px-2 py-1 rounded-lg transition-colors"
                  style={active
                    ? { background: '#F97316', color: '#fff', border: '1px solid #F97316' }
                    : { background: '#F9731610', color: '#F97316', border: '1px solid #F9731630' }}>
                  {cat.icon} {cat.name}
                </button>
              )
            })}
          </div>
        )}
        {(sortBy || catFilter || selectedIds.length > 0) && (
          <div className="flex flex-wrap gap-2 mt-2">
            {(sortBy || catFilter) && (
              <button type="button" onClick={() => { setSortBy(null); setCatFilter(null) }}
                className="text-xs font-semibold px-2 py-1 rounded-md"
                style={{ background: 'transparent', color: tMuted, border: `1px solid ${cBdr}` }}>
                ✕ Reset filters
              </button>
            )}
            {selectedIds.length > 0 && (
              <button type="button" onClick={() => onChange([])}
                className="text-xs font-semibold px-2 py-1 rounded-md"
                style={{ background: 'transparent', color: '#EF4444', border: '1px solid #EF444430' }}>
                ✕ Clear all linked products
              </button>
            )}
          </div>
        )}
      </div>

      {/* Selected chips — drag to reorder */}
      {selected.length > 0 && (
        <>
          <p className="text-xs font-bold mb-1.5" style={{ color: tMuted }}>↕️ Drag chips to reorder — this is the order shown on the product page</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {selected.map((p, chipIdx) => (
              <div key={p.id}
                draggable
                onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(chipIdx)) }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  const fromIdx = Number(e.dataTransfer.getData('text/plain'))
                  if (Number.isNaN(fromIdx) || fromIdx === chipIdx) return
                  const ids = [...selectedIds]
                  const [moved] = ids.splice(fromIdx, 1)
                  ids.splice(chipIdx, 0, moved)
                  onChange(ids)
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-xl text-xs font-medium"
                style={{ background: '#EC489915', border: '1px solid #EC489940', color: tPrimary, cursor: 'grab' }}>
                <span style={{ color: tMuted, fontSize: 10, cursor: 'grab' }}>⠿</span>
                <img src={thumbOf(p)} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" onError={e => { e.target.src = '/logo.jpg' }} />
                <span style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <button type="button" onClick={() => removeProduct(p.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 11, lineHeight: 1, padding: 0, marginLeft: 2 }}>✕</button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Search box */}
      <div className="relative mb-2">
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="🔍 Search products by name…" className="w-full" />
        {query && (
          <button type="button" onClick={() => setQuery('')}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: tMuted, fontSize: 14 }}>✕</button>
        )}
      </div>

      {/* Scrollable checkbox list — browse and multi-select, filtered/sorted by the chips above */}
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${cBdr}`, maxHeight: 260, overflowY: 'auto', background: cBg }}>
        {filteredPool.length === 0 && (
          <p className="text-xs p-3 text-center" style={{ color: tMuted }}>
            {pool.length === 0 ? 'Loading products…' : 'No products match these filters'}
          </p>
        )}
        {filteredPool.map(p => {
          const isOn = selectedIds.includes(p.id)
          const disabled = !isOn && selectedIds.length >= MAX_LINKED
          const hasDiscount = p.discount_price && Number(p.discount_price) < Number(p.price)
          return (
            <div key={p.id} onClick={() => !disabled && toggleOne(p.id)}
              className="flex items-center gap-3 px-3 py-2"
              style={{ background: isOn ? '#8B5CF612' : 'transparent', borderBottom: `1px solid ${cBdr}`,
                cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1 }}>
              <div className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs"
                style={{ background: isOn ? '#8B5CF6' : cBgDeep, border: `1.5px solid ${isOn ? '#8B5CF6' : cBdr}`, color: '#fff' }}>
                {isOn ? '✓' : ''}
              </div>
              <img src={thumbOf(p)} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" onError={e => { e.target.src = '/logo.jpg' }} />
              <span className="text-xs font-medium flex-1" style={{ color: tPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
              </span>
              <span className="text-xs font-bold flex-shrink-0" style={{ color: hasDiscount ? '#8B5CF6' : tMuted }}>
                Rs.{Math.round(p.discount_price && hasDiscount ? p.discount_price : p.price).toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AdminDashboard({ adminUser, onLogout, onLogoutEverywhere }) {
  // Fix: theme must be pulled here so isLight derived vars have it in scope
  const { theme } = useTheme()

  // ── Logout helpers: always clear localStorage + cookie before calling parent ──
  function doLogout() {
    localStorage.removeItem('viro_admin_token')
    localStorage.removeItem('viro_admin_user')
    fetch('/api/admin/logout', { method: 'POST' }).catch(() => {})
    onLogout()
  }
  function doLogoutEverywhere() {
    localStorage.removeItem('viro_admin_token')
    localStorage.removeItem('viro_admin_user')
    fetch('/api/admin/logout', { method: 'POST' }).catch(() => {})
    onLogoutEverywhere()
  }
  const [loadingProducts, _setLoadingProducts] = useState(false)
  const [tab, setTab]               = useState('Analytics')
  const [orderSearch,       setOrderSearch]       = useState('')
  const [extOrderStatus,    setExtOrderStatus]    = useState('')   // filter Orders by status
  const [extProductSearch,  setExtProductSearch]  = useState('')   // filter Products by name
  const [prevTab, setPrevTab]         = useState('Products')
  const [tabHistory, setTabHistory]   = useState(['Analytics'])
  const [historyIdx, setHistoryIdx]   = useState(0)

  // Navigate to a tab and push to history
  function goToTab(newTab) {
    if (newTab === tab) return
    const newHistory = tabHistory.slice(0, historyIdx + 1)
    newHistory.push(newTab)
    setTabHistory(newHistory)
    setHistoryIdx(newHistory.length - 1)
    setPrevTab(tab)
    // Only reset form when leaving Add Product tab to avoid triggering image deletion
    if (tab === 'Add Product') setEditProduct(null)
    setTab(newTab)
  }
  function goBack() {
    if (historyIdx <= 0) return
    const newIdx = historyIdx - 1
    setHistoryIdx(newIdx)
    setTab(tabHistory[newIdx])
  }
  function goForward() {
    if (historyIdx >= tabHistory.length - 1) return
    const newIdx = historyIdx + 1
    setHistoryIdx(newIdx)
    setTab(tabHistory[newIdx])
  }
  const [pendingReviewCount, setPendingReviewCount] = useState(0)
  const [products, setProducts]     = useState([])
  const [orders, setOrders]         = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading]       = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [stats, setStats]           = useState({ products: 0, orders: 0, revenue: 0, unpaid: 0, googleUsers: 0, guestUsers: 0, totalCustomers: 0 })
  const [todayStats, setTodayStats] = useState({ orders: 0, revenue: 0, delivered: 0, cancelled: 0, topProduct: null, avgOrder: 0 })
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [analyticsType, setAnalyticsType] = useState("revenue")

  const emptyForm = { name: '', description: '', highlights: '', product_details: '', price: '', discount_price: '', stock: '', images: [], is_active: true, status: 'active', category_id: '', search_keywords: '', pairs_with_ids: [], launch_at: '', sale_ends_at: '', sale_active: false, countdown_label: 'Deal Ends In', show_order_count: false, meta_title: '', meta_description: '', meta_keywords: '', og_title: '', og_description: '', canonical_url: '', schema_brand: '', schema_condition: 'NewCondition', noindex: false, has_sizes: false, has_colors: false, sizes: [], colors: [], colorSizeMatrix: {}, auto_hide_oos: false }
  const [form, setForm] = useState(emptyForm)
  const [seoOpen, setSeoOpen] = useState(false)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('products').select('*, categories(id,name,icon)').order('created_at', { ascending: false })
    if (!data) { setProducts([]); setLoading(false); return }

    // Also fetch variant data for all products so Edit form loads existing sizes/colors
    const ids = data.map(p => p.id)
    let sizesMap = {}, colorsMap = {}, matrixMap = {}

    try {
      const [sizesRes, colorsRes, matrixRes] = await Promise.all([
        supabase.from('product_sizes').select('*').in('product_id', ids).order('sort_order'),
        supabase.from('product_colors').select('*').in('product_id', ids).order('sort_order'),
        supabase.from('product_color_size_stock').select('product_id,color_id,size_id,stock').in('product_id', ids),
      ])
      for (const s of (sizesRes.data || [])) {
        if (!sizesMap[s.product_id]) sizesMap[s.product_id] = []
        sizesMap[s.product_id].push(s)
      }
      for (const c of (colorsRes.data || [])) {
        if (!colorsMap[c.product_id]) colorsMap[c.product_id] = []
        colorsMap[c.product_id].push(c)
      }
      for (const m of (matrixRes.data || [])) {
        if (!matrixMap[m.product_id]) matrixMap[m.product_id] = {}
        matrixMap[m.product_id][`${m.color_id}:${m.size_id}`] = m.stock
      }
    } catch {}

    const enriched = data.map(p => ({
      ...p,
      sizes:           sizesMap[p.id]  || [],
      colors:          colorsMap[p.id] || [],
      colorSizeMatrix: matrixMap[p.id] || {},
    }))
    setProducts(enriched)
    setLoading(false)
  }, [])

  const loadCategories = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('sort_order')
    setCategories(data || [])
  }, [])

  const loadOrders = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, customers(*, auth_user_id, email, gender, date_of_birth), order_items(*, products(id, name, images)), original_subtotal, sale_discount, coupon_discount, coupon_code, discount_type, delivery_charges, final_total, total_price')
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }, [])

  const loadStats = useCallback(async () => {
    const [{ count: pCount }, { count: oCount }, { data: rev }, { count: unpaid }, { data: custLogin }] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('final_total').neq('status', 'CANCELLED'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'UNPAID'),
      supabase.from('customers').select('auth_user_id'),
    ])
    const revenue    = (rev || []).reduce((s, o) => s + (o.final_total || 0), 0)
    const googleCount = (custLogin || []).filter(c => !!c.auth_user_id).length
    const guestCount  = (custLogin || []).length - googleCount
    setStats({ products: pCount || 0, orders: oCount || 0, revenue, unpaid: unpaid || 0, googleUsers: googleCount, guestUsers: guestCount, totalCustomers: (custLogin||[]).length })
  }, [])

  const loadTodayStats = useCallback(async () => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const iso = todayStart.toISOString()

    const { data: todayOrders } = await supabase
      .from('orders')
      .select('final_total, status, order_items(quantity, products(name))')
      .gte('created_at', iso)

    if (!todayOrders?.length) { setTodayStats({ orders: 0, revenue: 0, delivered: 0, cancelled: 0, topProduct: null, avgOrder: 0 }); return }

    const active    = todayOrders.filter(o => o.status !== 'CANCELLED')
    const revenue   = active.reduce((s, o) => s + (o.final_total || 0), 0)
    const delivered = todayOrders.filter(o => o.status === 'DELIVERED').length
    const cancelled = todayOrders.filter(o => o.status === 'CANCELLED').length
    const avgOrder  = active.length ? Math.round(revenue / active.length) : 0

    // Find top product by quantity sold today
    const productQty = {}
    todayOrders.forEach(o => o.order_items?.forEach(item => {
      const name = item.products?.name || 'Unknown'
      productQty[name] = (productQty[name] || 0) + (item.quantity || 1)
    }))
    const topProduct = Object.entries(productQty).sort((a, b) => b[1] - a[1])[0]?.[0] || null

    setTodayStats({ orders: todayOrders.length, revenue, delivered, cancelled, topProduct, avgOrder })
  }, [])

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    loadStats()
    loadTodayStats()
    loadCategories()
    if (tab === 'Products') loadProducts()
    if (tab === 'Orders')   loadOrders()
    supabase.from('reviews').select('id', { count:'exact', head:true }).eq('status','pending').then(({ count }) => setPendingReviewCount(count || 0))
  }, [tab])
  /* eslint-enable react-hooks/exhaustive-deps */

  function resetForm(cancelledForm = null) {
    setFormSaving(false)
    setShowDiscount(false)
    // When cancelling an ADD (not edit), delete any uploaded images
    // so orphaned files don't accumulate in Supabase storage
    const isNewProduct = !editProduct
    const imgs = (cancelledForm || form)?.images || []
    if (isNewProduct && imgs.length > 0) {
      import('../lib/storage').then(({ deleteProductImage }) => {
        imgs
          .filter(url => url && url.startsWith('http'))
          .forEach(url => deleteProductImage(url).catch(() => {}))
      }).catch(() => {})
    }
    setForm(emptyForm)
    setEditProduct(null)
  }

  async function startEdit(product) {
    setTab('Add Product')
    window.scrollTo(0, 0)

    // Use data already in products list (which now includes sizes/colors from loadProducts)
    let p = product

    // If variants aren't loaded yet (edge case), fetch them fresh
    if (p.has_sizes && (!p.sizes || p.sizes.length === 0)) {
      try {
        const [sizesRes, colorsRes] = await Promise.all([
          supabase.from('product_sizes').select('*').eq('product_id', p.id).order('sort_order'),
          supabase.from('product_colors').select('*').eq('product_id', p.id).order('sort_order'),
        ])
        let colorSizeMatrix = {}
        if (sizesRes.data?.length && colorsRes.data?.length) {
          const matrixRes = await supabase.from('product_color_size_stock')
            .select('color_id,size_id,stock').eq('product_id', p.id)
          for (const row of (matrixRes.data || [])) {
            colorSizeMatrix[`${row.color_id}:${row.size_id}`] = row.stock
          }
        }
        p = { ...p, sizes: sizesRes.data || [], colors: colorsRes.data || [], colorSizeMatrix }
      } catch {}
    }

    const imgs = Array.isArray(p.images) ? p.images
      : (typeof p.images === 'string' ? JSON.parse(p.images || '[]') : [])
    setForm({
      name:           p.name || '',
      description:    p.description || '',
      highlights:     p.highlights || '',
      product_details: p.product_details || '',
      price:          p.price || '',
      discount_price: p.discount_price || '',
      stock:          p.stock || '',
      images:         imgs,
      is_active:      p.is_active !== false,
      status:         p.status || 'active',
      category_id:    p.category_id || '',
      countdown_ends_at: isoToLocalInput(p.countdown_ends_at),
      launch_at:         isoToLocalInput(p.launch_at),
      sale_ends_at:      isoToLocalInput(p.sale_ends_at),
      sale_active:       p.sale_active || false,
      countdown_label:   p.countdown_label || 'Deal Ends In',
      meta_title:        p.meta_title || '',
      meta_description:  p.meta_description || '',
      meta_keywords:     p.meta_keywords || '',
      search_keywords:   p.search_keywords || '',
      pairs_with_ids:    Array.isArray(p.pairs_with_ids) ? p.pairs_with_ids : [],
      og_title:          p.og_title || '',
      og_description:    p.og_description || '',
      canonical_url:     p.canonical_url || '',
      schema_brand:      p.schema_brand || '',
      schema_condition:  p.schema_condition || 'NewCondition',
      noindex:           p.noindex || false,
      has_sizes:         p.has_sizes  || false,
      has_colors:        p.has_colors || false,
      auto_hide_oos:     p.auto_hide_oos || false,
      sizes:             (p.sizes  || []).map(s => ({ ...s, uid: s.id || s.uid || Math.random().toString(36).slice(2) })),
      colors:            (p.colors || []).map(c => ({ ...c, uid: c.id || c.uid || Math.random().toString(36).slice(2) })),
      colorSizeMatrix:   p.colorSizeMatrix || {},
    })
    setEditProduct(p)
    setShowDiscount(!!(p.discount_price))   // pre-expand discount section if editing a discounted product
  }

  const [formSaving,    setFormSaving]    = React.useState(false)
  // showDiscount: true once admin opens discount section. Stays true to prevent
  // input unmount/remount (which causes focus loss) when discount_price value changes.
  const [showDiscount, setShowDiscount] = React.useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (formSaving) return  // prevent double-submit
    if (form.images.length === 0) {
      showSimpleToast('⚠️ Please upload at least one product image.', 'info'); return
    }
    setFormSaving(true)
    setLoading(true)
    // Mirrors the same auto-calc shown in the Stock field UI above — once a
    // product has variants, the top-level Stock field is read-only and
    // display-only, so form.stock itself never gets updated by user input.
    // Recomputing here (instead of trusting form.stock) is what makes the
    // saved DB value actually match what admin sees on screen.
    let trueStock = parseInt(form.stock) || 0
    if (form.has_colors && form.has_sizes) {
      trueStock = Object.values(form.colorSizeMatrix || {}).reduce((s, v) => s + (parseInt(v) || 0), 0)
    } else if (form.has_colors) {
      trueStock = (form.colors || []).reduce((s, c) => s + (parseInt(c.stock) || 0), 0)
    } else if (form.has_sizes) {
      trueStock = (form.sizes || []).reduce((s, sz) => s + (parseInt(sz.stock) || 0), 0)
    }
    const payload = {
      name:              form.name,
      description:       form.description,
      highlights:        form.highlights || null,
      product_details:   form.product_details || null,
      price:             parseFloat(form.price),
      discount_price:    form.discount_price ? parseFloat(form.discount_price) : null,
      stock:             trueStock,
      images:            form.images,
      is_active:         form.is_active,
      // v45: if launch_at is set, status must be coming_soon (stored in DB correctly)
      status:            form.launch_at ? 'coming_soon' : form.status,
      category_id:       form.category_id || null,
      countdown_ends_at: form.countdown_ends_at ? localDateToISO(form.countdown_ends_at) : null,
      launch_at:         form.launch_at ? localDateToISO(form.launch_at) : null,
      sale_ends_at:      form.sale_ends_at ? localDateToISO(form.sale_ends_at) : null,
      sale_active:       form.sale_active || false,
      countdown_label:   form.countdown_label || 'Deal Ends In',
      meta_title:        form.meta_title || null,
      meta_description:  form.meta_description || null,
      meta_keywords:     form.meta_keywords || null,
      search_keywords:   form.search_keywords || null,
      pairs_with_ids:    form.pairs_with_ids?.length ? form.pairs_with_ids : null,
      og_title:          form.og_title || null,
      og_description:    form.og_description || null,
      canonical_url:     form.canonical_url || null,
      schema_brand:      form.schema_brand || null,
      schema_condition:  form.schema_condition || 'NewCondition',
      noindex:           form.noindex || false,
      has_sizes:         form.has_sizes  || false,
      has_colors:        form.has_colors || false,
      auto_hide_oos:     form.auto_hide_oos || false,
      // Variant data — handled server-side in Edge Function
      sizes:             form.has_sizes  ? (form.sizes  || []) : [],
      colors:            form.has_colors ? (form.colors || []) : [],
      colorSizeMatrix:   (form.has_sizes && form.has_colors) ? (form.colorSizeMatrix || {}) : {},
    }
    // If editing an existing product, find images that were removed from the
    // form and delete them from Supabase storage (they're no longer needed).
    // We do this BEFORE saving so there's no window where both exist.
    if (editProduct) {
      try {
        const originalImgs = Array.isArray(editProduct.images)
          ? editProduct.images
          : (() => { try { return JSON.parse(editProduct.images || '[]') } catch { return [] } })()
        const newImgs  = new Set(form.images)
        const removed  = originalImgs.filter(u => u && u.startsWith('http') && !newImgs.has(u))
        if (removed.length > 0) {
          const { deleteProductImage } = await import('../lib/storage')
          await Promise.allSettled(removed.map(url => deleteProductImage(url)))
        }
      } catch {}  // storage cleanup failure must not block save
    }

    let err
    try {
      const res = await adminApi('product_save', {
        id:    editProduct ? editProduct.id : undefined,
        patch: payload,
      })
      // _savedId kept for potential future use (e.g. redirect to product page after save)
      const _savedId = res?.id || editProduct?.id  // eslint-disable-line no-unused-vars
    } catch (e) { err = e }
    if (err) { setLoading(false); setFormSaving(false); showSimpleToast('❌ Error: ' + err.message, 'info'); return }

    setLoading(false)
    if (err) { showSimpleToast('❌ Error: ' + err.message, 'info'); return }
    // Show rich success popup with product name
    const productName = form.name || 'Product'
    const isEdit = !!editProduct
    showSimpleToast(
      isEdit
        ? `✅ "${productName}" updated successfully!`
        : `🎉 "${productName}" added successfully!`,
      'success'
    )
    setFormSaving(false)
    resetForm()
    setTab('Products')
  }

  async function deleteProduct(id) {
    if (!(await adminConfirm('Delete this product? This cannot be undone.'))) return

    // 1. Fetch images BEFORE deleting DB row so we can clean up storage
    try {
      const { data: prod } = await supabase
        .from('products').select('images').eq('id', id).single()

      if (prod?.images) {
        const imgs = Array.isArray(prod.images)
          ? prod.images
          : (() => { try { return JSON.parse(prod.images || '[]') } catch { return [] } })()
        // Delete each image file from Supabase storage
        const { deleteProductImage } = await import('../lib/storage')
        await Promise.allSettled(imgs.filter(u => u && u.startsWith('http')).map(url => deleteProductImage(url)))
      }
    } catch {}  // storage cleanup failure must not block DB delete

    // 2. Delete DB row
    await adminApi('product_delete', { id })
    loadProducts()
    loadStats()
  }

  async function updateOrderPayment(orderId, paymentStatus) {
    try {
      await adminApi('order_payment', { order_id: orderId, payment_status: paymentStatus })
      showSimpleToast(paymentStatus === 'PAID' ? '💰 Marked as Paid' : '📋 Marked as Unpaid', 'success')
    } catch (err) { showSimpleToast('❌ ' + err.message, 'info') }
    loadOrders()
  }

  async function updateOrderInfo(orderId, fields) {
    try {
      await adminApi('order_edit', { order_id: orderId, fields })
      showSimpleToast('✅ Order info updated', 'success')
    } catch (err) { showSimpleToast('❌ ' + err.message, 'info') }
    loadOrders()
  }

  // ── Partner (influencer) lookup, so Orders can show "🤝 via X" next to
  // any order that used a partner's coupon, without OrdersTab needing its
  // own fetch or admin token plumbing. Keyed by UPPERCASE coupon code since
  // that's how orders.coupon_code is always stored (see checkout).
  const [partnerByCoupon, setPartnerByCoupon] = useState({})
  const [focusPartnerId,  setFocusPartnerId]  = useState(null)
  const [pendingPartnersCount, setPendingPartnersCount] = useState(0)

  async function loadPartnerMap() {
    try {
      const res = await adminApi('influencer_list')
      const map = {}
      let pendingCount = 0
      ;(res?.data || []).forEach(p => {
        if (p.status === 'approved' && p.coupons?.code) {
          map[p.coupons.code.toUpperCase()] = { id: p.id, name: p.name }
        }
        if (p.status === 'pending') pendingCount++
      })
      setPartnerByCoupon(map)
      setPendingPartnersCount(pendingCount)
    } catch { /* Orders tab just shows no badge if this fails — non-critical */ }
  }
  useEffect(() => { loadPartnerMap() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Clicking a partner badge in Orders jumps to the Partners tab and opens
  // that partner's full detail view directly, instead of dropping the
  // admin on the tab and making them hunt for the right row themselves.
  function viewPartner(id) {
    setFocusPartnerId(id)
    setTab('Influencers')
  }

    async function updateOrderStatus(orderId, newStatus) {
    try {
      const result = await adminApi('order_status', { order_id: orderId, new_status: newStatus })
      if (result.message === 'no-op') return
      // Show any stock warnings returned by the Edge Function
      if (result.warnings?.length) {
        result.warnings.forEach(w => showSimpleToast(`⚠️ ${w}`, 'info'))
      }
      // Toast based on new status
      if      (newStatus === 'CONFIRMED') showSimpleToast('✅ Order confirmed — stock deducted', 'success')
      else if (newStatus === 'CANCELLED') showSimpleToast('↩️ Order cancelled — stock reversed', 'success')
      else showSimpleToast(`📋 Order → ${newStatus}`, 'success')

      // ── Push notification to customer ────────────────────────────────────
      // Find the order in local state to get customer phone + name
      const order = orders.find(o => o.id === orderId)
      if (order?.customers?.phone) {
        sendOrderPush({
          orderId,
          newStatus,
          phone: order.customers.phone,
          name:  order.customers.name || '',
        })
        // Fire-and-forget — errors are logged as debug, never block the admin
      }
    } catch (err) {
      showSimpleToast('❌ ' + err.message, 'info')
    }
    loadOrders(); loadStats(); loadProducts()
  }

  // Derived from ORDER_STATUS_META for convenience
  const statusColors = Object.fromEntries(
    Object.entries(ORDER_STATUS_META).map(([k,v]) => [k, v.color])
  )

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const NAV_ITEMS = [
    { key: 'Analytics',     icon: '📊', label: 'Dashboard' },
    { key: 'Products',      icon: '📦', label: 'Products' },
    { key: 'Add Product',   icon: '➕', label: 'Add Product' },
    { key: 'Orders',        icon: '📋', label: 'Orders',   badge: stats.unpaid,        badgeColor: '#F97316' },
    { key: 'Checkout Activity', icon: '🧾', label: 'Checkout Activity' },
    { key: 'Coupons',       icon: '🎟️', label: 'Coupons' },
    { key: 'Influencers',   icon: '🤝', label: 'Partners', badge: pendingPartnersCount || undefined, badgeColor: '#8B5CF6' },
    { key: 'Reviews',       icon: '⭐', label: 'Reviews',  badge: pendingReviewCount,  badgeColor: '#EF4444' },
    { key: 'Categories',    icon: '🗂️', label: 'Categories' },
    { key: 'Deal Box',      icon: '🎁', label: 'Deal Box' },
    { key: 'Site Settings', icon: '⚙️', label: 'Site Settings' },
    { key: 'Customers',     icon: '👥', label: 'Customers' },
  ]

  const isLight = theme === 'light'
  const adminBg     = isLight ? '#F0F4F8' : '#070B14'
  const sidebarBg   = isLight ? '#FFFFFF' : '#0A0E1A'
  const sidebarBdr  = isLight ? '#E2E8F0' : '#1E2A45'
  const cardBg      = isLight ? '#FFFFFF' : '#1E293B'
  const cardBdr     = isLight ? '#E2E8F0' : '#334155'
  const textPrimary = isLight ? '#0F172A' : '#F1F5F9'
  const textMuted   = isLight ? '#334155' : '#94A3B8'
  const textSub     = isLight ? '#64748B' : '#475569'
  const inputBg     = isLight ? '#F8FAFC' : '#1E2A45'
  const topbarBg    = isLight ? '#FFFFFF' : '#0A0E1A'

  return (
    <div style={{ display:'flex', minHeight:'100vh', background: adminBg }}>
      <AdminConfirmDialog />
      <Toast />
      <style>{`
        @keyframes statPop { 0%{transform:scale(.88);opacity:0} 70%{transform:scale(1.04)} 100%{transform:scale(1);opacity:1} }
        @keyframes tabFade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes sideSlide { from{transform:translateX(-100%)} to{transform:translateX(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .admin-stat { animation: statPop 0.4s cubic-bezier(.4,0,.2,1) both; }
        .admin-tab-content { animation: tabFade 0.3s cubic-bezier(.4,0,.2,1) both; }
        .stat-card:hover { transform:translateY(-2px); transition:transform 0.2s; }
        .nav-item { transition: all 0.18s cubic-bezier(.4,0,.2,1); cursor:pointer; }
        .nav-item:hover { background: rgba(139,92,246,0.12) !important; }
        .sidebar-transition { transition: width 0.25s cubic-bezier(.4,0,.2,1); }
        .mobile-overlay { animation: fadeIn 0.2s ease; }
        .mobile-sidebar { animation: sideSlide 0.25s cubic-bezier(.4,0,.2,1); }
        ${isLight ? `
        /* Light theme: override every hardcoded dark bg in sub-tab components */
        .admin-light-wrap { background: #F0F4F8 !important; color: #0F172A !important; }
        .admin-light-wrap [class*="viro-card"],
        .admin-light-wrap table { background: #FFFFFF !important; }
        .admin-light-wrap th { background: #F1F5F9 !important; color: #334155 !important; border-color: #CBD5E1 !important; }
        .admin-light-wrap td { border-color: #E2E8F0 !important; color: #0F172A !important; }
        .admin-light-wrap tr:hover td { background: #F8FAFC !important; }
        ` : ''}
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .main-topbar { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-hamburger { display: none !important; }
          .main-topbar { display: none !important; }
        }
      `}</style>

      {/* ── DESKTOP SIDEBAR ── */}
      <div className="desktop-sidebar sidebar-transition"
        style={{
          width: sidebarOpen ? 220 : 64,
          minHeight: '100vh',
          background: sidebarBg,
          borderRight: `1px solid ${sidebarBdr}`,
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          alignSelf: 'flex-start',
          height: '100vh',
          overflow: 'hidden',
          flexShrink: 0,
          zIndex: 40,
        }}>

        {/* Sidebar Header */}
        <div style={{ padding: '16px 12px 12px', borderBottom: `1px solid ${sidebarBdr}`, display:'flex', alignItems:'center', gap:10, minHeight:64 }}>
          <img src="/logo.jpg" alt="Viro" style={{ width:36, height:36, borderRadius:10, objectFit:'cover', flexShrink:0 }} />
          {sidebarOpen && (
            <div style={{ overflow:'hidden', flex:1 }}>
              <p style={{ fontWeight:800, color:textPrimary, fontSize:14, margin:0, whiteSpace:'nowrap' }}>Viro Admin</p>
              <p style={{ fontSize:10, color:textSub, margin:0, whiteSpace:'nowrap' }}>👤 {adminUser}</p>
            </div>
          )}
          <button onClick={() => setSidebarOpen(o => !o)}
            style={{ marginLeft:'auto', background:inputBg, border:`1px solid ${sidebarBdr}`, borderRadius:8, width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, color:textMuted, fontSize:14 }}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Nav Items */}
        <nav style={{ flex:1, padding:'10px 8px', overflowY:'auto', overflowX:'hidden' }}>
          {NAV_ITEMS.map(item => {
            const active = tab === item.key
            return (
              <div key={item.key} className="nav-item"
                onClick={() => goToTab(item.key)}
                style={{
                  display:'flex', alignItems:'center', gap:10,
                  padding: sidebarOpen ? '9px 12px' : '9px 0',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  borderRadius:10, marginBottom:2,
                  background: active ? 'linear-gradient(135deg,rgba(0,191,255,0.15),rgba(139,92,246,0.15))' : 'transparent',
                  border: active ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
                  position:'relative',
                }}>
                <span style={{ fontSize:18, flexShrink:0, lineHeight:1 }}>{item.icon}</span>
                {sidebarOpen && (
                  <span style={{ fontSize:13, fontWeight: active ? 700 : 500, color: active ? textPrimary : textMuted, whiteSpace:'nowrap' }}>
                    {item.label}
                  </span>
                )}
                {item.badge > 0 && (
                  <span style={{
                    position: sidebarOpen ? 'static' : 'absolute',
                    top: sidebarOpen ? 'auto' : 4, right: sidebarOpen ? 'auto' : 4,
                    marginLeft: sidebarOpen ? 'auto' : 0,
                    minWidth:16, height:16, borderRadius:8,
                    background: item.badgeColor, color:'#fff',
                    fontSize:9, fontWeight:800,
                    display:'inline-flex', alignItems:'center', justifyContent:'center',
                    padding:'0 4px', flexShrink:0,
                  }}>{item.badge}</span>
                )}
              </div>
            )
          })}
        </nav>

        {/* Quick stats in sidebar — go to Dashboard */}
        <div style={{ padding:'8px', borderTop:`1px solid ${sidebarBdr}` }}>
          {sidebarOpen ? (
            <button onClick={() => goToTab('Analytics')}
              style={{ width:'100%',padding:'8px 12px',borderRadius:10,border:`1px solid ${sidebarBdr}`,
                background:'linear-gradient(135deg,#8B5CF620,#00BFFF10)',cursor:'pointer',
                display:'flex',alignItems:'center',gap:8 }}>
              <span style={{ fontSize:16 }}>📊</span>
              <div style={{ textAlign:'left' }}>
                <div style={{ fontSize:11,fontWeight:800,color:'#A78BFA' }}>Dashboard</div>
                <div style={{ fontSize:9,color:textSub }}>Rs.{(stats.revenue/1000).toFixed(1)}k · {stats.orders} orders</div>
              </div>
            </button>
          ) : (
            <button onClick={() => goToTab('Analytics')}
              style={{ width:'100%',padding:'8px 0',borderRadius:10,border:'none',background:'transparent',cursor:'pointer',textAlign:'center' }}>
              <span style={{ fontSize:16 }}>📊</span>
            </button>
          )}
        </div>

        {/* Logout */}
        <div style={{ padding:'10px 8px', borderTop:`1px solid ${sidebarBdr}`, display:'flex', flexDirection:'column', gap:6 }}>
          <button onClick={doLogout}
            className="nav-item"
            style={{
              width:'100%', display:'flex', alignItems:'center', gap:10,
              padding: sidebarOpen ? '9px 12px' : '9px 0',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              borderRadius:10, background:'rgba(239,68,68,0.08)',
              border:'1px solid rgba(239,68,68,0.2)', cursor:'pointer',
            }}>
            <span style={{ fontSize:16, flexShrink:0 }}>🚪</span>
            {sidebarOpen && <span style={{ fontSize:13, fontWeight:600, color:'#F87171', whiteSpace:'nowrap' }}>Logout</span>}
          </button>
          {sidebarOpen && (
            <button onClick={() => { if (confirm('Log out of ALL devices?')) doLogoutEverywhere() }}
              className="nav-item"
              style={{
                width:'100%', display:'flex', alignItems:'center', gap:10,
                padding:'9px 12px', justifyContent:'flex-start',
                borderRadius:10, background:'rgba(239,68,68,0.04)',
                border:'1px solid rgba(239,68,68,0.12)', cursor:'pointer',
              }}>
              <span style={{ fontSize:14, flexShrink:0 }}>⛔</span>
              <span style={{ fontSize:12, fontWeight:600, color:'#F87171', whiteSpace:'nowrap' }}>Logout All Devices</span>
            </button>
          )}
        </div>
      </div>

      {/* ── MOBILE OVERLAY SIDEBAR ── */}
      {mobileSidebarOpen && (
        <Portal>
          <div className="mobile-overlay"
            onClick={() => setMobileSidebarOpen(false)}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:50, backdropFilter:'blur(2px)' }} />
          <div className="mobile-sidebar"
            style={{ position:'fixed', top:0, left:0, bottom:0, width:240, background:sidebarBg, zIndex:51, display:'flex', flexDirection:'column', borderRight:`1px solid ${sidebarBdr}` }}>

            {/* Mobile sidebar header */}
            <div style={{ padding:'16px 14px', borderBottom:`1px solid ${sidebarBdr}`, display:'flex', alignItems:'center', gap:10 }}>
              <img src="/logo.jpg" alt="Viro" style={{ width:34, height:34, borderRadius:10, objectFit:'cover' }} />
              <div style={{ flex:1 }}>
                <p style={{ fontWeight:800, color:textPrimary, fontSize:14, margin:0 }}>Viro Admin</p>
                <p style={{ fontSize:10, color:textSub, margin:0 }}>👤 {adminUser}</p>
              </div>
              <button onClick={() => setMobileSidebarOpen(false)}
                style={{ background:inputBg, border:`1px solid ${sidebarBdr}`, borderRadius:8, width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:textMuted, fontSize:16 }}>✕</button>
            </div>

            {/* Mobile Stats */}
            <div style={{ padding:'10px 12px', borderBottom:`1px solid ${sidebarBdr}` }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {[
                  { label:'Products', value:stats.products,                        icon:'📦', color:'#00BFFF' },
                  { label:'Orders',   value:stats.orders,                          icon:'📋', color:'#8B5CF6' },
                  { label:'Revenue',  value:`${(stats.revenue/1000).toFixed(1)}k`, icon:'💰', color:'#10B981' },
                  { label:'Unpaid',   value:stats.unpaid,                          icon:'⚠️', color:'#F97316' },
                  { label:'🟢 Google', value:stats.googleUsers,                    icon:'🟢', color:'#10B981' },
                  { label:'⚪ Guest',  value:stats.guestUsers,                     icon:'⚪', color:'#94A3B8' },
                ].map(s => (
                  <div key={s.label} style={{ background:isLight?'#F1F5F9':'#0F1629', borderRadius:10, padding:'8px 6px', textAlign:'center', border:`1px solid ${sidebarBdr}` }}>
                    <div style={{ fontSize:14 }}>{s.icon}</div>
                    <div style={{ fontWeight:800, fontSize:13, color:s.color }}>{s.value}</div>
                    <div style={{ fontSize:9, color:textSub, marginTop:1 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile Nav */}
            <nav style={{ flex:1, padding:'10px 10px', overflowY:'auto' }}>
              {NAV_ITEMS.map(item => {
                const active = tab === item.key
                return (
                  <div key={item.key} className="nav-item"
                    onClick={() => { goToTab(item.key); setMobileSidebarOpen(false) }}
                    style={{
                      display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, marginBottom:2,
                      background: active ? 'linear-gradient(135deg,rgba(0,191,255,0.15),rgba(139,92,246,0.15))' : 'transparent',
                      border: active ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
                    }}>
                    <span style={{ fontSize:18, flexShrink:0 }}>{item.icon}</span>
                    <span style={{ fontSize:13, fontWeight: active ? 700 : 500, color: active ? textPrimary : textMuted, flex:1 }}>{item.label}</span>
                    {item.badge > 0 && (
                      <span style={{ minWidth:16, height:16, borderRadius:8, background:item.badgeColor, color:'#fff', fontSize:9, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', padding:'0 4px' }}>{item.badge}</span>
                    )}
                  </div>
                )
              })}
            </nav>

            <div style={{ padding:'10px 10px', borderTop:`1px solid ${sidebarBdr}`, display:'flex', flexDirection:'column', gap:6 }}>
              <button onClick={() => { setMobileSidebarOpen(false); doLogout() }}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', cursor:'pointer' }}>
                <span style={{ fontSize:16 }}>🚪</span>
                <span style={{ fontSize:13, fontWeight:600, color:'#F87171' }}>Logout</span>
              </button>
              <button onClick={() => { if (confirm('Log out of ALL devices?')) { setMobileSidebarOpen(false); doLogoutEverywhere() } }}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.12)', cursor:'pointer' }}>
                <span style={{ fontSize:14 }}>⛔</span>
                <span style={{ fontSize:12, fontWeight:600, color:'#F87171' }}>Logout All Devices</span>
              </button>
            </div>
          </div>
        </Portal>
      )}

      {/* ── MAIN CONTENT AREA ── */}
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', minHeight:'100vh' }}>

        {/* Mobile top bar */}
        <div className="main-topbar"
          style={{ display:'none', alignItems:'center', gap:10, padding:'10px 14px', background:topbarBg, borderBottom:`1px solid ${sidebarBdr}`, position:'sticky', top:0, zIndex:30 }}>
          <button className="mobile-hamburger"
            onClick={() => setMobileSidebarOpen(true)}
            style={{ background:inputBg, border:`1px solid ${sidebarBdr}`, borderRadius:8, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:textMuted, fontSize:16, flexShrink:0 }}>
            ☰
          </button>
          <img src="/logo.jpg" alt="Viro" style={{ width:30, height:30, borderRadius:8, objectFit:'cover' }} />
          <span style={{ fontWeight:800, color:textPrimary, fontSize:14, flex:1 }}>Admin Panel</span>
          <span style={{ fontSize:11, fontWeight:600, color:textMuted, background:inputBg, padding:'4px 10px', borderRadius:8 }}>{tab}</span>
        </div>

        {/* Page content */}
        <div style={{ flex:1, padding:'0 0 32px 0' }} className={`admin-tab-content${isLight ? ' admin-light-wrap' : ''}`}>

      {/* ── Page header ── */}
      <div style={{ padding:'20px 20px 4px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h2 style={{ fontWeight:800, color:textPrimary, fontSize:18, margin:0, lineHeight:1.2 }}>
            {tab === 'Products' ? '📦 Products'
            : tab === 'Add Product' ? (editProduct ? '✏️ Edit Product' : '➕ Add Product')
            : tab === 'Orders'   ? '📋 Orders'
            : tab === 'Coupons'  ? '🎟️ Coupons'
            : tab === 'Influencers' ? '🤝 Partners'
            : tab === 'Reviews'  ? '⭐ Reviews'
            : tab === 'Categories' ? '🗂️ Categories'
            : tab === 'Deal Box'   ? '🎁 Deal Box'
            : tab === 'Analytics'   ? '📊 Dashboard'
            : '⚙️ Site Settings'}
          </h2>
          <p style={{ fontSize:11, color:textSub, margin:'2px 0 0' }}>
            {tab === 'Products'     ? `${stats.products} products total`
            : tab === 'Orders'      ? `${stats.orders} orders · Rs.${Math.round(stats.revenue).toLocaleString()} revenue`
            : tab === 'Reviews'     ? `${pendingReviewCount} pending approval`
            : tab === 'Add Product' ? 'Fill in the details below'
            : tab === 'Coupons'     ? 'Manage discount codes'
            : tab === 'Influencers' ? 'Approve requests, assign coupons, track commission'
            : tab === 'Categories'  ? 'Organise your catalogue'
            : tab === 'Deal Box'    ? 'Bundle products to boost average order value'
            : tab === 'Analytics'    ? 'Full sales & customer insights'
            : 'Configure your store'}
          </p>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          {/* Back / Forward */}
          <button onClick={goBack} disabled={historyIdx <= 0}
            title={historyIdx > 0 ? `Back to ${tabHistory[historyIdx-1]}` : 'Nothing to go back to'}
            style={{ width:32,height:32,borderRadius:'50%',border:`1px solid ${cardBdr}`,
              background:inputBg,cursor:historyIdx<=0?'not-allowed':'pointer',
              color:textMuted,fontSize:15,fontWeight:700,
              opacity:historyIdx<=0?0.3:1,display:'flex',alignItems:'center',justifyContent:'center' }}>‹</button>
          <button onClick={goForward} disabled={historyIdx >= tabHistory.length - 1}
            title={historyIdx < tabHistory.length-1 ? `Forward to ${tabHistory[historyIdx+1]}` : 'Nothing to go forward to'}
            style={{ width:32,height:32,borderRadius:'50%',border:`1px solid ${cardBdr}`,
              background:inputBg,cursor:historyIdx>=tabHistory.length-1?'not-allowed':'pointer',
              color:textMuted,fontSize:15,fontWeight:700,
              opacity:historyIdx>=tabHistory.length-1?0.3:1,display:'flex',alignItems:'center',justifyContent:'center' }}>›</button>
          <button
            onClick={() => { if(tab==='Products') loadProducts(); else if(tab==='Orders') loadOrders(); else loadStats() }}
            style={{ background:inputBg, border:`1px solid ${cardBdr}`, borderRadius:10, padding:'6px 12px', color:textMuted, fontSize:12, fontWeight:600, cursor:'pointer' }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── PRODUCTS ── */}

      {/* ══════════════════════════════════════════════════════
          DAILY SALES SUMMARY — clickable cards → analytics
      ══════════════════════════════════════════════════════ */}
      {analyticsOpen && <AnalyticsModal type={analyticsType} onClose={() => setAnalyticsOpen(false)} isLight={isLight} cardBg={cardBg} cardBdr={cardBdr} textPrimary={textPrimary} textMuted={textMuted} textSub={textSub} />}

      {/* ══════════════════════════════════════════════════════
          PRODUCTS TAB — bulk select, quick controls, dual timers
      ══════════════════════════════════════════════════════ */}
      {tab === 'Products' && (
        <ProductsTab
          products={products}
          categories={categories}
          loading={loadingProducts}
          onEdit={startEdit}
          onDelete={deleteProduct}
          onToggleVisibility={async (p) => {
            await adminApi('product_update', { id: p.id, patch: { is_active: p.is_active === false } })
            loadProducts()
          }}
          onToggleStatus={async (p, status) => {
            await adminApi('product_update', { id: p.id, patch: { status } })
            loadProducts()
          }}
          onBulkUpdate={async (ids, patch) => {
            await adminApi('product_update', { ids, patch })
            loadProducts()
          }}
          loadProducts={loadProducts}
        />
      )}

      {/* ══════════════════════════════════════════════════════
          ADD / EDIT PRODUCT TAB — dual timers
      ══════════════════════════════════════════════════════ */}
      {tab === 'Add Product' && (
        <div className="px-4">
          {/* Desktop: 2-col — images left, fields right */}
          <div className="md:flex md:gap-5 md:items-start">

            {/* Left col: image uploader */}
            <div className="md:w-72 md:flex-shrink-0 mb-4 md:mb-0">
              <div className="viro-card p-4 md:sticky md:top-16">
                <h2 className="font-bold text-white mb-1 text-sm">
                  {editProduct ? '✏️ Edit Product' : '➕ New Product'}
                </h2>
                <p className="text-xs text-slate-500 mb-3">
                  Images → <span className="text-purple-400 font-mono">products_img</span>
                </p>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Product Images *
                </label>
                <ImageUploader
                  images={form.images}
                  productCount={(stats.products || 0) + (editProduct ? 0 : 1)}
          externalSearch={extProductSearch}
          onExternalSearchConsumed={() => setExtProductSearch('')}
                  onChange={imgs => setForm(f => ({ ...f, images: imgs }))}
                  onRemoveUrl={(removedUrl, newImgs) => {
                    // Immediately update products.images in DB when admin removes
                    // an image thumbnail — keeps DB in sync before Save is clicked.
                    // Only runs when editing an existing product (editProduct has an id).
                    if (!editProduct?.id) return
                    supabase
                      .from('products')
                      .update({ images: newImgs })
                      .eq('id', editProduct.id)
                      .then(({ error }) => {
                        if (error) console.warn('[product img remove]', error.message)
                      })
                  }}
                />
              </div>
            </div>

            {/* Right col: all fields */}
            <div className="flex-1">
              <form onSubmit={handleSubmit} className="viro-card p-4 space-y-3">

                {/* Status + Active toggle row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="rounded-xl text-sm w-full" style={{ padding: '10px 12px' }}>
                      <option value="active">✅ Active</option>
                      <option value="out_of_stock">🚫 Out of Stock</option>
                      <option value="coming_soon">🚀 Coming Soon</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Visibility</label>
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                      className="w-full rounded-xl text-sm font-bold py-2.5 transition-all"
                      style={form.is_active
                        ? { background: '#10B98120', color: '#10B981', border: '1px solid #10B98150' }
                        : { background: '#EF444415', color: '#EF4444', border: '1px solid #EF444440' }}>
                      {form.is_active ? '👁 Visible' : '🙈 Hidden'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Product Name *</label>
                  <input value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Samsung Galaxy Buds Pro" required />
                </div>

                {/* Category combobox — main + sub */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Category <span className="text-red-400">*</span>
                    {!form.category_id && <span className="ml-1 text-yellow-400 font-normal normal-case">(required)</span>}
                  </label>
                  {(() => {
                    const parentCats = categories.filter(c => !c.parent_id)
                    const subCats = (pid) => categories.filter(c => c.parent_id === pid)
                    const selectedCat = categories.find(c => c.id === form.category_id)
                    const selectedParentId = selectedCat?.parent_id || (selectedCat ? selectedCat.id : null)
                    const subs = selectedParentId ? subCats(selectedParentId) : []
                    return (
                      <div className="space-y-2">
                        {/* Main category row */}
                        <div className="flex flex-wrap gap-1.5">
                          {parentCats.map(c => {
                            const isActiveParent = form.category_id === c.id || (selectedCat?.parent_id === c.id)
                            return (
                              <button key={c.id} type="button"
                                onClick={() => setForm(f => ({ ...f, category_id: f.category_id === c.id ? '' : c.id }))}
                                className="text-xs px-2.5 py-1.5 rounded-xl transition-all font-bold"
                                style={isActiveParent
                                  ? { background:'#8B5CF6', color:'#fff', boxShadow:'0 2px 8px rgba(139,92,246,0.4)' }
                                  : { background:'#1E2A45', color:'#94A3B8', border:'1px solid #334155' }}>
                                {c.icon} {c.name}
                              </button>
                            )
                          })}
                        </div>
                        {/* Sub-category row (shown when parent selected) */}
                        {subs.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pl-2" style={{ borderLeft:'3px solid #8B5CF650' }}>
                            <button type="button"
                              onClick={() => setForm(f => ({ ...f, category_id: selectedParentId }))}
                              className="text-xs px-2.5 py-1.5 rounded-xl font-bold transition-all"
                              style={form.category_id === selectedParentId
                                ? { background:'#00BFFF', color:'#0B1221' }
                                : { background:'#1E2A45', color:'#64748B', border:'1px solid #334155' }}>
                              All (main)
                            </button>
                            {subs.map(s => (
                              <button key={s.id} type="button"
                                onClick={() => setForm(f => ({ ...f, category_id: f.category_id === s.id ? selectedParentId : s.id }))}
                                className="text-xs px-2.5 py-1.5 rounded-xl font-bold transition-all"
                                style={form.category_id === s.id
                                  ? { background:'#00BFFF', color:'#0B1221' }
                                  : { background:'#1E2A45', color:'#94A3B8', border:'1px solid #334155' }}>
                                {s.icon} {s.name}
                              </button>
                            ))}
                          </div>
                        )}
                        {/* Selected display */}
                        {selectedCat && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                            style={{ background:'#8B5CF615', border:'1px solid #8B5CF630' }}>
                            <span style={{ fontSize:16 }}>{selectedCat.icon}</span>
                            <span className="text-xs font-bold" style={{ color:'#C4B5FD' }}>
                              {selectedCat.parent_id
                                ? `${parentCats.find(p=>p.id===selectedCat.parent_id)?.name} › ${selectedCat.name}`
                                : selectedCat.name}
                            </span>
                            <button type="button" onClick={()=>setForm(f=>({...f,category_id:''}))}
                              className="ml-auto text-xs font-bold" style={{ color:'#F87171' }}>✕ Clear</button>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    🔍 Search Keywords <span className="normal-case font-normal text-slate-500">(comma-separated, first = highest priority)</span>
                  </label>
                  <input value={form.search_keywords || ''}
                    onChange={e => setForm(f => ({ ...f, search_keywords: e.target.value }))}
                    placeholder="e.g. ring, gold ring, wedding ring" />
                  <p className="text-xs mt-1 text-slate-500">
                    Controls where this product ranks when customers search. "ring, wedding ring" means it beats other results for "ring" and also matches "wedding ring" searches. Separate from SEO meta keywords below — this one's just for on-site search ranking.
                  </p>
                </div>

                <PairsWithPicker
                  selectedIds={form.pairs_with_ids || []}
                  onChange={ids => setForm(f => ({ ...f, pairs_with_ids: ids }))}
                  allProducts={products}
                  currentProductId={editProduct?.id}
                  categories={categories}
                />

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Description</label>
                  <textarea value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Describe the product…" rows={3} style={{ resize: 'none' }} />
                </div>

                {/* Highlights — top bullet features (like Daraz top section) */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Highlights <span className="normal-case font-normal text-slate-600">(bullet features, shown in product details)</span>
                  </label>
                  <textarea value={form.highlights}
                    onChange={e => setForm(f => ({ ...f, highlights: e.target.value }))}
                    placeholder={"• Soft Cotton Jersey – airy comfort for Pakistan summers\n• Gift-Ready – birthdays/Eid\n• Fast Delivery + Easy Returns"}
                    rows={4} style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }} />
                  <p className="text-xs mt-1" style={{ color: '#64748b' }}>Each line = one bullet. Use **bold** for emphasis. e.g. <code>• Fabric: **Cotton Jersey**</code></p>
                </div>

                {/* Product Details — specs table (like Daraz bottom section) */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Product Details <span className="normal-case font-normal text-slate-600">(specs & attributes, shown below highlights)</span>
                  </label>
                  <textarea value={form.product_details}
                    onChange={e => setForm(f => ({ ...f, product_details: e.target.value }))}
                    placeholder={"• Fabric: **Soft, breathable cotton jersey** (summer weight)\n• Top: Black crew-neck, half sleeves; **front \"love\" + heart** print\n• Sizes: **S, M, L, XL**\n• Care: Cold machine wash inside-out; no bleach\n• Service: COD | **14-Day Easy Exchange/Return** | Quick Dispatch"}
                    rows={6} style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }} />
                  <p className="text-xs mt-1" style={{ color: '#64748b' }}>Each line = one spec row. Use **bold** for values. e.g. <code>• Sizes: **S, M, L, XL**</code></p>
                </div>

                {/* Price row — 3 cols on desktop */}
                {/* Price + Stock row */}
                {(() => {
                  // BUGFIX: this field used to be a fully independent number
                  // that admin could set to anything (e.g. "2") while colour
                  // variant stocks below summed to something completely
                  // different (e.g. 1+1+1=3) — nothing kept them in sync, and
                  // once a product HAS variants, checkout actually uses the
                  // per-variant stock (decrement_variant_stock), making this
                  // top-level number pure decoration that just confused admin.
                  // Now: when variants are active, this auto-computes from
                  // them and is read-only, so there's only ever one true
                  // number instead of two that can silently disagree.
                  const hasVariants = form.has_colors || form.has_sizes
                  let variantTotal = null
                  if (form.has_colors && form.has_sizes) {
                    variantTotal = Object.values(form.colorSizeMatrix || {}).reduce((s, v) => s + (parseInt(v) || 0), 0)
                  } else if (form.has_colors) {
                    variantTotal = (form.colors || []).reduce((s, c) => s + (parseInt(c.stock) || 0), 0)
                  } else if (form.has_sizes) {
                    variantTotal = (form.sizes || []).reduce((s, sz) => s + (parseInt(sz.stock) || 0), 0)
                  }
                  return (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Price (Rs.) *</label>
                    <input type="number" value={form.price}
                      onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                      placeholder="2000" min="0" step="0.01" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Stock * {hasVariants && <span className="normal-case font-normal text-slate-600">(auto — see variants below)</span>}
                    </label>
                    <input type="number" value={hasVariants ? variantTotal : form.stock}
                      onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                      placeholder="50" min="0" required
                      readOnly={hasVariants}
                      style={hasVariants ? { opacity: 0.6, cursor: 'not-allowed', background: '#0F172A' } : undefined} />
                    {hasVariants && (
                      <p className="text-[11px] mt-1" style={{ color: '#64748B' }}>
                        Sum of all variant stock below — edit stock per colour/size, not here.
                      </p>
                    )}
                  </div>
                </div>
                  )
                })()}

                {/* ── Variants (sizes + colours) ── */}
                <ProductVariantsEditor
                  form={form}
                  setForm={setForm}
                  ImageUploader={ImageUploader}
                  editProduct={editProduct}
                />

                {/* ══════════════════════════════════════════
                    v46 DISCOUNT SECTION
                    - Collapsed (button) when no discount_price set
                    - Expanded/maximized when discount_price is set
                    - Optional expiry timer:
                        • No date set → discount is permanent (no expiry)
                        • Date set → when expired, discount_price auto-nulled in DB
                    - While coming_soon timer runs: customer sees discounted price
                      but NOT the sale countdown timer
                    - After coming_soon expires: sale countdown becomes visible
                ══════════════════════════════════════════ */}
                {(showDiscount || (form.discount_price !== '' && form.discount_price !== null && form.discount_price !== undefined)) ? (
                  /* EXPANDED — discount is set */
                  <div className="p-3 rounded-xl space-y-3" style={{ background:'#F9731610', border:'2px solid #F9731650' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold flex items-center gap-1.5" style={{ color:'#F97316' }}>
                          🔥 Discount Price
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background:'#F9731625', color:'#FED7AA' }}>ACTIVE</span>
                        </p>
                        <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                          Customer sees discounted price. Set an expiry to auto-remove it when the timer ends.
                        </p>
                      </div>
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, discount_price: '', sale_ends_at: '', sale_active: false }))}
                        className="text-xs underline flex-shrink-0 ml-2" style={{ color:'#EF4444' }}>
                        Remove discount
                      </button>
                    </div>

                    {/* Discount price input */}
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Discount Price (Rs.)
                      </label>
                      <input type="number" value={form.discount_price}
                        onChange={e => setForm(f => ({ ...f, discount_price: e.target.value }))}
                        placeholder="1500" min="0" step="0.01"
                        style={{ border:'1px solid #F9731650' }} />
                      {form.price && form.discount_price && (
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background:'#10B98120', color:'#10B981' }}>
                            -{Math.round((1 - parseFloat(form.discount_price)/parseFloat(form.price))*100)}% OFF
                          </span>
                          <span className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                            Customer saves Rs.{(parseFloat(form.price)-parseFloat(form.discount_price)).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Optional expiry timer for discount */}
                    <div className="pt-2" style={{ borderTop:'1px solid #F9731630' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs font-bold" style={{ color:'#F97316' }}>⏰ Discount Expiry (optional)</p>
                          <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                            No date = discount is <strong>permanent</strong>. Set a date → price reverts to original when expired.
                          </p>
                        </div>
                        {/* Toggle sale_active */}
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className="text-xs font-bold" style={{ color: form.sale_active ? '#F97316' : 'var(--viro-textSub)' }}>
                            {form.sale_active ? 'Timer ON' : 'No expiry'}
                          </span>
                          <div
                            onClick={() => setForm(f => ({ ...f, sale_active: !f.sale_active, sale_ends_at: !f.sale_active ? f.sale_ends_at : '' }))}
                            className="relative cursor-pointer rounded-full flex-shrink-0"
                            style={{ width:44, height:24, background: form.sale_active ? '#F97316' : 'var(--viro-border)', transition:'background 0.2s' }}>
                            <div style={{ position:'absolute', top:2, width:20, height:20, borderRadius:'50%', background:'#fff',
                              transform: form.sale_active ? 'translateX(20px)' : 'translateX(2px)', transition:'transform 0.2s',
                              boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }} />
                          </div>
                        </div>
                      </div>

                      {form.sale_active && (
                        <>
                          <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                            <input
                              type="datetime-local"
                              value={form.sale_ends_at || ''}
                              onChange={e => setForm(f => ({ ...f, sale_ends_at: e.target.value }))}
                              style={{ colorScheme:'dark', paddingRight:40, width:'100%' }}
                            />
                            <button type="button"
                              onClick={e => { e.currentTarget.previousSibling.showPicker?.() }}
                              style={{
                                position:'absolute', right:6, top:'50%', transform:'translateY(-50%)',
                                width:28, height:28, borderRadius:8, border:'none', cursor:'pointer',
                                background:'linear-gradient(135deg,#F97316,#EF4444)',
                                display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
                                boxShadow:'0 2px 6px rgba(249,115,22,0.4)'
                              }}>🗓️</button>
                          </div>

                          <label className="viro-label mt-2">Timer Label (shown on countdown)</label>
                          <input
                            value={form.countdown_label || 'Deal Ends In'}
                            onChange={e => setForm(f => ({ ...f, countdown_label: e.target.value }))}
                            placeholder="e.g. Eid Sale Ends In, Flash Deal"
                          />
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {['Deal Ends In','Eid Sale Ends In','Flash Deal','Weekend Special','Limited Offer'].map(s => (
                              <button key={s} type="button"
                                onClick={() => setForm(f => ({ ...f, countdown_label: s }))}
                                className="px-2.5 py-1 rounded-full text-xs font-bold transition-all"
                                style={form.countdown_label === s
                                  ? { background:'#F97316', color:'#fff' }
                                  : { background:'var(--viro-bgDeep)', color:'var(--viro-textSub)', border:'1px solid var(--viro-border)' }}>
                                {s}
                              </button>
                            ))}
                          </div>

                          {form.sale_ends_at && (
                            <div className="mt-2 p-2 rounded-lg" style={{ background:'#F9731615' }}>
                              <p className="text-xs font-bold" style={{ color:'#F97316' }}>
                                🔥 Discount expires: {new Date(form.sale_ends_at).toLocaleString('en-PK')}
                              </p>
                              <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                                After this, price reverts to Rs.{parseFloat(form.price||0).toLocaleString()} automatically
                              </p>
                              {(form.status === 'coming_soon' || form.launch_at) && (
                                <p className="text-xs mt-1" style={{ color:'#A78BFA' }}>
                                  🚀 While Coming Soon timer runs → customer sees discounted price but NOT this countdown. Timer shows after launch.
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {!form.sale_active && (
                        <p className="text-xs" style={{ color:'#10B981' }}>
                          ✅ Discount is permanent — no expiry date set
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  /* COLLAPSED — no discount set: single click-to-expand button, NO input here.
                     Having an input here causes React to unmount it when discount_price gets a value,
                     which fires onBlur and loses cursor focus. */
                  <div className="p-3 rounded-xl" style={{ background:'#F9731608', border:'1px dashed #F9731640' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold" style={{ color:'#F97316' }}>🔥 Discount Price</p>
                        <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                          Add a discounted price — section expands to show expiry options
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <input type="number" value={form.discount_price}
                          onChange={e => { setShowDiscount(true); setForm(f => ({ ...f, discount_price: e.target.value })) }}
                          onFocus={() => setShowDiscount(true)}
                          placeholder="e.g. 1500" min="0" step="0.01"
                          style={{ width:110, padding:'8px 10px', borderRadius:10, fontSize:13,
                            background:'var(--viro-bgDeep)', border:'1px solid #F9731650', color:'var(--viro-text)' }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Live price preview */}
                {/* ══════════════════════════════════════════
                    v45 DUAL TIMER SECTION
                    Timer 1 (PRIORITY): Coming Soon launch timer
                      - Only visible/expanded when status=coming_soon OR launch_at already set
                      - Button shown when status≠coming_soon & no launch_at — click sets status=coming_soon & expands
                      - When timer ends → DB trigger auto-changes status to active
                      - While active: hides discount timer from customer
                    Timer 2: Sale/discount timer
                      - Only visible to customer when NO coming_soon timer is running
                ══════════════════════════════════════════ */}
                <div className="viro-card p-4 space-y-4" style={{ border:'2px solid #F9731430' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⏳</span>
                    <div>
                      <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>Dual Timer System</p>
                      <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>Coming Soon timer has priority — while active, customers see launch countdown only</p>
                      <p className="text-xs mt-1" style={{ color:'#10B981' }}>✅ Times are in your local timezone — no conversion needed</p>
                    </div>
                  </div>

                  {/* ── Timer 1: Coming Soon → Active (PRIORITY TIMER) ── */}
                  {/* Expanded when: status is coming_soon OR launch_at is set */}
                  {/* Collapsed (button) when: status is NOT coming_soon AND no launch_at */}
                  {(form.status === 'coming_soon' || form.launch_at) ? (
                    <div className="p-3 rounded-xl" style={{ background:'#8B5CF610', border:'2px solid #8B5CF660' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-bold flex items-center gap-1.5" style={{ color:'#A78BFA' }}>
                            🚀 Timer 1: Coming Soon Launch
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background:'#8B5CF630', color:'#C4B5FD' }}>PRIORITY</span>
                          </p>
                          <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                            When this expires → status auto-changes to <strong style={{color:'#10B981'}}>Active</strong> · Customers won't see discount timer while this runs
                          </p>
                        </div>
                      </div>

                      {/* Status badge — shows current status is coming_soon */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{ background:'#8B5CF625', color:'#A78BFA', border:'1px solid #8B5CF650' }}>
                          🚀 Status: Coming Soon
                        </span>
                        <button type="button"
                          onClick={() => setForm(f => ({ ...f, status: 'active', launch_at: '' }))}
                          className="text-xs underline" style={{ color:'var(--viro-textSub)' }}>
                          Cancel & set Active
                        </button>
                      </div>

                      <label className="viro-label">Launch Date & Time (stored in DB as UTC)</label>
                      <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                        <input
                          type="datetime-local"
                          value={form.launch_at || ''}
                          onChange={e => setForm(f => ({ ...f, launch_at: e.target.value, status: 'coming_soon' }))}
                          style={{ colorScheme:'dark', paddingRight:40, width:'100%' }}
                        />
                        <button type="button"
                          onClick={e => { e.currentTarget.previousSibling.showPicker?.() }}
                          style={{
                            position:'absolute', right:6, top:'50%', transform:'translateY(-50%)',
                            width:28, height:28, borderRadius:8, border:'none', cursor:'pointer',
                            background:'linear-gradient(135deg,#8B5CF6,#A78BFA)',
                            display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
                            boxShadow:'0 2px 6px rgba(139,92,246,0.4)'
                          }}>📅</button>
                      </div>

                      {form.launch_at ? (
                        <div className="mt-2 p-2 rounded-lg flex items-center justify-between" style={{ background:'#8B5CF615' }}>
                          <p className="text-xs font-bold" style={{ color:'#A78BFA' }}>
                            🚀 Launches: {new Date(form.launch_at).toLocaleString('en-PK')}
                            {' '}→ then goes <strong style={{color:'#10B981'}}>Active</strong>
                          </p>
                          <button type="button" onClick={() => setForm(f => ({ ...f, launch_at: '' }))}
                            className="text-xs underline flex-shrink-0 ml-2" style={{ color:'#EF4444' }}>Clear timer</button>
                        </div>
                      ) : (
                        <p className="text-xs mt-2" style={{ color:'#F97316' }}>
                          ⚠️ Status is Coming Soon but no timer set — set a date above so it auto-activates, or save as-is to keep it Coming Soon indefinitely
                        </p>
                      )}
                    </div>
                  ) : (
                    /* Collapsed: show a button to enable coming soon timer */
                    <div className="p-3 rounded-xl" style={{ background:'#8B5CF608', border:'1px dashed #8B5CF640' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold" style={{ color:'#A78BFA' }}>🚀 Timer 1: Coming Soon Launch</p>
                          <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>Set a launch countdown — status updates to Coming Soon automatically</p>
                        </div>
                        <button type="button"
                          onClick={() => setForm(f => ({ ...f, status: 'coming_soon' }))}
                          style={{
                            padding:'7px 14px', borderRadius:10, border:'none', cursor:'pointer', flexShrink:0,
                            background:'linear-gradient(135deg,#8B5CF6,#A78BFA)', color:'#fff',
                            fontWeight:700, fontSize:12, boxShadow:'0 2px 8px rgba(139,92,246,0.4)'
                          }}>
                          Set Coming Soon
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Combined timer logic preview */}
                  {(form.launch_at || (form.sale_active && form.sale_ends_at)) && (
                    <div className="p-3 rounded-xl" style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                      <p className="text-xs font-bold mb-2" style={{ color:'var(--viro-text)' }}>📋 What Customer Sees</p>
                      {form.launch_at && (
                        <p className="text-xs mb-1" style={{ color:'#A78BFA' }}>
                          🚀 <strong>While Coming Soon:</strong> launch countdown shown
                          {form.discount_price && parseFloat(form.discount_price) < parseFloat(form.price||0)
                            ? ` · Discounted price (Rs.${parseFloat(form.discount_price).toLocaleString()}) visible — but NO sale timer yet`
                            : ''}
                        </p>
                      )}
                      {form.sale_active && form.sale_ends_at && (
                        <p className="text-xs mb-1" style={{ color:'#F97316' }}>
                          🔥 <strong>{form.launch_at ? 'After launch:' : 'Now:'}</strong> discount timer runs until{' '}
                          {new Date(form.sale_ends_at).toLocaleString('en-PK')} → then price reverts to Rs.{parseFloat(form.price||0).toLocaleString()}
                        </p>
                      )}
                      {form.launch_at && form.sale_active && form.sale_ends_at && (
                        <p className="text-xs mt-1" style={{ color:'#10B981' }}>
                          ✅ Coming Soon timer runs first → after launch, discount countdown becomes visible
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {form.price && (
                  <div className="p-3 rounded-xl" style={{ background: '#080C18', border: '1px solid #1E2A45' }}>
                    <p className="text-xs text-slate-500 mb-1.5">👁️ Customer sees:</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-lg font-extrabold" style={{ color: '#00BFFF' }}>
                        Rs. {parseFloat(form.discount_price || form.price || 0).toLocaleString()}
                      </span>
                      {form.discount_price && parseFloat(form.discount_price) < parseFloat(form.price) && (
                        <>
                          <span className="text-slate-500 line-through text-sm">
                            Rs. {parseFloat(form.price).toLocaleString()}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full text-white font-bold"
                            style={{ background: 'linear-gradient(135deg,#8B5CF6,#F97316)' }}>
                            -{Math.round((1 - parseFloat(form.discount_price) / parseFloat(form.price)) * 100)}% OFF
                          </span>
                          <span className="text-xs text-emerald-400">
                            Save Rs. {(parseFloat(form.price) - parseFloat(form.discount_price)).toLocaleString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}


                {/* ══════════════════════════════════════════
                    SEO & META TAGS PANEL
                    Full control: title, desc, keywords, OG,
                    canonical, schema brand/condition, noindex
                ══════════════════════════════════════════ */}
                {(() => {

                  // Auto-fill previews from product data if custom not set
                  const _previewTitle = form.meta_title || form.name || 'Product Name'
                  const _previewDesc  = form.meta_description || form.description || 'Product description for search engines…'
                  const hasDisc = form.discount_price && parseFloat(form.discount_price) < parseFloat(form.price || 0)
                  const discPct = hasDisc ? Math.round((1 - parseFloat(form.discount_price||0) / parseFloat(form.price||1)) * 100) : 0
                  const autoTitle = hasDisc
                    ? `${form.name} — Rs.${parseFloat(form.discount_price||0).toLocaleString()} | 🔥 Sale -${discPct}% | Viro.pk`
                    : `${form.name || 'Product'} | Viro.pk`
                  const autoDesc = hasDisc
                    ? `${form.name} on sale. Save Rs.${(parseFloat(form.price||0)-parseFloat(form.discount_price||0)).toLocaleString()}! Cash on delivery. Fast delivery across Pakistan.`
                    : `${form.name || 'Product'} — Available at Viro.pk. Cash on delivery. Fast delivery across Pakistan. Shop smart, live better.`
                  const autoKeywords = [
                    form.name, 'buy online pakistan', 'cash on delivery', 'viro pk',
                    'online shopping pakistan', 'fast delivery pakistan',
                  ].filter(Boolean).join(', ')

                  return (
                    <div className="rounded-2xl overflow-hidden" style={{ border:'2px solid #0EA5E940', background:'#0EA5E908' }}>
                      {/* Header — collapsible */}
                      <button type="button"
                        onClick={() => setSeoOpen(o => !o)}
                        className="w-full p-4 flex items-center justify-between"
                        style={{ background:'transparent', border:'none', cursor:'pointer' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
                            style={{ background:'linear-gradient(135deg,#0EA5E9,#8B5CF6)' }}>🔍</div>
                          <div className="text-left">
                            <p className="font-bold text-sm" style={{ color:'#38BDF8' }}>SEO &amp; Meta Tags</p>
                            <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                              {form.meta_title || form.meta_description || form.meta_keywords
                                ? '✅ Custom SEO set — click to edit'
                                : 'Auto-generated from product data · Click to customise'}
                            </p>
                          </div>
                        </div>
                        <span style={{ color:'#38BDF8', fontSize:18, transition:'transform 0.2s',
                          transform: seoOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>⌄</span>
                      </button>

                      {seoOpen && (
                        <div className="px-4 pb-4 space-y-4" style={{ borderTop:'1px solid #0EA5E930' }}>

                          {/* Live Google preview */}
                          <div className="mt-4 p-3 rounded-xl" style={{ background:'#0B1221', border:'1px solid #1E2A45' }}>
                            <p className="text-xs font-bold mb-2" style={{ color:'#94A3B8' }}>🔍 Google Search Preview</p>
                            <div style={{ fontFamily:'Arial,sans-serif' }}>
                              <p style={{ color:'#1a0dab', fontSize:17, fontWeight:400, margin:'0 0 2px',
                                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                                maxWidth:480 }}>
                                {(form.meta_title || autoTitle).slice(0, 60)}
                              </p>
                              <p style={{ color:'#006621', fontSize:12, margin:'0 0 3px' }}>
                                viro.pk/product/{editProduct?.id || 'new'} ›
                              </p>
                              <p style={{ color:'#545454', fontSize:13, margin:0, lineHeight:1.5,
                                display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                                {(form.meta_description || autoDesc).slice(0, 160)}
                              </p>
                            </div>
                            {(form.meta_title || '').length > 60 && (
                              <p className="text-xs mt-1" style={{ color:'#F97316' }}>⚠️ Title is {form.meta_title.length} chars — Google truncates after 60</p>
                            )}
                            {(form.meta_description || '').length > 160 && (
                              <p className="text-xs mt-1" style={{ color:'#F97316' }}>⚠️ Description is {form.meta_description.length} chars — Google shows ~160</p>
                            )}
                          </div>

                          {/* Meta Title */}
                          <div>
                            <label className="viro-label flex items-center justify-between">
                              <span>Meta Title (SEO) <span className="font-normal normal-case text-slate-600">— shown in Google results</span></span>
                              <span className="text-xs" style={{ color: (form.meta_title||'').length > 60 ? '#F97316' : '#64748B' }}>
                                {(form.meta_title||'').length}/60
                              </span>
                            </label>
                            <input
                              value={form.meta_title}
                              onChange={e => setForm(f => ({ ...f, meta_title: e.target.value }))}
                              placeholder={autoTitle}
                              maxLength={80}
                            />
                            <div className="flex gap-2 mt-1.5 flex-wrap">
                              {[
                                { label:'Auto', val: autoTitle },
                                { label:'+ Price', val: `${form.name||'Product'} — Rs.${parseFloat(form.price||0).toLocaleString()} | Viro.pk` },
                                { label:'+ Sale 🔥', val: `${form.name||'Product'} — Rs.${parseFloat(form.discount_price||form.price||0).toLocaleString()} | 🔥 Sale -${discPct}% | Viro.pk` },
                              ].map(t => (
                                <button key={t.label} type="button"
                                  onClick={() => setForm(f => ({ ...f, meta_title: t.val }))}
                                  className="px-2.5 py-1 rounded-full text-xs font-bold transition-all"
                                  style={{ background:'#0EA5E920', color:'#38BDF8', border:'1px solid #0EA5E940' }}>
                                  {t.label}
                                </button>
                              ))}
                              {form.meta_title && (
                                <button type="button" onClick={() => setForm(f=>({...f,meta_title:''}))}
                                  className="px-2.5 py-1 rounded-full text-xs font-bold"
                                  style={{ background:'#EF444415', color:'#F87171', border:'1px solid #EF444430' }}>
                                  Clear
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Meta Description */}
                          <div>
                            <label className="viro-label flex items-center justify-between">
                              <span>Meta Description <span className="font-normal normal-case text-slate-600">— shown under title in Google</span></span>
                              <span className="text-xs" style={{ color: (form.meta_description||'').length > 160 ? '#F97316' : '#64748B' }}>
                                {(form.meta_description||'').length}/160
                              </span>
                            </label>
                            <textarea
                              value={form.meta_description}
                              onChange={e => setForm(f => ({ ...f, meta_description: e.target.value }))}
                              placeholder={autoDesc}
                              rows={3} maxLength={200} style={{ resize:'vertical' }}
                            />
                            <div className="flex gap-2 mt-1.5 flex-wrap">
                              {[
                                { label:'Auto', val: autoDesc },
                                { label:'+ COD', val: `${form.name||'Product'} — Cash on delivery available. FREE delivery in Burewala Rs.999+, All Pakistan Rs.2499+. Shop now at Viro.pk.` },
                                { label:'+ Urgency', val: `${form.name||'Product'} — Limited stock! Order now. COD available. Fast delivery across Pakistan. Trusted by thousands of shoppers.` },
                              ].map(t => (
                                <button key={t.label} type="button"
                                  onClick={() => setForm(f => ({ ...f, meta_description: t.val.slice(0,160) }))}
                                  className="px-2.5 py-1 rounded-full text-xs font-bold transition-all"
                                  style={{ background:'#0EA5E920', color:'#38BDF8', border:'1px solid #0EA5E940' }}>
                                  {t.label}
                                </button>
                              ))}
                              {form.meta_description && (
                                <button type="button" onClick={() => setForm(f=>({...f,meta_description:''}))}
                                  className="px-2.5 py-1 rounded-full text-xs font-bold"
                                  style={{ background:'#EF444415', color:'#F87171', border:'1px solid #EF444430' }}>
                                  Clear
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Keywords */}
                          <div>
                            <label className="viro-label">
                              Keywords <span className="font-normal normal-case text-slate-600">— comma-separated, for search engines &amp; internal search</span>
                            </label>
                            <textarea
                              value={form.meta_keywords}
                              onChange={e => setForm(f => ({ ...f, meta_keywords: e.target.value }))}
                              placeholder={autoKeywords}
                              rows={2} style={{ resize:'none', fontFamily:'monospace', fontSize:12 }}
                            />
                            <div className="flex gap-2 mt-1.5 flex-wrap">
                              {[
                                { label:'Auto-fill', val: autoKeywords },
                                { label:'+ Women', val: `${form.meta_keywords ? form.meta_keywords+', ' : ''}women fashion pakistan, ladies ${form.name||'product'} online, best fashion deals pakistan` },
                                { label:'+ Delivery', val: `${form.meta_keywords ? form.meta_keywords+', ' : ''}free delivery pakistan, cod pakistan, cash on delivery online shopping` },
                                { label:'+ Sale', val: `${form.meta_keywords ? form.meta_keywords+', ' : ''}sale pakistan, best price online, discount ${form.name||'product'} pakistan` },
                              ].map(t => (
                                <button key={t.label} type="button"
                                  onClick={() => setForm(f => ({ ...f, meta_keywords: t.val }))}
                                  className="px-2.5 py-1 rounded-full text-xs font-bold transition-all"
                                  style={{ background:'#0EA5E920', color:'#38BDF8', border:'1px solid #0EA5E940' }}>
                                  {t.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* OG Title + Description */}
                          <div className="p-3 rounded-xl space-y-3" style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                            <p className="text-xs font-bold" style={{ color:'#A78BFA' }}>📱 Social Share (WhatsApp, Facebook, Twitter)</p>
                            <div>
                              <label className="viro-label">OG Title <span className="font-normal normal-case text-slate-600">— leave blank to use Meta Title</span></label>
                              <input
                                value={form.og_title}
                                onChange={e => setForm(f => ({ ...f, og_title: e.target.value }))}
                                placeholder={form.meta_title || autoTitle}
                              />
                            </div>
                            <div>
                              <label className="viro-label">OG Description <span className="font-normal normal-case text-slate-600">— leave blank to use Meta Description</span></label>
                              <textarea
                                value={form.og_description}
                                onChange={e => setForm(f => ({ ...f, og_description: e.target.value }))}
                                placeholder={form.meta_description || autoDesc}
                                rows={2} style={{ resize:'none' }}
                              />
                            </div>
                          </div>

                          {/* Advanced row: canonical + brand + condition + noindex */}
                          <div className="p-3 rounded-xl space-y-3" style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                            <p className="text-xs font-bold" style={{ color:'#94A3B8' }}>⚙️ Advanced SEO</p>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="viro-label">Schema Brand <span className="font-normal normal-case text-slate-600">(e.g. Samsung, Nike)</span></label>
                                <input
                                  value={form.schema_brand}
                                  onChange={e => setForm(f => ({ ...f, schema_brand: e.target.value }))}
                                  placeholder="Viro.pk"
                                />
                              </div>
                              <div>
                                <label className="viro-label">Condition</label>
                                <select
                                  value={form.schema_condition}
                                  onChange={e => setForm(f => ({ ...f, schema_condition: e.target.value }))}
                                  style={{ width:'100%', padding:'9px 10px', borderRadius:10, fontSize:13, background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)', color:'var(--viro-text)' }}>
                                  <option value="NewCondition">✨ New</option>
                                  <option value="UsedCondition">📦 Used</option>
                                  <option value="RefurbishedCondition">🔧 Refurbished</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="viro-label">Canonical URL <span className="font-normal normal-case text-slate-600">— leave blank for auto (https://viro.pk/product/id)</span></label>
                              <input
                                value={form.canonical_url}
                                onChange={e => setForm(f => ({ ...f, canonical_url: e.target.value }))}
                                placeholder={`https://viro.pk/product/${editProduct?.id || '{auto}'}`}
                              />
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl" style={{ background:'#EF444408', border:'1px solid #EF444425' }}>
                              <div>
                                <p className="text-sm font-bold" style={{ color: form.noindex ? '#EF4444' : 'var(--viro-textSub)' }}>🚫 Hide from Google (noindex)</p>
                                <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                                  {form.noindex ? 'Search engines will NOT index this product' : 'Product is indexable by Google (recommended)'}
                                </p>
                              </div>
                              <div
                                onClick={() => setForm(f => ({ ...f, noindex: !f.noindex }))}
                                className="relative cursor-pointer rounded-full flex-shrink-0 ml-4"
                                style={{ width:44, height:24, background: form.noindex ? '#EF4444' : 'var(--viro-border)', transition:'background 0.2s' }}>
                                <div style={{ position:'absolute', top:2, width:20, height:20, borderRadius:'50%', background:'#fff',
                                  transform: form.noindex ? 'translateX(20px)' : 'translateX(2px)', transition:'transform 0.2s',
                                  boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }} />
                              </div>
                            </div>
                          </div>

                        </div>
                      )}
                    </div>
                  )
                })()}

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={formSaving} className="btn-primary flex-1 py-3 font-bold text-sm">
                    {loading
                      ? <span className="flex items-center gap-2 justify-center">
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                          Saving…
                        </span>
                      : editProduct ? '✅ Update Product' : '➕ Add Product'}
                  </button>
                  {editProduct && (
                    <button type="button" onClick={() => resetForm(form)} className="btn-ghost px-5 py-3 text-sm">Cancel</button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── ORDERS ── */}
      {tab === 'Orders' && (
        <OrdersTab
          orders={orders}
          loading={loading}
          statusColors={statusColors}
          updateOrderStatus={updateOrderStatus}
          updateOrderPayment={updateOrderPayment}
          updateOrderInfo={updateOrderInfo}
          onReload={loadOrders}
          externalSearch={orderSearch}
          onExternalSearchConsumed={() => setOrderSearch('')}
          externalStatus={extOrderStatus}
          onExternalStatusConsumed={() => setExtOrderStatus('')}
          partnerByCoupon={partnerByCoupon}
          onViewPartner={viewPartner}
        />
      )}
      {/* ── CATEGORIES ── */}
      {tab === 'Coupons'  && <CouponsTab />}
      {tab === 'Influencers' && <InfluencersTab focusId={focusPartnerId} onFocusConsumed={() => setFocusPartnerId(null)} onDataChanged={loadPartnerMap} />}
      {tab === 'Reviews'  && <ReviewsTab />}
      {tab === 'Checkout Activity' && (
        <CheckoutActivityTab onOpenOrder={(orderId) => { goToTab('Orders'); setTimeout(() => setOrderSearch(orderId.slice(0,8)), 100) }} />
      )}

      {tab === 'Categories' && (
        <CategoriesTab
          categories={categories}
          onReload={loadCategories}
        />
      )}
      {/* ── SITE SETTINGS ── */}
      {tab === 'Deal Box' && <DealBoxTab />}
      {tab === 'Site Settings' && <SiteSettingsTab />}
      {tab === 'Customers' && <CustomersTab onOpenOrder={(orderId) => { goToTab('Orders'); if (orderId !== '__orders_tab__') setTimeout(() => setOrderSearch(orderId.slice(0,8)), 100) }} onBack={goBack} />}
      {tab === 'Analytics' && <AnalyticsDashboard onNavigate={(t, payload) => {
        goToTab(t)
        if (!payload) return
        setTimeout(() => {
          if (typeof payload === 'string') {
            // order ID
            setOrderSearch(payload.slice(0,8))
          } else if (payload.type === 'order_status') {
            setExtOrderStatus(payload.status)
          } else if (payload.type === 'product_search') {
            setExtProductSearch(payload.name)
          } else if (payload.type === 'customer_search') {
            setOrderSearch(payload.name)
          }
        }, 100)
      }} />}
        </div>{/* end page content */}
      </div>{/* end main content area */}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// ProductsTab — with bulk select, quick controls, inline timers
// ══════════════════════════════════════════════════════════════

export default AdminDashboard
