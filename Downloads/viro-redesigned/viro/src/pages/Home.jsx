import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ProductCard from '../components/ProductCard'
import HeroBanner from '../components/HeroBanner'

const FEATURES = [
  { icon: '🚀', title: 'Fast Delivery',   sub: 'Burewala & nearby',    color: '#00BFFF' },
  { icon: '✅', title: 'Trusted Quality', sub: 'Verified products',     color: '#10B981' },
  { icon: '💎', title: 'Best Prices',     sub: 'Affordable deals',      color: '#8B5CF6' },
  { icon: '🎧', title: '24/7 Support',    sub: 'Always here for you',   color: '#F97316' },
]

const DELIVERY_CITIES = [
  { city: 'Burewala',     free: '550+',  color: '#00BFFF', emoji: '🟢' },
  { city: 'Chichawatni', free: '2000+', color: '#8B5CF6', emoji: '🟣' },
  { city: 'Vehari',       free: '1500+', color: '#F97316', emoji: '🟠' },
  { city: 'Gaggo',        free: '1200+', color: '#EC4899', emoji: '🩷' },
]

export default function Home() {
  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    supabase.from('products').select('*').order('created_at', { ascending: false }).limit(8)
      .then(({ data }) => { setProducts(data || []); setLoading(false) })
  }, [])

  return (
    <div className="pb-4" style={{ background: '#0F172A' }}>

      {/* ── Hero Slider ── */}
      <HeroBanner />

      {/* ── Feature Pills ── */}
      <div className="px-4 mt-5 mb-5">
        <div className="grid grid-cols-2 gap-3">
          {FEATURES.map(f => (
            <div key={f.title}
              className="flex items-center gap-3 p-3 rounded-2xl transition-all"
              style={{ background: '#1E293B', border: '1px solid #334155' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: f.color + '20', border: `1px solid ${f.color}40` }}>
                {f.icon}
              </div>
              <div>
                <p className="text-xs font-bold text-white">{f.title}</p>
                <p className="text-xs" style={{ color: '#94A3B8' }}>{f.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Latest Products ── */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-extrabold text-white">Latest Products</h2>
            <p className="text-xs" style={{ color: '#64748B' }}>Fresh arrivals just for you</p>
          </div>
          <Link to="/shop"
            className="text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
            style={{ background: '#8B5CF620', color: '#A78BFA', border: '1px solid #8B5CF640' }}>
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF' }}>
                <div className="skeleton aspect-square" style={{ background: '#F1F5F9' }} />
                <div className="p-3 space-y-2">
                  <div className="skeleton h-4 w-3/4 rounded" style={{ background: '#E2E8F0' }} />
                  <div className="skeleton h-3 w-1/2 rounded" style={{ background: '#E2E8F0' }} />
                  <div className="skeleton h-9 w-full rounded-xl" style={{ background: '#E2E8F0' }} />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12" style={{ color: '#64748B' }}>
            <div className="text-5xl mb-3">📦</div>
            <p className="font-semibold text-white">No products yet</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>

      {/* ── Delivery Info Card ── */}
      <div className="px-4 mb-6">
        <div className="rounded-2xl p-4 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1E293B, #0F172A)', border: '1px solid #334155' }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🚚</span>
            <div>
              <h3 className="font-bold text-white text-sm">Delivery Coverage</h3>
              <p className="text-xs" style={{ color: '#64748B' }}>Free delivery thresholds</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DELIVERY_CITIES.map(c => (
              <div key={c.city} className="flex items-center gap-2 p-2.5 rounded-xl"
                style={{ background: c.color + '12', border: `1px solid ${c.color}30` }}>
                <span className="text-sm">{c.emoji}</span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{c.city}</p>
                  <p className="text-xs font-semibold" style={{ color: c.color }}>
                    Free ≥ Rs.{c.free}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t flex items-center justify-center gap-1.5"
            style={{ borderColor: '#1E2A45' }}>
            <span className="text-xs" style={{ color: '#64748B' }}>Other cities:</span>
            <span className="text-xs font-bold" style={{ color: '#F97316' }}>Rs.150 delivery charge</span>
          </div>
        </div>
      </div>

      {/* ── CTA Banner ── */}
      <div className="px-4">
        <div className="rounded-2xl p-5 text-center relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #00BFFF20, #8B5CF630, #F9731620)', border: '1px solid #8B5CF640' }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, #8B5CF630 0%, transparent 70%)' }} />
          <p className="text-xs font-bold mb-1" style={{ color: '#A78BFA' }}>🎉 Smart Shopping Starts Here</p>
          <h3 className="font-display text-xl font-extrabold text-white mb-1">
            Shop with Confidence
          </h3>
          <p className="text-xs mb-4" style={{ color: '#94A3B8' }}>
            Trusted by customers across Burewala & Punjab
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/shop"
              className="px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #00BFFF, #8B5CF6, #F97316)' }}>
              🛍️ Shop Now
            </Link>
            <a href="https://wa.me/923277796566" target="_blank" rel="noopener"
              className="px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}>
              💬 WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
