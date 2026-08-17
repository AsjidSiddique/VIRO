'use client'
import { supabase } from '../lib/supabase'
import { buildCheckoutNudgeMessage, buildWaLink } from '../lib/whatsappMessages'
import React, { useState, useEffect, useMemo } from 'react'

// ── Checkout Activity ─────────────────────────────────────────────────────
// Full checkout funnel, three tiers, low bar to high bar:
//   1. "Opened checkout"        — checkout_starts fired (page loaded with a
//                                  non-empty cart). No name/phone typed yet.
//   2. "Filled info"            — checkout_sessions row exists (name/phone/
//                                  email captured on blur, or "Review Order"
//                                  clicked). Covers both 'reviewing' and
//                                  'abandoned' — both mean they gave contact
//                                  info, just differ on whether they came back.
//   3. "Order placed"           — checkout_sessions row with status
//                                  'completed' (an order actually went through).
//
// Tier 1 used to be invisible here entirely — it only showed up as the
// Dashboard's "🔥 Very interested — reached checkout" badge, which is a much
// lower bar than this tab's title implied. Reused here via /api/admin-cart
// (same data source that badge already reads from — checkout_starts is
// service-role-only, so it can't be queried directly with the anon key).
// Anyone who has BOTH a checkout_starts row AND a checkout_sessions row only
// shows once, under tier 2/3 — tier 1 is exclusively "opened checkout and
// never gave any info at all."

function fmtTimeAgo(iso) {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// Exact date + time for each individual checkout, e.g. "Jul 11, 2:34 PM" —
// the relative "11m ago" alone isn't enough when someone checks out 3
// times in one day and admin needs to tell those visits apart.
function fmtDateTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

const STATUS_META = {
  opened_checkout: { label: 'Opened checkout — no info given', color: '#3B82F6', bg: '#3B82F615' },
  reviewing: { label: 'Reviewing — not placed yet', color: '#F59E0B', bg: '#F59E0B15' },
  completed: { label: 'Completed order',            color: '#10B981', bg: '#10B98115' },
  abandoned: { label: 'Abandoned',                   color: '#EF4444', bg: '#EF444415' },
}

// ── Funnel stage — mirrors the customer-facing "Info → Review → Confirmed"
// stepper on the checkout page itself, plus "Opened" for tier 1 (page
// loaded, nothing typed yet). Lets admin see at a glance not just THAT
// someone is "reviewing", but exactly where in the checkout they are.
const FUNNEL_STAGES = ['opened', 'info', 'review', 'confirmed']
const STAGE_LABEL = { opened: 'Opened', info: 'Info', review: 'Review', confirmed: 'Confirmed' }
function visitStage(v) {
  if (v.effective_status === 'opened_checkout') return 'opened'
  if (v.effective_status === 'completed') return 'confirmed'
  // 'reviewing' or 'abandoned' — checkout_step says which page they were on.
  // Rows saved before checkout_step existed have it as null/undefined —
  // treat those as 'info' (the safer default; most captures happen there).
  return v.checkout_step === 'review' ? 'review' : 'info'
}

// Small horizontal 4-step tracker: filled dot + line up to the current
// stage, hollow beyond it. Compact enough to sit inline in a card without
// needing its own row.
function FunnelStepper({ stage }) {
  const currentIdx = FUNNEL_STAGES.indexOf(stage)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:2 }}>
      {FUNNEL_STAGES.map((s, i) => (
        <React.Fragment key={s}>
          {i > 0 && (
            <div style={{ width:10, height:2, background: i <= currentIdx ? '#8B5CF6' : 'var(--viro-border)' }} />
          )}
          <div title={STAGE_LABEL[s]} style={{
            width:7, height:7, borderRadius:'50%',
            background: i <= currentIdx ? '#8B5CF6' : 'transparent',
            border: i <= currentIdx ? 'none' : '1.5px solid var(--viro-border)',
          }} />
        </React.Fragment>
      ))}
      <span style={{ fontSize:10, fontWeight:800, color:'#8B5CF6', marginLeft:4 }}>{STAGE_LABEL[stage]}</span>
    </div>
  )
}

