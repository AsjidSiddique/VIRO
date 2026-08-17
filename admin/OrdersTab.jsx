'use client'
import Portal from './Portal'
import React, { useState, useRef } from 'react'
import { ORDER_STATUSES, ORDER_STATUS_META } from '../lib/constants'
import { generateSlipHTML, generateBulkSlipsHTML } from '../lib/printSlip'
import { buildOrderConfirmationMessage, buildWaLink } from '../lib/whatsappMessages'

// ── JazzCash / EasyPaisa SVG logos ──────────────────────────────────────────
function JazzCashLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#E63946"/>
      <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle"
        fill="white" fontSize="11" fontWeight="900" fontFamily="Arial">JC</text>
    </svg>
  )
}
function EasyPaisaLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#00B562"/>
      <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle"
        fill="white" fontSize="11" fontWeight="900" fontFamily="Arial">EP</text>
    </svg>
  )
}

function PaymentBadge({ method, paymentStatus, size = 'sm' }) {
  const isPrePaid = method && method !== 'COD'
  const isPaid    = paymentStatus === 'PAID'
  const sz = size === 'xs' ? { fontSize:9, px:'4px 7px', br:10 } : { fontSize:10, px:'3px 8px', br:12 }

  if (isPrePaid) {
    const isJazz = method?.toLowerCase().includes('jazz')
    return (
      <span style={{ display:'inline-flex', alignItems:'center', gap:3,
        padding: sz.px, borderRadius: sz.br,
        background: isPaid ? '#10B98118' : '#F9731618',
        border: `1px solid ${isPaid ? '#10B98150' : '#F9731650'}`,
        color: isPaid ? '#10B981' : '#F97316',
        fontWeight:800, fontSize: sz.fontSize }}>
        {isJazz ? <JazzCashLogo size={12}/> : <EasyPaisaLogo size={12}/>}
        {method?.toUpperCase()} · {isPaid ? '✅ PAID' : '⏳ PENDING'}
      </span>
    )
  }
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:3,
      padding: sz.px, borderRadius: sz.br,
      background:'#8B5CF618', border:'1px solid #8B5CF650',
      color:'#A78BFA', fontWeight:800, fontSize: sz.fontSize }}>
      💵 COD
    </span>
  )
}

// ── Courier Print Modal ──────────────────────────────────────────────────────
const DEFAULT_SENDER = {
  name:    'Viro.pk',
  phone:   '03290081469',
  address: 'Burewala, Punjab, Pakistan',
}

