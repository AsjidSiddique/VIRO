'use client'
import { supabase } from '../lib/supabase'
/* eslint-disable @next/next/no-img-element */
import React, { useState, useRef, useEffect } from 'react'
import { adminApi } from '../lib/adminApi'
import { uploadCategoryImage } from '../lib/storage'
import { showSimpleToast } from '../components/Toast'
import { adminConfirm } from './adminUtils'

const CATEGORY_ICONS = ['📱','👗','👟','👜','⌚','💍','💄','🏠','🏋️','🧸','📚','🛒','🚗','📦','🎮','🍕','💻','📷','🎵','🌿','🐾','✈️','💊','🔧','🧴','👔','🧒','🎧','🔌','🧥']
const EMPTY_CAT = { name: '', icon: '📦', parent_id: '', image_url: '', description: '', is_visible: true, status: 'active' }

function CatImageUpload({ value, onChange, small }) {
  const [uploading, setUploading] = useState(false)
  const ref = useRef()
  async function handle(file) {
    if (!file) return
    setUploading(true)
    try { const url = await uploadCategoryImage(file); onChange(url) }
    catch(e) { showSimpleToast('❌ Upload failed: ' + e.message, 'info') }
    setUploading(false)
  }
  const size = small ? 56 : 80
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }} onClick={() => ref.current?.click()}>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={e => handle(e.target.files?.[0])} />
      <div className="w-full h-full rounded-xl overflow-hidden flex items-center justify-center cursor-pointer"
        style={{ background: '#1E293B', border: '2px dashed ' + (value ? '#8B5CF6' : '#334155') }}>
        {uploading ? <span className="text-xs" style={{ color: '#8B5CF6' }}>⏳</span>
          : value ? <img src={value} alt="cat" className="w-full h-full object-cover" />
          : <div className="flex flex-col items-center gap-0.5">
              <span style={{ fontSize: small ? 18 : 22 }}>🖼️</span>
              <span style={{ color: '#475569', fontSize: 9, fontWeight: 700 }}>Upload</span>
            </div>}
      </div>
      {value && !uploading && (
        <button type="button" onClick={e => { e.stopPropagation(); onChange('') }}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white"
          style={{ background: '#EF4444', fontSize: 10, fontWeight: 900 }}>✕</button>
      )}
    </div>
  )
}

