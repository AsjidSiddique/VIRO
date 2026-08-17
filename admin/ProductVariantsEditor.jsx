'use client'
import { deleteProductImage } from '../lib/storage'
/* ═══════════════════════════════════════════════════════════════════════════
   ProductVariantsEditor.jsx  —  Viro Admin
   Lets admin enable/configure size variants and/or colour variants for a
   product. Used inside the Add/Edit Product form in AdminDashboard.

   Props:
     form         – current product form state (has_sizes, has_colors,
                    sizes[], colors[], colorSizeMatrix{})
     setForm      – setter
     supabase     – supabase client (for existing product editing)
     editProduct  – the product being edited, or null for new
     ImageUploader – the ImageUploader component (for colour images)
   ═══════════════════════════════════════════════════════════════════════════ */

import React, { useState } from 'react'

// ── Colour swatch presets ──────────────────────────────────────────────────
const COLOR_PRESETS = [
  { label:'Black',      hex:'#1A1A1A' },
  { label:'White',      hex:'#F5F5F5' },
  { label:'Red',        hex:'#E53E3E' },
  { label:'Navy Blue',  hex:'#1A365D' },
  { label:'Sky Blue',   hex:'#63B3ED' },
  { label:'Green',      hex:'#38A169' },
  { label:'Olive',      hex:'#6B7280' },
  { label:'Pink',       hex:'#F687B3' },
  { label:'Purple',     hex:'#805AD5' },
  { label:'Orange',     hex:'#ED8936' },
  { label:'Yellow',     hex:'#ECC94B' },
  { label:'Brown',      hex:'#7B4C2A' },
  { label:'Beige',      hex:'#D4B896' },
  { label:'Grey',       hex:'#718096' },
  { label:'Gold',       hex:'#D69E2E' },
  { label:'Silver',     hex:'#A0AEC0' },
  { label:'Rose Gold',  hex:'#C6818A' },
  { label:'Maroon',     hex:'#7B2D3E' },
  { label:'Teal',       hex:'#2C7A7B' },
  { label:'Cream',      hex:'#FFFBEB' },
]

