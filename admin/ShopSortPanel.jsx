'use client'
import React, { useState, useRef, useCallback } from 'react'
import Portal from './Portal'
import { adminApi } from '../lib/adminApi'
import { supabase } from '../lib/supabase'

const SORT_MODES = [
  { value: 'newest',       label: '🆕 New Arrivals',        desc: 'Newest added products first' },
  { value: 'oldest',       label: '📅 Oldest First',         desc: 'Oldest products shown first' },
  { value: 'price_asc',   label: '💰 Price: Low to High',   desc: 'Cheapest products first' },
  { value: 'price_desc',  label: '💎 Price: High to Low',   desc: 'Most expensive first' },
  { value: 'discount',    label: '🔥 Most Discounted',      desc: 'Highest % discount first' },
  { value: 'top_rated',   label: '⭐ Top Rated',            desc: 'Best rated products first' },
  { value: 'most_ordered',label: '📦 Best Sellers',         desc: 'Most ordered products first' },
  { value: 'featured',    label: '⭐ Featured First',        desc: 'Featured products at top, then newest' },
  { value: 'manual',      label: '🎯 Manual Order',         desc: 'Drag & drop to set exact position' },
  { value: 'random',      label: '🎲 Random / Shuffle',     desc: 'Different order every visit' },
  { value: 'stock_desc',  label: '📊 Most Stock First',     desc: 'High stock products first' },
  { value: 'az',          label: '🔤 A → Z (Name)',          desc: 'Alphabetical order' },
  { value: 'za',          label: '🔤 Z → A (Name)',          desc: 'Reverse alphabetical' },
]

// Drag handle SVG
function DragHandle() {
  return (
    <svg width="14" height="20" viewBox="0 0 14 20" fill="none" style={{ flexShrink:0, cursor:'grab' }}>
      {[0,1,2].map(row => [0,1].map(col => (
        <circle key={`${row}-${col}`} cx={col*6+4} cy={row*7+4} r="1.5" fill="var(--viro-textSub)" opacity="0.6" />
      )))}
    </svg>
  )
}

