'use client'
import { supabase } from '../lib/supabase'
/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect } from 'react'
import { adminApi } from '../lib/adminApi'
import { showSimpleToast } from '../components/Toast'
import { useSite } from '../context/SiteSettingsContext'
import { uploadReviewScreenshot, deleteReviewScreenshot } from '../lib/storage'

function ReviewsTab() {
  const { reviewsEnabled, setReviewsEnabled, autoApproveReviews, setAutoApproveReviews } = useSite()
  const [reviews,      setReviews]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState('pending')
  const [typeFilter,   setTypeFilter]   = useState('all')   // all | product | global — sub-nav under status tabs
  const [reviewSearch,  setReviewSearch] = useState('')       // free-text: customer name or product name
  const [settingSaving,setSettingSaving] = useState(false)

  // ── Inline edit — admin can correct rating/name/comment on any existing
  // review without deleting and re-creating it.
  const [editingId,  setEditingId]  = useState(null)
  const [editRating, setEditRating] = useState(5)
  const [editName,   setEditName]   = useState('')
  const [editComment,setEditComment]= useState('')
  const [editSaving, setEditSaving] = useState(false)

  function startEdit(r) {
    setEditingId(r.id)
    setEditRating(r.rating || 5)
    setEditName(r.name || '')
    setEditComment(r.comment || '')
  }
  function cancelEdit() { setEditingId(null) }

  async function saveEdit(id) {
    setEditSaving(true)
    const res = await adminApi('review_update', {
      id,
      patch: {
        rating: editRating,
        name: editName.trim() || 'Verified Customer',
        comment: editComment.trim() || null,
      },
    })
    setEditSaving(false)
    if (res?.error) { showSimpleToast(`❌ ${res.error}`, 'info'); return }
    setEditingId(null)
    showSimpleToast('✅ Review updated', 'success')
    load()
  }

  // ── Add Screenshot Review — admin attaches a real customer screenshot
  // (e.g. WhatsApp) to a product's review list instead of it coming
  // through the normal in-app submit flow.
  const [ssProducts,      setSsProducts]      = useState([])
  const [ssSearch,        setSsSearch]        = useState('')
  const [ssProductId,     setSsProductId]     = useState(null)
  const [ssRating,        setSsRating]        = useState(5)
  const [ssName,          setSsName]          = useState('')
  const [ssCustomerId,    setSsCustomerId]    = useState(null) // linked real customer, if picked
  const [ssCustomerSearch,setSsCustomerSearch]= useState('')
  const [ssCustomers,     setSsCustomers]     = useState([])
  const [ssComment,       setSsComment]       = useState('')
  const [ssFile,          setSsFile]          = useState(null)
  const [ssPreview,       setSsPreview]       = useState(null)
  const [ssUploadedUrl,   setSsUploadedUrl]   = useState(null) // cached storage URL, reused across "duplicate to another product"
  const [ssUploading,     setSsUploading]     = useState(false)
  const [ssApplyAll,      setSsApplyAll]      = useState(false) // add this review to every product in one click
  const [ssApplyPurchases,setSsApplyPurchases]= useState(false) // add this review only to what the linked customer actually bought
  const [ssCustomerItems, setSsCustomerItems] = useState([])    // [{product_id, order_id, name, image}] this customer bought
  const [ssCustomerItemsChecked, setSsCustomerItemsChecked] = useState({}) // product_id -> bool
  const [ssCustomerItemsLoading, setSsCustomerItemsLoading] = useState(false)
  const [ssBulkProgress,  setSsBulkProgress]  = useState(null)  // { done, total } while bulk-adding

  useEffect(() => {
    supabase.from('products').select('id,name,images').order('name')
      .then(({ data }) => setSsProducts(data || []))
    supabase.from('customers').select('id,name,phone').order('created_at', { ascending: false })
      .then(({ data }) => setSsCustomers(data || []))
  }, [])

  // Whenever a real customer gets linked, pull the distinct products they
  // actually ordered (most recent order per product), so admin can apply
  // a phone-call review only to items this specific person really bought —
  // not the whole catalog.
  useEffect(() => {
    if (!ssCustomerId) { setSsCustomerItems([]); setSsCustomerItemsChecked({}); setSsApplyPurchases(false); return }
    setSsCustomerItemsLoading(true)
    supabase
      .from('order_items')
      .select('product_id, order_id, created_at, products(id,name,images), orders!inner(customer_id)')
      .eq('orders.customer_id', ssCustomerId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const seen = new Map()
        for (const row of (data || [])) {
          if (!row.product_id || seen.has(row.product_id)) continue
          seen.set(row.product_id, {
            product_id: row.product_id,
            order_id: row.order_id,
            name: row.products?.name || 'Product',
            image: (() => {
              const imgs = Array.isArray(row.products?.images) ? row.products.images
                : (() => { try { return JSON.parse(row.products?.images || '[]') } catch { return [] } })()
              return imgs[0] || null
            })(),
          })
        }
        const items = Array.from(seen.values())
        setSsCustomerItems(items)
        setSsCustomerItemsChecked(Object.fromEntries(items.map(it => [it.product_id, true])))
        setSsCustomerItemsLoading(false)
      })
  }, [ssCustomerId])

  function handleSsFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setSsFile(file)
    setSsPreview(URL.createObjectURL(file))
    setSsUploadedUrl(null) // new file — old cached URL no longer applies
  }

  async function submitScreenshotReview() {
    if (!ssApplyAll && !ssApplyPurchases && !ssProductId) { showSimpleToast('⚠️ Pick a product first', 'info'); return }
    if (ssApplyPurchases && !Object.values(ssCustomerItemsChecked).some(Boolean)) {
      showSimpleToast('⚠️ Check at least one product this customer bought', 'info'); return
    }
    // A screenshot is no longer mandatory — an admin transcribing a real
    // WhatsApp/text message from an actual customer (no image to attach)
    // just needs SOME real content to go with it.
    if (!ssFile && !ssUploadedUrl && !ssComment.trim()) {
      showSimpleToast('⚠️ Add a screenshot, or type the customer\'s message', 'info'); return
    }
    setSsUploading(true)
    try {
      // Reuse the already-uploaded URL if this is a "duplicate to another
      // product" resubmit with the same screenshot — only upload once.
      // Skipped entirely for a text-only submission (no file chosen).
      const screenshot_url = ssUploadedUrl || (ssFile ? await uploadReviewScreenshot(ssFile) : null)
      if (screenshot_url && !ssUploadedUrl) setSsUploadedUrl(screenshot_url)

      if (ssApplyPurchases) {
        // ── Only-what-they-bought path: one rating/caption from a phone
        // call or message, applied once per product this exact customer
        // actually ordered — each row carries the real order_id it came
        // from, so it's a genuine verified-purchase record, not a guess.
        const items = ssCustomerItems.filter(it => ssCustomerItemsChecked[it.product_id])
        if (!items.length) throw new Error('No products selected')
        let done = 0
        setSsBulkProgress({ done: 0, total: items.length })
        for (const it of items) {
          const res = await adminApi('review_admin_create', {
            product_id: it.product_id, rating: ssRating,
            name: ssName.trim() || undefined, comment: ssComment.trim() || undefined,
            screenshot_url: screenshot_url || undefined,
            customer_id: ssCustomerId || undefined,
            order_id: it.order_id || undefined,
          })
          if (res?.error) throw new Error(`${it.name}: ${res.error}`)
          done += 1
          setSsBulkProgress({ done, total: items.length })
        }
        showSimpleToast(`✅ Review added to ${done} product${done !== 1 ? 's' : ''} this customer bought`, 'success')
        setSsApplyPurchases(false)
      } else if (ssApplyAll) {
        // ── Global review path: ONE row, product_id left out entirely.
        // This used to loop and insert one full copy per product (101
        // duplicate rows) — that's exactly what made "Let customers speak
        // for us" show the same review repeated ~100 times. A single
        // global row shows once in that feed and is excluded from every
        // individual product's star average (see 033_reviews_global_
        // and_dedup_cleanup.sql) — genuine store-wide trust, not spam.
        const res = await adminApi('review_admin_create', {
          rating: ssRating,
          name: ssName.trim() || undefined, comment: ssComment.trim() || undefined,
          screenshot_url: screenshot_url || undefined,
          customer_id: ssCustomerId || undefined,
        })
        if (res?.error) throw new Error(res.error)
        showSimpleToast('✅ Added as a general Viro.pk store review — shown once, everywhere', 'success')
        setSsApplyAll(false)
      } else {
        const res = await adminApi('review_admin_create', {
          product_id: ssProductId, rating: ssRating,
          name: ssName.trim() || undefined, comment: ssComment.trim() || undefined,
          screenshot_url: screenshot_url || undefined,
          customer_id: ssCustomerId || undefined,
        })
        if (res?.error) throw new Error(res.error)
        showSimpleToast('✅ Review added — pick another product to reuse this screenshot', 'success')
      }
      // Only reset the product picker — screenshot/rating/name/caption stay
      // put so the next submit (for a DIFFERENT product) is one click away.
      setSsProductId(null); setSsSearch('')
      load()
    } catch (err) {
      showSimpleToast(`❌ ${err.message || 'Failed to add review'}`, 'info')
    }
    setSsUploading(false)
    setSsBulkProgress(null)
  }

  // Analytics
  const [stats, setStats] = useState({ total:0, pending:0, approved:0, hidden:0, avgRating:0 })

  async function load() {
    setLoading(true)
    try {
      // Admin reads ALL reviews via service role — needs RLS bypass
      // We use the anon key but service_role policy allows it via supabase directly
      const { data } = await supabase
        .from('reviews')
        .select('*, products(name, images), customers(name, phone)')
        .order('created_at', { ascending: false })

      const all = data || []
      setReviews(all)
      setStats({
        total:    all.length,
        pending:  all.filter(r => r.status === 'pending').length,
        approved: all.filter(r => r.status === 'approved').length,
        hidden:   all.filter(r => r.status === 'hidden').length,
        avgRating: all.length ? (all.reduce((s,r) => s+r.rating,0)/all.length).toFixed(1) : 0,
      })
    } catch { setReviews([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function setStatus(id, status) {
    await adminApi('review_update', { id, patch: { status } })
    load()
    showSimpleToast(status === 'approved' ? '✅ Review approved' : status === 'hidden' ? '🚫 Review hidden' : '🗑️ Deleted', 'success')
  }

  async function deleteReview(id) {
    if (!confirm('Delete this review permanently?')) return
    const review = reviews.find(r => r.id === id)
    await adminApi('review_delete', { id })
    if (review?.screenshot_url) deleteReviewScreenshot(review.screenshot_url).catch(() => {})
    load()
    showSimpleToast('🗑️ Review deleted', 'info')
  }

  async function saveGlobalSettings(enabled, autoApprove) {
    setSettingSaving(true)
    await adminApi('site_setting_update', { key:'review_settings', value:{ enabled, auto_approve: autoApprove } })
    setReviewsEnabled(enabled)
    setAutoApproveReviews(autoApprove)
    setSettingSaving(false)
    showSimpleToast('✅ Review settings saved', 'success')
  }

  const globalCount  = reviews.filter(r => !r.product_id).length
  const productCount = reviews.filter(r => !!r.product_id).length

  const searchTerm = reviewSearch.trim().toLowerCase()

  const filtered = reviews.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false
    if (typeFilter === 'global'  && r.product_id) return false
    if (typeFilter === 'product' && !r.product_id) return false
    if (searchTerm) {
      const haystack = [
        r.name, r.customers?.name, r.customers?.phone, r.products?.name, r.comment,
      ].filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(searchTerm)) return false
    }
    return true
  })

  const STAR_COLORS = ['','#EF4444','#F97316','#EAB308','#84CC16','#10B981']

  return (
    <div className="px-4 pb-24 space-y-4">

      {/* ── Global Settings Card ── */}
      <div className="viro-card overflow-hidden" style={{ marginTop:16 }}>
        <div className="px-4 py-3 border-b flex items-center justify-between"
          style={{ background:'#FBBF2408', borderColor:'#FBBF2420' }}>
          <div>
            <h3 className="font-bold flex items-center gap-2" style={{ color:'var(--viro-text)' }}>
              ⭐ Review System Settings
            </h3>
            <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
              Global controls — also set per-product in Products tab
            </p>
          </div>
          <span className="text-xs px-2 py-1 rounded-full font-bold"
            style={reviewsEnabled
              ? { background:'#10B98115', color:'#10B981', border:'1px solid #10B98130' }
              : { background:'#EF444415', color:'#EF4444', border:'1px solid #EF444430' }}>
            {reviewsEnabled ? '✅ On' : '🚫 Off'}
          </span>
        </div>

        <div className="p-4 space-y-3">
          {/* Master on/off */}
          <div className="flex items-center gap-4 p-3 rounded-xl"
            style={{ background: reviewsEnabled ? '#10B98110' : 'var(--viro-bgDeep)',
                     border:`2px solid ${reviewsEnabled ? '#10B98130' : 'var(--viro-border)'}` }}>
            <div className="flex-1">
              <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>Show Reviews on Products</p>
              <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                {reviewsEnabled ? 'Reviews visible on product pages & delivery orders' : 'All reviews hidden sitewide'}
              </p>
            </div>
            <button onClick={() => saveGlobalSettings(!reviewsEnabled, autoApproveReviews)}
              disabled={settingSaving}
              style={{
                width:56, height:28, borderRadius:14, position:'relative', border:'none', flexShrink:0,
                background: reviewsEnabled ? 'linear-gradient(135deg,#10B981,#059669)' : '#334155',
                boxShadow: reviewsEnabled ? '0 0 10px #10B98150' : 'none',
                cursor: settingSaving ? 'not-allowed' : 'pointer',
              }}>
              <span style={{
                position:'absolute', top:3, width:22, height:22, borderRadius:'50%',
                background:'#fff', boxShadow:'0 2px 4px rgba(0,0,0,0.2)',
                left: reviewsEnabled ? 30 : 3, transition:'left 0.2s',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:11,
              }}>{settingSaving ? '⏳' : reviewsEnabled ? '✓' : '✕'}</span>
            </button>
          </div>

          {/* Auto-approve toggle */}
          <div className="flex items-center gap-4 p-3 rounded-xl"
            style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
            <div className="flex-1">
              <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>Auto-Approve Reviews</p>
              <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                {autoApproveReviews
                  ? 'Reviews go live immediately — no manual approval needed'
                  : 'Reviews wait for your approval before showing publicly'}
              </p>
            </div>
            <button onClick={() => saveGlobalSettings(reviewsEnabled, !autoApproveReviews)}
              disabled={settingSaving}
              style={{
                width:56, height:28, borderRadius:14, position:'relative', border:'none', flexShrink:0,
                background: autoApproveReviews ? '#8B5CF6' : '#334155',
                cursor: settingSaving ? 'not-allowed' : 'pointer',
              }}>
              <span style={{
                position:'absolute', top:3, width:22, height:22, borderRadius:'50%',
                background:'#fff', boxShadow:'0 2px 4px rgba(0,0,0,0.2)',
                left: autoApproveReviews ? 30 : 3, transition:'left 0.2s',
              }}/>
            </button>
          </div>
        </div>
      </div>

      {/* ── Add Screenshot Review ── */}
      <div className="viro-card overflow-hidden">
        <div className="px-4 py-3 border-b" style={{ background:'#8B5CF608', borderColor:'#8B5CF620' }}>
          <h3 className="font-bold flex items-center gap-2" style={{ color:'var(--viro-text)' }}>
            📸 Add Screenshot Review
          </h3>
          <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
            Attach a real customer screenshot (e.g. WhatsApp) to a product's reviews — goes live immediately
          </p>
        </div>
        <div className="p-4 space-y-3">
          {/* ── Apply to ALL products at once ── */}
          <div className="flex items-center gap-3 p-3 rounded-xl"
            style={{
              background: ssApplyAll ? '#8B5CF612' : 'var(--viro-bgDeep)',
              border:`1.5px solid ${ssApplyAll ? '#8B5CF640' : 'var(--viro-border)'}`,
              opacity: ssApplyPurchases ? 0.45 : 1,
            }}>
            <div className="flex-1">
              <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>🏬 General Store Review (Global)</p>
              <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                {ssApplyPurchases ? 'Off — using "only what this customer bought" below instead'
                  : ssApplyAll ? 'Saved ONCE — shown in "Let customers speak for us" everywhere, not tied to one product, never inflates any single product\'s star rating'
                  : 'Off — this review will only go on the one product you pick below'}
              </p>
            </div>
            <button onClick={() => { setSsApplyAll(v => !v); setSsApplyPurchases(false); setSsProductId(null); setSsSearch('') }}
              disabled={ssUploading || ssApplyPurchases}
              style={{
                width:48, height:26, borderRadius:13, position:'relative', border:'none', flexShrink:0,
                background: ssApplyAll ? '#8B5CF6' : '#334155',
                cursor: (ssUploading || ssApplyPurchases) ? 'not-allowed' : 'pointer',
              }}>
              <span style={{
                position:'absolute', top:3, width:20, height:20, borderRadius:'50%',
                background:'#fff', boxShadow:'0 2px 4px rgba(0,0,0,0.2)',
                left: ssApplyAll ? 25 : 3, transition:'left 0.2s',
              }}/>
            </button>
          </div>

          {ssBulkProgress && (
            <div className="p-3 rounded-xl" style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold" style={{ color:'var(--viro-text)' }}>Adding to products…</span>
                <span className="text-xs font-bold" style={{ color:'#8B5CF6' }}>{ssBulkProgress.done}/{ssBulkProgress.total}</span>
              </div>
              <div style={{ height:6, borderRadius:3, background:'var(--viro-border)', overflow:'hidden' }}>
                <div style={{ width:`${(ssBulkProgress.done/ssBulkProgress.total)*100}%`, height:'100%', background:'linear-gradient(90deg,#8B5CF6,#7C3AED)', transition:'width 0.2s' }} />
              </div>
            </div>
          )}

          {!ssApplyAll && !ssApplyPurchases && (
          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color:'var(--viro-textSub)' }}>Product</label>
            {ssProductId && ssProducts.find(p => p.id === ssProductId) && (() => {
              const p = ssProducts.find(x => x.id === ssProductId)
              const imgs = Array.isArray(p.images) ? p.images : (() => { try { return JSON.parse(p.images||'[]') } catch { return [] } })()
              return (
                <div className="flex items-center gap-2 p-2 rounded-xl mb-2" style={{ background:'#8B5CF612', border:'1px solid #8B5CF640' }}>
                  <img src={imgs[0]||'/logo.jpg'} alt={p.name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" onError={e=>{e.target.src='/logo.jpg'}} />
                  <span className="text-xs font-semibold flex-1" style={{ color:'var(--viro-text)' }}>{p.name}</span>
                  <button onClick={() => setSsProductId(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EF4444', fontSize:12 }}>✕</button>
                </div>
              )
            })()}
            {!ssProductId && (
              <>
                <input value={ssSearch} onChange={e => setSsSearch(e.target.value)}
                  placeholder="🔍 Search products…"
                  className="w-full text-xs p-2.5 rounded-xl mb-2"
                  style={{ border:'1px solid var(--viro-border)', background:'var(--viro-bg)', color:'var(--viro-text)' }} />
                {ssSearch.trim() && (
                  <div className="rounded-xl overflow-hidden" style={{ border:'1px solid var(--viro-border)', maxHeight:200, overflowY:'auto' }}>
                    {ssProducts.filter(p => p.name.toLowerCase().includes(ssSearch.trim().toLowerCase())).slice(0,20).map(p => {
                      const imgs = Array.isArray(p.images) ? p.images : (() => { try { return JSON.parse(p.images||'[]') } catch { return [] } })()
                      return (
                        <div key={p.id} onClick={() => { setSsProductId(p.id); setSsSearch('') }}
                          className="flex items-center gap-2 p-2 cursor-pointer"
                          style={{ borderBottom:'1px solid var(--viro-border)' }}>
                          <img src={imgs[0]||'/logo.jpg'} alt={p.name} className="w-7 h-7 rounded object-cover flex-shrink-0" onError={e=>{e.target.src='/logo.jpg'}} />
                          <span className="text-xs" style={{ color:'var(--viro-text)' }}>{p.name}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
          )}

          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color:'var(--viro-textSub)' }}>Screenshot <span style={{ fontWeight:400, textTransform:'none' }}>(optional if typing the message below)</span></label>
            {ssPreview ? (
              <div className="relative inline-block">
                <img src={ssPreview} alt="preview" style={{ width:120, height:120, objectFit:'cover', borderRadius:12, border:'1px solid var(--viro-border)' }} />
                <button onClick={() => { setSsFile(null); setSsPreview(null); setSsUploadedUrl(null) }}
                  style={{ position:'absolute', top:-8, right:-8, width:24, height:24, borderRadius:'50%', background:'#EF4444', color:'#fff', border:'2px solid var(--viro-bgCard)', cursor:'pointer', fontSize:12 }}>✕</button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 py-6 rounded-xl cursor-pointer"
                style={{ border:'2px dashed var(--viro-border)', background:'var(--viro-bgDeep)' }}>
                <span className="text-sm font-semibold" style={{ color:'var(--viro-textSub)' }}>📎 Tap to choose image</span>
                <input type="file" accept="image/*" onChange={handleSsFile} style={{ display:'none' }} />
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color:'var(--viro-textSub)' }}>Rating</label>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button" onClick={() => setSsRating(n)}
                    style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color: n<=ssRating ? '#FBBF24' : '#374151' }}>★</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color:'var(--viro-textSub)' }}>Customer name (optional)</label>
              <input value={ssName} onChange={e => { setSsName(e.target.value); setSsCustomerId(null) }} placeholder="Verified Customer"
                className="w-full text-xs p-2.5 rounded-xl"
                style={{ border:'1px solid var(--viro-border)', background:'var(--viro-bg)', color:'var(--viro-text)' }} />
            </div>
          </div>

          {/* ── Link to a real customer — optional, ties the review to an actual
              record in your customers table (by name/phone) instead of just a
              typed name, so it's traceable to a genuine buyer, not only text. ── */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color:'var(--viro-textSub)' }}>
              Link to a real customer <span style={{ fontWeight:400, textTransform:'none' }}>(optional — search your customer list)</span>
            </label>
            {ssCustomerId ? (() => {
              const c = ssCustomers.find(x => x.id === ssCustomerId)
              return (
                <div className="flex items-center gap-2 p-2 rounded-xl" style={{ background:'#10B98112', border:'1px solid #10B98140' }}>
                  <span className="text-xs font-semibold flex-1" style={{ color:'var(--viro-text)' }}>
                    ✓ {c?.name || 'Customer'} {c?.phone ? `· ${c.phone}` : ''}
                  </span>
                  <button onClick={() => setSsCustomerId(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EF4444', fontSize:12 }}>✕</button>
                </div>
              )
            })() : (
              <>
                <input value={ssCustomerSearch} onChange={e => setSsCustomerSearch(e.target.value)}
                  placeholder="🔍 Search by name or phone…"
                  className="w-full text-xs p-2.5 rounded-xl mb-2"
                  style={{ border:'1px solid var(--viro-border)', background:'var(--viro-bg)', color:'var(--viro-text)' }} />
                {ssCustomerSearch.trim() && (
                  <div className="rounded-xl overflow-hidden" style={{ border:'1px solid var(--viro-border)', maxHeight:180, overflowY:'auto' }}>
                    {ssCustomers.filter(c =>
                      (c.name || '').toLowerCase().includes(ssCustomerSearch.trim().toLowerCase()) ||
                      (c.phone || '').includes(ssCustomerSearch.trim())
                    ).slice(0,20).map(c => (
                      <div key={c.id}
                        onClick={() => { setSsCustomerId(c.id); setSsName(c.name || ''); setSsCustomerSearch('') }}
                        className="flex items-center gap-2 p-2 cursor-pointer"
                        style={{ borderBottom:'1px solid var(--viro-border)' }}>
                        <span className="text-xs" style={{ color:'var(--viro-text)' }}>{c.name || 'Unnamed'}</span>
                        {c.phone && <span className="text-xs" style={{ color:'var(--viro-textSub)' }}>· {c.phone}</span>}
                      </div>
                    ))}
                    {ssCustomers.filter(c =>
                      (c.name || '').toLowerCase().includes(ssCustomerSearch.trim().toLowerCase()) ||
                      (c.phone || '').includes(ssCustomerSearch.trim())
                    ).length === 0 && (
                      <p className="text-xs p-2" style={{ color:'var(--viro-textSub)' }}>No matching customer</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Only what this customer bought — shows once a real customer
              is linked above. Pulled from their actual order history, so a
              phone-call review can go on exactly the items they ordered
              (e.g. A, D, S) without touching the other 98 products. ── */}
          {ssCustomerId && (
            <div className="p-3 rounded-xl" style={{ background: ssApplyPurchases ? '#10B98112' : 'var(--viro-bgDeep)', border:`1.5px solid ${ssApplyPurchases ? '#10B98140' : 'var(--viro-border)'}` }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1">
                  <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>🛍️ Only what this customer bought</p>
                  <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                    {ssCustomerItemsLoading ? 'Looking up their order history…'
                      : ssCustomerItems.length === 0 ? 'No past orders found for this customer'
                      : ssApplyPurchases ? `Adds this review to the ${Object.values(ssCustomerItemsChecked).filter(Boolean).length} item(s) checked below`
                      : `They've ordered ${ssCustomerItems.length} product${ssCustomerItems.length !== 1 ? 's' : ''} — flip on to review just those`}
                  </p>
                </div>
                <button onClick={() => { setSsApplyPurchases(v => !v); setSsApplyAll(false); setSsProductId(null); setSsSearch('') }}
                  disabled={ssUploading || ssApplyAll || ssCustomerItemsLoading || ssCustomerItems.length === 0}
                  style={{
                    width:48, height:26, borderRadius:13, position:'relative', border:'none', flexShrink:0,
                    background: ssApplyPurchases ? '#10B981' : '#334155',
                    cursor: (ssUploading || ssApplyAll || ssCustomerItems.length === 0) ? 'not-allowed' : 'pointer',
                  }}>
                  <span style={{
                    position:'absolute', top:3, width:20, height:20, borderRadius:'50%',
                    background:'#fff', boxShadow:'0 2px 4px rgba(0,0,0,0.2)',
                    left: ssApplyPurchases ? 25 : 3, transition:'left 0.2s',
                  }}/>
                </button>
              </div>

              {ssApplyPurchases && ssCustomerItems.length > 0 && (
                <div className="rounded-xl overflow-hidden" style={{ border:'1px solid var(--viro-border)', maxHeight:220, overflowY:'auto' }}>
                  {ssCustomerItems.map(it => (
                    <label key={it.product_id}
                      className="flex items-center gap-2 p-2 cursor-pointer"
                      style={{ borderBottom:'1px solid var(--viro-border)', background: ssCustomerItemsChecked[it.product_id] ? '#10B98108' : 'transparent' }}>
                      <input type="checkbox" checked={!!ssCustomerItemsChecked[it.product_id]}
                        onChange={e => setSsCustomerItemsChecked(prev => ({ ...prev, [it.product_id]: e.target.checked }))} />
                      {it.image && <img src={it.image} alt="" style={{ width:26, height:26, borderRadius:6, objectFit:'cover' }} onError={e => { e.target.style.display='none' }} />}
                      <span className="text-xs flex-1" style={{ color:'var(--viro-text)' }}>{it.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color:'var(--viro-textSub)' }}>Caption (optional)</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {['Great quality!', 'Loved it, thank you!', 'Highly recommend', 'Satisfied customer', 'Exactly as shown'].map(chip => (
                <button key={chip} type="button" onClick={() => setSsComment(chip)}
                  className="text-[11px] px-2.5 py-1 rounded-full font-semibold"
                  style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)', color:'var(--viro-textSub)', cursor:'pointer' }}>
                  {chip}
                </button>
              ))}
            </div>
            <input value={ssComment} onChange={e => setSsComment(e.target.value)} placeholder="e.g. Shared with permission"
              className="w-full text-xs p-2.5 rounded-xl"
              style={{ border:'1px solid var(--viro-border)', background:'var(--viro-bg)', color:'var(--viro-text)' }} />
          </div>

          <button disabled={ssUploading} onClick={submitScreenshotReview}
            className="w-full py-2.5 rounded-lg text-sm font-bold"
            style={{ background: ssApplyPurchases ? '#10B981' : '#8B5CF6', color:'#fff', border:'none', cursor: ssUploading ? 'not-allowed' : 'pointer', opacity: ssUploading ? 0.7 : 1 }}>
            {ssBulkProgress ? `⏳ Adding… ${ssBulkProgress.done}/${ssBulkProgress.total}`
              : ssUploading ? '⏳ Uploading…'
              : ssApplyPurchases ? `✅ Add to ${Object.values(ssCustomerItemsChecked).filter(Boolean).length} Purchased Item(s)`
              : ssApplyAll ? '✅ Save as General Store Review'
              : '✅ Add Screenshot Review'}
          </button>
        </div>
      </div>

      {/* ── Analytics Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label:'Total',    value:stats.total,    icon:'📝', color:'#8B5CF6' },
          { label:'Pending',  value:stats.pending,  icon:'⏳', color:'#EAB308' },
          { label:'Approved', value:stats.approved, icon:'✅', color:'#10B981' },
          { label:'Hidden',   value:stats.hidden,   icon:'🚫', color:'#EF4444' },
          { label:'Avg Rating', value:stats.avgRating > 0 ? `${stats.avgRating}⭐` : '—', icon:'⭐', color:'#FBBF24' },
        ].map(s => (
          <div key={s.label} className="viro-card p-3 flex flex-col items-center text-center gap-1">
            <span className="text-xl">{s.icon}</span>
            <span className="text-lg font-black" style={{ color:s.color }}>{s.value}</span>
            <span className="text-xs" style={{ color:'var(--viro-textSub)' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Filter bar (status) ── */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {[
          ['pending','⏳ Pending'],['approved','✅ Approved'],
          ['hidden','🚫 Hidden'],['all','All'],
        ].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={filter===v
              ? { background:'linear-gradient(135deg,#FBBF24,#F59E0B)', color:'#1a1a1a' }
              : { background:'var(--viro-bgDeep)', color:'var(--viro-textSub)', border:'1px solid var(--viro-border)' }}>
            {l}
            {v !== 'all' && stats[v] > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs"
                style={{ background:'rgba(0,0,0,0.15)' }}>{stats[v]}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Sub-nav: review type — All / Product-specific / 🏬 Global ── */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {[
          ['all',    `All Types (${reviews.length})`],
          ['product',`📦 Product (${productCount})`],
          ['global', `🏬 Global (${globalCount})`],
        ].map(([v,l]) => (
          <button key={v} onClick={() => setTypeFilter(v)}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={typeFilter===v
              ? { background:'#8B5CF6', color:'#fff' }
              : { background:'var(--viro-bgDeep)', color:'var(--viro-textSub)', border:'1px solid var(--viro-border)' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── Search — by customer name, phone, product, or review text ── */}
      <input value={reviewSearch} onChange={e => setReviewSearch(e.target.value)}
        placeholder="🔍 Search reviews by customer, product, or text…"
        className="w-full text-xs p-2.5 rounded-xl"
        style={{ border:'1px solid var(--viro-border)', background:'var(--viro-bgDeep)', color:'var(--viro-text)' }} />

      {/* ── Review List ── */}
      {loading ? (
        <div className="text-center py-12" style={{ color:'var(--viro-textSub)' }}>Loading reviews…</div>
      ) : filtered.length === 0 ? (
        <div className="viro-card p-8 text-center">
          <p className="text-3xl mb-2">⭐</p>
          <p className="font-bold" style={{ color:'var(--viro-text)' }}>
            {searchTerm ? 'No reviews match your search'
              : filter === 'pending' ? 'No reviews awaiting approval' : 'No reviews found'}
          </p>
          <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
            {searchTerm ? 'Try a different name, product, or word'
              : filter === 'pending' ? 'All caught up! 🎉' : 'Switch filter to see other reviews'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const product = r.products
            const customer = r.customers
            const imgs = Array.isArray(product?.images) ? product.images
              : (typeof product?.images==='string' ? (() => { try { return JSON.parse(product.images) } catch { return [] } })() : [])
            const thumb = imgs[0]
            const isPending  = r.status === 'pending'
            const isApproved = r.status === 'approved'
            const isHidden   = r.status === 'hidden'

            const isGlobal = !r.product_id
            const isEditing = editingId === r.id

            return (
              <div key={r.id} className="viro-card overflow-hidden"
                style={{ borderLeft:`4px solid ${isPending ? '#EAB308' : isApproved ? '#10B981' : '#EF4444'}` }}>

                {/* Header */}
                <div className="px-4 py-3 flex items-center gap-3 border-b"
                  style={{ background:'var(--viro-bgDeep)', borderColor:'var(--viro-border)' }}>
                  {isGlobal ? (
                    <div style={{ width:36, height:36, borderRadius:8, background:'#8B5CF620', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>🏬</div>
                  ) : thumb ? (
                    <img src={thumb} alt={product?.name} style={{ width:36, height:36, borderRadius:8, objectFit:'cover', flexShrink:0 }}
                      onError={e => { e.target.style.display='none' }} />
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: isGlobal ? '#8B5CF6' : 'var(--viro-text)' }}>
                      {isGlobal ? '🏬 General Store Review' : (product?.name || 'Unknown Product')}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                      by <strong>{r.name || customer?.name || 'Verified Customer'}</strong>
                      {customer?.phone && <span> · {customer.phone}</span>}
                      {' · '}{new Date(r.created_at).toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric'})}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full font-bold flex-shrink-0"
                    style={{
                      background: isPending ? '#EAB30820' : isApproved ? '#10B98120' : '#EF444420',
                      color:      isPending ? '#EAB308'   : isApproved ? '#10B981'   : '#EF4444',
                      border:`1px solid ${isPending ? '#EAB30840' : isApproved ? '#10B98140' : '#EF444440'}`,
                    }}>
                    {isPending ? '⏳ Pending' : isApproved ? '✅ Live' : '🚫 Hidden'}
                  </span>
                </div>

                <div className="p-4">
                  {isEditing ? (
                    /* ── Inline edit form ── */
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color:'var(--viro-textSub)' }}>Rating</label>
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(n => (
                            <button key={n} type="button" onClick={() => setEditRating(n)}
                              style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color: n<=editRating ? '#FBBF24' : '#374151' }}>★</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color:'var(--viro-textSub)' }}>Customer name</label>
                        <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Verified Customer"
                          className="w-full text-xs p-2.5 rounded-xl"
                          style={{ border:'1px solid var(--viro-border)', background:'var(--viro-bg)', color:'var(--viro-text)' }} />
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color:'var(--viro-textSub)' }}>Review text</label>
                        <textarea value={editComment} onChange={e => setEditComment(e.target.value)} rows={3}
                          className="w-full text-xs p-2.5 rounded-xl" style={{ border:'1px solid var(--viro-border)', background:'var(--viro-bg)', color:'var(--viro-text)', resize:'vertical' }} />
                      </div>
                      <div className="flex gap-2">
                        <button disabled={editSaving} onClick={() => saveEdit(r.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background:'#10B981', color:'#fff', border:'none', cursor: editSaving ? 'not-allowed' : 'pointer' }}>
                          {editSaving ? '⏳ Saving…' : '✅ Save changes'}
                        </button>
                        <button disabled={editSaving} onClick={cancelEdit}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background:'#1E293B', color:'#94A3B8', border:'1px solid var(--viro-border)', cursor: editSaving ? 'not-allowed' : 'pointer' }}>
                          ✕ Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Stars */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(n => (
                            <span key={n} style={{ fontSize:16, color: n<=r.rating ? '#FBBF24' : '#374151' }}>★</span>
                          ))}
                        </div>
                        <span className="text-sm font-black" style={{ color:STAR_COLORS[r.rating] }}>
                          {['','😞','😕','😐','😊','🤩'][r.rating]} {r.rating}/5
                        </span>
                        {r.source === 'screenshot' && (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background:'#8B5CF615', color:'#8B5CF6' }}>
                            {r.screenshot_url ? '📸 Admin-added' : '💬 Admin-transcribed'}
                          </span>
                        )}
                      </div>

                      {r.screenshot_url && (
                        <div className="mb-2">
                          <img src={r.screenshot_url} alt="review screenshot"
                            style={{ width:90, height:90, objectFit:'cover', borderRadius:10, border:'1px solid var(--viro-border)' }} />
                        </div>
                      )}
                      {/* BUGFIX: this used to check r.title / r.body — neither column
                          exists on `reviews` (schema only has `comment`), so every
                          single review with real text was silently showing "No text —
                          stars only" here regardless of what the customer actually
                          wrote. Now reads the real column. */}
                      {r.comment ? (
                        <div className="mt-1 px-3 py-2 rounded-xl text-xs leading-relaxed"
                          style={{ background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)', color:'var(--viro-textMuted)', lineHeight:1.6 }}>
                          {r.comment}
                        </div>
                      ) : (
                        <p className="text-xs italic" style={{ color:'var(--viro-textSub)' }}>No text — stars only</p>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {!isApproved && (
                          <button onClick={() => setStatus(r.id, 'approved')}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold"
                            style={{ background:'#10B98120', color:'#10B981', border:'1px solid #10B98140' }}>
                            ✅ Approve
                          </button>
                        )}
                        {!isHidden && (
                          <button onClick={() => setStatus(r.id, 'hidden')}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold"
                            style={{ background:'#EF444420', color:'#EF4444', border:'1px solid #EF444440' }}>
                            🚫 Hide
                          </button>
                        )}
                        {isHidden && (
                          <button onClick={() => setStatus(r.id, 'pending')}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold"
                            style={{ background:'#EAB30820', color:'#EAB308', border:'1px solid #EAB30840' }}>
                            ↩️ Restore
                          </button>
                        )}
                        <button onClick={() => startEdit(r)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold"
                          style={{ background:'#8B5CF620', color:'#8B5CF6', border:'1px solid #8B5CF640' }}>
                          ✏️ Edit
                        </button>
                        <button onClick={() => deleteReview(r.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold"
                          style={{ background:'#1E293B', color:'#94A3B8', border:'1px solid var(--viro-border)' }}>
                          🗑️ Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ReviewsTab