// ── Size presets ──────────────────────────────────────────────────────────
const SIZE_PRESETS_CLOTHES = ['XS','S','M','L','XL','XXL','XXXL']
const SIZE_PRESETS_SHOES   = ['36','37','38','39','40','41','42','43','44','45']
const SIZE_PRESETS_RINGS   = ['14','15','16','17','18','19','20','21','22']
const SIZE_PRESETS_FREE    = ['Free Size','One Size']

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export default function ProductVariantsEditor({ form, setForm, ImageUploader }) {
  const [colorTab, setColorTab] = useState(null)  // color uid being edited
  const [sizePresetGroup, setSizePresetGroup] = useState('clothes')

  // ── helpers ────────────────────────────────────────────────────────────
  function toggleSizes() {
    setForm(f => ({ ...f, has_sizes: !f.has_sizes,
      sizes: !f.has_sizes && (!f.sizes || f.sizes.length === 0)
        ? [{ uid: uid(), label: '', stock: 0 }]
        : f.sizes
    }))
  }

  function toggleColors() {
    setForm(f => ({ ...f, has_colors: !f.has_colors,
      colors: !f.has_colors && (!f.colors || f.colors.length === 0)
        ? [{ uid: uid(), label: '', hex: '', images: [], stock: 0 }]
        : f.colors
    }))
  }

  function addSize() {
    setForm(f => ({ ...f, sizes: [...(f.sizes||[]), { uid: uid(), label: '', stock: 0 }] }))
  }

  function updateSize(suid, key, val) {
    setForm(f => ({ ...f, sizes: f.sizes.map(s => s.uid === suid ? { ...s, [key]: val } : s) }))
  }

  function removeSize(suid) {
    // If this size has a DB id, delete from product_sizes immediately
    const sz = form.sizes.find(s => s.uid === suid)
    if (sz?.id) {
      import('../lib/supabase').then(({ supabase }) => {
        supabase.from('product_sizes').delete().eq('id', sz.id).then(() => {})
      }).catch(() => {})
    }
    setForm(f => ({ ...f, sizes: f.sizes.filter(s => s.uid !== suid) }))
  }

  function applyPresetSizes(arr) {
    setForm(f => ({
      ...f,
      sizes: arr.map(label => ({ uid: uid(), label, stock: 0 }))
    }))
  }

  function addColor(preset) {
    const c = { uid: uid(), label: preset?.label || '', hex: preset?.hex || '', images: [], stock: 0 }
    setForm(f => ({ ...f, colors: [...(f.colors||[]), c] }))
    setColorTab(c.uid)
  }

  function updateColor(cuid, key, val) {
    setForm(f => ({ ...f, colors: f.colors.map(c => c.uid === cuid ? { ...c, [key]: val } : c) }))
  }

  function removeColor(cuid) {
    // Delete all images for this colour from Supabase storage
    const col = form.colors.find(c => c.uid === cuid)
    if (col?.images?.length) {
      col.images
        .filter(u => u && u.startsWith('http'))
        .forEach(url => deleteProductImage(url).catch(() => {}))
    }
    // If this colour has a DB id (existing product), also delete from product_colors table
    if (col?.id && typeof window !== 'undefined') {
      // Fire-and-forget DB delete — the Edge Function handles cascade on save,
      // but we delete immediately so stale rows don't linger if the admin saves later
      import('../lib/supabase').then(({ supabase }) => {
        supabase.from('product_colors').delete().eq('id', col.id).then(() => {})
      }).catch(() => {})
    }
    setForm(f => ({ ...f, colors: f.colors.filter(c => c.uid !== cuid) }))
    if (colorTab === cuid) setColorTab(null)
  }

  // Matrix stock (color+size both enabled)
  function getMatrixStock(cuid, suid) {
    return form.colorSizeMatrix?.[`${cuid}:${suid}`] ?? 0
  }
  function setMatrixStock(cuid, suid, val) {
    setForm(f => ({
      ...f,
      colorSizeMatrix: { ...(f.colorSizeMatrix||{}), [`${cuid}:${suid}`]: parseInt(val)||0 }
    }))
  }

  const sizes  = form.sizes  || []
  const colors = form.colors || []

  const toggleBtnStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 16px', borderRadius: 14, cursor: 'pointer',
    fontWeight: 700, fontSize: 13, transition: 'all 0.2s',
    border: active ? '2px solid #8B5CF6' : '2px solid #334155',
    background: active ? 'linear-gradient(135deg,#8B5CF620,#8B5CF610)' : '#1E2A45',
    color: active ? '#C4B5FD' : '#64748B',
    boxShadow: active ? '0 2px 12px #8B5CF640' : 'none',
  })

  const _pill = (active, onClick, children) => (
    <button type="button" onClick={onClick}
      style={{
        padding:'4px 11px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer',
        transition:'all 0.15s',
        background: active ? '#8B5CF6' : '#1E2A45',
        color: active ? '#fff' : '#64748B',
        border: active ? '1px solid #8B5CF6' : '1px solid #334155',
      }}>
      {children}
    </button>
  )

  return (
    <div style={{ borderRadius:16, overflow:'hidden', border:'1px solid #334155', background:'#111827' }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ padding:'12px 16px', background:'#1E2A45', borderBottom:'1px solid #334155' }}>
        <p style={{ color:'#E2E8F0', fontWeight:800, fontSize:13, margin:0 }}>
          🎛️ Product Variants
        </p>
        <p style={{ color:'#64748B', fontSize:11, margin:'2px 0 0' }}>
          Enable sizes, colours, or both. Each can have its own stock &amp; images.
        </p>
      </div>

      {/* ── Toggle row ───────────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:10, padding:'14px 16px', flexWrap:'wrap' }}>
        <button type="button" onClick={toggleSizes} style={toggleBtnStyle(form.has_sizes)}>
          <span style={{ fontSize:18 }}>📏</span>
          <div style={{ textAlign:'left' }}>
            <div>Sizes</div>
            <div style={{ fontSize:10, fontWeight:400, color: form.has_sizes ? '#A78BFA' : '#475569' }}>
              {form.has_sizes ? `${sizes.length} size(s) set` : 'Click to enable'}
            </div>
          </div>
          <span style={{
            marginLeft:'auto', width:32, height:18, borderRadius:9,
            background: form.has_sizes ? '#8B5CF6' : '#334155',
            display:'flex', alignItems:'center',
            padding:'2px', transition:'all 0.2s',
          }}>
            <span style={{
              width:14, height:14, borderRadius:'50%', background:'#fff',
              marginLeft: form.has_sizes ? 14 : 0, transition:'margin 0.2s',
            }} />
          </span>
        </button>

        <button type="button" onClick={toggleColors} style={toggleBtnStyle(form.has_colors)}>
          <span style={{ fontSize:18 }}>🎨</span>
          <div style={{ textAlign:'left' }}>
            <div>Colours</div>
            <div style={{ fontSize:10, fontWeight:400, color: form.has_colors ? '#A78BFA' : '#475569' }}>
              {form.has_colors ? `${colors.length} colour(s) set` : 'Click to enable'}
            </div>
          </div>
          <span style={{
            marginLeft:'auto', width:32, height:18, borderRadius:9,
            background: form.has_colors ? '#8B5CF6' : '#334155',
            display:'flex', alignItems:'center',
            padding:'2px', transition:'all 0.2s',
          }}>
            <span style={{
              width:14, height:14, borderRadius:'50%', background:'#fff',
              marginLeft: form.has_colors ? 14 : 0, transition:'margin 0.2s',
            }} />
          </span>
        </button>
        {/* ── Auto-hide OOS toggle ─────────────────────────────────── */}
        <button type="button"
          onClick={() => setForm(f => ({ ...f, auto_hide_oos: !f.auto_hide_oos }))}
          style={toggleBtnStyle(form.auto_hide_oos)}
          title="When ON: out-of-stock colours/sizes are hidden from customers instead of shown as greyed-out">
          <span style={{ fontSize:18 }}>🙈</span>
          <div style={{ textAlign:'left' }}>
            <div>Auto-hide OOS</div>
            <div style={{ fontSize:10, fontWeight:400, color: form.auto_hide_oos ? '#A78BFA' : '#475569' }}>
              {form.auto_hide_oos ? 'OOS variants hidden from shop' : 'OOS variants shown (greyed out)'}
            </div>
          </div>
          <span style={{
            marginLeft:'auto', width:32, height:18, borderRadius:9,
            background: form.auto_hide_oos ? '#8B5CF6' : '#334155',
            display:'flex', alignItems:'center',
            padding:'2px', transition:'all 0.2s',
          }}>
            <span style={{
              width:14, height:14, borderRadius:'50%', background:'#fff',
              marginLeft: form.auto_hide_oos ? 14 : 0, transition:'margin 0.2s',
            }} />
          </span>
        </button>
      </div>

      {/* ══ SIZES PANEL ═══════════════════════════════════════════════════ */}
      {form.has_sizes && (
        <div style={{ borderTop:'1px solid #1E2A45', padding:'14px 16px', background:'#0F1624' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <p style={{ color:'#A78BFA', fontWeight:800, fontSize:12, margin:0 }}>📏 SIZE VARIANTS</p>
          </div>

          {/* Preset buttons */}
          <div style={{ marginBottom:10 }}>
            <p style={{ color:'#64748B', fontSize:10, fontWeight:700, marginBottom:6 }}>QUICK ADD PRESETS:</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:6 }}>
              {[
                { key:'clothes', label:'Clothes', arr: SIZE_PRESETS_CLOTHES },
                { key:'shoes',   label:'Shoes',   arr: SIZE_PRESETS_SHOES   },
                { key:'rings',   label:'Rings',   arr: SIZE_PRESETS_RINGS   },
                { key:'free',    label:'Free',    arr: SIZE_PRESETS_FREE    },
              ].map(g => (
                <button key={g.key} type="button"
                  onClick={() => { setSizePresetGroup(g.key); applyPresetSizes(g.arr) }}
                  style={{
                    padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer',
                    background: sizePresetGroup===g.key ? '#8B5CF6' : '#1E2A45',
                    color: sizePresetGroup===g.key ? '#fff' : '#94A3B8',
                    border: `1px solid ${sizePresetGroup===g.key ? '#8B5CF6' : '#334155'}`,
                  }}>
                  {g.label}
                </button>
              ))}
              <button type="button" onClick={() => setForm(f => ({ ...f, sizes: [] }))}
                style={{ padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                  cursor:'pointer', background:'#EF444415', color:'#F87171', border:'1px solid #EF444430' }}>
                🗑 Clear All
              </button>
            </div>
          </div>

          {/* Size rows */}
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {sizes.map((s, i) => (
              <div key={s.uid} style={{
                display:'flex', alignItems:'center', gap:8,
                background:'#1E2A45', borderRadius:12, padding:'8px 10px',
                border:'1px solid #334155',
              }}>
                <span style={{ color:'#64748B', fontSize:11, width:20, flexShrink:0 }}>#{i+1}</span>
                <input
                  value={s.label}
                  onChange={e => updateSize(s.uid, 'label', e.target.value)}
                  placeholder="Label (e.g. M or 16)"
                  style={{
                    flex:1, background:'#0F1624', border:'1px solid #334155',
                    borderRadius:8, padding:'6px 10px', color:'#E2E8F0',
                    fontSize:12, minWidth:0,
                  }}
                />
                <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                  <span style={{ color:'#64748B', fontSize:11 }}>Stock:</span>
                  <input
                    type="number" min="0"
                    value={s.stock}
                    onChange={e => updateSize(s.uid, 'stock', parseInt(e.target.value)||0)}
                    style={{
                      width:60, background:'#0F1624', border:'1px solid #334155',
                      borderRadius:8, padding:'6px 8px', color:'#10B981',
                      fontSize:12, textAlign:'center', fontWeight:700,
                    }}
                  />
                </div>
                <button type="button" onClick={() => removeSize(s.uid)}
                  style={{ color:'#EF4444', fontSize:16, background:'none', border:'none',
                    cursor:'pointer', padding:0, lineHeight:1, flexShrink:0 }}>
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button type="button" onClick={addSize}
            style={{
              marginTop:10, width:'100%', padding:'9px', borderRadius:12, fontSize:12,
              fontWeight:700, cursor:'pointer', border:'1.5px dashed #8B5CF680',
              background:'#8B5CF610', color:'#A78BFA',
            }}>
            + Add Size
          </button>
        </div>
      )}

      {/* ══ COLOURS PANEL ═════════════════════════════════════════════════ */}
      {form.has_colors && (
        <div style={{ borderTop:'1px solid #1E2A45', padding:'14px 16px', background:'#0F1624' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <p style={{ color:'#F97316', fontWeight:800, fontSize:12, margin:0 }}>🎨 COLOUR VARIANTS</p>
          </div>

          {/* Colour preset swatches */}
          <div style={{ marginBottom:12 }}>
            <p style={{ color:'#64748B', fontSize:10, fontWeight:700, marginBottom:6 }}>QUICK ADD:</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {COLOR_PRESETS.map(cp => (
                <button key={cp.label} type="button"
                  onClick={() => addColor(cp)}
                  title={cp.label}
                  style={{
                    display:'flex', alignItems:'center', gap:5,
                    padding:'4px 9px', borderRadius:20, fontSize:11, fontWeight:700,
                    cursor:'pointer', border:'1px solid #334155',
                    background:'#1E2A45', color:'#94A3B8', transition:'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = cp.hex}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#334155'}>
                  <span style={{ width:10, height:10, borderRadius:'50%',
                    background: cp.hex, border:'1px solid #ffffff30', flexShrink:0 }} />
                  {cp.label}
                </button>
              ))}
              <button type="button" onClick={() => addColor(null)}
                style={{ padding:'4px 9px', borderRadius:20, fontSize:11, fontWeight:700,
                  cursor:'pointer', background:'#8B5CF620', color:'#A78BFA',
                  border:'1px dashed #8B5CF680' }}>
                + Custom
              </button>
            </div>
          </div>

          {/* Colour accordion */}
          {colors.length === 0 && (
            <p style={{ color:'#475569', fontSize:12, textAlign:'center', padding:'16px 0' }}>
              No colours yet — tap a preset above to add one.
            </p>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {colors.map((c, i) => {
              const open = colorTab === c.uid
              return (
                <div key={c.uid} style={{
                  borderRadius:14, overflow:'hidden',
                  border: open ? '1.5px solid #F9731660' : '1px solid #334155',
                  background:'#1E2A45',
                }}>
                  {/* Colour header row */}
                  <div style={{
                    display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
                    cursor:'pointer', background: open ? '#F9731610' : 'transparent',
                  }}
                    onClick={() => setColorTab(open ? null : c.uid)}>
                    {/* Swatch */}
                    <div style={{
                      width:24, height:24, borderRadius:12, flexShrink:0,
                      background: c.hex || '#64748B',
                      border:'2px solid #ffffff20',
                    }} />
                    <span style={{ flex:1, color:'#E2E8F0', fontWeight:700, fontSize:13 }}>
                      {c.label || <span style={{ color:'#475569' }}>Colour #{i+1}</span>}
                    </span>
                    <span style={{ color:'#10B981', fontSize:11, fontWeight:700 }}>
                      {c.stock} in stock
                    </span>
                    {c.images?.length > 0 && (
                      <span style={{ color:'#64748B', fontSize:10 }}>
                        📷 {c.images.length}
                      </span>
                    )}
                    <span style={{ color:'#64748B', fontSize:14 }}>{open ? '▲' : '▼'}</span>
                    <button type="button" onClick={e => { e.stopPropagation(); removeColor(c.uid) }}
                      style={{ color:'#EF4444', fontSize:15, background:'none', border:'none',
                        cursor:'pointer', padding:'0 0 0 4px', lineHeight:1 }}>
                      ✕
                    </button>
                  </div>

                  {/* Expanded editor */}
                  {open && (
                    <div style={{ padding:'12px 14px', borderTop:'1px solid #334155' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                        <div>
                          <label style={{ color:'#94A3B8', fontSize:11, fontWeight:700, display:'block', marginBottom:4 }}>
                            Colour Name *
                          </label>
                          <input
                            value={c.label}
                            onChange={e => updateColor(c.uid, 'label', e.target.value)}
                            placeholder="e.g. Navy Blue"
                            style={{ width:'100%', background:'#0F1624', border:'1px solid #334155',
                              borderRadius:8, padding:'8px 10px', color:'#E2E8F0', fontSize:12 }}
                          />
                        </div>
                        <div>
                          <label style={{ color:'#94A3B8', fontSize:11, fontWeight:700, display:'block', marginBottom:4 }}>
                            Hex (swatch)
                          </label>
                          <div style={{ display:'flex', gap:6 }}>
                            <input type="color" value={c.hex || '#64748B'}
                              onChange={e => updateColor(c.uid, 'hex', e.target.value)}
                              style={{ width:36, height:36, borderRadius:8, border:'1px solid #334155',
                                padding:2, background:'#0F1624', cursor:'pointer', flexShrink:0 }} />
                            <input
                              value={c.hex}
                              onChange={e => updateColor(c.uid, 'hex', e.target.value)}
                              placeholder="#000000"
                              style={{ flex:1, background:'#0F1624', border:'1px solid #334155',
                                borderRadius:8, padding:'6px 8px', color:'#E2E8F0', fontSize:11,
                                fontFamily:'monospace', minWidth:0 }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Stock (only shown when NOT using size+color matrix) */}
                      {!form.has_sizes && (
                        <div style={{ marginBottom:12 }}>
                          <label style={{ color:'#94A3B8', fontSize:11, fontWeight:700, display:'block', marginBottom:4 }}>
                            Stock for this colour
                          </label>
                          <input type="number" min="0"
                            value={c.stock}
                            onChange={e => updateColor(c.uid, 'stock', parseInt(e.target.value)||0)}
                            placeholder="0"
                            style={{ width:100, background:'#0F1624', border:'1px solid #334155',
                              borderRadius:8, padding:'8px 10px', color:'#10B981',
                              fontSize:13, textAlign:'center', fontWeight:700 }}
                          />
                        </div>
                      )}

                      {/* Images for this colour */}
                      <div>
                        <label style={{ color:'#94A3B8', fontSize:11, fontWeight:700, display:'block', marginBottom:6 }}>
                          Images for this colour
                          <span style={{ color:'#475569', fontWeight:400, marginLeft:4 }}>
                            (customers see these when they pick {c.label || 'this colour'})
                          </span>
                        </label>
                        <ImageUploader
                          images={c.images || []}
                          onChange={imgs => updateColor(c.uid, 'images', imgs)}
                          bucket="products_img"
                          onRemoveUrl={(removedUrl, newImgs) => {
                            // Immediately update product_colors.images in DB
                            // so the removed image doesn't reappear on refresh
                            // before the admin hits Save.
                            // c.id exists only if this colour was already saved to DB.
                            if (!c.id) return
                            import('../lib/supabase').then(({ supabase }) => {
                              supabase
                                .from('product_colors')
                                .update({ images: newImgs })
                                .eq('id', c.id)
                                .then(({ error }) => {
                                  if (error) console.warn('[color img remove]', error.message)
                                })
                            }).catch(() => {})
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══ COLOR + SIZE MATRIX (both enabled) ═══════════════════════════ */}
      {form.has_sizes && form.has_colors && sizes.length > 0 && colors.length > 0 && (
        <div style={{ borderTop:'1px solid #1E2A45', padding:'14px 16px', background:'#080E1A' }}>
          <p style={{ color:'#FBBF24', fontWeight:800, fontSize:12, margin:'0 0 4px' }}>
            📊 STOCK MATRIX — Colour × Size
          </p>
          <p style={{ color:'#475569', fontSize:11, margin:'0 0 10px' }}>
            Set stock for each colour/size combination individually.
          </p>

          <div style={{ overflowX:'auto' }}>
            <table style={{ borderCollapse:'collapse', minWidth:'100%', fontSize:11 }}>
              <thead>
                <tr>
                  <th style={{ padding:'6px 10px', textAlign:'left', color:'#64748B',
                    background:'#1E2A45', borderRadius:'8px 0 0 0', whiteSpace:'nowrap' }}>
                    Colour ↓ / Size →
                  </th>
                  {sizes.map(s => (
                    <th key={s.uid} style={{ padding:'6px 8px', color:'#A78BFA',
                      background:'#1E2A45', textAlign:'center', whiteSpace:'nowrap',
                      borderLeft:'1px solid #334155' }}>
                      {s.label || '?'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {colors.map((c, ci) => (
                  <tr key={c.uid} style={{ background: ci%2===0 ? '#0F1624' : '#111827' }}>
                    <td style={{ padding:'6px 10px', display:'flex', alignItems:'center', gap:6,
                      borderTop:'1px solid #1E2A45', whiteSpace:'nowrap' }}>
                      <span style={{ width:12, height:12, borderRadius:6, flexShrink:0,
                        background: c.hex || '#64748B', border:'1px solid #ffffff20' }} />
                      <span style={{ color:'#E2E8F0', fontWeight:600 }}>{c.label || `Colour ${ci+1}`}</span>
                    </td>
                    {sizes.map(s => (
                      <td key={s.uid} style={{ padding:'4px 6px', textAlign:'center',
                        borderTop:'1px solid #1E2A45', borderLeft:'1px solid #1E2A45' }}>
                        <input type="number" min="0"
                          value={getMatrixStock(c.uid, s.uid)}
                          onChange={e => setMatrixStock(c.uid, s.uid, e.target.value)}
                          style={{ width:52, background:'#1E2A45', border:'1px solid #334155',
                            borderRadius:6, padding:'4px 6px', color:'#10B981',
                            fontSize:11, textAlign:'center', fontWeight:700 }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── no variants note ──────────────────────────────────────────────── */}
      {!form.has_sizes && !form.has_colors && (
        <div style={{ padding:'12px 16px 16px', textAlign:'center' }}>
          <p style={{ color:'#334155', fontSize:11 }}>
            No variants enabled — uses the main Stock field above.
          </p>
        </div>
      )}
    </div>
  )
}
