import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ProductCard from '../components/ProductCard'
import HeroBanner from '../components/HeroBanner'

const FEATURES = [
  { icon:'🚀', title:'Fast Delivery',   sub:'Burewala & all Pakistan', color:'#00BFFF' },
  { icon:'✅', title:'Trusted Quality', sub:'Verified products',        color:'#10B981' },
  { icon:'💎', title:'Best Prices',     sub:'Affordable deals',         color:'#8B5CF6' },
  { icon:'🎧', title:'24/7 Support',    sub:'Always here for you',      color:'#F97316' },
]

export default function Home() {
  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    supabase.from('products').select('*').order('created_at', { ascending: false }).limit(8)
      .then(({ data }) => { setProducts(data || []); setLoading(false) })
  }, [])

  return (
    <div className="pb-4" style={{ background:'#0F172A' }}>

      {/* Hero Slider */}
      <HeroBanner />

      {/* Feature grid */}
      <div className="px-4 mt-5 mb-5">
        <div className="grid grid-cols-2 gap-3">
          {FEATURES.map(f => (
            <div key={f.title} className="flex items-center gap-3 p-3 rounded-2xl"
              style={{ background:'#1E293B', border:'1px solid #334155' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: f.color+'20', border:`1px solid ${f.color}40` }}>
                {f.icon}
              </div>
              <div>
                <p className="text-xs font-bold text-white">{f.title}</p>
                <p className="text-xs" style={{ color:'#94A3B8' }}>{f.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Latest Products */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-extrabold text-white">Latest Products</h2>
            <p className="text-xs" style={{ color:'#64748B' }}>Fresh arrivals just for you</p>
          </div>
          <Link to="/shop"
            className="text-xs font-bold px-3 py-1.5 rounded-xl"
            style={{ background:'#8B5CF620', color:'#A78BFA', border:'1px solid #8B5CF640' }}>
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 gap-3">
            {Array(4).fill(0).map((_,i) => (
              <div key={i} className="rounded-2xl overflow-hidden" style={{ background:'#FFFFFF' }}>
                <div className="aspect-square skeleton" style={{ background:'#E2E8F0' }} />
                <div className="p-3 space-y-2">
                  <div className="skeleton h-4 w-3/4 rounded" style={{ background:'#E2E8F0' }} />
                  <div className="skeleton h-3 w-1/2 rounded" style={{ background:'#E2E8F0' }} />
                  <div className="skeleton h-8 w-full rounded-xl" style={{ background:'#E2E8F0' }} />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12" style={{ color:'#64748B' }}>
            <div className="text-5xl mb-3">📦</div>
            <p className="font-bold text-white">No products yet</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 gap-3">
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>

      {/* Delivery Banner */}
      <div className="px-4 mb-6">
        <div className="rounded-2xl p-4" style={{ background:'linear-gradient(135deg,#1E293B,#0F172A)', border:'1px solid #334155' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🚚</span>
            <h3 className="font-bold text-white text-sm">Delivery Info</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl" style={{ background:'#00BFFF12', border:'1px solid #00BFFF30' }}>
              <p className="font-bold text-white">🟢 Burewala</p>
              <p style={{ color:'#00BFFF' }}>Free ≥ Rs.550</p>
            </div>
            <div className="p-2.5 rounded-xl" style={{ background:'#8B5CF612', border:'1px solid #8B5CF630' }}>
              <p className="font-bold text-white">🌍 Other Cities</p>
              <p style={{ color:'#A78BFA' }}>Free ≥ Rs.2500</p>
            </div>
          </div>
          <p className="text-center text-xs mt-3" style={{ color:'#475569' }}>
            Otherwise Rs.150 flat delivery charge applies
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="px-4">
        <div className="rounded-2xl p-5 text-center relative overflow-hidden"
          style={{ background:'linear-gradient(135deg,#00BFFF15,#8B5CF625,#F9731615)', border:'1px solid #8B5CF640' }}>
          <p className="text-xs font-bold mb-1" style={{ color:'#A78BFA' }}>🎉 Pakistan-wide Delivery</p>
          <h3 className="font-display text-xl font-extrabold text-white mb-1">Shop with Confidence</h3>
          <p className="text-xs mb-4" style={{ color:'#94A3B8' }}>Trusted by customers across Punjab & Pakistan</p>
          <div className="flex gap-3 justify-center">
            <Link to="/shop"
              className="px-5 py-2.5 rounded-xl font-bold text-sm text-white"
              style={{ background:'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)' }}>
              🛍️ Shop Now
            </Link>
            <a href="https://wa.me/923277796566" target="_blank" rel="noopener"
              className="px-5 py-2.5 rounded-xl font-bold text-sm text-white"
              style={{ background:'linear-gradient(135deg,#25D366,#128C7E)' }}>
              💬 WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
