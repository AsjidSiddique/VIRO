'use client'
import { supabase } from '../lib/supabase'
/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useRef } from 'react'
import { adminApi } from '../lib/adminApi'
import { showSimpleToast } from '../components/Toast'
import { useTheme } from '../context/ThemeContext'
import { useSite } from '../context/SiteSettingsContext'
import { uploadCategoryImage, uploadHeroImage, uploadPromoPopupImage } from '../lib/storage'
import { DEFAULT_PROMO_POPUP, DEFAULT_EXIT_POPUP } from '../context/SiteSettingsContext'

// ── Reusable image grid for hero/strip images ─────────────────
function ImageGrid({ images, setImages, label, onSave, uploadFn }) {
  const [uploading, setUploading] = useState(false)
  const ref = useRef()

  // Use provided uploadFn (e.g. uploadHeroImage) or fall back to uploadCategoryImage
  const doUpload = uploadFn || uploadCategoryImage

  async function handleFiles(files) {
    if (!files?.length) return
    setUploading(true)
    const urls = []
    for (const file of Array.from(files)) {
      try {
        const url = await doUpload(file)
        if (url) urls.push(url)
      } catch (e) {
        showSimpleToast('❌ Upload failed: ' + e.message, 'info')
      }
    }
    const next = [...images, ...urls]
    setImages(next)
    if (onSave) onSave(next)
    setUploading(false)
  }

  function remove(idx) {
    const next = images.filter((_, i) => i !== idx)
    setImages(next)
    if (onSave) onSave(next)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {images.map((url, i) => (
          <div key={url + i} className="relative group flex-shrink-0">
            <img src={url} alt="" className="w-20 h-20 rounded-xl object-cover border-2"
              style={{ borderColor: '#1E2A45' }} />
            <button onClick={() => remove(i)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: '#EF4444', fontSize: 10, fontWeight: 900 }}>✕</button>
          </div>
        ))}
      </div>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
      <button onClick={() => ref.current?.click()}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
        style={{ background: 'linear-gradient(135deg,#8B5CF6,#F97316)', color: '#fff' }}>
        {uploading ? '⏳ Uploading…' : `📸 Upload ${label}`}
      </button>
    </div>
  )
}

// ── Main SiteSettingsTab ──────────────────────────────────────
/**
 * Editor for a "Tab Group" home block — the horizontally-scrollable category
 * tab row (Jewelry Set / Choker / Necklace / …) where each tab switches which
 * curated product row shows underneath. Reuses existing Product Blocks as the
 * content source for each tab instead of re-picking products — pick a block,
 * give the tab whatever label the customer should see (independent of the
 * block's own admin-facing title), done.
 */
