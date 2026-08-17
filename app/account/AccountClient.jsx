'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUserAuth } from '../../context/UserAuthContext'
import { rpcAnon } from '../../lib/authClient'
import AccountShell from '../../components/AccountShell'
import { useWishlist } from '../../context/WishlistContext'
import { supabase } from '../../lib/supabase'
import { getRecentlyViewed } from '../../lib/recentlyViewed'

const STATUS_COLOR = { UNPAID:'#F97316',CONFIRMED:'#8B5CF6',PROCESSING:'#00BFFF',SHIPPED:'#3B82F6',DELIVERED:'#10B981',RETURNED:'#A855F7',CANCELLED:'#EF4444' }
const STATUS_ICON  = { UNPAID:'⏳',CONFIRMED:'✅',PROCESSING:'⚙️',SHIPPED:'🚚',DELIVERED:'📦',RETURNED:'↩️',CANCELLED:'❌' }

export default function AccountClient() {
  const { user, ready } = useUserAuth()
  const { wishlist, wishlistCount } = useWishlist()
  const [orders,         setOrders]         = useState([])
  const [ordersLoad,     setOrdersLoad]     = useState(false)
  const [pendingReviews, setPendingReviews] = useState(0)
  const [priceDrops,     setPriceDrops]     = useState(0)
  const [recentCount,    setRecentCount]    = useState(0)
  const [partner,        setPartner]        = useState(null) // { status, influencer } | null while not a partner

  useEffect(() => {
    if (!ready || !user) return
    setRecentCount(getRecentlyViewed().length)
    loadOrders()
    // Best-effort — a non-partner or a failed lookup just means the card
    // below doesn't render at all, never blocks the rest of the account page.
    fetch('/api/influencer-dashboard', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email }),
    }).then(r => r.json()).then(data => {
      if (data?.status && data.status !== 'not_registered') setPartner(data)
    }).catch(() => {})
  }, [ready, user]) // eslint-disable-line

  // Check price drops on wishlist
  useEffect(() => {
    if (!wishlist.length) return
    async function checkDrops() {
      try {
        const { data } = await supabase.from('products').select('id,price,discount_price,sale_active,sale_ends_at').in('id', wishlist.map(i=>i.id))
        const now = new Date()
        let drops = 0
        ;(data||[]).forEach(p => {
          const saved = wishlist.find(w=>w.id===p.id)
          if (!saved) return
          const saleOk = p.discount_price&&p.discount_price<p.price&&p.sale_active&&(!p.sale_ends_at||new Date(p.sale_ends_at)>now)
          const cur  = saleOk ? p.discount_price : p.price
          const was  = saved.discount_price&&saved.sale_active ? saved.discount_price : saved.price
          if (cur < was) drops++
        })
        setPriceDrops(drops)
      } catch {}
    }
    checkDrops()
  }, [wishlist])

  async function loadOrders() {
    setOrdersLoad(true)
    try {
      const data = await rpcAnon('get_orders_by_email', { p_email: user.email })
      const ords = Array.isArray(data) ? data : []
      setOrders(ords)
      const delivered = ords.filter(o=>o.status==='DELIVERED')
      if (delivered.length > 0) {
        const pids = delivered.flatMap(o=>(o.order_items||[]).map(i=>i.products?.id)).filter(Boolean)
        if (pids.length) {
          // BUGFIX: reviews' RLS only exposes status='approved' rows to the
          // anon key — a customer's own still-pending review was invisible
          // to this direct query, so "pending reviews" kept counting items
          // that were actually already submitted (just not yet approved).
          const orderIds = delivered.map(o => o.id)
          const { reviews: ex } = await fetch('/api/review', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_ids: orderIds }),
          }).then(r => r.json()).catch(() => ({ reviews: [] }))
          const rev = new Set((ex||[]).map(r=>r.product_id))
          setPendingReviews(pids.filter(id=>!rev.has(id)).length)
        }
      }
    } catch {}
    setOrdersLoad(false)
  }

  const toShip     = orders.filter(o=>['UNPAID','CONFIRMED','PROCESSING'].includes(o.status)).length
  const toReceive  = orders.filter(o=>o.status==='SHIPPED').length
  const delivered  = orders.filter(o=>o.status==='DELIVERED').length
  const totalSpent = orders.filter(o=>o.status!=='CANCELLED').reduce((s,o)=>s+(o.final_total||0),0)
  const recentOrds = orders.slice(0,3)

  const QUICK_LINKS = [
    { href:'/account/orders?filter=UNPAID',   icon:'⏳',label:'To Pay',    badge:orders.filter(o=>o.status==='UNPAID').length, color:'#F97316' },
    { href:'/account/orders?filter=SHIPPED',  icon:'🚚',label:'Shipping',  badge:toReceive,      color:'#3B82F6' },
    { href:'/account/orders?filter=DELIVERED',icon:'📦',label:'Delivered', badge:delivered,      color:'#10B981' },
    { href:'/account/reviews',                icon:'⭐',label:'To Review', badge:pendingReviews, color:'#F59E0B' },
    { href:'/orders',                         icon:'📋',label:'All Orders',badge:orders.length,  color:'#8B5CF6' },
  ]

  const MENU_SECTIONS = [
    {
      title: 'Shopping',
      items: [
        { icon:'📦',label:'My Orders',         sub:`${orders.length} total orders`,              href:'/account/orders',          badge:toShip+toReceive },
        { icon:'⭐',label:'Pending Reviews',    sub:`${pendingReviews} items to rate`,            href:'/account/reviews',         badge:pendingReviews   },
        { icon:'❤️',label:'My Wishlist',        sub:`${wishlistCount} saved items`,              href:'/wishlist'                                         },
        { icon:'💰',label:'Price Drops',        sub:priceDrops>0?`${priceDrops} items cheaper!`:'Track wishlist price changes', href:'/account/price-drops', badge:priceDrops },
        { icon:'👁️',label:'Recently Viewed',    sub:`${recentCount} products viewed`,            href:'/account/recently-viewed'                         },
      ]
    },
    {
      title: 'Account',
      items: [
        { icon:'📍',label:'My Addresses',       sub:'Manage delivery addresses',                 href:'/account/addresses'  },
        { icon:'👤',label:'Profile Settings',   sub:'Name, gender, date of birth',               href:'/account/profile'    },
        { icon:'💬',label:'Help & Support',      sub:'FAQs, returns, contact us',                 href:'/account/help'       },
        { icon:'🛒',label:'Browse Products',     sub:'Discover new arrivals',                     href:'/shop'               },
      ]
    }
  ]

  return (
    <AccountShell title="My Account">
      <div style={{ padding:'14px', maxWidth:520 }}>

        {/* Profile card */}
        <div style={{ display:'flex',alignItems:'center',gap:14,padding:'16px',borderRadius:20,background:'var(--viro-bgCard)',border:'1px solid var(--viro-border)',marginBottom:14 }}>
          {user?.avatar
            ? <img src={user.avatar} alt="" style={{ width:56,height:56,borderRadius:'50%',border:'2.5px solid #8B5CF6',flexShrink:0 }}/>
            : <div style={{ width:56,height:56,borderRadius:'50%',background:'linear-gradient(135deg,#8B5CF6,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:900,color:'#fff',flexShrink:0 }}>
                {(user?.name||user?.email||'U')[0].toUpperCase()}
              </div>
          }
          <div style={{ flex:1,minWidth:0 }}>
            <p style={{ fontSize:16,fontWeight:900,color:'var(--viro-text)',margin:'0 0 2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{user?.name||'My Account'}</p>
            <p style={{ fontSize:12,color:'var(--viro-textSub)',margin:'0 0 5px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{user?.email}</p>
            <span style={{ fontSize:10,fontWeight:800,padding:'2px 8px',borderRadius:20,background:'#10B98120',color:'#10B981',border:'1px solid #10B98140' }}>🟢 Google Account</span>
          </div>
          <Link href="/account/profile" style={{ flexShrink:0,padding:'7px 12px',borderRadius:14,border:'1px solid var(--viro-border)',background:'var(--viro-bgDeep)',color:'var(--viro-textSub)',fontSize:11,fontWeight:700,textDecoration:'none' }}>
            Edit
          </Link>
        </div>

        {/* Partner status — only shown to someone who's actually applied to
            (or joined) the Partner Program; everyone else never sees this,
            so the account page stays uncluttered for regular shoppers. */}
        {partner && partner.status === 'approved' && (
          <Link href="/partner" style={{
            display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderRadius:20, marginBottom:14, textDecoration:'none',
            background:'linear-gradient(135deg,#8B5CF615,#7C3AED08)', border:'1px solid #8B5CF640',
          }}>
            <span style={{ fontSize:26 }}>🤝</span>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:13, fontWeight:800, color:'var(--viro-text)', margin:0 }}>Viro Partner</p>
              <p style={{ fontSize:11, color:'var(--viro-textSub)', margin:'1px 0 0' }}>
                🪙 Rs.{Number(partner.influencer?.store_credit_balance || 0).toLocaleString()} available to spend
              </p>
            </div>
            <span style={{ fontSize:12, color:'#8B5CF6', fontWeight:700, flexShrink:0 }}>View →</span>
          </Link>
        )}
        {partner && partner.status === 'pending' && (
          <Link href="/partner" style={{
            display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:20, marginBottom:14, textDecoration:'none',
            background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)',
          }}>
            <span style={{ fontSize:22 }}>⏳</span>
            <p style={{ fontSize:12, fontWeight:700, color:'var(--viro-textSub)', margin:0 }}>Your Partner Program request is under review</p>
          </Link>
        )}
        {!partner && (
          <Link href="/partner" style={{
            display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:20, marginBottom:14, textDecoration:'none',
            background:'var(--viro-bgCard)', border:'1px dashed var(--viro-border)',
          }}>
            <span style={{ fontSize:22 }}>🤝</span>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:12, fontWeight:700, color:'var(--viro-text)', margin:0 }}>Earn commission promoting Viro</p>
              <p style={{ fontSize:10.5, color:'var(--viro-textSub)', margin:'1px 0 0' }}>Join the Partner Program →</p>
            </div>
          </Link>
        )}

        {/* Stats */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14 }}>
          {[
            { label:'Orders',   value:ordersLoad?'…':orders.length,                 icon:'📋',color:'#8B5CF6' },
            { label:'Active',   value:ordersLoad?'…':toShip+toReceive,              icon:'🚚',color:'#00BFFF' },
            { label:'Delivered',value:ordersLoad?'…':delivered,                     icon:'✅',color:'#10B981' },
            { label:'Spent',    value:ordersLoad?'…':`Rs.${Math.round(totalSpent/1000)}k`,icon:'💰',color:'#F97316' },
          ].map(s=>(
            <div key={s.label} style={{ background:'var(--viro-bgCard)',borderRadius:14,padding:'10px 6px',textAlign:'center',border:'1px solid var(--viro-border)' }}>
              <div style={{ fontSize:18,marginBottom:2 }}>{s.icon}</div>
              <div style={{ fontSize:14,fontWeight:900,color:s.color,lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.04em',color:'var(--viro-textSub)',marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Daraz-style order quick links */}
        <div style={{ background:'var(--viro-bgCard)',borderRadius:18,border:'1px solid var(--viro-border)',padding:'14px 8px',marginBottom:14 }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,padding:'0 8px' }}>
            <p style={{ fontSize:14,fontWeight:800,color:'var(--viro-text)',margin:0 }}>My Orders</p>
            <Link href="/account/orders" style={{ fontSize:12,color:'#A78BFA',textDecoration:'none',fontWeight:700 }}>View All →</Link>
          </div>
          <div style={{ display:'flex',justifyContent:'space-around' }}>
            {QUICK_LINKS.map(ql=>(
              <Link key={ql.href} href={ql.href} style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:6,textDecoration:'none',position:'relative',padding:'0 4px' }}>
                <div style={{ width:48,height:48,borderRadius:14,background:`${ql.color}18`,border:`1.5px solid ${ql.color}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,position:'relative' }}>
                  {ql.icon}
                  {ql.badge>0&&<div style={{ position:'absolute',top:-7,right:-7,minWidth:18,height:18,borderRadius:9,background:ql.color,color:'#fff',fontSize:10,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 3px',border:'1.5px solid var(--viro-bgCard)' }}>{ql.badge>99?'99+':ql.badge}</div>}
                </div>
                <span style={{ fontSize:10,fontWeight:700,color:'var(--viro-textSub)',textAlign:'center',whiteSpace:'nowrap' }}>{ql.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent orders preview */}
        {recentOrds.length > 0 && (
          <div style={{ background:'var(--viro-bgCard)',borderRadius:18,border:'1px solid var(--viro-border)',padding:'14px',marginBottom:14 }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
              <p style={{ fontSize:14,fontWeight:800,color:'var(--viro-text)',margin:0 }}>Recent Orders</p>
              <Link href="/account/orders" style={{ fontSize:12,color:'#A78BFA',textDecoration:'none',fontWeight:700 }}>See All →</Link>
            </div>
            {recentOrds.map((order,idx)=>{
              const item=order.order_items?.[0]
              const img=(()=>{try{const imgs=typeof item?.products?.images==='string'?JSON.parse(item.products.images):item?.products?.images;return Array.isArray(imgs)?imgs[0]:imgs}catch{return null}})()
              const sc=STATUS_COLOR[order.status]||'#8B5CF6'
              return(
                <Link key={order.id} href="/account/orders"
                  style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:idx<recentOrds.length-1?'1px solid var(--viro-border)':'none',textDecoration:'none' }}>
                  <div style={{ width:44,height:44,borderRadius:10,overflow:'hidden',flexShrink:0,background:'var(--viro-bgDeep)',display:'flex',alignItems:'center',justifyContent:'center' }}>
                    {img?<img src={img} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>:<span style={{ fontSize:18 }}>📦</span>}
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <p style={{ fontSize:11,fontWeight:700,color:'var(--viro-textSub)',margin:'0 0 2px',fontFamily:'monospace' }}>#{(order.id||'').slice(0,8).toUpperCase()}</p>
                    <p style={{ fontSize:13,fontWeight:800,color:sc,margin:0 }}>Rs.{(order.final_total||0).toLocaleString()}</p>
                  </div>
                  <span style={{ fontSize:11,fontWeight:800,padding:'3px 8px',borderRadius:20,background:`${sc}18`,color:sc,border:`1px solid ${sc}30`,flexShrink:0 }}>
                    {STATUS_ICON[order.status]} {order.status}
                  </span>
                </Link>
              )
            })}
          </div>
        )}

        {/* Price drop alert banner */}
        {priceDrops > 0 && (
          <Link href="/account/price-drops" style={{ display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderRadius:18,background:'#10B98110',border:'1.5px solid #10B98130',textDecoration:'none',marginBottom:14 }}>
            <span style={{ fontSize:28,flexShrink:0 }}>💰</span>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:14,fontWeight:800,color:'#10B981',margin:'0 0 2px' }}>Price drop alert! 🎉</p>
              <p style={{ fontSize:12,color:'var(--viro-textSub)',margin:0 }}>{priceDrops} item{priceDrops!==1?'s':''} on your wishlist are cheaper now</p>
            </div>
            <span style={{ color:'#10B981',fontSize:18 }}>›</span>
          </Link>
        )}

        {/* Menu sections */}
        {MENU_SECTIONS.map(section => (
          <div key={section.title} style={{ marginBottom:14 }}>
            <p style={{ fontSize:11,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--viro-textSub)',margin:'0 4px 8px' }}>{section.title}</p>
            <div style={{ background:'var(--viro-bgCard)',borderRadius:18,border:'1px solid var(--viro-border)',overflow:'hidden' }}>
              {section.items.map((item,i)=>(
                <Link key={item.href} href={item.href}
                  style={{ display:'flex',alignItems:'center',gap:14,padding:'13px 16px',textDecoration:'none',borderBottom:i<section.items.length-1?'1px solid var(--viro-border)':'none' }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--viro-bgDeep)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{ width:40,height:40,borderRadius:12,background:'var(--viro-bgDeep)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0 }}>{item.icon}</div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:14,fontWeight:700,color:'var(--viro-text)',margin:'0 0 1px' }}>{item.label}</p>
                    <p style={{ fontSize:12,color:'var(--viro-textSub)',margin:0 }}>{item.sub}</p>
                  </div>
                  {item.badge>0&&<span style={{ fontSize:11,fontWeight:900,minWidth:22,height:22,borderRadius:11,background:'#EF4444',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',padding:'0 5px',flexShrink:0 }}>{item.badge>99?'99+':item.badge}</span>}
                  <span style={{ color:'var(--viro-textSub)',fontSize:18,flexShrink:0 }}>›</span>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* App version footer */}
        <div style={{ textAlign:'center',paddingTop:8 }}>
          <p style={{ fontSize:10,color:'var(--viro-textSub)',margin:0 }}>Viro.pk · Made with ❤️ in Pakistan</p>
        </div>
      </div>
    </AccountShell>
  )
}
