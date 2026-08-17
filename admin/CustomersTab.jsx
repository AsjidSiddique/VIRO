'use client'
import { supabase } from '../lib/supabase'
import React, { useState, useEffect } from 'react'

// ── Customer risk scoring ────────────────────────────────────────────────────
function getRiskProfile(c) {
  const orders       = c.orders || []
  const total        = orders.length
  const returned     = orders.filter(o => o.status === 'RETURNED').length
  const cancelled    = orders.filter(o => o.status === 'CANCELLED').length
  const delivered    = orders.filter(o => o.status === 'DELIVERED').length
  const returnRate   = total > 0 ? returned / total : 0
  const cancelRate   = total > 0 ? cancelled / total : 0
  const isGoogle     = !!c.auth_user_id

  // 🔴 Fake / high-risk
  if (returned >= 2 || returnRate >= 0.5 || (cancelled >= 3 && !isGoogle)) {
    return { level: 'red', label: 'High Risk', dot: '#EF4444', bg: '#EF444418', border: '#EF444440',
      hint: `${returned} return${returned!==1?'s':''}, ${cancelled} cancel${cancelled!==1?'s':''}` }
  }
  // 🟠 Caution
  if (returned >= 1 || cancelRate >= 0.4 || (cancelled >= 2 && !isGoogle)) {
    return { level: 'orange', label: 'Caution', dot: '#F97316', bg: '#F9731618', border: '#F9731640',
      hint: `${returned} return${returned!==1?'s':''}, ${cancelled} cancel${cancelled!==1?'s':''}` }
  }
  // 🟢 Google verified
  if (isGoogle && delivered >= 1) {
    return { level: 'green', label: 'Verified', dot: '#10B981', bg: '#10B98118', border: '#10B98140',
      hint: 'Google account · ' + delivered + ' delivered' }
  }
  // 🟣 Regular repeat customer
  if (delivered >= 2) {
    return { level: 'purple', label: 'Regular', dot: '#8B5CF6', bg: '#8B5CF618', border: '#8B5CF640',
      hint: delivered + ' successful orders' }
  }
  // 🔵 New / one order
  if (total === 0) {
    return { level: 'grey', label: 'No Orders', dot: '#64748B', bg: '#64748B18', border: '#64748B40', hint: 'No orders yet' }
  }
  return { level: 'blue', label: 'New', dot: '#00BFFF', bg: '#00BFFF18', border: '#00BFFF40',
    hint: total + ' order' + (total!==1?'s':'') + ', ' + delivered + ' delivered' }
}

function RiskDot({ risk, size = 10 }) {
  return (
    <span title={`${risk.label}: ${risk.hint}`} style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      background: risk.dot, flexShrink: 0,
      boxShadow: `0 0 5px ${risk.dot}80`,
    }} />
  )
}

function RiskBadge({ risk }) {
  return (
    <span title={risk.hint} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
      background: risk.bg, color: risk.dot, border: `1px solid ${risk.border}`,
      whiteSpace: 'nowrap', cursor: 'help',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: risk.dot, flexShrink:0 }} />
      {risk.label}
    </span>
  )
}

function LoginBadge({ customer }) {
  const linked = !!customer.auth_user_id
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20,
      background: linked ? '#10B98115' : '#94A3B815',
      color: linked ? '#10B981' : '#64748B',
      border: `1px solid ${linked ? '#10B98140' : '#94A3B830'}`,
      whiteSpace: 'nowrap',
    }}>
      {linked ? '🟢 Google' : '⚪ Guest'}
    </span>
  )
}