function TabGroupEditor({ block, idx, homeBlocks, setHomeBlocks }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const tabs = block.tabs || []
  // Only plain product blocks (not other tab groups, not this block itself)
  // can be used as a tab's content source.
  const availableSources = homeBlocks.filter(b => b.id !== block.id && b.type !== 'tabs')

  function updateTabs(next) {
    setHomeBlocks(prev => prev.map((b, i) => i === idx ? { ...b, tabs: next } : b))
  }
  function addTab(sourceBlock) {
    updateTabs([...tabs, { id: crypto.randomUUID(), label: sourceBlock.title, sourceBlockId: sourceBlock.id }])
    setPickerOpen(false)
  }
  function removeTab(tabId) {
    updateTabs(tabs.filter(t => t.id !== tabId))
  }
  function relabelTab(tabId, label) {
    updateTabs(tabs.map(t => t.id === tabId ? { ...t, label } : t))
  }

  return (
    <div className="px-4 pt-3 pb-4">
      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color:'var(--viro-textSub)' }}>
        Tabs in this group ({tabs.length} — customers see these as a scrollable row, e.g. "Jewelry Set · Choker · Necklace")
      </p>

      {tabs.length > 0 && (
        <>
          <p style={{ fontSize:10, fontWeight:700, color:'var(--viro-textSub)', marginBottom:5 }}>
            ↕️ Drag to reorder — this is the order tabs appear left→right
          </p>
          <div className="flex flex-col gap-2 mb-3">
            {tabs.map((tab, tIdx) => {
              const source = homeBlocks.find(b => b.id === tab.sourceBlockId)
              return (
                <div key={tab.id}
                  draggable
                  onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(tIdx)) }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault()
                    const fromIdx = Number(e.dataTransfer.getData('text/plain'))
                    if (Number.isNaN(fromIdx) || fromIdx === tIdx) return
                    const next = [...tabs]
                    const [moved] = next.splice(fromIdx, 1)
                    next.splice(tIdx, 0, moved)
                    updateTabs(next)
                  }}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl"
                  style={{ background:'#F9731612', border:'1px solid #F9731640', cursor:'grab' }}>
                  <span style={{ color:'var(--viro-textSub)', fontSize:11, cursor:'grab' }}>⠿</span>
                  <input value={tab.label} onChange={e => relabelTab(tab.id, e.target.value)}
                    placeholder="Tab label customers see…"
                    className="text-xs font-bold flex-1 min-w-0 bg-transparent border-none outline-none"
                    style={{ color:'var(--viro-text)' }} />
                  <span className="text-xs flex-shrink-0 px-2 py-1 rounded-lg"
                    style={{ background:'var(--viro-bgDeep)', color: source ? 'var(--viro-textSub)' : '#EF4444', maxWidth: 140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {source ? `← ${source.title}` : '⚠ block deleted'}
                  </span>
                  <button onClick={() => removeTab(tab.id)}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'#EF4444', fontSize:13, flexShrink:0 }}>✕</button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {tabs.length === 0 && (
        <p className="text-xs mb-3 p-3 rounded-xl text-center" style={{ background:'var(--viro-bgDeep)', color:'var(--viro-textSub)' }}>
          No tabs yet. Add at least 2 existing Product Blocks below as tabs.
        </p>
      )}

      {/* Add tab — pick from existing Product Blocks */}
      <div className="relative">
        <button type="button" onClick={() => setPickerOpen(o => !o)}
          className="w-full text-xs font-bold px-3 py-2.5 rounded-xl"
          style={{ background:'#F9731615', color:'#F97316', border:'1px dashed #F9731650' }}>
          + Add Tab (from an existing Product Block)
        </button>
        {pickerOpen && (
          <div className="mt-2 rounded-xl overflow-hidden" style={{ border:'1px solid var(--viro-border)', maxHeight:220, overflowY:'auto' }}>
            {availableSources.length === 0 && (
              <p className="text-xs p-3 text-center" style={{ color:'var(--viro-textSub)' }}>
                No product blocks to pull from yet — create a regular "+ Add Block" with products first, then link it here as a tab.
              </p>
            )}
            {availableSources.map(src => {
              const already = tabs.some(t => t.sourceBlockId === src.id)
              return (
                <button key={src.id} type="button" disabled={already}
                  onClick={() => addTab(src)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left disabled:opacity-40"
                  style={{ borderBottom:'1px solid var(--viro-border)', background: already ? 'var(--viro-bgDeep)' : 'transparent' }}>
                  <span className="text-xs font-semibold" style={{ color:'var(--viro-text)' }}>{src.title}</span>
                  <span className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                    {already ? 'already added' : `${(src.productIds||[]).length} products →`}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Editor for the mobile side-drawer menu (the ☰ hamburger). Each entry
 * points at one of three sources — "All Products", a subcategory, or an
 * existing Home Block's product set — with a customer-facing label that's
 * independent from the source's own admin name, same pattern as Tab Groups.
 * Clicking a block-sourced item on the storefront lands on /shop pre-filtered
 * to just that block's products.
 */
function SideMenuEditor({ sideMenu, setSideMenu, homeBlocks, categories }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerTab, setPickerTab] = useState('category') // 'all' | 'category' | 'block'
  const [pickerSearch, setPickerSearch] = useState('')
  const productBlocks = homeBlocks.filter(b => b.type !== 'tabs')
  const topCats = categories.filter(c => !c.parent_id)
  const hasAllProducts = sideMenu.some(m => m.type === 'all')

  const TYPE_COLOR = { all: '#00BFFF', category: '#8B5CF6', block: '#F97316' }
  const TYPE_ICON  = { all: '🛍', category: '🏷', block: '📦' }

  function addItem(item) {
    setSideMenu(prev => [...prev, { id: crypto.randomUUID(), ...item }])
  }
  function removeItem(id) {
    setSideMenu(prev => prev.filter(m => m.id !== id))
  }
  function relabel(id, label) {
    setSideMenu(prev => prev.map(m => m.id === id ? { ...m, label } : m))
  }
  function sourceLabel(item) {
    if (item.type === 'all') return 'All Products'
    if (item.type === 'category') {
      const c = categories.find(x => x.id === item.categoryId)
      return c ? c.name : '⚠ deleted'
    }
    if (item.type === 'block') {
      const b = homeBlocks.find(x => x.id === item.blockId)
      return b ? b.title : '⚠ deleted'
    }
    return '—'
  }

  // Categories tab: parent + its subcategories together, filterable by
  // search so a store with many subcategories (Women's Fashion → Necklace
  // Sets, Rings, Earrings…) never turns into one long forced scroll.
  const q = pickerSearch.trim().toLowerCase()
  const categoryTree = topCats
    .map(parent => ({
      parent,
      children: categories.filter(c => c.parent_id === parent.id),
    }))
    .map(({ parent, children }) => ({
      parent,
      children: q ? children.filter(c => c.name.toLowerCase().includes(q)) : children,
    }))
    .filter(({ parent, children }) => !q || parent.name.toLowerCase().includes(q) || children.length > 0)

  const filteredBlocks = productBlocks.filter(b => !q || b.title.toLowerCase().includes(q))

  return (
    <div className="viro-card p-4">
      {/* Fixed, non-removable — always first, matches how every reference
          drawer (and common sense) treats "Home" as a given, not a setting. */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg mb-2"
        style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)', opacity:0.7 }}>
        <span style={{ fontSize:10 }}>🔒</span>
        <span className="text-xs font-bold flex-1" style={{ color:'var(--viro-text)' }}>Home</span>
        <span className="text-xs" style={{ color:'var(--viro-textSub)' }}>always first</span>
      </div>

      {sideMenu.length > 0 && (
        <>
          <p style={{ fontSize:10, fontWeight:700, color:'var(--viro-textSub)', marginBottom:4 }}>
            ↕️ Drag to reorder
          </p>
          {/* Compact rows — a colored left bar + small type icon replaces the
              old full-text source badge, so each row is one tight line
              instead of a tall, padded box; the whole list stays short even
              with 10+ items instead of "expanding" the page. */}
          <div className="flex flex-col gap-1 mb-3">
            {sideMenu.map((item, idx) => (
              <div key={item.id}
                draggable
                onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(idx)) }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  const fromIdx = Number(e.dataTransfer.getData('text/plain'))
                  if (Number.isNaN(fromIdx) || fromIdx === idx) return
                  const next = [...sideMenu]
                  const [moved] = next.splice(fromIdx, 1)
                  next.splice(idx, 0, moved)
                  setSideMenu(next)
                }}
                className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-lg"
                style={{ background:'var(--viro-bgCard)', borderLeft:`3px solid ${TYPE_COLOR[item.type] || '#8B5CF6'}`, cursor:'grab' }}>
                <span style={{ color:'var(--viro-textSub)', fontSize:10, cursor:'grab', flexShrink:0 }}>⠿</span>
                <span style={{ fontSize:11, flexShrink:0 }}>{TYPE_ICON[item.type] || '•'}</span>
                <input value={item.label} onChange={e => relabel(item.id, e.target.value)}
                  placeholder="Label…"
                  className="text-xs font-bold flex-1 min-w-0 bg-transparent border-none outline-none"
                  style={{ color:'var(--viro-text)' }} />
                <span className="text-xs flex-shrink-0" style={{ color:'var(--viro-textSub)', maxWidth:110, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {sourceLabel(item)}
                </span>
                <button onClick={() => removeItem(item.id)}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'#EF4444', fontSize:12, flexShrink:0, padding:'0 2px' }}>✕</button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="relative">
        <button type="button" onClick={() => setPickerOpen(o => !o)}
          className="w-full text-xs font-bold px-3 py-2 rounded-xl"
          style={{ background:'#8B5CF615', color:'#8B5CF6', border:'1px dashed #8B5CF650' }}>
          {pickerOpen ? '✕ Close' : '+ Add Menu Item'}
        </button>

        {pickerOpen && (
          <div className="mt-2 rounded-xl overflow-hidden" style={{ border:'1px solid var(--viro-border)' }}>
            {/* Segmented tabs — splits what used to be one long flat scroll
                into three short, scoped lists */}
            <div className="flex" style={{ borderBottom:'1px solid var(--viro-border)' }}>
              {[['category','🏷 Categories'],['block','📦 Home Blocks'],['all','🛍 All Products']].map(([id,label]) => (
                <button key={id} type="button" onClick={() => setPickerTab(id)}
                  className="flex-1 text-xs font-bold py-2"
                  style={pickerTab === id
                    ? { background:'var(--viro-bgCard)', color:'#8B5CF6', borderBottom:'2px solid #8B5CF6' }
                    : { background:'var(--viro-bgDeep)', color:'var(--viro-textSub)' }}>
                  {label}
                </button>
              ))}
            </div>

            {pickerTab !== 'all' && (
              <input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
                placeholder={pickerTab === 'category' ? 'Search categories & subcategories…' : 'Search home blocks…'}
                className="text-xs w-full border-none outline-none px-3 py-2"
                style={{ background:'var(--viro-bgDeep)', borderBottom:'1px solid var(--viro-border)', color:'var(--viro-text)' }} />
            )}

            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {pickerTab === 'all' && (
                hasAllProducts ? (
                  <p className="text-xs p-3 text-center" style={{ color:'var(--viro-textSub)' }}>Already added.</p>
                ) : (
                  <button type="button" onClick={() => { addItem({ type:'all', label:'All Products', icon:'🛍' }); setPickerOpen(false) }}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left">
                    <span className="text-xs font-semibold" style={{ color:'var(--viro-text)' }}>🛍 All Products</span>
                    <span className="text-xs" style={{ color:'var(--viro-textSub)' }}>links to /shop →</span>
                  </button>
                )
              )}

              {pickerTab === 'category' && (
                categoryTree.length === 0 ? (
                  <p className="text-xs p-3 text-center" style={{ color:'var(--viro-textSub)' }}>No matches.</p>
                ) : categoryTree.map(({ parent, children }) => {
                  const parentAlready = sideMenu.some(m => m.type === 'category' && m.categoryId === parent.id)
                  return (
                    <div key={parent.id}>
                      <button type="button" disabled={parentAlready}
                        onClick={() => { addItem({ type:'category', label:parent.name, categoryId:parent.id, icon:parent.icon || '🏷' }) }}
                        className="w-full flex items-center justify-between px-3 py-2 text-left disabled:opacity-40"
                        style={{ borderBottom:'1px solid var(--viro-border)', background:'var(--viro-bgDeep)' }}>
                        <span className="text-xs font-bold" style={{ color:'var(--viro-text)' }}>{parent.icon} {parent.name}</span>
                        <span className="text-xs" style={{ color:'var(--viro-textSub)' }}>{parentAlready ? 'added' : 'add →'}</span>
                      </button>
                      {children.map(c => {
                        const already = sideMenu.some(m => m.type === 'category' && m.categoryId === c.id)
                        return (
                          <button key={c.id} type="button" disabled={already}
                            onClick={() => addItem({ type:'category', label:c.name, categoryId:c.id, icon:c.icon || '🏷' })}
                            className="w-full flex items-center justify-between pl-6 pr-3 py-1.5 text-left disabled:opacity-40"
                            style={{ borderBottom:'1px solid var(--viro-border)' }}>
                            <span className="text-xs" style={{ color:'var(--viro-text)' }}>↳ {c.icon} {c.name}</span>
                            <span className="text-xs" style={{ color:'var(--viro-textSub)' }}>{already ? 'added' : 'add →'}</span>
                          </button>
                        )
                      })}
                    </div>
                  )
                })
              )}

              {pickerTab === 'block' && (
                filteredBlocks.length === 0 ? (
                  <p className="text-xs p-3 text-center" style={{ color:'var(--viro-textSub)' }}>
                    {productBlocks.length === 0 ? 'No Home Blocks yet — create one above first.' : 'No matches.'}
                  </p>
                ) : filteredBlocks.map(b => {
                  const already = sideMenu.some(m => m.type === 'block' && m.blockId === b.id)
                  return (
                    <button key={b.id} type="button" disabled={already}
                      onClick={() => addItem({ type:'block', label:b.title, blockId:b.id, icon:'📦' })}
                      className="w-full flex items-center justify-between px-3 py-2 text-left disabled:opacity-40"
                      style={{ borderBottom:'1px solid var(--viro-border)' }}>
                      <span className="text-xs font-semibold" style={{ color:'var(--viro-text)' }}>📦 {b.title}</span>
                      <span className="text-xs" style={{ color:'var(--viro-textSub)' }}>{already ? 'added' : `${(b.productIds||[]).length} products →`}</span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SiteSettingsTab() {
  const { reload: reloadSiteSettings, ordersBadgeEnabled, setOrdersBadgeEnabled } = useSite()
  const { theme, setTheme } = useTheme()
  const { reviewsEnabled, setReviewsEnabled, autoApproveReviews, setAutoApproveReviews } = useSite()
  const { couponEnabled, setCouponEnabled } = useSite()
  const { prepaidDiscountPercent, setPrepaidDiscountPercent } = useSite()
  const { rawSettings } = useSite()
  const [featureToggles, setFeatureToggles] = useState({
    recently_viewed: true, complete_the_set: true,
    whatsapp_cart_recovery: true, push_cart_recovery: true,
  })
  const [featureToggleSaving, setFeatureToggleSaving] = useState(false)
  useEffect(() => {
    if (rawSettings?.feature_toggles) {
      setFeatureToggles(prev => ({ ...prev, ...rawSettings.feature_toggles }))
    }
  }, [rawSettings?.feature_toggles])

  async function toggleFeature(key) {
    setFeatureToggleSaving(true)
    const next = { ...featureToggles, [key]: !featureToggles[key] }
    setFeatureToggles(next)
    try {
      await adminApi('site_setting_update', { key: 'feature_toggles', value: next })
      showSimpleToast(next[key] ? '✅ Feature enabled' : '🚫 Feature disabled', 'success')
    } catch (err) {
      setFeatureToggles(featureToggles) // revert on failure
      showSimpleToast('❌ Failed to save — try again', 'error')
    } finally {
      setFeatureToggleSaving(false)
    }
  }

  const [orderBadgeSaving,   setOrderBadgeSaving]   = useState(false)
  const [globalToggleSaving, setGlobalToggleSaving]  = useState(false)
  const [settingSaving,      setSettingSaving]        = useState(false)
  const [priceDropEnabled,   setPriceDropEnabled]      = useState(true)
  const [priceDropOnceOnly,  setPriceDropOnceOnly]     = useState(false)
  const [upsellEnabled,      setUpsellEnabled]         = useState(true)
  const [upsellMinOrder,     setUpsellMinOrder]        = useState(400)
  const [codAdvanceEnabled,  setCodAdvanceEnabled]     = useState(false)
  const [codAdvanceAmount,   setCodAdvanceAmount]      = useState(150)
  const [prepaidPercentInput, setPrepaidPercentInput] = useState('0')
  const [prepaidSaving,       setPrepaidSaving]       = useState(false)
  const [jazzcashNumber,      setJazzcashNumber]      = useState('03184485469')
  const [jazzcashName,        setJazzcashName]        = useState('Asjid Siddique')
  const [easypaisaNumber,     setEasypaisaNumber]     = useState('03184485469')
  const [easypaisaName,       setEasypaisaName]       = useState('Asjid Siddique')
  const [prepaidAccountsSaving, setPrepaidAccountsSaving] = useState(false)
  const [minOrderEnabled,    setMinOrderEnabled]     = useState(false)
  const [minOrderAmount,     setMinOrderAmount]      = useState(299)
  const [minOrderSaving,     setMinOrderSaving]      = useState(false)
  const [fgEnabled,   setFgEnabled]   = useState(false)
  const [fgThreshold, setFgThreshold] = useState(2000)
  const [fgProductId, setFgProductId] = useState(null)
  const [fgProductSearch, setFgProductSearch] = useState('')
  const [fgSaving,    setFgSaving]    = useState(false)
  const [deliveryCheckAfterPrepaid, setDeliveryCheckAfterPrepaid] = useState(false)
  const [deliveryCheckSaving, setDeliveryCheckSaving] = useState(false)
  const [couponDeliveryCheckAfter, setCouponDeliveryCheckAfter] = useState(false)
  const [couponDeliveryCheckSaving, setCouponDeliveryCheckSaving] = useState(false)

  // Keep the input box synced with context, but only before the admin starts typing —
  // avoids the cursor jumping mid-edit if context re-fetches in the background.
  const prepaidInputTouched = useRef(false)
  useEffect(() => {
    if (!prepaidInputTouched.current) setPrepaidPercentInput(String(prepaidDiscountPercent ?? 0))
  }, [prepaidDiscountPercent])

  // ── State ─────────────────────────────────────────────────
  const [contact,       setContact]       = useState({ phone:'', whatsapp:'', email:'', address:'' })
  const [deliveryRules, setDeliveryRules] = useState([
    { label:'Burewala',         cities:'burewala', freeThreshold:999,  charge:150 },
    { label:'Vehari',           cities:'vehari',   freeThreshold:1500, charge:150 },
    { label:'All Other Cities', cities:'*',        freeThreshold:2500, charge:150 },
  ])
  const [messages,   setMessages]   = useState('')
  const [heroData,   setHeroData]   = useState({ title:'', subtitle:'', badge:'' })
  const [hotAds,     setHotAds]     = useState({ title:'', enabled:false })
  const [heroImages, setHeroImages] = useState([])
  const [homeBlocks, setHomeBlocks] = useState([])
  const [sideMenu, setSideMenu] = useState([])
  const [promoPopup, setPromoPopup] = useState(DEFAULT_PROMO_POPUP)
  const [exitPopup, setExitPopup] = useState(DEFAULT_EXIT_POPUP)
  const [hbProducts, setHbProducts] = useState([])   // all products for picker
  const [hbSearch, setHbSearch] = useState({})        // { [blockIdx]: 'search text' } — per-block search box
  const [saving,     setSaving]     = useState({})
  const [activeSection, setActiveSection] = useState('contact')
  const [seoSettings, setSeoSettings] = useState({ site_name:'Viro', tagline:'Smart Shopping, Better Living', google_verification:'', bing_verification:'' })
  // Static page content — editable from Pages tab
  const [pageAbout,   setPageAbout]   = useState(null)
  const [pageReturn,  setPageReturn]  = useState(null)
  const [pagePrivacy, setPagePrivacy] = useState(null)
  const [pageTerms,   setPageTerms]   = useState(null)
  const [testCity,   setTestCity]   = useState('')
  const [testAmount, setTestAmount] = useState(0)
  const [searchSuggestions, setSearchSuggestions] = useState([])
  const [newSuggestion, setNewSuggestion] = useState('')

  const testCharge = React.useMemo(() => {
    if (!testCity || !testAmount) return null
    const c = testCity.trim().toLowerCase()
    const rules = deliveryRules.map(r => ({
      ...r,
      cities: typeof r.cities === 'string'
        ? r.cities.split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
        : r.cities,
    }))
    const match = rules.find(r => r.cities.includes(c)) || rules.find(r => r.cities.includes('*'))
    if (!match) return 150
    return testAmount >= match.freeThreshold ? 0 : match.charge
  }, [testCity, testAmount, deliveryRules])

  // ── Load settings ─────────────────────────────────────────
  useEffect(() => {
    async function loadSettings() {
      const { data } = await supabase.from('site_settings').select('*')
      const all = {}
      ;(data || []).forEach(r => { all[r.key] = r.value })
      if (all.contact) setContact(c => ({ ...c, ...all.contact }))
      setDeliveryCheckAfterPrepaid(all.prepaid_delivery_check_after === true)
      setCouponDeliveryCheckAfter(all.coupon_delivery_check_after === true)
      if (all.price_drop_notice) {
        setPriceDropEnabled(all.price_drop_notice.enabled !== false)
        setPriceDropOnceOnly(!!all.price_drop_notice.once_only)
      }
      if (all.checkout_upsell) {
        setUpsellEnabled(all.checkout_upsell.enabled !== false)
        setUpsellMinOrder(Number(all.checkout_upsell.min_order_value ?? 400))
      }
      if (all.cod_advance) {
        setCodAdvanceEnabled(!!all.cod_advance.enabled)
        setCodAdvanceAmount(Number(all.cod_advance.amount ?? 150))
      }
      if (all.prepaid_accounts) {
        setJazzcashNumber(all.prepaid_accounts.jazzcash?.number || '03184485469')
        setJazzcashName(all.prepaid_accounts.jazzcash?.name || 'Asjid Siddique')
        setEasypaisaNumber(all.prepaid_accounts.easypaisa?.number || '03184485469')
        setEasypaisaName(all.prepaid_accounts.easypaisa?.name || 'Asjid Siddique')
      }
      if (all.min_order_amount) {
        setMinOrderEnabled(!!all.min_order_amount.enabled)
        setMinOrderAmount(Number(all.min_order_amount.amount ?? 299))
      }
      if (all.free_gift) {
        setFgEnabled(!!all.free_gift.enabled)
        setFgThreshold(Number(all.free_gift.threshold ?? 2000))
        setFgProductId(all.free_gift.productId || null)
      }
      if (all.delivery_rules) {
        setDeliveryRules(all.delivery_rules.map(r => ({
          ...r,
          cities: Array.isArray(r.cities) ? r.cities.join(',') : r.cities,
        })))
      }
      if (all.announcement?.messages) setMessages(all.announcement.messages.join('\n'))
      if (all.hero) {
        setHeroData({ title: all.hero.title || '', subtitle: all.hero.subtitle || '', badge: all.hero.badge || '' })
        // Always fetch from the actual hero_section bucket — auto-fixes old wrong-bucket URLs
        try {
          const { data: bucketFiles } = await supabase.storage.from('hero_section').list('', { limit: 50 })
          if (bucketFiles?.length) {
            const bucketUrls = bucketFiles
              .filter(f => f.name && /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name))
              .map(f => supabase.storage.from('hero_section').getPublicUrl(f.name).data.publicUrl)
              .filter(Boolean)
            if (bucketUrls.length) { setHeroImages(bucketUrls); }
            else if (all.hero.images) setHeroImages(all.hero.images)
          } else if (all.hero.images) {
            setHeroImages(all.hero.images)
          }
        } catch { if (all.hero.images) setHeroImages(all.hero.images) }
      }
      if (all.hot_ads) setHotAds(all.hot_ads)
      if (all.home_blocks) setHomeBlocks(all.home_blocks)
      if (all.side_menu) setSideMenu(all.side_menu)
      if (all.promo_popup) {
        const legacyImages = Array.isArray(all.promo_popup.images)
          ? all.promo_popup.images
          : (all.promo_popup.image ? [all.promo_popup.image] : [])
        setPromoPopup(p => ({ ...p, ...all.promo_popup, images: legacyImages }))
      }
      if (all.exit_intent_popup) setExitPopup(p => ({ ...p, ...all.exit_intent_popup }))
      if (all.seo_settings)       setSeoSettings(s => ({...s,...all.seo_settings}))
      if (all.search_suggestions)  setSearchSuggestions(all.search_suggestions || [])
      if (all.page_about)         setPageAbout(all.page_about)
      if (all.page_return_policy) setPageReturn(all.page_return_policy)
      if (all.page_privacy_policy)setPagePrivacy(all.page_privacy_policy)
      if (all.page_terms)         setPageTerms(all.page_terms)
    }
    loadSettings()
  }, []) /* eslint-disable-line react-hooks/exhaustive-deps */

  const [hbCategories, setHbCategories] = useState([])

  // Load products + categories for home block picker
  useEffect(() => {
    supabase.from('products')
      .select('id, name, images, price, discount_price, is_active, status, category_id, created_at')
      .or('is_active.eq.true,status.eq.coming_soon')
      .order('created_at', { ascending: false })
      .then(({ data }) => setHbProducts(data || []))
    supabase.from('categories').select('id, name, icon, parent_id')
      .order('sort_order')
      .then(({ data }) => setHbCategories(data || []))
  }, [])

  // Smart auto-fill: adds products to a block based on a strategy
  function smartFill(blockIdx, strategy, catId = null) {
    setHomeBlocks(prev => prev.map((block, i) => {
      if (i !== blockIdx) return block
      let pool = hbProducts.filter(p => p.is_active || p.status === 'coming_soon')
      // Filter by category if specified
      if (catId) {
        const childIds = hbCategories.filter(c => c.parent_id === catId).map(c => c.id)
        pool = pool.filter(p => p.category_id === catId || childIds.includes(p.category_id))
      }
      let sorted = [...pool]
      if (strategy === 'cheapest')   sorted.sort((a,b) => Number(a.price) - Number(b.price))
      if (strategy === 'expensive')  sorted.sort((a,b) => Number(b.price) - Number(a.price))
      if (strategy === 'newest')     sorted.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
      if (strategy === 'discount') {
        sorted = sorted.filter(p => p.discount_price && Number(p.discount_price) < Number(p.price))
        sorted.sort((a,b) => {
          const da = (1 - a.discount_price/a.price)
          const db = (1 - b.discount_price/b.price)
          return db - da
        })
      }
      const top = sorted.slice(0, 12).map(p => p.id)
      // Merge with existing (no duplicates)
      const existing = block.productIds || []
      const merged = [...existing, ...top.filter(id => !existing.includes(id))]
      return { ...block, productIds: merged }
    }))
  }

  async function saveSetting(key, value) {
    setSaving(s => ({ ...s, [key]: true }))
    await adminApi('site_setting_update', { key, value })
    setSaving(s => ({ ...s, [key]: false }))
    reloadSiteSettings()
    showSimpleToast('✅ Saved', 'success')
  }

  const SECTIONS = [
    { id:'contact',      icon:'📞', label:'Contact' },
    { id:'delivery',     icon:'🚚', label:'Delivery' },
    { id:'checkout',     icon:'🧾', label:'Checkout' },
    { id:'announcement', icon:'📢', label:'Announcements' },
    { id:'hero',         icon:'🎨', label:'Hero Banner' },
    { id:'hotads',       icon:'🔥', label:'Hot Deals' },
    { id:'promopopup',   icon:'🎁', label:'Promo Popup' },
    { id:'exitpopup',    icon:'🚪', label:'Exit Intent' },
    { id:'homeblocks',   icon:'🏠', label:'Home Blocks' },
    { id:'sidemenu',     icon:'☰', label:'Side Menu' },
    { id:'orderbadge',   icon:'📦', label:'Order Badge' },
    { id:'reviews',      icon:'⭐', label:'Reviews' },
    { id:'coupons',      icon:'🎟️', label:'Coupons' },
    { id:'featuretoggles', icon:'🧩', label:'Feature Toggles' },
    { id:'prepaid',      icon:'💳', label:'Prepaid Discount' },
    { id:'theme',        icon:'🌙', label:'Theme' },
    { id:'pages',        icon:'📄', label:'Pages' },
    { id:'seo',          icon:'🔍', label:'SEO' },
    { id:'search',        icon:'🔎', label:'Search Words' },
    { id:'searchanalytics', icon:'📊', label:'Search Analytics' },
  ]

  return (
    <div className="pb-24">
      {/* ── Section Tabs ── */}
      <div className="flex overflow-x-auto gap-2 px-4 py-3 border-b"
        style={{ borderColor:'var(--viro-border)', background:'var(--viro-bgDeep)' }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0 transition-all"
            style={activeSection === s.id
              ? { background:'linear-gradient(135deg,#00BFFF,#8B5CF6)', color:'#fff', boxShadow:'0 2px 8px #8B5CF640' }
              : { background:'var(--viro-bgCard)', color:'var(--viro-textSub)', border:'1px solid var(--viro-border)' }}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ══════════ CONTACT ══════════ */}
        {activeSection === 'contact' && (
          <div className="space-y-4 fade-in">
            <div className="viro-card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between"
                style={{ background:'#25D36608', borderColor:'#25D36620' }}>
                <div>
                  <h3 className="font-bold flex items-center gap-2" style={{ color:'var(--viro-text)' }}>📞 Contact & WhatsApp</h3>
                  <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>Used on checkout, footer, order alerts, WhatsApp buttons</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full font-bold"
                  style={{ background:'#25D36615', color:'#25D366', border:'1px solid #25D36630' }}>🌐 Live</span>
              </div>

              <div className="p-4 space-y-3">
                {/* WhatsApp highlighted */}
                <div className="rounded-xl p-3" style={{ background:'#25D36608', border:'1.5px solid #25D36625' }}>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color:'#25D366' }}>
                    💬 WhatsApp Number *
                  </label>
                  <input value={contact.whatsapp}
                    onChange={e => setContact(c => ({ ...c, whatsapp: e.target.value.replace(/\D/g,'') }))}
                    placeholder="923277796566"
                    style={{ fontFamily:'monospace', fontWeight:700, fontSize:15 }} />
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                      No + or spaces. e.g. <code style={{ background:'var(--viro-bgDeep)', padding:'1px 5px', borderRadius:4, color:'#A78BFA' }}>923277796566</code>
                    </p>
                    {contact.whatsapp && (
                      <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener"
                        className="text-xs font-semibold hover:underline flex-shrink-0" style={{ color:'#25D366' }}>🔗 Test link</a>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>📞 Display Phone</label>
                    <input value={contact.phone || ''} onChange={e => setContact(c => ({ ...c, phone: e.target.value }))} placeholder="+923277796566" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>✉️ Email</label>
                    <input type="email" value={contact.email} onChange={e => setContact(c => ({ ...c, email: e.target.value }))} placeholder="support@viro.pk" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>📍 Address</label>
                    <input value={contact.address} onChange={e => setContact(c => ({ ...c, address: e.target.value }))} placeholder="Mandi Burewala, Punjab, Pakistan" />
                  </div>
                </div>

                {/* Live preview */}
                <div className="rounded-xl p-3 flex flex-wrap gap-3 text-xs"
                  style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                  <span style={{ color:'#25D366' }}>💬 {contact.whatsapp||'—'}</span>
                  <span style={{ color:'#00BFFF' }}>📞 {contact.phone||'—'}</span>
                  <span style={{ color:'#A78BFA' }}>✉️ {contact.email||'—'}</span>
                  <span style={{ color:'var(--viro-textSub)' }}>📍 {contact.address||'—'}</span>
                </div>

                <button onClick={() => saveSetting('contact', contact)} disabled={saving.contact}
                  className="btn-primary w-full py-3 font-bold">
                  {saving.contact ? '⏳ Saving…' : '💾 Save Contact Info'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ DELIVERY ══════════ */}
        {activeSection === 'delivery' && (
          <div className="space-y-4 fade-in">
            <div className="viro-card overflow-hidden">
              <div className="px-4 py-3 border-b" style={{ background:'#00BFFF08', borderColor:'#00BFFF20' }}>
                <h3 className="font-bold" style={{ color:'var(--viro-text)' }}>🚚 Delivery Charges — City by City</h3>
                <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
                  Rules checked top→bottom. First match wins.
                  Use <code style={{ background:'var(--viro-bgDeep)', padding:'1px 6px', borderRadius:4, color:'#A78BFA' }}>*</code> to catch all remaining cities.
                </p>
                <div className="mt-2 px-3 py-2 rounded-xl text-xs" style={{ background:'#EAB30815', border:'1px solid #EAB30830' }}>
                  <span style={{ color:'#EAB308', fontWeight:700 }}>💡 Tip: </span>
                  <span style={{ color:'var(--viro-textSub)' }}>Change the Flat Delivery Fee and every new order shows the updated amount.</span>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {deliveryRules.map((rule, idx) => {
                  const isWild = rule.cities === '*' || rule.cities === ''
                  const color  = isWild ? '#8B5CF6' : '#00BFFF'
                  return (
                    <div key={idx} className="rounded-xl overflow-hidden" style={{ border:`1.5px solid ${color}30` }}>
                      <div className="px-3 py-2 flex items-center justify-between" style={{ background:`${color}08` }}>
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                            style={{ background:color }}>{idx+1}</span>
                          <span className="text-sm font-bold" style={{ color:'var(--viro-text)' }}>{rule.label || 'Unnamed Rule'}</span>
                          {isWild && <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background:'#8B5CF620', color:'#A78BFA' }}>Wildcard</span>}
                        </div>
                        {deliveryRules.length > 1 && (
                          <button onClick={() => setDeliveryRules(r => r.filter((_,i) => i!==idx))}
                            className="text-xs px-2 py-1 rounded-lg"
                            style={{ color:'#F87171', background:'#EF444415', border:'1px solid #EF444430' }}>✕</button>
                        )}
                      </div>
                      <div className="p-3 grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-bold block mb-1" style={{ color:'var(--viro-textSub)' }}>Label</label>
                          <input value={rule.label} onChange={e => setDeliveryRules(r => r.map((x,i) => i===idx ? {...x,label:e.target.value} : x))} placeholder="Burewala" style={{ fontSize:12 }} />
                        </div>
                        <div>
                          <label className="text-xs font-bold block mb-1" style={{ color:'var(--viro-textSub)' }}>Cities (comma or *)</label>
                          <input value={rule.cities} onChange={e => setDeliveryRules(r => r.map((x,i) => i===idx ? {...x,cities:e.target.value} : x))} placeholder="burewala,multan or *" style={{ fontSize:12 }} />
                        </div>
                        <div>
                          <label className="text-xs font-bold block mb-1" style={{ color:'var(--viro-textSub)' }}>🎉 Free Delivery ≥ Rs.</label>
                          <input type="number" value={rule.freeThreshold} onChange={e => setDeliveryRules(r => r.map((x,i) => i===idx ? {...x,freeThreshold:parseInt(e.target.value)||0} : x))} placeholder="999" style={{ fontSize:12 }} />
                        </div>
                        <div>
                          <label className="text-xs font-bold block mb-1" style={{ color:'var(--viro-textSub)' }}>📦 Flat Delivery Fee Rs.</label>
                          <input type="number" value={rule.charge} onChange={e => setDeliveryRules(r => r.map((x,i) => i===idx ? {...x,charge:parseInt(e.target.value)||0} : x))} placeholder="150" style={{ fontSize:12 }} />
                        </div>
                      </div>
                      <div className="mx-3 mb-3 px-3 py-2 rounded-xl text-xs" style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                        🚚 <strong style={{ color:'var(--viro-text)' }}>{rule.label||'Rule'}:</strong>
                        {' '}Below Rs.{rule.freeThreshold?.toLocaleString()} → <span style={{ color:'#EF4444', fontWeight:700 }}>Rs.{rule.charge} charge</span>
                        {' · '}Rs.{rule.freeThreshold?.toLocaleString()}+ → <span style={{ color:'#10B981', fontWeight:700 }}>FREE 🎉</span>
                      </div>
                    </div>
                  )
                })}

                {/* Charge simulator */}
                <div className="rounded-xl p-3" style={{ background:'var(--viro-bgDeep)', border:'1px dashed var(--viro-border)' }}>
                  <p className="text-xs font-bold mb-2" style={{ color:'var(--viro-textSub)' }}>🧪 Test Charge Calculator</p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="text-xs block mb-1" style={{ color:'var(--viro-textSub)' }}>City</label>
                      <input value={testCity} onChange={e => setTestCity(e.target.value)} placeholder="burewala" style={{ fontSize:12 }} />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs block mb-1" style={{ color:'var(--viro-textSub)' }}>Order Rs.</label>
                      <input type="number" value={testAmount||''} onChange={e => setTestAmount(parseInt(e.target.value)||0)} placeholder="1000" style={{ fontSize:12 }} />
                    </div>
                    <div className="px-3 py-2 rounded-xl text-sm font-bold flex-shrink-0"
                      style={{
                        background: testCharge === 0 ? '#10B98120' : testCharge !== null ? '#EF444420' : 'var(--viro-bgCard)',
                        color: testCharge === 0 ? '#10B981' : testCharge !== null ? '#EF4444' : 'var(--viro-textSub)',
                        border: `1px solid ${testCharge === 0 ? '#10B98140' : testCharge !== null ? '#EF444440' : 'var(--viro-border)'}`,
                      }}>
                      {testCharge === null ? '—' : testCharge === 0 ? '🎉 FREE' : `Rs.${testCharge}`}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setDeliveryRules(r => [...r, { label:'New City', cities:'', freeThreshold:2500, charge:150 }])}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                    style={{ background:'var(--viro-bgDeep)', color:'#A78BFA', border:'1px solid #8B5CF640' }}>
                    + Add Rule
                  </button>
                  <button
                    onClick={() => {
                      const norm = deliveryRules.map(r => ({
                        label: r.label,
                        cities: typeof r.cities==='string' ? r.cities.split(',').map(c=>c.trim().toLowerCase()).filter(Boolean) : r.cities,
                        freeThreshold: r.freeThreshold, charge: r.charge,
                      }))
                      saveSetting('delivery_rules', norm)
                    }}
                    disabled={saving.delivery_rules}
                    className="flex-1 btn-primary py-2.5 text-sm font-bold">
                    {saving.delivery_rules ? '⏳ Saving…' : '💾 Save Delivery Rules'}
                  </button>
                </div>

                {/* Price Drop Notice */}
                <div className="viro-card overflow-hidden mt-4">
                  <div className="px-4 py-3 border-b" style={{ background:'#10B98108', borderColor:'#10B98120' }}>
                    <h3 className="font-bold flex items-center gap-2" style={{ color:'var(--viro-text)' }}>🎉 Price Drop Notice</h3>
                    <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                      Shown in cart when an item's price has dropped since it was added — only ever drops, a price rise updates silently and isn't announced.
                    </p>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-4 p-3 rounded-xl"
                      style={{ background: priceDropEnabled ? '#10B98110' : 'var(--viro-bgDeep)', border:`2px solid ${priceDropEnabled ? '#10B98130' : 'var(--viro-border)'}` }}>
                      <div className="flex-1">
                        <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>Show Price Drop Banner</p>
                        <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                          {priceDropEnabled ? 'Customers see a banner when a cart item gets cheaper' : 'Prices update silently — no banner shown'}
                        </p>
                      </div>
                      <button disabled={settingSaving}
                        onClick={async () => {
                          setSettingSaving(true)
                          const next = !priceDropEnabled
                          await adminApi('site_setting_update', { key:'price_drop_notice', value:{ enabled: next, once_only: priceDropOnceOnly } })
                          setPriceDropEnabled(next)
                          setSettingSaving(false)
                          showSimpleToast(next ? '✅ Price drop banner on' : '🚫 Price drop banner off', 'success')
                        }}
                        style={{ width:56, height:28, borderRadius:14, position:'relative', border:'none', flexShrink:0,
                          background: priceDropEnabled ? 'linear-gradient(135deg,#10B981,#059669)' : '#334155',
                          cursor: settingSaving ? 'not-allowed' : 'pointer' }}>
                        <span style={{ position:'absolute', top:3, width:22, height:22, borderRadius:'50%', background:'#fff',
                          left: priceDropEnabled ? 30 : 3, transition:'left 0.2s', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>
                          {settingSaving ? '⏳' : priceDropEnabled ? '✓' : '✕'}
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center gap-4 p-3 rounded-xl"
                      style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)', opacity: priceDropEnabled ? 1 : 0.5 }}>
                      <div className="flex-1">
                        <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>Show Only Once Per Item</p>
                        <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                          {priceDropOnceOnly ? 'Shown the first time only — not repeated on later cart visits' : 'Shown every time they visit the cart while the price stays lower'}
                        </p>
                      </div>
                      <button disabled={settingSaving || !priceDropEnabled}
                        onClick={async () => {
                          setSettingSaving(true)
                          const next = !priceDropOnceOnly
                          await adminApi('site_setting_update', { key:'price_drop_notice', value:{ enabled: priceDropEnabled, once_only: next } })
                          setPriceDropOnceOnly(next)
                          setSettingSaving(false)
                          showSimpleToast(next ? '✅ Shown once per item' : '🔁 Shown every visit', 'success')
                        }}
                        style={{ width:56, height:28, borderRadius:14, position:'relative', border:'none', flexShrink:0,
                          background: priceDropOnceOnly ? '#8B5CF6' : '#334155',
                          cursor: (settingSaving || !priceDropEnabled) ? 'not-allowed' : 'pointer' }}>
                        <span style={{ position:'absolute', top:3, width:22, height:22, borderRadius:'50%', background:'#fff',
                          left: priceDropOnceOnly ? 30 : 3, transition:'left 0.2s' }} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ CHECKOUT ══════════ */}
        {activeSection === 'checkout' && (
          <div className="space-y-4">
            <div className="viro-card p-5">
              <div className="space-y-4">

                {/* Minimum Order Amount — hard gate */}
                <div className="viro-card overflow-hidden">
                  <div className="px-4 py-3 border-b" style={{ background:'#EF444408', borderColor:'#EF444420' }}>
                    <h3 className="font-bold flex items-center gap-2" style={{ color:'var(--viro-text)' }}>🚫 Minimum Order Amount</h3>
                    <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                      Blocks checkout below this cart subtotal — shoppers see a friendly "add more" notice instead. Also hides the direct Buy Now button on products cheaper than this amount (only Add to Cart shows), nudging bigger carts instead of many tiny orders.
                    </p>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: minOrderEnabled ? '#EF444410' : 'var(--viro-bgDeep)', border:`2px solid ${minOrderEnabled ? '#EF444430' : 'var(--viro-border)'}` }}>
                      <div>
                        <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>Require Minimum Order</p>
                        <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                          {minOrderEnabled ? 'Checkout blocked and Buy Now hidden below the threshold' : 'No minimum — every order size can check out'}
                        </p>
                      </div>
                      <button disabled={minOrderSaving}
                        onClick={async () => {
                          setMinOrderSaving(true)
                          const next = !minOrderEnabled
                          await adminApi('site_setting_update', { key:'min_order_amount', value:{ enabled: next, amount: minOrderAmount } })
                          setMinOrderEnabled(next)
                          setMinOrderSaving(false)
                          reloadSiteSettings()
                          showSimpleToast(next ? `✅ Minimum order Rs.${minOrderAmount} now required` : '🚫 Minimum order requirement turned off', 'success')
                        }}
                        style={{
                          width:64, height:32, borderRadius:16, position:'relative', flexShrink:0,
                          background: minOrderEnabled ? 'linear-gradient(135deg,#EF4444,#DC2626)' : '#334155',
                          border:'none', cursor: minOrderSaving ? 'not-allowed' : 'pointer',
                          opacity: minOrderSaving ? 0.7 : 1,
                        }}>
                        <span style={{ position:'absolute', top:4, left: minOrderEnabled ? 36 : 4, width:24, height:24, borderRadius:'50%',
                          background:'#fff', boxShadow:'0 2px 4px rgba(0,0,0,0.3)', transition:'left 0.2s',
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>
                          {minOrderSaving ? '⏳' : minOrderEnabled ? '✓' : '✕'}
                        </span>
                      </button>
                    </div>

                    <div className="p-3 rounded-xl" style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)', opacity: minOrderEnabled ? 1 : 0.5 }}>
                      <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color:'var(--viro-textSub)' }}>
                        Minimum order amount
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color:'var(--viro-text)' }}>Rs.</span>
                        <input type="number" min="0" step="10" disabled={!minOrderEnabled}
                          value={minOrderAmount}
                          onChange={e => setMinOrderAmount(Number(e.target.value) || 0)}
                          className="flex-1 px-3 py-2 rounded-lg text-sm font-bold"
                          style={{ background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)', color:'var(--viro-text)' }} />
                      </div>
                    </div>

                    <button disabled={minOrderSaving || !minOrderEnabled}
                      onClick={async () => {
                        setMinOrderSaving(true)
                        await adminApi('site_setting_update', { key:'min_order_amount', value:{ enabled: minOrderEnabled, amount: minOrderAmount } })
                        setMinOrderSaving(false)
                        reloadSiteSettings()
                        showSimpleToast('✅ Saved', 'success')
                      }}
                      className="w-full py-2.5 rounded-lg text-sm font-bold"
                      style={{ background:'#EF4444', color:'#fff', border:'none', cursor: (minOrderSaving || !minOrderEnabled) ? 'not-allowed' : 'pointer' }}>
                      Save Minimum Order Settings
                    </button>
                    <p className="text-xs text-center" style={{ color:'var(--viro-textSub)' }}>
                      e.g. Rs.{minOrderAmount} means carts under Rs.{minOrderAmount} can't check out, and any product priced under Rs.{minOrderAmount} shows only "Add to Cart" (no Buy Now) everywhere on the site.
                    </p>
                  </div>
                </div>

                {/* Free Gift Reward */}
                <div className="viro-card overflow-hidden">
                  <div className="px-4 py-3 border-b" style={{ background:'#F9731608', borderColor:'#F9731620' }}>
                    <h3 className="font-bold flex items-center gap-2" style={{ color:'var(--viro-text)' }}>🎁 Free Gift Reward</h3>
                    <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                      Spend Rs.X, get a chosen product for free — shown as a progress bar on the product page and cart, nudging shoppers to add just a bit more.
                    </p>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: fgEnabled ? '#F9731610' : 'var(--viro-bgDeep)', border:`2px solid ${fgEnabled ? '#F9731630' : 'var(--viro-border)'}` }}>
                      <div>
                        <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>Enable Free Gift</p>
                        <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                          {fgEnabled ? 'Progress bar shown on product & cart pages' : 'Feature is off — nothing shown to shoppers'}
                        </p>
                      </div>
                      <button disabled={fgSaving}
                        onClick={async () => {
                          setFgSaving(true)
                          const next = !fgEnabled
                          await adminApi('site_setting_update', { key:'free_gift', value:{ enabled: next, threshold: fgThreshold, productId: fgProductId } })
                          setFgEnabled(next)
                          setFgSaving(false)
                          reloadSiteSettings()
                          showSimpleToast(next ? '✅ Free Gift enabled' : '🚫 Free Gift disabled', 'success')
                        }}
                        style={{
                          width:64, height:32, borderRadius:16, position:'relative', flexShrink:0,
                          background: fgEnabled ? 'linear-gradient(135deg,#F97316,#EA580C)' : '#334155',
                          border:'none', cursor: fgSaving ? 'not-allowed' : 'pointer',
                          opacity: fgSaving ? 0.7 : 1,
                        }}>
                        <span style={{ position:'absolute', top:4, left: fgEnabled ? 36 : 4, width:24, height:24, borderRadius:'50%',
                          background:'#fff', boxShadow:'0 2px 4px rgba(0,0,0,0.3)', transition:'left 0.2s',
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>
                          {fgSaving ? '⏳' : fgEnabled ? '✓' : '✕'}
                        </span>
                      </button>
                    </div>

                    <div className="p-3 rounded-xl" style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)', opacity: fgEnabled ? 1 : 0.5 }}>
                      <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color:'var(--viro-textSub)' }}>
                        Spend threshold to unlock
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color:'var(--viro-text)' }}>Rs.</span>
                        <input type="number" min="0" step="50" disabled={!fgEnabled}
                          value={fgThreshold}
                          onChange={e => setFgThreshold(Number(e.target.value) || 0)}
                          className="flex-1 px-3 py-2 rounded-lg text-sm font-bold"
                          style={{ background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)', color:'var(--viro-text)' }} />
                      </div>
                    </div>

                    <div className="p-3 rounded-xl" style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)', opacity: fgEnabled ? 1 : 0.5 }}>
                      <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color:'var(--viro-textSub)' }}>
                        Gift product
                      </label>
                      {fgProductId && hbProducts.find(p => p.id === fgProductId) && (() => {
                        const p = hbProducts.find(x => x.id === fgProductId)
                        const imgs = Array.isArray(p.images) ? p.images : (() => { try { return JSON.parse(p.images||'[]') } catch { return [] } })()
                        return (
                          <div className="flex items-center gap-2 p-2 rounded-xl mb-2" style={{ background:'#F9731612', border:'1px solid #F9731640' }}>
                            <img src={imgs[0]||'/logo.jpg'} alt={p.name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" onError={e=>{e.target.src='/logo.jpg'}} />
                            <span className="text-xs font-semibold flex-1" style={{ color:'var(--viro-text)' }}>{p.name}</span>
                            <button onClick={() => setFgProductId(null)} disabled={!fgEnabled}
                              style={{ background:'none', border:'none', cursor: fgEnabled ? 'pointer':'default', color:'#EF4444', fontSize:12 }}>✕</button>
                          </div>
                        )
                      })()}
                      <input value={fgProductSearch} onChange={e => setFgProductSearch(e.target.value)}
                        disabled={!fgEnabled}
                        placeholder="🔍 Search products to pick as the gift…"
                        className="w-full text-xs p-2.5 rounded-xl mb-2"
                        style={{ border:'1px solid var(--viro-border)', background:'var(--viro-bg)', color:'var(--viro-text)' }} />
                      {fgEnabled && fgProductSearch.trim() && (
                        <div className="rounded-xl overflow-hidden" style={{ border:'1px solid var(--viro-border)', maxHeight:200, overflowY:'auto' }}>
                          {hbProducts.filter(p => p.name.toLowerCase().includes(fgProductSearch.trim().toLowerCase())).slice(0,20).map(p => {
                            const imgs = Array.isArray(p.images) ? p.images : (() => { try { return JSON.parse(p.images||'[]') } catch { return [] } })()
                            return (
                              <div key={p.id} onClick={() => { setFgProductId(p.id); setFgProductSearch('') }}
                                className="flex items-center gap-2 p-2 cursor-pointer"
                                style={{ borderBottom:'1px solid var(--viro-border)' }}>
                                <img src={imgs[0]||'/logo.jpg'} alt={p.name} className="w-7 h-7 rounded object-cover flex-shrink-0" onError={e=>{e.target.src='/logo.jpg'}} />
                                <span className="text-xs" style={{ color:'var(--viro-text)' }}>{p.name}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <button disabled={fgSaving || !fgEnabled}
                      onClick={async () => {
                        setFgSaving(true)
                        await adminApi('site_setting_update', { key:'free_gift', value:{ enabled: fgEnabled, threshold: fgThreshold, productId: fgProductId } })
                        setFgSaving(false)
                        reloadSiteSettings()
                        showSimpleToast('✅ Saved', 'success')
                      }}
                      className="w-full py-2.5 rounded-lg text-sm font-bold"
                      style={{ background:'#F97316', color:'#fff', border:'none', cursor: (fgSaving || !fgEnabled) ? 'not-allowed' : 'pointer' }}>
                      Save Free Gift Settings
                    </button>
                    <p className="text-xs text-center" style={{ color:'var(--viro-textSub)' }}>
                      e.g. Rs.{fgThreshold} means shoppers who spend Rs.{fgThreshold}+ see a progress bar and get the picked product added free at checkout.
                    </p>
                  </div>
                </div>

                {/* Checkout AOV Upsell */}
                <div className="viro-card overflow-hidden">
                  <div className="px-4 py-3 border-b" style={{ background:'#F9731608', borderColor:'#F9731620' }}>
                    <h3 className="font-bold flex items-center gap-2" style={{ color:'var(--viro-text)' }}>🎁 Checkout "Add More" Upsell</h3>
                    <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                      Nudges shoppers with a small order to add more and unlock free delivery — shown once they scroll to the address section during checkout.
                    </p>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-4 p-3 rounded-xl"
                      style={{ background: upsellEnabled ? '#F9731610' : 'var(--viro-bgDeep)', border:`2px solid ${upsellEnabled ? '#F9731630' : 'var(--viro-border)'}` }}>
                      <div className="flex-1">
                        <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>Show Upsell Popup</p>
                        <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                          {upsellEnabled ? 'Shown to shoppers whose order is below the threshold below' : 'Never shown'}
                        </p>
                      </div>
                      <button disabled={settingSaving}
                        onClick={async () => {
                          setSettingSaving(true)
                          const next = !upsellEnabled
                          await adminApi('site_setting_update', { key:'checkout_upsell', value:{ enabled: next, min_order_value: upsellMinOrder } })
                          setUpsellEnabled(next)
                          setSettingSaving(false)
                          showSimpleToast(next ? '✅ Upsell popup on' : '🚫 Upsell popup off', 'success')
                        }}
                        style={{ width:56, height:28, borderRadius:14, position:'relative', border:'none', flexShrink:0,
                          background: upsellEnabled ? 'linear-gradient(135deg,#F59E0B,#F97316)' : '#334155',
                          cursor: settingSaving ? 'not-allowed' : 'pointer' }}>
                        <span style={{ position:'absolute', top:3, width:22, height:22, borderRadius:'50%', background:'#fff',
                          left: upsellEnabled ? 30 : 3, transition:'left 0.2s', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>
                          {settingSaving ? '⏳' : upsellEnabled ? '✓' : '✕'}
                        </span>
                      </button>
                    </div>

                    <div className="p-3 rounded-xl" style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)', opacity: upsellEnabled ? 1 : 0.5 }}>
                      <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color:'var(--viro-textSub)' }}>
                        Show when order total is under
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color:'var(--viro-text)' }}>Rs.</span>
                        <input type="number" min="0" step="50" disabled={!upsellEnabled}
                          value={upsellMinOrder}
                          onChange={e => setUpsellMinOrder(Number(e.target.value) || 0)}
                          className="flex-1 px-3 py-2 rounded-lg text-sm font-bold"
                          style={{ background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)', color:'var(--viro-text)' }} />
                        <button disabled={settingSaving || !upsellEnabled}
                          onClick={async () => {
                            setSettingSaving(true)
                            await adminApi('site_setting_update', { key:'checkout_upsell', value:{ enabled: upsellEnabled, min_order_value: upsellMinOrder } })
                            setSettingSaving(false)
                            showSimpleToast('✅ Saved', 'success')
                          }}
                          className="px-4 py-2 rounded-lg text-xs font-bold flex-shrink-0"
                          style={{ background:'#F97316', color:'#fff', border:'none', cursor: (settingSaving || !upsellEnabled) ? 'not-allowed' : 'pointer' }}>
                          Save
                        </button>
                      </div>
                      <p className="text-xs mt-2" style={{ color:'var(--viro-textSub)' }}>
                        e.g. Rs.{upsellMinOrder} means anyone checking out below that amount sees the "add more" prompt. A shopper spending Rs.{upsellMinOrder + 1}+ won't see it.
                      </p>
                    </div>
                  </div>
                </div>

                {/* COD Advance Payment */}
                <div className="viro-card overflow-hidden">
                  <div className="px-4 py-3 border-b" style={{ background:'#10B98108', borderColor:'#10B98120' }}>
                    <h3 className="font-bold flex items-center gap-2" style={{ color:'var(--viro-text)' }}>💳 COD Advance Payment</h3>
                    <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                      A small advance for Cash on Delivery orders, deducted from the total due at delivery — reduces no-show returns by having the customer already committed. Shown as an informational notice to shoppers, not a checkout blocker.
                    </p>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-4 p-3 rounded-xl"
                      style={{ background: codAdvanceEnabled ? '#10B98110' : 'var(--viro-bgDeep)', border:`2px solid ${codAdvanceEnabled ? '#10B98130' : 'var(--viro-border)'}` }}>
                      <div className="flex-1">
                        <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>Require COD Advance</p>
                        <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                          {codAdvanceEnabled ? 'Shoppers see a notice about the advance — on checkout and in the top bar' : 'No advance messaging shown'}
                        </p>
                      </div>
                      <button disabled={settingSaving}
                        onClick={async () => {
                          setSettingSaving(true)
                          const next = !codAdvanceEnabled
                          await adminApi('site_setting_update', { key:'cod_advance', value:{ enabled: next, amount: codAdvanceAmount } })
                          setCodAdvanceEnabled(next)
                          setSettingSaving(false)
                          showSimpleToast(next ? '✅ COD advance notice on' : '🚫 COD advance notice off', 'success')
                        }}
                        style={{ width:56, height:28, borderRadius:14, position:'relative', border:'none', flexShrink:0,
                          background: codAdvanceEnabled ? 'linear-gradient(135deg,#10B981,#059669)' : '#334155',
                          cursor: settingSaving ? 'not-allowed' : 'pointer' }}>
                        <span style={{ position:'absolute', top:3, width:22, height:22, borderRadius:'50%', background:'#fff',
                          left: codAdvanceEnabled ? 30 : 3, transition:'left 0.2s', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>
                          {settingSaving ? '⏳' : codAdvanceEnabled ? '✓' : '✕'}
                        </span>
                      </button>
                    </div>

                    <div className="p-3 rounded-xl" style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)', opacity: codAdvanceEnabled ? 1 : 0.5 }}>
                      <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color:'var(--viro-textSub)' }}>
                        Advance amount
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color:'var(--viro-text)' }}>Rs.</span>
                        <input type="number" min="0" step="10" disabled={!codAdvanceEnabled}
                          value={codAdvanceAmount}
                          onChange={e => setCodAdvanceAmount(Number(e.target.value) || 0)}
                          className="flex-1 px-3 py-2 rounded-lg text-sm font-bold"
                          style={{ background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)', color:'var(--viro-text)' }} />
                      </div>
                    </div>

                    <button disabled={settingSaving || !codAdvanceEnabled}
                      onClick={async () => {
                        setSettingSaving(true)
                        await adminApi('site_setting_update', { key:'cod_advance', value:{ enabled: codAdvanceEnabled, amount: codAdvanceAmount } })
                        setSettingSaving(false)
                        showSimpleToast('✅ Saved', 'success')
                      }}
                      className="w-full py-2.5 rounded-lg text-sm font-bold"
                      style={{ background:'#10B981', color:'#fff', border:'none', cursor: (settingSaving || !codAdvanceEnabled) ? 'not-allowed' : 'pointer' }}>
                      Save COD Advance Settings
                    </button>
                    <p className="text-xs text-center" style={{ color:'var(--viro-textSub)' }}>
                      e.g. Rs.{codAdvanceAmount} means the checkout page and top bar will say a Rs.{codAdvanceAmount} advance is required to confirm a COD order, deducted from the Rs.{codAdvanceAmount ? '' : ''}total due at delivery.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ══════════ ANNOUNCEMENTS ══════════ */}
        {activeSection === 'announcement' && (
          <div className="viro-card overflow-hidden fade-in">
            <div className="px-4 py-3 border-b" style={{ borderColor:'var(--viro-border)' }}>
              <h3 className="font-bold" style={{ color:'var(--viro-text)' }}>📢 Announcement Bar Messages</h3>
              <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>One message per line. They scroll in the top bar. Leave blank to hide.</p>
            </div>
            <div className="p-4">
              <textarea rows={8} value={messages} onChange={e => setMessages(e.target.value)}
                placeholder={"🚚 FREE Delivery in Burewala on orders Rs.999+\n🌍 Other Cities — Free Delivery on Rs.2500+\n⚡ Flash Sale — Use coupon VIRO20 for 20% off\n📞 Call / WhatsApp: 03277796566"}
                style={{ width:'100%', resize:'vertical', lineHeight:1.7 }} />
              <p className="text-xs mt-2 mb-3" style={{ color:'var(--viro-textSub)' }}>
                💡 Tip: Use emoji at the start of each line to make messages pop.
              </p>
              <button
                onClick={() => {
                  const msgs = messages.split('\n').map(m=>m.trim()).filter(Boolean)
                  saveSetting('announcement', { messages: msgs })
                }}
                disabled={saving.announcement}
                className="btn-primary w-full py-3 font-bold">
                {saving.announcement ? '⏳ Saving…' : '💾 Save Messages'}
              </button>
            </div>
          </div>
        )}

        {/* ══════════ HERO BANNER ══════════ */}
        {activeSection === 'hero' && (
          <div className="space-y-4 fade-in">
            <div className="viro-card overflow-hidden">
              <div className="px-4 py-3 border-b" style={{ borderColor:'var(--viro-border)' }}>
                <h3 className="font-bold" style={{ color:'var(--viro-text)' }}>🎨 Hero Banner Text</h3>
                <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>Main homepage headline</p>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Badge Text</label>
                  <input value={heroData.badge||''} onChange={e => setHeroData(h=>({...h,badge:e.target.value}))} placeholder="🎉 Pakistan-wide Delivery" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Main Headline</label>
                  <input value={heroData.title||''} onChange={e => setHeroData(h=>({...h,title:e.target.value}))} placeholder="Smart Shopping, Better Living." />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Subtitle</label>
                  <input value={heroData.subtitle||''} onChange={e => setHeroData(h=>({...h,subtitle:e.target.value}))} placeholder="Trusted by customers across Punjab & Pakistan" />
                </div>
                <button onClick={() => saveSetting('hero', { ...heroData, images: heroImages })}
                  disabled={saving.hero} className="btn-primary w-full py-3 font-bold">
                  {saving.hero ? '⏳ Saving…' : '💾 Save Hero Text'}
                </button>
              </div>
            </div>

            <div className="viro-card overflow-hidden">
              <div className="px-4 py-3 border-b" style={{ borderColor:'var(--viro-border)' }}>
                <h3 className="font-bold" style={{ color:'var(--viro-text)' }}>🖼️ Hero Images</h3>
                <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>Stored in <code style={{ color:'#A78BFA' }}>hero_section</code> bucket</p>
              </div>
              <div className="p-4">
                <ImageGrid
                  images={heroImages}
                  setImages={setHeroImages}
                  label="Hero Images"
                  uploadFn={uploadHeroImage}
                  onSave={urls => saveSetting('hero', { ...heroData, images: urls })}
                />
              </div>
            </div>
          </div>
        )}

        {/* ══════════ HOT DEALS ══════════ */}
        {activeSection === 'hotads' && (
          <div className="viro-card overflow-hidden fade-in">
            <div className="px-4 py-3 border-b" style={{ borderColor:'var(--viro-border)' }}>
              <h3 className="font-bold" style={{ color:'var(--viro-text)' }}>🔥 Hot Deals Strip</h3>
              <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>Promotional banner shown below the hero section</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl"
                style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                <div>
                  <p className="text-xs font-bold" style={{ color:'var(--viro-text)' }}>Show Hot Deals Strip</p>
                  <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                    {hotAds.enabled ? 'Visible to customers' : 'Hidden from customers'}
                  </p>
                </div>
                <button onClick={() => setHotAds(h => ({ ...h, enabled: !h.enabled }))}
                  style={{ width:48, height:24, borderRadius:12, border:'none', cursor:'pointer', position:'relative', flexShrink:0,
                    background: hotAds.enabled ? '#10B981' : '#334155', transition:'background 0.2s' }}>
                  <span style={{ position:'absolute', top:2, width:20, height:20, borderRadius:'50%', background:'#fff',
                    left: hotAds.enabled ? 26 : 2, transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.3)' }} />
                </button>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Strip Title</label>
                <input value={hotAds.title||''} onChange={e => setHotAds(h=>({...h,title:e.target.value}))} placeholder="🔥 Hot Deals" />
              </div>
              {hotAds.enabled && hotAds.title?.trim() && (
                <div className="px-3 py-2 rounded-xl text-xs font-bold"
                  style={{ background:'linear-gradient(135deg,#F9731620,#EF444415)', border:'1px solid #F9731640', color:'#F97316' }}>
                  Preview: 🔥 {hotAds.title}
                </div>
              )}
              <button onClick={() => saveSetting('hot_ads', hotAds)} disabled={saving.hot_ads}
                className="btn-primary w-full py-3 font-bold">
                {saving.hot_ads ? '⏳ Saving…' : '💾 Save Hot Deals'}
              </button>
            </div>
          </div>
        )}

        {/* ══════════ PROMO POPUP ══════════ */}
        {activeSection === 'promopopup' && (
          <div className="space-y-4 fade-in">
            <div className="viro-card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor:'var(--viro-border)' }}>
                <div>
                  <h3 className="font-bold" style={{ color:'var(--viro-text)' }}>🎁 Promo Popup</h3>
                  <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
                    A one-time popup that appears after a delay or scroll (like the "Free Gift over Rs.X" popups on other stores) — image on one side, offer + button on the other.
                  </p>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                  <div>
                    <p className="text-xs font-bold" style={{ color:'var(--viro-text)' }}>Show Promo Popup</p>
                    <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                      {promoPopup.enabled ? 'Live for customers' : 'Hidden from customers'}
                    </p>
                  </div>
                  <button onClick={() => setPromoPopup(p => ({ ...p, enabled: !p.enabled }))}
                    style={{ width:48, height:24, borderRadius:12, border:'none', cursor:'pointer', position:'relative', flexShrink:0,
                      background: promoPopup.enabled ? '#10B981' : '#334155', transition:'background 0.2s' }}>
                    <span style={{ position:'absolute', top:2, width:20, height:20, borderRadius:'50%', background:'#fff',
                      left: promoPopup.enabled ? 26 : 2, transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.3)' }} />
                  </button>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color:'var(--viro-textSub)' }}>Banner Images</label>
                  <p className="text-xs mb-2" style={{ color:'var(--viro-textSub)' }}>
                    Stored in <code style={{ color:'#A78BFA' }}>promo_popup</code> bucket · upload more than one and the popup will cycle through them with a transition while it's open
                  </p>
                  <ImageGrid
                    images={promoPopup.images || []}
                    setImages={imgs => setPromoPopup(p => ({ ...p, images: imgs }))}
                    label="Banner Image"
                    uploadFn={uploadPromoPopupImage}
                    onSave={imgs => setPromoPopup(p => ({ ...p, images: imgs }))}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Headline</label>
                  <input value={promoPopup.headline||''} onChange={e => setPromoPopup(p=>({...p,headline:e.target.value}))} placeholder="FREE GIFT" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Subtext</label>
                  <input value={promoPopup.subtext||''} onChange={e => setPromoPopup(p=>({...p,subtext:e.target.value}))} placeholder="On orders above Rs. 2,500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Button Text</label>
                    <input value={promoPopup.ctaText||''} onChange={e => setPromoPopup(p=>({...p,ctaText:e.target.value}))} placeholder="Shop Now" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Button Link</label>
                    <input value={promoPopup.ctaLink||''} onChange={e => setPromoPopup(p=>({...p,ctaLink:e.target.value}))} placeholder="/shop" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Trigger</label>
                  <div className="flex gap-2 mb-2">
                    {[{v:'time',l:'⏱️ After delay'},{v:'scroll',l:'📜 After scroll %'}].map(o => (
                      <button key={o.v} onClick={() => setPromoPopup(p => ({ ...p, trigger: o.v }))}
                        className="flex-1 py-2 rounded-xl text-xs font-bold"
                        style={{
                          background: promoPopup.trigger === o.v ? 'linear-gradient(135deg,#8B5CF6,#F97316)' : 'var(--viro-bgDeep)',
                          color: promoPopup.trigger === o.v ? '#fff' : 'var(--viro-textSub)',
                          border: '1px solid var(--viro-border)',
                        }}>{o.l}</button>
                    ))}
                  </div>
                  <input type="number" min={promoPopup.trigger === 'scroll' ? 1 : 1} max={promoPopup.trigger === 'scroll' ? 100 : 120}
                    value={promoPopup.triggerValue ?? (promoPopup.trigger === 'scroll' ? 40 : 8)}
                    onChange={e => setPromoPopup(p => ({ ...p, triggerValue: parseInt(e.target.value) || 0 }))}
                    placeholder={promoPopup.trigger === 'scroll' ? 'Scroll % (e.g. 40)' : 'Seconds (e.g. 8)'} />
                  <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
                    {promoPopup.trigger === 'scroll'
                      ? `Popup appears once a visitor scrolls ${promoPopup.triggerValue || 40}% down any page.`
                      : `Popup appears ${promoPopup.triggerValue || 8}s after a page loads.`}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Don't repeat for</label>
                  <input type="number" min={0} value={promoPopup.frequencyHours ?? 24}
                    onChange={e => setPromoPopup(p => ({ ...p, frequencyHours: parseInt(e.target.value) || 0 }))}
                    placeholder="Hours (0 = every page load)" />
                  <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
                    Once a visitor sees or dismisses it, it won't show again for this many hours on that device.
                  </p>
                </div>

                {/* Live preview */}
                {promoPopup.enabled && (promoPopup.headline || promoPopup.images?.length > 0) && (
                  <div className="rounded-xl overflow-hidden border" style={{ borderColor:'var(--viro-border)' }}>
                    <p className="text-xs font-bold px-3 py-2" style={{ color:'var(--viro-textSub)', background:'var(--viro-bgDeep)' }}>
                      Preview {promoPopup.images?.length > 1 ? `(${promoPopup.images.length} images will cycle)` : ''}
                    </p>
                    <div className="flex" style={{ background:'#fff' }}>
                      {promoPopup.images?.[0] && (
                        <img src={promoPopup.images[0]} alt="" style={{ width:120, aspectRatio:'4/3', objectFit:'cover', flexShrink:0 }} />
                      )}
                      <div className="flex-1 p-3 flex flex-col items-center justify-center text-center">
                        <p className="font-black text-sm" style={{ color:'#111' }}>{promoPopup.headline || 'FREE GIFT'}</p>
                        <p className="text-xs mt-0.5" style={{ color:'#555' }}>{promoPopup.subtext}</p>
                        <span className="inline-block mt-2 px-3 py-1.5 rounded-lg text-xs font-bold text-center"
                          style={{ background:'linear-gradient(135deg,#8B5CF6,#F97316)', color:'#fff' }}>{promoPopup.ctaText || 'Shop Now'}</span>
                        <p className="text-xs mt-2" style={{ color:'#999' }}>🔗 Social icons row shown here</p>
                      </div>
                    </div>
                  </div>
                )}

                <button onClick={() => saveSetting('promo_popup', promoPopup)} disabled={saving.promo_popup}
                  className="btn-primary w-full py-3 font-bold">
                  {saving.promo_popup ? '⏳ Saving…' : '💾 Save Promo Popup'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ EXIT INTENT POPUP ══════════ */}
        {activeSection === 'exitpopup' && (
          <div className="space-y-4 fade-in">
            <div className="viro-card overflow-hidden">
              <div className="px-4 py-3 border-b" style={{ borderColor:'var(--viro-border)' }}>
                <h3 className="font-bold" style={{ color:'var(--viro-text)' }}>🚪 Exit Intent Popup</h3>
                <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
                  Desktop only — fires the instant a visitor's mouse moves toward the tab bar / back button, like they're about to leave. Separate from the Promo Popup above (different trigger, own frequency).
                </p>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                  <div>
                    <p className="text-xs font-bold" style={{ color:'var(--viro-text)' }}>Show Exit Intent Popup</p>
                    <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                      {exitPopup.enabled ? 'Live for desktop visitors' : 'Hidden from customers'}
                    </p>
                  </div>
                  <button onClick={() => setExitPopup(p => ({ ...p, enabled: !p.enabled }))}
                    style={{ width:48, height:24, borderRadius:12, border:'none', cursor:'pointer', position:'relative', flexShrink:0,
                      background: exitPopup.enabled ? '#10B981' : '#334155', transition:'background 0.2s' }}>
                    <span style={{ position:'absolute', top:2, width:20, height:20, borderRadius:'50%', background:'#fff',
                      left: exitPopup.enabled ? 26 : 2, transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.3)' }} />
                  </button>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color:'var(--viro-textSub)' }}>Banner Images</label>
                  <p className="text-xs mb-2" style={{ color:'var(--viro-textSub)' }}>Stored in <code style={{ color:'#A78BFA' }}>promo_popup</code> bucket · optional, popup works with just text too</p>
                  <ImageGrid
                    images={exitPopup.images || []}
                    setImages={imgs => setExitPopup(p => ({ ...p, images: imgs }))}
                    label="Banner Image"
                    uploadFn={uploadPromoPopupImage}
                    onSave={imgs => setExitPopup(p => ({ ...p, images: imgs }))}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Headline</label>
                  <input value={exitPopup.headline||''} onChange={e => setExitPopup(p=>({...p,headline:e.target.value}))} placeholder="Wait! Don't leave empty-handed" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Subtext</label>
                  <input value={exitPopup.subtext||''} onChange={e => setExitPopup(p=>({...p,subtext:e.target.value}))} placeholder="Here's 10% off if you check out now" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Discount Code (optional)</label>
                  <input value={exitPopup.discountCode||''} onChange={e => setExitPopup(p=>({...p,discountCode:e.target.value.toUpperCase()}))} placeholder="e.g. COMEBACK10" />
                  <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
                    Shown as a copyable code chip if filled in. Make sure this code actually exists in your Coupons tab, or leave blank to just show the offer text.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Button Text</label>
                    <input value={exitPopup.ctaText||''} onChange={e => setExitPopup(p=>({...p,ctaText:e.target.value}))} placeholder="Claim Offer" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Button Link</label>
                    <input value={exitPopup.ctaLink||''} onChange={e => setExitPopup(p=>({...p,ctaLink:e.target.value}))} placeholder="/shop" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Don't repeat for</label>
                  <input type="number" min={0} value={exitPopup.frequencyHours ?? 24}
                    onChange={e => setExitPopup(p => ({ ...p, frequencyHours: parseInt(e.target.value) || 0 }))}
                    placeholder="Hours (0 = every visit)" />
                  <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
                    Once shown, won't show again to that device for this many hours — recommended to keep this higher than the Promo Popup's, since exit intent is a stronger nudge.
                  </p>
                </div>

                <button onClick={() => saveSetting('exit_intent_popup', exitPopup)} disabled={saving.exit_intent_popup}
                  className="btn-primary w-full py-3 font-bold">
                  {saving.exit_intent_popup ? '⏳ Saving…' : '💾 Save Exit Intent Popup'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ ORDER BADGE ══════════ */}
        {activeSection === 'orderbadge' && (
          <div className="space-y-4 fade-in">
            <div className="viro-card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between"
                style={{ background:'#F9731608', borderColor:'#F9731620' }}>
                <div>
                  <h3 className="font-bold flex items-center gap-2" style={{ color:'var(--viro-text)' }}>🔥 Order Count Badge</h3>
                  <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>Show "X ordered" social-proof badge on product cards</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full font-bold"
                  style={ordersBadgeEnabled
                    ? { background:'#F9731615', color:'#F97316', border:'1px solid #F9731630' }
                    : { background:'var(--viro-bgDeep)', color:'var(--viro-textSub)', border:'1px solid var(--viro-border)' }}>
                  {ordersBadgeEnabled ? '🔥 Active' : '⬛ Hidden'}
                </span>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex items-center gap-4 p-4 rounded-2xl"
                  style={{ background: ordersBadgeEnabled ? '#F9731610' : 'var(--viro-bgDeep)',
                           border: `2px solid ${ordersBadgeEnabled ? '#F9731640' : 'var(--viro-border)'}`,
                           transition:'all 0.2s' }}>
                  <div className="flex-1">
                    <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>Show Order Badges Site-Wide</p>
                    <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
                      {ordersBadgeEnabled
                        ? 'Customers see "🔥 X ordered" on products where you enabled the badge'
                        : 'All order badges hidden — no "X ordered" shown anywhere'}
                    </p>
                  </div>
                  <button
                    disabled={orderBadgeSaving}
                    onClick={async () => {
                      const next = !ordersBadgeEnabled
                      setOrderBadgeSaving(true)
                      await adminApi('site_setting_update', { key:'orders_badge_settings', value:{ enabled: next } })
                      setOrdersBadgeEnabled(next)
                      setOrderBadgeSaving(false)
                      showSimpleToast(next ? '🔥 Order badges enabled' : '⬛ Order badges hidden', 'success')
                    }}
                    style={{
                      width:64, height:32, borderRadius:16, position:'relative', border:'none', flexShrink:0,
                      background: ordersBadgeEnabled ? 'linear-gradient(135deg,#EF4444,#F97316)' : '#334155',
                      boxShadow: ordersBadgeEnabled ? '0 0 12px #F9731650' : 'none',
                      cursor: orderBadgeSaving ? 'not-allowed' : 'pointer', opacity: orderBadgeSaving ? 0.7 : 1,
                    }}>
                    <span style={{
                      position:'absolute', top:4, width:24, height:24, borderRadius:'50%',
                      background:'#fff', boxShadow:'0 2px 4px rgba(0,0,0,0.3)',
                      left: ordersBadgeEnabled ? 36 : 4, transition:'left 0.2s',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:12,
                    }}>{orderBadgeSaving ? '⏳' : ordersBadgeEnabled ? '🔥' : '⬛'}</span>
                  </button>
                </div>

                {/* Preview */}
                <div className="rounded-xl p-3" style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                  <p className="text-xs font-bold mb-2" style={{ color:'var(--viro-textSub)' }}>👁️ Preview — what customers see on product cards</p>
                  <div className="flex items-center gap-3">
                    <div style={{ width:80, height:60, background:'#F1F5F9', borderRadius:10, position:'relative', overflow:'hidden' }}>
                      <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,#E2E8F0,#CBD5E1)' }} />
                      {ordersBadgeEnabled && (
                        <div style={{ position:'absolute', bottom:5, right:5, background:'linear-gradient(135deg,#EF4444,#F97316)', color:'#fff', fontWeight:800, fontSize:8, padding:'1px 5px', borderRadius:10 }}>🔥 47 ordered</div>
                      )}
                    </div>
                    <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                      {ordersBadgeEnabled ? '✅ Badge visible — builds trust & urgency' : '❌ Badge hidden — turn on to boost conversions'}
                    </p>
                  </div>
                </div>

                {/* How to use */}
                <div className="rounded-xl p-3 space-y-1.5" style={{ background:'#8B5CF608', border:'1px solid #8B5CF620' }}>
                  <p className="text-xs font-bold" style={{ color:'#A78BFA' }}>📋 How to use</p>
                  <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>1. Enable the global toggle above (master switch)</p>
                  <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>2. Go to <strong style={{ color:'var(--viro-text)' }}>Products</strong> tab → click <strong style={{ color:'#F97316' }}>🔥 Badge OFF</strong> on each product you want to show the count</p>
                  <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>3. Badge auto-hides if count is 0 — no clutter on new products</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ REVIEWS ══════════ */}
        {activeSection === 'reviews' && (
          <div className="space-y-4 fade-in">
            <div className="viro-card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between"
                style={{ background:'#FBBF2408', borderColor:'#FBBF2420' }}>
                <div>
                  <h3 className="font-bold flex items-center gap-2" style={{ color:'var(--viro-text)' }}>⭐ Review System Settings</h3>
                  <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>Global controls — also set per-product in Products tab</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full font-bold"
                  style={reviewsEnabled ? { background:'#10B98115', color:'#10B981', border:'1px solid #10B98130' } : { background:'#EF444415', color:'#EF4444', border:'1px solid #EF444430' }}>
                  {reviewsEnabled ? '✅ On' : '🚫 Off'}
                </span>
              </div>
              <div className="p-4 space-y-3">
                {/* Enable/disable reviews */}
                <div className="flex items-center gap-4 p-3 rounded-xl"
                  style={{ background: reviewsEnabled ? '#10B98110' : 'var(--viro-bgDeep)', border:`2px solid ${reviewsEnabled ? '#10B98130' : 'var(--viro-border)'}` }}>
                  <div className="flex-1">
                    <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>Show Reviews on Products</p>
                    <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                      {reviewsEnabled ? 'Reviews visible on product pages & delivery orders' : 'All reviews hidden sitewide'}
                    </p>
                  </div>
                  <button disabled={settingSaving}
                    onClick={async () => {
                      setSettingSaving(true)
                      const next = !reviewsEnabled
                      await adminApi('site_setting_update', { key:'review_settings', value:{ enabled: next, auto_approve: autoApproveReviews } })
                      setReviewsEnabled(next)
                      setSettingSaving(false)
                      showSimpleToast(next ? '✅ Reviews enabled' : '🚫 Reviews hidden', 'success')
                    }}
                    style={{ width:56, height:28, borderRadius:14, position:'relative', border:'none', flexShrink:0,
                      background: reviewsEnabled ? 'linear-gradient(135deg,#10B981,#059669)' : '#334155',
                      cursor: settingSaving ? 'not-allowed' : 'pointer' }}>
                    <span style={{ position:'absolute', top:3, width:22, height:22, borderRadius:'50%', background:'#fff',
                      left: reviewsEnabled ? 30 : 3, transition:'left 0.2s', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>
                      {settingSaving ? '⏳' : reviewsEnabled ? '✓' : '✕'}
                    </span>
                  </button>
                </div>

                {/* Auto-approve */}
                <div className="flex items-center gap-4 p-3 rounded-xl"
                  style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                  <div className="flex-1">
                    <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>Auto-Approve Reviews</p>
                    <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                      {autoApproveReviews ? 'Reviews go live immediately — no manual approval needed' : 'Reviews wait for your approval before showing publicly'}
                    </p>
                  </div>
                  <button disabled={settingSaving}
                    onClick={async () => {
                      setSettingSaving(true)
                      const next = !autoApproveReviews
                      await adminApi('site_setting_update', { key:'review_settings', value:{ enabled: reviewsEnabled, auto_approve: next } })
                      setAutoApproveReviews(next)
                      setSettingSaving(false)
                      showSimpleToast(next ? '✅ Auto-approve on' : '✋ Manual approval on', 'success')
                    }}
                    style={{ width:56, height:28, borderRadius:14, position:'relative', border:'none', flexShrink:0,
                      background: autoApproveReviews ? '#8B5CF6' : '#334155',
                      cursor: settingSaving ? 'not-allowed' : 'pointer' }}>
                    <span style={{ position:'absolute', top:3, width:22, height:22, borderRadius:'50%', background:'#fff',
                      left: autoApproveReviews ? 30 : 3, transition:'left 0.2s' }} />
                  </button>
                </div>

                {/* How it works */}
                <div className="rounded-xl p-3 space-y-1.5" style={{ background:'#FBBF2408', border:'1px solid #FBBF2420' }}>
                  <p className="text-xs font-bold" style={{ color:'#FBBF24' }}>📋 How the review system works:</p>
                  {[
                    'Customer orders a product and it gets delivered',
                    '"Rate Your Purchase" section appears in their Orders page',
                    'They give 1–5 stars + optional title + text',
                    'Review appears in ⭐ Reviews tab for your approval',
                    'Once approved → visible on product page with star rating',
                  ].map((step, i) => (
                    <p key={i} className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                      <span className="font-bold" style={{ color:'#A78BFA' }}>{i+1}.</span> {step}
                    </p>
                  ))}
                  <p className="text-xs mt-2" style={{ color:'var(--viro-textSub)' }}>
                    💡 Go to the <strong style={{ color:'var(--viro-text)' }}>Reviews tab</strong> in the sidebar to approve, hide, or delete individual reviews. Enable/disable per-product from the Products tab.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ FEATURE TOGGLES ══════════ */}
        {activeSection === 'featuretoggles' && (
          <div className="space-y-4 fade-in">
            <div className="viro-card overflow-hidden">
              <div className="px-4 py-3 border-b" style={{ background:'#8B5CF608', borderColor:'#8B5CF620' }}>
                <h3 className="font-bold flex items-center gap-2" style={{ color:'var(--viro-text)' }}>🧩 Feature Toggles</h3>
                <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                  Turn any of these customer-facing/recovery features off if they don't look right or aren't needed — no code changes required.
                </p>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { key: 'recently_viewed',       label: 'Recently Viewed',
                    desc: 'Sticky bar above bottom nav (last 8 viewed) + the "Recently Viewed Products" section on Home/Shop/Product pages' },
                  { key: 'complete_the_set',      label: 'Complete the Set',
                    desc: 'Complementary-product suggestions with "Add Both to Cart" on product pages' },
                  { key: 'whatsapp_cart_recovery', label: 'WhatsApp Cart Recovery (manual)',
                    desc: 'The 📱 send-reminder button next to customers with active carts in Analytics' },
                  { key: 'push_cart_recovery',     label: 'Push Notification Cart Recovery (automatic)',
                    desc: 'Scheduled scan that nudges idle anonymous carts via browser push' },
                ].map(f => (
                  <div key={f.key} className="flex items-center gap-4 p-3 rounded-xl"
                    style={{ background: featureToggles[f.key] ? '#8B5CF610' : 'var(--viro-bgDeep)',
                      border:`2px solid ${featureToggles[f.key] ? '#8B5CF630' : 'var(--viro-border)'}` }}>
                    <div className="flex-1">
                      <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>{f.label}</p>
                      <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>{f.desc}</p>
                    </div>
                    <button disabled={featureToggleSaving}
                      onClick={() => toggleFeature(f.key)}
                      style={{ width:56, height:28, borderRadius:14, position:'relative', border:'none', flexShrink:0,
                        background: featureToggles[f.key] ? 'linear-gradient(135deg,#8B5CF6,#7C3AED)' : '#334155',
                        cursor: featureToggleSaving ? 'not-allowed' : 'pointer' }}>
                      <span style={{ position:'absolute', top:3, width:22, height:22, borderRadius:'50%', background:'#fff',
                        left: featureToggles[f.key] ? 30 : 3, transition:'left 0.2s', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>
                        {featureToggles[f.key] ? '✓' : '✕'}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ COUPONS ══════════ */}
        {activeSection === 'coupons' && (
          <div className="space-y-4 fade-in">
            <div className="viro-card overflow-hidden">
              <div className="p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">🎟️</span>
                    <h3 className="font-bold text-base" style={{ color:'var(--viro-text)' }}>Show Coupon Field on Checkout</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                      style={couponEnabled ? { background:'#10B98120', color:'#10B981', border:'1px solid #10B98140' } : { background:'#EF444420', color:'#EF4444', border:'1px solid #EF444440' }}>
                      {couponEnabled ? '✅ Visible' : '🚫 Hidden'}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                    {couponEnabled
                      ? 'Customers see a coupon code field at checkout — they can apply any active coupon.'
                      : "Coupon field is hidden. Use this when you have a sitewide sale and don't want extra codes applied."}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    setGlobalToggleSaving(true)
                    const next = !couponEnabled
                    await adminApi('site_setting_update', { key:'coupon_settings', value:{ enabled: next } })
                    setCouponEnabled(next)
                    setGlobalToggleSaving(false)
                    showSimpleToast(next ? '✅ Coupon field enabled' : '🚫 Coupon field hidden', 'success')
                  }}
                  disabled={globalToggleSaving}
                  style={{
                    width:64, height:32, borderRadius:16, position:'relative',
                    background: couponEnabled ? 'linear-gradient(135deg,#10B981,#059669)' : '#334155',
                    boxShadow: couponEnabled ? '0 0 12px #10B98150' : 'none',
                    border:'none', cursor: globalToggleSaving ? 'not-allowed' : 'pointer',
                    opacity: globalToggleSaving ? 0.7 : 1, flexShrink:0,
                  }}>
                  <span style={{ position:'absolute', top:4, left: couponEnabled ? 36 : 4, width:24, height:24, borderRadius:'50%',
                    background:'#fff', boxShadow:'0 2px 4px rgba(0,0,0,0.3)', transition:'left 0.2s',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>
                    {globalToggleSaving ? '⏳' : couponEnabled ? '✓' : '✕'}
                  </span>
                </button>
              </div>
              <div className="px-4 pb-4">
                <div className="px-3 py-2 rounded-xl text-xs"
                  style={{ background: couponEnabled ? '#10B98108' : '#EF444408', border:`1px solid ${couponEnabled ? '#10B98120' : '#EF444420'}` }}>
                  {couponEnabled
                    ? "💡 Tip: Hide this when running a sitewide sale so customers can't stack discounts."
                    : '💡 Tip: Enable when you want to run a targeted promo — create a code in the Coupons tab.'}
                </div>
                <p className="text-xs mt-3" style={{ color:'var(--viro-textSub)' }}>
                  To create and manage coupon codes, go to the <strong style={{ color:'var(--viro-text)' }}>🎟️ Coupons</strong> tab in the sidebar.
                </p>
              </div>
            </div>

            {/* Free delivery threshold check — before/after COUPON discount */}
            <div className="viro-card overflow-hidden p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-bold mb-0.5" style={{ color:'var(--viro-text)' }}>🚚 Free Delivery Threshold Check (Coupon)</p>
                  <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                    {couponDeliveryCheckAfter
                      ? 'Checking AFTER coupon discount — e.g. Rs.2,700 with 10% off coupon becomes Rs.2,430, which can drop below a Rs.2,500 free-delivery threshold.'
                      : 'Checking BEFORE coupon discount (default) — a coupon never costs the customer their free delivery.'}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    setCouponDeliveryCheckSaving(true)
                    const next = !couponDeliveryCheckAfter
                    await adminApi('site_setting_update', { key:'coupon_delivery_check_after', value: next })
                    setCouponDeliveryCheckAfter(next)
                    setCouponDeliveryCheckSaving(false)
                    showSimpleToast(next ? '✅ Now checking AFTER coupon discount' : '✅ Now checking BEFORE coupon discount', 'success')
                  }}
                  disabled={couponDeliveryCheckSaving}
                  style={{
                    width:64, height:32, borderRadius:16, position:'relative', flexShrink:0,
                    background: couponDeliveryCheckAfter ? 'linear-gradient(135deg,#10B981,#059669)' : '#334155',
                    border:'none', cursor: couponDeliveryCheckSaving ? 'not-allowed' : 'pointer',
                    opacity: couponDeliveryCheckSaving ? 0.7 : 1,
                  }}>
                  <span style={{ position:'absolute', top:4, left: couponDeliveryCheckAfter ? 36 : 4, width:24, height:24, borderRadius:'50%',
                    background:'#fff', boxShadow:'0 2px 4px rgba(0,0,0,0.3)', transition:'left 0.2s',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>
                    {couponDeliveryCheckSaving ? '⏳' : couponDeliveryCheckAfter ? '✓' : '✕'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ PREPAID DISCOUNT ══════════ */}
        {activeSection === 'prepaid' && (
          <div className="space-y-4 fade-in">
            <div className="viro-card overflow-hidden p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">💳</span>
                <h3 className="font-bold text-base" style={{ color:'var(--viro-text)' }}>Prepaid Payment Discount</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={prepaidDiscountPercent > 0 ? { background:'#10B98120', color:'#10B981', border:'1px solid #10B98140' } : { background:'#33415520', color:'#94A3B8', border:'1px solid #33415540' }}>
                  {prepaidDiscountPercent > 0 ? `✅ ${prepaidDiscountPercent}% Active` : '🚫 Off'}
                </span>
              </div>
              <p className="text-xs mb-4" style={{ color:'var(--viro-textSub)' }}>
                Customers who pay via JazzCash or EasyPaisa instead of Cash on Delivery get this % off automatically.
                Cash on Delivery always stays full price. Set to <strong style={{ color:'var(--viro-text)' }}>0%</strong> to turn this off completely —
                checkout then behaves exactly like normal, no discount shown anywhere.
              </p>

              <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color:'var(--viro-textSub)' }}>
                Discount Percentage
              </label>
              <div className="flex items-center gap-2 mb-2">
                <div className="relative flex-1">
                  <input
                    type="number" min="0" max="100" step="0.5"
                    value={prepaidPercentInput}
                    onChange={e => { prepaidInputTouched.current = true; setPrepaidPercentInput(e.target.value) }}
                    onFocus={() => { prepaidInputTouched.current = true }}
                    className="w-full text-sm p-2.5 pr-8 rounded-xl"
                    style={{ border:'1px solid var(--viro-border)', background:'var(--viro-bgDeep)', color:'var(--viro-text)' }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color:'var(--viro-textSub)' }}>%</span>
                </div>
                <button
                  onClick={async () => {
                    const parsed = Number(prepaidPercentInput)
                    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
                      showSimpleToast('⚠️ Enter a number between 0 and 100', 'info')
                      return
                    }
                    setPrepaidSaving(true)
                    await adminApi('site_setting_update', { key:'prepaid_discount_percent', value: parsed })
                    setPrepaidDiscountPercent(parsed)
                    prepaidInputTouched.current = false
                    setPrepaidSaving(false)
                    reloadSiteSettings()
                    showSimpleToast(parsed > 0 ? `✅ Prepaid discount set to ${parsed}%` : '🚫 Prepaid discount turned off', 'success')
                  }}
                  disabled={prepaidSaving}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white flex-shrink-0"
                  style={{ background:'linear-gradient(135deg,#10B981,#059669)', border:'none', cursor: prepaidSaving ? 'not-allowed' : 'pointer', opacity: prepaidSaving ? 0.7 : 1 }}>
                  {prepaidSaving ? '⏳ Saving…' : '💾 Save'}
                </button>
              </div>

              <div className="px-3 py-2 rounded-xl text-xs mb-4"
                style={{ background:'#10B98108', border:'1px solid #10B98120' }}>
                💡 Example: a Rs.1,000 cart with a {prepaidPercentInput || 0}% prepaid discount → customer pays Rs.{Math.round(1000 - (1000 * (Number(prepaidPercentInput)||0) / 100)).toLocaleString()} (before delivery), instead of the full Rs.1,000 on COD.
              </div>

              {/* Free delivery threshold check — before/after prepaid discount */}
              <div className="pt-3 border-t" style={{ borderColor:'var(--viro-border)' }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-bold mb-0.5" style={{ color:'var(--viro-text)' }}>Free Delivery Threshold Check</p>
                    <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                      {deliveryCheckAfterPrepaid
                        ? 'Checking AFTER prepaid discount — a cart can drop below the free-delivery threshold once the discount is applied.'
                        : 'Checking BEFORE prepaid discount (default) — a customer\'s free-delivery eligibility never shrinks just for paying online.'}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      setDeliveryCheckSaving(true)
                      const next = !deliveryCheckAfterPrepaid
                      await adminApi('site_setting_update', { key:'prepaid_delivery_check_after', value: next })
                      setDeliveryCheckAfterPrepaid(next)
                      setDeliveryCheckSaving(false)
                      showSimpleToast(next ? '✅ Now checking AFTER prepaid discount' : '✅ Now checking BEFORE prepaid discount', 'success')
                    }}
                    disabled={deliveryCheckSaving}
                    style={{
                      width:64, height:32, borderRadius:16, position:'relative', flexShrink:0,
                      background: deliveryCheckAfterPrepaid ? 'linear-gradient(135deg,#10B981,#059669)' : '#334155',
                      border:'none', cursor: deliveryCheckSaving ? 'not-allowed' : 'pointer',
                      opacity: deliveryCheckSaving ? 0.7 : 1,
                    }}>
                    <span style={{ position:'absolute', top:4, left: deliveryCheckAfterPrepaid ? 36 : 4, width:24, height:24, borderRadius:'50%',
                      background:'#fff', boxShadow:'0 2px 4px rgba(0,0,0,0.3)', transition:'left 0.2s',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>
                      {deliveryCheckSaving ? '⏳' : deliveryCheckAfterPrepaid ? '✓' : '✕'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Prepaid Account Details — the JazzCash/EasyPaisa number & name shown
                to shoppers who choose to pay via prepaid at checkout */}
            <div className="viro-card overflow-hidden p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">📱</span>
                <h3 className="font-bold text-base" style={{ color:'var(--viro-text)' }}>Prepaid Account Details</h3>
              </div>
              <p className="text-xs mb-4" style={{ color:'var(--viro-textSub)' }}>
                The account number and name shown at checkout when a customer selects JazzCash or EasyPaisa to pay.
                Separate from the COD Advance number set above.
              </p>

              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-xl" style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                  <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color:'#E63946' }}>
                    <span style={{width:10,height:10,borderRadius:'50%',background:'#E63946',display:'inline-block'}}/> JazzCash
                  </p>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Account Number</label>
                  <input type="tel" value={jazzcashNumber} onChange={e => setJazzcashNumber(e.target.value)}
                    placeholder="03XXXXXXXXX"
                    className="w-full text-sm p-2.5 rounded-xl mb-2"
                    style={{ border:'1px solid var(--viro-border)', background:'var(--viro-bg)', color:'var(--viro-text)' }} />
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Account Name</label>
                  <input type="text" value={jazzcashName} onChange={e => setJazzcashName(e.target.value)}
                    placeholder="Account holder name"
                    className="w-full text-sm p-2.5 rounded-xl"
                    style={{ border:'1px solid var(--viro-border)', background:'var(--viro-bg)', color:'var(--viro-text)' }} />
                </div>

                <div className="p-3 rounded-xl" style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                  <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color:'#00B562' }}>
                    <span style={{width:10,height:10,borderRadius:'50%',background:'#00B562',display:'inline-block'}}/> EasyPaisa
                  </p>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Account Number</label>
                  <input type="tel" value={easypaisaNumber} onChange={e => setEasypaisaNumber(e.target.value)}
                    placeholder="03XXXXXXXXX"
                    className="w-full text-sm p-2.5 rounded-xl mb-2"
                    style={{ border:'1px solid var(--viro-border)', background:'var(--viro-bg)', color:'var(--viro-text)' }} />
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Account Name</label>
                  <input type="text" value={easypaisaName} onChange={e => setEasypaisaName(e.target.value)}
                    placeholder="Account holder name"
                    className="w-full text-sm p-2.5 rounded-xl"
                    style={{ border:'1px solid var(--viro-border)', background:'var(--viro-bg)', color:'var(--viro-text)' }} />
                </div>
              </div>

              <button
                onClick={async () => {
                  setPrepaidAccountsSaving(true)
                  await adminApi('site_setting_update', {
                    key: 'prepaid_accounts',
                    value: {
                      jazzcash:  { number: jazzcashNumber.trim(),  name: jazzcashName.trim()  || 'Asjid Siddique' },
                      easypaisa: { number: easypaisaNumber.trim(), name: easypaisaName.trim() || 'Asjid Siddique' },
                    },
                  })
                  setPrepaidAccountsSaving(false)
                  reloadSiteSettings()
                  showSimpleToast('✅ Prepaid account details saved', 'success')
                }}
                disabled={prepaidAccountsSaving}
                className="w-full px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background:'linear-gradient(135deg,#10B981,#059669)', border:'none', cursor: prepaidAccountsSaving ? 'not-allowed' : 'pointer', opacity: prepaidAccountsSaving ? 0.7 : 1 }}>
                {prepaidAccountsSaving ? '⏳ Saving…' : '💾 Save Prepaid Account Details'}
              </button>
              <p className="text-xs mt-2 text-center" style={{ color:'var(--viro-textMuted)' }}>
                Shoppers will see this exact number and name in the "Send payment to" box at checkout after selecting JazzCash or EasyPaisa.
              </p>
            </div>
          </div>
        )}
        {activeSection === 'theme' && (
          <div className="viro-card overflow-hidden fade-in">
            <div className="px-4 py-3 border-b" style={{ borderColor:'var(--viro-border)' }}>
              <h3 className="font-bold" style={{ color:'var(--viro-text)' }}>🌙 Site Theme</h3>
              <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>Controls light/dark mode for customers and admin panel</p>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { val:'dark',  label:'🌙 Dark Mode',  desc:'Dark background, light text' },
                  { val:'light', label:'☀️ Light Mode', desc:'Light background, dark text' },
                ].map(t => (
                  <button key={t.val} onClick={() => {
                        const ver = String(Date.now())
                        setTheme(t.val)
                        saveSetting('theme', { mode: t.val, version: ver })
                        // Broadcast to ALL open tabs on this device — instant theme propagation
                        // For OTHER devices: version stamp in DB causes them to pick up new theme on next visit
                        try {
                          const bc = new BroadcastChannel('viro_theme_sync')
                          bc.postMessage({ type: 'THEME_CHANGE', theme: t.val, version: ver })
                          setTimeout(() => bc.close(), 500)
                        } catch {}
                      }}
                    className="p-4 rounded-xl text-left transition-all"
                    style={theme === t.val
                      ? { background:'linear-gradient(135deg,#8B5CF620,#00BFFF20)', border:'2px solid #8B5CF6', boxShadow:'0 0 16px #8B5CF630' }
                      : { background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                    <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>{t.label}</p>
                    <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>{t.desc}</p>
                    {theme === t.val && <p className="text-xs mt-1 font-bold" style={{ color:'#10B981' }}>✓ Active</p>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ HOME BLOCKS ══════════ */}
        {activeSection === 'homeblocks' && (
          <div className="space-y-4 fade-in">

            {/* Header + New Block button */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>Home Page Blocks</p>
                <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                  Each block shows a horizontal scroll row of products on the home page.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    const nb = { id: crypto.randomUUID(), title: 'New Block', subtitle: '', viewAllUrl: '', enabled: true, productIds: [] }
                    setHomeBlocks(prev => [...prev, nb])
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0"
                  style={{ background:'linear-gradient(135deg,#00BFFF,#8B5CF6)', color:'#fff' }}>
                  + Add Block
                </button>
                <button
                  onClick={() => {
                    const nb = { id: crypto.randomUUID(), type: 'tabs', title: 'Explore More', subtitle: '', enabled: true, tabs: [] }
                    setHomeBlocks(prev => [...prev, nb])
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0"
                  style={{ background:'linear-gradient(135deg,#F97316,#EC4899)', color:'#fff' }}>
                  + Add Tab Group
                </button>
              </div>
            </div>

            {homeBlocks.length === 0 && (
              <div className="viro-card p-6 text-center">
                <div className="text-3xl mb-2">🏠</div>
                <p className="text-sm font-bold" style={{ color:'var(--viro-text)' }}>No blocks yet</p>
                <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
                  Click "+ Add Block" to create your first home page product row.
                </p>
              </div>
            )}

            {homeBlocks.map((block, idx) => (
              <div key={block.id} className="viro-card overflow-hidden"
                style={{ opacity: block.enabled ? 1 : 0.55, transition:'opacity 0.2s' }}>

                {/* Block header bar */}
                <div className="px-4 py-3 border-b flex items-center gap-2"
                  style={{ background:'var(--viro-bgDeep)', borderColor:'var(--viro-border)' }}>

                  {/* Toggle visible/hidden */}
                  <div onClick={() => setHomeBlocks(prev => prev.map((b,i) =>
                      i === idx ? { ...b, enabled: !b.enabled } : b))}
                    className="flex-shrink-0 cursor-pointer"
                    style={{ width:42, height:24, borderRadius:12,
                      background: block.enabled ? '#10B981' : '#334155',
                      position:'relative', transition:'background 0.2s' }}>
                    <div style={{ position:'absolute', top:3, width:18, height:18, borderRadius:'50%',
                      background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.3)',
                      left: block.enabled ? 21 : 3 }} />
                  </div>

                  <span className="text-xs font-mono flex-shrink-0" style={{ color:'var(--viro-textSub)' }}>#{idx+1}</span>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                    style={block.type === 'tabs'
                      ? { background:'#F9731620', color:'#F97316' }
                      : { background:'#8B5CF620', color:'#8B5CF6' }}>
                    {block.type === 'tabs' ? '🗂 Tab Group' : '📦 Products'}
                  </span>

                  {/* Inline title edit */}
                  <input value={block.title}
                    onChange={e => setHomeBlocks(prev => prev.map((b,i) =>
                      i === idx ? { ...b, title: e.target.value } : b))}
                    placeholder="Block title…"
                    className="flex-1 text-sm font-bold bg-transparent border-none outline-none min-w-0"
                    style={{ color:'var(--viro-text)' }} />

                  {/* Move up */}
                  <button disabled={idx === 0}
                    onClick={() => setHomeBlocks(prev => {
                      const a = [...prev]; [a[idx-1], a[idx]] = [a[idx], a[idx-1]]; return a })}
                    style={{ background:'none', border:'none', cursor: idx===0?'not-allowed':'pointer',
                      color:'var(--viro-textSub)', opacity: idx===0?0.3:1, fontSize:14, padding:'0 2px' }}>↑</button>

                  {/* Move down */}
                  <button disabled={idx === homeBlocks.length-1}
                    onClick={() => setHomeBlocks(prev => {
                      const a = [...prev]; [a[idx], a[idx+1]] = [a[idx+1], a[idx]]; return a })}
                    style={{ background:'none', border:'none',
                      cursor: idx===homeBlocks.length-1?'not-allowed':'pointer',
                      color:'var(--viro-textSub)', opacity: idx===homeBlocks.length-1?0.3:1, fontSize:14, padding:'0 2px' }}>↓</button>

                  {/* Delete */}
                  <button onClick={() => {
                      if (!window.confirm(`Delete block "${block.title}"?`)) return
                      setHomeBlocks(prev => prev.filter((_,i) => i !== idx)) }}
                    style={{ background:'none', border:'none', cursor:'pointer',
                      color:'#EF4444', fontSize:14, padding:'0 2px' }}>🗑</button>
                </div>

                {/* Subtitle */}
                <div className="px-4 pt-3">
                  <input value={block.subtitle || ''}
                    onChange={e => setHomeBlocks(prev => prev.map((b,i) =>
                      i === idx ? { ...b, subtitle: e.target.value } : b))}
                    placeholder="Subtitle (optional) — e.g. Fresh arrivals just for you"
                    className="text-xs w-full"
                    style={{ color:'var(--viro-textSub)' }} />
                </div>

                {/* View All URL — product blocks only; tab groups don't have
                    one at the group level since each tab has its own via its
                    source block */}
                {block.type !== 'tabs' && (
                <div className="px-4 pt-2">
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>
                    "View all →" link goes to
                  </label>
                  <input value={block.viewAllUrl || ''}
                    onChange={e => setHomeBlocks(prev => prev.map((b,i) =>
                      i === idx ? { ...b, viewAllUrl: e.target.value } : b))}
                    placeholder="/shop  (default) — or e.g. /shop?cat=jewellery, /shop?q=rings"
                    className="text-xs w-full"
                    style={{ color:'var(--viro-textSub)' }} />
                  <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
                    Leave blank for the default Shop page. Point it at a filtered URL — a category (<code style={{color:'#A78BFA'}}>/shop?cat=jewellery</code>), a search (<code style={{color:'#A78BFA'}}>/shop?q=rings</code>), or any page on the site — to make "View all" land exactly where this block's products came from.
                  </p>
                </div>
                )}

                {/* ══════ TAB GROUP editor — reuses existing Product Blocks as
                    tab content instead of re-picking items. Matches the
                    "Explore More" horizontal-tab pattern (Jewelry Set /
                    Choker / Necklace / …) where each tab switches which
                    curated product row shows underneath. ══════ */}
                {block.type === 'tabs' && (
                  <TabGroupEditor
                    block={block} idx={idx}
                    homeBlocks={homeBlocks} setHomeBlocks={setHomeBlocks}
                  />
                )}

                {/* Product picker — product blocks only */}
                {block.type !== 'tabs' && (
                <div className="px-4 pt-3 pb-4">
                  <p className="text-xs font-bold uppercase tracking-wider mb-2"
                    style={{ color:'var(--viro-textSub)' }}>
                    Products in this block ({(block.productIds||[]).length} selected)
                  </p>

                  {/* ── Smart auto-fill ── */}
                  <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:12,
                    background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                    <p style={{ fontSize:10, fontWeight:800, color:'var(--viro-textSub)',
                      textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
                      ⚡ Smart Auto-Fill
                    </p>
                    {/* Global strategies */}
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                      {[
                        { label:'🆕 Newest',       strategy:'newest' },
                        { label:'💸 Lowest Price', strategy:'cheapest' },
                        { label:'💎 Highest Price',strategy:'expensive' },
                        { label:'🔥 Max Discount', strategy:'discount' },
                      ].map(({ label, strategy }) => (
                        <button key={strategy} type="button"
                          onClick={() => smartFill(idx, strategy)}
                          style={{ fontSize:11, fontWeight:700, padding:'5px 10px', borderRadius:8,
                            background:'#6366f115', color:'#A78BFA', border:'1px solid #6366f130',
                            cursor:'pointer' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {/* By category */}
                    <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                      <span style={{ fontSize:10, color:'var(--viro-textSub)', fontWeight:700 }}>BY CATEGORY:</span>
                      {hbCategories.filter(c => !c.parent_id).slice(0, 8).map(cat => (
                        <button key={cat.id} type="button"
                          onClick={() => smartFill(idx, 'newest', cat.id)}
                          style={{ fontSize:10, fontWeight:700, padding:'4px 8px', borderRadius:8,
                            background:'#F9731610', color:'#FB923C', border:'1px solid #F9731630',
                            cursor:'pointer' }}>
                          {cat.icon} {cat.name}
                        </button>
                      ))}
                    </div>
                    {/* By category + strategy */}
                    <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', marginTop:6 }}>
                      <span style={{ fontSize:10, color:'var(--viro-textSub)', fontWeight:700 }}>CHEAPEST BY CAT:</span>
                      {hbCategories.filter(c => !c.parent_id).slice(0, 5).map(cat => (
                        <button key={cat.id} type="button"
                          onClick={() => smartFill(idx, 'cheapest', cat.id)}
                          style={{ fontSize:10, fontWeight:700, padding:'4px 8px', borderRadius:8,
                            background:'#10B98110', color:'#34D399', border:'1px solid #10B98130',
                            cursor:'pointer' }}>
                          {cat.icon} {cat.name}
                        </button>
                      ))}
                    </div>
                    <button type="button"
                      onClick={() => setHomeBlocks(prev => prev.map((b,i) =>
                        i===idx ? { ...b, productIds:[] } : b))}
                      style={{ marginTop:8, fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:6,
                        background:'transparent', color:'#EF4444', border:'1px solid #EF444430',
                        cursor:'pointer' }}>
                      ✕ Clear all products
                    </button>
                  </div>

                  {/* Selected chips — DRAG TO REORDER. Order here is the
                      exact order products appear in on the home page row. */}
                  {(block.productIds||[]).length > 0 && (
                    <>
                      <p style={{ fontSize:10, fontWeight:700, color:'var(--viro-textSub)', marginBottom:5 }}>
                        ↕️ Drag chips to reorder — this is the order shown on the home page
                      </p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {(block.productIds||[]).map((pid, chipIdx) => {
                          const p = hbProducts.find(x => x.id === pid)
                          if (!p) return null
                          const imgs = Array.isArray(p.images) ? p.images
                            : (() => { try { return JSON.parse(p.images||'[]') } catch { return [] } })()
                          return (
                            <div key={pid}
                              draggable
                              onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(chipIdx)) }}
                              onDragOver={e => e.preventDefault()}
                              onDrop={e => {
                                e.preventDefault()
                                const fromIdx = Number(e.dataTransfer.getData('text/plain'))
                                if (Number.isNaN(fromIdx) || fromIdx === chipIdx) return
                                setHomeBlocks(prev => prev.map((b,i) => {
                                  if (i !== idx) return b
                                  const ids = [...(b.productIds||[])]
                                  const [moved] = ids.splice(fromIdx, 1)
                                  ids.splice(chipIdx, 0, moved)
                                  return { ...b, productIds: ids }
                                }))
                              }}
                              className="flex items-center gap-1.5 px-2 py-1 rounded-xl text-xs font-medium"
                              style={{ background:'#8B5CF615', border:'1px solid #8B5CF640', color:'var(--viro-text)', cursor:'grab' }}>
                              <span style={{ color:'var(--viro-textSub)', fontSize:10, cursor:'grab' }}>⠿</span>
                              <img src={imgs[0]||'/logo.jpg'} alt={p.name}
                                className="w-5 h-5 rounded object-cover flex-shrink-0"
                                onError={e => { e.target.src='/logo.jpg' }} />
                              <span style={{ maxWidth:90, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                {p.name}
                              </span>
                              <button onClick={() => setHomeBlocks(prev => prev.map((b,i) =>
                                  i===idx ? { ...b, productIds:(b.productIds||[]).filter(id=>id!==pid) } : b))}
                                style={{ background:'none', border:'none', cursor:'pointer',
                                  color:'#EF4444', fontSize:11, lineHeight:1, padding:0, marginLeft:2 }}>✕</button>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {/* Search box — filters the product list below */}
                  <div className="relative mb-2">
                    <input value={hbSearch[idx] || ''}
                      onChange={e => setHbSearch(prev => ({ ...prev, [idx]: e.target.value }))}
                      placeholder="🔍 Search products by name…"
                      className="w-full text-xs p-2.5 rounded-xl"
                      style={{ border:'1px solid var(--viro-border)', background:'var(--viro-bg)', color:'var(--viro-text)' }} />
                    {hbSearch[idx] && (
                      <button onClick={() => setHbSearch(prev => ({ ...prev, [idx]: '' }))}
                        style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
                          background:'none', border:'none', cursor:'pointer', color:'var(--viro-textSub)', fontSize:14 }}>✕</button>
                    )}
                  </div>

                  {/* Scrollable product list with checkboxes */}
                  <div className="rounded-xl overflow-hidden"
                    style={{ border:'1px solid var(--viro-border)', maxHeight:240, overflowY:'auto' }}>
                    {hbProducts.length === 0 && (
                      <p className="text-xs p-3" style={{ color:'var(--viro-textSub)' }}>Loading products…</p>
                    )}
                    {hbProducts
                      .filter(p => !hbSearch[idx]?.trim() || p.name.toLowerCase().includes(hbSearch[idx].trim().toLowerCase()))
                      .map(p => {
                      const selected = (block.productIds||[]).includes(p.id)
                      const imgs = Array.isArray(p.images) ? p.images
                        : (() => { try { return JSON.parse(p.images||'[]') } catch { return [] } })()
                      const thumb = imgs[0] || '/logo.jpg'
                      return (
                        <div key={p.id}
                          onClick={() => setHomeBlocks(prev => prev.map((b,i) => {
                            if (i!==idx) return b
                            const ids = b.productIds||[]
                            return { ...b, productIds: selected ? ids.filter(id=>id!==p.id) : [...ids, p.id] }
                          }))}
                          className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                          style={{ background: selected?'#8B5CF610':'transparent',
                            borderBottom:'1px solid var(--viro-border)', transition:'background 0.15s' }}>
                          {/* Checkbox */}
                          <div className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs"
                            style={{ background: selected?'#8B5CF6':'var(--viro-bgDeep)',
                              border:`1.5px solid ${selected?'#8B5CF6':'var(--viro-border)'}`, color:'#fff' }}>
                            {selected ? '✓' : ''}
                          </div>
                          <img src={thumb} alt={p.name}
                            className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                            onError={e => { e.target.src='/logo.jpg' }} />
                          <span className="text-xs font-medium flex-1"
                            style={{ color:'var(--viro-text)', overflow:'hidden',
                              textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {p.name}
                          </span>
                          {selected && (
                            <span className="text-xs flex-shrink-0" style={{ color:'#8B5CF6' }}>✓</span>
                          )}
                        </div>
                      )
                    })}
                    {hbProducts.length > 0 &&
                      hbProducts.filter(p => !hbSearch[idx]?.trim() || p.name.toLowerCase().includes(hbSearch[idx].trim().toLowerCase())).length === 0 && (
                      <p className="text-xs p-3 text-center" style={{ color:'var(--viro-textSub)' }}>No products match "{hbSearch[idx]}"</p>
                    )}
                  </div>
                </div>
                )}
              </div>
            ))}

            {/* Save all blocks */}
            {homeBlocks.length > 0 && (
              <button onClick={() => saveSetting('home_blocks', homeBlocks)}
                disabled={saving.home_blocks}
                className="btn-primary w-full py-3 font-bold">
                {saving.home_blocks ? '⏳ Saving…' : '💾 Save Home Blocks'}
              </button>
            )}

          </div>
        )}


        {/* ── SIDE MENU (mobile hamburger drawer) ── */}
        {activeSection === 'sidemenu' && (
          <div className="space-y-4">
            <div className="viro-card p-5">
              <h3 className="font-bold text-lg mb-1" style={{ color:'var(--viro-text)' }}>☰ Side Menu</h3>
              <p className="text-sm" style={{ color:'var(--viro-textSub)' }}>
                The slide-out drawer customers open from the ☰ icon (mobile). "Home" always shows first and can't be removed.
                Add entries for a subcategory, an existing Home Block's product set, or a link to the full Shop — pick a source,
                rename the label to whatever customers should see, and drag to reorder.
              </p>
            </div>

            <SideMenuEditor sideMenu={sideMenu} setSideMenu={setSideMenu} homeBlocks={homeBlocks} categories={hbCategories} />

            <button onClick={() => saveSetting('side_menu', sideMenu)}
              disabled={saving.side_menu}
              className="btn-primary w-full py-3 font-bold">
              {saving.side_menu ? '⏳ Saving…' : '💾 Save Side Menu'}
            </button>
          </div>
        )}


        {/* ── PAGES ── */}
        {activeSection === 'pages' && (
          <div className="space-y-6">
            <div className="viro-card p-5">
              <h3 className="font-bold mb-1" style={{color:'var(--viro-text)'}}>📄 Site Pages</h3>
              <p className="text-xs mb-5" style={{color:'var(--viro-textSub)'}}>
                Edit About, Return Policy, Privacy Policy and Terms pages. Changes go live within 5 minutes.
              </p>
              {[
                { dbKey:'page_about',          label:'About Page',        state:pageAbout,   setState:setPageAbout,   showStory:true,  url:'/about' },
                { dbKey:'page_return_policy',  label:'Return Policy',     state:pageReturn,  setState:setPageReturn,  showStory:false, url:'/return-policy' },
                { dbKey:'page_privacy_policy', label:'Privacy Policy',    state:pagePrivacy, setState:setPagePrivacy, showStory:false, url:'/privacy-policy' },
                { dbKey:'page_terms',          label:'Terms & Conditions',state:pageTerms,   setState:setPageTerms,  showStory:false, url:'/terms' },
              ].map(page => (
                <div key={page.dbKey} className="mb-8 pb-6 border-b" style={{borderColor:'var(--viro-border)'}}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-sm" style={{color:'var(--viro-text)'}}>{page.label}</h4>
                    <a href={page.url} target="_blank" rel="noopener"
                      className="text-xs px-3 py-1 rounded-lg" style={{background:'var(--viro-bgInput)',color:'#8B5CF6',border:'1px solid #8B5CF630'}}>
                      Preview ↗
                    </a>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold mb-1 block uppercase tracking-wide" style={{color:'var(--viro-textSub)'}}>Page Title</label>
                      <input className="w-full px-3 py-2 rounded-xl text-sm"
                        style={{background:'var(--viro-bgInput)',border:'1px solid var(--viro-border)',color:'var(--viro-text)'}}
                        value={page.state?.title || ''}
                        onChange={e => page.setState(s => ({...(s||{}), title: e.target.value}))}
                        placeholder="Page heading..." />
                    </div>
                    {page.showStory && (
                      <div>
                        <label className="text-xs font-bold mb-1 block uppercase tracking-wide" style={{color:'var(--viro-textSub)'}}>Our Story</label>
                        <textarea rows={5} className="w-full px-3 py-2 rounded-xl text-sm"
                          style={{background:'var(--viro-bgInput)',border:'1px solid var(--viro-border)',color:'var(--viro-text)'}}
                          value={page.state?.story || ''}
                          onChange={e => page.setState(s => ({...(s||{}), story: e.target.value}))}
                          placeholder="Brand story (separate paragraphs with a blank line)..." />
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-bold mb-1 block uppercase tracking-wide" style={{color:'var(--viro-textSub)'}}>
                        Sections <span className="font-normal normal-case" style={{color:'var(--viro-textSub)'}}>— JSON array</span>
                      </label>
                      <textarea rows={7} className="w-full px-3 py-2 rounded-xl text-xs font-mono"
                        style={{background:'var(--viro-bgInput)',border:'1px solid var(--viro-border)',color:'var(--viro-text)'}}
                        value={JSON.stringify(page.state?.sections || [], null, 2)}
                        onChange={e => { try { page.setState(s => ({...(s||{}), sections: JSON.parse(e.target.value)})) } catch {} }}
                        placeholder='[{"heading":"Title","body":"Content"}]' />
                      <p className="text-xs mt-1" style={{color:'var(--viro-textSub)'}}>
                        Each item: <code style={{color:'#8B5CF6'}}>{'{"heading":"...","body":"..."}'}</code>
                      </p>
                    </div>
                    <button onClick={() => saveSetting(page.dbKey, page.state)}
                      disabled={saving[page.dbKey]}
                      className="w-full py-2.5 rounded-xl font-bold text-sm text-white"
                      style={{background:'linear-gradient(135deg,#8B5CF6,#F97316)',opacity:saving[page.dbKey]?0.6:1}}>
                      {saving[page.dbKey] ? 'Saving…' : `💾 Save ${page.label}`}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* ── SEO ── */}
        {activeSection === 'seo' && (
          <div className="space-y-5">

            {/* Site identity */}
            <div className="viro-card p-5">
              <h3 className="font-bold mb-1" style={{color:'var(--viro-text)'}}>🏢 Site Identity</h3>
              <p className="text-xs mb-4" style={{color:'var(--viro-textSub)'}}>
                This controls what Google shows as your brand name in search results.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold mb-1 block uppercase tracking-wide" style={{color:'var(--viro-textSub)'}}>Site Name (shown in Google)</label>
                  <input className="w-full px-3 py-2.5 rounded-xl text-sm"
                    style={{background:'var(--viro-bgInput)',border:'1px solid var(--viro-border)',color:'var(--viro-text)'}}
                    value={seoSettings.site_name || ''}
                    onChange={e => setSeoSettings(s => ({...s, site_name: e.target.value}))}
                    placeholder="Viro" />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1 block uppercase tracking-wide" style={{color:'var(--viro-textSub)'}}>Tagline (used in homepage title)</label>
                  <input className="w-full px-3 py-2.5 rounded-xl text-sm"
                    style={{background:'var(--viro-bgInput)',border:'1px solid var(--viro-border)',color:'var(--viro-text)'}}
                    value={seoSettings.tagline || ''}
                    onChange={e => setSeoSettings(s => ({...s, tagline: e.target.value}))}
                    placeholder="Smart Shopping, Better Living" />
                </div>
                <button onClick={() => saveSetting('seo_settings', seoSettings)}
                  disabled={saving.seo_settings}
                  className="w-full py-2.5 rounded-xl font-bold text-sm text-white"
                  style={{background:'linear-gradient(135deg,#8B5CF6,#F97316)',opacity:saving.seo_settings?0.6:1}}>
                  {saving.seo_settings ? 'Saving…' : '💾 Save Site Identity'}
                </button>
              </div>
            </div>

            {/* Search Console verification */}
            <div className="viro-card p-5">
              <h3 className="font-bold mb-1" style={{color:'var(--viro-text)'}}>🔍 Search Console</h3>
              <p className="text-xs mb-4" style={{color:'var(--viro-textSub)'}}>
                Paste your Google Search Console verification code to help Google index your site faster.
                Get it from: Google Search Console → Add Property → HTML tag method → copy only the content="xxx" value.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold mb-1 block uppercase tracking-wide" style={{color:'var(--viro-textSub)'}}>Google Verification Code</label>
                  <input className="w-full px-3 py-2.5 rounded-xl text-sm font-mono"
                    style={{background:'var(--viro-bgInput)',border:'1px solid var(--viro-border)',color:'var(--viro-text)'}}
                    value={seoSettings.google_verification || ''}
                    onChange={e => setSeoSettings(s => ({...s, google_verification: e.target.value}))}
                    placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                </div>
                <button onClick={() => saveSetting('seo_settings', seoSettings)}
                  disabled={saving.seo_settings}
                  className="w-full py-2.5 rounded-xl font-bold text-sm text-white"
                  style={{background:'linear-gradient(135deg,#8B5CF6,#F97316)',opacity:saving.seo_settings?0.6:1}}>
                  {saving.seo_settings ? 'Saving…' : '💾 Save Verification Code'}
                </button>
              </div>
            </div>

            {/* SEO tips */}
            <div className="viro-card p-5">
              <h3 className="font-bold mb-3" style={{color:'var(--viro-text)'}}>📋 SEO Checklist</h3>
              {[
                ['✅','Sitemap submitted','Go to Google Search Console → Sitemaps → add: https://viro.pk/sitemap.xml'],
                ['✅','robots.txt live','viro.pk/robots.txt is set up correctly'],
                ['✅','Organization schema','Google Knowledge Panel data is embedded in every page'],
                ['✅','Unique page titles','Each page has its own title and description'],
                ['⚠️','Submit to Search Console','Go to search.google.com/search-console and request indexing for each page'],
                ['⚠️','Verify domain','Add viro.pk to Google Search Console via DNS TXT record'],
                ['💡','Google Cache','Changes take 1-4 weeks to appear in search results. Force it: Request Indexing in GSC.'],
              ].map(([icon, label, note], i) => (
                <div key={i} className="flex items-start gap-3 py-2.5 border-b last:border-0" style={{borderColor:'var(--viro-border)'}}>
                  <span className="text-lg flex-shrink-0">{icon}</span>
                  <div>
                    <p className="text-sm font-bold" style={{color:'var(--viro-text)'}}>{label}</p>
                    <p className="text-xs mt-0.5" style={{color:'var(--viro-textSub)'}}>{note}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}


        {/* ══════════ SEARCH WORDS ══════════ */}
        {activeSection === 'search' && (
          <div className="space-y-4 fade-in">
            <div className="viro-card overflow-hidden">
              <div className="p-4 border-b" style={{ borderColor:'var(--viro-border)', background:'var(--viro-bgDeep)' }}>
                <h3 className="font-bold text-sm">🔎 Search Quick-Pick Words</h3>
                <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
                  These words appear as clickable chips when users open the search bar. Tap any word to search that category instantly.
                </p>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex flex-wrap gap-2 min-h-[40px] p-3 rounded-xl" style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                  {searchSuggestions.length === 0 && (
                    <span className="text-xs" style={{ color:'var(--viro-textSub)' }}>No words added yet</span>
                  )}
                  {searchSuggestions.map((word, i) => (
                    <span key={word+i} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                      style={{ background:'#8B5CF620', color:'#A78BFA', border:'1px solid #8B5CF640' }}>
                      {word}
                      <button onClick={() => {
                        const next = searchSuggestions.filter((_, j) => j !== i)
                        setSearchSuggestions(next)
                        saveSetting('search_suggestions', next)
                      }} style={{ color:'#EF4444', background:'none', border:'none', cursor:'pointer', fontSize:11, lineHeight:1, padding:0 }}>✕</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newSuggestion}
                    onChange={e => setNewSuggestion(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newSuggestion.trim()) {
                        const word = newSuggestion.trim()
                        if (!searchSuggestions.includes(word)) {
                          const next = [...searchSuggestions, word]
                          setSearchSuggestions(next)
                          saveSetting('search_suggestions', next)
                        }
                        setNewSuggestion('')
                      }
                    }}
                    placeholder="Type a word, press Enter (e.g. Necklace, Ring, Watch…)"
                    style={{ flex:1 }}
                  />
                  <button
                    onClick={() => {
                      const word = newSuggestion.trim()
                      if (!word || searchSuggestions.includes(word)) return
                      const next = [...searchSuggestions, word]
                      setSearchSuggestions(next)
                      saveSetting('search_suggestions', next)
                      setNewSuggestion('')
                    }}
                    disabled={!newSuggestion.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-bold flex-shrink-0"
                    style={{ background:'linear-gradient(135deg,#8B5CF6,#A78BFA)', color:'#fff', border:'none', cursor:'pointer' }}>
                    + Add
                  </button>
                </div>
                <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                  💡 Add popular categories or trending items — e.g. Necklace, Ring, Round Ring, Bag, Watch, Cosmetics
                </p>
                {searchSuggestions.length > 0 && (
                  <button
                    onClick={() => { setSearchSuggestions([]); saveSetting('search_suggestions', []) }}
                    className="text-xs px-3 py-1.5 rounded-xl"
                    style={{ color:'#EF4444', background:'#EF444415', border:'1px solid #EF444430', cursor:'pointer' }}>
                    🗑 Clear All Words
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ SEARCH ANALYTICS ══════════ */}
        {activeSection === 'searchanalytics' && (
          <SearchAnalyticsSection
            searchSuggestions={searchSuggestions}
            setSearchSuggestions={setSearchSuggestions}
            saveSetting={saveSetting}
          />
        )}
      </div>
    </div>
  )
}

// ── Search Analytics — what customers actually type ────────────
function SearchAnalyticsSection({ searchSuggestions, setSearchSuggestions, saveSetting }) {
  const [rows, setRows] = useState(null) // null = loading
  const [sortBy, setSortBy] = useState('count') // 'count' | 'recent' | 'zero_results'

  useEffect(() => {
    let cancelled = false
    supabase.from('search_analytics').select('*').order('search_count', { ascending: false }).limit(200)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { console.warn('[search_analytics]', error.message); setRows([]); return }
        setRows(data || [])
      })
    return () => { cancelled = true }
  }, [])

  const sorted = rows ? [...rows].sort((a, b) => {
    if (sortBy === 'recent') return new Date(b.last_searched_at) - new Date(a.last_searched_at)
    if (sortBy === 'zero_results') return (a.last_result_count === 0 ? -1 : 1) - (b.last_result_count === 0 ? -1 : 1) || b.search_count - a.search_count
    return b.search_count - a.search_count
  }) : []

  function addAsQuickWord(term) {
    const word = term.charAt(0).toUpperCase() + term.slice(1)
    if (searchSuggestions.includes(word)) { showSimpleToast('Already added', 'info'); return }
    const next = [...searchSuggestions, word]
    setSearchSuggestions(next)
    saveSetting('search_suggestions', next)
    showSimpleToast(`✅ Added "${word}" as a quick-pick word`, 'info')
  }

  const zeroResultCount = rows ? rows.filter(r => r.last_result_count === 0).length : 0

  return (
    <div className="space-y-4 fade-in">
      <div className="viro-card overflow-hidden">
        <div className="p-4 border-b" style={{ borderColor:'var(--viro-border)', background:'var(--viro-bgDeep)' }}>
          <h3 className="font-bold text-sm">📊 Search Analytics</h3>
          <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
            What customers actually type into search — logged automatically once they pause typing for ~1.5s. Use this to spot what to tag with Search Keywords on your products, or add as a quick-pick word above.
          </p>
        </div>

        <div className="p-4">
          {rows === null ? (
            <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>No searches logged yet — check back once customers start using search.</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-2">
                  {[{v:'count',l:'Most searched'},{v:'recent',l:'Most recent'},{v:'zero_results',l:`⚠️ 0 results (${zeroResultCount})`}].map(o => (
                    <button key={o.v} onClick={() => setSortBy(o.v)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold"
                      style={sortBy === o.v
                        ? { background:'#8B5CF625', color:'#A78BFA', border:'1px solid #8B5CF660' }
                        : { background:'var(--viro-bgDeep)', color:'var(--viro-textSub)', border:'1px solid var(--viro-border)' }}>
                      {o.l}
                    </button>
                  ))}
                </div>
                <span className="text-xs" style={{ color:'var(--viro-textSub)' }}>{rows.length} unique terms</span>
              </div>

              <div className="space-y-1.5 max-h-[520px] overflow-y-auto">
                {sorted.map(r => (
                  <div key={r.term} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                    style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                    <span className="font-bold text-sm flex-1" style={{ color:'var(--viro-text)' }}>{r.term}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background:'#8B5CF620', color:'#A78BFA' }}>
                      {r.search_count}× searched
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={r.last_result_count === 0
                        ? { background:'#EF444420', color:'#EF4444' }
                        : { background:'#10B98120', color:'#10B981' }}>
                      {r.last_result_count === 0 ? '⚠️ 0 results' : `${r.last_result_count} results`}
                    </span>
                    <button onClick={() => addAsQuickWord(r.term)}
                      className="text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0"
                      style={{ background:'var(--viro-bgCard)', color:'var(--viro-textSub)', border:'1px solid var(--viro-border)', cursor:'pointer' }}>
                      + Quick word
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}


export default SiteSettingsTab
