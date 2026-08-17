'use client'
import { supabase } from '../lib/supabase'
import React, { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const COLORS = ['#8B5CF6','#00BFFF','#F97316','#10B981','#F43F5E','#F59E0B']

export default function AnalyticsTab() {
  const [loading,     setLoading]     = useState(true)
  const [revenueData, setRevenueData] = useState([])   // daily revenue last 30d
  const [topProducts, setTopProducts] = useState([])   // top 5 by revenue
  const [cityData,    setCityData]    = useState([])   // orders by city
  const [couponData,  setCouponData]  = useState([])   // coupon usage
  const [loginData,   setLoginData]   = useState({ google:0, guest:0 }) // login breakdown
  const [cartData,    setCartData]    = useState(null) // cart adds summary (this period)
  const [range,       setRange]       = useState('30') // '7' | '30' | '90'

  useEffect(() => {
    setLoading(true)
    const days = parseInt(range)
    const from = new Date(Date.now() - days * 86400000).toISOString()

    Promise.all([
      // Daily revenue
      supabase.from('orders')
        .select('created_at, final_total, status')
        .gte('created_at', from)
        .neq('status', 'CANCELLED'),

      // Order items for top products
      supabase.from('order_items')
        .select('product_id, quantity, price, products(name), orders(created_at, status)')
        .gte('orders.created_at', from),

      // Orders by city
      supabase.from('orders')
        .select('customers(city), final_total, status')
        .gte('created_at', from)
        .neq('status', 'CANCELLED'),

      // Coupon usage
      supabase.from('orders')
        .select('coupon_code, coupon_discount, final_total')
        .gte('created_at', from)
        .not('coupon_code', 'is', null),

      // Google vs Guest customers (all time — not date-filtered)
      supabase.from('customers')
        .select('auth_user_id'),

      // Cart add activity — distinct from orders entirely. One row per
      // (session, product) pair, upserted on every add-to-cart. quantity
      // here is "current quantity in cart", not "number of times added" —
      // we count rows (= distinct items added) and distinct sessions for
      // the "X carts by Y people" view, not a sum of quantities.
      supabase.from('cart_items')
        .select('session_id, customer_id, product_id, quantity, added_at, products(name)')
        .gte('added_at', from),
    ]).then(([ordersRes, itemsRes, cityRes, couponRes, custRes, cartRes]) => {

      // ── Login breakdown ──────────────────────────────────────
      const allCust = custRes.data || []
      setLoginData({
        google: allCust.filter(c => !!c.auth_user_id).length,
        guest:  allCust.filter(c => !c.auth_user_id).length,
      })

      // ── Daily revenue ────────────────────────────────────────
      const byDay = {}
      ;(ordersRes.data || []).forEach(o => {
        const day = o.created_at.slice(0,10)
        byDay[day] = (byDay[day] || 0) + (o.final_total || 0)
      })
      const sortedDays = Object.entries(byDay)
        .sort(([a],[b]) => a.localeCompare(b))
        .map(([date, revenue]) => ({
          date: new Date(date).toLocaleDateString('en-PK', { month:'short', day:'numeric' }),
          revenue: Math.round(revenue),
        }))
      setRevenueData(sortedDays)

      // ── Top 5 products ───────────────────────────────────────
      const byProduct = {}
      ;(itemsRes.data || []).forEach(item => {
        if (item.orders?.status === 'CANCELLED') return
        const name = item.products?.name || 'Unknown'
        if (!byProduct[name]) byProduct[name] = { name, revenue:0, units:0 }
        byProduct[name].revenue += (item.price || 0) * (item.quantity || 1)
        byProduct[name].units   += item.quantity || 1
      })
      setTopProducts(
        Object.values(byProduct)
          .sort((a,b) => b.revenue - a.revenue)
          .slice(0,5)
          .map(p => ({ ...p, revenue: Math.round(p.revenue) }))
      )

      // ── Orders by city ───────────────────────────────────────
      const byCity = {}
      ;(cityRes.data || []).forEach(o => {
        // Normalize city to Title Case so 'BUREWALA' and 'Burewala' merge
        const rawCity = o.customers?.city || 'Unknown'
        const city = rawCity.charAt(0).toUpperCase() + rawCity.slice(1).toLowerCase()
        if (!byCity[city]) byCity[city] = { city, orders:0, revenue:0 }
        byCity[city].orders++
        byCity[city].revenue += o.final_total || 0
      })
      setCityData(
        Object.values(byCity).sort((a,b) => b.orders - a.orders).slice(0,8)
      )

      // ── Coupon usage ─────────────────────────────────────────
      const byCoupon = {}
      ;(couponRes.data || []).forEach(o => {
        const code = o.coupon_code
        if (!byCoupon[code]) byCoupon[code] = { code, uses:0, savings:0 }
        byCoupon[code].uses++
        byCoupon[code].savings += o.coupon_discount || 0
      })
      setCouponData(Object.values(byCoupon).sort((a,b) => b.uses - a.uses))

      // ── Cart activity (adds-to-cart, this date range) ─────────
      const cartRows = cartRes.data || []
      const uniqueSessions = new Set(cartRows.map(r => r.session_id))
      const sessionsWithAccount = new Set(cartRows.filter(r => r.customer_id).map(r => r.session_id))
      const guestSessions = uniqueSessions.size - sessionsWithAccount.size

      const cartByDay = {}
      cartRows.forEach(r => {
        const day = (r.added_at || '').slice(0,10)
        if (!day) return
        if (!cartByDay[day]) cartByDay[day] = new Set()
        cartByDay[day].add(r.session_id)
      })
      const cartDaily = Object.entries(cartByDay)
        .sort(([a],[b]) => a.localeCompare(b))
        .map(([date, sessions]) => ({
          date: new Date(date).toLocaleDateString('en-PK', { month:'short', day:'numeric' }),
          sessions: sessions.size,
        }))

      // Top products by number of distinct sessions that added them —
      // answers "how many different people added this", not raw row count.
      const productSessionMap = {}
      cartRows.forEach(r => {
        const name = r.products?.name || 'Unknown'
        if (!productSessionMap[name]) productSessionMap[name] = new Set()
        productSessionMap[name].add(r.session_id)
      })
      const cartTopProducts = Object.entries(productSessionMap)
        .map(([name, sessions]) => ({ name, sessions: sessions.size }))
        .sort((a,b) => b.sessions - a.sessions)
        .slice(0, 5)

      setCartData({
        totalAdds: cartRows.length,
        uniqueSessions: uniqueSessions.size,
        accountSessions: sessionsWithAccount.size,
        guestSessions,
        daily: cartDaily,
        topProducts: cartTopProducts,
      })

      setLoading(false)
    }).catch(() => setLoading(false))
  }, [range])

  const totalRevenue = revenueData.reduce((s,d) => s + d.revenue, 0)
  const totalOrders  = cityData.reduce((s,c) => s + c.orders, 0)

  if (loading) return (
    <div className="flex justify-center py-16">
      <svg className="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="3" className="opacity-25"/>
        <path fill="#8B5CF6" d="M4 12a8 8 0 018-8v8z" className="opacity-75"/>
      </svg>
    </div>
  )

  return (
    <div className="space-y-5 fade-in">

      {/* Range selector */}
      <div className="flex items-center justify-between">
        <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>📊 Revenue Analytics</p>
        <div className="flex gap-1">
          {[['7','7d'],['30','30d'],['90','90d']].map(([v,l]) => (
            <button key={v} onClick={() => setRange(v)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={range === v
                ? { background:'linear-gradient(135deg,#8B5CF6,#00BFFF)', color:'#fff' }
                : { background:'var(--viro-bgDeep)', color:'var(--viro-textSub)',
                    border:'1px solid var(--viro-border)' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="viro-card p-3">
          <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>💰 Total Revenue</p>
          <p className="text-lg font-extrabold" style={{ color:'#10B981' }}>
            Rs.{totalRevenue.toLocaleString()}
          </p>
        </div>
        <div className="viro-card p-3">
          <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>📦 Total Orders</p>
          <p className="text-lg font-extrabold" style={{ color:'#8B5CF6' }}>
            {totalOrders}
          </p>
        </div>
      </div>

      {/* Revenue line chart */}
      {revenueData.length > 1 && (
        <div className="viro-card p-4">
          <p className="text-xs font-bold uppercase tracking-wider mb-3"
            style={{ color:'var(--viro-textSub)' }}>Daily Revenue</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={revenueData} margin={{ top:4, right:8, bottom:0, left:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--viro-border)" />
              <XAxis dataKey="date" tick={{ fontSize:9, fill:'var(--viro-textSub)' }}
                interval="preserveStartEnd" />
              <YAxis tick={{ fontSize:9, fill:'var(--viro-textSub)' }}
                tickFormatter={v => `${Math.round(v/1000)}k`} width={32} />
              <Tooltip
                contentStyle={{ background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)',
                  borderRadius:8, fontSize:11 }}
                formatter={v => [`Rs.${v.toLocaleString()}`, 'Revenue']} />
              <Line type="monotone" dataKey="revenue" stroke="#8B5CF6" strokeWidth={2}
                dot={false} activeDot={{ r:4, fill:'#8B5CF6' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top products bar chart */}
      {topProducts.length > 0 && (
        <div className="viro-card p-4">
          <p className="text-xs font-bold uppercase tracking-wider mb-3"
            style={{ color:'var(--viro-textSub)' }}>Top 5 Products by Revenue</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={topProducts} margin={{ top:4, right:8, bottom:24, left:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--viro-border)" />
              <XAxis dataKey="name" tick={{ fontSize:8, fill:'var(--viro-textSub)' }}
                angle={-25} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize:9, fill:'var(--viro-textSub)' }}
                tickFormatter={v => `${Math.round(v/1000)}k`} width={32} />
              <Tooltip
                contentStyle={{ background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)',
                  borderRadius:8, fontSize:11 }}
                formatter={(v,n) => [n === 'revenue' ? `Rs.${v.toLocaleString()}` : v, n]} />
              <Bar dataKey="revenue" name="Revenue" radius={[4,4,0,0]}>
                {topProducts.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* City pie chart + table */}
      {cityData.length > 0 && (
        <div className="viro-card p-4">
          <p className="text-xs font-bold uppercase tracking-wider mb-3"
            style={{ color:'var(--viro-textSub)' }}>Orders by City</p>
          <div className="flex gap-4 items-center flex-wrap">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={cityData} dataKey="orders" nameKey="city"
                  cx="50%" cy="50%" outerRadius={70} innerRadius={36}>
                  {cityData.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)',
                    borderRadius:8, fontSize:11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 min-w-0 space-y-1.5">
              {cityData.map((c,i) => (
                <div key={c.city} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="flex-1 truncate font-medium" style={{ color:'var(--viro-text)' }}>
                    {c.city}
                  </span>
                  <span style={{ color:'var(--viro-textSub)' }}>{c.orders} orders</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Coupon usage */}
      {couponData.length > 0 && (
        <div className="viro-card p-4">
          <p className="text-xs font-bold uppercase tracking-wider mb-3"
            style={{ color:'var(--viro-textSub)' }}>🎟️ Coupon Usage</p>
          <div className="space-y-2">
            {couponData.map(c => (
              <div key={c.code} className="flex items-center justify-between text-xs px-3 py-2 rounded-xl"
                style={{ background:'var(--viro-bgDeep)' }}>
                <span className="font-mono font-bold" style={{ color:'#A78BFA' }}>{c.code}</span>
                <span style={{ color:'var(--viro-textSub)' }}>{c.uses} uses</span>
                <span style={{ color:'#10B981', fontWeight:700 }}>
                  −Rs.{Math.round(c.savings).toLocaleString()} saved
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cart Activity — "X carts by Y people" + guest vs account split */}
      {cartData && cartData.uniqueSessions > 0 && (
        <div className="viro-card p-4">
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color:'var(--viro-textSub)' }}>
            🛒 Cart Activity (Add to Cart)
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-xl p-3 text-center" style={{ background:'#8B5CF615', border:'1px solid #8B5CF640' }}>
              <p className="text-xl font-black" style={{ color:'#8B5CF6' }}>{cartData.totalAdds}</p>
              <p className="text-xs font-bold" style={{ color:'#8B5CF6' }}>Items Added</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background:'#00BFFF15', border:'1px solid #00BFFF40' }}>
              <p className="text-xl font-black" style={{ color:'#00BFFF' }}>{cartData.uniqueSessions}</p>
              <p className="text-xs font-bold" style={{ color:'#00BFFF' }}>Unique Visitors</p>
            </div>
          </div>

          {/* Guest vs Account split, same visual pattern as Login Breakdown below */}
          <div className="flex gap-3 mb-3">
            <div className="flex-1 rounded-xl p-2.5 text-center" style={{ background:'#10B98115', border:'1px solid #10B98140' }}>
              <p className="text-base font-black" style={{ color:'#10B981' }}>{cartData.accountSessions}</p>
              <p className="text-xs font-bold" style={{ color:'#10B981' }}>🟢 Logged-in</p>
            </div>
            <div className="flex-1 rounded-xl p-2.5 text-center" style={{ background:'#94A3B815', border:'1px solid #94A3B830' }}>
              <p className="text-base font-black" style={{ color:'#94A3B8' }}>{cartData.guestSessions}</p>
              <p className="text-xs font-bold" style={{ color:'#94A3B8' }}>⚪ Guest</p>
            </div>
          </div>

          {/* Daily unique-visitor trend */}
          {cartData.daily.length > 1 && (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={cartData.daily} margin={{ top:4, right:8, bottom:0, left:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--viro-border)" />
                <XAxis dataKey="date" tick={{ fontSize:9, fill:'var(--viro-textSub)' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize:9, fill:'var(--viro-textSub)' }} width={24} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)', borderRadius:8, fontSize:11 }}
                  formatter={v => [v, 'Visitors who added to cart']} />
                <Line type="monotone" dataKey="sessions" stroke="#00BFFF" strokeWidth={2} dot={false} activeDot={{ r:4, fill:'#00BFFF' }} />
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* Most-added products by unique visitor count */}
          {cartData.topProducts.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {cartData.topProducts.map(p => (
                <div key={p.name} className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg" style={{ background:'var(--viro-bgDeep)' }}>
                  <span className="truncate flex-1 mr-2" style={{ color:'var(--viro-text)' }}>{p.name}</span>
                  <span style={{ color:'#8B5CF6', fontWeight:700, flexShrink:0 }}>{p.sessions} {p.sessions === 1 ? 'visitor' : 'visitors'}</span>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs mt-3" style={{ color:'var(--viro-textSub)' }}>
            💡 Cart records older than 90 days are auto-cleaned to keep this fast and relevant.
          </p>
        </div>
      )}

      {/* Google vs Guest customer breakdown */}
      {(loginData.google + loginData.guest) > 0 && (() => {
        const total = loginData.google + loginData.guest
        const googlePct = Math.round((loginData.google / total) * 100)
        const guestPct  = 100 - googlePct
        return (
          <div className="viro-card p-4">
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color:'var(--viro-textSub)' }}>
              👤 Customer Login Breakdown (All Time)
            </p>
            <div className="flex gap-3 mb-3">
              <div className="flex-1 rounded-xl p-3 text-center" style={{ background:'#10B98115', border:'1px solid #10B98140' }}>
                <p className="text-xl font-black" style={{ color:'#10B981' }}>{loginData.google}</p>
                <p className="text-xs font-bold" style={{ color:'#10B981' }}>🟢 Google Accounts</p>
                <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>{googlePct}% of customers</p>
              </div>
              <div className="flex-1 rounded-xl p-3 text-center" style={{ background:'#94A3B815', border:'1px solid #94A3B830' }}>
                <p className="text-xl font-black" style={{ color:'#94A3B8' }}>{loginData.guest}</p>
                <p className="text-xs font-bold" style={{ color:'#94A3B8' }}>⚪ Guest / Phone Only</p>
                <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>{guestPct}% of customers</p>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ height:8, borderRadius:4, background:'var(--viro-bgDeep)', overflow:'hidden' }}>
              <div style={{ width:`${googlePct}%`, height:'100%', background:'linear-gradient(90deg,#10B981,#059669)', borderRadius:4, transition:'width 0.5s' }}/>
            </div>
            <p className="text-xs mt-2 text-center" style={{ color:'var(--viro-textSub)' }}>
              {googlePct >= 50 ? '🎉 Most customers have Google accounts!' : '💡 Grow Google signups for better retention'}
            </p>
          </div>
        )
      })()}

      {revenueData.length === 0 && topProducts.length === 0 && (
        <div className="viro-card p-8 text-center">
          <div className="text-4xl mb-2">📊</div>
          <p className="font-bold" style={{ color:'var(--viro-text)' }}>No data yet</p>
          <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
            Analytics will appear once you have confirmed orders.
          </p>
        </div>
      )}
    </div>
  )
}
