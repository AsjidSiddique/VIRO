'use client'
/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { adminApi } from '../lib/adminApi'
import { showSimpleToast } from '../components/Toast'
import { uploadDealBoxImage, deleteDealBoxImage } from '../lib/storage'

function emptyDeal() {
  return {
    id: null,
    title: '',
    description: '',
    image: '',
    productIds: [],
    bundlePrice: '',
    deliveryMode: 'normal',      // 'free' | 'normal' | 'custom'
    customDeliveryPrice: '',
    maxQuantity: '',             // optional cap — blank = uncapped, limited only by product stock
    active: true,
  }
}

function liveProductPrice(p) {
  return (p.discount_price && p.discount_price < p.price) ? p.discount_price : p.price
}

function firstImage(p) {
  try {
    const imgs = typeof p.images === 'string' ? JSON.parse(p.images) : p.images
    return Array.isArray(imgs) ? imgs[0] : imgs
  } catch { return null }
}

export default function DealBoxTab() {
  const [deals, setDeals]       = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState(null)
  const [saving, setSaving]     = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const fileRef = useRef()

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: row }, { data: prodData }] = await Promise.all([
      supabase.from('site_settings').select('value').eq('key', 'deal_boxes').maybeSingle(),
      supabase.from('products').select('id,name,images,stock,price,discount_price,is_active,status').order('created_at', { ascending: false }),
    ])
    setDeals(Array.isArray(row?.value) ? row.value : [])
    setProducts(prodData || [])
    setLoading(false)
  }

  async function persist(next) {
    setSaving(true)
    const res = await adminApi('site_setting_update', { key: 'deal_boxes', value: next })
    setSaving(false)
    if (res?.error) { showSimpleToast('❌ Failed to save: ' + res.error, 'info'); return false }
    setDeals(next)
    return true
  }

  function computeSum(deal) {
    return (deal.productIds || []).reduce((sum, id) => {
      const p = products.find(pp => pp.id === id)
      return p ? sum + liveProductPrice(p) : sum
    }, 0)
  }

  // Availability = the SCARCEST included product's stock (buying a bundle
  // consumes one unit of every included product's real inventory), capped
  // further by an optional admin max quantity. Out of stock the instant ANY
  // included product hits 0 — even if the others still have plenty.
  function computeAvailability(deal) {
    const included = (deal.productIds || []).map(id => products.find(p => p.id === id)).filter(Boolean)
    if (included.length === 0) return { available: 0, outOfStock: true, scarcest: null }
    const stocks = included.map(p => ({ name: p.name, stock: p.stock ?? 0 }))
    const scarcest = stocks.reduce((min, s) => s.stock < min.stock ? s : min, stocks[0])
    const cap = Number(deal.maxQuantity)
    const available = Number.isFinite(cap) && cap > 0 ? Math.min(scarcest.stock, cap) : scarcest.stock
    return { available, outOfStock: scarcest.stock <= 0, scarcest }
  }

  function toggleProduct(id) {
    setEditing(e => {
      const has = e.productIds.includes(id)
      if (has) return { ...e, productIds: e.productIds.filter(x => x !== id) }
      if (e.productIds.length >= 4) { showSimpleToast('⚠️ Max 4 products per deal', 'info'); return e }
      return { ...e, productIds: [...e.productIds, id] }
    })
  }

  async function handleImageFile(file) {
    if (!file) return
    setUploadingImg(true)
    try {
      const url = await uploadDealBoxImage(file)
      setEditing(e => ({ ...e, image: url }))
    } catch (err) {
      showSimpleToast('❌ Upload failed: ' + err.message, 'info')
    }
    setUploadingImg(false)
  }

  async function handleSave() {
    if (!editing.title.trim())        { showSimpleToast('⚠️ Give the deal a title', 'info'); return }
    if (editing.productIds.length < 2) { showSimpleToast('⚠️ Pick at least 2 products', 'info'); return }
    if (!editing.image)                { showSimpleToast('⚠️ Upload a bundle image', 'info'); return }
    if (!editing.bundlePrice || Number(editing.bundlePrice) <= 0) { showSimpleToast('⚠️ Set a bundle price', 'info'); return }
    if (editing.deliveryMode === 'custom' && (!editing.customDeliveryPrice || Number(editing.customDeliveryPrice) < 0)) {
      showSimpleToast('⚠️ Set a custom delivery price', 'info'); return
    }

    const sum = computeSum(editing)
    const deal = {
      ...editing,
      id: editing.id || `deal_${Date.now()}`,
      title: editing.title.trim(),
      bundlePrice: Number(editing.bundlePrice),
      customDeliveryPrice: editing.deliveryMode === 'custom' ? Number(editing.customDeliveryPrice) || 0 : 0,
      maxQuantity: editing.maxQuantity !== '' && editing.maxQuantity != null ? Number(editing.maxQuantity) : null,
      originalPriceSum: sum,
      createdAt: editing.createdAt || Date.now(),
    }
    const exists = deals.some(d => d.id === deal.id)
    const next = exists ? deals.map(d => d.id === deal.id ? deal : d) : [...deals, deal]
    const ok = await persist(next)
    if (ok) { setEditing(null); showSimpleToast('✅ Deal saved', 'success') }
  }

  async function handleDelete(deal) {
    if (!confirm(`Delete "${deal.title}"? This can't be undone.`)) return
    const next = deals.filter(d => d.id !== deal.id)
    const ok = await persist(next)
    if (ok) {
      showSimpleToast('🗑️ Deal deleted', 'success')
      if (deal.image) deleteDealBoxImage(deal.image).catch(() => {})
    }
  }

  async function toggleActive(deal) {
    const next = deals.map(d => d.id === deal.id ? { ...d, active: !d.active } : d)
    await persist(next)
  }

  const filteredProducts = products.filter(p =>
    !pickerSearch.trim() || p.name.toLowerCase().includes(pickerSearch.trim().toLowerCase())
  )

  if (loading) return (
    <div className="px-4 py-10 text-center" style={{ color: 'var(--viro-textSub)' }}>⏳ Loading deals…</div>
  )

  // ── Edit / Create form ──────────────────────────────────────────────
  if (editing) {
    const sum = computeSum(editing)
    const bundlePriceNum = Number(editing.bundlePrice) || 0
    const savings = sum > 0 && bundlePriceNum > 0 ? sum - bundlePriceNum : 0

    return (
      <div className="px-4 pb-10 max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg" style={{ color: 'var(--viro-text)' }}>
            {editing.id ? '✏️ Edit Deal Box' : '🎁 New Deal Box'}
          </h2>
          <button onClick={() => setEditing(null)} className="text-sm font-semibold" style={{ color: 'var(--viro-textSub)' }}>← Back to list</button>
        </div>

        <div className="viro-card p-4 mb-4">
          <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--viro-textSub)' }}>Bundle Image *</label>
          <div className="flex items-center gap-3">
            <div style={{
              width: 88, height: 88, borderRadius: 14, overflow: 'hidden', flexShrink: 0,
              background: 'var(--viro-bgDeep)', border: '1.5px dashed var(--viro-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {editing.image
                ? <img src={editing.image} alt="Bundle" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 26 }}>📦</span>}
            </div>
            <div className="flex-1">
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => handleImageFile(e.target.files?.[0])} />
              <button onClick={() => fileRef.current?.click()} disabled={uploadingImg}
                className="px-4 py-2 rounded-xl text-sm font-bold"
                style={{ background: 'var(--viro-bgDeep)', border: '1px solid var(--viro-border)', color: 'var(--viro-text)', cursor: uploadingImg ? 'wait' : 'pointer' }}>
                {uploadingImg ? '⏳ Uploading…' : editing.image ? '🔄 Replace Image' : '📤 Upload Image'}
              </button>
              <p className="text-xs mt-1.5" style={{ color: 'var(--viro-textSub)' }}>
                One unique "packed bundle" photo for this deal — separate from the individual product photos.
              </p>
            </div>
          </div>
        </div>

        <div className="viro-card p-4 mb-4 space-y-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--viro-textSub)' }}>Deal Title *</label>
            <input value={editing.title} onChange={e => setEditing(x => ({ ...x, title: e.target.value }))}
              placeholder="e.g. Jewellery Combo Pack"
              className="w-full text-sm p-2.5 rounded-xl"
              style={{ border: '1px solid var(--viro-border)', background: 'var(--viro-bg)', color: 'var(--viro-text)' }} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--viro-textSub)' }}>Short Description</label>
            <textarea value={editing.description} onChange={e => setEditing(x => ({ ...x, description: e.target.value }))}
              placeholder="e.g. Ring + Earrings + Bracelet — the perfect matching set"
              rows={2}
              className="w-full text-sm p-2.5 rounded-xl resize-none"
              style={{ border: '1px solid var(--viro-border)', background: 'var(--viro-bg)', color: 'var(--viro-text)' }} />
          </div>
        </div>

        <div className="viro-card p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--viro-textSub)' }}>
              Products in this Deal * ({editing.productIds.length}/4)
            </label>
          </div>
          <input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
            placeholder="🔍 Search products to add…"
            className="w-full text-sm p-2.5 rounded-xl mb-2"
            style={{ border: '1px solid var(--viro-border)', background: 'var(--viro-bg)', color: 'var(--viro-text)' }} />
          <div style={{ maxHeight: 260, overflowY: 'auto' }} className="space-y-1.5 pr-1">
            {filteredProducts.map(p => {
              const selected = editing.productIds.includes(p.id)
              return (
                <div key={p.id} onClick={() => toggleProduct(p.id)}
                  className="flex items-center gap-2.5 p-2 rounded-xl cursor-pointer"
                  style={{
                    background: selected ? '#7C3AED12' : 'var(--viro-bgDeep)',
                    border: `1.5px solid ${selected ? '#7C3AED50' : 'var(--viro-border)'}`,
                  }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                    border: selected ? 'none' : '1.5px solid var(--viro-border)',
                    background: selected ? '#7C3AED' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff',
                  }}>{selected ? '✓' : ''}</div>
                  <img src={firstImage(p) || '/logo.jpg'} alt={p.name}
                    style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--viro-text)' }}>{p.name}</p>
                    <p className="text-xs" style={{ color: '#7C3AED', fontWeight: 700 }}>Rs.{liveProductPrice(p)?.toLocaleString()}</p>
                  </div>
                </div>
              )
            })}
            {filteredProducts.length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: 'var(--viro-textSub)' }}>No products match your search.</p>
            )}
          </div>
        </div>

        <div className="viro-card p-4 mb-4">
          <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--viro-textSub)' }}>Bundle Price *</label>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-bold" style={{ color: 'var(--viro-text)' }}>Rs.</span>
            <input type="number" min="0" step="1" value={editing.bundlePrice}
              onChange={e => setEditing(x => ({ ...x, bundlePrice: e.target.value }))}
              placeholder="999"
              className="flex-1 px-3 py-2 rounded-lg text-sm font-bold"
              style={{ background: 'var(--viro-bgDeep)', border: '1px solid var(--viro-border)', color: 'var(--viro-text)' }} />
          </div>
          {sum > 0 && (
            <p className="text-xs" style={{ color: savings > 0 ? '#10B981' : 'var(--viro-textSub)' }}>
              Sum of individual prices: Rs.{sum.toLocaleString()}
              {savings > 0 && <> · Shopper saves <strong>Rs.{savings.toLocaleString()}</strong> ({Math.round(savings / sum * 100)}%)</>}
              {savings <= 0 && bundlePriceNum > 0 && <> · ⚠️ Bundle price isn't cheaper than buying separately</>}
            </p>
          )}
        </div>

        <div className="viro-card p-4 mb-4">
          <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--viro-textSub)' }}>Max Quantity Available (optional)</label>
          <input type="number" min="0" step="1" value={editing.maxQuantity}
            onChange={e => setEditing(x => ({ ...x, maxQuantity: e.target.value }))}
            placeholder="Leave blank to sell as many as stock allows"
            className="w-full px-3 py-2 rounded-lg text-sm font-bold"
            style={{ background: 'var(--viro-bgDeep)', border: '1px solid var(--viro-border)', color: 'var(--viro-text)' }} />
          <p className="text-xs mt-2" style={{ color: 'var(--viro-textSub)' }}>
            A cap on top of stock, e.g. only ever sell 5 bundles even if more stock exists. The real ceiling is always whichever included product has the LEAST stock — buying a bundle uses up 1 unit of every product inside it.
          </p>
          {editing.productIds.length > 0 && (() => {
            const { available, outOfStock, scarcest } = computeAvailability(editing)
            return (
              <div className="mt-3 p-3 rounded-xl" style={{
                background: outOfStock ? '#EF444412' : '#10B98112',
                border: `1px solid ${outOfStock ? '#EF444430' : '#10B98130'}`,
              }}>
                <p className="text-sm font-bold" style={{ color: outOfStock ? '#EF4444' : '#10B981' }}>
                  {outOfStock ? '⛔ Out of Stock' : `✅ ${available} bundle(s) available now`}
                </p>
                {scarcest && (
                  <p className="text-xs mt-1" style={{ color: 'var(--viro-textSub)' }}>
                    Limited by "{scarcest.name}" ({scarcest.stock} in stock)
                  </p>
                )}
              </div>
            )
          })()}
        </div>

        <div className="viro-card p-4 mb-6">
          <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--viro-textSub)' }}>Delivery for this Deal</label>
          <div className="space-y-2">
            {[
              { key: 'normal', label: 'Normal delivery', desc: 'Standard delivery rules apply, same as any other order' },
              { key: 'free',   label: '🚚 Free delivery', desc: 'Waives delivery for the WHOLE cart when this deal is in it — even if other items alone wouldn\'t qualify' },
              { key: 'custom', label: '💰 Custom delivery price', desc: 'Override with a fixed delivery amount when this deal is in the cart' },
            ].map(opt => (
              <div key={opt.key} onClick={() => setEditing(x => ({ ...x, deliveryMode: opt.key }))}
                className="flex items-start gap-3 p-3 rounded-xl cursor-pointer"
                style={{
                  background: editing.deliveryMode === opt.key ? '#7C3AED12' : 'var(--viro-bgDeep)',
                  border: `1.5px solid ${editing.deliveryMode === opt.key ? '#7C3AED50' : 'var(--viro-border)'}`,
                }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                  border: editing.deliveryMode === opt.key ? 'none' : '1.5px solid var(--viro-border)',
                  background: editing.deliveryMode === opt.key ? '#7C3AED' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{editing.deliveryMode === opt.key && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}</div>
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: 'var(--viro-text)' }}>{opt.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--viro-textSub)' }}>{opt.desc}</p>
                  {opt.key === 'custom' && editing.deliveryMode === 'custom' && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-bold" style={{ color: 'var(--viro-text)' }}>Rs.</span>
                      <input type="number" min="0" value={editing.customDeliveryPrice}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setEditing(x => ({ ...x, customDeliveryPrice: e.target.value }))}
                        placeholder="100"
                        className="px-3 py-1.5 rounded-lg text-sm font-bold w-28"
                        style={{ background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)', color: 'var(--viro-text)' }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? '⏳ Saving…' : '💾 Save Deal Box'}
          </button>
          <button onClick={() => setEditing(null)}
            className="px-5 py-3 rounded-xl text-sm font-bold"
            style={{ background: 'var(--viro-bgDeep)', border: '1px solid var(--viro-border)', color: 'var(--viro-text)', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // ── List view ────────────────────────────────────────────────────────
  return (
    <div className="px-4 pb-10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-lg" style={{ color: 'var(--viro-text)' }}>🎁 Deal Boxes</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--viro-textSub)' }}>
            Bundle 2-4 products under one price to boost average order value — shown on /shop with their own filter.
          </p>
        </div>
        <button onClick={() => setEditing(emptyDeal())}
          className="px-4 py-2.5 rounded-xl text-sm font-bold text-white flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)', border: 'none', cursor: 'pointer' }}>
          + New Deal
        </button>
      </div>

      {deals.length === 0 ? (
        <div className="viro-card p-10 text-center">
          <p style={{ fontSize: 36, marginBottom: 8 }}>🎁</p>
          <p className="font-bold mb-1" style={{ color: 'var(--viro-text)' }}>No deal boxes yet</p>
          <p className="text-sm" style={{ color: 'var(--viro-textSub)' }}>Create your first bundle to start boosting AOV.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map(deal => {
            const sum = computeSum(deal)
            const savings = sum - deal.bundlePrice
            const { available, outOfStock, scarcest } = computeAvailability(deal)
            return (
              <div key={deal.id} className="viro-card overflow-hidden">
                <div style={{ position: 'relative', height: 140, background: 'var(--viro-bgDeep)' }}>
                  {deal.image && <img src={deal.image} alt={deal.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  <span style={{
                    position: 'absolute', top: 8, left: 8, padding: '3px 9px', borderRadius: 999,
                    background: outOfStock ? '#EF4444' : deal.active ? '#10B981' : '#94A3B8', color: '#fff', fontSize: 10, fontWeight: 800,
                  }}>{outOfStock ? 'OUT OF STOCK' : deal.active ? 'ACTIVE' : 'HIDDEN'}</span>
                  {deal.deliveryMode === 'free' && (
                    <span style={{
                      position: 'absolute', top: 8, right: 8, padding: '3px 9px', borderRadius: 999,
                      background: '#7C3AED', color: '#fff', fontSize: 10, fontWeight: 800,
                    }}>🚚 FREE DELIVERY</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-bold text-sm truncate mb-0.5" style={{ color: 'var(--viro-text)' }}>{deal.title}</p>
                  <p className="text-xs mb-1" style={{ color: 'var(--viro-textSub)' }}>{(deal.productIds || []).length} products included</p>
                  <p className="text-xs mb-2 font-bold" style={{ color: outOfStock ? '#EF4444' : '#10B981' }}>
                    {outOfStock ? `⛔ Out of stock (${scarcest?.name} has 0)` : `✅ ${available} available`}
                  </p>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="font-bold" style={{ color: '#7C3AED' }}>Rs.{deal.bundlePrice?.toLocaleString()}</span>
                    {sum > 0 && <span className="text-xs line-through" style={{ color: 'var(--viro-textSub)' }}>Rs.{sum.toLocaleString()}</span>}
                    {savings > 0 && <span className="text-xs font-bold" style={{ color: '#10B981' }}>Save Rs.{savings.toLocaleString()}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditing({ ...deal, bundlePrice: String(deal.bundlePrice), customDeliveryPrice: String(deal.customDeliveryPrice || ''), maxQuantity: deal.maxQuantity != null ? String(deal.maxQuantity) : '' })}
                      className="flex-1 py-2 rounded-lg text-xs font-bold"
                      style={{ background: 'var(--viro-bgDeep)', border: '1px solid var(--viro-border)', color: 'var(--viro-text)', cursor: 'pointer' }}>
                      ✏️ Edit
                    </button>
                    <button onClick={() => toggleActive(deal)}
                      className="flex-1 py-2 rounded-lg text-xs font-bold"
                      style={{ background: 'var(--viro-bgDeep)', border: '1px solid var(--viro-border)', color: 'var(--viro-text)', cursor: 'pointer' }}>
                      {deal.active ? '🙈 Hide' : '👁️ Show'}
                    </button>
                    <button onClick={() => handleDelete(deal)}
                      className="py-2 px-3 rounded-lg text-xs font-bold"
                      style={{ background: '#EF444412', border: '1px solid #EF444430', color: '#EF4444', cursor: 'pointer' }}>
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
