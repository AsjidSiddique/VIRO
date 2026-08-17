'use client'
import React, { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useUserAuth } from '../../../context/UserAuthContext'
import { rpcAnon } from '../../../lib/authClient'
import AccountShell from '../../../components/AccountShell'

const STATUS_COLOR = { UNPAID:'#F97316',CONFIRMED:'#8B5CF6',PROCESSING:'#00BFFF',SHIPPED:'#3B82F6',DELIVERED:'#10B981',RETURNED:'#A855F7',CANCELLED:'#EF4444' }
const STATUS_ICON  = { UNPAID:'⏳',CONFIRMED:'✅',PROCESSING:'⚙️',SHIPPED:'🚚',DELIVERED:'📦',RETURNED:'↩️',CANCELLED:'❌' }

const FILTERS = [
  { key:'all',       label:'All'       },
  { key:'UNPAID',    label:'To Pay'    },
  { key:'CONFIRMED', label:'Confirmed' },
  { key:'SHIPPED',   label:'Shipping'  },
  { key:'DELIVERED', label:'Delivered' },
  { key:'CANCELLED', label:'Cancelled' },
]

function OrdersInner() {
  const { user, ready } = useUserAuth()
  const searchParams = useSearchParams()
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(false)
  const [filter,  setFilter]  = useState(() => searchParams.get('filter') || 'all')
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (!ready || !user) return
    setLoading(true); setError(false)
    rpcAnon('get_orders_by_email', { p_email: user.email })
      .then(d => setOrders(Array.isArray(d) ? d : []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [ready, user]) // eslint-disable-line

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  return (
    <AccountShell title="My Orders">
      {/* Filter tabs */}
      <div style={{ display:'flex', overflowX:'auto', gap:6, padding:'10px 12px', scrollbarWidth:'none', borderBottom:'1px solid var(--viro-border)', background:'var(--viro-bgCard)' }}>
        {FILTERS.map(f => {
          const count = f.key==='all' ? orders.length : orders.filter(o=>o.status===f.key).length
          return (
            <button key={f.key} onClick={()=>setFilter(f.key)}
              style={{ flexShrink:0, padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
                border:`1.5px solid ${filter===f.key?'#8B5CF6':'var(--viro-border)'}`,
                background: filter===f.key?'#8B5CF620':'transparent',
                color: filter===f.key?'#A78BFA':'var(--viro-textSub)' }}>
              {f.label} {count>0&&<span style={{ marginLeft:4, fontSize:10, fontWeight:900, padding:'1px 5px', borderRadius:10, background:filter===f.key?'#8B5CF6':'#94A3B830', color:filter===f.key?'#fff':'var(--viro-textSub)' }}>{count}</span>}
            </button>
          )
        })}
      </div>

      <div style={{ padding:'12px' }}>
        {loading ? (
          <div style={{ display:'flex',justifyContent:'center',padding:'48px 0' }}>
            <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="3" opacity="0.25"/>
              <path fill="#8B5CF6" d="M4 12a8 8 0 018-8v8z" opacity="0.75"/>
            </svg>
          </div>
        ) : error ? (
          <div style={{ textAlign:'center',padding:'40px 24px',borderRadius:16,background:'#EF444410',border:'1px solid #EF444430',margin:'16px 0' }}>
            <p style={{ fontSize:14,fontWeight:700,color:'#EF4444',margin:'0 0 8px' }}>⚠️ Could not load orders</p>
            <p style={{ fontSize:12,color:'var(--viro-textSub)',margin:0 }}>Run migration_google_auth_v4_NOSLUG.sql in Supabase</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center',padding:'48px 24px' }}>
            <div style={{ fontSize:52,marginBottom:12 }}>📭</div>
            <p style={{ fontWeight:700,color:'var(--viro-text)',margin:'0 0 6px' }}>No {filter==='all'?'':''+filter.toLowerCase()+' '}orders</p>
            <p style={{ fontSize:13,color:'var(--viro-textSub)',margin:'0 0 20px' }}>
              {filter==='all' ? 'Your orders will appear here' : `No orders with status "${filter}"`}
            </p>
            {filter==='all' && (
              <Link href="/shop" style={{ display:'inline-flex',alignItems:'center',gap:8,padding:'12px 28px',borderRadius:999,background:'linear-gradient(135deg,#6366f1,#8B5CF6)',color:'#fff',fontWeight:700,fontSize:13,textDecoration:'none' }}>
                🛒 Start Shopping
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
            {filtered.map(order => {
              const items = order.order_items || []
              const item  = items[0]
              const img   = (() => { try { const imgs = typeof item?.products?.images==='string'?JSON.parse(item.products.images):item?.products?.images; return Array.isArray(imgs)?imgs[0]:imgs } catch { return null } })()
              const count = items.reduce((s,i)=>s+(i.quantity||1),0)
              const sc    = STATUS_COLOR[order.status]||'#8B5CF6'
              return (
                <Link key={order.id} href="/orders"
                  style={{ display:'block',textDecoration:'none',borderRadius:16,border:`1.5px solid ${sc}25`,background:'var(--viro-bgCard)',overflow:'hidden' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:12,padding:'12px 14px' }}>
                    <div style={{ width:56,height:56,borderRadius:12,overflow:'hidden',flexShrink:0,background:'var(--viro-bgDeep)',display:'flex',alignItems:'center',justifyContent:'center' }}>
                      {img ? <img src={img} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/> : <span style={{ fontSize:22 }}>📦</span>}
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:3,flexWrap:'wrap' }}>
                        <span style={{ fontSize:10,fontWeight:800,fontFamily:'monospace',color:'var(--viro-textSub)' }}>#{(order.id||'').slice(0,8).toUpperCase()}</span>
                        <span style={{ fontSize:10,fontWeight:800,padding:'2px 7px',borderRadius:20,background:`${sc}18`,color:sc,border:`1px solid ${sc}30` }}>
                          {STATUS_ICON[order.status]} {order.status}
                        </span>
                        {/* Payment badge */}
                        {order.payment_method && order.payment_method !== 'COD' ? (
                          <span style={{ fontSize:9,fontWeight:800,padding:'2px 7px',borderRadius:20,
                            background: order.payment_status==='PAID' ? '#10B98118' : '#F9731618',
                            color: order.payment_status==='PAID' ? '#10B981' : '#F97316',
                            border: `1px solid ${order.payment_status==='PAID' ? '#10B98140' : '#F9731640'}` }}>
                            💳 {order.payment_method?.toUpperCase()} · {order.payment_status==='PAID' ? '✅ Paid' : '⏳ Pending'}
                          </span>
                        ) : (
                          <span style={{ fontSize:9,fontWeight:800,padding:'2px 7px',borderRadius:20,background:'#8B5CF618',color:'#A78BFA',border:'1px solid #8B5CF640' }}>
                            💵 {order.payment_status==='PAID' ? 'COD Paid' : 'COD'}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize:11,color:'var(--viro-textSub)',margin:'0 0 3px' }}>
                        {new Date(order.created_at).toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric'})} · {count} item{count!==1?'s':''}
                      </p>
                      <p style={{ fontSize:15,fontWeight:800,color:sc,margin:0 }}>Rs.{(order.final_total||0).toLocaleString()}</p>
                    </div>
                    <span style={{ color:'var(--viro-textSub)',fontSize:18,flexShrink:0 }}>›</span>
                  </div>
                  {items.length > 1 && (
                    <div style={{ padding:'0 14px 10px',display:'flex',gap:4,overflowX:'auto',scrollbarWidth:'none' }}>
                      {items.slice(0,5).map((it,idx) => {
                        const itImg = (() => { try { const imgs=typeof it.products?.images==='string'?JSON.parse(it.products.images):it.products?.images; return Array.isArray(imgs)?imgs[0]:imgs } catch { return null } })()
                        return (
                          <div key={idx} style={{ width:28,height:28,borderRadius:6,overflow:'hidden',flexShrink:0,background:'var(--viro-bgDeep)' }}>
                            {itImg ? <img src={itImg} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/> : <span style={{ fontSize:12 }}>📦</span>}
                          </div>
                        )
                      })}
                      {items.length > 5 && <div style={{ width:28,height:28,borderRadius:6,background:'var(--viro-bgDeep)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'var(--viro-textSub)',fontWeight:700 }}>+{items.length-5}</div>}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </AccountShell>
  )
}

export default function AccountOrdersClient() {
  return <Suspense fallback={<div/>}><OrdersInner/></Suspense>
}
