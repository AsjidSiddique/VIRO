'use client'
import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import ProductCard from '../../../components/ProductCard'

const SORT_OPTIONS = [
  { label: 'Newest',        value: 'newest' },
  { label: 'Price: Low',    value: 'price_asc' },
  { label: 'Price: High',   value: 'price_desc' },
  { label: 'Top Rated',     value: 'rating' },
]

export default function CategoryPageClient({ category, initialProducts }) {
  const [sort, setSort]     = useState('newest')
  const [search, setSearch] = useState('')

  const products = useMemo(() => {
    let list = [...initialProducts]

    // Filter by search query
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      )
    }

    // Sort
    switch (sort) {
      case 'price_asc':
        list.sort((a, b) => (a.discount_price || a.price) - (b.discount_price || b.price))
        break
      case 'price_desc':
        list.sort((a, b) => (b.discount_price || b.price) - (a.discount_price || a.price))
        break
      case 'rating':
        list.sort((a, b) => (b.review_avg || 0) - (a.review_avg || 0))
        break
      default: // newest — already from server
        break
    }

    return list
  }, [initialProducts, sort, search])

  return (
    <div style={{ background: 'var(--viro-sectionBg)', minHeight: '100vh', paddingBottom: 80 }}>
      <div className="md:max-w-5xl md:mx-auto">

        {/* ── Hero / Category Header ── */}
        <div className="relative overflow-hidden mx-4 mt-4 mb-5 rounded-2xl"
          style={{ minHeight: 120, background: 'linear-gradient(135deg,var(--viro-bgCard),var(--viro-bgDeep))' }}>
          {category.image_url && (
            <Image src={category.image_url} alt={category.name} fill
              style={{ objectFit: 'cover', opacity: 0.18 }} priority />
          )}
          <div className="relative z-10 p-5">
            <nav className="flex items-center gap-1.5 text-xs mb-3" style={{ color: 'var(--viro-textSub)' }}>
              <Link href="/" style={{ color: 'var(--viro-textSub)' }}>Home</Link>
              <span>›</span>
              <Link href="/shop" style={{ color: 'var(--viro-textSub)' }}>Shop</Link>
              <span>›</span>
              <span style={{ color: 'var(--viro-text)', fontWeight: 600 }}>{category.name}</span>
            </nav>
            <div className="flex items-center gap-3">
              {category.icon && (
                <span className="text-3xl">{category.icon}</span>
              )}
              <div>
                <h1 className="font-display text-xl font-extrabold" style={{ color: 'var(--viro-text)' }}>
                  {category.name}
                </h1>
                {category.description && (
                  <p className="text-sm mt-0.5" style={{ color: 'var(--viro-textMuted)' }}>
                    {category.description}
                  </p>
                )}
              </div>
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--viro-textSub)' }}>
              {initialProducts.length} product{initialProducts.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* ── Search + Sort Controls ── */}
        <div className="px-4 mb-4 flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
              style={{ color: 'var(--viro-textSub)' }}>🔍</span>
            <input
              type="text"
              placeholder={`Search ${category.name}…`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                paddingLeft: 34,
                background: 'var(--viro-bgCard)',
                border: '1px solid var(--viro-border)',
                borderRadius: 12,
                color: 'var(--viro-text)',
                fontSize: 13,
                height: 40,
                width: '100%',
              }}
            />
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            style={{
              background: 'var(--viro-bgCard)',
              border: '1px solid var(--viro-border)',
              borderRadius: 12,
              color: 'var(--viro-text)',
              fontSize: 12,
              height: 40,
              padding: '0 10px',
              flexShrink: 0,
            }}>
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* ── Product Grid ── */}
        {products.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="text-5xl mb-3">📦</div>
            <p className="font-bold text-base" style={{ color: 'var(--viro-text)' }}>
              {search ? 'No results found' : 'No products yet'}
            </p>
            <p className="text-sm mt-1 mb-6" style={{ color: 'var(--viro-textSub)' }}>
              {search ? `Try a different search term` : 'Check back soon!'}
            </p>
            {search && (
              <button onClick={() => setSearch('')}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)' }}>
                Clear Search
              </button>
            )}
            <div className="mt-4">
              <Link href="/shop"
                className="text-sm font-medium"
                style={{ color: '#A78BFA' }}>
                ← Browse all products
              </Link>
            </div>
          </div>
        ) : (
          <div className="px-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {products.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}

        {/* ── View All Shop Link ── */}
        <div className="text-center mt-8 px-4">
          <Link href="/shop"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold"
            style={{
              background: 'var(--viro-bgCard)',
              border: '1px solid var(--viro-border)',
              color: 'var(--viro-textMuted)',
            }}>
            ← Back to All Products
          </Link>
        </div>

      </div>
    </div>
  )
}
