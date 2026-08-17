'use client'
import { slugify } from '../../lib/slugify'
import { supabase } from '../../lib/supabase'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ORDER_STATUS_META } from '../../lib/constants'
import { useSite } from '../../context/SiteSettingsContext'
import { useUserAuth } from '../../context/UserAuthContext'
import { rpcAnon } from '../../lib/authClient'
import GoogleSignInButton from '../../components/GoogleSignInButton'

import { LeaveReview } from '../../components/ProductReviews'

// ── BulkReview ─────────────────────────────────────────────────────────────
// Single "Rate Your Purchase" button → opens panel with:
//   • Checkbox tick per product (select which ones to review)
//   • "Select All" toggle at the top
//   • Star picker shown only for ticked products
//   • One submit button for all selected
function BulkReview({ order, items, customer }) {
  const [open,      setOpen]     = React.useState(false)
  const [ratings,   setRatings]  = React.useState({})    // { pid: 1-5 }
  const [selected,  setSelected] = React.useState({})    // { pid: true } = ticked
  const [done,      setDone]     = React.useState({})    // { pid: true } = already reviewed
  const [loading,   setLoading]  = React.useState(false)
  const [allDone,   setAllDone]  = React.useState(false)
  const [submitError, setSubmitError] = React.useState(false)
  const { autoApproveReviews } = useSite()

  const reviewable = items.filter(it => it.products?.id)
  const pending    = reviewable.filter(it => !done[it.products.id])

  // Check existing reviews on mount — via /api/review (PATCH), not a direct
  // supabase read: reviews' RLS only exposes status='approved' rows to
  // anon, so a customer's own still-pending review was invisible here,
  // making an already-submitted review look like it needed submitting
  // again after every refresh.
  React.useEffect(() => {
    if (!reviewable.length) return
    fetch('/api/review', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_ids: [order.id] }),
    })
      .then(r => r.json())
      .then(({ reviews }) => {
        if (!reviews?.length) return
        const ids = reviewable.map(it => it.products.id)
        const already = {}
        reviews.forEach(r => { if (ids.includes(r.product_id)) already[r.product_id] = true })
        setDone(already)
        if (Object.keys(already).length >= reviewable.length) setAllDone(true)
      })
      .catch(() => {})
  }, [order.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!reviewable.length) return null
  if (allDone) return (
    <div style={{ borderBottom:'1px solid var(--viro-border)', padding:'12px 16px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:12, background:'#10B98110', border:'1px solid #10B98130' }}>
        <span style={{fontSize:16}}>✅</span>
        <p style={{ fontSize:13, fontWeight:700, color:'#10B981', margin:0 }}>All products reviewed — thank you!</p>
      </div>
    </div>
  )

  // Select All toggle
  const allSelected  = pending.length > 0 && pending.every(it => selected[it.products.id])
  function toggleSelectAll() {
    if (allSelected) {
      setSelected({})
    } else {
      const all = {}
      pending.forEach(it => { all[it.products.id] = true })
      setSelected(all)
    }
  }

  // How many are selected AND have a rating
  const readyToSubmit = pending.filter(it => selected[it.products.id] && ratings[it.products.id])

  async function submitAll() {
    if (!readyToSubmit.length) return
    setLoading(true)
    setSubmitError(false)
    let anyFailed = false
    for (const item of readyToSubmit) {
      const pid = item.products.id
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          product_id: pid,
          rating: ratings[pid],
          customer_id: customer?.id || null,
          name: customer?.name || null,
        }),
      }).then(r => r.json()).catch(() => ({ ok: false }))
      if (!res.ok) { anyFailed = true; continue }
      setDone(d => ({ ...d, [pid]: true }))
      setSelected(s => { const n={...s}; delete n[pid]; return n })
    }
    setLoading(false)
    if (anyFailed) { setSubmitError(true); return }
    // check if all done now
    const remaining = pending.filter(it => !readyToSubmit.find(r => r.products.id === it.products.id))
    if (!remaining.length) { setAllDone(true); setOpen(false) }
  }

  const LABELS = ['','😞 Poor','😕 Fair','😐 OK','😊 Good','🤩 Excellent!']

  return (
    <div style={{ borderBottom:'1px solid var(--viro-border)' }}>

      {/* ── Collapsed button ── */}
      {!open && (
        <div style={{ padding:'10px 16px' }}>
          <button onClick={() => setOpen(true)} style={{
            width:'100%', padding:'11px 16px', borderRadius:14,
            border:'1.5px solid #FBBF2440',
            background:'linear-gradient(135deg,#FBBF2408,#F59E0B08)',
            cursor:'pointer', display:'flex', alignItems:'center', gap:10, textAlign:'left',
          }}>
            <span style={{fontSize:22}}>⭐</span>
            <div style={{flex:1}}>
              <p style={{ fontSize:13, fontWeight:800, color:'#FBBF24', margin:0 }}>Rate Your Purchase</p>
              <p style={{ fontSize:11, color:'var(--viro-textSub)', margin:0 }}>
                {pending.length} product{pending.length !== 1 ? 's' : ''} to review
              </p>
            </div>
            <span style={{ fontSize:18, color:'var(--viro-textSub)' }}>›</span>
          </button>
        </div>
      )}

      {/* ── Expanded panel ── */}
      {open && (
        <div style={{ padding:'12px 16px' }}>

          {/* Header row */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{fontSize:16}}>⭐</span>
              <p style={{ fontSize:13, fontWeight:800, color:'#FBBF24', margin:0 }}>Rate Your Purchase</p>
            </div>
            <button onClick={() => setOpen(false)}
              style={{ fontSize:17, color:'var(--viro-textSub)', background:'none', border:'none', cursor:'pointer', padding:'2px 6px' }}>✕</button>
          </div>

          {/* Friendly hint — why bother rating */}
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:10, background:'#FBBF2408', marginBottom:10 }}>
            <span style={{fontSize:14}}>💡</span>
            <p style={{ fontSize:11, color:'var(--viro-textSub)', margin:0, lineHeight:1.5 }}>
              Takes 10 seconds — your rating helps other shoppers decide, and helps us improve.
            </p>
          </div>

          {/* Select All row */}
          <button onClick={toggleSelectAll} style={{
            width:'100%', marginBottom:10, padding:'8px 12px',
            borderRadius:10, border:'1.5px solid ' + (allSelected ? '#8B5CF6' : 'var(--viro-border)'),
            background: allSelected ? '#8B5CF610' : 'var(--viro-bgDeep)',
            cursor:'pointer', display:'flex', alignItems:'center', gap:10, textAlign:'left',
          }}>
            {/* Checkbox */}
            <div style={{
              width:20, height:20, borderRadius:6, flexShrink:0,
              border:'2px solid ' + (allSelected ? '#8B5CF6' : 'var(--viro-border)'),
              background: allSelected ? '#8B5CF6' : 'transparent',
              display:'flex', alignItems:'center', justifyContent:'center',
              transition:'all 0.15s',
            }}>
              {allSelected && <span style={{ color:'#fff', fontSize:12, fontWeight:900, lineHeight:1 }}>✓</span>}
            </div>
            <span style={{ fontSize:12, fontWeight:700, color: allSelected ? '#8B5CF6' : 'var(--viro-textSub)' }}>
              {allSelected ? 'Deselect All' : 'Select All'} ({pending.length} products)
            </span>
          </button>

          {/* Product rows */}
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
            {reviewable.map(item => {
              const pid        = item.products.id
              const name       = item.products?.name || 'Product'
              const img        = parseImages(item.products?.images)[0] || null
              const isSelected = !!selected[pid]
              const starRating = ratings[pid] || 0
              const isDone     = !!done[pid]

              return (
                <div key={pid} style={{
                  borderRadius:12, overflow:'hidden',
                  border:'1.5px solid ' + (isDone ? '#10B98130' : isSelected ? '#8B5CF650' : 'var(--viro-border)'),
                  background: isDone ? '#10B98108' : isSelected ? '#8B5CF608' : 'var(--viro-bgDeep)',
                  transition:'all 0.15s',
                }}>
                  {/* Product row — tap to toggle selection */}
                  <div
                    onClick={() => { if (!isDone) setSelected(s => ({ ...s, [pid]: !s[pid] })) }}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', cursor: isDone ? 'default' : 'pointer' }}>

                    {/* Checkbox */}
                    <div style={{
                      width:20, height:20, borderRadius:6, flexShrink:0,
                      border:'2px solid ' + (isDone ? '#10B981' : isSelected ? '#8B5CF6' : 'var(--viro-border)'),
                      background: isDone ? '#10B981' : isSelected ? '#8B5CF6' : 'transparent',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'all 0.15s',
                    }}>
                      {(isDone || isSelected) && <span style={{ color:'#fff', fontSize:11, fontWeight:900, lineHeight:1 }}>✓</span>}
                    </div>

                    {/* Thumb — links to the product page (view/buy again), separate from the row's own tap-to-select */}
                    {img && (
                      <a href={`/product/${pid}`} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()} title="View product"
                        style={{ flexShrink:0, display:'block' }}>
                        <img src={img} alt={name} style={{ width:36, height:36, borderRadius:8, objectFit:'cover' }} />
                      </a>
                    )}

                    {/* Name */}
                    <p style={{ flex:1, fontSize:12, fontWeight:700, color: isDone ? '#10B981' : 'var(--viro-text)',
                      margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {name}
                      {isDone && <span style={{ fontSize:10, color:'#10B981', fontWeight:600, marginLeft:6 }}>✓ Reviewed</span>}
                    </p>
                  </div>

                  {/* Star row — only shows when selected and not done */}
                  {isSelected && !isDone && (
                    <div style={{ padding:'0 12px 10px 42px', display:'flex', alignItems:'center', gap:4 }}>
                      {[1,2,3,4,5].map(n => (
                        <span key={n}
                          onClick={e => { e.stopPropagation(); setRatings(r => ({ ...r, [pid]: n })) }}
                          style={{
                            fontSize:26, cursor:'pointer', userSelect:'none',
                            color: n <= starRating ? '#FBBF24' : '#D1D5DB',
                            transform: n <= starRating ? 'scale(1.1)' : 'scale(1)',
                            transition:'all 0.1s', display:'inline-block',
                          }}>★</span>
                      ))}
                      {starRating > 0 && (
                        <span style={{ fontSize:11, color:'#FBBF24', fontWeight:700, marginLeft:6 }}>
                          {LABELS[starRating]}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Submit button */}
          {submitError && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:12, background:'#EF444410', border:'1px solid #EF444430', marginBottom:10 }}>
              <span style={{fontSize:14}}>⚠️</span>
              <p style={{ fontSize:12, fontWeight:700, color:'#EF4444', margin:0 }}>Couldn't submit — please try again.</p>
            </div>
          )}
          <button onClick={submitAll} disabled={loading || readyToSubmit.length === 0} style={{
            width:'100%', padding:'13px 0', borderRadius:14, border:'none',
            background: readyToSubmit.length > 0 ? 'linear-gradient(135deg,#FBBF24,#F59E0B)' : 'var(--viro-bgDeep)',
            color: readyToSubmit.length > 0 ? '#1a1a1a' : 'var(--viro-textSub)',
            fontWeight:800, fontSize:14,
            cursor: readyToSubmit.length > 0 ? 'pointer' : 'not-allowed',
            boxShadow: readyToSubmit.length > 0 ? '0 4px 12px #FBBF2440' : 'none',
            transition:'all 0.2s',
            marginBottom:'env(safe-area-inset-bottom)',
          }}>
            {loading ? '⏳ Submitting…'
              : readyToSubmit.length === 0
                ? Object.keys(selected).length === 0 ? '☝️ Select products above' : 'Tap ★ stars to rate selected'
                : `⭐ Submit ${readyToSubmit.length} Review${readyToSubmit.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}
// ── end BulkReview ──────────────────────────────────────────────────────────

const PIPELINE = ['UNPAID','CONFIRMED','PROCESSING','SHIPPED','DELIVERED']

function getSavedUser() {
  try { return JSON.parse(localStorage.getItem('viro_user_info') || '{}') } catch { return {} }
}
function parseImages(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter(u => typeof u === 'string' && u.startsWith('http'))
  if (typeof raw === 'string') {
    if (raw.startsWith('http')) return [raw]
    try { const a = JSON.parse(raw); if (Array.isArray(a)) return a.filter(u => typeof u === 'string' && u.startsWith('http')) } catch {}
  }
  return []
}

// ── Pipeline tracker (used inside detail sheet) ──────────────────────────────
function OrderPipeline({ status }) {
  const isCancelled = status === 'CANCELLED'
  const currentIdx  = PIPELINE.indexOf(status)
  return (
    <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--viro-border)' }}>
      {isCancelled ? (
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20 }}>❌</span>
          <div>
            <p style={{ fontSize:13, fontWeight:700, color:'#EF4444', margin:0 }}>Order Cancelled</p>
            <p style={{ fontSize:11, color:'var(--viro-textSub)', margin:0 }}>{ORDER_STATUS_META.CANCELLED?.desc}</p>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display:'flex', alignItems:'center', marginBottom:8, overflowX:'auto', paddingBottom:4 }}>
            {PIPELINE.map((s, i) => {
              const meta = ORDER_STATUS_META[s]; const isActive = s===status; const isPast = currentIdx>i; const color = meta.color
              return (
                <React.Fragment key={s}>
                  {i>0 && <div style={{ flex:1, height:2, minWidth:8, margin:'0 2px', borderRadius:2, background: isPast?color:'var(--viro-border)', transition:'background 0.4s' }}/>}
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                    <div style={{
                      width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:13, border:`2px solid ${isActive||isPast?color:'var(--viro-border)'}`,
                      background: isActive?color+'25':isPast?color+'15':'var(--viro-bgDeep)',
                      boxShadow: isActive?`0 0 12px ${color}50`:'none',
                      transform: isActive?'scale(1.15)':'scale(1)', transition:'all 0.3s',
                    }}>
                      {isPast ? <span style={{color}}>✓</span> : <span style={{filter:isActive?'none':'grayscale(1)',opacity:isActive?1:0.4}}>{meta.icon}</span>}
                    </div>
                    <span style={{ fontSize:8, fontWeight:700, marginTop:2, whiteSpace:'nowrap', color:isActive?color:isPast?color+'99':'var(--viro-textSub)' }}>
                      {s==='UNPAID'?'Placed':s}
                    </span>
                  </div>
                </React.Fragment>
              )
            })}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:10, background:(ORDER_STATUS_META[status]?.color||'#94A3B8')+'12' }}>
            <span style={{fontSize:14}}>{ORDER_STATUS_META[status]?.icon}</span>
            <div>
              <p style={{ fontSize:11, fontWeight:700, color:ORDER_STATUS_META[status]?.color, margin:0 }}>{ORDER_STATUS_META[status]?.label}</p>
              <p style={{ fontSize:10, color:'var(--viro-textSub)', margin:0 }}>{ORDER_STATUS_META[status]?.desc}</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Dashboard stats bar ───────────────────────────────────────────────────────
function DashboardStats({ orders }) {
  const total    = orders.length
  const pending  = orders.filter(o => ['UNPAID','CONFIRMED','PROCESSING'].includes(o.status)).length
  const shipped  = orders.filter(o => o.status === 'SHIPPED').length
  const delivered= orders.filter(o => o.status === 'DELIVERED').length
  const totalSpend = orders.reduce((sum, o) => sum + (Number(o.final_total) || 0), 0)
  const pendingSpend = orders
    .filter(o => !['DELIVERED','CANCELLED'].includes(o.status))
    .reduce((sum, o) => sum + (Number(o.final_total) || 0), 0)

  const stats = [
    { label:'Total Orders',   value: total,                          icon:'📋', color:'#A78BFA' },
    { label:'Delivered',      value: delivered,                      icon:'✅', color:'#10B981' },
    { label:'In Progress',    value: pending + shipped,              icon:'🚚', color:'#F97316' },
    { label:'Total Spent',    value:`Rs.${totalSpend.toLocaleString()}`, icon:'💰', color:'#FBBF24' },
  ]

  return (
    <div style={{ padding:'16px', borderBottom:'1px solid var(--viro-border)', background:'var(--viro-bgDeep)' }}>
      <div style={{ maxWidth:720, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background:'var(--viro-bgCard)', borderRadius:14, padding:'10px 8px',
            textAlign:'center', border:'1px solid var(--viro-border)',
          }}>
            <div style={{ fontSize:20, marginBottom:4 }}>{s.icon}</div>
            <p style={{ fontSize:13, fontWeight:900, color:s.color, margin:'0 0 2px', lineHeight:1 }}>{s.value}</p>
            <p style={{ fontSize:9, color:'var(--viro-textSub)', margin:0, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em' }}>{s.label}</p>
          </div>
        ))}
      </div>
      {pendingSpend > 0 && (
        <div style={{ marginTop:10, padding:'8px 12px', borderRadius:10, background:'#F9731610', border:'1px solid #F9731630', textAlign:'center' }}>
          <span style={{ fontSize:12, fontWeight:700, color:'#F97316' }}>
            🚚 Rs.{pendingSpend.toLocaleString()} pending delivery
          </span>
        </div>
      )}
    </div>
  )
}

// ── Compact order card (shown in list) ────────────────────────────────────────
function OrderCard({ order, onClick }) {
  const meta   = ORDER_STATUS_META[order.status] || ORDER_STATUS_META.UNPAID
  const items  = order.order_items || []
  // Collect up to 3 product images for the stacked preview
  const thumbs = items.slice(0,3).map(item => parseImages(item.products?.images)[0]).filter(Boolean)
  const itemCount = items.reduce((s, i) => s + (i.quantity||1), 0)
  const date = new Date(order.created_at)
  const dateStr = date.toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' })

  return (
    <div onClick={onClick}
      style={{
        background:'var(--viro-bgCard)',
        border:'1px solid var(--viro-border)',
        borderLeft:`4px solid ${meta.color}`,
        borderRadius:16,
        padding:'14px 14px',
        cursor:'pointer',
        transition:'transform 0.15s, box-shadow 0.15s',
        display:'flex', alignItems:'center', gap:12,
        WebkitTapHighlightColor:'transparent',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow=`0 6px 24px ${meta.color}20` }}
      onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none' }}
    >
      {/* Stacked product thumbnails */}
      <div style={{ position:'relative', width:56, height:56, flexShrink:0 }}>
        {thumbs.length === 0 && (
          <div style={{ width:56, height:56, borderRadius:12, background:'linear-gradient(135deg,#6366f1,#a855f7)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>📦</div>
        )}
        {thumbs.slice(0,3).map((url, i) => (
          <div key={i} style={{
            position: i===0 ? 'relative' : 'absolute',
            top: i===0 ? 0 : i*4, left: i===0 ? 0 : i*4,
            width: 56-i*4, height: 56-i*4,
            borderRadius:10, overflow:'hidden',
            border:'2px solid var(--viro-bgCard)',
            boxShadow: i===0 ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
            zIndex: 3-i,
          }}>
            <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
          </div>
        ))}
        {itemCount > 1 && (
          <div style={{
            position:'absolute', bottom:-4, right:-4, zIndex:10,
            background: meta.color, color:'#fff',
            width:18, height:18, borderRadius:'50%',
            fontSize:9, fontWeight:900,
            display:'flex', alignItems:'center', justifyContent:'center',
            border:'2px solid var(--viro-bgCard)',
          }}>{itemCount}</div>
        )}
      </div>

      {/* Order info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
          <span style={{ fontSize:12, fontWeight:800, color:'var(--viro-text)', fontFamily:'monospace' }}>
            #{(order.id||'').slice(0,8).toUpperCase()}
          </span>
          <span style={{
            fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20,
            background:meta.color+'20', color:meta.color, border:`1px solid ${meta.color}40`,
          }}>{meta.icon} {meta.label}</span>
        </div>
        <p style={{ fontSize:11, color:'var(--viro-textSub)', margin:'0 0 4px' }}>{dateStr}</p>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:14, fontWeight:900, color:'#A78BFA' }}>
            Rs.{Number(order.final_total||0).toLocaleString()}
          </span>
          <span style={{ fontSize:10, color:'var(--viro-textSub)' }}>
            {itemCount} item{itemCount!==1?'s':''}
          </span>
          {/* Payment badge */}
          {order.payment_method && order.payment_method !== 'COD' ? (
            <span style={{ fontSize:9,fontWeight:800,padding:'2px 6px',borderRadius:20,
              background: order.payment_status==='PAID' ? '#10B98118' : '#F9731618',
              color: order.payment_status==='PAID' ? '#10B981' : '#F97316',
              border:`1px solid ${order.payment_status==='PAID'?'#10B98140':'#F9731640'}` }}>
              💳 {order.payment_status==='PAID' ? '✅ Paid' : '⏳ Pending Verification'}
            </span>
          ) : (
            <span style={{ fontSize:9,fontWeight:800,padding:'2px 6px',borderRadius:20,background:'#8B5CF618',color:'#A78BFA',border:'1px solid #8B5CF640' }}>
              💵 {order.payment_status==='PAID' ? 'COD Paid' : 'COD'}
            </span>
          )}
        </div>
      </div>

      {/* Chevron */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0, color:'var(--viro-textSub)', opacity:0.5 }}>
        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

// ── Full order detail bottom sheet ────────────────────────────────────────────
function OrderDetailSheet({ order, onClose, contact, onCancel }) {
  const meta     = ORDER_STATUS_META[order.status] || ORDER_STATUS_META.UNPAID
  const items    = order.order_items || []
  const customer = order.customers
  const isFree   = (order.delivery_charges || 0) === 0
  const router   = useRouter()

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position:'fixed', inset:0, zIndex:60,
        background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)',
      }}/>

      {/* Sheet */}
      <div style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:61,
        background:'var(--viro-bgCard)',
        borderRadius:'22px 22px 0 0',
        border:'1px solid var(--viro-border)',
        borderBottom:'none',
        boxShadow:'0 -12px 60px rgba(0,0,0,0.5)',
        maxHeight:'92vh',
        overflowY:'auto',
        animation:'orderSheetUp 0.3s cubic-bezier(0.34,1.2,0.64,1)',
      }}>
        {/* Handle */}
        <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 4px' }}>
          <div style={{ width:38, height:4, borderRadius:2, background:'var(--viro-border)' }}/>
        </div>

        {/* Sheet header */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'8px 16px 12px', borderBottom:'1px solid var(--viro-border)',
          background:'var(--viro-bgDeep)',
        }}>
          <div>
            <p style={{ fontSize:15, fontWeight:900, color:'var(--viro-text)', margin:'0 0 2px', fontFamily:'monospace' }}>
              #{(order.id||'').slice(0,8).toUpperCase()}
            </p>
            <p style={{ fontSize:11, color:'var(--viro-textSub)', margin:0 }}>
              {new Date(order.created_at).toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric'})}
              {' · '}
              {new Date(order.created_at).toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit'})}
            </p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:20, background:meta.color+'20', color:meta.color, border:`1px solid ${meta.color}40` }}>
              {meta.icon} {meta.label}
            </span>
            <button onClick={onClose} style={{
              width:30, height:30, borderRadius:'50%', border:'none', cursor:'pointer',
              background:'var(--viro-bgCard)', color:'var(--viro-textSub)',
              fontSize:16, display:'flex', alignItems:'center', justifyContent:'center',
            }}>✕</button>
          </div>
        </div>

        {/* Pipeline */}
        <OrderPipeline status={order.status}/>

        {/* Items */}
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--viro-border)' }}>
          <p style={{ fontSize:11, fontWeight:800, color:'var(--viro-textSub)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Items</p>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {items.map((item, i) => {
              const productId   = item.products?.id
              const productName = item.products?.name || 'Product'
              const thumb       = parseImages(item.products?.images)[0] || null
              return (
                <div key={i} onClick={() => productId && (router.push(`/product/${slugify(productName)}-${productId}`), onClose())}
                  style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
                  <div style={{ width:52, height:52, flexShrink:0, borderRadius:12, overflow:'hidden', border:'1px solid var(--viro-border)', background:'var(--viro-bgDeep)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {thumb
                      ? <img src={thumb} alt={productName} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                      : <div style={{ width:'100%', height:'100%', background:'linear-gradient(135deg,#6366f1,#a855f7)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:900, color:'#fff' }}>{productName.charAt(0)}</div>
                    }
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:13, fontWeight:600, color:'var(--viro-text)', margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{productName}</p>
                    <p style={{ fontSize:11, color:'var(--viro-textSub)', margin:0 }}>×{item.quantity}</p>
                  </div>
                  <span style={{ fontSize:13, fontWeight:800, color:'#A78BFA', flexShrink:0 }}>
                    Rs.{(item.price * item.quantity)?.toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Bill */}
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--viro-border)' }}>
          <p style={{ fontSize:11, fontWeight:800, color:'var(--viro-textSub)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Bill Breakdown</p>
          <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:13 }}>
            {(order.sale_discount||0)>0 && <>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color:'var(--viro-textSub)' }}>Original</span>
                <span style={{ color:'#64748b', textDecoration:'line-through' }}>Rs.{(order.original_subtotal||order.total_price)?.toLocaleString()}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color:'#F97316' }}>🏷️ Sale Discount</span>
                <span style={{ color:'#F97316', fontWeight:700 }}>−Rs.{order.sale_discount?.toLocaleString()}</span>
              </div>
            </>}
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ color:'var(--viro-textSub)' }}>Subtotal</span>
              <span style={{ color:'var(--viro-text)', fontWeight:600 }}>Rs.{(order.total_price||order.subtotal)?.toLocaleString()}</span>
            </div>
            {(order.coupon_discount||0)>0 && <>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color:'#10B981' }}>🎟️ Coupon {order.coupon_code?`(${order.coupon_code})`:''}</span>
                <span style={{ color:'#10B981', fontWeight:700 }}>−Rs.{order.coupon_discount?.toLocaleString()}</span>
              </div>
            </>}
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ color:'var(--viro-textSub)' }}>Delivery</span>
              <span style={{ fontWeight:600, color:isFree?'#10B981':'var(--viro-text)' }}>{isFree?'🎉 FREE':`Rs.${order.delivery_charges}`}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, paddingTop:8, borderTop:'1px solid var(--viro-border)' }}>
              <span style={{ color:'var(--viro-text)', fontSize:14 }}>Total Paid</span>
              <span style={{ color:'#7C3AED', fontSize:16 }}>Rs.{Number(order.final_total||0).toLocaleString()}</span>
            </div>
            {((order.sale_discount||0)+(order.coupon_discount||0))>0 && (
              <div style={{ textAlign:'center', padding:'6px', borderRadius:10, background:'#10B98115', color:'#10B981', fontSize:11, fontWeight:700, border:'1px solid #10B98130' }}>
                🎉 Saved Rs.{((order.sale_discount||0)+(order.coupon_discount||0)).toLocaleString()}
              </div>
            )}
          </div>
          <p style={{ fontSize:11, color:'var(--viro-textSub)', marginTop:8 }}>💵 Cash on Delivery</p>
        </div>

        {/* Delivery address */}
        {customer && (
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--viro-border)' }}>
            <p style={{ fontSize:11, fontWeight:800, color:'var(--viro-textSub)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Delivery To</p>
            <p style={{ fontSize:13, fontWeight:600, color:'var(--viro-text)', margin:'0 0 2px' }}>{customer.name}</p>
            <p style={{ fontSize:11, color:'var(--viro-textSub)', margin:0 }}>{customer.city} · {customer.address}</p>
          </div>
        )}

        {/* Review section — single "Rate All" button opens bulk inline panel */}
        {order.status === 'DELIVERED' && items.length > 0 && (
          <BulkReview
            order={order}
            items={items}
            customer={customer}
          />
        )}

        {/* Actions */}
        <div style={{ padding:'12px 16px', display:'flex', gap:8 }}>
          <a href={`https://wa.me/${contact?.whatsapp}?text=${encodeURIComponent(`Hi Viro! Order #${(order.id||'').slice(0,8).toUpperCase()} — status?`)}`}
            target="_blank" rel="noopener"
            style={{ flex:1, textAlign:'center', padding:'11px', borderRadius:12, fontSize:12, fontWeight:700, background:'#25D36615', color:'#25D366', border:'1px solid #25D36630', textDecoration:'none', display:'block' }}>
            💬 WhatsApp
          </a>
          <a href={`tel:+${contact?.whatsapp}`}
            style={{ flex:1, textAlign:'center', padding:'11px', borderRadius:12, fontSize:12, fontWeight:700, background:'#00BFFF15', color:'#00BFFF', border:'1px solid #00BFFF30', textDecoration:'none', display:'block' }}>
            📞 Call Us
          </a>
        </div>

        {/* Cancel */}
        {(order.status==='UNPAID'||order.status==='CONFIRMED') && (
          <div style={{ padding:'0 16px 32px' }}>
            <button onClick={() => onCancel(order.id, (order.id||'').slice(0,8).toUpperCase())}
              style={{ width:'100%', padding:'11px', borderRadius:12, border:'1px solid #EF444430', background:'#EF444410', color:'#EF4444', cursor:'pointer', fontSize:12, fontWeight:700 }}>
              ✕ Cancel Order
            </button>
            <p style={{ textAlign:'center', fontSize:11, color:'var(--viro-textSub)', marginTop:6 }}>Only possible before order is shipped</p>
          </div>
        )}
      </div>
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OrdersClient() {
  const { contact } = useSite()
  const { user, signIn, ready: authReady } = useUserAuth()
  const [orders,    setOrders]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [userName,  setUserName]  = useState('')
  const [hasUser,   setHasUser]   = useState(false)
  const [selected,  setSelected]  = useState(null)
  const [fetchError, setFetchError] = useState(false)

  const [reviewQueue, setReviewQueue] = useState([])
  const [reviewIdx,   setReviewIdx]   = useState(null)

  useEffect(() => {
    if (!authReady) return
    // Priority 1: Google auth user
    if (user?.email) {
      setHasUser(true)
      setUserName(user.name||user.email)
      fetchOrdersByEmail(user.email)
      return
    }
    // Not logged in with Google
    setHasUser(false)
    setLoading(false)
  }, [authReady, user]) // eslint-disable-line react-hooks/exhaustive-deps


  // Auto-refresh on empty orders — only retry if no error (just slow propagation)
  useEffect(() => {
    if (loading) return
    if (orders.length > 0) return
    if (fetchError) return  // don't retry on actual errors
    if (!user?.email) return
    let attempts = 0
    const MAX = 2  // reduced from 3
    const DELAYS = [2000, 4000]
    function retry() {
      if (attempts >= MAX) return
      const delay = DELAYS[attempts] || 4000
      attempts++
      setTimeout(() => {
        if (user?.email) fetchOrdersByEmail(user.email)
      }, delay)
    }
    retry()
  }, [loading, orders.length, fetchError]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchOrdersByEmail(email) {
    setLoading(true); setOrders([]); setFetchError(false)
    try {
      const data = await rpcAnon('get_orders_by_email', { p_email: email })
      let orders = data
      if (typeof data === 'string') { try { orders = JSON.parse(data) } catch { orders = [] } }
      setOrders(Array.isArray(orders) ? orders : [])
    } catch {
      setOrders([])
      setFetchError(true)  // stop retry loop on real errors
    }
    setLoading(false)
  }

  async function fetchOrders(phone) {
    setLoading(true); setOrders([])
    try {
      const raw = phone.trim().replace(/\s+/g, '')
      let alt = raw
      if (raw.startsWith('0'))       alt = '92' + raw.slice(1)
      else if (raw.startsWith('92')) alt = '0'  + raw.slice(2)
      else if (raw.startsWith('+92'))alt = '0'  + raw.slice(3)
      const { data, error } = await supabase.rpc('get_orders_by_phone', { p_phone: raw, p_phone_alt: alt })
      if (error) { setOrders([]); setLoading(false); return }
      let orders = data
      if (typeof data === 'string') { try { orders = JSON.parse(data) } catch { orders = [] } }
      setOrders(Array.isArray(orders) ? orders : [])
    } catch { setOrders([]) }
    setLoading(false)
    try {
      const norm = phone.trim().startsWith('0') ? '92'+phone.trim().slice(1) : phone.trim()
      window.OneSignalDeferred?.push(os => { try { const r=os.User?.addTag('viro_phone',norm); if(r?.catch)r.catch(()=>{}) }catch{} })
    } catch {}
  }

  // Review queue
  useEffect(() => {
    if (loading||orders.length===0) return
    let snoozed=[]; try{snoozed=JSON.parse(sessionStorage.getItem('viro_review_snoozed')||'[]')}catch{}
    const candidates=[]
    for(const order of orders.filter(o=>o.status==='DELIVERED')){
      if(snoozed.includes(order.id))continue
      for(const item of (order.order_items||[])) if(item.products?.id) candidates.push({order,item})
    }
    if(!candidates.length)return
    const orderIds=[...new Set(candidates.map(c=>c.order.id))]
    fetch('/api/review',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({order_ids:orderIds})})
      .then(r=>r.json())
      .then(({reviews:ex})=>{
        const rev=new Set((ex||[]).filter(r=>r.status!=='rejected').map(r=>`${r.order_id}__${r.product_id}`))
        const q=candidates.filter(c=>!rev.has(`${c.order.id}__${c.item.products.id}`))
        if(q.length){setReviewQueue(q);setReviewIdx(0)}
      })
      .catch(()=>{})
  },[loading,orders])

  function snooze(){
    const cur=reviewQueue[reviewIdx]; if(!cur)return
    try{const s=JSON.parse(sessionStorage.getItem('viro_review_snoozed')||'[]');if(!s.includes(cur.order.id)){s.push(cur.order.id);sessionStorage.setItem('viro_review_snoozed',JSON.stringify(s))}}catch{}
    advance()
  }
  function advance(){ const n=reviewIdx+1; if(n<reviewQueue.length)setReviewIdx(n); else setReviewIdx(null) }

  async function cancelOrder(orderId, orderNum) {
    if (!window.confirm(`Cancel order #${orderNum}?\n\nThis cannot be undone.`)) return
    try {
      const { data, error } = await supabase.rpc('cancel_own_order', { p_order_id: orderId })
      if (error) throw error
      if (!data?.success) throw new Error(data?.message || 'Cannot cancel this order')
      setSelected(null)
      if (user?.email) fetchOrdersByEmail(user.email)
      window.open(`https://wa.me/${contact?.whatsapp}?text=${encodeURIComponent(`Hi Viro! Customer cancelled order #${orderNum}.`)}`, '_blank')
    } catch(err){ alert('Could not cancel: '+err.message) }
  }

  // ── Not logged in — Google login required ──────────────────────────────────
  if (!hasUser && !loading) return (
    <div style={{ minHeight:'100vh', background:'var(--viro-sectionBg)', paddingBottom:96 }}>
      {/* Hero */}
      <div style={{ background:'linear-gradient(160deg,#1e1b4b 0%,#0f172a 60%,#0c1628 100%)', padding:'52px 24px 44px', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute',top:-60,right:-60,width:220,height:220,borderRadius:'50%',background:'radial-gradient(circle,#8B5CF640,transparent 70%)',pointerEvents:'none' }}/>
        <div style={{ fontSize:64, marginBottom:14, position:'relative' }}>📦</div>
        <h1 style={{ fontSize:24, fontWeight:900, color:'#fff', margin:'0 0 8px', position:'relative' }}>Track Your Orders</h1>
        <p style={{ fontSize:14, color:'#94A3B8', margin:'0 0 6px', lineHeight:1.7, position:'relative' }}>
          Sign in with Google to see your complete<br/>order history and live delivery status.
        </p>
        <p style={{ fontSize:11, color:'#475569', margin:'0 0 28px', position:'relative' }}>All past and future orders in one place</p>

        <div style={{ maxWidth:340, margin:'0 auto 20px', position:'relative' }}>
          <GoogleSignInButton onSignIn={() => signIn('/orders')} label="Sign in with Google to Track" size="md"/>
          <p style={{ fontSize:11, color:'#334155', marginTop:10 }}>One tap — no password needed</p>
        </div>
      </div>

      {/* Features */}
      <div style={{ padding:'20px', maxWidth:400, margin:'0 auto' }}>
        {[
          { icon:'🔴', title:'Live Status',       desc:'Pending → Confirmed → Shipped → Delivered' },
          { icon:'📋', title:'Full History',      desc:'Every order you have ever placed, all in one place' },
          { icon:'📱', title:'Any Device',        desc:'Sign in on any phone and see all your orders' },
          { icon:'🔒', title:'No Password',       desc:'One tap Google login — fast and secure' },
        ].map(f => (
          <div key={f.title} style={{ display:'flex', alignItems:'center', gap:14, padding:'13px', marginBottom:8, borderRadius:16, background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)' }}>
            <div style={{ fontSize:24, width:44, height:44, borderRadius:12, background:'var(--viro-bgDeep)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{f.icon}</div>
            <div>
              <p style={{ fontSize:13, fontWeight:700, color:'var(--viro-text)', margin:'0 0 1px' }}>{f.title}</p>
              <p style={{ fontSize:12, color:'var(--viro-textSub)', margin:0 }}>{f.desc}</p>
            </div>
          </div>
        ))}

        <div style={{ textAlign:'center', marginTop:20 }}>
          <p style={{ fontSize:13, color:'var(--viro-textSub)', margin:'0 0 12px' }}>No orders yet?</p>
          <Link href="/shop" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'13px 32px', borderRadius:999, background:'linear-gradient(135deg,#6366f1,#8B5CF6)', color:'#fff', fontWeight:700, fontSize:14, textDecoration:'none', boxShadow:'0 6px 20px rgba(99,102,241,0.4)' }}>
            🛒 Start Shopping
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes orderSheetUp { from{opacity:0;transform:translateY(80px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{ minHeight:'100vh', background:'var(--viro-sectionBg)', paddingBottom:96 }}>

        {/* Header */}
        <div style={{ padding:'14px 16px 12px', borderBottom:'1px solid var(--viro-border)', background:'var(--viro-bgCard)' }}>
          <div style={{ maxWidth:720, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <h1 style={{ fontSize:20, fontWeight:900, color:'var(--viro-text)', margin:'0 0 2px' }}>My Orders</h1>
              {userName
                ? <p style={{ fontSize:12, color:'var(--viro-textSub)', margin:0 }}>
                    Orders for <span style={{color:'#A78BFA',fontWeight:700}}>{userName}</span>
                    {user?.email && <span style={{ marginLeft:6, fontSize:10, background:'#10B98115', color:'#10B981', border:'1px solid #10B98140', borderRadius:20, padding:'1px 6px', fontWeight:700 }}>🟢 Google</span>}
                  </p>
                : <p style={{ fontSize:12, color:'var(--viro-textSub)', margin:0 }}>Your order history</p>
              }
            </div>
            {/* Right side — settings gear or avatar */}
            {user?.email ? (
              <a href="/account" title="Account & Settings" style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', borderRadius:20, border:'1px solid #8B5CF630', background:'#8B5CF610', textDecoration:'none' }}>
                {user.avatar
                  ? <img src={user.avatar} alt="" style={{ width:30, height:30, borderRadius:'50%', border:'1.5px solid #8B5CF6', display:'block' }}/>
                  : <div style={{ width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg,#8B5CF6,#6366f1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, color:'#fff' }}>
                      {(user.name||user.email||'U')[0].toUpperCase()}
                    </div>
                }
                <span style={{ fontSize:16 }}>⚙️</span>
              </a>
            ) : null}
          </div>
        </div>

        {loading && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'60px 0', gap:12, maxWidth:720, margin:'0 auto' }}>
            <svg className="animate-spin" width="32" height="32" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="3" opacity="0.25"/>
              <path fill="#8B5CF6" d="M4 12a8 8 0 018-8v8z" opacity="0.75"/>
            </svg>
            <p style={{ fontSize:13, color:'var(--viro-textSub)' }}>Loading your orders…</p>
          </div>
        )}

        {!loading && fetchError && user?.email && (
          <div style={{ margin:'24px auto', maxWidth:720, padding:'16px', borderRadius:16, background:'#EF444410', border:'1px solid #EF444430', textAlign:'center' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>⚠️</div>
            <p style={{ fontSize:14, fontWeight:700, color:'#EF4444', margin:'0 0 6px' }}>Database setup needed</p>
            <p style={{ fontSize:12, color:'var(--viro-textSub)', margin:'0 0 12px', lineHeight:1.6 }}>
              The <code style={{ background:'#EF444420', padding:'1px 5px', borderRadius:4 }}>get_orders_by_email</code> function is missing.<br/>
              Run <strong>migration_google_auth.sql</strong> in Supabase SQL editor.
            </p>
            <button onClick={() => { setFetchError(false); fetchOrdersByEmail(user.email) }}
              style={{ padding:'8px 20px', borderRadius:20, border:'none', background:'#EF4444', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer' }}>
              Retry
            </button>
          </div>
        )}

        {!loading && !fetchError && orders.length === 0 && (
          <div style={{ textAlign:'center', padding:'56px 24px', maxWidth:720, margin:'0 auto' }}>
            <div style={{ fontSize:52, marginBottom:12 }}>📭</div>
            <p style={{ fontSize:16, fontWeight:700, color:'var(--viro-text)', margin:'0 0 8px' }}>No orders yet</p>
            <p style={{ fontSize:13, color:'var(--viro-textSub)', margin:'0 0 24px' }}>Your order history will appear here.</p>
            <Link href="/shop" style={{
              display:'inline-flex', alignItems:'center', gap:8, padding:'12px 28px', borderRadius:999,
              background:'linear-gradient(135deg,#6366f1,#8B5CF6,#F97316)', color:'#fff',
              fontWeight:700, fontSize:13, textDecoration:'none',
            }}>🛒 Start Shopping</Link>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <>
            {/* Stats dashboard */}
            <DashboardStats orders={orders}/>

            {/* Orders list */}
            <div style={{ padding:'14px 14px', maxWidth:720, margin:'0 auto', display:'flex', flexDirection:'column', gap:10 }}>
              {orders.map((order, idx) => (
                <div key={order.id||idx} style={{ animation:`fadeInUp 0.3s ease ${idx*50}ms both` }}>
                  <OrderCard order={order} onClick={() => setSelected(order)}/>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Detail sheet */}
      {selected && (
        <OrderDetailSheet
          order={selected}
          contact={contact}
          onClose={() => setSelected(null)}
          onCancel={cancelOrder}
        />
      )}

      {/* Review popup */}
      {reviewIdx !== null && reviewQueue[reviewIdx] && (() => {
        const {order, item} = reviewQueue[reviewIdx]
        const productId = item.products?.id
        const customer  = order.customers
        const remaining = reviewQueue.length - reviewIdx - 1
        return (
          <>
            <div onClick={snooze} style={{ position:'fixed', inset:0, zIndex:70, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }}/>
            <div style={{
              position:'fixed', bottom:0, left:0, right:0, zIndex:71,
              background:'var(--viro-bgCard)', borderRadius:'20px 20px 0 0',
              border:'1px solid var(--viro-border)', boxShadow:'0 -8px 40px rgba(0,0,0,0.5)',
              maxHeight:'90vh', overflowY:'auto',
              animation:'orderSheetUp 0.28s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
              <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 4px' }}>
                <div style={{ width:36, height:4, borderRadius:2, background:'var(--viro-border)' }}/>
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 16px 12px', borderBottom:'1px solid var(--viro-border)' }}>
                <div>
                  <p style={{ fontSize:14, fontWeight:800, color:'var(--viro-text)', margin:0 }}>⭐ Rate Your Purchase</p>
                  <p style={{ fontSize:11, color:'var(--viro-textSub)', margin:'2px 0 0' }}>
                    Order #{(order.id||'').slice(0,8).toUpperCase()}{remaining>0&&` · ${remaining} more`}
                  </p>
                </div>
                <button onClick={snooze} style={{ width:28, height:28, borderRadius:'50%', border:'none', cursor:'pointer', background:'var(--viro-bgDeep)', color:'var(--viro-textSub)', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
              </div>
              <div style={{ padding:'14px 16px 24px' }}>
                <LeaveReview
                  orderId={order.id} productId={productId}
                  productName={item.products?.name||'Product'}
                  productThumb={parseImages(item.products?.images)[0]||null}
                  customerId={customer?.id||null} reviewerName={customer?.name||null}
                  onSubmitted={advance}
                />
              </div>
              <div style={{ padding:'0 16px 32px' }}>
                <button onClick={snooze} style={{ width:'100%', padding:'11px', borderRadius:12, border:'1px solid var(--viro-border)', background:'transparent', cursor:'pointer', fontSize:13, fontWeight:600, color:'var(--viro-textSub)' }}>Maybe Later</button>
              </div>
            </div>
          </>
        )
      })()}
    </>
  )
}
