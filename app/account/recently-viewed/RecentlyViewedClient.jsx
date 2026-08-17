'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import AccountShell from '../../../components/AccountShell'
import { getRecentlyViewed, clearRecentlyViewed } from '../../../lib/recentlyViewed'
import { slugify } from '../../../lib/slugify'

export default function RecentlyViewedClient() {
  const [items, setItems] = useState([])
  useEffect(() => { setItems(getRecentlyViewed()) }, [])

  function getImg(item) {
    try { const imgs = typeof item.images==='string'?JSON.parse(item.images):item.images; return Array.isArray(imgs)?imgs[0]:imgs } catch { return null }
  }

  return (
    <AccountShell title="Recently Viewed">
      <div style={{ padding:'14px' }}>
        {items.length === 0 ? (
          <div style={{ textAlign:'center',padding:'48px 24px' }}>
            <div style={{ fontSize:52,marginBottom:12 }}>👁️</div>
            <p style={{ fontWeight:700,color:'var(--viro-text)',margin:'0 0 6px' }}>Nothing yet</p>
            <p style={{ fontSize:13,color:'var(--viro-textSub)',margin:'0 0 20px' }}>Products you view will appear here</p>
            <Link href="/shop" style={{ display:'inline-flex',alignItems:'center',gap:8,padding:'12px 28px',borderRadius:999,background:'linear-gradient(135deg,#6366f1,#8B5CF6)',color:'#fff',fontWeight:700,fontSize:13,textDecoration:'none' }}>
              🛍️ Browse Products
            </Link>
          </div>
        ) : (
          <>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
              <p style={{ fontSize:13,color:'var(--viro-textSub)',margin:0 }}>{items.length} recently viewed</p>
              <button onClick={()=>{clearRecentlyViewed();setItems([])}} style={{ fontSize:11,fontWeight:700,color:'#EF4444',background:'none',border:'none',cursor:'pointer' }}>Clear All</button>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
              {items.map(item => {
                const img = getImg(item)
                const now = new Date()
                const saleOk = item.discount_price && item.discount_price < item.price && item.sale_active && (!item.sale_ends_at || new Date(item.sale_ends_at) > now)
                const price = saleOk ? item.discount_price : item.price
                const pct   = saleOk ? Math.round((1-item.discount_price/item.price)*100) : 0
                const slug  = `${slugify(item.name)}-${item.id}`
                return (
                  <Link key={item.id} href={`/product/${slug}`}
                    style={{ borderRadius:16,border:'1px solid var(--viro-border)',background:'var(--viro-bgCard)',overflow:'hidden',textDecoration:'none',display:'block' }}>
                    <div style={{ height:130,background:'var(--viro-bgDeep)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',position:'relative' }}>
                      {img ? <img src={img} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/> : <span style={{ fontSize:32 }}>📦</span>}
                      {pct>0 && <div style={{ position:'absolute',top:8,left:8,fontSize:10,fontWeight:800,padding:'2px 6px',borderRadius:20,background:'#EF4444',color:'#fff' }}>-{pct}%</div>}
                    </div>
                    <div style={{ padding:'10px' }}>
                      <p style={{ fontSize:12,fontWeight:700,color:'var(--viro-text)',margin:'0 0 4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{item.name}</p>
                      <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                        <span style={{ fontSize:14,fontWeight:800,color:saleOk?'#8B5CF6':'var(--viro-text)' }}>Rs.{price?.toLocaleString()}</span>
                        {saleOk && <span style={{ fontSize:10,color:'var(--viro-textSub)',textDecoration:'line-through' }}>Rs.{item.price?.toLocaleString()}</span>}
                      </div>
                      {item.avg_rating > 0 && (
                        <p style={{ fontSize:10,color:'#F59E0B',margin:'3px 0 0' }}>{'⭐'.repeat(Math.round(item.avg_rating))} {item.avg_rating?.toFixed(1)}</p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
    </AccountShell>
  )
}
