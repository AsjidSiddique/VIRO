'use client'
import { supabase } from '../lib/supabase'
import Image from 'next/image'
import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { usePathname } from 'next/navigation'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'
import { useUserAuth } from '../context/UserAuthContext'
import { useSite } from '../context/SiteSettingsContext'

const LOGO_URL = '/logo.jpg'

// Colorful filled SVG icons — each icon has its own brand color.
// These always show correctly in both light and dark mode.
const NAV_ICONS = {
  Home: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" fill="#8B5CF6"/>
      <path d="M9 21V14h6v7" fill="#C4B5FD"/>
    </svg>
  ),
  Shop: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6z" fill="#F97316"/>
      <path d="M3 6h18" stroke="#fff" strokeWidth="1.5"/>
      <path d="M16 10a4 4 0 01-8 0" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Wishlist: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" fill="#F43F5E"/>
    </svg>
  ),
  Cart: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M6 2H3l-2 4 2.68 11.39A2 2 0 005.64 19h12.72a2 2 0 001.96-1.61L22 7H6V2z" fill="#10B981"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="9" cy="21" r="1.5" fill="#10B981"/>
      <circle cx="20" cy="21" r="1.5" fill="#10B981"/>
    </svg>
  ),
  Orders: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" fill="#3B82F6"/>
      <path d="M14 2v6h6" fill="#93C5FD"/>
      <line x1="16" y1="13" x2="8" y2="13" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="17" x2="8" y2="17" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="10" y1="9" x2="8" y2="9" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Account: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" fill="#8B5CF6"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="#A78BFA"/>
    </svg>
  ),
}

const NAV_BASE = [
  { path: '/',          label: 'Home'     },
  { path: '/shop',      label: 'Shop'     },
  { path: '/wishlist',  label: 'Wishlist' },
  { path: '/cart',      label: 'Cart'     },
  { path: '/orders',    label: 'Orders'   },
]
// When Google-logged in, last tab becomes "Account" (which also links to orders)
const NAV_LOGGED = [
  { path: '/',          label: 'Home'     },
  { path: '/shop',      label: 'Shop'     },
  { path: '/wishlist',  label: 'Wishlist' },
  { path: '/cart',      label: 'Cart'     },
  { path: '/account',   label: 'Account'  },
]

