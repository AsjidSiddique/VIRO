'use client'
import Portal from './Portal'
import ShopSortPanel from './ShopSortPanel'
/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect } from 'react'
import { adminApi } from '../lib/adminApi'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteSettingsContext'

function ProductsTab({ products, categories, loading, onEdit, onDelete, onToggleVisibility: _onToggleVisibility, onToggleStatus: _onToggleStatus, onBulkUpdate: _onBulkUpdate, loadProducts, externalSearch, onExternalSearchConsumed }) {
  const { hideOutOfStock, setHideOutOfStock } = useSite()

  async function toggleHideOOS() {
    const newVal = !hideOutOfStock
    setHideOutOfStock(newVal)
    const { error } = await supabase
      .from('site_settings')
      .upsert({ key: 'hide_out_of_stock', value: newVal }, { onConflict: 'key' })
    if (error) {
      console.error('[hideOOS]', error.message)
      setHideOutOfStock(!newVal) // revert
    }
  }
  const [selected,     setSelected]     = useState(new Set())
  const [filterCat,    setFilterCat]    = useState('all')
  const [filterSubCat, setFilterSubCat] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterNoKeywords, setFilterNoKeywords] = useState(false)
  const [search,       setSearch]       = useState('')

  // External search from Dashboard click
  React.useEffect(() => {
    if (!externalSearch) return
    setSearch(externalSearch)
    setFilterCat(''); setFilterSubCat(''); setFilterStatus('all'); setFilterNoKeywords(false)
    onExternalSearchConsumed?.()
    setTimeout(() => document.getElementById('viro-main')?.scrollTo({ top:300, behavior:'smooth' }), 200)
  }, [externalSearch])
  const [bulkPanel,    setBulkPanel]    = useState(false)
  const [bulkAction,   setBulkAction]   = useState('')
  const [bulkDiscount, setBulkDiscount] = useState('')
  const [bulkLaunch,   setBulkLaunch]   = useState('')
  const [bulkSaleEnd,  setBulkSaleEnd]  = useState('')
  const [bulkTimerLabel, setBulkTimerLabel] = useState('Deal Ends In')
  const [bulkKeywords, setBulkKeywords] = useState('')
  const [bulkKeywordsMode, setBulkKeywordsMode] = useState('append') // 'append' | 'replace'
  const [priceRiseMode,   setPriceRiseMode]   = useState('percent') // 'percent' | 'fixed'
  const [priceRiseAmount, setPriceRiseAmount] = useState('')
  // SEO bulk edit state
  const [seoEditMode,     setSeoEditMode]     = useState('template') // 'template' | 'individual'
  const [sortBy,         setSortBy]         = useState('default') // 'default'|'cart'|'wishlist'|'both'
  const [cartCounts,     setCartCounts]     = useState({}) // productId -> { in_cart_qty, cart_sessions }
  const [wishlistCounts, setWishlistCounts] = useState({}) // productId -> wishlist_count

  useEffect(() => {
    async function loadCounts() {
      try {
        const [cartRes, wishRes] = await Promise.all([
          supabase.from('product_cart_counts').select('product_id,in_cart_qty,cart_sessions'),
          supabase.from('product_wishlist_counts').select('product_id,wishlist_count'),
        ])
        if (cartRes.data) {
          const map = {}
          cartRes.data.forEach(r => { map[r.product_id] = { qty: r.in_cart_qty, sessions: r.cart_sessions } })
          setCartCounts(map)
        }
        if (wishRes.data) {
          const map = {}
          wishRes.data.forEach(r => { map[r.product_id] = r.wishlist_count })
          setWishlistCounts(map)
        }
      } catch(e) { console.warn('counts load failed', e) }
    }
    loadCounts()
  }, [products]) // reload when products refresh
  const [seoTemplate,     setSeoTemplate]     = useState('') // e.g. "{name} | Buy Online in Pakistan - Viro.pk"
  const [seoIndividual,   setSeoIndividual]   = useState({}) // { [productId]: { meta_title, meta_description } }
  const [seoField,        setSeoField]        = useState('meta_title') // 'meta_title' | 'meta_description' | 'both'
  const [_bulkStatus, _setBulkStatus] = useState('')
  const [applying,     setApplying]     = useState(false)


  // ── Meta Catalog CSV Export ────────────────────────────────────────────────
  function exportCatalogCSV() {
    // Only active products with at least one image
    const activeProducts = products.filter(p => p.is_active && p.status === 'active')

    const headers = ['id','title','description','availability','condition','price','sale_price','link','image_link','brand']

    const rows = activeProducts.map(p => {
      // Extract first image URL from JSON array
      let imageLink = ''
      try {
        const imgs = typeof p.images === 'string' ? JSON.parse(p.images) : p.images
        imageLink = Array.isArray(imgs) ? (imgs.find(u => typeof u === 'string' && u.startsWith('http')) || '') : ''
      } catch { imageLink = '' }

      // Price format: "350 PKR"
      const price = p.price ? `${Math.round(Number(p.price))} PKR` : ''

      // Sale price: only if sale is active and discount_price exists
      const now = new Date()
      const saleActive = p.sale_active &&
        p.discount_price &&
        Number(p.discount_price) < Number(p.price) &&
        (!p.sale_ends_at || new Date(p.sale_ends_at) > now)
      const salePrice = saleActive ? `${Math.round(Number(p.discount_price))} PKR` : ''

      // Availability
      const availability = (p.stock > 0) ? 'in stock' : 'out of stock'

      // Description: meta_description first, fall back to description, then auto-generate
      const desc = (p.meta_description || p.description || `${p.name}. Cash on delivery. Fast delivery across Pakistan.`).slice(0, 500)

      // Product link using slugified name
      const slug = (p.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const link = `https://viro.pk/product/${slug}-${p.id}`

      const row = [
        `viro-${p.id}`,
        p.name || '',
        desc,
        availability,
        'new',
        price,
        salePrice,
        link,
        imageLink,
        'Viro',
      ]

      // Wrap fields that may contain commas/quotes in double quotes
      return row.map(field => {
        const str = String(field ?? '')
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }).join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `viro-catalog-${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  // ── End CSV Export ─────────────────────────────────────────────────────────

  const parentCats = (categories||[]).filter(c => !c.parent_id)

  const filtered = products.filter(p => {
    if (search && !p.name?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterCat !== 'all') {
      const childIds = (categories||[]).filter(c=>c.parent_id===filterCat).map(c=>c.id)
      if (p.category_id !== filterCat && !childIds.includes(p.category_id)) return false
      // Sub-filter: if a specific subcategory is selected, narrow further
      if (filterSubCat !== 'all') {
        const subChildIds = (categories||[]).filter(c=>c.parent_id===filterSubCat).map(c=>c.id)
        if (p.category_id !== filterSubCat && !subChildIds.includes(p.category_id)) return false
      }
    }
    if (filterStatus !== 'all') {
      if (filterStatus === 'hidden') {
        // Hidden = is_active is false
        if (p.is_active !== false) return false
      } else if (filterStatus === 'out_of_stock') {
        // Out of stock = status is out_of_stock OR stock is 0/null
        const isStatusOOS = p.status === 'out_of_stock'
        const isStockZero = (p.stock !== undefined && p.stock !== null && p.stock <= 0)
        if (!isStatusOOS && !isStockZero) return false
      } else {
        if (p.status !== filterStatus) return false
      }
    }
    if (filterNoKeywords && p.search_keywords?.trim()) return false
    return true
  })

  // Sort filtered list
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'cart')    return (cartCounts[b.id]?.qty||0) - (cartCounts[a.id]?.qty||0)
    if (sortBy === 'wishlist') return (wishlistCounts[b.id]||0) - (wishlistCounts[a.id]||0)
    if (sortBy === 'both')    return ((cartCounts[b.id]?.qty||0)+(wishlistCounts[b.id]||0)) - ((cartCounts[a.id]?.qty||0)+(wishlistCounts[a.id]||0))
    return 0
  })

  const allSelected  = sorted.length > 0 && sorted.every(p => selected.has(p.id))
  const someSelected = selected.size > 0
  const displayCount = sorted.length

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(sorted.map(p => p.id)))
  }
  function toggle(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function deselect(id) { setSelected(s => { const n = new Set(s); n.delete(id); return n }) }

  async function applyBulk() {
    if (!selected.size) return
    setApplying(true)
    const ids = [...selected]
    let patch = {}

    if (bulkAction === 'hide')       patch = { is_active: false }
    if (bulkAction === 'show')       patch = { is_active: true }
    if (bulkAction === 'coming_soon')patch = { status: 'coming_soon' }
    if (bulkAction === 'active')     patch = { status: 'active' }
    if (bulkAction === 'out_of_stock') patch = { status: 'out_of_stock' }
    if (bulkAction === 'discount' && bulkDiscount) {
      // Apply % discount to each product individually.
      // IMPORTANT: always clear sale_ends_at so any old expired timer
      // doesn't block the new discount from being shown (v46 fix).
      for (const id of ids) {
        const prod = products.find(p => p.id === id)
        if (prod?.price) {
          const disc = prod.price * (1 - parseFloat(bulkDiscount)/100)
          await adminApi('product_update', { id, patch: {
            discount_price: Math.round(disc),
            sale_active:    false,   // no timer — permanent discount until removed
            sale_ends_at:   null,    // clear any old expired timer
          }})
        }
      }
      loadProducts(); setApplying(false); setBulkPanel(false); setSelected(new Set()); return
    }
    if (bulkAction === 'remove_discount') patch = { discount_price: null, sale_active: false, sale_ends_at: null }
    if (bulkAction === 'launch_timer' && bulkLaunch) patch = { launch_at: new Date(bulkLaunch).toISOString(), status: 'coming_soon' }
    if (bulkAction === 'sale_timer' && bulkSaleEnd)  patch = { sale_ends_at: new Date(bulkSaleEnd).toISOString(), sale_active: true, countdown_label: bulkTimerLabel || 'Deal Ends In' }
    if (bulkAction === 'clear_timers') patch = { launch_at: null, sale_ends_at: null, sale_active: false, countdown_ends_at: null }
    if (bulkAction === 'seo_bulk') {
      if (seoEditMode === 'template' && seoTemplate.trim()) {
        for (const id of ids) {
          const prod = products.find(p => p.id === id)
          if (!prod) continue
          // Replace {name} placeholder with actual product name
          const discPct = prod.discount_price && prod.price
            ? Math.round((1 - prod.discount_price/prod.price)*100) : 0
          const filled = seoTemplate
            .replace(/{name}/g, prod.name)
            .replace(/{price}/g, prod.discount_price || prod.price)
            .replace(/{category}/g, prod.category_name || '')
            .replace(/{discount}/g, discPct)
            .replace(/{sale_price}/g, prod.discount_price || '')
          const seoData = {}
          if (seoField === 'meta_title' || seoField === 'both') seoData.meta_title = filled.slice(0, 70)
          if (seoField === 'meta_description' || seoField === 'both') seoData.meta_description = filled.slice(0, 160)
          await adminApi('product_update', { id, patch: seoData })
        }
      } else if (seoEditMode === 'individual') {
        for (const id of ids) {
          const vals = seoIndividual[id]
          if (!vals) continue
          const seoData = {}
          if ((seoField === 'meta_title' || seoField === 'both') && vals.meta_title?.trim()) seoData.meta_title = vals.meta_title.slice(0, 70)
          if ((seoField === 'meta_description' || seoField === 'both') && vals.meta_description?.trim()) seoData.meta_description = vals.meta_description.slice(0, 160)
          if (Object.keys(seoData).length) await adminApi('product_update', { id, patch: seoData })
        }
      }
      loadProducts(); setApplying(false); setBulkPanel(false); setSelected(new Set())
      setSeoTemplate(''); setSeoIndividual({}); return
    }
    if (bulkAction === 'price_rise' && priceRiseAmount) {
      // Rise the DISCOUNT (sale) price for products that have one, else rise base price
      for (const id of ids) {
        const prod = products.find(p => p.id === id)
        if (!prod) continue
        const rise = parseFloat(priceRiseAmount)
        // BUGFIX: this used to skip anything <= 0, meaning a negative value
        // (entered specifically to DECREASE price/create a sale) was
        // silently rejected — nothing ever got saved, no error shown either.
        // Only truly empty/invalid input should be skipped now.
        if (isNaN(rise) || rise === 0) continue
        // If product has a sale/discount price — rise that
        if (prod.discount_price) {
          let newDisc = priceRiseMode === 'percent'
            ? Math.round(prod.discount_price * (1 + rise/100))
            : Math.round(prod.discount_price + rise)
          // also rise base price by same amount so margin stays
          let newBase = priceRiseMode === 'percent'
            ? Math.round(prod.price * (1 + rise/100))
            : Math.round(prod.price + rise)
          // Safety floor — a large negative % or fixed-Rs decrease should
          // never be able to push a price to zero or negative.
          newDisc = Math.max(1, newDisc)
          newBase = Math.max(newDisc + 1, newBase)
          await adminApi('product_update', { id, patch: { price: newBase, discount_price: newDisc } })
        } else {
          // No sale price — rise base price only
          let newBase = priceRiseMode === 'percent'
            ? Math.round(prod.price * (1 + rise/100))
            : Math.round(prod.price + rise)
          newBase = Math.max(1, newBase)
          await adminApi('product_update', { id, patch: { price: newBase } })
        }
      }
      loadProducts(); setApplying(false); setBulkPanel(false); setSelected(new Set()); return
    }

    if (bulkAction === 'add_keywords' && bulkKeywords.trim()) {
      const newWords = bulkKeywords.split(',').map(w => w.trim()).filter(Boolean)
      for (const id of ids) {
        const prod = products.find(p => p.id === id)
        if (!prod) continue
        let finalWords
        if (bulkKeywordsMode === 'replace') {
          finalWords = newWords
        } else {
          const existing = (prod.search_keywords || '').split(',').map(w => w.trim()).filter(Boolean)
          // existing keywords keep their rank (stay first), new ones added after, no duplicates
          const existingLower = existing.map(w => w.toLowerCase())
          finalWords = [...existing, ...newWords.filter(w => !existingLower.includes(w.toLowerCase()))]
        }
        await adminApi('product_update', { id, patch: { search_keywords: finalWords.join(', ') } })
      }
      loadProducts(); setApplying(false); setBulkPanel(false); setSelected(new Set()); setBulkKeywords(''); return
    }

    if (Object.keys(patch).length) {
      await adminApi('product_update', { ids, patch })
    }
    loadProducts()
    setApplying(false)
    setBulkPanel(false)
    setSelected(new Set())
  }

  const STATUS_COLORS = {
    active:'#10B981', coming_soon:'#8B5CF6', out_of_stock:'#EF4444', coming_soon_hidden:'#F97316'
  }

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center gap-2">
      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="3"/>
        <path className="opacity-75" fill="#8B5CF6" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      <span style={{ color:'var(--viro-textSub)' }}>Loading…</span>
    </div>
  )

  return (
    <div className="px-3 md:px-4 pb-6 fade-in">

      {/* ── Search + category + status filters ── */}
      <div className="space-y-2 mb-3">
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Search products…"
          style={{ background:'var(--viro-bgCard)', borderColor:'var(--viro-border)' }} />
        <div className="flex gap-2 flex-wrap">
          <select value={filterCat} onChange={e=>{setFilterCat(e.target.value);setFilterSubCat('all')}}
            className="flex-1 text-sm rounded-xl" style={{ padding:'8px 10px', minWidth:0 }}>
            <option value="all">All Categories</option>
            {parentCats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          {/* Subcategory filter — shown when a parent is selected and has children */}
          {filterCat !== 'all' && (categories||[]).filter(c=>c.parent_id===filterCat).length > 0 && (
            <select value={filterSubCat} onChange={e=>setFilterSubCat(e.target.value)}
              className="flex-1 text-sm rounded-xl" style={{ padding:'8px 10px', minWidth:0, borderColor:'#8B5CF6' }}>
              <option value="all">All Sub-categories</option>
              {(categories||[]).filter(c=>c.parent_id===filterCat).map(c =>
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              )}
            </select>
          )}
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
            className="flex-1 text-sm rounded-xl" style={{ padding:'8px 10px', minWidth:0 }}>
            <option value="all">All Status</option>
            <option value="active">✅ Active</option>
            <option value="coming_soon">🚀 Coming Soon</option>
            <option value="out_of_stock">⛔ Out of Stock (incl. 0 stock)</option>
            <option value="hidden">🙈 Hidden (is_active = off)</option>
          </select>
          <button onClick={() => setFilterNoKeywords(v => !v)}
            title="Show only products with no Search Keywords tagged — these won't get any search-ranking or 'You May Also Like' priority boost"
            className="text-sm font-bold rounded-xl whitespace-nowrap flex-shrink-0"
            style={{
              padding: '8px 12px', cursor: 'pointer', transition: 'all 0.2s',
              background: filterNoKeywords ? 'linear-gradient(135deg,#EC4899,#DB2777)' : 'var(--viro-bgDeep)',
              color: filterNoKeywords ? '#fff' : 'var(--viro-textSub)',
              border: filterNoKeywords ? 'none' : '1px solid var(--viro-border)',
            }}>
            🏷️ No Keywords ({products.filter(p => !p.search_keywords?.trim()).length})
          </button>
        </div>
      </div>


      {/* ── Meta Catalog CSV Export ── */}
      <div className="flex justify-end mb-2">
        <button
          onClick={exportCatalogCSV}
          title={`Download Meta product catalog CSV (${products.filter(p=>p.is_active&&p.status==='active').length} active products)`}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)', border: 'none', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export Meta Catalog CSV ({products.filter(p=>p.is_active&&p.status==='active').length} products)
        </button>
        <ShopSortPanel products={products} onSaved={() => loadProducts()} />
        <button onClick={toggleHideOOS}
          style={{
            display:'flex', alignItems:'center', gap:7, padding:'8px 14px',
            borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:12,
            flexShrink:0, transition:'all 0.2s', border:'none',
            background: hideOutOfStock
              ? 'linear-gradient(135deg,#EF4444,#DC2626)'
              : 'var(--viro-bgDeep)',
            color: hideOutOfStock ? '#fff' : 'var(--viro-textSub)',
            outline: hideOutOfStock ? 'none' : '1px solid var(--viro-border)',
          }}>
          <span>{hideOutOfStock ? '🚫' : '✅'}</span>
          <span>{hideOutOfStock ? 'OOS Hidden' : 'Show All (incl. OOS)'}</span>
          <div style={{ width:28, height:16, borderRadius:8, position:'relative', flexShrink:0,
            background: hideOutOfStock ? 'rgba(255,255,255,0.3)' : 'var(--viro-border)' }}>
            <div style={{ position:'absolute', top:2,
              left: hideOutOfStock ? 12 : 2,
              width:12, height:12, borderRadius:'50%',
              background: hideOutOfStock ? '#fff' : '#94A3B8',
              transition:'left 0.2s' }}/>
          </div>
        </button>
      </div>

      {/* ── Popular sort chips ── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span style={{ fontSize:11,color:'var(--viro-textSub)',fontWeight:600 }}>Sort by:</span>
        {[
          { v:'default',  l:'Default' },
          { v:'cart',     l:'🛒 Most in Carts' },
          { v:'wishlist', l:'♥ Most Wishlisted' },
          { v:'both',     l:'🔥 Most Popular' },
        ].map(opt => (
          <button key={opt.v} onClick={() => setSortBy(opt.v)}
            className="text-xs font-bold px-3 py-1 rounded-full transition-all"
            style={{
              background: sortBy===opt.v ? 'linear-gradient(135deg,#7C3AED,#4F46E5)' : 'var(--viro-bgDeep)',
              color: sortBy===opt.v ? '#fff' : 'var(--viro-textSub)',
              border: '1px solid ' + (sortBy===opt.v ? 'transparent' : 'var(--viro-border)'),
              cursor:'pointer',
            }}>
            {opt.l}
          </button>
        ))}
        {sortBy !== 'default' && (
          <span style={{ fontSize:11,color:'var(--viro-textSub)' }}>
            — showing {sorted.filter(p => sortBy==='cart' ? (cartCounts[p.id]?.qty||0)>0 : sortBy==='wishlist' ? (wishlistCounts[p.id]||0)>0 : ((cartCounts[p.id]?.qty||0)+(wishlistCounts[p.id]||0))>0).length} products with activity
          </span>
        )}
      </div>

      {/* ── Select all + bulk action bar ── */}
      <div className="flex items-center justify-between mb-3 px-1">
        <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold"
          style={{ color:'var(--viro-text)' }}>
          <input type="checkbox" checked={allSelected} onChange={toggleAll}
            style={{ width:16, height:16, accentColor:'#8B5CF6', cursor:'pointer' }} />
          {someSelected ? `${selected.size} selected` : `Select All (${sorted.length})`}
        </label>

        {someSelected && (
          <button onClick={() => setBulkPanel(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
            style={{ background:'linear-gradient(135deg,#8B5CF6,#F97316)' }}>
            ⚡ Bulk Action ({selected.size})
          </button>
        )}
        {someSelected && (
          <button onClick={() => setSelected(new Set())}
            className="text-xs" style={{ color:'var(--viro-textSub)' }}>
            Deselect
          </button>
        )}
      </div>

      {/* ── Products list ── */}
      {sorted.length === 0 ? (
        <div className="text-center py-10" style={{ color:'var(--viro-textSub)' }}>
          <div className="text-4xl mb-2">📦</div>
          <p className="font-semibold" style={{ color:'var(--viro-text)' }}>No products found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(p => {
            const imgs     = Array.isArray(p.images) ? p.images : JSON.parse(p.images||'[]')
            const thumb    = imgs[0] || 'https://placehold.co/100/1E293B/8B5CF6?text=V'
            const hasDisc  = p.discount_price && p.discount_price < p.price
            const isSelected = selected.has(p.id)
            const sc       = STATUS_COLORS[p.status] || '#94A3B8'
            const hasLaunch= p.launch_at && new Date(p.launch_at) > new Date()
            const hasSale  = p.sale_active && p.sale_ends_at && new Date(p.sale_ends_at) > new Date()

            return (
              <div key={p.id}
                className="rounded-2xl overflow-hidden transition-all cursor-pointer group"
                onClick={e => {
                  // Don't open edit if clicking checkbox or action buttons
                  if (e.target.closest('button') || e.target.closest('input[type=checkbox]')) return
                  onEdit(p)
                }}
                style={{
                  background:'var(--viro-bgCard)',
                  border: isSelected ? '2px solid #8B5CF6' : '1px solid var(--viro-border)',
                  boxShadow: isSelected ? '0 0 0 3px #8B5CF620' : '0 1px 3px rgba(0,0,0,0.1)',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                }}>
                {/* Main row */}
                <div className="p-3 flex gap-3 items-start">
                  {/* Checkbox */}
                  <input type="checkbox" checked={isSelected}
                    onChange={e => { e.stopPropagation(); toggle(p.id) }}
                    onClick={e => e.stopPropagation()}
                    className="mt-1 flex-shrink-0"
                    style={{ width:16, height:16, accentColor:'#8B5CF6', cursor:'pointer' }} />

                  {/* Thumbnail */}
                  <div className="relative flex-shrink-0">
                    <img src={thumb} alt={p.name} className="w-16 h-16 rounded-xl object-cover group-hover:opacity-90 transition-opacity" />
                    {imgs.length > 1 && (
                      <span className="absolute -bottom-1 -right-1 text-xs rounded-full w-5 h-5 flex items-center justify-center"
                        style={{ background:'var(--viro-bgDeep)', color:'var(--viro-textSub)', border:'1px solid var(--viro-border)', fontSize:9 }}>
                        {imgs.length}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-bold text-sm leading-tight" style={{ color:'var(--viro-text)' }}>{p.name}</p>
                      <span className="text-xs flex-shrink-0 ml-1" style={{ color:'var(--viro-textSub)' }}>
                        {p.categories?.icon}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-sm font-black" style={{ color:'#A78BFA' }}>
                        Rs.{(hasDisc?p.discount_price:p.price)?.toLocaleString()}
                      </span>
                      {hasDisc && (
                        <>
                          <span className="text-xs line-through" style={{ color:'var(--viro-textSub)' }}>Rs.{p.price?.toLocaleString()}</span>
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background:'#10B98120', color:'#10B981' }}>
                            -{Math.round((1-p.discount_price/p.price)*100)}%
                          </span>
                        </>
                      )}
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                        style={{ background:sc+'20', color:sc }}>
                        {p.status==='coming_soon' ? '🚀 Soon'
                          : p.status==='out_of_stock' ? '⛔ Out'
                          : (
                            <span style={{ fontSize:10 }}>
                              <span style={{ fontWeight:800 }}>{p.stock}</span>
                              <span style={{ color:'var(--viro-textSub)' }}> stk</span>
                              
                              {(p.stock_complete ?? 0) > 0 && (
                                <span> · <span style={{ color:'#10B981', fontWeight:700 }}>{p.stock_complete}✓</span>
                                {p.show_order_count && <span style={{ color:'#F97316', fontSize:8 }}> 🔥</span>}
                                </span>
                              )}
                            </span>
                          )}
                      </span>
                      {p.is_active===false && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background:'#F9731620', color:'#F97316' }}>🙈 Hidden</span>
                      )}
                      {hasLaunch && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background:'#8B5CF620', color:'#A78BFA' }}>🚀 Launches {new Date(p.launch_at).toLocaleDateString('en-PK')}</span>}
                      {hasSale   && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background:'#F9731620', color:'#F97316' }}>🔥 Sale until {new Date(p.sale_ends_at).toLocaleDateString('en-PK')}</span>}
                      {/* Cart & Wishlist counts */}
                      {(cartCounts[p.id]?.qty > 0) && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background:'#7C3AED18', color:'#7C3AED', fontWeight:700 }}>
                          🛒 {cartCounts[p.id].qty} in {cartCounts[p.id].sessions} cart{cartCounts[p.id].sessions!==1?'s':''}
                        </span>
                      )}
                      {(wishlistCounts[p.id] > 0) && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background:'#EC489920', color:'#EC4899', fontWeight:700 }}>
                          ♥ {wishlistCounts[p.id]} wishlisted
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick actions — vertical stack */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => onEdit(p)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                      style={{ background:'#8B5CF615', border:'1px solid #8B5CF640', color:'#A78BFA' }}>
                      ✏️
                    </button>
                    <button
                      onClick={async () => {
                        await adminApi('product_update', { id: p.id, patch: { is_active: p.is_active === false } })
                        loadProducts()
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                      style={p.is_active===false
                        ? { background:'#10B98115', border:'1px solid #10B98140', color:'#10B981' }
                        : { background:'#F9731315', border:'1px solid #F9731340', color:'#FB923C' }}>
                      {p.is_active===false ? '👁' : '🙈'}
                    </button>
                    <button onClick={() => onDelete(p.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                      style={{ background:'#EF444415', border:'1px solid #EF444430', color:'#F87171' }}>
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Quick inline controls row */}
                <div className="px-3 pb-2.5 flex gap-1.5 flex-wrap border-t" style={{ borderColor:'var(--viro-border)', paddingTop:8 }}>
                  {/* Status quick set */}
                  {['active','coming_soon','out_of_stock'].map(s => (
                    <button key={s}
                      onClick={async () => {
                        await adminApi('product_update', { id: p.id, patch: { status:s, ...(s==='active'?{is_active:true}:{}) } })
                        loadProducts()
                      }}
                      className="px-2 py-1 rounded-lg text-xs font-semibold transition-all"
                      style={p.status===s
                        ? { background:(STATUS_COLORS[s]||'#94A3B8')+'30', color:STATUS_COLORS[s]||'#94A3B8', border:`1px solid ${(STATUS_COLORS[s]||'#94A3B8')}60` }
                        : { background:'var(--viro-bgDeep)', color:'var(--viro-textSub)', border:'1px solid var(--viro-border)' }}>
                      {s==='active'?'✅ Active':s==='coming_soon'?'🚀 Soon':'⛔ Out'}
                    </button>
                  ))}
                  {/* Quick discount remove */}
                  {hasDisc && (
                    <button
                      onClick={async () => {
                        await adminApi('product_update', { id: p.id, patch: { discount_price:null, sale_active:false, sale_ends_at:null } })
                        loadProducts()
                      }}
                      className="px-2 py-1 rounded-lg text-xs font-semibold"
                      style={{ background:'#EF444415', color:'#F87171', border:'1px solid #EF444430' }}>
                      ✕ Discount
                    </button>
                  )}
                  {/* Clear timers if any */}
                  {(hasLaunch||hasSale) && (
                    <button
                      onClick={async () => {
                        await adminApi('product_update', { id: p.id, patch: { launch_at:null, sale_ends_at:null, sale_active:false } })
                        loadProducts()
                      }}
                      className="px-2 py-1 rounded-lg text-xs font-semibold"
                      style={{ background:'#8B5CF615', color:'#A78BFA', border:'1px solid #8B5CF640' }}>
                      ⏹ Clear Timers
                    </button>
                  )}

                  {/* ── Reviews per-product toggle ── */}
                  <button
                    title={p.reviews_enabled !== false ? 'Disable reviews for this product' : 'Enable reviews'}
                    onClick={async e => {
                      e.stopPropagation()
                      await adminApi('product_update', { id: p.id, patch: { reviews_enabled: p.reviews_enabled === false } })
                      loadProducts()
                    }}
                    style={{
                      fontSize:10, padding:'3px 8px', borderRadius:8, cursor:'pointer', border:'none',
                      background: p.reviews_enabled !== false ? '#FBBF2415' : '#1E293B',
                      color:      p.reviews_enabled !== false ? '#FBBF24'   : '#64748B',
                      fontWeight:700,
                      outline: p.reviews_enabled !== false ? '1.5px solid #FBBF2440' : '1px solid #334155',
                    }}>
                    {p.reviews_enabled !== false ? '⭐ Reviews ON' : '⭐ Reviews OFF'}
                  </button>

                  {/* ── Order badge per-product toggle ── */}
                  <button
                    title={p.show_order_count ? 'Hide order count badge' : 'Show order count badge'}
                    onClick={async e => {
                      e.stopPropagation()
                      await adminApi('product_update', { id: p.id, patch: { show_order_count: !p.show_order_count } })
                      loadProducts()
                    }}
                    style={{
                      fontSize:10, padding:'3px 8px', borderRadius:8, cursor:'pointer', border:'none',
                      background: p.show_order_count ? '#F9731615' : '#1E293B',
                      color:      p.show_order_count ? '#F97316'   : '#64748B',
                      fontWeight:700,
                      outline: p.show_order_count ? '1.5px solid #F9731640' : '1px solid #334155',
                    }}>
                    {p.show_order_count ? '🔥 Badge ON' : '🔥 Badge OFF'}
                  </button>

                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          BULK ACTION MODAL
      ══════════════════════════════════════════════════════ */}
      {bulkPanel && (
        <Portal>
        <div className="fixed inset-0 z-[999] flex items-end md:items-center justify-center"
          style={{ background:'rgba(0,0,0,0.65)', backdropFilter:'blur(6px)' }}
          onClick={e => e.target===e.currentTarget && setBulkPanel(false)}>
          <div className="w-full max-w-lg rounded-t-3xl md:rounded-3xl overflow-hidden"
            style={{ background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)',
              maxHeight:'90vh', display:'flex', flexDirection:'column',
              animation:'popIn 0.3s cubic-bezier(.4,0,.2,1)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor:'var(--viro-border)' }}>
              <div>
                <h2 className="font-extrabold text-base" style={{ color:'var(--viro-text)' }}>
                  ⚡ Bulk Action
                </h2>
                <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                  Apply to {selected.size} selected product{selected.size!==1?'s':''}
                </p>
              </div>
              <button onClick={() => setBulkPanel(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background:'var(--viro-bgDeep)', color:'var(--viro-textSub)' }}>✕</button>
            </div>

            {/* Category filter for deselecting */}
            <div className="px-5 py-3 border-b" style={{ borderColor:'var(--viro-border)' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color:'var(--viro-textSub)' }}>
                Selected products:
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {[...selected].map(id => {
                  const p = products.find(x=>x.id===id)
                  if (!p) return null
                  return (
                    <span key={id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background:'#8B5CF620', color:'#A78BFA', border:'1px solid #8B5CF640' }}>
                      {p.name.slice(0,20)}{p.name.length>20?'…':''}
                      <button onClick={() => deselect(id)} className="text-xs opacity-60 hover:opacity-100 ml-0.5">✕</button>
                    </span>
                  )
                })}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

              {/* Action selector */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color:'var(--viro-textSub)' }}>Choose Action</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v:'show',           l:'👁 Show All',          c:'#10B981' },
                    { v:'hide',           l:'🙈 Hide All',          c:'#F97316' },
                    { v:'active',         l:'✅ Set Active',         c:'#10B981' },
                    { v:'coming_soon',    l:'🚀 Set Coming Soon',   c:'#8B5CF6' },
                    { v:'out_of_stock',   l:'⛔ Set Out of Stock',  c:'#EF4444' },
                    { v:'discount',       l:'💸 Set % Discount',    c:'#00BFFF' },
                    { v:'remove_discount',l:'✕ Remove Discount',   c:'#94A3B8' },
                    { v:'launch_timer',   l:'🚀 Set Launch Timer',  c:'#A78BFA' },
                    { v:'sale_timer',     l:'🔥 Set Sale Timer',    c:'#F97316' },
                    { v:'clear_timers',   l:'⏹ Clear All Timers',  c:'#64748B' },
                    { v:'price_rise',      l:'📈 Rise Price/Sale',   c:'#F59E0B' },
                    { v:'seo_bulk',        l:'🔍 Bulk SEO Titles',   c:'#06B6D4' },
                    { v:'add_keywords',    l:'🏷️ Add Keywords',      c:'#EC4899' },
                  ].map(a => (
                    <button key={a.v} onClick={() => setBulkAction(a.v)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-left transition-all"
                      style={bulkAction===a.v
                        ? { background:a.c+'25', color:a.c, border:`1px solid ${a.c}60` }
                        : { background:'var(--viro-bgDeep)', color:'var(--viro-textMuted)', border:'1px solid var(--viro-border)' }}>
                      {a.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Discount % input */}
              {bulkAction==='discount' && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>
                    Discount Percentage (%)
                  </label>
                  <input type="number" value={bulkDiscount} onChange={e=>setBulkDiscount(e.target.value)}
                    placeholder="e.g. 20 for 20% off" min="1" max="99" />
                  <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
                    Each product's discount price will be set to original price × (1 - %/100)
                  </p>
                </div>
              )}

              {/* Price rise input */}
              {bulkAction==='price_rise' && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color:'var(--viro-textSub)' }}>
                    Rise Mode
                  </p>
                  {/* Toggle: percent vs fixed */}
                  <div className="flex gap-2 mb-3">
                    <button onClick={() => setPriceRiseMode('percent')}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                      style={ priceRiseMode==='percent'
                        ? { background:'#F59E0B25',color:'#F59E0B',border:'2px solid #F59E0B60' }
                        : { background:'var(--viro-bgDeep)',color:'var(--viro-textMuted)',border:'1px solid var(--viro-border)' }}>
                      📈 By % (e.g. 5% rise)
                    </button>
                    <button onClick={() => setPriceRiseMode('fixed')}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                      style={ priceRiseMode==='fixed'
                        ? { background:'#F59E0B25',color:'#F59E0B',border:'2px solid #F59E0B60' }
                        : { background:'var(--viro-bgDeep)',color:'var(--viro-textMuted)',border:'1px solid var(--viro-border)' }}>
                      💰 By Fixed Rs.
                    </button>
                  </div>
                  <label className="text-xs font-bold block mb-1" style={{ color:'var(--viro-textSub)' }}>
                    {priceRiseMode==='percent' ? 'Rise by % (e.g. 5 = +5%)' : 'Rise by Rs. amount (e.g. 100)'}
                  </label>
                  <input type="number" value={priceRiseAmount} onChange={e=>setPriceRiseAmount(e.target.value)}
                    placeholder={priceRiseMode==='percent' ? 'e.g. 5' : 'e.g. 100'} min="1" />
                  <div className="mt-2 p-2 rounded-xl text-xs" style={{ background:'#F59E0B10',border:'1px solid #F59E0B30',color:'#F59E0B' }}>
                    {priceRiseMode==='percent'
                      ? '📈 If a product has a sale price, both base + sale price rise by this %. If no sale price, only base rises.'
                      : `💰 Adds Rs.${priceRiseAmount||'?'} to both base price and sale price (if any). Great for uniform cost increase.`}
                  </div>
                  {/* Live preview */}
                  {priceRiseAmount && selected.size > 0 && (
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      <p className="text-xs font-bold" style={{ color:'var(--viro-textSub)' }}>Preview (first 5):</p>
                      {[...selected].slice(0,5).map(id => {
                        const p = products.find(x=>x.id===id)
                        if (!p) return null
                        const rise = parseFloat(priceRiseAmount)
                        const newBase = priceRiseMode==='percent' ? Math.round(p.price*(1+rise/100)) : Math.round(p.price+rise)
                        const newDisc = p.discount_price
                          ? priceRiseMode==='percent' ? Math.round(p.discount_price*(1+rise/100)) : Math.round(p.discount_price+rise)
                          : null
                        return (
                          <div key={id} className="flex justify-between text-xs px-2 py-1 rounded-lg"
                            style={{ background:'var(--viro-bgDeep)' }}>
                            <span style={{ color:'var(--viro-textSub)',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{p.name}</span>
                            <span style={{ color:'#10B981',fontWeight:700 }}>
                              Rs.{p.price}→{newBase}
                              {newDisc && <span style={{ color:'#F97316' }}> · sale: Rs.{p.discount_price}→{newDisc}</span>}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SEO Bulk Edit */}
              {bulkAction==='seo_bulk' && (
                <div>
                  {/* Which field */}
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color:'var(--viro-textSub)' }}>Which SEO Field</p>
                  <div className="flex gap-2 mb-4">
                    {[['meta_title','🔍 Meta Title (Google headline)'],['meta_description','📝 Meta Description'],['both','Both']].map(([v,l]) => (
                      <button key={v} onClick={() => setSeoField(v)}
                        className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                        style={ seoField===v
                          ? { background:'#06B6D425',color:'#06B6D4',border:'2px solid #06B6D460' }
                          : { background:'var(--viro-bgDeep)',color:'var(--viro-textMuted)',border:'1px solid var(--viro-border)' }}>
                        {l}
                      </button>
                    ))}
                  </div>

                  {/* Mode toggle */}
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color:'var(--viro-textSub)' }}>Edit Mode</p>
                  <div className="flex gap-2 mb-4">
                    <button onClick={() => setSeoEditMode('template')}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                      style={ seoEditMode==='template'
                        ? { background:'#06B6D425',color:'#06B6D4',border:'2px solid #06B6D460' }
                        : { background:'var(--viro-bgDeep)',color:'var(--viro-textMuted)',border:'1px solid var(--viro-border)' }}>
                      ⚡ Template (apply same pattern to all)
                    </button>
                    <button onClick={() => {
                      setSeoEditMode('individual')
                      // Pre-fill with existing values
                      const prefill = {}
                      ;[...selected].forEach(id => {
                        const p = products.find(x=>x.id===id)
                        if (p) prefill[id] = { meta_title: p.meta_title||'', meta_description: p.meta_description||'' }
                      })
                      setSeoIndividual(prefill)
                    }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                      style={ seoEditMode==='individual'
                        ? { background:'#06B6D425',color:'#06B6D4',border:'2px solid #06B6D460' }
                        : { background:'var(--viro-bgDeep)',color:'var(--viro-textMuted)',border:'1px solid var(--viro-border)' }}>
                      ✏️ Individual (edit each one)
                    </button>
                  </div>

                  {/* Template mode */}
                  {seoEditMode==='template' && (
                    <div>
                      <label className="text-xs font-bold block mb-1" style={{ color:'var(--viro-textSub)' }}>
                        Template — use {'{name}'}, {'{price}'}, {'{category}'} as placeholders
                      </label>
                      <input value={seoTemplate} onChange={e=>setSeoTemplate(e.target.value)}
                        placeholder="e.g. {name} | Buy Online in Pakistan – Viro.pk"
                        maxLength={seoField==='meta_description'?160:70} />
                      <div className="flex justify-between mt-1">
                        <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                          {seoField==='meta_title'||seoField==='both' ? 'Max 70 chars for title · ' : ''}
                          {seoField==='meta_description'||seoField==='both' ? 'Max 160 chars for description' : ''}
                        </p>
                        <p className="text-xs font-bold" style={{ color: seoTemplate.length>65?'#F97316':'#10B981' }}>
                          {seoTemplate.length} chars
                        </p>
                      </div>
                      {/* Google preview */}
                      {seoTemplate.trim() && (
                        <div className="mt-3 p-3 rounded-xl" style={{ background:'#06B6D410',border:'1px solid #06B6D430' }}>
                          <p className="text-xs font-bold mb-2" style={{ color:'#06B6D4' }}>🔍 Google Preview (first product)</p>
                          {(() => {
                            const first = [...selected][0]
                            const p = products.find(x=>x.id===first)
                            if (!p) return null
                            const discPct2 = p.discount_price && p.price
                              ? Math.round((1-p.discount_price/p.price)*100) : 0
                            const filled = seoTemplate
                              .replace(/{name}/g, p.name)
                              .replace(/{price}/g, p.discount_price||p.price)
                              .replace(/{category}/g, '')
                              .replace(/{discount}/g, discPct2)
                              .replace(/{sale_price}/g, p.discount_price||'')
                            return (
                              <div style={{ background:'white',borderRadius:8,padding:'10px 12px' }}>
                                <p style={{ color:'#1a0dab',fontSize:13,fontWeight:600,margin:0,lineHeight:1.3 }}>
                                  {filled.slice(0,70)}
                                </p>
                                <p style={{ color:'#006621',fontSize:11,margin:'2px 0' }}>viro.pk › product › {p.id?.slice(0,8)}</p>
                                {seoField==='meta_description'||seoField==='both'
                                  ? <p style={{ color:'#545454',fontSize:12,margin:0 }}>{filled.slice(0,160)}</p>
                                  : <p style={{ color:'#545454',fontSize:12,margin:0 }}>{(p.meta_description||p.description||'').slice(0,160)}</p>
                                }
                              </div>
                            )
                          })()}
                        </div>
                      )}
                      {/* Quick templates */}
                      <p className="text-xs font-bold mt-3 mb-1" style={{ color:'var(--viro-textSub)' }}>Quick Templates:</p>
                      <div className="space-y-1">
                        {[
                          '{name} | Buy Online in Pakistan – Viro.pk',
                          '{name} – Best Price Rs.{price} | Viro.pk',
                          'Buy {name} Online | Free Delivery | Viro.pk',
                          '{name} | Cash on Delivery | Viro.pk',
          '{name} — Rs.{price} | 🔥 Sale -{discount}% | Viro.pk',
          '{name} — Rs.{price} | Fast Delivery Pakistan | Viro.pk',
                        ].map(tpl => (
                          <button key={tpl} onClick={() => setSeoTemplate(tpl)}
                            className="w-full text-left text-xs py-1.5 px-3 rounded-lg transition-all"
                            style={{ background:'var(--viro-bgDeep)',color:'var(--viro-textSub)',border:'1px solid var(--viro-border)' }}>
                            {tpl}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Individual mode */}
                  {seoEditMode==='individual' && (
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                      {[...selected].map(id => {
                        const p = products.find(x=>x.id===id)
                        if (!p) return null
                        const val = seoIndividual[id] || { meta_title:'', meta_description:'' }
                        return (
                          <div key={id} className="p-3 rounded-xl" style={{ background:'var(--viro-bgDeep)',border:'1px solid var(--viro-border)' }}>
                            <div className="flex items-center gap-2 mb-2">
                              {p.images?.[0] && <img src={p.images[0]} alt="" style={{ width:28,height:28,borderRadius:6,objectFit:'cover',flexShrink:0 }} />}
                              <p className="text-xs font-bold truncate" style={{ color:'var(--viro-text)' }}>{p.name}</p>
                            </div>
                            {(seoField==='meta_title'||seoField==='both') && (
                              <div className="mb-2">
                                <div className="flex justify-between mb-1">
                                  <label className="text-xs" style={{ color:'var(--viro-textSub)' }}>Meta Title</label>
                                  <span className="text-xs" style={{ color: (val.meta_title||'').length>65?'#F97316':'#10B981' }}>
                                    {(val.meta_title||'').length}/70
                                  </span>
                                </div>
                                <input value={val.meta_title||''} maxLength={70}
                                  onChange={e => setSeoIndividual(prev=>({...prev,[id]:{...val,meta_title:e.target.value}}))}
                                  placeholder={p.meta_title || `${p.name} | Viro.pk`}
                                  style={{ fontSize:12,padding:'6px 10px' }} />
                              </div>
                            )}
                            {(seoField==='meta_description'||seoField==='both') && (
                              <div>
                                <div className="flex justify-between mb-1">
                                  <label className="text-xs" style={{ color:'var(--viro-textSub)' }}>Meta Description</label>
                                  <span className="text-xs" style={{ color: (val.meta_description||'').length>150?'#F97316':'#10B981' }}>
                                    {(val.meta_description||'').length}/160
                                  </span>
                                </div>
                                <textarea value={val.meta_description||''} maxLength={160} rows={2}
                                  onChange={e => setSeoIndividual(prev=>({...prev,[id]:{...val,meta_description:e.target.value}}))}
                                  placeholder={p.meta_description || `Buy ${p.name} online at best price...`}
                                  style={{ fontSize:12,padding:'6px 10px',width:'100%',borderRadius:8,resize:'vertical' }} />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Bulk keywords input */}
              {bulkAction==='add_keywords' && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>
                    Search Keywords (comma-separated, first = highest priority)
                  </label>
                  <input value={bulkKeywords} onChange={e=>setBulkKeywords(e.target.value)}
                    placeholder="e.g. ring, gold ring, wedding ring" />

                  <div className="flex gap-2 mt-2">
                    {[{v:'append',l:'➕ Add to existing'},{v:'replace',l:'🔄 Replace existing'}].map(o => (
                      <button key={o.v} type="button" onClick={() => setBulkKeywordsMode(o.v)}
                        className="flex-1 py-2 rounded-xl text-xs font-bold"
                        style={{
                          background: bulkKeywordsMode === o.v ? '#EC489925' : 'var(--viro-bgDeep)',
                          color: bulkKeywordsMode === o.v ? '#EC4899' : 'var(--viro-textSub)',
                          border: bulkKeywordsMode === o.v ? '1px solid #EC489960' : '1px solid var(--viro-border)',
                        }}>{o.l}</button>
                    ))}
                  </div>
                  <p className="text-xs mt-2" style={{ color:'var(--viro-textSub)' }}>
                    {bulkKeywordsMode === 'append'
                      ? `Keeps each product's existing keywords (and their rank) and adds these new ones after — good for tagging all ${selected.size} selected products with a shared term like "ring" without wiping out anything more specific they already have.`
                      : `Wipes out any existing keywords on all ${selected.size} selected products and sets exactly this list instead.`}
                  </p>
                </div>
              )}

              {/* Launch timer input */}
              {bulkAction==='launch_timer' && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>
                    Launch Date & Time
                  </label>
                  <input type="datetime-local" value={bulkLaunch} onChange={e=>setBulkLaunch(e.target.value)}
                    style={{ colorScheme:'dark' }} />
                  <p className="text-xs mt-1" style={{ color:'#A78BFA' }}>
                    All selected products will be set to Coming Soon until this date
                  </p>
                </div>
              )}

              {/* Sale timer input */}
              {bulkAction==='sale_timer' && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>
                    Sale End Date & Time
                  </label>
                  <input type="datetime-local" value={bulkSaleEnd} onChange={e=>setBulkSaleEnd(e.target.value)}
                    style={{ colorScheme:'dark' }} />
                  <p className="text-xs mt-1" style={{ color:'#F97316' }}>
                    Sale timer will be activated on all selected products
                  </p>

                  <label className="text-xs font-bold uppercase tracking-wider block mb-1 mt-3" style={{ color:'var(--viro-textSub)' }}>
                    Timer Label (shown on countdown)
                  </label>
                  <input
                    value={bulkTimerLabel}
                    onChange={e => setBulkTimerLabel(e.target.value)}
                    placeholder="e.g. Eid Sale Ends In, Flash Deal"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {['Deal Ends In','Eid Sale Ends In','Flash Deal','Weekend Special','Limited Offer'].map(s => (
                      <button key={s} type="button"
                        onClick={() => setBulkTimerLabel(s)}
                        className="px-2.5 py-1 rounded-full text-xs font-bold transition-all"
                        style={bulkTimerLabel === s
                          ? { background:'#F97316', color:'#fff' }
                          : { background:'var(--viro-bgDeep)', color:'var(--viro-textSub)', border:'1px solid var(--viro-border)' }}>
                        {s}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
                    This label applies to all {selected.size} selected products' countdowns
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t flex gap-3" style={{ borderColor:'var(--viro-border)' }}>
              <button onClick={() => setBulkPanel(false)}
                className="flex-1 py-3 rounded-xl font-bold text-sm border"
                style={{ background:'transparent', color:'var(--viro-textMuted)', borderColor:'var(--viro-border)' }}>
                Cancel
              </button>
              <button onClick={applyBulk} disabled={!bulkAction || applying}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                style={{ background:'linear-gradient(135deg,#8B5CF6,#F97316)' }}>
                {applying ? 'Applying…' : `Apply to ${selected.size} products`}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  )
}





// ─────────────────────────────────────────────────────────────
// Orders Tab — LinkedIn-style multi-filter panel + full analytics
// ─────────────────────────────────────────────────────────────

export default ProductsTab