// ── Colour legend tooltip ─────────────────────────────────────────────────────
function ColorLegend() {
  const [show, setShow] = useState(false)
  const items = [
    { dot: '#EF4444', label: 'High Risk',  desc: '2+ returns or 3+ cancels — possible fake order customer' },
    { dot: '#F97316', label: 'Caution',    desc: '1 return or 2 cancels — watch before dispatching' },
    { dot: '#10B981', label: 'Verified',   desc: 'Google account with successful delivery — trusted' },
    { dot: '#8B5CF6', label: 'Regular',    desc: '2+ successful deliveries — loyal repeat customer' },
    { dot: '#00BFFF', label: 'New',        desc: 'New customer, not enough history yet' },
    { dot: '#64748B', label: 'No Orders',  desc: 'Registered but never ordered' },
  ]
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setShow(s => !s)}
        style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
          background: '#8B5CF618', color: '#A78BFA', border: '1px solid #8B5CF640' }}>
        🎨 Color Guide
      </button>
      {show && (
        <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 999, minWidth: 280,
          background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)',
          borderRadius: 14, padding: '12px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          <p style={{ fontSize: 11, fontWeight: 900, color: 'var(--viro-textSub)', marginBottom: 10,
            textTransform: 'uppercase', letterSpacing: 1 }}>Customer Risk Colors</p>
          {items.map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.dot,
                flexShrink: 0, marginTop: 2, boxShadow: `0 0 5px ${item.dot}80` }} />
              <div>
                <p style={{ fontSize: 11, fontWeight: 800, color: item.dot, margin: 0 }}>{item.label}</p>
                <p style={{ fontSize: 10, color: 'var(--viro-textSub)', margin: 0 }}>{item.desc}</p>
              </div>
            </div>
          ))}
          <button onClick={() => setShow(false)}
            style={{ width: '100%', marginTop: 4, padding: '6px', borderRadius: 8, fontSize: 11,
              background: 'var(--viro-bgDeep)', color: 'var(--viro-textMuted)', border: 'none', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      )}
    </div>
  )
}

