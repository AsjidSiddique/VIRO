'use client'
/* ═══════════════════════════════════════════════════════════════════════════
   VariantPickerPopup.jsx  —  Viro Storefront
   Multi-variant picker: customer can add MULTIPLE colour+size combos
   to cart/order in a single popup session.

   Flow:
     1. Customer picks a colour (and/or size)
     2. Sets quantity for that combo
     3. Taps "+ Add This" → that combo appears in a "selections" list
     4. Repeat for other colours/sizes
     5. Taps "Place Order / Add to Cart" → all selections confirmed at once

   Props:
     product        – full product object
     onConfirm(sel) – called with array of { colorId, sizeId, color, size, qty }
     onClose()      – dismiss
     mode           – 'cart' | 'order'
   ═══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import Image from 'next/image'
import { useImageFallback } from '../lib/useImageFallback'

// Small wrapper so the quota-aware fallback hook can be used per-thumbnail
// inside .map() loops below — hooks can't be called in a loop directly.
function FillThumbImage({ src, alt, sizes, width = 80 }) {
  const { src: imgSrc, unoptimized, handleError } = useImageFallback(src, { width, quality: 75 })
  return <Image src={imgSrc} alt={alt || ''} fill style={{ objectFit:'cover' }} sizes={sizes} unoptimized={unoptimized} onError={handleError} />
}

export default function VariantPickerPopup({ product, onConfirm, onClose, mode = 'cart' }) {
  const [selectedColor, setSelectedColor] = useState(null)
  const [selectedSize,  setSelectedSize]  = useState(null)
  const [qty,           setQty]           = useState(1)
  const [visible,       setVisible]       = useState(false)
  // Multi-selections: array of { colorId, sizeId, color, size, qty, key }
  const [selections,    setSelections]    = useState([])
  const overlayRef = useRef(null)

  const autoHide = product?.auto_hide_oos === true
  const hasBoth  = product?.has_colors && product?.has_sizes
  const allColors = product?.colors || []
  const allSizes  = product?.sizes  || []

  const colors = autoHide
    ? allColors.filter(c => !hasBoth
        ? (c.stock ?? 0) > 0
        : allSizes.some(s => (product?.colorSizeMatrix?.[`${c.uid}:${s.uid}`] ?? 0) > 0))
    : allColors

  const sizes = autoHide
    ? allSizes.filter(s => !hasBoth
        ? (s.stock ?? 0) > 0
        : allColors.some(c => (product?.colorSizeMatrix?.[`${c.uid}:${s.uid}`] ?? 0) > 0))
    : allSizes

  // Pre-select first option on mount
  useEffect(() => {
    if (colors.length > 0) setSelectedColor(colors[0])
    if (sizes.length > 0)  setSelectedSize(sizes[0])
    requestAnimationFrame(() => setVisible(true))
  }, []) // eslint-disable-line

  // Reset qty when color/size changes
  useEffect(() => { setQty(q => Math.min(q, getStock() || 1) || 1) },
    [selectedColor, selectedSize]) // eslint-disable-line

  // ── Helpers ──────────────────────────────────────────────────────────────
  function getStock() {
    if (hasBoth && selectedColor && selectedSize)
      return product.colorSizeMatrix?.[`${selectedColor.uid}:${selectedSize.uid}`] ?? 0
    if (selectedColor) return selectedColor.stock ?? 0
    if (selectedSize)  return selectedSize.stock  ?? 0
    return product.stock ?? 0
  }

  function colorStock(c) {
    if (!hasBoth) return c.stock ?? 0
    if (!selectedSize) return c.stock ?? 0
    return product.colorSizeMatrix?.[`${c.uid}:${selectedSize.uid}`] ?? 0
  }

  function sizeStock(s) {
    if (!hasBoth) return s.stock ?? 0
    if (!selectedColor) return s.stock ?? 0
    return product.colorSizeMatrix?.[`${selectedColor.uid}:${s.uid}`] ?? 0
  }

  function isLight(hex) {
    if (!hex) return false
    const h = hex.replace('#', '')
    const [r, g, b] = [0,2,4].map(i => parseInt(h.slice(i, i+2), 16))
    return (r*299 + g*587 + b*114) / 1000 > 160
  }

  // Images for currently selected color
  const displayImages = (() => {
    if (selectedColor?.images?.length > 0) return selectedColor.images
    const imgs = product?.images
    if (!imgs) return []
    if (Array.isArray(imgs)) return imgs
    try { return JSON.parse(imgs) } catch { return [] }
  })()
  const currentImg = displayImages[0] || null
  const { src: currentImgSrc, unoptimized: currentImgUnoptimized, handleError: currentImgError } =
    useImageFallback(currentImg, { width: 64, quality: 75 })

  const stock      = getStock()
  const outOfStock = stock <= 0
  const lowStock   = !outOfStock && stock <= 5

  // Already-selected qty for current combo (to show remaining stock)
  function alreadySelectedQty() {
    return selections
      .filter(s =>
        (s.colorId || null) === (selectedColor?.uid || null) &&
        (s.sizeId  || null) === (selectedSize?.uid  || null)
      )
      .reduce((sum, s) => sum + s.qty, 0)
  }

  const remainingStock = stock - alreadySelectedQty()
  const canAdd = !outOfStock &&
    !(product.has_colors && !selectedColor) &&
    !(product.has_sizes  && !selectedSize) &&
    remainingStock > 0

  // ── Add current combo to selections list ─────────────────────────────────
  function addToSelections() {
    if (!canAdd) return
    const key = `${selectedColor?.uid || 'no-color'}:${selectedSize?.uid || 'no-size'}`
    setSelections(prev => {
      const existing = prev.find(s => s.key === key)
      if (existing) {
        // Increase qty of existing selection
        return prev.map(s => s.key === key
          ? { ...s, qty: Math.min(stock, s.qty + qty) }
          : s)
      }
      return [...prev, {
        key,
        colorId: selectedColor?.uid || null,
        sizeId:  selectedSize?.uid  || null,
        color:   selectedColor || null,
        size:    selectedSize  || null,
        qty,
      }]
    })
    // Reset qty, auto-advance to next color if available
    setQty(1)
    if (colors.length > 1) {
      const currIdx = colors.findIndex(c => c.uid === selectedColor?.uid)
      const nextColor = colors[(currIdx + 1) % colors.length]
      if (nextColor.uid !== selectedColor?.uid) setSelectedColor(nextColor)
    }
  }

  function removeSelection(key) {
    setSelections(prev => prev.filter(s => s.key !== key))
  }

  function updateSelectionQty(key, newQty) {
    setSelections(prev => prev.map(s => s.key === key ? { ...s, qty: Math.max(1, newQty) } : s))
  }

  // ── Dismiss ───────────────────────────────────────────────────────────────
  function dismiss() {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  // ── Confirm all selections ────────────────────────────────────────────────
  function handleConfirm() {
    if (selections.length === 0) {
      // No multi-selection yet — treat current picker as single selection
      if (outOfStock) return
      onConfirm([{
        colorId: selectedColor?.uid || null,
        sizeId:  selectedSize?.uid  || null,
        color:   selectedColor || null,
        size:    selectedSize  || null,
        qty,
        stock,
      }])
    } else {
      onConfirm(selections)
    }
    dismiss()
  }

  const totalItems = selections.reduce((s, x) => s + x.qty, 0)

  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  const hasVariants = product.has_colors || product.has_sizes

  const popup = (
    <>
      {/* Backdrop */}
      <div ref={overlayRef}
        onClick={e => { if (e.target === overlayRef.current) dismiss() }}
        style={{
          position:'fixed', inset:0, zIndex:9998,
          background: visible ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0)',
          backdropFilter: visible ? 'blur(4px)' : 'none',
          transition:'all 0.28s ease',
          display:'flex', alignItems:'flex-end', justifyContent:'center',
        }}>

        {/* Sheet */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose product options"
          style={{
          width:'100%', maxWidth:520,
          background:'#ffffff',
          borderRadius:'24px 24px 0 0',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition:'transform 0.3s cubic-bezier(0.34,1.1,0.64,1)',
          maxHeight:'92vh', overflowY:'auto',
          boxShadow:'0 -8px 40px rgba(0,0,0,0.25)',
        }}>

          {/* Handle */}
          <div style={{ display:'flex', justifyContent:'center', paddingTop:10, paddingBottom:4 }}>
            <div style={{ width:36, height:4, borderRadius:2, background:'#E2E8F0' }} />
          </div>

          {/* Close */}
          <button onClick={dismiss} aria-label="Close" style={{
            position:'absolute', top:14, right:14,
            width:30, height:30, borderRadius:15,
            background:'#F1F5F9', border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'#64748B', fontSize:14, fontWeight:700, zIndex:2,
          }}>✕</button>

          {/* Product header */}
          <div style={{ display:'flex', gap:12, padding:'4px 16px 14px', alignItems:'flex-start' }}>
            <div style={{
              width:64, height:64, borderRadius:12, overflow:'hidden', flexShrink:0,
              background:'#F8FAFC', border:'1.5px solid #E2E8F0', position:'relative',
            }}>
              {currentImg
                ? <Image src={currentImgSrc} alt={product.name} fill style={{ objectFit:'cover' }} sizes="64px" unoptimized={currentImgUnoptimized} onError={currentImgError} />
                : <div style={{ width:'100%', height:'100%', background:'#F1F5F9', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>📦</div>
              }
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ margin:'0 0 4px', fontWeight:800, fontSize:13, color:'#0F172A', lineHeight:1.3, paddingRight:30 }}>{product.name}</p>
              <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                <span style={{ color:'#7C3AED', fontWeight:900, fontSize:16 }}>
                  Rs.{(product.discount_price || product.price || 0).toLocaleString()}
                </span>
                {product.discount_price && (
                  <span style={{ color:'#94A3B8', textDecoration:'line-through', fontSize:12 }}>
                    Rs.{(product.price||0).toLocaleString()}
                  </span>
                )}
              </div>
              <div style={{
                display:'inline-flex', alignItems:'center', gap:4, marginTop:4,
                padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700,
                background: outOfStock ? '#FEE2E2' : lowStock ? '#FEF3C7' : '#DCFCE7',
                color:      outOfStock ? '#DC2626' : lowStock ? '#D97706' : '#16A34A',
              }}>
                {outOfStock ? '⛔ Out of Stock' : lowStock ? `⚠️ Only ${stock} left` : `✅ In Stock (${stock})`}
              </div>
            </div>
          </div>

          <div style={{ height:1, background:'#F1F5F9' }} />

          {/* ── SELECTIONS SUMMARY (shown when user has added combos) ── */}
          {selections.length > 0 && (
            <div style={{
              margin:'12px 16px 0',
              borderRadius:14, border:'1.5px solid #7C3AED30',
              background:'#F5F3FF', overflow:'hidden',
            }}>
              <div style={{ padding:'8px 12px', background:'#7C3AED', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:11, fontWeight:800, color:'#fff', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                  🛒 Your Selections — {totalItems} item{totalItems !== 1 ? 's' : ''}
                </span>
                <span style={{ fontSize:11, color:'#DDD6FE' }}>Tap × to remove</span>
              </div>
              <div style={{ padding:'8px 10px', display:'flex', flexDirection:'column', gap:6 }}>
                {selections.map(sel => {
                  const thumb = sel.color?.images?.[0] || displayImages[0] || null
                  return (
                    <div key={sel.key} style={{
                      display:'flex', alignItems:'center', gap:8,
                      padding:'6px 8px', borderRadius:10, background:'#fff',
                      border:'1px solid #E2E8F0',
                    }}>
                      {/* Thumb */}
                      <div style={{ width:36, height:36, borderRadius:8, overflow:'hidden', flexShrink:0, position:'relative', background:'#F1F5F9' }}>
                        {thumb
                          ? <FillThumbImage src={thumb} alt="" sizes="36px" width={36} />
                          : sel.color?.hex
                            ? <div style={{ width:'100%', height:'100%', background:sel.color.hex }} />
                            : <span style={{ fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>📦</span>
                        }
                      </div>
                      {/* Label */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ margin:0, fontSize:12, fontWeight:700, color:'#0F172A' }}>
                          {[sel.color?.label, sel.size?.label].filter(Boolean).join(' · ') || 'Default'}
                        </p>
                        <p style={{ margin:0, fontSize:10, color:'#7C3AED', fontWeight:700 }}>
                          Rs.{((product.discount_price || product.price || 0) * sel.qty).toLocaleString()}
                        </p>
                      </div>
                      {/* Qty adjuster */}
                      <div style={{ display:'flex', alignItems:'center', gap:4, border:'1px solid #E2E8F0', borderRadius:8, overflow:'hidden' }}>
                        <button onClick={() => updateSelectionQty(sel.key, sel.qty - 1)}
                          style={{ width:26, height:26, border:'none', background:'#F8FAFC', cursor:'pointer', fontSize:14, fontWeight:700, color:'#374151' }}>−</button>
                        <span style={{ minWidth:22, textAlign:'center', fontSize:12, fontWeight:800 }}>{sel.qty}</span>
                        <button onClick={() => updateSelectionQty(sel.key, sel.qty + 1)}
                          style={{ width:26, height:26, border:'none', background:'#7C3AED', cursor:'pointer', fontSize:14, fontWeight:700, color:'#fff' }}>+</button>
                      </div>
                      {/* Remove */}
                      <button onClick={() => removeSelection(sel.key)}
                        style={{ width:24, height:24, borderRadius:12, border:'none', background:'#FEE2E2', color:'#EF4444', cursor:'pointer', fontSize:13, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── ADD MORE / PICKER ── */}
          {hasVariants && (
            <div style={{ padding:'12px 16px 0' }}>
              <p style={{ margin:'0 0 2px', fontWeight:900, fontSize:12, color:'#0F172A', textTransform:'uppercase', letterSpacing:1 }}>
                {selections.length > 0 ? '➕ Add Another Colour / Size' : 'Choose Options'}
              </p>
            </div>
          )}

          {/* COLOUR PICKER */}
          {product.has_colors && colors.length > 0 && (
            <div style={{ padding:'10px 16px 0' }}>
              <p style={{ margin:'0 0 8px', fontSize:12, fontWeight:700, color:'#374151' }}>
                Colour: <span style={{ color:'#7C3AED', fontWeight:800 }}>{selectedColor?.label || 'Select'}</span>
              </p>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {colors.map(c => {
                  const cStock = colorStock(c)
                  const cOut   = cStock <= 0
                  const active = selectedColor?.uid === c.uid
                  const thumb  = c.images?.[0] || displayImages[0] || null
                  // How many already selected for this color
                  const alreadyQty = selections.filter(s => s.colorId === c.uid).reduce((s,x)=>s+x.qty,0)
                  return (
                    <button key={c.uid} type="button"
                      onClick={() => !cOut && setSelectedColor(c)}
                      title={`${c.label}${cOut ? ' — Out of Stock' : ` — ${cStock - alreadyQty} remaining`}`}
                      style={{
                        position:'relative', flexShrink:0,
                        cursor: cOut ? 'not-allowed' : 'pointer',
                        borderRadius:12, overflow:'hidden',
                        border: active ? '3px solid #7C3AED' : '2px solid #E2E8F0',
                        boxShadow: active ? '0 0 0 2px #7C3AED40' : 'none',
                        opacity: cOut ? 0.45 : 1,
                        transition:'all 0.18s',
                        width:54, height:54, background:'#F8FAFC',
                      }}>
                      {thumb
                        ? <FillThumbImage src={thumb} alt={c.label} sizes="54px" width={54} />
                        : <div style={{ width:'100%', height:'100%', background:c.hex||'#E2E8F0', display:'flex', alignItems:'flex-end', justifyContent:'center', paddingBottom:3 }}>
                            <span style={{ fontSize:8, fontWeight:700, color:isLight(c.hex)?'#1A1A1A':'#fff' }}>{c.label}</span>
                          </div>
                      }
                      {c.hex && <div style={{ position:'absolute', bottom:2, right:2, width:8, height:8, borderRadius:4, background:c.hex, border:'1px solid rgba(255,255,255,0.6)' }} />}
                      {cOut && (
                        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.5)' }}>
                          <span style={{ fontSize:16, color:'#EF4444', fontWeight:900 }}>✕</span>
                        </div>
                      )}
                      {/* Badge: already added count */}
                      {alreadyQty > 0 && (
                        <div style={{
                          position:'absolute', top:2, left:2,
                          background:'#7C3AED', color:'#fff',
                          fontSize:9, fontWeight:900, borderRadius:10,
                          padding:'1px 4px', minWidth:14, textAlign:'center',
                        }}>{alreadyQty}</div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* SIZE PICKER */}
          {product.has_sizes && sizes.length > 0 && (
            <div style={{ padding:'12px 16px 0' }}>
              <p style={{ margin:'0 0 8px', fontSize:12, fontWeight:700, color:'#374151' }}>
                Size: <span style={{ color:'#7C3AED', fontWeight:800 }}>{selectedSize?.label || 'Select'}</span>
              </p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {sizes.map(s => {
                  const sStock = sizeStock(s)
                  const sOut   = sStock <= 0
                  const active = selectedSize?.uid === s.uid
                  return (
                    <button key={s.uid} type="button"
                      onClick={() => !sOut && setSelectedSize(s)}
                      style={{
                        padding:'8px 16px', borderRadius:999,
                        cursor: sOut ? 'not-allowed' : 'pointer',
                        border: active ? '2.5px solid #7C3AED' : '1.5px solid #CBD5E1',
                        background: active ? '#7C3AED' : sOut ? '#F8FAFC' : '#fff',
                        color: active ? '#fff' : sOut ? '#CBD5E1' : '#374151',
                        fontWeight:700, fontSize:13,
                        opacity: sOut ? 0.6 : 1,
                        boxShadow: active ? '0 2px 10px #7C3AED40' : 'none',
                        transition:'all 0.15s',
                        textDecoration: sOut ? 'line-through' : 'none',
                      }}>{s.label}</button>
                  )
                })}
              </div>
            </div>
          )}

          {/* QUANTITY + ADD THIS COMBO */}
          <div style={{ padding:'12px 16px 0', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <span style={{ fontSize:12, fontWeight:700, color:'#374151' }}>Qty:</span>
            <div style={{ display:'flex', alignItems:'center', border:'1.5px solid #E2E8F0', borderRadius:12, overflow:'hidden' }}>
              <button type="button" onClick={() => setQty(q => Math.max(1, q-1))}
                style={{ width:36, height:36, border:'none', cursor:qty<=1?'not-allowed':'pointer', background:qty<=1?'#F8FAFC':'#F1F5F9', color:qty<=1?'#CBD5E1':'#374151', fontSize:18, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
              <span style={{ minWidth:36, textAlign:'center', fontWeight:800, fontSize:15, color:'#0F172A' }}>{qty}</span>
              <button type="button" onClick={() => setQty(q => Math.min(Math.max(remainingStock, 0), q+1))}
                style={{ width:36, height:36, border:'none', cursor:qty>=remainingStock?'not-allowed':'pointer', background:qty>=remainingStock?'#F8FAFC':'#7C3AED', color:qty>=remainingStock?'#CBD5E1':'#fff', fontSize:18, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
            </div>
            {remainingStock <= 10 && remainingStock > 0 && (
              <span style={{ fontSize:11, color:'#D97706', fontWeight:600 }}>{remainingStock} left</span>
            )}

            {/* "+ Add This" button — only show when there are variants */}
            {hasVariants && (
              <button type="button" onClick={addToSelections}
                disabled={!canAdd}
                style={{
                  flex:1, minWidth:120, padding:'10px 16px', borderRadius:12, border:'none',
                  cursor: canAdd ? 'pointer' : 'not-allowed',
                  background: canAdd ? 'linear-gradient(135deg,#10B981,#059669)' : '#F1F5F9',
                  color: canAdd ? '#fff' : '#94A3B8',
                  fontWeight:800, fontSize:13,
                  boxShadow: canAdd ? '0 3px 12px rgba(16,185,129,0.35)' : 'none',
                  transition:'all 0.18s',
                }}>
                {canAdd ? '➕ Add This' : '⛔ Out of Stock'}
              </button>
            )}
          </div>

          {/* Validation hint */}
          {(product.has_colors && !selectedColor) || (product.has_sizes && !selectedSize) ? (
            <p style={{ margin:'8px 16px 0', color:'#F97316', fontSize:11, fontWeight:700,
              padding:'8px', borderRadius:10, background:'#FFF7ED', textAlign:'center' }}>
              ⚠️ Please select {product.has_colors && !selectedColor ? 'a colour' : ''}{product.has_colors && !selectedColor && product.has_sizes && !selectedSize ? ' and ' : ''}{product.has_sizes && !selectedSize ? 'a size' : ''} to continue
            </p>
          ) : null}

          {/* ── CONFIRM ALL button ── */}
          <div style={{ padding:'14px 16px 28px' }}>
            <button type="button" onClick={handleConfirm}
              disabled={selections.length === 0 && (outOfStock || (product.has_colors && !selectedColor) || (product.has_sizes && !selectedSize))}
              style={{
                width:'100%', padding:'15px', borderRadius:16, border:'none',
                cursor:'pointer',
                fontWeight:800, fontSize:15,
                background: (selections.length === 0 && outOfStock)
                  ? '#F1F5F9'
                  : mode === 'order'
                    ? 'linear-gradient(135deg,#7C3AED,#5B21B6)'
                    : 'linear-gradient(135deg,#7C3AED,#EC4899)',
                color: (selections.length === 0 && outOfStock) ? '#94A3B8' : '#fff',
                boxShadow: (selections.length === 0 && outOfStock) ? 'none' : '0 4px 20px rgba(124,58,237,0.35)',
                transition:'all 0.18s',
              }}>
              {selections.length > 0
                ? mode === 'order'
                  ? `🛍️ Place Order — ${totalItems} item${totalItems!==1?'s':''}`
                  : `🛒 Add to Cart — ${totalItems} item${totalItems!==1?'s':''}`
                : outOfStock
                  ? '⛔ Out of Stock'
                  : mode === 'order' ? '🛍️ Place Order' : '🛒 Add to Cart'
              }
            </button>
          </div>
        </div>
      </div>
    </>
  )
  return ReactDOM.createPortal(popup, document.body)
}