export default function CheckoutActivityTab({ onOpenOrder }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all') // all | opened | filled | completed
  const [search, setSearch]     = useState('')
  // Date filter — matches the same pattern as the "In Carts" panel's filter,
  // so admin has one consistent way to scope activity by time everywhere.
  const [dateFilter, setDateFilter] = useState('all') // all | today | yesterday | 7d | custom
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')
  // Which customer cards are expanded to show their full visit history.
  // Collapsed by default — main view shows just latest visit + total count.
  const [expanded, setExpanded] = useState({})
  const toggleExpanded = key => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    // Anything sitting in 'reviewing' for 2+ hours is treated as abandoned
    // for display purposes (no separate cron needed — just a display-time cutoff).
    const { data, error } = await supabase
      .from('checkout_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)
    if (!error && data) {
      // ── Clean up orphaned completions ──────────────────────────────
      // If admin deletes an order, the checkout_sessions row that was
      // marked "completed" with that order's id becomes a dangling
      // reference — it would otherwise show forever as a "completed"
      // checkout pointing at an order that no longer exists anywhere.
      // Check which linked order ids are still real, and delete the
      // checkout_sessions row entirely for any that aren't.
      const linkedOrderIds = [...new Set(data.filter(s => s.completed_order_id).map(s => s.completed_order_id))]
      let existingOrderIds = new Set()
      if (linkedOrderIds.length > 0) {
        const { data: existingOrders } = await supabase.from('orders').select('id').in('id', linkedOrderIds)
        existingOrderIds = new Set((existingOrders || []).map(o => o.id))
      }
      const orphaned = data.filter(s => s.completed_order_id && !existingOrderIds.has(s.completed_order_id))
      if (orphaned.length > 0) {
        await supabase.from('checkout_sessions').delete().in('id', orphaned.map(s => s.id))
      }
      const orphanedIds = new Set(orphaned.map(s => s.id))
      const data2 = data.filter(s => !orphanedIds.has(s.id))

      const cutoff = Date.now() - 2 * 3600_000
      const withStatus = data2.map(s => ({
        ...s,
        effective_status: s.status === 'reviewing' && new Date(s.updated_at || s.created_at).getTime() < cutoff
          ? 'abandoned' : s.status,
      }))

      // ── Group by real identity, but keep EVERY visit ──────────────────
      // Each browser/device gets its OWN session_id (and logging out even
      // rotates it on the SAME device — see CartContext.jsx) — so the same
      // real customer visiting checkout multiple times used to show up as
      // several disconnected rows. Group by that real identity for a single
      // customer card, but — unlike before — keep every individual visit
      // underneath it with its own exact date/time and amount, instead of
      // collapsing down to just the latest one. Someone who checks out 3
      // times in a day should show all 3, not just a "3 visits" badge.
      const byIdentity = {}
      withStatus.forEach(s => {
        const key = s.customer_id ? `c:${s.customer_id}` : (s.phone ? `p:${s.phone}` : `s:${s.session_id}`)
        if (!byIdentity[key]) byIdentity[key] = { key, visits: [] }
        byIdentity[key].visits.push(s)
      })
      const grouped = Object.values(byIdentity).map(group => {
        const visits = group.visits.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
        return { ...visits[0], visits, visit_count: visits.length }
      })

      // ── Tier 1: bring in "opened checkout, gave no info" ────────────────
      // These sessions never wrote a checkout_sessions row at all, so they
      // don't exist anywhere above. /api/admin-cart already computes
      // reached_checkout (from checkout_starts) per identity for the
      // Dashboard's badge — reuse that instead of adding a new edge action.
      const sessionIdsWithInfo  = new Set(data2.map(s => s.session_id).filter(Boolean))
      const customerIdsWithInfo = new Set(data2.filter(s => s.customer_id).map(s => s.customer_id))
      let openedOnly = []
      try {
        const cartRes = await fetch('/api/admin-cart').then(r => r.json()).catch(() => null)
        const cartByCustomer = Array.isArray(cartRes?.cartByCustomer) ? cartRes.cartByCustomer : []
        openedOnly = cartByCustomer
          .filter(c => c.reached_checkout)
          // Skip anyone who ALSO has a checkout_sessions row — they already
          // show above under 'reviewing' / 'abandoned' / 'completed'; tier 1
          // is exclusively people with NO checkout_sessions row whatsoever.
          .filter(c => c.is_registered
            ? !customerIdsWithInfo.has(c.identity_key.slice(2))
            : !sessionIdsWithInfo.has(c.identity_key.slice(2)))
          .map(c => {
            const isRegistered = c.is_registered
            const syntheticVisit = {
              id: `oc:${c.identity_key}`,
              session_id: isRegistered ? null : c.identity_key.slice(2),
              customer_id: isRegistered ? c.identity_key.slice(2) : null,
              name: c.name || null, phone: c.phone || null, email: null, city: c.city || null,
              is_authenticated: !!isRegistered,
              cart_value: c.net_value || 0,
              cart_snapshot: (c.products || []).map(p => ({ name: p.product_name, quantity: p.quantity })),
              is_direct_buy: false,
              status: 'opened_checkout',
              effective_status: 'opened_checkout',
              completed_order_id: null,
              created_at: c.checkout_started_at, updated_at: c.checkout_started_at,
            }
            return {
              key: `oc:${c.identity_key}`, name: c.name || null, phone: c.phone || null,
              email: null, city: c.city || null,
              visits: [syntheticVisit], visit_count: 1, ...syntheticVisit,
            }
          })
      } catch (e) {
        console.warn('[CheckoutActivity] opened-checkout merge failed (non-fatal):', e?.message)
      }

      setSessions([...grouped, ...openedOnly].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)))
    }
    setLoading(false)
  }

  // ── Date + search filtering, shared by BOTH the tab counts and the
  // displayed list ─────────────────────────────────────────────────────────
  // BUGFIX: the tab counts ("Opened Checkout (1)" etc.) used to be computed
  // straight off the raw, un-date-filtered `sessions` state, while the
  // actual displayed list applied the date filter (and search) on top.
  // Result: with any date filter other than "All time" active (or a search
  // term typed in), a tab could show a count like "1" while the list itself
  // — correctly respecting that date filter — had nothing matching to show,
  // looking like a bug even though each half was individually "correct" for
  // different criteria. Both now come from this ONE shared base.
  const dateSearchFiltered = useMemo(() => {
    let since = null, until = null
    if (dateFilter !== 'all') {
      const now = new Date()
      if (dateFilter === 'today') {
        since = new Date(now); since.setHours(0,0,0,0)
      } else if (dateFilter === 'yesterday') {
        since = new Date(now); since.setDate(since.getDate() - 1); since.setHours(0,0,0,0)
        until = new Date(now); until.setHours(0,0,0,0)
      } else if (dateFilter === '7d') {
        since = new Date(now); since.setDate(since.getDate() - 7)
      } else if (dateFilter === 'custom' && customFrom) {
        since = new Date(customFrom)
        until = customTo ? new Date(new Date(customTo).getTime() + 86400000) : null // include the whole "to" day
      }
    }
    const q = search.trim().toLowerCase()

    // Filter each customer's individual visits first (by date), then only
    // keep customers who still have at least one matching visit — so
    // "Today" genuinely shows only today's checkouts, per visit, not just
    // whichever customer happened to have ANY activity today.
    return sessions
      .map(group => {
        const matchingVisits = group.visits.filter(v => {
          const t = new Date(v.updated_at || v.created_at)
          if (since && t < since) return false
          if (until && t >= until) return false
          return true
        })
        if (matchingVisits.length === 0) return null
        if (q && !(group.name?.toLowerCase().includes(q) || group.phone?.includes(q) || group.email?.toLowerCase().includes(q))) return null
        return { ...group, visits: matchingVisits, visit_count: matchingVisits.length }
      })
      .filter(Boolean)
  }, [sessions, search, dateFilter, customFrom, customTo])

  // The tab's own status filter (all / opened / filled / completed) applied
  // on top of the date+search base above.
  const filtered = useMemo(() => {
    if (filter === 'all') return dateSearchFiltered
    return dateSearchFiltered
      .map(group => {
        const matchingVisits = group.visits.filter(v => {
          if (filter === 'opened' && v.effective_status !== 'opened_checkout') return false
          if (filter === 'filled' && !['reviewing', 'abandoned'].includes(v.effective_status)) return false
          if (filter === 'completed' && v.effective_status !== 'completed') return false
          return true
        })
        if (matchingVisits.length === 0) return null
        return { ...group, visits: matchingVisits, visit_count: matchingVisits.length }
      })
      .filter(Boolean)
  }, [dateSearchFiltered, filter])

  // Counts now come from the SAME date+search-filtered base as the list
  // above, just tallied per status instead of also being sliced by status —
  // so a tab's number always matches what clicking it actually shows.
  const counts = useMemo(() => {
    const allVisits = dateSearchFiltered.flatMap(g => g.visits)
    return {
      all:       allVisits.length,
      opened:    allVisits.filter(s => s.effective_status === 'opened_checkout').length,
      filled:    allVisits.filter(s => ['reviewing', 'abandoned'].includes(s.effective_status)).length,
      completed: allVisits.filter(s => s.effective_status === 'completed').length,
    }
  }, [dateSearchFiltered])

  return (
    <div className="p-4 pb-24">
      <div className="mb-4">
        <h2 className="text-lg font-extrabold" style={{ color:'var(--viro-text)' }}>🧾 Checkout Activity</h2>
        <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
          The full checkout funnel — from a first glance at the page to a placed order.
        </p>
      </div>

      {/* Date filter — same shape as the "In Carts" panel's filter, plus a
          custom range and a dedicated refresh (the global admin refresh
          button doesn't reach this tab's own data fetch). */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center', marginBottom:12, padding:'8px 10px', borderRadius:10, background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
        <span style={{ fontSize:10, fontWeight:800, color:'var(--viro-textSub)', textTransform:'uppercase', letterSpacing:'0.03em' }}>Filter</span>
        <select value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          style={{ fontSize:11, fontWeight:700, padding:'6px 10px', borderRadius:8, border:'1px solid var(--viro-border)', background:'var(--viro-bg,#fff)', color:'var(--viro-text)', cursor:'pointer' }}>
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7d">Last 7 days</option>
          <option value="custom">Custom range…</option>
        </select>
        {dateFilter === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              style={{ fontSize:11, fontWeight:600, padding:'6px 8px', borderRadius:8, border:'1px solid var(--viro-border)', background:'var(--viro-bg,#fff)', color:'var(--viro-text)' }} />
            <span style={{ fontSize:11, color:'var(--viro-textSub)' }}>to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              style={{ fontSize:11, fontWeight:600, padding:'6px 8px', borderRadius:8, border:'1px solid var(--viro-border)', background:'var(--viro-bg,#fff)', color:'var(--viro-text)' }} />
          </>
        )}
        <button type="button" onClick={load} disabled={loading}
          style={{ fontSize:11, fontWeight:700, padding:'6px 12px', borderRadius:8, border:'1px solid var(--viro-border)', background:'var(--viro-bg,#fff)', color:'#8B5CF6', cursor: loading ? 'not-allowed' : 'pointer', marginLeft:'auto' }}>
          {loading ? '⏳' : '↻'} Refresh
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
        {[
          { id:'all',       label:`All (${counts.all})` },
          { id:'opened',    label:`🔵 Opened Checkout (${counts.opened})` },
          { id:'filled',    label:`🟡 Filled Info (${counts.filled})` },
          { id:'completed', label:`🟢 Order Placed (${counts.completed})` },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold flex-shrink-0 transition-all"
            style={filter === f.id
              ? { background:'linear-gradient(135deg,#00BFFF,#8B5CF6)', color:'#fff' }
              : { background:'var(--viro-bgCard)', color:'var(--viro-textSub)', border:'1px solid var(--viro-border)' }}>
            {f.label}
          </button>
        ))}
      </div>

      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search name, phone, or email…"
        className="w-full mb-3 px-3 py-2 rounded-xl text-sm"
        style={{ background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)', color:'var(--viro-text)' }}
      />

      {loading ? (
        <p className="text-sm text-center py-10" style={{ color:'var(--viro-textSub)' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-center py-10" style={{ color:'var(--viro-textSub)' }}>No checkout activity yet.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(group => {
            const isOpen = !!expanded[group.key]
            const latest = group.visits[0]
            const latestMeta = STATUS_META[latest.effective_status] || STATUS_META.reviewing
            const totalValue = group.visits.reduce((sum, v) => sum + (v.cart_value || 0), 0)
            return (
              <div key={group.key} className="viro-card p-3">
                {/* Collapsed header — click to expand full visit history */}
                <button
                  type="button"
                  onClick={() => toggleExpanded(group.key)}
                  className="w-full text-left"
                  style={{ background:'none', border:'none', padding:0, cursor:'pointer' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm truncate" style={{ color:'var(--viro-text)' }}>{group.name || 'Unknown'}</p>
                        {/* Registered vs guest — reflects whether the LATEST
                            visit was an actual logged-in session
                            (is_authenticated), not just whether customer_id
                            is set. customer_id can be phone-matched onto a
                            guest checkout to link their history (see
                            captureCheckoutProgress) — that's a different
                            thing from "were they logged in right now", and
                            conflating the two mislabeled a guest checkout
                            as "✅ Registered" just because it shared a phone
                            with a known customer. */}
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={latest.is_authenticated
                            ? { background:'#10B98115', color:'#10B981' }
                            : { background:'var(--viro-border)', color:'var(--viro-textSub)' }}>
                          {latest.is_authenticated ? '✅ Registered' : (group.name || group.phone ? '👤 Guest' : '👤 Guest (No info)')}
                        </span>
                        {group.visit_count > 1 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background:'#8B5CF615', color:'#8B5CF6' }}>
                            {group.visit_count} checkouts
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: latestMeta.bg, color: latestMeta.color }}>
                          {latestMeta.label}
                        </span>
                      </div>
                      <div className="mt-1">
                        <FunnelStepper stage={visitStage(latest)} />
                      </div>
                      <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                        {group.phone} {group.email && <> · {group.email}</>} {group.city && <> · {group.city}</>}
                      </p>
                      <p className="text-xs mt-1" style={{ color:'var(--viro-textMuted)' }}>
                        Latest: {fmtDateTime(latest.updated_at || latest.created_at)} ({fmtTimeAgo(latest.updated_at || latest.created_at)})
                      </p>
                      {latest.effective_status !== 'completed' && group.phone && (
                        <a href={buildWaLink(group.phone, buildCheckoutNudgeMessage({ name: group.name, phone: group.phone, cart_snapshot: Array.isArray(latest.cart_snapshot) ? latest.cart_snapshot : [], cart_value: latest.cart_value }))}
                          target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[10px] font-bold mt-1.5 px-2 py-1 rounded-full"
                          style={{ background:'#25D36615', color:'#25D366' }}>
                          💬 Send Reminder
                        </a>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-extrabold text-sm" style={{ color:'#7C3AED' }}>
                        Rs.{Math.round(group.visit_count > 1 ? totalValue : latest.cart_value || 0).toLocaleString()}
                      </p>
                      {group.visit_count > 1 && (
                        <p className="text-[10px] mt-0.5" style={{ color:'var(--viro-textSub)' }}>total across {group.visit_count}</p>
                      )}
                      <p className="text-[10px] font-bold mt-1" style={{ color:'#00BFFF' }}>
                        {isOpen ? '▲ Hide details' : '▼ View all'}
                      </p>
                    </div>
                  </div>
                </button>

                {/* Every individual visit — its own date/time, status, and amount.
                    Only rendered once expanded, so the default view stays scannable. */}
                {isOpen && (
                  <div className="space-y-1.5 mt-2" style={{ borderTop:'1px solid var(--viro-border)', paddingTop:8 }}>
                    {group.visits.map(v => {
                      const meta = STATUS_META[v.effective_status] || STATUS_META.reviewing
                      const cart = Array.isArray(v.cart_snapshot) ? v.cart_snapshot : []
                      return (
                        <div key={v.id} className="flex items-start justify-between gap-2 py-1">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold" style={{ color:'var(--viro-text)' }}>{fmtDateTime(v.updated_at || v.created_at)}</span>
                              <span className="text-[10px]" style={{ color:'var(--viro-textSub)' }}>({fmtTimeAgo(v.updated_at || v.created_at)})</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={v.is_authenticated
                                  ? { background:'#10B98115', color:'#10B981' }
                                  : { background:'var(--viro-border)', color:'var(--viro-textSub)' }}>
                                {v.is_authenticated ? '✅ Registered' : '👤 Guest'}
                              </span>
                              {v.is_direct_buy && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background:'#F59E0B15', color:'#F59E0B' }}>⚡ Direct Buy</span>
                              )}
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>
                                {meta.label}
                              </span>
                            </div>
                            {/* Exactly where in the funnel this visit reached — Opened
                                (page loaded, nothing typed) through Confirmed (order
                                placed). More precise than the status badge alone,
                                which can't distinguish "still on the info form" from
                                "already at Review Order". */}
                            <div className="mt-1">
                              <FunnelStepper stage={visitStage(v)} />
                            </div>
                            {cart.length > 0 && (
                              <p className="text-xs mt-1 truncate" style={{ color:'var(--viro-textMuted)' }}>
                                {cart.slice(0,3).map(i => `${i.name} ×${i.quantity}`).join(', ')}
                                {cart.length > 3 && ` +${cart.length - 3} more`}
                              </p>
                            )}
                            {/* Nudge — only for a checkout that's still open (not yet
                                completed) and where we actually have a phone number to
                                message. Same warm, incentive-nudging template as the
                                Dashboard's "In Carts" tab, just worded for someone who
                                got as far as checkout rather than only adding to cart. */}
                            {v.effective_status !== 'completed' && group.phone && (
                              <a href={buildWaLink(group.phone, buildCheckoutNudgeMessage({ name: group.name, phone: group.phone, cart_snapshot: cart, cart_value: v.cart_value }))}
                                target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-[10px] font-bold mt-1.5 px-2 py-1 rounded-full"
                                style={{ background:'#25D36615', color:'#25D366' }}>
                                💬 Send Reminder
                              </a>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-extrabold text-sm" style={{ color:'#7C3AED' }}>Rs.{Math.round(v.cart_value || 0).toLocaleString()}</p>
                            {v.completed_order_id && onOpenOrder && (
                              <>
                                <p className="text-[10px] mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                                  #{v.completed_order_id.slice(0,8).toUpperCase()}
                                </p>
                                <button onClick={(e) => { e.stopPropagation(); onOpenOrder(v.completed_order_id) }}
                                  className="text-[10px] font-bold mt-0.5 underline" style={{ color:'#00BFFF' }}>
                                  View order →
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
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