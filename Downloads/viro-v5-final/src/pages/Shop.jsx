import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import ProductCard from '../components/ProductCard'

export default function Shop() {
  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')

  useEffect(() => {
    supabase.from('products').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setProducts(data || []); setLoading(false) })
  }, [])

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="pb-4" style={{ background: '#0F172A', minHeight: '100vh' }}>
      {/* Sticky search header */}
      <div className="sticky top-9 z-30 px-4 pt-4 pb-3"
        style={{ background: '#0F172A', borderBottom: '1px solid #1E293B' }}>
        <h1 className="font-display text-xl font-extrabold text-white mb-3">All Products</h1>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
          <input
            type="search"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '2.5rem', background: '#1E293B', borderColor: '#334155' }}
          />
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          /* Skeleton grid — responsive columns */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF' }}>
                <div className="aspect-square skeleton" style={{ background: '#E2E8F0' }} />
                <div className="p-3 space-y-2">
                  <div className="skeleton h-4 w-3/4 rounded" style={{ background: '#E2E8F0' }} />
                  <div className="skeleton h-3 w-1/2 rounded" style={{ background: '#E2E8F0' }} />
                  <div className="skeleton h-8 w-full rounded-xl" style={{ background: '#E2E8F0' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16" style={{ color: '#64748B' }}>
            <div className="text-5xl mb-4">🔍</div>
            <p className="font-bold text-white">No products found</p>
            <p className="text-sm mt-1">{search ? 'Try a different search term' : 'Check back soon!'}</p>
          </div>
        ) : (
          <>
            <p className="text-xs mb-3" style={{ color: '#64748B' }}>
              {filtered.length} product{filtered.length !== 1 ? 's' : ''} found
            </p>
            {/* Responsive grid — 2 cols mobile, 3 cols tablet, 4 cols desktop, 5 cols wide */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filtered.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