export default function ShopSortPanel({ products, onSaved }) {
  const [open,       setOpen]       = useState(false)
  const [mode,       setMode]       = useState('newest')
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [tab,        setTab]        = useState('sort')   // 'sort' | 'manual' | 'featured'
  const [items,      setItems]      = useState([])       // manual order list
  const [featured,   setFeatured]   = useState(new Set())
  const [dragIdx,    setDragIdx]    = useState(null)
  const [dragOver,   setDragOver]   = useState(null)
  const listRef      = useRef()

  // Load current config when opening
  async function openPanel() {
    // Sort products by current display_order for manual tab
    const sorted = [...products].sort((a,b) => (a.display_order||9999) - (b.display_order||9999))
    setItems(sorted)
    setFeatured(new Set(products.filter(p=>p.is_featured).map(p=>p.id)))
    setOpen(true)
  }

  // ── Drag & drop handlers ──────────────────────────────────────────────────
  function onDragStart(e, idx) {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }
  function onDragEnter(idx) { setDragOver(idx) }
  function onDragOver(e)    { e.preventDefault() }
  function onDrop(e, toIdx) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === toIdx) return
    const next = [...items]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(toIdx, 0, moved)
    setItems(next)
    setDragIdx(null)
    setDragOver(null)
  }
  function onDragEnd() { setDragIdx(null); setDragOver(null) }

  // Move item up/down via buttons (mobile-friendly)
  function moveItem(idx, dir) {
    const next = [...items]
    const to = idx + dir
    if (to < 0 || to >= next.length) return
    ;[next[idx], next[to]] = [next[to], next[idx]]
    setItems(next)
  }

  // Toggle featured
  function toggleFeatured(id) {
    setFeatured(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    try {
      // 1. Save global sort mode to shop_config (direct Supabase — no edge function needed)
      const { error: cfgErr } = await supabase.from('shop_config').upsert({ key: 'default_sort', value: mode }, { onConflict: 'key' })
      if (cfgErr) throw new Error('shop_config: ' + cfgErr.message)

      // 2. If manual mode — save display_order for each product
      if (mode === 'manual' || tab === 'manual') {
        const updates = items.map((p, i) => ({ id: p.id, display_order: i + 1 }))
        // Batch update in chunks of 20
        for (let i = 0; i < updates.length; i += 20) {
          const chunk = updates.slice(i, i + 20)
          await Promise.all(chunk.map(u => adminApi('product_update', { id: u.id, patch: { display_order: u.display_order } })))
        }
      }

      // 3. Save featured flags
      const featuredArr = [...featured]
      const allIds = products.map(p => p.id)
      // Unfeatured ones
      const toUnfeature = allIds.filter(id => !featuredArr.includes(id))
      await Promise.all([
        ...featuredArr.map(id  => adminApi('product_update', { id, patch: { is_featured: true } })),
        ...toUnfeature.map(id  => adminApi('product_update', { id, patch: { is_featured: false } })),
      ])

      setSaved(true)
      setTimeout(() => { setSaved(false); setOpen(false); onSaved?.() }, 1200)
    } catch(err) {
      console.error('ShopSort save error:', err)
      alert('❌ Save failed: ' + err.message + '\n\nMake sure you ran the SQL migration in Supabase (add_display_order.sql)')
    }
    setSaving(false)
  }

  const activeProducts = products.filter(p => p.is_active && p.status === 'active')

  return (
    <>
      {/* Trigger button */}
      <button onClick={openPanel}
        className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all"
        style={{ background:'linear-gradient(135deg,#8B5CF6,#00BFFF)', color:'#fff', border:'none', cursor:'pointer' }}>
        🎯 Shop Display Order
      </button>

      {open && (
        <Portal>
          <div style={{ position:'fixed',inset:0,zIndex:9990,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(5px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
            onClick={e => e.target===e.currentTarget && setOpen(false)}>
            <div style={{ width:'100%',maxWidth:620,maxHeight:'88vh',display:'flex',flexDirection:'column',
              background:'var(--viro-bgCard)',borderRadius:20,border:'1px solid var(--viro-border)',
              overflow:'hidden',animation:'popIn 0.25s ease' }}>

              {/* Header */}
              <div style={{ padding:'16px 20px',borderBottom:'1px solid var(--viro-border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
                <div>
                  <h2 style={{ fontWeight:900,fontSize:17,color:'var(--viro-text)',margin:0 }}>🎯 Shop Display Control</h2>
                  <p style={{ fontSize:11,color:'var(--viro-textSub)',margin:'2px 0 0' }}>
                    Control what customers see first — invisible to shoppers
                  </p>
                </div>
                <button onClick={() => setOpen(false)}
                  style={{ width:32,height:32,borderRadius:'50%',background:'var(--viro-bgDeep)',border:'none',cursor:'pointer',color:'var(--viro-textMuted)',fontSize:16 }}>✕</button>
              </div>

              {/* Tabs */}
              <div style={{ display:'flex',borderBottom:'1px solid var(--viro-border)',flexShrink:0 }}>
                {[['sort','⚙️ Sort Mode'],['featured','⭐ Featured'],['manual','🎯 Manual Order']].map(([t,l]) => (
                  <button key={t} onClick={() => setTab(t)}
                    style={{ flex:1,padding:'10px 4px',fontSize:12,fontWeight:700,border:'none',cursor:'pointer',
                      background: tab===t ? 'var(--viro-bgCard)' : 'var(--viro-bgDeep)',
                      color: tab===t ? '#8B5CF6' : 'var(--viro-textSub)',
                      borderBottom: tab===t ? '2px solid #8B5CF6' : '2px solid transparent' }}>
                    {l}
                  </button>
                ))}
              </div>

              {/* Body */}
              <div style={{ flex:1,overflowY:'auto',padding:'16px 20px' }}>

                {/* ── Sort Mode Tab ── */}
                {tab === 'sort' && (
                  <div>
                    <p style={{ fontSize:11,color:'var(--viro-textSub)',marginBottom:12 }}>
                      Choose how products are ordered by default in the shop. Users can still sort themselves — this is the starting order.
                    </p>
                    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
                      {SORT_MODES.map(s => (
                        <button key={s.value} onClick={() => { setMode(s.value); if(s.value==='manual') setTab('manual') }}
                          style={{ padding:'10px 12px',borderRadius:12,border:`2px solid ${mode===s.value?'#8B5CF6':'var(--viro-border)'}`,
                            background: mode===s.value ? '#8B5CF620' : 'var(--viro-bgDeep)',
                            cursor:'pointer',textAlign:'left',transition:'all 0.15s' }}>
                          <p style={{ fontSize:12,fontWeight:800,color:mode===s.value?'#A78BFA':'var(--viro-text)',margin:0 }}>{s.label}</p>
                          <p style={{ fontSize:10,color:'var(--viro-textSub)',margin:'2px 0 0' }}>{s.desc}</p>
                        </button>
                      ))}
                    </div>

                    {/* Live preview */}
                    <div style={{ marginTop:16,padding:12,borderRadius:12,background:'var(--viro-bgDeep)',border:'1px solid var(--viro-border)' }}>
                      <p style={{ fontSize:10,fontWeight:900,color:'var(--viro-textSub)',textTransform:'uppercase',letterSpacing:1,marginBottom:8 }}>
                        Preview — First 5 products customers will see:
                      </p>
                      {(() => {
                        const now = new Date()
                        const dispPrice = p => (p.discount_price && p.discount_price < p.price && p.sale_active) ? p.discount_price : p.price
                        const active = activeProducts.slice()
                        let preview = []
                        if (mode==='newest')        preview = active.sort((a,b) => new Date(b.created_at)-new Date(a.created_at))
                        else if (mode==='oldest')   preview = active.sort((a,b) => new Date(a.created_at)-new Date(b.created_at))
                        else if (mode==='price_asc') preview = active.sort((a,b) => dispPrice(a)-dispPrice(b))
                        else if (mode==='price_desc') preview = active.sort((a,b) => dispPrice(b)-dispPrice(a))
                        else if (mode==='discount')  preview = active.sort((a,b) => {
                          const da = a.discount_price ? (a.price-a.discount_price)/a.price : 0
                          const db = b.discount_price ? (b.price-b.discount_price)/b.price : 0
                          return db-da
                        })
                        else if (mode==='top_rated')  preview = active.sort((a,b) => (b.avg_rating||0)-(a.avg_rating||0))
                        else if (mode==='featured')   preview = active.sort((a,b) => (b.is_featured?1:0)-(a.is_featured?1:0) || new Date(b.created_at)-new Date(a.created_at))
                        else if (mode==='manual')     preview = [...items].filter(p=>p.is_active&&p.status==='active')
                        else if (mode==='stock_desc') preview = active.sort((a,b) => (b.stock||0)-(a.stock||0))
                        else if (mode==='az')         preview = active.sort((a,b) => a.name.localeCompare(b.name))
                        else if (mode==='za')         preview = active.sort((a,b) => b.name.localeCompare(a.name))
                        else if (mode==='random')     preview = active.sort(() => Math.random()-0.5)
                        else                          preview = active
                        return preview.slice(0,5).map((p,i) => {
                          const img = (() => { try { const imgs = typeof p.images==='string'?JSON.parse(p.images):p.images; return Array.isArray(imgs)?imgs[0]:imgs } catch { return p.images } })()
                          const dp = dispPrice(p)
                          return (
                            <div key={p.id} style={{ display:'flex',alignItems:'center',gap:8,marginBottom:6,padding:'6px 8px',borderRadius:8,background:'var(--viro-bgCard)' }}>
                              <span style={{ fontSize:10,fontWeight:900,color:'#8B5CF6',width:16,flexShrink:0 }}>#{i+1}</span>
                              {img && <img src={img} alt="" style={{ width:28,height:28,borderRadius:6,objectFit:'cover',flexShrink:0 }} />}
                              <p style={{ flex:1,fontSize:11,fontWeight:700,color:'var(--viro-text)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{p.name}</p>
                              <span style={{ fontSize:10,fontWeight:700,color:'#10B981',flexShrink:0 }}>Rs.{dp?.toLocaleString()}</span>
                              {p.is_featured && <span style={{ fontSize:9,padding:'1px 5px',borderRadius:10,background:'#F59E0B20',color:'#F59E0B',border:'1px solid #F59E0B40' }}>⭐</span>}
                            </div>
                          )
                        })
                      })()}
                    </div>
                  </div>
                )}

                {/* ── Featured Tab ── */}
                {tab === 'featured' && (
                  <div>
                    <p style={{ fontSize:11,color:'var(--viro-textSub)',marginBottom:4 }}>
                      Mark products as ⭐ Featured. In "Featured First" sort mode these appear at the top. Also used for homepage highlights.
                    </p>
                    <p style={{ fontSize:11,fontWeight:700,color:'#F59E0B',marginBottom:12 }}>
                      {featured.size} product{featured.size!==1?'s':''} featured
                    </p>
                    <div style={{ display:'flex',flexDirection:'column',gap:4 }}>
                      {activeProducts.map(p => {
                        const isFeat = featured.has(p.id)
                        const img = (() => { try { const imgs = typeof p.images==='string'?JSON.parse(p.images):p.images; return Array.isArray(imgs)?imgs[0]:imgs } catch { return p.images } })()
                        return (
                          <div key={p.id}
                            onClick={() => toggleFeatured(p.id)}
                            style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:12,cursor:'pointer',
                              background: isFeat ? '#F59E0B12' : 'var(--viro-bgDeep)',
                              border: `1.5px solid ${isFeat ? '#F59E0B50' : 'var(--viro-border)'}`,
                              transition:'all 0.15s' }}>
                            <div style={{ width:20,height:20,borderRadius:'50%',border:`2px solid ${isFeat?'#F59E0B':'var(--viro-border)'}`,
                              background:isFeat?'#F59E0B':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                              {isFeat && <span style={{ fontSize:10 }}>★</span>}
                            </div>
                            {img && <img src={img} alt="" style={{ width:32,height:32,borderRadius:8,objectFit:'cover',flexShrink:0 }} />}
                            <div style={{ flex:1,minWidth:0 }}>
                              <p style={{ fontSize:12,fontWeight:700,color:'var(--viro-text)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{p.name}</p>
                              <p style={{ fontSize:10,color:'var(--viro-textSub)',margin:0 }}>Rs.{p.discount_price||p.price}</p>
                            </div>
                            {isFeat && <span style={{ fontSize:14 }}>⭐</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── Manual Order Tab ── */}
                {tab === 'manual' && (
                  <div>
                    <p style={{ fontSize:11,color:'var(--viro-textSub)',marginBottom:4 }}>
                      Drag products to set exact position. Use ↑↓ buttons on mobile.
                    </p>
                    <p style={{ fontSize:10,fontWeight:700,color:'#8B5CF6',marginBottom:12,padding:'6px 10px',borderRadius:8,background:'#8B5CF618',border:'1px solid #8B5CF640' }}>
                      💡 Must also set Sort Mode → Manual Order to use this in the shop
                    </p>
                    <div ref={listRef} style={{ display:'flex',flexDirection:'column',gap:4 }}>
                      {items.map((p, idx) => {
                        const img = (() => { try { const imgs = typeof p.images==='string'?JSON.parse(p.images):p.images; return Array.isArray(imgs)?imgs[0]:imgs } catch { return p.images } })()
                        const isDragging = dragIdx === idx
                        const isOver    = dragOver === idx
                        return (
                          <div key={p.id}
                            draggable
                            onDragStart={e => onDragStart(e,idx)}
                            onDragEnter={() => onDragEnter(idx)}
                            onDragOver={onDragOver}
                            onDrop={e => onDrop(e,idx)}
                            onDragEnd={onDragEnd}
                            style={{ display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderRadius:10,
                              background: isDragging ? '#8B5CF630' : isOver ? '#00BFFF15' : 'var(--viro-bgDeep)',
                              border: `1.5px solid ${isOver ? '#00BFFF60' : isDragging ? '#8B5CF660' : 'var(--viro-border)'}`,
                              opacity: isDragging ? 0.5 : 1, transition:'background 0.1s,border 0.1s',cursor:'grab' }}>
                            <DragHandle />
                            <span style={{ fontSize:10,fontWeight:900,color:'#8B5CF6',width:20,flexShrink:0,textAlign:'center' }}>
                              {idx+1}
                            </span>
                            {img && <img src={img} alt="" style={{ width:28,height:28,borderRadius:6,objectFit:'cover',flexShrink:0 }} />}
                            <p style={{ flex:1,fontSize:11,fontWeight:700,color:'var(--viro-text)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{p.name}</p>
                            {!p.is_active && <span style={{ fontSize:9,padding:'1px 5px',borderRadius:8,background:'#EF444420',color:'#EF4444' }}>hidden</span>}
                            {p.status==='out_of_stock' && <span style={{ fontSize:9,padding:'1px 5px',borderRadius:8,background:'#F9731620',color:'#F97316' }}>OOS</span>}
                            {featured.has(p.id) && <span style={{ fontSize:12 }}>⭐</span>}
                            {/* Mobile up/down */}
                            <div style={{ display:'flex',gap:2,flexShrink:0 }}>
                              <button onClick={() => moveItem(idx,-1)} disabled={idx===0}
                                style={{ width:22,height:22,borderRadius:6,border:'1px solid var(--viro-border)',background:'var(--viro-bgCard)',cursor:idx===0?'not-allowed':'pointer',fontSize:10,color:'var(--viro-textSub)',opacity:idx===0?0.3:1 }}>↑</button>
                              <button onClick={() => moveItem(idx,1)} disabled={idx===items.length-1}
                                style={{ width:22,height:22,borderRadius:6,border:'1px solid var(--viro-border)',background:'var(--viro-bgCard)',cursor:idx===items.length-1?'not-allowed':'pointer',fontSize:10,color:'var(--viro-textSub)',opacity:idx===items.length-1?0.3:1 }}>↓</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding:'12px 20px',borderTop:'1px solid var(--viro-border)',display:'flex',gap:10,flexShrink:0 }}>
                <button onClick={() => setOpen(false)}
                  style={{ flex:1,padding:'11px',borderRadius:12,fontWeight:700,fontSize:13,cursor:'pointer',background:'transparent',color:'var(--viro-textMuted)',border:'1px solid var(--viro-border)' }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  style={{ flex:2,padding:'11px',borderRadius:12,fontWeight:900,fontSize:13,cursor:saving?'wait':'pointer',
                    background: saved ? '#10B981' : 'linear-gradient(135deg,#8B5CF6,#00BFFF)',
                    color:'#fff',border:'none',transition:'background 0.3s',opacity:saving?0.8:1 }}>
                  {saved ? '✅ Saved!' : saving ? 'Saving…' : `✅ Apply to Shop (${activeProducts.length} products)`}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  )
}
