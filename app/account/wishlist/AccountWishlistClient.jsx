'use client'
import React from 'react'
import Link from 'next/link'
import AccountShell from '../../../components/AccountShell'
import { useWishlist } from '../../../context/WishlistContext'

export default function AccountWishlistClient() {
  const { wishlist, wishlistCount, removeFromWishlist } = useWishlist()

  function getImg(item) {
    try {
      const imgs = typeof item.images==='string'?JSON.parse(item.images):item.images
      return Array.isArray(imgs)?imgs[0]:imgs
    } catch { return null }
  }

  return (
    <AccountShell title="My Wishlist">
      <div style={{ padding:'14px' }}>
        {wishlistCount === 0 ? (
          <div style={{ textAlign:'center',padding:'48px 24px' }}>
            <div style={{ fontSize:52,marginBottom:12 }}>❤️</div>
            <p style={{ fontWeight:700,color:'var(--viro-text)',margin:'0 0 6px' }}>Your wishlist is empty</p>
            <p style={{ fontSize:13,color:'var(--viro-textSub)',margin:'0 0 20px' }}>Save products you love and find them here later</p>
            <Link href="/shop" style={{ display:'inline-flex',alignItems:'center',gap:8,padding:'12px 28px',borderRadius:999,background:'linear-gradient(135deg,#6366f1,#8B5CF6)',color:'#fff',fontWeight:700,fontSize:13,textDecoration:'none' }}>
              🛍️ Browse Products
            </Link>
          </div>
        ) : (
          <>
            <p style={{ fontSize:13,color:'var(--viro-textSub)',margin:'0 0 12px' }}>{wishlistCount} saved item{wishlistCount!==1?'s':''}</p>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
              {wishlist.map(item => {
                const img = getImg(item)
                const saleOk = item.discount_price && item.discount_price < item.price && item.sale_active && (!item.sale_ends_at || new Date(item.sale_ends_at) > new Date())
                const price  = saleOk ? item.discount_price : item.price
                const pct    = saleOk ? Math.round((1-item.discount_price/item.price)*100) : 0
                return (
                  <div key={item.id} style={{ borderRadius:16,border:'1px solid var(--viro-border)',background:'var(--viro-bgCard)',overflow:'hidden',position:'relative' }}>
                    <button onClick={()=>removeFromWishlist(item.id)}
                      style={{ position:'absolute',top:8,right:8,zIndex:2,width:28,height:28,borderRadius:'50%',background:'rgba(0,0,0,0.5)',border:'none',color:'#EF4444',fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
                      ✕
                    </button>
                    {pct>0&&<div style={{ position:'absolute',top:8,left:8,zIndex:2,fontSize:10,fontWeight:800,padding:'2px 6px',borderRadius:20,background:'#EF4444',color:'#fff' }}>-{pct}%</div>}
                    <Link href={`/product/${(item.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}-${item.id}`} style={{ textDecoration:'none',display:'block' }}>
                      <div style={{ height:130,background:'var(--viro-bgDeep)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden' }}>
                        {img?<img src={img} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>:<span style={{ fontSize:32 }}>📦</span>}
                      </div>
                      <div style={{ padding:'10px' }}>
                        <p style={{ fontSize:12,fontWeight:700,color:'var(--viro-text)',margin:'0 0 4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{item.name}</p>
                        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                          <span style={{ fontSize:14,fontWeight:800,color:saleOk?'#8B5CF6':'var(--viro-text)' }}>Rs.{price?.toLocaleString()}</span>
                          {saleOk&&<span style={{ fontSize:11,color:'var(--viro-textSub)',textDecoration:'line-through' }}>Rs.{item.price?.toLocaleString()}</span>}
                        </div>
                      </div>
                    </Link>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </AccountShell>
  )
}
