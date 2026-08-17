'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useCart } from '../context/CartContext'
import { supabase } from '../lib/supabase'
import ProductImage from './ProductImage'

// Checks live stock for all cart items, returns issues
export async function checkCartStock(cart) {
  if (!cart?.length) return []
  const ids = [...new Set(cart.map(i => i.id))]
  try {
    const { data } = await supabase
      .from('products')
      .select('id, name, stock, status, is_active')
      .in('id', ids)
    if (!data) return []

    const issues = []
    for (const item of cart) {
      const live = data.find(p => p.id === item.id)
      if (!live) continue
      const variantStock = item.selected_color?.stock ?? live.stock ?? 999
      const requested = item.quantity || 1

      if (!live.is_active || live.status === 'inactive') {
        issues.push({ type: 'unavailable', item, live, stockLeft: 0 })
      } else if (variantStock === 0 || live.status === 'out_of_stock') {
        issues.push({ type: 'oos', item, live, stockLeft: 0 })
      } else if (requested > variantStock) {
        issues.push({ type: 'over_qty', item, live, stockLeft: variantStock })
      }
    }
    return issues
  } catch { return [] }
}

export default function StockCheckPopup({ onResolved }) {
  const { cart, removeFromCart, updateQty } = useCart()
  const [issues, setIssues]     = useState([])
  const [checking, setChecking] = useState(false)
  const [shown, setShown]       = useState(false)

  const runCheck = useCallback(async () => {
    if (!cart?.length || checking) return
    setChecking(true)
    const found = await checkCartStock(cart)
    setChecking(false)
    if (found.length > 0) {
      setIssues(found)
      setShown(true)
    }
  }, [cart, checking])

  // Run on mount + every 8s while popup not shown (was 30s — a customer
  // sitting on checkout for a bit deserves a much faster answer than that
  // when someone else buys the last unit out from under them).
  useEffect(() => {
    runCheck()
    const t = setInterval(() => { if (!shown && document.visibilityState === 'visible') runCheck() }, 8000)
    // Also re-check the INSTANT they come back to this tab — the exact
    // moment a stale "in stock" would matter most (they stepped away,
    // someone else may have bought it in the meantime).
    function onVisible() { if (!shown && document.visibilityState === 'visible') runCheck() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, []) // eslint-disable-line

  // Re-check when cart changes (item added/removed)
  useEffect(() => {
    if (cart?.length > 0) runCheck()
  }, [cart?.length]) // eslint-disable-line

  function handleFix(issue, action) {
    const key = issue.item._cartKey || issue.item.id
    if (action === 'remove') {
      removeFromCart(key)
    } else if (action === 'reduce') {
      updateQty(key, issue.stockLeft)
    }
    const remaining = issues.filter(i => (i.item._cartKey || i.item.id) !== key)
    setIssues(remaining)
    if (remaining.length === 0) {
      setShown(false)
      onResolved?.()
    }
  }

  function handleFixAll() {
    for (const issue of issues) {
      const key = issue.item._cartKey || issue.item.id
      if (issue.stockLeft === 0 || issue.type === 'unavailable') {
        removeFromCart(key)
      } else {
        updateQty(key, issue.stockLeft)
      }
    }
    setIssues([])
    setShown(false)
    onResolved?.()
  }

  if (!shown || issues.length === 0) return null

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ width:'100%', maxWidth:520, background:'var(--viro-bg)', borderRadius:'20px 20px 0 0', padding:'0 0 env(safe-area-inset-bottom,16px)', maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
        {/* Handle */}
        <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 4px' }}>
          <div style={{ width:40, height:4, borderRadius:2, background:'var(--viro-border)' }} />
        </div>

        {/* Header */}
        <div style={{ padding:'8px 20px 12px', borderBottom:'1px solid var(--viro-border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:12, background:'#EF444415', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>⚠️</div>
            <div>
              <p style={{ margin:0, fontSize:16, fontWeight:900, color:'var(--viro-text)' }}>Stock Issue Detected</p>
              <p style={{ margin:0, fontSize:12, color:'var(--viro-textSub)' }}>{issues.length} item{issues.length>1?'s need':'s needs'} attention before checkout</p>
            </div>
          </div>
        </div>

        {/* Issues list */}
        <div style={{ flex:1, overflowY:'auto', padding:'12px 16px', display:'flex', flexDirection:'column', gap:10 }}>
          {issues.map((issue, idx) => {
            const isUnavail = issue.type === 'unavailable'
            const isOOS     = issue.type === 'oos'
            const isOver    = issue.type === 'over_qty'
            const color     = isUnavail ? '#7C3AED' : '#EF4444'
            const key       = issue.item._cartKey || issue.item.id

            return (
              <div key={key} style={{ borderRadius:14, background:'var(--viro-bgDeep)', border:`1.5px solid ${color}25`, overflow:'hidden' }}>
                {/* Top accent */}
                <div style={{ height:3, background:`linear-gradient(90deg,${color},${isUnavail?'#4F46E5':'#DC2626'})` }} />
                <div style={{ padding:'10px 12px' }}>
                  {/* Product name + badge */}
                  {/* Product image + badge row */}
                  <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:8 }}>
                    {/* Image */}
                    <div style={{ width:56, height:56, borderRadius:10, overflow:'hidden', flexShrink:0, position:'relative', border:`1.5px solid ${color}30`, background:'var(--viro-bgDeep)' }}>
                      <ProductImage
                        images={issue.item.selected_image ? [issue.item.selected_image, ...(Array.isArray(issue.item.images)?issue.item.images:[])] : issue.item.images}
                        alt={issue.item.name}
                        fill
                        style={{ objectFit:'cover' }}
                      />
                      {/* OOS overlay on image */}
                      <div style={{ position:'absolute', inset:0, background:`${color}70`, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:9 }}>
                        <span style={{ fontSize:9, fontWeight:900, color:'#fff', textAlign:'center', lineHeight:1.2 }}>
                          {isUnavail ? 'N/A' : isOOS ? 'OOS' : '⚠️'}
                        </span>
                      </div>
                    </div>
                    {/* Name + badge */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <span style={{ fontSize:11, fontWeight:700, color, padding:'2px 8px', borderRadius:6, background:`${color}15`, display:'inline-block', marginBottom:4 }}>
                        {isUnavail ? '🚫 Unavailable' : isOOS ? '⛔ Out of Stock' : '⚠️ Qty Exceeds Stock'}
                      </span>
                      <p style={{ margin:0, fontSize:13, fontWeight:700, color:'var(--viro-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{issue.item.name}</p>
                      {issue.item.selected_color_name && (
                        <p style={{ margin:'2px 0 0', fontSize:11, color:'var(--viro-textSub)' }}>{issue.item.selected_color_name}</p>
                      )}
                    </div>
                  </div>
                  {issue.item.selected_color_name && (
                    <p style={{ margin:'0 0 6px', fontSize:11, color:'var(--viro-textSub)' }}>Variant: {issue.item.selected_color_name}</p>
                  )}
                  <p style={{ margin:'0 0 10px', fontSize:11, color:'var(--viro-textSub)' }}>
                    {isUnavail && 'This product is no longer available in our store.'}
                    {isOOS && 'This item is currently out of stock.'}
                    {isOver && `You have ${issue.item.quantity} in cart but only ${issue.stockLeft} left in stock.`}
                  </p>

                  {/* Action buttons */}
                  <div style={{ display:'flex', gap:8 }}>
                    {isOver && issue.stockLeft > 0 && (
                      <button onClick={() => handleFix(issue, 'reduce')}
                        style={{ flex:1, padding:'9px', borderRadius:10, fontWeight:800, fontSize:12, border:'none', cursor:'pointer', color:'#fff', background:'linear-gradient(135deg,#10B981,#059669)' }}>
                        ✅ Keep {issue.stockLeft}
                      </button>
                    )}
                    <button onClick={() => handleFix(issue, 'remove')}
                      style={{ flex:1, padding:'9px', borderRadius:10, fontWeight:700, fontSize:12, cursor:'pointer',
                        background: isOver ? 'var(--viro-bgCard)' : `linear-gradient(135deg,${color},${isUnavail?'#4F46E5':'#DC2626'})`,
                        color: isOver ? 'var(--viro-text)' : '#fff',
                        border: isOver ? '1px solid var(--viro-border)' : 'none',
                      }}>
                      🗑 Remove
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Fix all + dismiss */}
        <div style={{ padding:'12px 16px', borderTop:'1px solid var(--viro-border)', display:'flex', flexDirection:'column', gap:8 }}>
          <button onClick={handleFixAll}
            style={{ padding:'14px', borderRadius:14, fontWeight:900, fontSize:14, border:'none', cursor:'pointer', color:'#fff', background:'linear-gradient(135deg,#7C3AED,#4F46E5)' }}>
            ✨ Fix All &amp; Continue
          </button>
          <button onClick={() => setShown(false)}
            style={{ padding:'10px', borderRadius:14, fontWeight:600, fontSize:12, cursor:'pointer', color:'var(--viro-textSub)', background:'transparent', border:'none' }}>
            Dismiss (will re-check on checkout)
          </button>
        </div>
      </div>
    </div>
  )
}