// ── Order history mini-table ──────────────────────────────────────────────────
const STATUS_COLOR = {
  UNPAID:'#F97316', CONFIRMED:'#8B5CF6', PROCESSING:'#00BFFF',
  SHIPPED:'#3B82F6', DELIVERED:'#10B981', RETURNED:'#EF4444', CANCELLED:'#94A3B8'
}
const STATUS_ICON = {
  UNPAID:'⏳', CONFIRMED:'✅', PROCESSING:'⚙️', SHIPPED:'🚚',
  DELIVERED:'📦', RETURNED:'↩️', CANCELLED:'❌'
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CustomersTab({ onOpenOrder, onBack }) {
  const [customers,    setCustomers]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [sortBy,       setSortBy]       = useState('spend')
  const [loginFilter,  setLoginFilter]  = useState('all')
  const [riskFilter,   setRiskFilter]   = useState('all')   // 'all'|'red'|'orange'|'green'|'purple'|'blue'
  const [cityFilter,   setCityFilter]   = useState('all')
  const [expanded,     setExpanded]     = useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase
        .from('customers')
        .select('id, name, phone, email, city, address, created_at, auth_user_id, gender, date_of_birth, orders(id, final_total, status, created_at, payment_method, payment_status)')
        .order('created_at', { ascending: false }),
      // Cart data via service-role endpoint — the anon key has no SELECT
      // permission on cart_items, so the join above would always return [] for
      // cart_items. This endpoint reads with the service role key server-side.
      fetch('/api/admin-cart').then(r => r.json()).catch(() => ({ ok: false, cartDetail: [] })),
    ]).then(([{ data }, cartApiRes]) => {
      // Build a lookup: customer_id → [cart rows]
      const cartByCustomer = {}
      ;(cartApiRes?.cartDetail || []).forEach(row => {
        if (!row.customer_id) return
        if (!cartByCustomer[row.customer_id]) cartByCustomer[row.customer_id] = []
        cartByCustomer[row.customer_id].push(row)
      })
      const enriched = (data || []).map(c => ({
        ...c,
        orderCount:  c.orders?.length || 0,
        totalSpend:  c.orders?.filter(o => o.status !== 'CANCELLED').reduce((s,o) => s+(o.final_total||0), 0) || 0,
        returnCount: c.orders?.filter(o => o.status === 'RETURNED').length || 0,
        cancelCount: c.orders?.filter(o => o.status === 'CANCELLED').length || 0,
        deliveredCount: c.orders?.filter(o => o.status === 'DELIVERED').length || 0,
        lastOrder:   c.orders?.sort((a,b) => new Date(b.created_at)-new Date(a.created_at))[0] || null,
        cartItems:   cartByCustomer[c.id] || [],
        risk:        getRiskProfile({ ...c, orders: c.orders || [] }),
      }))
      setCustomers(enriched)
      setLoading(false)
    })
  }, [])

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalCustomers = customers.length
  const googleUsers    = customers.filter(c => !!c.auth_user_id).length
  const guestUsers     = totalCustomers - googleUsers
  const totalRevenue   = customers.reduce((s,c) => s+c.totalSpend, 0)
  const avgSpend       = totalCustomers ? Math.round(totalRevenue/totalCustomers) : 0
  const highRisk       = customers.filter(c => c.risk.level === 'red').length
  const cautionCount   = customers.filter(c => c.risk.level === 'orange').length
  const regularCount   = customers.filter(c => c.risk.level === 'purple').length

  const allCities = [...new Set(customers.map(c => c.city).filter(Boolean))].sort()

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const filtered = customers
    .filter(c => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (c.name||'').toLowerCase().includes(q) ||
             (c.phone||'').includes(q) ||
             (c.email||'').toLowerCase().includes(q) ||
             (c.city||'').toLowerCase().includes(q)
    })
    .filter(c => {
      if (loginFilter === 'google') return !!c.auth_user_id
      if (loginFilter === 'guest')  return !c.auth_user_id
      return true
    })
    .filter(c => riskFilter === 'all' ? true : c.risk.level === riskFilter)
    .filter(c => cityFilter === 'all' ? true : c.city === cityFilter)
    .sort((a,b) => {
      if (sortBy === 'spend')    return b.totalSpend - a.totalSpend
      if (sortBy === 'orders')   return b.orderCount - a.orderCount
      if (sortBy === 'risk')     return ['red','orange','blue','purple','green','grey'].indexOf(a.risk.level) - ['red','orange','blue','purple','green','grey'].indexOf(b.risk.level)
      if (sortBy === 'name')     return (a.name||'').localeCompare(b.name||'')
      if (sortBy === 'city')     return (a.city||'').localeCompare(b.city||'')
      if (sortBy === 'newest')   return new Date(b.created_at) - new Date(a.created_at)
      return 0
    })

  const CHIP = (active, onClick, children, color='#8B5CF6') => (
    <button onClick={onClick} style={{
      padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer',
      border:`1px solid ${active ? color+'80' : 'var(--viro-border)'}`,
      background: active ? color+'20' : 'transparent',
      color: active ? color : 'var(--viro-textSub)', transition:'all 0.15s',
    }}>{children}</button>
  )

  return (
    <div className="space-y-4 fade-in">

      {/* ── Back button ── */}
      {/* Navigation bar */}
      <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:12 }}>
        {onBack && (
          <button onClick={onBack}
            style={{ display:'inline-flex',alignItems:'center',gap:5,padding:'7px 14px',borderRadius:20,
              background:'var(--viro-bgDeep)',border:'1px solid var(--viro-border)',
              color:'var(--viro-textSub)',fontSize:12,fontWeight:700,cursor:'pointer' }}>
            ← Back
          </button>
        )}
        {onOpenOrder && (
          <button onClick={() => onOpenOrder?.('__orders_tab__')}
            style={{ display:'inline-flex',alignItems:'center',gap:5,padding:'7px 14px',borderRadius:20,
              background:'#8B5CF618',border:'1px solid #8B5CF640',
              color:'#A78BFA',fontSize:12,fontWeight:700,cursor:'pointer' }}>
            📋 Go to Orders
          </button>
        )}
        <span style={{ fontSize:11,color:'var(--viro-textSub)',marginLeft:4 }}>💡 Tap any order row to open it</span>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:'Total Customers', value: totalCustomers,                   color:'#00BFFF', icon:'👥' },
          { label:'Google Accounts', value: `${googleUsers} (${totalCustomers?Math.round(googleUsers/totalCustomers*100):0}%)`, color:'#10B981', icon:'🟢' },
          { label:'🔴 High Risk',    value: highRisk,                          color:'#EF4444', icon:'⚠️' },
          { label:'🟣 Regulars',     value: regularCount,                      color:'#8B5CF6', icon:'⭐' },
        ].map(s => (
          <div key={s.label} className="viro-card p-3">
            <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>{s.icon} {s.label}</p>
            <p className="text-base font-extrabold mt-0.5" style={{ color:s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Risk summary bar ── */}
      {(highRisk > 0 || cautionCount > 0) && (
        <div className="viro-card p-3" style={{ border:'1px solid #EF444430', background:'#EF444408' }}>
          <p className="text-xs font-bold mb-2" style={{ color:'#EF4444' }}>⚠️ Risk Alert</p>
          <div className="flex flex-wrap gap-2">
            {highRisk > 0 && (
              <button onClick={() => setRiskFilter(riskFilter==='red'?'all':'red')}
                style={{ display:'flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:20,
                  background:'#EF444420',border:'1px solid #EF444450',color:'#EF4444',
                  fontSize:11,fontWeight:800,cursor:'pointer' }}>
                🔴 {highRisk} High Risk customer{highRisk!==1?'s':''}
              </button>
            )}
            {cautionCount > 0 && (
              <button onClick={() => setRiskFilter(riskFilter==='orange'?'all':'orange')}
                style={{ display:'flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:20,
                  background:'#F9731620',border:'1px solid #F9731650',color:'#F97316',
                  fontSize:11,fontWeight:800,cursor:'pointer' }}>
                🟠 {cautionCount} Caution
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Search + Sort ── */}
      <div className="flex gap-3 flex-wrap items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search name, phone, email, city…"
          className="flex-1 min-w-[180px]" />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="rounded-xl text-xs" style={{ padding:'8px 12px' }}>
          <option value="spend">Top Spenders</option>
          <option value="orders">Most Orders</option>
          <option value="risk">By Risk Level</option>
          <option value="newest">Newest First</option>
          <option value="name">Name A–Z</option>
          <option value="city">City A–Z</option>
        </select>
        <ColorLegend />
      </div>

      {/* ── Filter chips ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color:'var(--viro-textSub)',marginRight:2 }}>Login:</span>
        {CHIP(loginFilter==='all',    () => setLoginFilter('all'),    `All (${totalCustomers})`)}
        {CHIP(loginFilter==='google', () => setLoginFilter('google'), `🟢 Google (${googleUsers})`, '#10B981')}
        {CHIP(loginFilter==='guest',  () => setLoginFilter('guest'),  `⚪ Guest (${guestUsers})`, '#64748B')}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color:'var(--viro-textSub)',marginRight:2 }}>Risk:</span>
        {CHIP(riskFilter==='all',    () => setRiskFilter('all'),    'All')}
        {CHIP(riskFilter==='red',    () => setRiskFilter('red'),    `🔴 High Risk (${highRisk})`, '#EF4444')}
        {CHIP(riskFilter==='orange', () => setRiskFilter('orange'), `🟠 Caution (${cautionCount})`, '#F97316')}
        {CHIP(riskFilter==='green',  () => setRiskFilter('green'),  `🟢 Verified (${customers.filter(c=>c.risk.level==='green').length})`, '#10B981')}
        {CHIP(riskFilter==='purple', () => setRiskFilter('purple'), `🟣 Regular (${regularCount})`, '#8B5CF6')}
        {CHIP(riskFilter==='blue',   () => setRiskFilter('blue'),   `🔵 New (${customers.filter(c=>c.risk.level==='blue').length})`, '#00BFFF')}
      </div>

      {allCities.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color:'var(--viro-textSub)',marginRight:2 }}>City:</span>
          {CHIP(cityFilter==='all', () => setCityFilter('all'), 'All Cities')}
          {allCities.slice(0,8).map(city => CHIP(cityFilter===city, () => setCityFilter(city===cityFilter?'all':city), `📍 ${city}`))}
        </div>
      )}

      <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
        Showing <strong style={{ color:'var(--viro-text)' }}>{filtered.length}</strong> of {totalCustomers} customers
      </p>

      {/* ── Customer list ── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <svg className="animate-spin w-7 h-7" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="3" className="opacity-25"/>
            <path fill="#8B5CF6" d="M4 12a8 8 0 018-8v8z" className="opacity-75"/>
          </svg>
        </div>
      ) : filtered.length === 0 ? (
        <div className="viro-card p-8 text-center">
          <div className="text-4xl mb-2">👥</div>
          <p className="font-bold" style={{ color:'var(--viro-text)' }}>No customers found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const risk = c.risk
            const isOpen = expanded === c.id
            return (
              <div key={c.id} className="viro-card overflow-hidden"
                style={{ borderLeft:`3px solid ${risk.dot}` }}>

                {/* Row */}
                <div className="px-4 py-3 flex items-center gap-3 cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : c.id)}>

                  {/* Avatar with risk dot */}
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white"
                      style={{ background: c.auth_user_id ? 'linear-gradient(135deg,#10B981,#059669)' : 'linear-gradient(135deg,#8B5CF6,#00BFFF)' }}>
                      {(c.name||'?')[0].toUpperCase()}
                    </div>
                    {/* Risk dot on avatar */}
                    <div style={{ position:'absolute', bottom:-1, right:-1, width:12, height:12,
                      borderRadius:'50%', background: risk.dot,
                      border:'2px solid var(--viro-bgCard)',
                      boxShadow:`0 0 4px ${risk.dot}` }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold truncate" style={{ color:'var(--viro-text)' }}>
                        {c.name||'—'}
                      </p>
                      <RiskBadge risk={risk} />
                      <LoginBadge customer={c} />
                    </div>
                    <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                      📍 {c.city||'—'} · {c.phone}
                      {c.email && <span style={{ color:'#A78BFA' }}> · {c.email}</span>}
                    </p>
                    {/* Quick order stats inline */}
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs" style={{ color:'#10B981' }}>📦 {c.deliveredCount} delivered</span>
                      {c.returnCount > 0  && <span className="text-xs" style={{ color:'#EF4444' }}>↩️ {c.returnCount} returned</span>}
                      {c.cancelCount > 0  && <span className="text-xs" style={{ color:'#94A3B8' }}>❌ {c.cancelCount} cancelled</span>}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold" style={{ color:'#10B981' }}>
                      Rs.{c.totalSpend.toLocaleString()}
                    </p>
                    <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                      {c.orderCount} order{c.orderCount!==1?'s':''}
                    </p>
                    {c.lastOrder && (
                      <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                        {new Date(c.lastOrder.created_at).toLocaleDateString('en-PK',{day:'2-digit',month:'short'})}
                      </p>
                    )}
                  </div>

                  <span style={{ color:'var(--viro-textSub)', fontSize:12, marginLeft:4 }}>
                    {isOpen ? '▲' : '▼'}
                  </span>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t fade-in" style={{ borderColor:'var(--viro-border)' }}>

                    {/* Risk breakdown box */}
                    <div className="mx-4 mt-3 mb-3 p-3 rounded-xl"
                      style={{ background: risk.bg, border:`1px solid ${risk.border}` }}>
                      <div className="flex items-center gap-2 mb-1">
                        <RiskDot risk={risk} size={10} />
                        <p className="text-xs font-extrabold" style={{ color: risk.dot }}>
                          {risk.label} Customer
                        </p>
                      </div>
                      <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>{risk.hint}</p>
                      <div className="flex gap-4 mt-2">
                        <div className="text-center">
                          <p className="text-sm font-bold" style={{ color:'#10B981' }}>{c.deliveredCount}</p>
                          <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>Delivered</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold" style={{ color:'#EF4444' }}>{c.returnCount}</p>
                          <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>Returned</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold" style={{ color:'#94A3B8' }}>{c.cancelCount}</p>
                          <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>Cancelled</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold" style={{ color:'#A78BFA' }}>{c.orderCount}</p>
                          <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>Total</p>
                        </div>
                      </div>
                    </div>

                    {/* Profile info grid */}
                    <div className="grid grid-cols-2 gap-2 mx-4 mb-3">
                      {[
                        { label:'Login',       value: c.auth_user_id ? '🟢 Google Account' : '⚪ Guest' },
                        { label:'Email',       value: c.email||'—' },
                        { label:'City',        value: c.city||'—' },
                        { label:'Member Since',value: new Date(c.created_at).toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric'}) },
                      ].map(({label,value}) => (
                        <div key={label} className="rounded-xl px-3 py-2" style={{ background:'var(--viro-bgDeep)' }}>
                          <p className="text-xs" style={{ color:'var(--viro-textSub)',marginBottom:1 }}>{label}</p>
                          <p className="text-xs font-bold" style={{ color:'var(--viro-text)' }}>{value}</p>
                        </div>
                      ))}
                    </div>

                    <p className="text-xs mx-4 mb-3" style={{ color:'var(--viro-textSub)' }}>
                      📦 {c.address||'No address saved'}
                    </p>

                    {/* Order history table */}
                    {c.orders?.length > 0 && (
                      <div className="mx-4 mb-3">
                        <p className="text-xs font-bold uppercase tracking-wider mb-2"
                          style={{ color:'var(--viro-textSub)' }}>Order History</p>
                        <div className="space-y-1.5">
                          {c.orders
                            .sort((a,b) => new Date(b.created_at)-new Date(a.created_at))
                            .map(o => {
                              const sc = STATUS_COLOR[o.status]||'#94A3B8'
                              const isReturn = o.status === 'RETURNED'
                              const isCancel = o.status === 'CANCELLED'
                              return (
                                <div key={o.id}
                                  onClick={() => onOpenOrder?.(o.id)}
                                  title="Click to open this order"
                                  className="flex justify-between items-center text-xs px-3 py-2 rounded-xl"
                                  style={{
                                    background: isReturn ? '#EF444410' : isCancel ? '#94A3B810' : 'var(--viro-bgDeep)',
                                    border: isReturn ? '1px solid #EF444430' : isCancel ? '1px solid #94A3B830' : 'none',
                                    cursor: onOpenOrder ? 'pointer' : 'default',
                                    transition: 'all 0.15s'
                                  }}
                                  onMouseEnter={e => { if(onOpenOrder) { e.currentTarget.style.background = isReturn ? '#EF444420' : '#8B5CF615'; e.currentTarget.style.borderColor = '#8B5CF640' }}}
                                  onMouseLeave={e => { e.currentTarget.style.background = isReturn ? '#EF444410' : isCancel ? '#94A3B810' : 'var(--viro-bgDeep)'; e.currentTarget.style.borderColor = '' }}>
                                  <span style={{ color:'var(--viro-textSub)',fontFamily:'monospace',fontSize:10 }}>
                                    #{o.id.slice(0,8).toUpperCase()}
                                  </span>
                                  <span style={{ fontSize:10 }}>
                                    {new Date(o.created_at).toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'2-digit'})}
                                  </span>
                                  <span className="font-bold px-2 py-0.5 rounded-full"
                                    style={{ background:sc+'20',color:sc,fontSize:9 }}>
                                    {STATUS_ICON[o.status]} {o.status}
                                  </span>
                                  {/* Payment method */}
                                  {o.payment_method && o.payment_method !== 'COD' ? (
                                    <span style={{ fontSize:9,fontWeight:800,padding:'1px 5px',borderRadius:10,
                                      background: o.payment_status==='PAID'?'#10B98118':'#F9731618',
                                      color: o.payment_status==='PAID'?'#10B981':'#F97316',
                                      border:`1px solid ${o.payment_status==='PAID'?'#10B98140':'#F9731640'}` }}>
                                      💳 {o.payment_status==='PAID'?'Paid':'Pending'}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:10,background:'#8B5CF618',color:'#A78BFA',border:'1px solid #8B5CF640' }}>
                                      💵 COD
                                    </span>
                                  )}
                                  <span style={{ color:'#10B981',fontWeight:700 }}>
                                    Rs.{(o.final_total||0).toLocaleString()}
                                  </span>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )}

                    {/* Current cart contents — what's sitting in this customer's cart right now */}
                    {c.cartItems?.length > 0 && (
                      <div className="mx-4 mb-3">
                        <p className="text-xs font-bold uppercase tracking-wider mb-2"
                          style={{ color:'var(--viro-textSub)' }}>🛒 Currently in Cart</p>
                        <div className="space-y-1.5">
                          {c.cartItems.map((ci, i) => (
                            <a key={i} href={ci.products?.id ? `/product/${ci.products.id}` : undefined}
                              target="_blank" rel="noopener noreferrer"
                              className="flex justify-between items-center text-xs px-3 py-2 rounded-xl"
                              style={{ background:'#7C3AED10', textDecoration:'none', cursor: ci.products?.id ? 'pointer':'default' }}>
                              <span style={{ color:'var(--viro-text)' }}>
                                {ci.products?.name || 'Unknown product'} <span style={{ color:'var(--viro-textSub)' }}>×{ci.quantity}</span>
                              </span>
                              {ci.source === 'instagram' && <span style={{ fontSize:9, fontWeight:800, color:'#E11341' }}>📷 IG</span>}
                              {ci.source === 'facebook'  && <span style={{ fontSize:9, fontWeight:800, color:'#1877F2' }}>👍 FB</span>}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick actions */}
                    <div className="flex gap-2 mx-4 mb-4">
                      <a href={`tel:${c.phone}`}
                        className="flex-1 text-center py-2 rounded-xl text-xs font-bold"
                        style={{ background:'#00BFFF15',color:'#00BFFF',border:'1px solid #00BFFF30' }}>
                        📞 Call
                      </a>
                      <a href={`https://wa.me/92${c.phone?.replace(/^0/,'')}?text=${encodeURIComponent(`Hi ${c.name}! This is Viro.pk.`)}`}
                        target="_blank" rel="noopener"
                        className="flex-1 text-center py-2 rounded-xl text-xs font-bold"
                        style={{ background:'#25D36615',color:'#25D366',border:'1px solid #25D36630' }}>
                        💬 WhatsApp
                      </a>
                      {c.email && (
                        <a href={`mailto:${c.email}`}
                          className="flex-1 text-center py-2 rounded-xl text-xs font-bold"
                          style={{ background:'#A78BFA15',color:'#A78BFA',border:'1px solid #A78BFA30' }}>
                          ✉️ Email
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
