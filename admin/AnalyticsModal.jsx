'use client'
import Portal from './Portal'
import { supabase } from '../lib/supabase'
import React, { useState, useEffect } from 'react'

function AnalyticsModal({ type, onClose, isLight, _cardBg, _cardBdr, textPrimary, textMuted, textSub }) {
  const _bg    = isLight ? '#F0F4F8' : '#080E1C'
  const modal = isLight ? '#FFFFFF' : '#0F172A'
  const bdr   = isLight ? '#E2E8F0' : '#1E293B'

  const today = new Date()
  const fmt = d => d.toISOString().slice(0,10)
  const [dateFrom, setDateFrom] = useState(fmt(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [dateTo,   setDateTo]   = useState(fmt(today))
  const [data,     setData]     = useState([])
  const [summary,  setSummary]  = useState(null)
  const [loading,  setLoading]  = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [dateFrom, dateTo, type])

  async function fetchData() {
    setLoading(true)
    try {
      const from = new Date(dateFrom); from.setHours(0,0,0,0)
      const to   = new Date(dateTo);   to.setHours(23,59,59,999)

      const { data: orders } = await supabase
        .from('orders')
        .select('created_at, final_total, status, order_items(quantity, products(name))')
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .order('created_at', { ascending: true })

      if (!orders) { setData([]); setSummary(null); setLoading(false); return }

      // Group by date
      const byDate = {}
      orders.forEach(o => {
        const d = o.created_at.slice(0,10)
        if (!byDate[d]) byDate[d] = { date:d, revenue:0, orders:0, delivered:0, cancelled:0, pending:0 }
        byDate[d].orders++
        if (o.status !== 'CANCELLED') byDate[d].revenue += (o.final_total || 0)
        if (o.status === 'DELIVERED')  byDate[d].delivered++
        if (o.status === 'CANCELLED')  byDate[d].cancelled++
        if (['UNPAID','PENDING','CONFIRMED'].includes(o.status)) byDate[d].pending++
      })

      // Product frequency for top sellers
      const productQty = {}
      orders.forEach(o => o.order_items?.forEach(item => {
        const n = item.products?.name || 'Unknown'
        productQty[n] = (productQty[n] || 0) + (item.quantity || 1)
      }))
      const topProducts = Object.entries(productQty).sort((a,b) => b[1]-a[1]).slice(0,8)

      const rows = Object.values(byDate)
      const totalRevenue = rows.reduce((s,r) => s + r.revenue, 0)
      const totalOrders  = rows.reduce((s,r) => s + r.orders,  0)
      const totalPending = orders.filter(o => ['UNPAID','PENDING','CONFIRMED'].includes(o.status)).length

      setData(rows)
      setSummary({ totalRevenue, totalOrders, totalPending, topProducts, avgOrder: totalOrders ? Math.round(totalRevenue/totalOrders) : 0 })
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  const TYPES = [
    { key:'revenue',   label:'💰 Revenue',   color:'#10B981' },
    { key:'orders',    label:'📋 Orders',    color:'#8B5CF6' },
    { key:'topseller', label:'🏆 Top Items', color:'#F97316' },
    { key:'pending',   label:'⏳ Pending',   color:'#F97316' },
  ]

  const activeColor = TYPES.find(t => t.key === type)?.color || '#8B5CF6'
  const maxVal = type === 'revenue' ? Math.max(...data.map(d => d.revenue), 1)
               : type === 'orders'  ? Math.max(...data.map(d => d.orders), 1)
               : type === 'pending' ? Math.max(...data.map(d => d.pending), 1)
               : 1

  return (
    <Portal>
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:modal, border:`1px solid ${bdr}`, borderRadius:20, width:'100%', maxWidth:640, maxHeight:'88vh', overflow:'auto', boxShadow:'0 24px 64px rgba(0,0,0,0.4)' }}>

        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${bdr}`, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:modal, zIndex:1 }}>
          <div>
            <h3 style={{ fontWeight:800, color:textPrimary, fontSize:16, margin:0 }}>📊 Analytics</h3>
            <p style={{ fontSize:11, color:textSub, margin:0 }}>Date-filtered insights</p>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', fontSize:20, cursor:'pointer', color:textMuted, padding:4 }}>✕</button>
        </div>

        {/* Type tabs */}
        <div style={{ display:'flex', gap:6, padding:'12px 20px 0', flexWrap:'wrap' }}>
          {TYPES.map(t => (
            <button key={t.key} onClick={() => { /* setType handled by parent but we can't — use local override */ }}
              style={{
                padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer',
                background: type === t.key ? t.color : 'transparent',
                color: type === t.key ? '#fff' : textMuted,
                border: `1px solid ${type === t.key ? t.color : bdr}`,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Date range pickers */}
        <div style={{ display:'flex', gap:10, padding:'12px 20px', alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            <label style={{ fontSize:10, color:textSub, fontWeight:600, textTransform:'uppercase' }}>From</label>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
              style={{ background: isLight?'#F1F5F9':'#1E293B', border:`1px solid ${bdr}`, borderRadius:8, padding:'6px 10px', color:textPrimary, fontSize:13, width:'auto' }} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            <label style={{ fontSize:10, color:textSub, fontWeight:600, textTransform:'uppercase' }}>To</label>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
              style={{ background: isLight?'#F1F5F9':'#1E293B', border:`1px solid ${bdr}`, borderRadius:8, padding:'6px 10px', color:textPrimary, fontSize:13, width:'auto' }} />
          </div>
          {/* Quick range buttons */}
          <div style={{ display:'flex', gap:4, marginTop:14, flexWrap:'wrap' }}>
            {[
              { label:'Today',    from: fmt(today), to: fmt(today) },
              { label:'7d',       from: fmt(new Date(today - 6*864e5)), to: fmt(today) },
              { label:'30d',      from: fmt(new Date(today - 29*864e5)), to: fmt(today) },
              { label:'This mo.', from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmt(today) },
            ].map(r => (
              <button key={r.label} onClick={() => { setDateFrom(r.from); setDateTo(r.to) }}
                style={{ padding:'4px 10px', borderRadius:16, fontSize:11, fontWeight:600, cursor:'pointer',
                  background: dateFrom===r.from && dateTo===r.to ? activeColor : (isLight?'#F1F5F9':'#1E293B'),
                  color:      dateFrom===r.from && dateTo===r.to ? '#fff' : textMuted,
                  border: `1px solid ${bdr}` }}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary row */}
        {summary && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:8, padding:'0 20px 12px' }}>
            {[
              { label:'Total Revenue', value:`Rs.${summary.totalRevenue >= 1000 ? (summary.totalRevenue/1000).toFixed(1)+'k' : summary.totalRevenue.toLocaleString()}`, color:'#10B981' },
              { label:'Total Orders',  value:summary.totalOrders,  color:'#8B5CF6' },
              { label:'Avg Order',     value:`Rs.${summary.avgOrder.toLocaleString()}`, color:'#00BFFF' },
              { label:'Pending',       value:summary.totalPending, color:'#F97316' },
            ].map(s => (
              <div key={s.label} style={{ background: isLight?'#F8FAFC':'#0F172A', border:`1px solid ${bdr}`, borderRadius:12, padding:'10px 12px', textAlign:'center' }}>
                <div style={{ fontSize:18, fontWeight:900, color:s.color }}>{s.value}</div>
                <div style={{ fontSize:10, color:textSub, marginTop:2, fontWeight:600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {loading && <div style={{ textAlign:'center', padding:'24px', color:textSub, fontSize:13 }}>Loading data…</div>}

        {/* Chart — bar chart by date */}
        {!loading && type !== 'topseller' && data.length > 0 && (
          <div style={{ padding:'0 20px 16px' }}>
            <p style={{ fontSize:11, color:textSub, fontWeight:700, textTransform:'uppercase', marginBottom:8 }}>
              {type === 'revenue' ? 'Daily Revenue' : type === 'orders' ? 'Daily Orders' : 'Daily Pending'}
            </p>
            <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:120, overflowX:'auto', paddingBottom:4 }}>
              {data.map(d => {
                const val = type === 'revenue' ? d.revenue : type === 'orders' ? d.orders : d.pending
                const pct = maxVal ? (val / maxVal) * 100 : 0
                const label = d.date.slice(5) // MM-DD
                return (
                  <div key={d.date} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, minWidth:28, flex:1 }}>
                    <div style={{ fontSize:9, color:activeColor, fontWeight:700, whiteSpace:'nowrap' }}>
                      {type === 'revenue' ? (val >= 1000 ? `${(val/1000).toFixed(1)}k` : val) : val}
                    </div>
                    <div style={{ width:'100%', background:activeColor, borderRadius:'3px 3px 0 0', height:`${Math.max(pct, 2)}%`, transition:'height 0.3s', opacity:0.85 }} />
                    <div style={{ fontSize:8, color:textSub, whiteSpace:'nowrap' }}>{label}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Top sellers list */}
        {!loading && type === 'topseller' && summary?.topProducts?.length > 0 && (
          <div style={{ padding:'0 20px 20px' }}>
            <p style={{ fontSize:11, color:textSub, fontWeight:700, textTransform:'uppercase', marginBottom:8 }}>Top Products by Qty Sold</p>
            {summary.topProducts.map(([name, qty], i) => (
              <div key={name} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:10, marginBottom:4,
                background: isLight ? '#F8FAFC' : '#0F172A', border:`1px solid ${bdr}` }}>
                <span style={{ fontSize:14, fontWeight:900, color: i < 3 ? ['#F59E0B','#94A3B8','#CD7C2F'][i] : textSub, minWidth:20 }}>#{i+1}</span>
                <span style={{ flex:1, fontSize:13, fontWeight:600, color:textPrimary }}>{name}</span>
                <span style={{ fontSize:13, fontWeight:800, color:'#F97316' }}>{qty} sold</span>
                <div style={{ width:60, height:6, borderRadius:3, background: isLight?'#E2E8F0':'#1E293B', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${(qty/(summary.topProducts[0][1]||1))*100}%`, background:'#F97316', borderRadius:3 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && data.length === 0 && (
          <div style={{ textAlign:'center', padding:'32px', color:textSub }}>
            <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
            <p style={{ fontSize:13 }}>No data for selected range</p>
          </div>
        )}
      </div>
    </div>
    </Portal>
  )
}

// ══════════════════════════════════════════════════════════════
//  CouponsTab — full coupon management + analytics
// ══════════════════════════════════════════════════════════════

export default AnalyticsModal
