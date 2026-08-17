'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUserAuth } from '../../../context/UserAuthContext'
import { rpcAnon } from '../../../lib/authClient'
import { supabase } from '../../../lib/supabase'
import AccountShell from '../../../components/AccountShell'

export default function AccountReviewsClient() {
  const { user, ready } = useUserAuth()
  const [pending,   setPending]   = useState([])  // { order, item } to review
  const [done,      setDone]      = useState([])  // already reviewed
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState('pending')
  const [writing,   setWriting]   = useState(null)  // { order, item }
  const [rating,    setRating]    = useState(5)
  const [body,      setBody]      = useState('')
  const [submitting,setSubmitting]= useState(false)
  const [toast,     setToast]     = useState(null)

  useEffect(() => {
    if (!ready || !user) return
    load()
  }, [ready, user]) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const data = await rpcAnon('get_orders_by_email', { p_email: user.email })
      const ords = Array.isArray(data) ? data : []
      const delivered = ords.filter(o => o.status === 'DELIVERED')
      const candidates = []
      delivered.forEach(order => {
        (order.order_items || []).forEach(item => {
          if (item.products?.id) candidates.push({ order, item })
        })
      })
      if (candidates.length > 0) {
        const orderIds = [...new Set(candidates.map(c => c.order.id))]
        const existing = await fetch('/api/review', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_ids: orderIds }),
        }).then(r => r.json()).then(d => d.reviews || []).catch(() => [])
        const reviewed = new Map(existing.map(r => [r.product_id, r]))
        setPending(candidates.filter(c => !reviewed.has(c.item.products.id)))
        setDone(candidates.filter(c => reviewed.has(c.item.products.id)).map(c => ({ ...c, review: reviewed.get(c.item.products.id) })))
      }
    } catch {}
    setLoading(false)
  }

  async function submitReview() {
    if (!writing || !body.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id:   writing.order.id,
          product_id: writing.item.products.id,
          rating,
          comment: body.trim(),
          customer_id: user.id || null,
          name: user.name || user.email.split('@')[0],
        }),
      }).then(r => r.json())
      if (!res.ok) throw new Error(res.error || 'Failed to submit')
      flash('Review submitted! ✓ Awaiting approval.', true)
      setWriting(null); setRating(5); setBody('')
      load()
    } catch(e) { flash('Error: ' + e.message, false) }
    setSubmitting(false)
  }

  function flash(text, ok=true) { setToast({text,ok}); setTimeout(()=>setToast(null),4000) }

  function getImg(item) {
    try { const imgs = typeof item.products?.images==='string'?JSON.parse(item.products.images):item.products?.images; return Array.isArray(imgs)?imgs[0]:imgs } catch { return null }
  }

  return (
    <AccountShell title="My Reviews">
      {toast && (
        <div style={{ margin:'10px 16px 0',padding:'10px 16px',borderRadius:14,background:toast.ok?'#10B98115':'#EF444415',border:`1px solid ${toast.ok?'#10B98140':'#EF444440'}`,color:toast.ok?'#10B981':'#EF4444',fontSize:13,fontWeight:700 }}>
          {toast.ok?'✅':'❌'} {toast.text}
        </div>
      )}

      {/* Write review sheet */}
      {writing && (
        <div onClick={()=>{setWriting(null);setBody('');setRating(5)}}
          style={{ position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'flex-end' }}>
          <div onClick={e=>e.stopPropagation()}
            style={{ width:'100%',background:'var(--viro-bgCard)',borderRadius:'20px 20px 0 0',padding:'20px 16px 40px',maxHeight:'85vh',overflowY:'auto' }}>
            <div style={{ width:40,height:4,borderRadius:2,background:'var(--viro-border)',margin:'0 auto 16px' }}/>
            <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:16 }}>
              <div style={{ width:48,height:48,borderRadius:12,overflow:'hidden',background:'var(--viro-bgDeep)',flexShrink:0 }}>
                {getImg(writing.item) ? <img src={getImg(writing.item)} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/> : <span style={{ fontSize:22 }}>📦</span>}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:14,fontWeight:700,color:'var(--viro-text)',margin:'0 0 2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{writing.item.products?.name}</p>
                <p style={{ fontSize:11,color:'var(--viro-textSub)',margin:0 }}>Order #{(writing.order.id||'').slice(0,8).toUpperCase()}</p>
              </div>
              {/* BUGFIX: this modal previously had NO close button at all in
                  the header — only a "Cancel" button at the very bottom of a
                  scrollable sheet, and tapping the dark backdrop did nothing
                  either. Both fixed: X button here, and the backdrop onClick
                  above (stopped from bubbling by the inner div's own
                  onClick, so tapping the form itself doesn't close it). */}
              <button onClick={()=>{setWriting(null);setBody('');setRating(5)}}
                style={{ width:28,height:28,borderRadius:'50%',border:'none',cursor:'pointer',background:'var(--viro-bgDeep)',color:'var(--viro-textSub)',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>✕</button>
            </div>
            <p style={{ fontSize:12,fontWeight:700,color:'var(--viro-textSub)',margin:'0 0 8px',textTransform:'uppercase',letterSpacing:'0.05em' }}>Your Rating</p>
            <div style={{ display:'flex',gap:6,marginBottom:16 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={()=>setRating(n)} style={{ fontSize:28,background:'none',border:'none',cursor:'pointer',filter:n<=rating?'none':'grayscale(1) opacity(0.3)',transition:'all 0.1s' }}>⭐</button>
              ))}
              <span style={{ fontSize:13,fontWeight:700,color:'var(--viro-textSub)',alignSelf:'center',marginLeft:4 }}>{rating}/5</span>
            </div>
            <p style={{ fontSize:12,fontWeight:700,color:'var(--viro-textSub)',margin:'0 0 8px',textTransform:'uppercase',letterSpacing:'0.05em' }}>Your Review</p>
            <textarea value={body} onChange={e=>setBody(e.target.value)} rows={4}
              placeholder="Share your experience with this product…"
              style={{ width:'100%',padding:'12px 14px',borderRadius:14,border:'1px solid var(--viro-border)',background:'var(--viro-bgDeep)',color:'var(--viro-text)',fontSize:14,resize:'none' }}/>
            <div style={{ display:'flex',gap:10,marginTop:14 }}>
              <button onClick={submitReview} disabled={submitting||!body.trim()}
                style={{ flex:1,padding:'13px',borderRadius:14,border:'none',background:body.trim()?'linear-gradient(135deg,#8B5CF6,#6366f1)':'var(--viro-bgDeep)',color:body.trim()?'#fff':'var(--viro-textSub)',fontWeight:800,fontSize:14,cursor:body.trim()?'pointer':'not-allowed' }}>
                {submitting?'Submitting…':'Submit Review'}
              </button>
              <button onClick={()=>{setWriting(null);setBody('');setRating(5)}}
                style={{ flex:1,padding:'13px',borderRadius:14,border:'1px solid var(--viro-border)',background:'transparent',color:'var(--viro-textSub)',fontWeight:600,fontSize:14,cursor:'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display:'flex',borderBottom:'1px solid var(--viro-border)',background:'var(--viro-bgCard)',padding:'0 8px' }}>
        {[['pending','⭐ To Review',pending.length],['done','✅ Reviewed',done.length]].map(([k,l,c]) => (
          <button key={k} onClick={()=>setTab(k)} style={{
            flex:1,padding:'11px 4px',fontSize:12,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.05em',
            border:'none',borderBottom:`2.5px solid ${tab===k?'#8B5CF6':'transparent'}`,
            background:'transparent',cursor:'pointer',color:tab===k?'#A78BFA':'var(--viro-textSub)',
          }}>{l} {c>0&&<span style={{ marginLeft:4,fontSize:10,fontWeight:900,padding:'1px 5px',borderRadius:10,background:tab===k?'#8B5CF6':'#94A3B830',color:tab===k?'#fff':'var(--viro-textSub)' }}>{c}</span>}</button>
        ))}
      </div>

      <div style={{ padding:'14px' }}>
        {loading ? (
          <div style={{ display:'flex',justifyContent:'center',padding:'48px 0' }}>
            <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="3" opacity="0.25"/>
              <path fill="#8B5CF6" d="M4 12a8 8 0 018-8v8z" opacity="0.75"/>
            </svg>
          </div>
        ) : tab === 'pending' ? (
          pending.length === 0 ? (
            <div style={{ textAlign:'center',padding:'48px 24px' }}>
              <div style={{ fontSize:52,marginBottom:12 }}>🎉</div>
              <p style={{ fontWeight:700,color:'var(--viro-text)',margin:'0 0 6px' }}>All caught up!</p>
              <p style={{ fontSize:13,color:'var(--viro-textSub)',margin:0 }}>No pending reviews right now.</p>
            </div>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
              {pending.map(({order,item},i) => (
                <div key={i} style={{ borderRadius:16,border:'1px solid var(--viro-border)',background:'var(--viro-bgCard)',padding:'14px' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:12 }}>
                    <div style={{ width:52,height:52,borderRadius:12,overflow:'hidden',flexShrink:0,background:'var(--viro-bgDeep)' }}>
                      {getImg(item)?<img src={getImg(item)} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>:<span style={{ fontSize:22 }}>📦</span>}
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <p style={{ fontSize:14,fontWeight:700,color:'var(--viro-text)',margin:'0 0 3px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{item.products?.name}</p>
                      <p style={{ fontSize:11,color:'var(--viro-textSub)',margin:0 }}>Order #{(order.id||'').slice(0,8).toUpperCase()}</p>
                    </div>
                    <button onClick={()=>{setWriting({order,item});setRating(5);setBody('')}}
                      style={{ flexShrink:0,padding:'8px 14px',borderRadius:20,border:'none',background:'linear-gradient(135deg,#8B5CF6,#6366f1)',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer' }}>
                      ⭐ Rate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          done.length === 0 ? (
            <div style={{ textAlign:'center',padding:'48px 24px' }}>
              <div style={{ fontSize:52,marginBottom:12 }}>📝</div>
              <p style={{ fontWeight:700,color:'var(--viro-text)',margin:'0 0 6px' }}>No reviews yet</p>
              <p style={{ fontSize:13,color:'var(--viro-textSub)',margin:0 }}>Your submitted reviews will appear here.</p>
            </div>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
              {done.map(({item,review},i) => (
                <div key={i} style={{ borderRadius:16,border:'1px solid var(--viro-border)',background:'var(--viro-bgCard)',padding:'14px' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:10 }}>
                    <div style={{ width:44,height:44,borderRadius:10,overflow:'hidden',flexShrink:0,background:'var(--viro-bgDeep)' }}>
                      {getImg(item)?<img src={getImg(item)} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>:<span>📦</span>}
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <p style={{ fontSize:13,fontWeight:700,color:'var(--viro-text)',margin:'0 0 2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{item.products?.name}</p>
                      <div style={{ display:'flex',gap:1 }}>{[1,2,3,4,5].map(n=><span key={n} style={{ fontSize:13,filter:n<=(review.rating||5)?'none':'grayscale(1) opacity(0.3)' }}>⭐</span>)}</div>
                    </div>
                    <span style={{ fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:20,flexShrink:0,
                      background: review.status==='approved'?'#10B98115':review.status==='rejected'?'#EF444415':'#F59E0B15',
                      color: review.status==='approved'?'#10B981':review.status==='rejected'?'#EF4444':'#F59E0B',
                      border:`1px solid ${review.status==='approved'?'#10B98130':review.status==='rejected'?'#EF444430':'#F59E0B30'}` }}>
                      {review.status==='approved'?'✓ Published':review.status==='rejected'?'✗ Rejected':'⏳ Pending'}
                    </span>
                  </div>
                  {review.body && <p style={{ fontSize:13,color:'var(--viro-textSub)',margin:0,lineHeight:1.5,padding:'10px 12px',borderRadius:10,background:'var(--viro-bgDeep)' }}>{review.body}</p>}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </AccountShell>
  )
}