function CategoriesTab({ categories, onReload }) {
  const [newCat,    setNewCat]    = useState(EMPTY_CAT)
  const [editId,    setEditId]    = useState(null)
  const [editData,  setEditData]  = useState({})
  const [saving,    setSaving]    = useState(false)
  const [iconOpen,  setIconOpen]  = useState(false)
  const [products,  setProducts]  = useState([])
  const [collapsed, setCollapsed] = useState({})

  // All categories can be a parent — allows deep nesting
  // Show top-level first, then sub-categories indented
  const parents = [
    ...categories.filter(c => !c.parent_id),
    ...categories.filter(c =>  c.parent_id),
  ]
  const children = (pid) => categories.filter(c => c.parent_id === pid)

  // Load products to compute counts
  useEffect(() => {
    supabase.from('products').select('id,category_id,is_active').then(({ data }) => setProducts(data || []))
  }, [categories])

  function countDirect(catId) { return products.filter(p => p.category_id === catId).length }
  function countTotal(catId) {
    const childIds = categories.filter(c => c.parent_id === catId).map(c => c.id)
    return products.filter(p => p.category_id === catId || childIds.includes(p.category_id)).length
  }
  function countActive(catId) {
    const childIds = categories.filter(c => c.parent_id === catId).map(c => c.id)
    return products.filter(p => (p.category_id === catId || childIds.includes(p.category_id)) && p.is_active).length
  }

  const totalProducts = products.length
  const uncategorised = products.filter(p => !p.category_id).length

  async function addCategory() {
    if (!newCat.name.trim()) return
    setSaving(true)
    const slug = newCat.name.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-') + '-' + Date.now().toString(36)
    let saveResult
    try {
      saveResult = await adminApi('category_save', { patch: {
        name: newCat.name.trim(), slug, icon: newCat.icon,
        image_url: newCat.image_url || null, parent_id: newCat.parent_id || null,
        sort_order: categories.filter(c => c.parent_id === (newCat.parent_id||null)).length + 1,
        is_visible: newCat.is_visible !== false,
        status: newCat.status || 'active',
      } })
    } catch(e) { saveResult = { error: e } }
    setSaving(false)
    if (saveResult?.error) { showSimpleToast('❌ ' + (saveResult.error?.message || saveResult.error), 'info'); return }
    showSimpleToast('✅ Category added!', 'success')
    setNewCat(EMPTY_CAT); onReload()
  }

  async function saveEdit(id) {
    setSaving(true)
    let saveResult
    try {
      saveResult = await adminApi('category_save', { id, patch: {
        name: editData.name, icon: editData.icon,
        image_url: editData.image_url || null, parent_id: editData.parent_id || null,
        is_visible: editData.is_visible !== false,
        status: editData.status || 'active',
      } })
    } catch(e) { saveResult = { error: e } }
    setSaving(false)
    if (saveResult?.error) { showSimpleToast('❌ ' + (saveResult.error?.message || saveResult.error), 'info'); return }
    showSimpleToast('✅ Updated!', 'success')
    setEditId(null); onReload()
  }

  async function deleteCategory(id, name) {
    if (!(await adminConfirm(`Delete "${name}"? Sub-categories will be unlinked.`))) return
    await adminApi('category_delete', { id })
    showSimpleToast('🗑️ Deleted', 'info'); onReload()
  }

  async function _toggleVisibility(cat) {
    const newVisible = !cat.is_visible
    const newStatus = newVisible ? (cat.status === 'hidden' ? 'active' : cat.status) : 'hidden'
    await adminApi('category_update', { id: cat.id, patch: { is_visible: newVisible, status: newStatus } })
    onReload()
  }

  async function setStatus(cat, status) {
    const is_visible = status !== 'hidden'
    await adminApi('category_update', { id: cat.id, patch: { status, is_visible } })
    onReload()
  }

  async function moveOrder(id, dir) {
    const cat = categories.find(c => c.id === id)
    const siblings = categories.filter(c => c.parent_id === cat.parent_id).sort((a,b) => a.sort_order - b.sort_order)
    const idx = siblings.findIndex(c => c.id === id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= siblings.length) return
    const a = siblings[idx], b = siblings[swapIdx]
    await adminApi('category_reorder', {
      id_a: a.id, id_b: b.id,
      sort_a: a.sort_order, sort_b: b.sort_order,
    })
    onReload()
  }

  function IconPickerDropdown({ value, onChange, which }) {
    if (iconOpen !== which) return null
    return (
      <div className="absolute z-50 rounded-2xl shadow-2xl" style={{ background:'#1E293B', border:'1px solid #334155', width:272, top:'110%', left:0 }}>
        <p className="text-xs font-bold px-3 pt-2 pb-1" style={{ color:'#94A3B8' }}>Pick icon</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, padding:'0 8px 10px' }}>
          {CATEGORY_ICONS.map(ic => (
            <button key={ic} type="button" onClick={() => { onChange(ic); setIconOpen(false) }}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
              style={{ background: value===ic?'#8B5CF6':'transparent', fontSize:18 }}>{ic}</button>
          ))}
        </div>
      </div>
    )
  }

  // ── Directory-style CatRow (Folder = main, File = sub) ──
  function CatRow({ cat, isChild, siblings, idx }) {
    const isEditing = editId === cat.id
    const subs = children(cat.id).sort((a,b) => a.sort_order - b.sort_order)
    const direct = countDirect(cat.id)
    const total  = countTotal(cat.id)
    const active = countActive(cat.id)
    const isOpen = !collapsed[cat.id]

    if (isEditing) return (
      <div className="mb-2 rounded-2xl overflow-hidden" style={{ border:'2px solid #8B5CF660', background:'#111827' }}>
        {/* Edit header */}
        <div className="flex items-center gap-2 px-4 py-3" style={{ background:'#8B5CF615', borderBottom:'1px solid #8B5CF630' }}>
          <span style={{ fontSize:16 }}>✏️</span>
          <span className="text-sm font-extrabold" style={{ color:'#C4B5FD' }}>Editing: {cat.name}</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-3 items-start">
            <CatImageUpload value={editData.image_url} onChange={v=>setEditData(d=>({...d,image_url:v}))} />
            <div className="flex-1 space-y-2">
              <div className="relative">
                <button type="button" onClick={()=>setIconOpen(iconOpen===`e${cat.id}`?false:`e${cat.id}`)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold w-full"
                  style={{ background:'#0F172A', border:'1px solid #334155', color:'#E2E8F0' }}>
                  <span style={{ fontSize:20 }}>{editData.icon}</span>
                  <span className="text-sm flex-1 text-left font-bold" style={{ color:'#E2E8F0' }}>Icon</span>
                  <span className="text-xs" style={{ color:'#64748B' }}>▼</span>
                </button>
                <IconPickerDropdown value={editData.icon} onChange={v=>setEditData(d=>({...d,icon:v}))} which={`e${cat.id}`} />
              </div>
              <input value={editData.name} onChange={e=>setEditData(d=>({...d,name:e.target.value}))} placeholder="Category name"
                style={{ background:'#0F172A', border:'1px solid #334155', color:'#E2E8F0', borderRadius:12, padding:'10px 14px', fontSize:14, width:'100%' }} />
            </div>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider mb-2" style={{ color:'#64748B' }}>Parent</p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={()=>setEditData(d=>({...d,parent_id:''}))}
                className="text-xs px-3 py-1.5 rounded-full font-bold"
                style={!editData.parent_id?{background:'#8B5CF6',color:'#fff'}:{background:'#1E293B',color:'#94A3B8',border:'1px solid #334155'}}>
                📂 Top Level
              </button>
              {parents.filter(p=>p.id!==cat.id).map(p=>(
                <button key={p.id} type="button" onClick={()=>setEditData(d=>({...d,parent_id:p.id}))}
                  className="text-xs px-3 py-1.5 rounded-full font-bold"
                  style={editData.parent_id===p.id?{background:'#8B5CF6',color:'#fff'}:{background:'#1E293B',color:'#94A3B8',border:'1px solid #334155'}}>
                  {p.icon} {p.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>saveEdit(cat.id)} className="flex-1 py-2.5 rounded-xl text-sm font-extrabold"
              style={{ background:'linear-gradient(135deg,#10B981,#059669)', color:'#fff' }}>
              {saving ? '⏳ Saving…' : '✅ Save'}
            </button>
            <button onClick={()=>setEditId(null)} className="flex-1 py-2.5 rounded-xl text-sm font-bold"
              style={{ background:'#1E293B', color:'#94A3B8', border:'1px solid #334155' }}>Cancel</button>
          </div>
          {/* Status & Visibility */}
          <div className="mt-3">
            <p className="text-xs font-extrabold uppercase tracking-wider mb-2" style={{ color:'#64748B' }}>Status & Visibility</p>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {[
                { val:'active',      label:'✅ Active',       bg:'#10B981', desc:'Shown in shop' },
                { val:'coming_soon', label:'🚀 Coming Soon',  bg:'#F59E0B', desc:'Teaser shown' },
                { val:'hidden',      label:'🙈 Hidden',       bg:'#EF4444', desc:'Not shown' },
              ].map(s=>(
                <button key={s.val} type="button" onClick={()=>setEditData(d=>({...d,status:s.val,is_visible:s.val!=='hidden'}))}
                  className="py-2 rounded-xl text-xs font-bold transition-all text-center"
                  style={editData.status===s.val
                    ?{background:s.bg,color:'#fff',boxShadow:`0 2px 8px ${s.bg}50`}
                    :{background:'#1E293B',color:'#64748B',border:'1px solid #334155'}}>
                  {s.label}<br/><span style={{ fontSize:9, opacity:0.7 }}>{s.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )

    if (isChild) return (
      <div style={{ marginBottom: 3, opacity: cat.is_visible===false ? 0.55 : 1 }}>
        <div className="flex items-center gap-0">
          <div style={{ width:20, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:4 }}>
            <div style={{ width:12, height:1, background:'#334155' }} />
          </div>
          <div className="flex-1 rounded-xl overflow-hidden" style={{ background:'#0F172A', border:'1px solid #1E2A3A' }}>
            {/* Top row: icon + name + actions */}
            <div className="flex items-center gap-2.5 px-3 py-2">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden"
                style={{ background:'#1E293B', border:'1px solid #334155' }}>
                {cat.image_url
                  ? <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                  : <span style={{ fontSize:16 }}>{cat.icon}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate" style={{ color:'#E2E8F0' }}>{cat.name}</p>
                <p className="text-xs" style={{ color: direct>0?'#A78BFA':'#475569' }}>{direct} product{direct!==1?'s':''}{active>0?` · ${active} active`:''}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={()=>moveOrder(cat.id,-1)} disabled={idx===0}
                  className="w-6 h-6 rounded-lg text-xs flex items-center justify-center"
                  style={{ background:'#1E293B', color:idx===0?'#1E2A3A':'#64748B' }}>↑</button>
                <button onClick={()=>moveOrder(cat.id,1)} disabled={idx===siblings.length-1}
                  className="w-6 h-6 rounded-lg text-xs flex items-center justify-center"
                  style={{ background:'#1E293B', color:idx===siblings.length-1?'#1E2A3A':'#64748B' }}>↓</button>
                <button onClick={()=>{setEditId(cat.id);setEditData({name:cat.name,icon:cat.icon,image_url:cat.image_url||'',parent_id:cat.parent_id||'',is_visible:cat.is_visible!==false,status:cat.status||'active'});setIconOpen(false)}}
                  className="w-6 h-6 rounded-lg text-xs flex items-center justify-center"
                  style={{ background:'#8B5CF625', color:'#A78BFA' }}>✏️</button>
                <button onClick={()=>deleteCategory(cat.id,cat.name)}
                  className="w-6 h-6 rounded-lg text-xs flex items-center justify-center"
                  style={{ background:'#EF444420', color:'#F87171' }}>🗑</button>
              </div>
            </div>
            {/* Status pills row — always visible */}
            <div className="flex items-center gap-1.5 px-3 pb-2">
              {[
                {val:'active',      label:'✅ Active',  bg:'#10B981', dim:'#10B98120'},
                {val:'coming_soon', label:'🚀 Soon',    bg:'#F59E0B', dim:'#F59E0B20'},
                {val:'hidden',      label:'🙈 Hidden',  bg:'#EF4444', dim:'#EF444420'},
              ].map(s => (
                <button key={s.val} type="button"
                  onClick={()=>setStatus(cat, s.val)}
                  className="px-2.5 py-1 rounded-full text-xs font-bold transition-all"
                  style={(cat.status||'active')===s.val
                    ?{background:s.bg, color:'#fff'}
                    :{background:s.dim, color:'#64748B', border:'1px solid transparent'}}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )

    // ── FOLDER style (main / parent category) ──
    return (
      <div className="mb-3" style={{ opacity: cat.is_visible===false ? 0.6 : 1 }}>
        {/* Folder header row */}
        <div className="flex items-stretch overflow-hidden rounded-2xl group"
          style={{ background:'#1a2235', border:'2px solid #1E2A45' }}>
          {/* Expand/collapse toggle */}
          <button onClick={()=>setCollapsed(c=>({...c,[cat.id]:!c[cat.id]}))}
            className="flex-shrink-0 flex items-center justify-center transition-all"
            style={{ width:36, background:'#8B5CF610', borderRight:'1px solid #8B5CF620', color:'#8B5CF6', fontSize:11, fontWeight:900 }}>
            {subs.length > 0 ? (isOpen ? '▾' : '▸') : ''}
          </button>

          {/* Folder icon */}
          <div className="flex-shrink-0 flex items-center justify-center"
            style={{ width:52, background:'#8B5CF610', borderRight:'1px solid #8B5CF615' }}>
            {cat.image_url
              ? <img src={cat.image_url} alt={cat.name} style={{ width:36, height:36, borderRadius:10, objectFit:'cover' }} />
              : <span style={{ fontSize:26 }}>{cat.icon}</span>}
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0 px-3 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold" style={{ color:'#F1F5F9', fontSize:15 }}>{cat.name}</span>
              {subs.length > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background:'#8B5CF625', color:'#C4B5FD', border:'1px solid #8B5CF630' }}>
                  📁 {subs.length} sub
                </span>
              )}
              {cat.image_url && <span style={{ fontSize:11, color:'#10B981' }}>📷</span>}
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="text-xs font-bold" style={{ color: total>0?'#A78BFA':'#475569' }}>
                {total} product{total!==1?'s':''}
                {subs.length > 0 && direct > 0 ? ` (${direct} direct)` : ''}
              </span>
              {active > 0 && <span className="text-xs font-semibold" style={{ color:'#34D399' }}>• {active} active</span>}
              {/* Status badge */}
              {cat.status === 'coming_soon' && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:'#F59E0B20', color:'#FCD34D', border:'1px solid #F59E0B40' }}>🚀 Coming Soon</span>
              )}
              {cat.is_visible === false && cat.status !== 'coming_soon' && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:'#EF444415', color:'#FCA5A5', border:'1px solid #EF444430' }}>🙈 Hidden</span>
              )}
              <span className="text-xs font-mono" style={{ color:'#334155' }}>/{cat.slug?.split('-').slice(0,-1).join('-')||cat.slug}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col justify-center gap-1 px-2 py-2 flex-shrink-0">
            {/* Status pills — always visible */}
            <div className="flex items-center gap-1">
              {[
                {val:'active',      label:'✅',  bg:'#10B981', title:'Active'},
                {val:'coming_soon', label:'🚀',  bg:'#F59E0B', title:'Coming Soon'},
                {val:'hidden',      label:'🙈',  bg:'#EF4444', title:'Hidden'},
              ].map(s => (
                <button key={s.val} type="button"
                  onClick={() => setStatus(cat, s.val)}
                  title={s.title}
                  className="w-7 h-7 rounded-xl text-xs flex items-center justify-center font-bold transition-all"
                  style={(cat.status||'active')===s.val
                    ?{background:s.bg, color:'#fff', boxShadow:`0 2px 6px ${s.bg}60`}
                    :{background:'#0F172A', color:'#475569', border:'1px solid #1E2A3A'}}>
                  {s.label}
                </button>
              ))}
            </div>
            {/* Move + edit + delete */}
            <div className="flex items-center gap-1">
              <button onClick={()=>moveOrder(cat.id,-1)} disabled={idx===0}
                className="w-7 h-7 rounded-xl text-xs flex items-center justify-center transition-all"
                style={{ background:'#0F172A', color:idx===0?'#1E2A3A':'#94A3B8', border:'1px solid #1E2A3A' }}>↑</button>
              <button onClick={()=>moveOrder(cat.id,1)} disabled={idx===siblings.length-1}
                className="w-7 h-7 rounded-xl text-xs flex items-center justify-center transition-all"
                style={{ background:'#0F172A', color:idx===siblings.length-1?'#1E2A3A':'#94A3B8', border:'1px solid #1E2A3A' }}>↓</button>
              <button onClick={()=>{setEditId(cat.id);setEditData({name:cat.name,icon:cat.icon,image_url:cat.image_url||'',parent_id:cat.parent_id||'',is_visible:cat.is_visible!==false,status:cat.status||'active'});setIconOpen(false)}}
                className="w-7 h-7 rounded-xl text-xs flex items-center justify-center transition-all"
                style={{ background:'#8B5CF625', color:'#C4B5FD', border:'1px solid #8B5CF635' }}>✏️</button>
              <button onClick={()=>deleteCategory(cat.id,cat.name)}
                className="w-7 h-7 rounded-xl text-xs flex items-center justify-center transition-all"
                style={{ background:'#EF444418', color:'#FCA5A5', border:'1px solid #EF444430' }}>🗑</button>
            </div>
          </div>
        </div>

        {/* Children (files inside folder) — shown when open */}
        {subs.length > 0 && isOpen && (
          <div className="mt-1 ml-4 pl-2" style={{ borderLeft:'2px solid #1E2A45' }}>
            {subs.map((sub,si)=>(
              <CatRow key={sub.id} cat={sub} isChild siblings={subs} idx={si} />
            ))}
            {/* Add sub-cat quick button */}
            <div className="flex items-center gap-0 mt-1">
              <div style={{ width:20, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:4 }}>
                <div style={{ width:12, height:1, background:'#334155' }} />
              </div>
              <button onClick={()=>{setNewCat(n=>({...n,parent_id:cat.id}));document.getElementById('new-cat-name')?.focus()}}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={{ background:'#8B5CF610', color:'#8B5CF6', border:'1px dashed #8B5CF640' }}>
                + Add sub-category under "{cat.name}"
              </button>
            </div>
          </div>
        )}

        {/* If folder is empty — quick add sub */}
        {subs.length === 0 && (
          <div className="mt-1 ml-4">
            <button onClick={()=>{setNewCat(n=>({...n,parent_id:cat.id}));document.getElementById('new-cat-name')?.focus()}}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={{ background:'transparent', color:'#475569', border:'1px dashed #334155' }}>
              + Add sub-category
            </button>
          </div>
        )}
      </div>
    )
  }

  const sortedParents = parents.sort((a,b) => a.sort_order - b.sort_order)
  const totalSubs = categories.filter(c=>c.parent_id).length

  return (
    <div className="px-3 pb-8 max-w-2xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 mt-1">
        <div>
          <h2 className="font-extrabold text-xl" style={{ color:'#F1F5F9' }}>📁 Categories</h2>
          <p className="text-xs mt-0.5" style={{ color:'#64748B' }}>
            {sortedParents.length} folders · {totalSubs} files · {totalProducts} products
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={()=>{
              const allCollapsed = sortedParents.every(p=>collapsed[p.id])
              const next = {}
              if (allCollapsed) { sortedParents.forEach(p=>{next[p.id]=false}) }
              else { sortedParents.forEach(p=>{next[p.id]=true}) }
              setCollapsed(next)
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={{ background:'#1E293B', color:'#94A3B8', border:'1px solid #334155' }}>
            {sortedParents.every(p=>collapsed[p.id]) ? '▸ Expand All' : '▾ Collapse All'}
          </button>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label:'Main Folders', val:sortedParents.length, color:'#8B5CF6', icon:'📂' },
          { label:'Sub Files',    val:totalSubs,             color:'#60A5FA', icon:'📄' },
          { label:'Products',     val:totalProducts,          color:'#34D399', icon:'📦' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-3 flex items-center gap-2.5"
            style={{ background:'#0F172A', border:`1px solid ${s.color}25` }}>
            <span style={{ fontSize:22 }}>{s.icon}</span>
            <div>
              <p className="text-xl font-black leading-none" style={{ color:s.color }}>{s.val}</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color:'#64748B' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>
      {uncategorised > 0 && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl"
          style={{ background:'#EF444415', border:'1px solid #EF444430' }}>
          <span style={{ fontSize:16 }}>⚠️</span>
          <span className="text-sm font-bold" style={{ color:'#FCA5A5' }}>
            {uncategorised} product{uncategorised!==1?'s':''} without a category
          </span>
        </div>
      )}

      {/* ── Add New Category form ── */}
      <div className="rounded-2xl p-4 mb-5" style={{ background:'#0F172A', border:'2px dashed #334155' }}>
        <p className="text-xs font-extrabold uppercase tracking-widest mb-4" style={{ color:'#64748B' }}>
          ➕ {newCat.parent_id ? `New file under "${parents.find(p=>p.id===newCat.parent_id)?.name||''}"` : 'New top-level folder'}
        </p>
        <div className="flex gap-3 mb-3 items-start">
          <CatImageUpload value={newCat.image_url} onChange={v=>setNewCat(n=>({...n,image_url:v}))} />
          <div className="flex-1 space-y-2">
            <div className="relative">
              <button type="button" onClick={()=>setIconOpen(iconOpen==='new'?false:'new')}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold w-full"
                style={{ background:'#1E293B', border:'1px solid #334155', color:'#E2E8F0' }}>
                <span style={{ fontSize:20 }}>{newCat.icon}</span>
                <span className="text-sm flex-1 text-left font-bold" style={{ color:'#E2E8F0' }}>Icon</span>
                <span className="text-xs" style={{ color:'#64748B' }}>▼</span>
              </button>
              {iconOpen==='new' && (
                <div className="absolute z-50 rounded-2xl shadow-2xl" style={{ background:'#1E293B', border:'1px solid #334155', width:272, top:'110%', left:0 }}>
                  <p className="text-xs font-bold px-3 pt-2 pb-1" style={{ color:'#94A3B8' }}>Pick icon</p>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, padding:'0 8px 10px' }}>
                    {CATEGORY_ICONS.map(ic=>(
                      <button key={ic} type="button" onClick={()=>{setNewCat(n=>({...n,icon:ic}));setIconOpen(false)}}
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background:newCat.icon===ic?'#8B5CF6':'transparent', fontSize:18 }}>{ic}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <input id="new-cat-name" value={newCat.name} onChange={e=>setNewCat(n=>({...n,name:e.target.value}))}
              onKeyDown={e=>e.key==='Enter'&&addCategory()} placeholder="e.g. Men's Fashion"
              style={{ background:'#1E293B', border:'1px solid #334155', color:'#E2E8F0', borderRadius:12, padding:'10px 14px', width:'100%', fontSize:14 }} />
          </div>
        </div>

        {/* Parent selector */}
        <div className="mb-4">
          <p className="text-xs font-extrabold uppercase tracking-wider mb-2" style={{ color:'#64748B' }}>
            Place inside folder <span className="font-normal normal-case" style={{ color:'#475569' }}>(or Top Level)</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={()=>setNewCat(n=>({...n,parent_id:''}))}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-bold transition-all"
              style={!newCat.parent_id
                ?{background:'#8B5CF6',color:'#fff',boxShadow:'0 2px 8px #8B5CF640'}
                :{background:'#1E293B',color:'#94A3B8',border:'1px solid #334155'}}>
              📂 Top Level
            </button>
            {parents.map(p=>{
              const isTop = !p.parent_id
              const parentName = !isTop ? categories.find(c=>c.id===p.parent_id)?.name : null
              return (
                <button key={p.id} type="button" onClick={()=>setNewCat(n=>({...n,parent_id:n.parent_id===p.id?'':p.id}))}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-bold transition-all"
                  style={newCat.parent_id===p.id
                    ?{background:'#8B5CF6',color:'#fff',boxShadow:'0 2px 8px #8B5CF640'}
                    :isTop
                      ?{background:'#1E293B',color:'#94A3B8',border:'1px solid #334155'}
                      :{background:'#0F172A',color:'#64748B',border:'1px dashed #334155',paddingLeft:16}}>
                  {!isTop && <span style={{opacity:0.4,marginRight:2}}>↳</span>}
                  {p.icon} {p.name}
                  {!isTop && <span style={{opacity:0.4,fontSize:9,marginLeft:2}}>({parentName})</span>}
                </button>
              )
            })}
          </div>
        </div>

        <button onClick={addCategory} disabled={saving || !newCat.name.trim()}
          className="w-full py-3 rounded-2xl text-sm font-extrabold transition-all"
          style={{
            background: newCat.name.trim() ? 'linear-gradient(135deg,#8B5CF6,#7C3AED)' : '#1E293B',
            color: newCat.name.trim() ? '#fff' : '#475569',
            boxShadow: newCat.name.trim() ? '0 4px 16px rgba(139,92,246,0.3)' : 'none'
          }}>
          {saving ? '⏳ Saving…'
            : newCat.parent_id
              ? `📄 Add under "${parents.find(p=>p.id===newCat.parent_id)?.name||''}"`
              : '📂 Create New Folder'}
        </button>
        {/* Status for new category */}
        <div className="mt-3">
          <p className="text-xs font-extrabold uppercase tracking-wider mb-2" style={{ color:'#64748B' }}>Initial Status</p>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { val:'active',      label:'✅ Active',      bg:'#10B981' },
              { val:'coming_soon', label:'🚀 Coming Soon', bg:'#F59E0B' },
              { val:'hidden',      label:'🙈 Hidden',      bg:'#EF4444' },
            ].map(s=>(
              <button key={s.val} type="button" onClick={()=>setNewCat(n=>({...n,status:s.val,is_visible:s.val!=='hidden'}))}
                className="py-2 rounded-xl text-xs font-bold transition-all"
                style={newCat.status===s.val
                  ?{background:s.bg,color:'#fff',boxShadow:`0 2px 8px ${s.bg}40`}
                  :{background:'#1E293B',color:'#64748B',border:'1px solid #334155'}}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Directory tree ── */}
      {categories.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-3">📂</div>
          <p className="text-sm font-bold" style={{ color:'#E2E8F0' }}>No categories yet</p>
          <p className="text-xs mt-1" style={{ color:'#475569' }}>Create your first folder above</p>
        </div>
      ) : (
        <div>
          {sortedParents.map((cat,idx)=>(
            <CatRow key={cat.id} cat={cat} isChild={false} siblings={sortedParents} idx={idx} />
          ))}
        </div>
      )}
    </div>
  )
}


export default CategoriesTab