// ── SearchOverlay — full-screen beautiful search experience ─────────────────
// Slides UP from bottom (like a native app sheet), nav stays visible below.
// Shows: recent searches, trending chips, live results with product images.
function SearchOverlay({ onClose }) {
  const [query, setQuery]           = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [quickPicks, setQuickPicks] = useState(['Bags','Watches','Women Fashion','Cosmetics','Electronics'])
  const [recentSearches, setRecentSearches] = useState([])
  const [searching, setSearching]   = useState(false)
  const [searched, setSearched]     = useState(false)
  const inputRef  = useRef()
  const router    = useRouter()
  const debounceRef = useRef()
  const { homeBlocks } = useSite()

  // Matching "Explore More" tab groups — surfaced above product results so a
  // search for "jewelry" can point straight at the curated Jewelry Set tab
  // instead of only raw product hits. Same substring match used for quick
  // picks below, kept simple since tab labels are short admin-chosen words.
  const matchingCollections = (() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2 || !Array.isArray(homeBlocks)) return []
    const out = []
    for (const block of homeBlocks) {
      if (block.type !== 'tabs') continue
      for (const tab of (block.tabs || [])) {
        if (tab.label?.toLowerCase().includes(q)) {
          const source = homeBlocks.find(b => b.id === tab.sourceBlockId)
          out.push({ id: tab.id, label: tab.label, url: source?.viewAllUrl?.trim() || source?.view_all_url?.trim() || '/shop' })
        }
      }
    }
    return out.slice(0, 4)
  })()

  // Auto-focus input
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 120) }, [])

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem('viro_recent_search') || '[]')
      setRecentSearches(r.slice(0, 5))
    } catch {}
  }, [])

  // Load admin quick-picks
  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key','search_suggestions').maybeSingle()
      .then(({ data }) => {
        if (Array.isArray(data?.value) && data.value.length > 0) setQuickPicks(data.value)
      }).catch(() => {})
  }, [])

  // Escape key
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // ── Fuzzy / typo-tolerant search helpers ──────────────────────────────────
  function getSearchVariants(word) {
    const w = word.toLowerCase().trim()
    const v = new Set([w])
    if (w.endsWith('s') && w.length > 3)   v.add(w.slice(0,-1))
    if (w.endsWith('es') && w.length > 4)  v.add(w.slice(0,-2))
    if (w.endsWith('ies') && w.length > 4) v.add(w.slice(0,-3)+'y')
    v.add(w + 's')
    if (w.length > 4) v.add(w.slice(0,-1))
    return [...v]
  }
  function wordToOrFilter(word, fields) {
    return getSearchVariants(word).flatMap(v => fields.map(f => `${f}.ilike.%${v}%`)).join(',')
  }
  // "ring" as a raw substring also matches "during", "spring", "wearing",
  // "keyring" etc. — word-boundary matching for the qualifying check avoids
  // surfacing totally unrelated products just because their description
  // happens to contain the search term as a substring of another word.
  function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
  function wordBoundaryIncludes(hay, needle) {
    if (!hay || !needle) return false
    try { return new RegExp(`\\b${escapeRegex(needle)}`, 'i').test(hay) } catch { return hay.includes(needle) }
  }

  // Live suggestions with debounce
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim() || query.trim().length < 2) {
      setSuggestions([]); setSearched(false); setSearching(false); return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const q = query.trim()
        const words = q.toLowerCase().split(/\s+/).filter(Boolean)
        const FIELDS = ['name','description','highlights','meta_keywords','meta_title']
        const primaryFilter = wordToOrFilter(words[0], FIELDS)

        const { data: rawHits } = await supabase
          .from('products')
          .select('id, name, images, price, discount_price, sale_active, sale_ends_at, avg_rating, review_count, category_id, categories(name, icon), description, highlights, meta_keywords, meta_title')
          .eq('is_active', true)
          .or(primaryFilter)
          .order('avg_rating', { ascending: false })
          .limit(30)

        const now = new Date()
        const directHits = (rawHits || [])
          .map(p => {
            const nameStr = (p.name || '').toLowerCase()
            const catStr  = (p.categories?.name || '').toLowerCase()
            const tagStr  = (p.meta_keywords || '').toLowerCase()
            const descStr = [p.description, p.highlights, p.meta_title].filter(Boolean).join(' ').toLowerCase()
            const hay     = [nameStr, catStr, tagStr, descStr].join(' ')
            const allMatch = words.every(w => getSearchVariants(w).some(v => wordBoundaryIncludes(hay, v)))
            if (!allMatch) return null
            let score = 0
            words.forEach(w => {
              getSearchVariants(w).forEach(v => {
                if (nameStr.startsWith(v)) score += 70
                if (nameStr.includes(v))   score += 45
                if (catStr.includes(v))    score += 22
                if (tagStr.includes(v))    score += 16
                if (descStr.includes(v))   score += 5
              })
            })
            if (words.every(w => getSearchVariants(w).some(v => nameStr.includes(v)))) score += 40
            score += (p.avg_rating || 0) * 4
            const saleOk = p.discount_price && p.discount_price < p.price &&
              p.sale_active && (!p.sale_ends_at || new Date(p.sale_ends_at) > now)
            return { ...p, _score: score, _saleOk: saleOk }
          })
          .filter(Boolean)
          .sort((a, b) => b._score - a._score)
          .slice(0, 6)

        let catHits = []
        if (directHits.length < 6) {
          const catFilter = getSearchVariants(words[0]).map(v => `name.ilike.%${v}%`).join(',')
          const { data: cats } = await supabase.from('categories').select('id').or(catFilter).limit(5)
          if (cats?.length) {
            const { data: byCategory } = await supabase
              .from('products')
              .select('id, name, images, price, discount_price, sale_active, sale_ends_at, avg_rating, review_count, category_id, categories(name, icon)')
              .eq('is_active', true)
              .in('category_id', cats.map(c=>c.id))
              .order('avg_rating', { ascending: false })
              .limit(6 - directHits.length)
            catHits = (byCategory || []).map(p => ({
              ...p,
              _saleOk: p.discount_price && p.discount_price < p.price && p.sale_active &&
                (!p.sale_ends_at || new Date(p.sale_ends_at) > now)
            }))
          }
        }

        const seen = new Set(directHits.map(p => p.id))
        const merged = [...directHits, ...catHits.filter(p => !seen.has(p.id))].slice(0, 6)
        setSuggestions(merged)
      } catch { setSuggestions([]) }
      finally { setSearching(false); setSearched(true) }
    }, 150)
  }, [query])

  function saveRecent(term) {
    try {
      const prev = JSON.parse(localStorage.getItem('viro_recent_search') || '[]')
      const next  = [term, ...prev.filter(x => x !== term)].slice(0, 5)
      localStorage.setItem('viro_recent_search', JSON.stringify(next))
    } catch {}
  }

  function goToShop(term) {
    const q = (term || query).trim()
    if (!q) return
    saveRecent(q)
    import('../lib/metaEvents').then(m => m.trackSearch(q)).catch(() => {})
    router.push(`/shop?q=${encodeURIComponent(q)}`)
    onClose()
  }

  function clearRecent() {
    localStorage.removeItem('viro_recent_search')
    setRecentSearches([])
  }

  function parseThumb(images) {
    if (!images) return null
    if (Array.isArray(images)) return images.find(u => typeof u === 'string' && u.startsWith('http')) ?? null
    if (typeof images === 'string') {
      if (images.startsWith('http')) return images
      try { const a = JSON.parse(images); return Array.isArray(a) ? a[0] : null } catch {}
    }
    return null
  }

  const showEmpty = !query.trim()

  return (
    <>
      {/* Backdrop — tap to close */}
      <div onClick={onClose} aria-hidden="true" style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
      }} />

      {/* Sheet:
           - Mobile (≤768px):  slides UP from bottom above nav bar
           - Desktop (>768px): drops DOWN from top, centered, max-width 560px
      */}
      <div className="search-sheet" style={{
        position: 'fixed', zIndex: 61,
        background: 'var(--viro-bgCard)',
        border: '1px solid var(--viro-border)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <style>{`
          /* ALL screens: drops from top */
          .search-sheet {
            top: 0; bottom: auto; left: 0; right: 0;
            max-height: 92vh;
            border-radius: 0 0 22px 22px;
            border-top: none;
            box-shadow: 0 12px 60px rgba(0,0,0,0.4);
            animation: searchSlideDown 0.26s cubic-bezier(0.34,1.2,0.64,1);
          }
          /* Desktop: centered floating panel */
          @media (min-width: 768px) {
            .search-sheet {
              top: 56px; left: 50%; right: auto;
              transform: translateX(-50%);
              width: 100%; max-width: 600px;
              max-height: calc(100vh - 70px);
              border-radius: 0 0 18px 18px;
              box-shadow: 0 12px 60px rgba(0,0,0,0.35);
            }
          }
          @keyframes searchSlideDown {
            from { opacity:0; transform:translateY(-20px); }
            to   { opacity:1; transform:translateY(0); }
          }
          @media (min-width: 768px) {
            @keyframes searchSlideDown {
              from { opacity:0; transform:translateX(-50%) translateY(-16px); }
              to   { opacity:1; transform:translateX(-50%) translateY(0); }
            }
          }
        `}</style>

        {/* ── Search input bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          margin: '8px 16px 0',
          padding: '10px 14px',
          background: 'var(--viro-bgDeep)',
          borderRadius: 14,
          border: '1.5px solid',
          borderColor: query ? '#8B5CF6' : 'var(--viro-border)',
          transition: 'border-color 0.2s',
        }}>
          {/* Back arrow — always visible */}
          <button onClick={onClose} aria-label="Close search" style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: 'var(--viro-textSub)', flexShrink: 0, display: 'flex', alignItems: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && query.trim()) goToShop() }}
            placeholder="Search products, bags, watches…"
            aria-label="Search products"
            role="searchbox"
            autoComplete="off"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 15, fontWeight: 500, color: 'var(--viro-text)',
            }}
          />

          {/* Spinner or clear */}
          {searching ? (
            <svg width="16" height="16" viewBox="0 0 24 24" style={{ animation:'spin 0.8s linear infinite', flexShrink:0 }}>
              <circle cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="3" fill="none" strokeDasharray="40" strokeDashoffset="15"/>
            </svg>
          ) : query ? (
            <button onClick={() => { setQuery(''); setSuggestions([]) }}
              aria-label="Clear search"
              style={{ background:'none', border:'none', cursor:'pointer', padding:0,
                color:'var(--viro-textSub)', flexShrink:0, fontSize:16 }}>✕</button>
          ) : (
            <span style={{ fontSize:16, flexShrink:0 }}>🔍</span>
          )}
        </div>

        {/* ── Scrollable content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>

          {/* ── Empty state: recent + trending ── */}
          {showEmpty && (
            <>
              {/* Recent searches */}
              {recentSearches.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <span style={{ fontSize:12, fontWeight:800, color:'var(--viro-textSub)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                      Recent
                    </span>
                    <button onClick={clearRecent} style={{ background:'none', border:'none', cursor:'pointer',
                      fontSize:11, color:'var(--viro-textSub)', fontWeight:600, padding:0 }}>
                      Clear
                    </button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                    {recentSearches.map(term => (
                      <button key={term} onClick={() => goToShop(term)}
                        style={{
                          display:'flex', alignItems:'center', gap:10, width:'100%',
                          padding:'9px 12px', borderRadius:12, background:'none',
                          border:'none', cursor:'pointer', textAlign:'left',
                          transition:'background 0.12s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background='var(--viro-bgDeep)'}
                        onMouseLeave={e => e.currentTarget.style.background='none'}>
                        <span style={{ fontSize:14, color:'var(--viro-textSub)', flexShrink:0 }}>🕐</span>
                        <span style={{ flex:1, fontSize:13, fontWeight:500, color:'var(--viro-text)' }}>{term}</span>
                        {/* tap to pre-fill */}
                        <button onClick={e => { e.stopPropagation(); setQuery(term) }}
                          style={{ background:'none', border:'none', cursor:'pointer', padding:'2px 6px',
                            color:'var(--viro-textSub)', fontSize:13, borderRadius:6 }}>↗</button>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending chips */}
              <div>
                <p style={{ fontSize:12, fontWeight:800, color:'var(--viro-textSub)', textTransform:'uppercase',
                  letterSpacing:'0.06em', marginBottom:10 }}>Trending</p>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {quickPicks.map((term, i) => {
                    const gradients = [
                      'linear-gradient(135deg,#8B5CF620,#6366f120)',
                      'linear-gradient(135deg,#F9731620,#EF444420)',
                      'linear-gradient(135deg,#10B98120,#06B6D420)',
                      'linear-gradient(135deg,#F43F5E20,#EC489920)',
                      'linear-gradient(135deg,#FBBF2420,#F9731620)',
                    ]
                    const borders = ['#8B5CF640','#F9731640','#10B98140','#F43F5E40','#FBBF2440']
                    const colors  = ['#A78BFA','#FB923C','#34D399','#FB7185','#FBBF24']
                    // Dynamic font: fewer chips = bigger text, more chips = smaller
                    const chipFs = quickPicks.length <= 4 ? 14 : quickPicks.length <= 6 ? 13 : quickPicks.length <= 9 ? 12 : 11
                    return (
                      <button key={term} onClick={() => goToShop(term)}
                        style={{
                          padding: chipFs >= 13 ? '7px 14px' : '6px 11px', borderRadius: 20,
                          fontSize: chipFs, fontWeight: 700,
                          background: gradients[i % gradients.length],
                          color: colors[i % colors.length],
                          border: `1px solid ${borders[i % borders.length]}`,
                          cursor: 'pointer', transition: 'transform 0.12s, box-shadow 0.12s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform='scale(1.05)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(0,0,0,0.15)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none' }}>
                        🔥 {term}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* ── Matching "Explore More" collections — points at a curated
               tab instead of only raw product hits ── */}
          {matchingCollections.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize:12, fontWeight:800, color:'var(--viro-textSub)', textTransform:'uppercase',
                letterSpacing:'0.06em', marginBottom:8 }}>
                Collections
              </p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {matchingCollections.map(c => (
                  <Link key={c.id} href={c.url} onClick={onClose}
                    style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 14px',
                      borderRadius:9999, fontSize:13, fontWeight:800, color:'#fff', textDecoration:'none',
                      background:'linear-gradient(135deg,#8B5CF6,#F97316)', boxShadow:'0 2px 8px rgba(139,92,246,0.3)' }}>
                    ✨ {c.label} →
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── Live results with product images ── */}
          {!showEmpty && suggestions.length > 0 && (
            <>
              <p style={{ fontSize:12, fontWeight:800, color:'var(--viro-textSub)', textTransform:'uppercase',
                letterSpacing:'0.06em', marginBottom:10 }}>
                Results
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                {suggestions.map(p => {
                  const thumb    = parseThumb(p.images)
                  const hasDisc  = p._saleOk || (p.discount_price && Number(p.discount_price) < Number(p.price) && !p.sale_ends_at)
                  const price    = hasDisc ? p.discount_price : p.price
                  const discPct  = hasDisc ? Math.round((1 - p.discount_price / p.price) * 100) : 0
                  return (
                    <button key={p.id} onClick={() => goToShop(p.name)}
                      style={{
                        display:'flex', alignItems:'center', gap:12, width:'100%',
                        padding:'8px 10px', borderRadius:14, textAlign:'left',
                        background:'none', border:'none', cursor:'pointer',
                        transition:'background 0.12s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--viro-bgDeep)'}
                      onMouseLeave={e => e.currentTarget.style.background='none'}>

                      {/* Product thumbnail */}
                      <div style={{
                        width:52, height:52, borderRadius:12, flexShrink:0, overflow:'hidden',
                        background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                      }}>
                        {thumb
                          ? <img src={thumb} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : <span style={{ fontSize:22 }}>{p.categories?.icon || '📦'}</span>
                        }
                      </div>

                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:13, fontWeight:600, color:'var(--viro-text)',
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', margin:'0 0 3px' }}>
                          {p.name}
                        </p>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:13, fontWeight:800, color:'#A78BFA' }}>
                            Rs.{Number(price).toLocaleString()}
                          </span>
                          {hasDisc && (
                            <span style={{ fontSize:10, fontWeight:700, color:'#fff',
                              background:'#EF4444', padding:'1px 6px', borderRadius:6 }}>
                              -{discPct}%
                            </span>
                          )}
                          {p.review_count > 0 && (
                            <span style={{ fontSize:10, color:'#FBBF24', fontWeight:700 }}>
                              ★ {Number(p.avg_rating||0).toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>

                      <span style={{ fontSize:14, color:'var(--viro-textSub)', flexShrink:0 }}>›</span>
                    </button>
                  )
                })}
              </div>

              {/* See all */}
              <button onClick={() => goToShop()}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                  width:'100%', marginTop:12, padding:'12px',
                  borderRadius:14, border:'1px dashed var(--viro-border)',
                  background:'var(--viro-bgDeep)', cursor:'pointer',
                  fontSize:13, fontWeight:700, color:'#A78BFA',
                }}>
                See all results for &ldquo;{query}&rdquo; →
              </button>
            </>
          )}

          {/* No results */}
          {searched && !searching && query.trim().length >= 2 && suggestions.length === 0 && (
            <div style={{ textAlign:'center', padding:'32px 0' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🔍</div>
              <p style={{ fontSize:15, fontWeight:700, color:'var(--viro-text)', marginBottom:6 }}>
                No results for &ldquo;{query}&rdquo;
              </p>
              <p style={{ fontSize:13, color:'var(--viro-textSub)', marginBottom:20 }}>
                Try a different spelling or browse categories
              </p>
              <button onClick={() => goToShop()}
                style={{ padding:'10px 24px', borderRadius:12, fontSize:13, fontWeight:700,
                  background:'linear-gradient(135deg,#6366f1,#8B5CF6)', color:'#fff',
                  border:'none', cursor:'pointer' }}>
                Search in Shop →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}


export default function Navbar() {
  const { cartCount, cartReady, pulseCartNav } = useCart()
  const { wishlistCount, wishlistReady }  = useWishlist()
  const { user }                          = useUserAuth()
  const NAV = user?.email ? NAV_LOGGED : NAV_BASE
  const pathname = usePathname()
  const [expanded,  setExpanded]  = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  function toggleSidebar() {
    const next = !expanded
    setExpanded(next)
    const main = document.getElementById('viro-main')
    if (main) main.style.marginLeft = next ? '220px' : '64px'
  }

  // Close search on route change
  useEffect(() => { setSearchOpen(false) }, [pathname])

  return (
    <>
      <style>{`
        .nav-logo-img { animation: logoFloat 3.5s ease-in-out infinite; }
        @keyframes logoFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
        @keyframes vroCartPulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(236,72,153,0)); opacity: 1; }
          50% { transform: scale(1.65); filter: drop-shadow(0 0 10px rgba(236,72,153,0.9)); opacity: 0.45; }
        }
        @keyframes vroCartAttract {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(139,92,246,0)); opacity: 1; }
          50% { transform: scale(1.22); filter: drop-shadow(0 0 5px rgba(139,92,246,0.6)); opacity: 0.75; }
        }
        .nav-item-d { transition: all 0.18s cubic-bezier(.4,0,.2,1); }
        .nav-item-d:hover { transform: translateX(2px); }
        .sidebar-w { width: 64px; transition: width 0.25s cubic-bezier(.4,0,.2,1); }
        .sidebar-w.open { width: 220px; }
        .sidebar-label { opacity: 0; width: 0; overflow: hidden; transition: opacity 0.2s, width 0.2s; white-space:nowrap; }
        .sidebar-w.open .sidebar-label { opacity: 1; width: auto; }
        .sidebar-w.open .brand-name { opacity: 1; }
        .brand-name { opacity: 0; transition: opacity 0.2s; }
        @keyframes slideDown { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes searchSlideUp { from{opacity:0;transform:translateY(60px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

      {/* Global search overlay — rendered at top level so it covers everything */}
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}

      {/* ── Desktop sidebar ── */}
      <aside
        className={`hidden md:flex flex-col fixed left-0 z-40 py-4 sidebar-w ${expanded ? 'open' : ''}`}
        style={{
          background: 'var(--viro-navBg)',
          borderRight: '1px solid var(--viro-navBorder)',
          top: '36px',
          height: 'calc(100vh - 36px)',
          overflow: 'hidden',
          transition: 'width 0.25s cubic-bezier(.4,0,.2,1), background 0.35s, border-color 0.35s',
        }}>

        {/* Toggle button */}
        <button onClick={() => toggleSidebar()}
          className="flex items-center justify-center mb-3 mx-auto rounded-xl transition-all hover:opacity-80"
          style={{ width:40, height:40, background:'var(--viro-bgCard)',
            border:'1px solid var(--viro-border)', flexShrink:0 }}
          aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'}
          title={expanded ? 'Collapse' : 'Expand'}>
          <span className="text-sm" style={{ color:'var(--viro-textSub)' }}>
            {expanded ? '◀' : '☰'}
          </span>
        </button>

        {/* Logo */}
        <Link href="/" className="nav-logo-img flex items-center gap-2.5 px-3 mb-5 flex-shrink-0 overflow-hidden">
          <Image src={LOGO_URL} alt="Viro"
            width={40} height={40}
            className="rounded-xl object-cover flex-shrink-0"
            style={{ width:40, height:40, border:'2px solid var(--viro-border)' }} />
          <div className="brand-name">
            <p className="font-extrabold text-sm leading-tight" style={{ color:'var(--viro-text)' }}>Viro™</p>
            <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>viro.pk</p>
          </div>
        </Link>

        {/* Search button in sidebar */}
        <button onClick={() => setSearchOpen(true)}
          className="nav-item-d flex items-center gap-3 rounded-xl overflow-hidden mx-2 mb-1"
          style={{ padding:'10px 10px', background:'transparent', border:'1px solid transparent',
            color:'var(--viro-textSub)', fontWeight:500, width:'calc(100% - 16px)',
            cursor:'pointer', textAlign:'left' }}
          aria-label="Open search"
          title="Search">
          <span className="text-xl flex-shrink-0" style={{ minWidth:28, textAlign:'center' }}>🔍</span>
          <span className="sidebar-label text-sm">Search</span>
        </button>

        {/* Nav links */}
        <nav className="flex flex-col gap-1 px-2 flex-1" aria-label="Sidebar navigation">
          {NAV.map(n => {
            const active = pathname === n.path
            return (
              <Link key={n.path} href={n.path} title={n.label}
                className="nav-item-d flex items-center gap-3 rounded-xl overflow-hidden"
                style={{ padding:'10px 10px',
                  background: active ? 'linear-gradient(135deg,#00BFFF18,#8B5CF630)' : 'transparent',
                  color: active ? '#A78BFA' : 'var(--viro-textSub)',
                  border: active ? '1px solid #8B5CF640' : '1px solid transparent',
                  fontWeight: active ? 700 : 500, minWidth:0 }}>
                <span className="text-xl relative flex-shrink-0" style={{ minWidth:28, textAlign:'center' }}>
                  {n.label === 'Account' && user?.avatar
                    ? <img src={user.avatar} alt="" style={{ width:24, height:24, borderRadius:'50%', border: active?'2px solid #8B5CF6':'1.5px solid #8B5CF640', display:'inline-block' }}/>
                    : NAV_ICONS[n.label]
                  }
                  {n.label === 'Cart' && cartReady && cartCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
                      style={{ background:'linear-gradient(135deg,#8B5CF6,#F97316)', fontSize:8 }}>
                      {cartCount > 9 ? '9+' : cartCount}
                    </span>
                  )}
                  {n.label === 'Wishlist' && wishlistReady && wishlistCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
                      style={{ background:'linear-gradient(135deg,#F43F5E,#F97316)', fontSize:8 }}>
                      {wishlistCount > 9 ? '9+' : wishlistCount}
                    </span>
                  )}
                </span>
                <span className="sidebar-label text-sm">{n.label}</span>
                {active && expanded && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background:'#A78BFA' }} />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer brand */}
        <div className="px-3 pb-1 pt-3 border-t overflow-hidden" style={{ borderColor:'var(--viro-navBorder)' }}>
          <p className="text-xs font-bold sidebar-label" style={{ color:'var(--viro-textSub)', letterSpacing:'0.08em' }}>VIRO © 2026</p>
          <div className="w-7 h-0.5 rounded-full mx-auto" style={{ background:'linear-gradient(90deg,#00BFFF,#8B5CF6)' }} />
        </div>
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex"
        aria-label="Main navigation"
        style={{ background:'var(--viro-navBg)', borderTop:'1px solid var(--viro-navBorder)',
          paddingBottom:'env(safe-area-inset-bottom)',
          transition:'background 0.35s, border-color 0.35s' }}>

        {/* Search tab on mobile */}
        {[...NAV.slice(0,2),
          { path: null, label: 'Search', icon: '🔍', isSearch: true },
          ...NAV.slice(2)
        ].map(n => {
          if (n.isSearch) {
            return (
              <button key="search" onClick={() => setSearchOpen(true)}
                className="flex-1 flex flex-col items-center py-2 gap-0.5 relative transition-all"
                aria-label="Search"
                style={{ background:'none', border:'none', cursor:'pointer' }}>
                <span className="text-xl">🔍</span>
                <span className="text-xs font-semibold" style={{ color:'var(--viro-textSub)' }}>Search</span>
              </button>
            )
          }
          const active = pathname === n.path
          return (
            <Link key={n.path} href={n.path}
              className="flex-1 flex flex-col items-center py-2 gap-0.5 relative transition-all">
              <span className="text-xl relative transition-transform"
                style={{
                  transform: n.label === 'Cart' && (pulseCartNav || (cartReady && cartCount > 0))
                    ? undefined
                    : (active ? 'scale(1.15)' : 'scale(1)'),
                  animation: n.label === 'Cart'
                    ? (pulseCartNav ? 'vroCartPulse 0.6s ease-in-out 4' : (cartReady && cartCount > 0 ? 'vroCartAttract 1.8s ease-in-out infinite' : undefined))
                    : undefined,
                }}>
                {/* Show avatar on Account tab when Google logged in */}
                {n.label === 'Account' && user?.avatar
                  ? <img src={user.avatar} alt="" style={{ width:24, height:24, borderRadius:'50%', border: active ? '2px solid #8B5CF6' : '1.5px solid #8B5CF640' }}/>
                  : n.label === 'Orders' && user?.avatar
                  ? <img src={user.avatar} alt="" style={{ width:22, height:22, borderRadius:'50%', border:'1.5px solid #8B5CF6' }}/>
                  : NAV_ICONS[n.label]
                }
                {n.label === 'Cart' && cartReady && cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
                    style={{ background:'linear-gradient(135deg,#8B5CF6,#F97316)', fontSize:9 }}>
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
                {n.label === 'Wishlist' && wishlistReady && wishlistCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
                    style={{ background:'linear-gradient(135deg,#F43F5E,#F97316)', fontSize:9 }}>
                    {wishlistCount > 9 ? '9+' : wishlistCount}
                  </span>
                )}
              </span>
              <span className="text-xs font-semibold transition-all"
                style={{ color: active ? '#A78BFA' : 'var(--viro-textSub)' }}>
                {n.label}
              </span>
              {active && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ background:'linear-gradient(90deg,#00BFFF,#8B5CF6)' }} />
              )}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