function PrintModal({ order, onClose }) {
  const [sender, setSender] = useState(() => {
    try { return JSON.parse(localStorage.getItem('viro_sender') || 'null') || DEFAULT_SENDER }
    catch { return DEFAULT_SENDER }
  })
  const [editSender, setEditSender] = useState(false)
  const [draftSender, setDraftSender] = useState(sender)
  const printRef = useRef()

  function saveSender() {
    setSender(draftSender)
    localStorage.setItem('viro_sender', JSON.stringify(draftSender))
    setEditSender(false)
  }

  function doPrint() {
    const html = generateSlipHTML(order, sender)
    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const w    = window.open(url, '_blank')
    // Revoke after enough time to load
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  return (
    <Portal>
    <div style={{ position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center' }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ width:'100%',maxWidth:520,background:'var(--viro-bgCard)',borderRadius:'20px 20px 0 0',border:'1px solid var(--viro-border)',maxHeight:'85vh',overflowY:'auto',animation:'popIn 0.25s ease' }}>

        {/* Header */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid var(--viro-border)' }}>
          <h2 style={{ fontWeight:900,fontSize:16,color:'var(--viro-text)' }}>🖨️ Courier Slip — #{order.id?.slice(0,8).toUpperCase()}</h2>
          <button onClick={onClose} style={{ width:32,height:32,borderRadius:'50%',background:'var(--viro-bgDeep)',color:'var(--viro-textMuted)',border:'none',cursor:'pointer',fontSize:16 }}>✕</button>
        </div>

        <div style={{ padding:'16px 20px' }}>
          {/* Sender info */}
          <div style={{ marginBottom:16 }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
              <p style={{ fontWeight:800,fontSize:12,color:'var(--viro-textSub)',textTransform:'uppercase',letterSpacing:1 }}>📦 Sender (Your Info)</p>
              <button onClick={() => { setDraftSender(sender); setEditSender(!editSender) }}
                style={{ fontSize:11,fontWeight:700,color:'#8B5CF6',background:'#8B5CF618',border:'1px solid #8B5CF640',borderRadius:8,padding:'3px 10px',cursor:'pointer' }}>
                {editSender ? 'Cancel' : '✏️ Edit'}
              </button>
            </div>
            {editSender ? (
              <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                {[['name','Name'],['phone','Phone'],['address','Address']].map(([k,label]) => (
                  <div key={k}>
                    <label style={{ fontSize:11,color:'var(--viro-textSub)',display:'block',marginBottom:3 }}>{label}</label>
                    <input value={draftSender[k]} onChange={e=>setDraftSender(d=>({...d,[k]:e.target.value}))}
                      style={{ width:'100%',padding:'8px 12px',borderRadius:10,fontSize:13 }} />
                  </div>
                ))}
                <button onClick={saveSender}
                  style={{ background:'#8B5CF6',color:'#fff',border:'none',borderRadius:10,padding:'10px',fontWeight:800,cursor:'pointer',fontSize:13 }}>
                  💾 Save for All Slips
                </button>
              </div>
            ) : (
              <div style={{ background:'var(--viro-bgDeep)',borderRadius:12,padding:'10px 14px' }}>
                <p style={{ fontWeight:800,fontSize:14,color:'var(--viro-text)' }}>{sender.name}</p>
                <p style={{ fontSize:12,color:'var(--viro-textSub)' }}>{sender.phone}</p>
                <p style={{ fontSize:12,color:'var(--viro-textSub)' }}>{sender.address}</p>
              </div>
            )}
          </div>

          {/* Receiver */}
          <div style={{ marginBottom:16 }}>
            <p style={{ fontWeight:800,fontSize:12,color:'var(--viro-textSub)',textTransform:'uppercase',letterSpacing:1,marginBottom:8 }}>📍 Receiver</p>
            <div style={{ background:'var(--viro-bgDeep)',borderRadius:12,padding:'10px 14px' }}>
              <p style={{ fontWeight:800,fontSize:14,color:'var(--viro-text)' }}>{order.customers?.name}</p>
              <p style={{ fontSize:12,color:'var(--viro-textSub)' }}>{order.customers?.phone}</p>
              <p style={{ fontSize:12,color:'var(--viro-textSub)' }}>{order.customers?.address}, {order.customers?.city}</p>
            </div>
          </div>

          {/* Total */}
          <div style={{ background:'linear-gradient(135deg,#7C3AED20,#8B5CF620)',border:'1px solid #8B5CF640',borderRadius:12,padding:'12px 16px',marginBottom:16,textAlign:'center' }}>
            <p style={{ fontSize:11,color:'var(--viro-textSub)',marginBottom:4 }}>TOTAL TO COLLECT</p>
            <p style={{ fontSize:26,fontWeight:900,color:'#7C3AED' }}>Rs.{order.final_total?.toLocaleString()}</p>
            <p style={{ fontSize:11,color:'var(--viro-textSub)',marginTop:4 }}>
              {order.payment_method==='COD' ? '💵 Cash on Delivery' : '✅ Already Paid — Do NOT collect cash'}
            </p>
          </div>

          <button onClick={doPrint}
            style={{ width:'100%',padding:'14px',borderRadius:14,background:'linear-gradient(135deg,#7C3AED,#00BFFF)',color:'#fff',fontWeight:900,fontSize:15,border:'none',cursor:'pointer' }}>
            🖨️ Print / Download Slip
          </button>
        </div>
      </div>
    </div>
    </Portal>
  )
}

// ── Edit Order Info Modal ────────────────────────────────────────────────────
function EditOrderModal({ order, onClose, onSave }) {
  const [form, setForm] = useState({
    name:    order.customers?.name    || '',
    phone:   order.customers?.phone   || '',
    city:    order.customers?.city    || '',
    address: order.customers?.address || '',
    email:   order.customers?.email   || '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(order.id, form)
    setSaving(false)
    onClose()
  }

  return (
    <Portal>
    <div style={{ position:'fixed',inset:0,zIndex:9998,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center' }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ width:'100%',maxWidth:520,background:'var(--viro-bgCard)',borderRadius:'20px 20px 0 0',border:'1px solid var(--viro-border)',maxHeight:'85vh',overflowY:'auto',animation:'popIn 0.25s ease' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid var(--viro-border)' }}>
          <h2 style={{ fontWeight:900,fontSize:16,color:'var(--viro-text)' }}>✏️ Edit Order Info</h2>
          <button onClick={onClose} style={{ width:32,height:32,borderRadius:'50%',background:'var(--viro-bgDeep)',color:'var(--viro-textMuted)',border:'none',cursor:'pointer',fontSize:16 }}>✕</button>
        </div>
        <div style={{ padding:'16px 20px',display:'flex',flexDirection:'column',gap:12 }}>
          <p style={{ fontSize:11,color:'#F97316',background:'#F9731618',border:'1px solid #F9731640',borderRadius:8,padding:'8px 12px' }}>
            ⚠️ This updates the customer's shipping address on this order. Use after confirming via phone call.
          </p>
          {[
            ['name','Full Name','text'],
            ['phone','Phone Number','tel'],
            ['city','City','text'],
            ['address','Full Address','text'],
            ['email','Email (optional)','email'],
          ].map(([k,label,type]) => (
            <div key={k}>
              <label style={{ fontSize:11,fontWeight:700,color:'var(--viro-textSub)',display:'block',marginBottom:4 }}>{label}</label>
              <input type={type} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                style={{ width:'100%',padding:'10px 14px',borderRadius:10,fontSize:13 }} />
            </div>
          ))}
          <button onClick={handleSave} disabled={saving}
            style={{ padding:'13px',borderRadius:12,background:'linear-gradient(135deg,#00BFFF,#8B5CF6)',color:'#fff',fontWeight:900,fontSize:14,border:'none',cursor:saving?'wait':'pointer',opacity:saving?0.7:1 }}>
            {saving ? 'Saving…' : '✅ Save Changes'}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  )
}

// ── Main OrdersTab ───────────────────────────────────────────────────────────
function OrdersTab({ orders, loading, statusColors, updateOrderStatus, updateOrderPayment, updateOrderInfo, onReload, externalSearch, onExternalSearchConsumed, externalStatus, onExternalStatusConsumed, partnerByCoupon = {}, onViewPartner }) {
  const [showFilters, setShowFilters]   = useState(false)
  const [expanded,    setExpanded]      = useState(null)
  const [viewMode,    setViewMode]      = useState('list')
  const [printOrder,  setPrintOrder]    = useState(null)
  const [editOrder,   setEditOrder]     = useState(null)
  const [bulkSelected, setBulkSelected] = useState(new Set()) // for bulk print
  const [bulkPrintOpen, setBulkPrintOpen] = useState(false)
  const [customPerPage, setCustomPerPage] = useState('')   // custom slips per page

  // When navigating from Customers tab — search + expand + scroll to that order
  React.useEffect(() => {
    if (!externalSearch || !orders.length) return
    setSearch(externalSearch)
    setSelectedStatuses([])
    setSelectedPayMethod('all')
    setSelectedPayStatus('all')
    // Find the matching order
    const match = orders.find(o =>
      o.id?.toLowerCase().includes(externalSearch.toLowerCase()) ||
      o.id?.slice(0,8).toLowerCase() === externalSearch.toLowerCase()
    )
    if (match) {
      setExpanded(match.id)
      // Scroll to the order card after render
      setTimeout(() => {
        const el = document.getElementById('order-card-' + match.id)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        onExternalSearchConsumed?.()
      }, 200)
    } else {
      onExternalSearchConsumed?.()
    }
  }, [externalSearch, orders])

  // When navigating from Dashboard with status filter
  React.useEffect(() => {
    if (!externalStatus) return
    setSelectedStatuses([externalStatus])
    setSearch('')
    setExpanded(null)
    onExternalStatusConsumed?.()
    // Scroll to top of list
    setTimeout(() => {
      document.getElementById('viro-main')?.scrollTo({ top: 0, behavior: 'smooth' })
    }, 150)
  }, [externalStatus])

  // ── Filter state ─────────────────────────────────────────
  const [selectedStatuses,  setSelectedStatuses]  = useState([])
  const [selectedCities,    setSelectedCities]    = useState([])
  const [selectedPayMethod, setSelectedPayMethod] = useState('all') // 'all'|'cod'|'prepaid'
  const [selectedPayStatus, setSelectedPayStatus] = useState('all') // 'all'|'PAID'|'UNPAID'
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [minItems,  setMinItems]  = useState('')
  const [maxItems,  setMaxItems]  = useState('')
  const [dateFrom,  setDateFrom]  = useState('')
  const [dateTo,    setDateTo]    = useState('')
  const [search,    setSearch]    = useState('')
  const [sortBy,    setSortBy]    = useState('newest')
  const [loginFilter, setLoginFilter] = useState('all')
  const [pendingFilters, setPending] = useState({
    statuses:[], cities:[], minAmount:'', maxAmount:'',
    minItems:'', maxItems:'', dateFrom:'', dateTo:'', payMethod:'all', payStatus:'all'
  })
  const [draft, setDraft] = useState(pendingFilters)

  const STATUS_LIST = ['UNPAID','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','RETURNED','CANCELLED']
  const orderCities = [...new Set(orders.map(o => o.customers?.city).filter(Boolean))].sort()

  // ── Analytics ─────────────────────────────────────────────
  const today       = new Date().toDateString()
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === today)
  const unpaid      = orders.filter(o => o.status === 'UNPAID').length
  const delivered   = orders.filter(o => o.status === 'DELIVERED').length
  const totalRev    = orders.filter(o => o.status !== 'CANCELLED').reduce((s,o) => s+(o.final_total||0),0)
  const avgOrder    = orders.length ? Math.round(totalRev/orders.length) : 0
  const codOrders   = orders.filter(o => !o.payment_method || o.payment_method === 'COD').length
  const prepaidOrders = orders.length - codOrders
  const prepaidPending = orders.filter(o => o.payment_method && o.payment_method !== 'COD' && o.payment_status !== 'PAID').length

  const productCounts = {}
  orders.forEach(o => (o.order_items||[]).forEach(i => {
    const n = i.products?.name||'Unknown'
    productCounts[n] = (productCounts[n]||0)+i.quantity
  }))
  const topProducts = Object.entries(productCounts).sort((a,b)=>b[1]-a[1]).slice(0,5)

  const cityRev = {}
  orders.filter(o=>o.status!=='CANCELLED').forEach(o => {
    const rawC = o.customers?.city||'Unknown'
    const c = rawC.charAt(0).toUpperCase()+rawC.slice(1).toLowerCase()
    cityRev[c] = (cityRev[c]||0)+(o.final_total||0)
  })
  const topCities   = Object.entries(cityRev).sort((a,b)=>b[1]-a[1]).slice(0,5)
  const maxCityRev  = topCities[0]?.[1]||1
  const statusCounts = {}
  STATUS_LIST.forEach(s => { statusCounts[s] = orders.filter(o=>o.status===s).length })

  // ── Apply / Reset filters ─────────────────────────────────
  function applyFilters() {
    setSelectedStatuses(draft.statuses)
    setSelectedCities(draft.cities)
    setMinAmount(draft.minAmount); setMaxAmount(draft.maxAmount)
    setMinItems(draft.minItems);   setMaxItems(draft.maxItems)
    setDateFrom(draft.dateFrom);   setDateTo(draft.dateTo)
    setSelectedPayMethod(draft.payMethod||'all')
    setSelectedPayStatus(draft.payStatus||'all')
    setPending(draft); setShowFilters(false)
  }
  function resetFilters() {
    const empty = { statuses:[], cities:[], minAmount:'', maxAmount:'', minItems:'', maxItems:'', dateFrom:'', dateTo:'', payMethod:'all', payStatus:'all' }
    setDraft(empty); setPending(empty)
    setSelectedStatuses([]); setSelectedCities([])
    setMinAmount(''); setMaxAmount(''); setMinItems(''); setMaxItems('')
    setDateFrom(''); setDateTo('')
    setSelectedPayMethod('all'); setSelectedPayStatus('all')
  }
  function openFilters() { setDraft({ ...pendingFilters, payMethod: selectedPayMethod, payStatus: selectedPayStatus }); setShowFilters(true) }

  const activeFilterCount = selectedStatuses.length + selectedCities.length +
    (minAmount||maxAmount?1:0) + (minItems||maxItems?1:0) + (dateFrom||dateTo?1:0) +
    (loginFilter!=='all'?1:0) + (selectedPayMethod!=='all'?1:0) + (selectedPayStatus!=='all'?1:0)

  // ── Filter + sort ─────────────────────────────────────────
  const filtered = orders.filter(o => {
    const q = search.toLowerCase().replace(/^#/,'')
    if (q && !(
      o.customers?.name?.toLowerCase().includes(q) ||
      o.customers?.phone?.includes(q) ||
      o.customers?.email?.toLowerCase().includes(q) ||
      o.customers?.city?.toLowerCase().includes(q) ||
      o.customers?.address?.toLowerCase().includes(q) ||
      (o.order_items||[]).some(i => i.products?.name?.toLowerCase().includes(q)) ||
      (o.id||'').toLowerCase().includes(q) ||
      (o.id||'').slice(0,8).toLowerCase().includes(q)
    )) return false
    if (selectedStatuses.length && !selectedStatuses.includes(o.status)) return false
    if (selectedCities.length  && !selectedCities.includes(o.customers?.city)) return false
    if (minAmount && (o.final_total||0) < parseFloat(minAmount)) return false
    if (maxAmount && (o.final_total||0) > parseFloat(maxAmount)) return false
    const qty = (o.order_items||[]).reduce((s,i)=>s+i.quantity,0)
    if (minItems && qty < parseInt(minItems)) return false
    if (maxItems && qty > parseInt(maxItems)) return false
    if (dateFrom && new Date(o.created_at) < new Date(dateFrom)) return false
    if (dateTo   && new Date(o.created_at) > new Date(dateTo+'T23:59:59')) return false
    if (loginFilter==='google' && !o.customers?.auth_user_id) return false
    if (loginFilter==='guest'  &&  o.customers?.auth_user_id) return false
    // Payment method filter
    if (selectedPayMethod === 'cod'     && o.payment_method && o.payment_method !== 'COD') return false
    if (selectedPayMethod === 'prepaid' && (!o.payment_method || o.payment_method === 'COD')) return false
    // Payment status filter
    if (selectedPayStatus === 'PAID'   && o.payment_status !== 'PAID') return false
    if (selectedPayStatus === 'UNPAID' && o.payment_status === 'PAID') return false
    return true
  }).sort((a,b) => {
    if (sortBy==='newest')  return new Date(b.created_at) - new Date(a.created_at)
    if (sortBy==='oldest')  return new Date(a.created_at) - new Date(b.created_at)
    if (sortBy==='highest') return (b.final_total||0) - (a.final_total||0)
    if (sortBy==='lowest')  return (a.final_total||0) - (b.final_total||0)
    return 0
  })

  const googleOrders = orders.filter(o => !!o.customers?.auth_user_id).length
  const guestOrders  = orders.length - googleOrders

  function toggleDraftStatus(s) { setDraft(d => ({ ...d, statuses: d.statuses.includes(s) ? d.statuses.filter(x=>x!==s) : [...d.statuses,s] })) }
  function toggleDraftCity(c)   { setDraft(d => ({ ...d, cities:   d.cities.includes(c)   ? d.cities.filter(x=>x!==c)   : [...d.cities,c]   })) }

  if (loading) return (
    <div className="px-4 py-10 flex items-center justify-center gap-3">
      <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="3"/>
        <path className="opacity-75" fill="#8B5CF6" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      <span style={{ color:'var(--viro-textSub)' }}>Loading orders…</span>
    </div>
  )

  return (
    <div className="px-3 md:px-4 pb-10 fade-in">

      {/* ── Analytics Strip ── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
        {[
          { label:'Total',    value: orders.length,        icon:'📋', color:'#8B5CF6' },
          { label:'Today',    value: todayOrders.length,   icon:'📅', color:'#00BFFF' },
          { label:'Unpaid',   value: unpaid,               icon:'⚠️', color:'#F97316' },
          { label:'Delivered',value: delivered,            icon:'📦', color:'#10B981' },
          { label:'Prepaid',  value: prepaidOrders,        icon:'💳', color:'#EC4899' },
          { label:'⏳ Verify', value: prepaidPending,       icon:'🔔', color:'#F59E0B' },
        ].map((s,i) => (
          <div key={s.label} className="viro-card p-3 text-center"
            style={{ animation:`statPop 0.35s ${i*0.05}s ease both` }}>
            <div className="text-xl mb-0.5">{s.icon}</div>
            <div className="font-extrabold text-base leading-tight" style={{ color:s.color }}>{s.value}</div>
            <div className="text-xs" style={{ color:'var(--viro-textSub)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Status + Revenue Charts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="viro-card p-3">
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color:'var(--viro-textSub)' }}>Status Breakdown</p>
          <div className="space-y-1.5">
            {STATUS_LIST.map(s => {
              const cnt = statusCounts[s]||0
              const pct = orders.length ? (cnt/orders.length)*100 : 0
              const sc  = statusColors[s]||'#94A3B8'
              return (
                <div key={s} className="flex items-center gap-2">
                  <span className="text-xs font-semibold w-20 flex-shrink-0" style={{ color:sc }}>{s}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background:'var(--viro-bgDeep)' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width:`${pct}%`,background:sc }} />
                  </div>
                  <span className="text-xs w-5 text-right font-bold" style={{ color:'var(--viro-text)' }}>{cnt}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="viro-card p-3">
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color:'var(--viro-textSub)' }}>Revenue by City</p>
          {topCities.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color:'var(--viro-textSub)' }}>No data yet</p>
          ) : (
            <div className="space-y-1.5">
              {topCities.map(([city,rev]) => (
                <div key={city} className="flex items-center gap-2">
                  <span className="text-xs w-20 truncate flex-shrink-0" style={{ color:'var(--viro-text)' }}>{city}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background:'var(--viro-bgDeep)' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width:`${(rev/maxCityRev)*100}%`,background:'linear-gradient(90deg,#7C3AED,#00BFFF)' }} />
                  </div>
                  <span className="text-xs font-bold" style={{ color:'#A78BFA' }}>Rs.{rev.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
          {/* COD vs Prepaid */}
          <div className="mt-3 pt-3 border-t" style={{ borderColor:'var(--viro-border)' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color:'var(--viro-textSub)' }}>Payment Split</p>
            <div className="flex gap-2">
              <div className="flex-1 text-center p-2 rounded-xl" style={{ background:'#8B5CF618',border:'1px solid #8B5CF640' }}>
                <p className="text-xs font-bold" style={{ color:'#A78BFA' }}>{codOrders}</p>
                <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>💵 COD</p>
              </div>
              <div className="flex-1 text-center p-2 rounded-xl" style={{ background:'#10B98118',border:'1px solid #10B98140' }}>
                <p className="text-xs font-bold" style={{ color:'#10B981' }}>{prepaidOrders}</p>
                <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>💳 Prepaid</p>
              </div>
              {prepaidPending > 0 && (
                <div className="flex-1 text-center p-2 rounded-xl" style={{ background:'#F59E0B18',border:'1px solid #F59E0B40' }}>
                  <p className="text-xs font-bold" style={{ color:'#F59E0B' }}>{prepaidPending}</p>
                  <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>⏳ Pending</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search name, phone, order ID…"
          className="flex-1 min-w-[180px] text-sm" style={{ padding:'8px 14px', borderRadius:12 }} />
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
          className="text-sm" style={{ padding:'8px 12px', borderRadius:12, minWidth:130 }}>
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="highest">Highest Amount</option>
          <option value="lowest">Lowest Amount</option>
        </select>
        {/* Quick payment filter */}
        <select value={selectedPayMethod} onChange={e=>setSelectedPayMethod(e.target.value)}
          className="text-sm" style={{ padding:'8px 12px', borderRadius:12 }}>
          <option value="all">All Orders</option>
          <option value="cod">💵 COD Only</option>
          <option value="prepaid">💳 Prepaid Only</option>
        </select>
        <select value={selectedPayStatus} onChange={e=>setSelectedPayStatus(e.target.value)}
          className="text-sm" style={{ padding:'8px 12px', borderRadius:12 }}>
          <option value="all">Any Payment</option>
          <option value="PAID">✅ Paid</option>
          <option value="UNPAID">⏳ Unpaid</option>
        </select>
        <button onClick={openFilters}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all"
          style={{ background: activeFilterCount>0 ? '#8B5CF625' : 'var(--viro-bgCard)',
            color: activeFilterCount>0 ? '#A78BFA' : 'var(--viro-textSub)',
            border:`1px solid ${activeFilterCount>0 ? '#8B5CF660' : 'var(--viro-border)'}` }}>
          ⚙️ Filters {activeFilterCount > 0 && <span style={{ background:'#8B5CF6',color:'#fff',borderRadius:'50%',width:18,height:18,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:10 }}>{activeFilterCount}</span>}
        </button>
        <button onClick={() => setViewMode(v => v==='list'?'grid':'list')}
          className="px-3 py-2 rounded-xl text-sm font-bold"
          style={{ background:'var(--viro-bgCard)',color:'var(--viro-textSub)',border:'1px solid var(--viro-border)' }}>
          {viewMode==='list' ? '⊞' : '☰'}
        </button>
        {search && (
          <button onClick={() => setSearch('')}
            className="px-3 py-2 rounded-xl text-sm font-bold"
            style={{ background:'#EF444415',color:'#F87171',border:'1px solid #EF444430' }}>
            ✕ Clear
          </button>
        )}
        {bulkSelected.size > 0 && (
          <button onClick={() => setBulkPrintOpen(true)}
            className="px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5"
            style={{ background:'linear-gradient(135deg,#7C3AED,#4F46E5)',color:'#fff',border:'none' }}>
            🖨️ Print {bulkSelected.size} Slips
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selectedStatuses.map(s => (
            <button key={s} onClick={() => setSelectedStatuses(p=>p.filter(x=>x!==s))}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background:(statusColors[s]||'#94A3B8')+'25',color:statusColors[s]||'#94A3B8',border:`1px solid ${(statusColors[s]||'#94A3B8')}50` }}>
              {s} ✕
            </button>
          ))}
          {selectedPayMethod !== 'all' && (
            <button onClick={() => setSelectedPayMethod('all')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background:'#10B98125',color:'#10B981',border:'1px solid #10B98140' }}>
              {selectedPayMethod === 'cod' ? '💵 COD' : '💳 Prepaid'} ✕
            </button>
          )}
          {selectedPayStatus !== 'all' && (
            <button onClick={() => setSelectedPayStatus('all')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background:'#F59E0B25',color:'#F59E0B',border:'1px solid #F59E0B40' }}>
              {selectedPayStatus === 'PAID' ? '✅ Paid' : '⏳ Unpaid'} ✕
            </button>
          )}
          <button onClick={resetFilters}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background:'#EF444415',color:'#F87171',border:'1px solid #EF444430' }}>
            Clear all
          </button>
        </div>
      )}

      <p className="text-xs mb-3" style={{ color:'var(--viro-textSub)' }}>{filtered.length} of {orders.length} orders</p>

      {/* ── Orders list ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">📭</div>
          <p className="font-bold" style={{ color:'var(--viro-text)' }}>No orders match your filters</p>
          <button onClick={resetFilters} className="btn-primary mt-4 mx-auto px-6 py-2 text-sm">Clear Filters</button>
        </div>
      ) : (
        <div className={viewMode==='grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'space-y-3'}>
          {filtered.map(order => {
            const st      = statusColors[order.status]||'#94A3B8'
            const items   = order.order_items||[]
            const isFree  = (order.delivery_charges||0) === 0
            const isOpen  = expanded === order.id
            const itemQty = items.reduce((s,i)=>s+i.quantity,0)
            const isPrepaid = order.payment_method && order.payment_method !== 'COD'
            const isPendingPayment = isPrepaid && order.payment_status !== 'PAID'

            return (
              <div key={order.id} id={`order-card-${order.id}`} className="viro-card overflow-hidden transition-all"
                style={{ borderLeft:`3px solid ${isPendingPayment ? '#F59E0B' : st}` }}>

                {/* Header */}
                <div className="px-4 py-3 flex items-start justify-between gap-3">
                  {/* Bulk select checkbox */}
                  <div className="flex-shrink-0 pt-0.5" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={bulkSelected.has(order.id)}
                      onChange={e => setBulkSelected(prev => {
                        const n = new Set(prev)
                        e.target.checked ? n.add(order.id) : n.delete(order.id)
                        return n
                      })}
                      style={{ width:16,height:16,accentColor:'#8B5CF6',cursor:'pointer' }} />
                  </div>
                  <div className="flex-1 cursor-pointer flex items-start justify-between gap-3" onClick={() => setExpanded(isOpen ? null : order.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold" style={{ color:'var(--viro-textSub)' }}>
                        #{order.id?.slice(0,8).toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background:st+'20',color:st,border:`1px solid ${st}40` }}>
                        {order.status === 'UNPAID' && order.payment_method && order.payment_method !== 'COD'
                          ? 'PENDING CONFIRMATION' : order.status}
                      </span>
                      <PaymentBadge method={order.payment_method} paymentStatus={order.payment_status} size="xs" />
                    </div>
                    <p className="font-bold text-sm mt-0.5" style={{ color:'var(--viro-text)' }}>
                      {order.customers?.name}
                      {order.customers?.auth_user_id && (
                        <span style={{ marginLeft:6,fontSize:9,fontWeight:800,padding:'1px 6px',borderRadius:20,background:'#10B98115',color:'#10B981',border:'1px solid #10B98140',verticalAlign:'middle' }}>🟢 Google</span>
                      )}
                      {order.coupon_code && partnerByCoupon[order.coupon_code.toUpperCase()] && (
                        <button
                          onClick={e => { e.stopPropagation(); onViewPartner?.(partnerByCoupon[order.coupon_code.toUpperCase()].id) }}
                          style={{ marginLeft:6,fontSize:9,fontWeight:800,padding:'1px 6px',borderRadius:20,background:'#8B5CF615',color:'#A78BFA',border:'1px solid #8B5CF640',verticalAlign:'middle',cursor:'pointer' }}
                          title="View partner details">
                          🤝 via {partnerByCoupon[order.coupon_code.toUpperCase()].name}
                        </button>
                      )}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                      {order.customers?.phone} · {order.customers?.city}
                      {order.customers?.email && <span style={{ color:'#A78BFA',marginLeft:4 }}>· {order.customers.email}</span>}
                    </p>
                    {!isOpen && items.length > 0 && (
                      <p className="text-xs mt-0.5 truncate" style={{ color:'var(--viro-textSub)' }}>
                        {items.slice(0,2).map(i=>`${i.products?.name||'?'} ×${i.quantity}`).join(', ')}
                        {items.length > 2 && ` +${items.length-2} more`}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-extrabold text-base" style={{ color:'#7C3AED' }}>Rs.{order.final_total?.toLocaleString()}</p>
                    <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>{itemQty} item{itemQty!==1?'s':''}</p>
                    <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                      {new Date(order.created_at).toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'2-digit'})}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>{isOpen ? '▲' : '▼'}</p>
                    </div>
                </div>
                </div>
                {/* Expanded details */}
                {isOpen && (
                  <div className="border-t fade-in" style={{ borderColor:'var(--viro-border)' }}>
                    {/* Address */}
                    <div className="px-4 py-2" style={{ background:'var(--viro-bgDeep)' }}>
                      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color:'var(--viro-textSub)' }}>Delivery Address</p>
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-sm" style={{ color:'var(--viro-text)',margin:0 }}>
                          {order.customers?.name} · {order.customers?.phone}
                        </p>
                        {order.customers?.auth_user_id
                          ? <span style={{ fontSize:9,fontWeight:800,padding:'1px 6px',borderRadius:20,background:'#10B98115',color:'#10B981',border:'1px solid #10B98140' }}>🟢 Google Account</span>
                          : <span style={{ fontSize:9,fontWeight:800,padding:'1px 6px',borderRadius:20,background:'#94A3B815',color:'#64748B',border:'1px solid #94A3B830' }}>⚪ Guest</span>
                        }
                      </div>
                      {order.customers?.email && <p className="text-xs mb-0.5" style={{ color:'#A78BFA' }}>✉️ {order.customers.email}</p>}
                      <p className="text-sm" style={{ color:'var(--viro-textMuted)' }}>{order.customers?.address}, {order.customers?.city}</p>
                      <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
                        📅 {new Date(order.created_at).toLocaleString('en-PK',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                      </p>
                    </div>

                    {/* Items */}
                    <div className="px-4 py-2 border-t" style={{ borderColor:'var(--viro-border)' }}>
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color:'var(--viro-textSub)' }}>Items</p>
                      {items.map((item,i) => {
                        // products.images can be a real array or a JSON string depending on
                        // how the row was saved — handle both safely, same as ProductCard/Navbar.
                        const raw = item.products?.images
                        let thumb = null
                        if (Array.isArray(raw)) {
                          thumb = raw.find(u => typeof u === 'string' && u.startsWith('http')) ?? null
                        } else if (typeof raw === 'string') {
                          if (raw.startsWith('http')) thumb = raw
                          else { try { const a = JSON.parse(raw); thumb = Array.isArray(a) ? a[0] : null } catch {} }
                        }
                        const productId = item.products?.id
                        const productName = item.products?.name || 'Product'
                        // Variant selected at checkout (colour/size) — was being
                        // saved to order_items all along, just never rendered here.
                        const variantBits = []
                        if (item.selected_color_name) variantBits.push(item.selected_color_name)
                        if (item.selected_size_name)  variantBits.push(item.selected_size_name)
                        const variantLabel = variantBits.join(' / ')

                        const row = (
                          <div className="flex items-center gap-2.5 text-sm py-1.5">
                            {/* Thumbnail — falls back to a placeholder box if no image or product was deleted */}
                            <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width:36, height:36, background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                              {thumb ? (
                                <img src={thumb} alt={productName} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center" style={{ fontSize:14 }}>📦</div>
                              )}
                            </div>
                            <span className="truncate flex-1" style={{ color: productId ? 'var(--viro-text)' : 'var(--viro-textMuted)' }}>
                              {productName} <span style={{ color:'var(--viro-textSub)' }}>×{item.quantity}</span>
                              {variantLabel && (
                                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold align-middle"
                                  style={{ background:'#8B5CF620', color:'#8B5CF6', whiteSpace:'nowrap' }}>
                                  {variantLabel}
                                </span>
                              )}
                            </span>
                            {(() => {
                              const finalTotal = item.price * item.quantity
                              const origUnit = item.original_price ?? item.price
                              const origTotal = origUnit * item.quantity
                              const hasDiscount = origTotal > finalTotal
                              return (
                                <span className="flex-shrink-0 text-right">
                                  {hasDiscount && (
                                    <span className="block text-xs" style={{ color:'var(--viro-textSub)', textDecoration:'line-through' }}>
                                      Rs.{origTotal.toLocaleString()}
                                    </span>
                                  )}
                                  <span className="font-semibold" style={{ color: hasDiscount ? '#F97316' : 'var(--viro-textMuted)' }}>
                                    Rs.{finalTotal.toLocaleString()}
                                  </span>
                                </span>
                              )
                            })()}
                          </div>
                        )

                        // Only wrap in a link if the product still exists — a deleted/missing
                        // product has no id, so there's nowhere valid to send the admin.
                        return productId ? (
                          <a key={i} href={`/product/${productId}`} target="_blank" rel="noopener noreferrer"
                            className="block rounded-lg transition-colors hover:bg-black/5"
                            onClick={e => e.stopPropagation()}
                            title={`Open "${productName}" in a new tab`}>
                            {row}
                          </a>
                        ) : (
                          <div key={i}>{row}</div>
                        )
                      })}
                    </div>

                    {/* Bill */}
                    <div className="px-4 py-2 border-t" style={{ borderColor:'var(--viro-border)' }}>
                      {(order.sale_discount > 0 || order.original_subtotal > order.total_price) && (
                        <div className="flex justify-between text-sm">
                          <span style={{ color:'var(--viro-textSub)' }}>Original Price</span>
                          <span style={{ color:'#94A3B8',textDecoration:'line-through' }}>Rs.{(order.original_subtotal||order.total_price)?.toLocaleString()}</span>
                        </div>
                      )}
                      {order.sale_discount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span style={{ color:'#F97316' }}>🏷️ Sale Discount</span>
                          <span className="font-bold" style={{ color:'#F97316' }}>−Rs.{order.sale_discount?.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span style={{ color:'var(--viro-textSub)' }}>{order.sale_discount>0?'After Sale':'Subtotal'}</span>
                        <span style={{ color:'var(--viro-text)' }}>Rs.{order.total_price?.toLocaleString()}</span>
                      </div>
                      {order.coupon_code && (
                        <div className="flex justify-between text-sm">
                          <span style={{ color:'#10B981' }}>🎟️ Coupon ({order.coupon_code})</span>
                          <span className="font-bold" style={{ color:'#10B981' }}>−Rs.{order.coupon_discount?.toLocaleString()}</span>
                        </div>
                      )}
                      {order.prepaid_discount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span style={{ color:'#10B981' }}>💳 Prepaid Discount ({order.prepaid_discount_percent}%)</span>
                          <span className="font-bold" style={{ color:'#10B981' }}>−Rs.{order.prepaid_discount?.toLocaleString()}</span>
                        </div>
                      )}
                      {order.partner_credit_used > 0 && (
                        <div className="flex justify-between text-sm">
                          <span style={{ color:'#B45309' }}>🪙 Partner Coins</span>
                          <span className="font-bold" style={{ color:'#B45309' }}>−Rs.{order.partner_credit_used?.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span style={{ color:'var(--viro-textSub)' }}>Delivery</span>
                        <span className={isFree?'text-emerald-400 font-semibold':''} style={isFree?{}:{color:'var(--viro-text)'}}>
                          {isFree ? '🎉 FREE' : `Rs.${order.delivery_charges}`}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-sm border-t mt-1 pt-1" style={{ borderColor:'var(--viro-border)' }}>
                        <span style={{ color:'var(--viro-text)' }}>Total Charged</span>
                        <span style={{ color:'#7C3AED',fontSize:15 }}>Rs.{order.final_total?.toLocaleString()}</span>
                      </div>
                      {/* Payment method row */}
                      <div className="flex justify-between items-center text-sm mt-1 pt-1 border-t" style={{ borderColor:'var(--viro-border)' }}>
                        <span style={{ color:'var(--viro-textSub)' }}>Payment</span>
                        <PaymentBadge method={order.payment_method} paymentStatus={order.payment_status} size="sm" />
                      </div>
                      {((order.sale_discount||0)+(order.coupon_discount||0)+(order.prepaid_discount||0)) > 0 && (
                        <div className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-xl"
                          style={{ background:'#10B98112',border:'1px solid #10B98130' }}>
                          <span style={{ fontSize:12 }}>💰</span>
                          <span className="text-xs font-bold" style={{ color:'#10B981' }}>
                            Customer saved Rs.{((order.sale_discount||0)+(order.coupon_discount||0)+(order.prepaid_discount||0)).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* ── Payment Status Toggle (for prepaid orders) ── */}
                    {isPrepaid && (
                      <div className="px-4 py-2 border-t" style={{ borderColor:'var(--viro-border)' }}>
                        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color:'var(--viro-textSub)' }}>💳 Payment Receipt</p>
                        <div className="flex gap-2">
                          <button onClick={() => updateOrderPayment(order.id, 'PAID')}
                            className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                            style={{ background: order.payment_status==='PAID' ? '#10B98130' : '#10B98115',
                              color:'#10B981', border:`2px solid ${order.payment_status==='PAID'?'#10B981':'#10B98130'}` }}>
                            ✅ Mark as Paid
                          </button>
                          <button onClick={() => updateOrderPayment(order.id, 'UNPAID')}
                            className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                            style={{ background: order.payment_status!=='PAID' ? '#F9731630' : '#F9731615',
                              color:'#F97316', border:`2px solid ${order.payment_status!=='PAID'?'#F97316':'#F9731630'}` }}>
                            ⏳ Pending
                          </button>
                        </div>
                        {order.payment_status === 'PAID' && (
                          <p className="text-xs text-center mt-1" style={{ color:'#10B981' }}>✅ Receipt verified — payment confirmed</p>
                        )}
                      </div>
                    )}

                    {/* ── COD → Mark as Paid upgrade ── */}
                    {!isPrepaid && (
                      <div className="px-4 py-2 border-t" style={{ borderColor:'var(--viro-border)' }}>
                        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color:'var(--viro-textSub)' }}>💵 COD Payment</p>
                        {order.payment_status === 'PAID' ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 py-2 px-3 rounded-xl flex-1"
                              style={{ background:'#10B98118',border:'1px solid #10B98140' }}>
                              <span className="text-sm">✅</span>
                              <span className="text-xs font-bold" style={{ color:'#10B981' }}>Customer paid — order complete</span>
                            </div>
                            <button onClick={() => updateOrderPayment(order.id, 'UNPAID')}
                              className="ml-2 py-2 px-3 rounded-xl text-xs font-bold"
                              style={{ background:'#EF444415',color:'#F87171',border:'1px solid #EF444430' }}>
                              Undo
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => updateOrderPayment(order.id, 'PAID')}
                            className="w-full py-2 rounded-xl text-xs font-bold transition-all"
                            style={{ background:'#10B98115',color:'#10B981',border:'1px solid #10B98130' }}>
                            💰 Mark COD as Paid (collected cash)
                          </button>
                        )}
                      </div>
                    )}

                    {/* ── Status + Actions ── */}
                    <div className="px-4 py-3 border-t" style={{ borderColor:'var(--viro-border)' }}>
                      <div className="mb-3 overflow-x-auto">
                        <div className="flex items-center gap-0 min-w-max">
                          {['UNPAID','CONFIRMED','PROCESSING','SHIPPED','DELIVERED'].map((s,i) => {
                            const meta = ORDER_STATUS_META[s]
                            const isActive   = order.status === s
                            const isCancelled = order.status === 'CANCELLED'
                            const isReturned  = order.status === 'RETURNED'
                            const statusIdx  = ['UNPAID','CONFIRMED','PROCESSING','SHIPPED','DELIVERED'].indexOf(order.status)
                            const isPast     = statusIdx > i && !isCancelled && !isReturned
                            return (
                              <React.Fragment key={s}>
                                {i > 0 && <div className="h-0.5 w-4 flex-shrink-0" style={{ background: isPast||isActive ? meta.color : 'var(--viro-border)' }} />}
                                <button onClick={() => updateOrderStatus(order.id, s)} title={`Move to ${s}`}
                                  className="flex flex-col items-center gap-0.5 flex-shrink-0 transition-all"
                                  style={{ opacity:(isCancelled||isReturned)?0.4:1 }}>
                                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs border-2 transition-all"
                                    style={{ background: isActive?meta.color+'30':isPast?meta.color+'15':'var(--viro-bgDeep)',
                                      borderColor: isActive?meta.color:isPast?meta.color+'60':'var(--viro-border)',
                                      boxShadow: isActive?`0 0 8px ${meta.color}60`:'none' }}>
                                    {meta.icon}
                                  </div>
                                  <span className="text-[8px] font-bold leading-tight text-center"
                                    style={{ color:isActive?meta.color:'var(--viro-textSub)',maxWidth:30 }}>
                                    {s.slice(0,4)}
                                  </span>
                                </button>
                              </React.Fragment>
                            )
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold" style={{ color:'var(--viro-textSub)' }}>Status:</span>
                        <select value={order.status} onChange={e => updateOrderStatus(order.id, e.target.value)}
                          className="flex-1 rounded-lg text-xs" style={{ padding:'6px 10px' }}>
                          {ORDER_STATUSES.map(s => {
                            const m = ORDER_STATUS_META[s]
                            // The dropdown's own UNPAID option is the exact thing that
                            // reads as "still unpaid / stalled" to admin — so for a
                            // prepaid order, show it as payment-verification wording
                            // instead. Same underlying value ('UNPAID'), same DB write,
                            // this only changes what admin visually sees in the list.
                            const isPrepaidUnpaid = s === 'UNPAID' && order.payment_method && order.payment_method !== 'COD'
                            const label = isPrepaidUnpaid ? 'Paid — Pending Confirmation' : m?.label
                            const icon  = isPrepaidUnpaid ? '💰' : m?.icon
                            return <option key={s} value={s}>{icon} {isPrepaidUnpaid ? 'PENDING CONFIRMATION' : s} — {label}</option>
                          })}
                        </select>
                      </div>
                      {/* Reassurance for prepaid orders sitting at UNPAID — this is
                          normal (awaiting payment verification), not a stalled/failed
                          order the way an UNPAID COD order sitting idle would be. */}
                      <p className="text-[11px] mb-3 pl-1" style={{ color:'#F97316', minHeight: 14 }}>
                        {order.status === 'UNPAID' && order.payment_method && order.payment_method !== 'COD'
                          ? '🟠 Prepaid — awaiting payment verification, not a stalled order' : ''}
                      </p>
                      <div className="flex gap-2 mb-2">
                        <a href={`tel:${order.customers?.phone}`}
                          className="flex-1 text-center py-2 rounded-xl text-xs font-bold transition-all"
                          style={{ background:'#00BFFF15',color:'#00BFFF',border:'1px solid #00BFFF30' }}>
                          📞 Call
                        </a>
                        <a href={buildWaLink(order.customers?.phone, buildOrderConfirmationMessage({
                            customerName: order.customers?.name,
                            address: order.customers?.address,
                            city: order.customers?.city,
                            items: (order.order_items || []).map(i => ({ name: i.products?.name || 'Product', quantity: i.quantity, price: i.price })),
                            deliveryCharge: order.delivery_charges,
                            total: order.final_total,
                          }))}
                          target="_blank" rel="noopener"
                          className="flex-1 text-center py-2 rounded-xl text-xs font-bold"
                          style={{ background:'#25D36615',color:'#25D366',border:'1px solid #25D36630' }}>
                          💬 WhatsApp
                        </a>
                        <button onClick={() => setEditOrder(order)}
                          className="flex-1 text-center py-2 rounded-xl text-xs font-bold"
                          style={{ background:'#00BFFF15',color:'#00BFFF',border:'1px solid #00BFFF30' }}>
                          ✏️ Edit Info
                        </button>
                        <button onClick={() => setPrintOrder(order)}
                          className="flex-1 text-center py-2 rounded-xl text-xs font-bold"
                          style={{ background:'#7C3AED15',color:'#A78BFA',border:'1px solid #7C3AED30' }}>
                          🖨️ Print
                        </button>
                      </div>
                      {(order.status === 'DELIVERED' || order.status === 'SHIPPED') && (
                        <button onClick={() => updateOrderStatus(order.id, 'RETURNED')}
                          className="w-full mt-1 py-2 rounded-xl text-xs font-bold transition-all"
                          style={{ background:'rgba(168,85,247,0.12)',color:'#A855F7',border:'1px solid rgba(168,85,247,0.3)' }}>
                          ↩️ Mark as Returned — Stock will be restored
                        </button>
                      )}
                      {order.status === 'RETURNED' && (
                        <div className="mt-2 py-2 px-3 rounded-xl text-xs font-bold text-center"
                          style={{ background:'rgba(168,85,247,0.1)',color:'#A855F7',border:'1px solid rgba(168,85,247,0.25)' }}>
                          ↩️ Returned — Stock has been restored to inventory
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Filter Modal ── */}
      {showFilters && (
        <Portal>
        <div className="fixed inset-0 z-[999] flex items-end md:items-center justify-center"
          style={{ background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)' }}
          onClick={e => e.target===e.currentTarget && setShowFilters(false)}>
          <div className="w-full max-w-lg rounded-t-3xl md:rounded-3xl overflow-hidden"
            style={{ background:'var(--viro-bgCard)',border:'1px solid var(--viro-border)',
              maxHeight:'85vh',display:'flex',flexDirection:'column',animation:'popIn 0.3s cubic-bezier(.4,0,.2,1)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor:'var(--viro-border)' }}>
              <h2 className="font-extrabold text-lg" style={{ color:'var(--viro-text)' }}>All Filters</h2>
              <button onClick={() => setShowFilters(false)} className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background:'var(--viro-bgDeep)',color:'var(--viro-textMuted)' }}>✕</button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-6">

              {/* Payment Method */}
              <div>
                <h3 className="font-bold text-sm mb-3" style={{ color:'var(--viro-text)' }}>💳 Payment Method</h3>
                <div className="flex gap-2 flex-wrap">
                  {[['all','All Orders'],['cod','💵 COD'],['prepaid','💳 Prepaid']].map(([v,l]) => (
                    <button key={v} onClick={() => setDraft(d=>({...d,payMethod:v}))}
                      className="px-4 py-2 rounded-xl text-sm font-bold"
                      style={{ background: draft.payMethod===v ? '#8B5CF625' : 'var(--viro-bgDeep)',
                        color: draft.payMethod===v ? '#A78BFA' : 'var(--viro-textMuted)',
                        border:`1.5px solid ${draft.payMethod===v ? '#8B5CF660' : 'var(--viro-border)'}` }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Status */}
              <div>
                <h3 className="font-bold text-sm mb-3" style={{ color:'var(--viro-text)' }}>💰 Payment Status</h3>
                <div className="flex gap-2 flex-wrap">
                  {[['all','All'],['PAID','✅ Paid'],['UNPAID','⏳ Unpaid/Pending']].map(([v,l]) => (
                    <button key={v} onClick={() => setDraft(d=>({...d,payStatus:v}))}
                      className="px-4 py-2 rounded-xl text-sm font-bold"
                      style={{ background: draft.payStatus===v ? '#10B98125' : 'var(--viro-bgDeep)',
                        color: draft.payStatus===v ? '#10B981' : 'var(--viro-textMuted)',
                        border:`1.5px solid ${draft.payStatus===v ? '#10B98160' : 'var(--viro-border)'}` }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Order Status */}
              <div>
                <h3 className="font-bold text-sm mb-3" style={{ color:'var(--viro-text)' }}>Order Status</h3>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_LIST.map(s => {
                    const sc    = statusColors[s]||'#94A3B8'
                    const check = draft.statuses.includes(s)
                    return (
                      <label key={s} className="flex items-center gap-2.5 p-3 rounded-xl cursor-pointer transition-all"
                        style={{ background:check?sc+'18':'var(--viro-bgDeep)',border:`1px solid ${check?sc+'60':'var(--viro-border)'}` }}>
                        <input type="checkbox" checked={check} onChange={() => toggleDraftStatus(s)}
                          className="w-4 h-4 rounded flex-shrink-0" style={{ accentColor:sc }} />
                        <div>
                          <p className="text-sm font-semibold" style={{ color:check?sc:'var(--viro-text)' }}>{s}</p>
                          <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>{statusCounts[s]||0} orders</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* City */}
              {orderCities.length > 0 && (
                <div>
                  <h3 className="font-bold text-sm mb-3" style={{ color:'var(--viro-text)' }}>City</h3>
                  <div className="flex flex-wrap gap-2">
                    {orderCities.map(c => {
                      const check = draft.cities.includes(c)
                      return (
                        <label key={c} className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer text-sm font-semibold transition-all"
                          style={{ background:check?'#8B5CF625':'var(--viro-bgDeep)',
                            color:check?'#A78BFA':'var(--viro-textMuted)',
                            border:`1px solid ${check?'#8B5CF660':'var(--viro-border)'}` }}>
                          <input type="checkbox" checked={check} onChange={() => toggleDraftCity(c)}
                            className="w-3.5 h-3.5" style={{ accentColor:'#8B5CF6' }} />
                          📍 {c}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Amount range */}
              <div>
                <h3 className="font-bold text-sm mb-3" style={{ color:'var(--viro-text)' }}>Order Amount (Rs.)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color:'var(--viro-textSub)' }}>Min</label>
                    <input type="number" placeholder="e.g. 500" value={draft.minAmount}
                      onChange={e=>setDraft(d=>({...d,minAmount:e.target.value}))} />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color:'var(--viro-textSub)' }}>Max</label>
                    <input type="number" placeholder="e.g. 5000" value={draft.maxAmount}
                      onChange={e=>setDraft(d=>({...d,maxAmount:e.target.value}))} />
                  </div>
                </div>
              </div>

              {/* Date range */}
              <div>
                <h3 className="font-bold text-sm mb-3" style={{ color:'var(--viro-text)' }}>Date Range</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color:'var(--viro-textSub)' }}>From</label>
                    <input type="date" value={draft.dateFrom} onChange={e=>setDraft(d=>({...d,dateFrom:e.target.value}))} style={{ colorScheme:'dark' }} />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color:'var(--viro-textSub)' }}>To</label>
                    <input type="date" value={draft.dateTo} onChange={e=>setDraft(d=>({...d,dateTo:e.target.value}))} style={{ colorScheme:'dark' }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t flex gap-3" style={{ borderColor:'var(--viro-border)' }}>
              <button onClick={() => setDraft({ statuses:[],cities:[],minAmount:'',maxAmount:'',minItems:'',maxItems:'',dateFrom:'',dateTo:'',payMethod:'all',payStatus:'all' })}
                className="flex-1 py-3 rounded-xl font-bold text-sm border transition-all"
                style={{ background:'transparent',color:'var(--viro-textMuted)',borderColor:'var(--viro-border)' }}>
                Reset
              </button>
              <button onClick={applyFilters}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all"
                style={{ background:'linear-gradient(135deg,#00BFFF,#8B5CF6)' }}>
                Show {filtered.length} results
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* ── Bulk Print Modal ── */}
      {bulkPrintOpen && (
        <Portal>
          <div style={{ position:'fixed',inset:0,zIndex:9997,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
            onClick={e => e.target===e.currentTarget && setBulkPrintOpen(false)}>
            <div style={{ width:'100%',maxWidth:440,background:'var(--viro-bgCard)',borderRadius:20,border:'1px solid var(--viro-border)',overflow:'hidden',animation:'popIn 0.25s ease' }}>
              <div style={{ padding:'16px 20px',borderBottom:'1px solid var(--viro-border)',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                <h2 style={{ fontWeight:900,fontSize:16,color:'var(--viro-text)',margin:0 }}>🖨️ Bulk Print Slips</h2>
                <button onClick={() => setBulkPrintOpen(false)} style={{ width:32,height:32,borderRadius:'50%',background:'var(--viro-bgDeep)',border:'none',cursor:'pointer',color:'var(--viro-textMuted)',fontSize:16 }}>✕</button>
              </div>
              <div style={{ padding:'20px' }}>
                <p style={{ fontSize:13,color:'var(--viro-text)',marginBottom:16,fontWeight:600 }}>
                  {bulkSelected.size} order{bulkSelected.size!==1?'s':''} selected
                </p>
                {/* Quick options */}
                {[
                  { perPage:4, icon:'📄', label:'4 Slips Per Page',  desc:'Compact — saves paper & ink' },
                  { perPage:2, icon:'📋', label:'2 Slips Per Page',  desc:'Medium size — easy to read' },
                  { perPage:1, icon:'🗒️', label:'1 Slip Per Page (Full Size)', desc:'Beautiful full-size slip' },
                ].map(opt => (
                  <button key={opt.perPage} onClick={() => {
                    const selectedOrders = filtered.filter(o => bulkSelected.has(o.id))
                    const senderInfo = (() => { try { return JSON.parse(localStorage.getItem('viro_sender')||'null') || {name:'Viro.pk',phone:'03290081469',address:'Burewala, Punjab, Pakistan'} } catch { return {name:'Viro.pk',phone:'03290081469',address:'Burewala, Punjab, Pakistan'} } })()
                    setBulkPrintOpen(false)
                    setTimeout(() => {
                      let html
                      if (opt.perPage === 1) {
                        const slipBodies = selectedOrders.map((o,i) => {
                          const full = generateSlipHTML(o, senderInfo)
                          const match = full.match(/<body>([\s\S]*?)<\/body>/)
                          const body = match ? match[1] : full
                          return `<div style="page-break-after:${i===selectedOrders.length-1?'auto':'always'};padding:20px 0">${body}</div>`
                        }).join('')
                        html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${slipBodies}<script>window.onload=function(){window.print();setTimeout(function(){window.close()},1000)}<\/script></body></html>`
                      } else {
                        html = generateBulkSlipsHTML(selectedOrders, senderInfo, opt.perPage)
                      }
                      const blob = new Blob([html], {type:'text/html'})
                      const url = URL.createObjectURL(blob)
                      window.open(url, '_blank')
                      setTimeout(() => URL.revokeObjectURL(url), 10000)
                    }, 100)
                  }}
                  style={{ width:'100%',padding:'12px 14px',borderRadius:12,marginBottom:8,cursor:'pointer',
                    background:'var(--viro-bgDeep)',color:'var(--viro-text)',border:'1px solid var(--viro-border)',
                    fontWeight:700,fontSize:13,textAlign:'left',display:'flex',alignItems:'center',gap:10,
                    transition:'all 0.15s' }}
                  onMouseEnter={e=>{e.currentTarget.style.background='#8B5CF618';e.currentTarget.style.borderColor='#8B5CF660'}}
                  onMouseLeave={e=>{e.currentTarget.style.background='var(--viro-bgDeep)';e.currentTarget.style.borderColor='var(--viro-border)'}}>
                  <span style={{ fontSize:22 }}>{opt.icon}</span>
                  <div>
                    <div>{opt.label}</div>
                    <div style={{ fontSize:10,fontWeight:400,color:'var(--viro-textSub)' }}>{opt.desc}</div>
                  </div>
                </button>
                ))}

                {/* Custom per page */}
                <div style={{ marginTop:4,padding:'12px 14px',borderRadius:12,border:'1px solid var(--viro-border)',background:'var(--viro-bgDeep)' }}>
                  <p style={{ fontSize:12,fontWeight:700,color:'var(--viro-text)',marginBottom:8 }}>✏️ Custom Slips Per Page</p>
                  <div style={{ display:'flex',gap:8 }}>
                    <input type="number" min="1" max="12" placeholder="e.g. 6" value={customPerPage}
                      onChange={e=>setCustomPerPage(e.target.value)}
                      style={{ flex:1,padding:'8px 12px',borderRadius:8,fontSize:13 }} />
                    <button onClick={() => {
                      const n = parseInt(customPerPage)
                      if (!n || n < 1 || n > 12) { alert('Enter a number between 1 and 12'); return }
                      const selectedOrders = filtered.filter(o => bulkSelected.has(o.id))
                      const senderInfo = (() => { try { return JSON.parse(localStorage.getItem('viro_sender')||'null') || {name:'Viro.pk',phone:'03290081469',address:'Burewala, Punjab, Pakistan'} } catch { return {name:'Viro.pk',phone:'03290081469',address:'Burewala, Punjab, Pakistan'} } })()
                      setBulkPrintOpen(false)
                      setTimeout(() => {
                        const html = generateBulkSlipsHTML(selectedOrders, senderInfo, n)
                        const blob = new Blob([html], {type:'text/html'})
                        window.open(URL.createObjectURL(blob), '_blank')
                      }, 100)
                    }}
                    style={{ padding:'8px 16px',borderRadius:8,background:'linear-gradient(135deg,#7C3AED,#4F46E5)',
                      color:'#fff',fontWeight:800,fontSize:12,border:'none',cursor:'pointer' }}>
                      Print
                    </button>
                  </div>
                  <p style={{ fontSize:10,color:'var(--viro-textSub)',marginTop:4 }}>1–12 slips per A4 page</p>
                </div>

                <div style={{ marginTop:12,display:'flex',alignItems:'center',gap:8 }}>
                  <input type="checkbox" id="clearAfterPrint" style={{ accentColor:'#8B5CF6' }}
                    onChange={e => e.target.checked && setBulkSelected(new Set())} />
                  <label htmlFor="clearAfterPrint" style={{ fontSize:12,color:'var(--viro-textSub)',cursor:'pointer' }}>
                    Clear selection after printing
                  </label>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* ── Print Modal ── */}
      {printOrder && <PrintModal order={printOrder} onClose={() => setPrintOrder(null)} />}

      {/* ── Edit Modal ── */}
      {editOrder && <EditOrderModal order={editOrder} onClose={() => setEditOrder(null)} onSave={updateOrderInfo} />}
    </div>
  )
}

export default OrdersTab
