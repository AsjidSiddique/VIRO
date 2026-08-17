'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import AccountShell from '../../../components/AccountShell'
import { useWishlist } from '../../../context/WishlistContext'
import { supabase } from '../../../lib/supabase'
import { slugify } from '../../../lib/slugify'

export default function PriceDropsClient() {
  const { wishlist } = useWishlist()
  const [drops,   setDrops]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!wishlist.length) { setLoading(false); return }
    async function check() {
      try {
        const ids = wishlist.map(i => i.id)
        const { data } = await supabase
          .from('products')
          .select('id, name, images, price, discount_price, sale_active, sale_ends_at')
          .in('id', ids)
          .eq('is_active', true)
        const now = new Date()
        const dropped = (data||[]).filter(p => {
          const saved = wishlist.find(w => w.id === p.id)
          if (!saved) return false
          const saleOk = p.discount_price && p.discount_price < p.price && p.sale_active &&
            (!p.sale_ends_at || new Date(p.sale_ends_at) > now)
          const currentPrice = saleOk ? p.discount_price : p.price
          const savedPrice   = saved.discount_price && saved.sale_active ? saved.discount_price : saved.price
          return currentPrice < savedPrice
        }).map(p => {
          const saved = wishlist.find(w => w.id === p.id)
          const saleOk = p.discount_price && p.discount_price < p.price && p.sale_active &&
            (!p.sale_ends_at || new Date(p.sale_ends_at) > now)
          const currentPrice = saleOk ? p.discount_price : p.price
          const savedPrice   = saved.discount_price && saved.sale_active ? saved.discount_price : saved.price
          const savingAmt    = savedPrice - currentPrice
          const savingPct    = Math.round((savingAmt / savedPrice) * 100)
          const img = (() => { try { const imgs = typeof p.images==='string'?JSON.parse(p.images):p.images; return Array.isArray(imgs)?imgs[0]:imgs } catch { return null } })()
          return { ...p, currentPrice, savedPrice, savingAmt, savingPct, img }
        })
        setDrops(dropped)
      } catch {}
      setLoading(false)
    }
    check()
  }, [wishlist])

  return (
    <AccountShell title="Price Drops">
      <div style={{ padding:'14px' }}>
        {loading ? (
          <div style={{ display:'flex',justifyContent:'center',padding:'48px 0' }}>
            <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="3" opacity="0.25"/>
              <path fill="#8B5CF6" d="M4 12a8 8 0 018-8v8z" opacity="0.75"/>
            </svg>
          </div>
        ) : wishlist.length === 0 ? (
          <div style={{ textAlign:'center',padding:'48px 24px' }}>
            <div style={{ fontSize:52,marginBottom:12 }}>💰</div>
            <p style={{ fontWeight:700,color:'var(--viro-text)',margin:'0 0 6px' }}>No wishlist items</p>
            <p style={{ fontSize:13,color:'var(--viro-textSub)',margin:'0 0 20px' }}>
              Add products to your wishlist to track price drops
            </p>
            <Link href="/shop" style={{ display:'inline-flex',alignItems:'center',gap:8,padding:'12px 28px',borderRadius:999,background:'linear-gradient(135deg,#6366f1,#8B5CF6)',color:'#fff',fontWeight:700,fontSize:13,textDecoration:'none' }}>
              🛍️ Browse Products
            </Link>
          </div>
        ) : drops.length === 0 ? (
          <div style={{ textAlign:'center',padding:'48px 24px' }}>
            <div style={{ fontSize:52,marginBottom:12 }}>✅</div>
            <p style={{ fontWeight:700,color:'var(--viro-text)',margin:'0 0 6px' }}>Prices are stable</p>
            <p style={{ fontSize:13,color:'var(--viro-textSub)',margin:'0 0 4px' }}>
              None of your {wishlist.length} wishlisted items have dropped in price.
            </p>
            <p style={{ fontSize:12,color:'var(--viro-textSub)',margin:'0 0 20px' }}>Check back later!</p>
            <Link href="/wishlist" style={{ display:'inline-flex',alignItems:'center',gap:8,padding:'12px 28px',borderRadius:999,background:'var(--viro-bgCard)',border:'1px solid var(--viro-border)',color:'var(--viro-textSub)',fontWeight:700,fontSize:13,textDecoration:'none' }}>
              View Wishlist →
            </Link>
          </div>
        ) : (
          <>
            <div style={{ marginBottom:14,padding:'12px 16px',borderRadius:14,background:'#10B98115',border:'1px solid #10B98130' }}>
              <p style={{ fontSize:14,fontWeight:800,color:'#10B981',margin:'0 0 2px' }}>🎉 {drops.length} price drop{drops.length!==1?'s':''} on your wishlist!</p>
              <p style={{ fontSize:12,color:'var(--viro-textSub)',margin:0 }}>These items cost less than when you saved them.</p>
            </div>
            <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
              {drops.map(item => (
                <Link key={item.id} href={`/product/${slugify(item.name)}-${item.id}`}
                  style={{ display:'flex',alignItems:'center',gap:12,padding:'14px',borderRadius:16,background:'var(--viro-bgCard)',border:'1.5px solid #10B98130',textDecoration:'none' }}>
                  <div style={{ width:60,height:60,borderRadius:12,overflow:'hidden',flexShrink:0,background:'var(--viro-bgDeep)' }}>
                    {item.img?<img src={item.img} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>:<span style={{ fontSize:24 }}>📦</span>}
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <p style={{ fontSize:13,fontWeight:700,color:'var(--viro-text)',margin:'0 0 4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{item.name}</p>
                    <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                      <span style={{ fontSize:16,fontWeight:900,color:'#10B981' }}>Rs.{item.currentPrice.toLocaleString()}</span>
                      <span style={{ fontSize:12,color:'var(--viro-textSub)',textDecoration:'line-through' }}>Rs.{item.savedPrice.toLocaleString()}</span>
                    </div>
                    <span style={{ fontSize:11,fontWeight:800,color:'#10B981' }}>Save Rs.{item.savingAmt.toLocaleString()} ({item.savingPct}% off!)</span>
                  </div>
                  <div style={{ flexShrink:0,padding:'6px 12px',borderRadius:20,background:'#10B981',color:'#fff',fontSize:12,fontWeight:800 }}>
                    Buy Now
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </AccountShell>
  )
}
