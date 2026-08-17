'use client'
import React, { useState, useEffect } from 'react'
import { adminApi } from '../lib/adminApi'
import { supabase } from '../lib/supabase'
import { showSimpleToast } from '../components/Toast'
import { sendPartnerApprovedEmail, sendPartnerRejectedEmail } from '../lib/email'

function StatCard({ label, value, color = 'var(--viro-text)', icon }) {
  return (
    <div style={{
      background: 'var(--viro-bgCard, #1E293B)', border: '1px solid var(--viro-border, #334155)',
      borderRadius: 14, padding: '14px 16px', flex: 1, minWidth: 0,
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--viro-textSub)', margin: 0, textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {icon} {label}
      </p>
      <p style={{ fontSize: 20, fontWeight: 800, color, margin: '4px 0 0' }}>{value}</p>
    </div>
  )
}

function InfluencersTab({ focusId, onFocusConsumed, onDataChanged }) {
  const [rows,    setRows]    = useState([])
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState('pending') // pending | approved | rejected
  const [search,  setSearch]  = useState('')
  const [leaderboard, setLeaderboard] = useState([])

  // Approve modal state
  const [approving, setApproving] = useState(null)
  const [commissionPct, setCommissionPct] = useState('10')
  const [couponMode, setCouponMode] = useState('new')
  const [newCoupon, setNewCoupon] = useState({ code: '', type: 'percent', value: '10' })
  const [existingCouponId, setExistingCouponId] = useState('')
  const [saving, setSaving] = useState(false)

  // Reject modal
  const [rejecting, setRejecting] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  // Edit modal
  const [editing, setEditing] = useState(null)
  const [editCommission, setEditCommission] = useState('')

  // Balance adjustment modal
  const [adjusting, setAdjusting] = useState(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustNote, setAdjustNote] = useState('')

  // Sorting for the Active list
  const [sortBy, setSortBy] = useState('balance') // balance | pending | newest | name

  // Detail drawer
  const [detailId, setDetailId] = useState(null)
  const [detail, setDetail]     = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailSearch, setDetailSearch] = useState('')

  // Tier settings — admin-configurable thresholds/multipliers, replacing
  // what used to be hardcoded in three separate places (DB trigger, edge
  // function, frontend). Loaded from site_settings, same table already
  // used for delivery rules etc.
  const [tierSettings, setTierSettings] = useState(null)
  const [showTierEditor, setShowTierEditor] = useState(false)
  const [tierDraft, setTierDraft] = useState([])
  const [tierSaving, setTierSaving] = useState(false)

  async function loadTierSettings() {
    try {
      const { data } = await supabase.from('site_settings').select('value').eq('key', 'partner_tiers').maybeSingle()
      const tiers = Array.isArray(data?.value) && data.value.length ? data.value : [
        { key: 'starter', icon: '🥉', label: 'Starter', at: 0, multiplier: 1.0 },
        { key: 'rising', icon: '🥈', label: 'Rising Star', at: 5, multiplier: 1.1 },
        { key: 'star', icon: '🥇', label: 'Star Partner', at: 20, multiplier: 1.25 },
        { key: 'elite', icon: '💎', label: 'Elite Partner', at: 50, multiplier: 1.5 },
      ]
      setTierSettings(tiers)
    } catch { /* editor just shows defaults if this fails */ }
  }

  function openTierEditor() {
    setTierDraft((tierSettings || []).map(t => ({ ...t })))
    setShowTierEditor(true)
  }

  async function saveTiers() {
    // Sanity: thresholds must be strictly increasing, or the "which tier
    // applies" logic (both here and in the DB trigger) breaks in confusing
    // ways — better to catch it here than let admin discover it later.
    for (let i = 1; i < tierDraft.length; i++) {
      if (Number(tierDraft[i].at) <= Number(tierDraft[i - 1].at)) {
        showSimpleToast('⚠️ Each tier\'s order threshold must be higher than the one before it', 'info')
        return
      }
    }
    setTierSaving(true)
    try {
      const res = await adminApi('site_setting_update', { key: 'partner_tiers', value: tierDraft })
      if (res?.error) throw new Error(res.error)
      showSimpleToast('✅ Tier settings saved', 'success')
      setTierSettings(tierDraft)
      setShowTierEditor(false)
    } catch (e) {
      showSimpleToast('❌ ' + e.message, 'info')
    }
    setTierSaving(false)
  }

  async function load() {
    setLoading(true)
    try {
      const res = await adminApi('influencer_list')
      setRows(res?.data || [])
    } catch (e) {
      showSimpleToast('❌ Failed to load: ' + e.message, 'info')
    }
    try {
      const { data } = await supabase.from('coupons').select('id,code,type,value,enabled').order('created_at', { ascending: false })
      setCoupons(data || [])
    } catch { /* dropdown just stays empty */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => { loadTierSettings() }, [])

  useEffect(() => {
    fetch('/api/influencer-leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then(r => r.json()).then(json => setLeaderboard(json?.top || [])).catch(() => {})
  }, [])

  // Deep-link from Orders: "🤝 via X" badge sends us here with an id to
  // open immediately, instead of dropping the admin on the tab to hunt
  // for the right row themselves.
  useEffect(() => {
    if (focusId) {
      setTab('approved')
      openDetail(focusId)
      onFocusConsumed?.()
    }
  }, [focusId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Additional coupons modal
  const [addingCouponTo, setAddingCouponTo] = useState(null)
  const [newCouponMode, setNewCouponMode] = useState('new') // 'new' | 'existing'
  const [newExtraCoupon, setNewExtraCoupon] = useState({ code: '', type: 'percent', value: '10' })
  const [existingExtraCouponId, setExistingExtraCouponId] = useState('')
  const [extraCouponSaving, setExtraCouponSaving] = useState(false)

  async function confirmAddExtraCoupon() {
    if (newCouponMode === 'new' && !newExtraCoupon.code.trim()) {
      showSimpleToast('⚠️ Enter a coupon code', 'info'); return
    }
    if (newCouponMode === 'existing' && !existingExtraCouponId) {
      showSimpleToast('⚠️ Pick an existing coupon', 'info'); return
    }
    setExtraCouponSaving(true)
    try {
      if (newCouponMode === 'new') {
        const created = await adminApi('influencer_add_coupon', {
          id: addingCouponTo.id,
          new_coupon: { code: newExtraCoupon.code.toUpperCase().trim(), type: newExtraCoupon.type, value: Number(newExtraCoupon.value) },
        })
        if (created?.error) throw new Error(created.error)
      } else {
        const res = await adminApi('influencer_add_coupon', { id: addingCouponTo.id, coupon_id: existingExtraCouponId })
        if (res?.error) throw new Error(res.error)
      }
      showSimpleToast('✅ Coupon linked', 'success')
      setAddingCouponTo(null)
      if (detailId === addingCouponTo.id) openDetail(addingCouponTo.id)
    } catch (e) {
      showSimpleToast('❌ ' + e.message, 'info')
    }
    setExtraCouponSaving(false)
  }

  async function removeExtraCoupon(linkId) {
    try {
      const res = await adminApi('influencer_remove_coupon', { link_id: linkId })
      if (res?.error) throw new Error(res.error)
      showSimpleToast('Coupon unlinked', 'success')
      if (detailId) openDetail(detailId)
    } catch (e) {
      showSimpleToast('❌ ' + e.message, 'info')
    }
  }

  async function openDetail(id) {
    setDetailId(id)
    setDetailLoading(true)
    setDetail(null)
    setDetailSearch('')
    try {
      const res = await adminApi('influencer_detail', { id })
      if (res?.error) throw new Error(res.error)
      setDetail(res)
    } catch (e) {
      showSimpleToast('❌ ' + e.message, 'info')
      setDetailId(null)
    }
    setDetailLoading(false)
  }

  function openApprove(row) {
    setApproving(row)
    setCommissionPct('10')
    setCouponMode('new')
    setNewCoupon({ code: (row.social_handle || row.name || 'PARTNER').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12) + '10', type: 'percent', value: '10' })
    setExistingCouponId('')
  }

  async function confirmApprove() {
    if (!commissionPct || Number(commissionPct) <= 0 || Number(commissionPct) > 100) {
      showSimpleToast('⚠️ Enter a commission % between 1 and 100', 'info'); return
    }
    if (couponMode === 'new' && !newCoupon.code.trim()) {
      showSimpleToast('⚠️ Enter a coupon code', 'info'); return
    }
    if (couponMode === 'existing' && !existingCouponId) {
      showSimpleToast('⚠️ Pick an existing coupon', 'info'); return
    }
    setSaving(true)
    try {
      const payload = { id: approving.id, commission_percent: Number(commissionPct) }
      if (couponMode === 'new') {
        payload.new_coupon = { code: newCoupon.code, type: newCoupon.type, value: Number(newCoupon.value) }
      } else {
        payload.coupon_id = existingCouponId
      }
      const res = await adminApi('influencer_approve', payload)
      if (res?.error) throw new Error(res.error)
      showSimpleToast('✅ Approved — coupon is live', 'success')
      const finalCouponCode = couponMode === 'new' ? newCoupon.code : (coupons.find(c => c.id === existingCouponId)?.code || '')
      sendPartnerApprovedEmail({
        name: approving.name, email: approving.google_email,
        couponCode: finalCouponCode, commissionPercent: commissionPct,
      }).catch(() => {}) // best-effort — approval already succeeded regardless
      setApproving(null)
      load(); onDataChanged?.()
    } catch (e) {
      showSimpleToast('❌ ' + e.message, 'info')
    }
    setSaving(false)
  }

  async function confirmReject() {
    setSaving(true)
    try {
      await adminApi('influencer_reject', { id: rejecting.id, reason: rejectReason.trim() || undefined })
      showSimpleToast('Request rejected', 'success')
      sendPartnerRejectedEmail({ name: rejecting.name, email: rejecting.google_email, reason: rejectReason.trim() }).catch(() => {})
      setRejecting(null); setRejectReason('')
      load()
    } catch (e) {
      showSimpleToast('❌ ' + e.message, 'info')
    }
    setSaving(false)
  }

  async function saveEdit() {
    setSaving(true)
    try {
      await adminApi('influencer_update', { id: editing.id, patch: { commission_percent: Number(editCommission) } })
      showSimpleToast('✅ Updated', 'success')
      setEditing(null)
      load(); onDataChanged?.()
      if (detailId === editing.id) openDetail(editing.id)
    } catch (e) {
      showSimpleToast('❌ ' + e.message, 'info')
    }
    setSaving(false)
  }

  async function confirmAdjust() {
    const amt = Number(adjustAmount)
    if (!amt) { showSimpleToast('⚠️ Enter a non-zero amount', 'info'); return }
    setSaving(true)
    try {
      const res = await adminApi('influencer_adjust_balance', { id: adjusting.id, amount: amt, note: adjustNote.trim() || undefined })
      if (res?.error) throw new Error(res.error)
      showSimpleToast(`✅ Balance ${amt > 0 ? 'increased' : 'decreased'} — new balance Rs.${res.new_balance.toLocaleString()}`, 'success')
      setAdjusting(null); setAdjustAmount(''); setAdjustNote('')
      load(); onDataChanged?.()
      if (detailId === adjusting.id) openDetail(adjusting.id)
    } catch (e) {
      showSimpleToast('❌ ' + e.message, 'info')
    }
    setSaving(false)
  }

  async function toggleSuspend(row) {
    try {
      const res = await adminApi('influencer_toggle_coupon', { id: row.id })
      if (res?.error) throw new Error(res.error)
      showSimpleToast(res.enabled ? '✅ Coupon reactivated' : '⏸️ Partner suspended — their coupon no longer works', 'success')
      load(); onDataChanged?.()
      if (detailId === row.id) openDetail(row.id)
    } catch (e) {
      showSimpleToast('❌ ' + e.message, 'info')
    }
  }

  function copyReferralLink(code) {
    const link = `https://viro.pk/shop?coupon=${encodeURIComponent(code)}`
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => showSimpleToast('🔗 Referral link copied!', 'success'))
    }
  }

  const pending  = rows.filter(r => r.status === 'pending')
  const approved = rows.filter(r => r.status === 'approved')
  const rejected = rows.filter(r => r.status === 'rejected')
  let list = tab === 'pending' ? pending : tab === 'approved' ? approved : rejected
  if (search.trim()) {
    const q = search.trim().toLowerCase()
    list = list.filter(r => r.name?.toLowerCase().includes(q) || r.google_email?.toLowerCase().includes(q) || r.social_handle?.toLowerCase().includes(q) || r.coupons?.code?.toLowerCase().includes(q))
  }
  if (tab === 'approved') {
    list = [...list].sort((a, b) => {
      if (sortBy === 'balance')  return Number(b.store_credit_balance || 0) - Number(a.store_credit_balance || 0)
      if (sortBy === 'pending')  return Number(b.pending_commission || 0) - Number(a.pending_commission || 0)
      if (sortBy === 'newest')   return new Date(b.approved_at || b.created_at) - new Date(a.approved_at || a.created_at)
      if (sortBy === 'name')     return (a.name || '').localeCompare(b.name || '')
      return 0
    })
  }
  // Top performer = highest combined balance+pending (proxy for total
  // revenue driven, since commission is proportional to it) — a small
  // recognition touch, not a hard ranking.
  const topPerformerId = approved.length > 1
    ? [...approved].sort((a, b) => (Number(b.store_credit_balance||0)+Number(b.pending_commission||0)) - (Number(a.store_credit_balance||0)+Number(a.pending_commission||0)))[0]?.id
    : null

  const totalCommissionPaid = approved.reduce((s, r) => s + Number(r.store_credit_balance || 0), 0)
  const totalPending        = approved.reduce((s, r) => s + Number(r.pending_commission || 0), 0)

  // For accounting/payroll — a plain CSV of every active partner's balance,
  // pending commission, coupon, and rate. Client-side generation since the
  // list is already fully loaded; no backend needed.
  function exportPartnersCSV() {
    const headers = ['Name', 'Email', 'Phone', 'Platform', 'Handle', 'Coupon', 'Commission %', 'Balance Owed', 'Pending Commission', 'Status', 'Joined']
    const source = tab === 'approved' ? approved : tab === 'pending' ? pending : rejected
    const rows = source.map(r => [
      r.name, r.google_email, r.phone || '', r.social_platform || '', r.social_handle || '',
      r.coupons?.code || '', r.commission_percent || '', r.store_credit_balance || 0, r.pending_commission || 0,
      r.status, new Date(r.created_at).toISOString().slice(0, 10),
    ])
    const csv = [headers, ...rows].map(row => row.map(f => {
      const str = String(f ?? '')
      return (str.includes(',') || str.includes('"')) ? `"${str.replace(/"/g, '""')}"` : str
    }).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `viro-partners-${tab}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const cardStyle = { background: 'var(--viro-bgCard, #1E293B)', border: '1px solid var(--viro-border, #334155)', borderRadius: 14 }

  return (
    <div style={{ padding: '16px 20px 40px' }}>
      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <StatCard icon="🤝" label="Active Partners" value={approved.length} />
        <StatCard icon="⏳" label="Pending Requests" value={pending.length} color={pending.length ? '#F59E0B' : 'var(--viro-text)'} />
        <StatCard icon="💰" label="Balance Owed" value={`Rs.${totalCommissionPaid.toLocaleString()}`} color="#10B981" />
        <StatCard icon="🕓" label="Pending Commission" value={`Rs.${totalPending.toLocaleString()}`} color="#F59E0B" />
      </div>

      {/* Tier levels — admin-configurable thresholds/multipliers, shown as
          a compact preview strip with an Edit action, same pattern as the
          leaderboard below it. */}
      {tierSettings && (
        <div style={{ ...cardStyle, padding: 14, marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--viro-textSub)', textTransform: 'uppercase', margin: 0 }}>🏅 Partner Tier Levels</p>
            <button onClick={openTierEditor}
              style={{ padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: 'transparent', color: '#8B5CF6', border: '1px solid #8B5CF6', cursor: 'pointer' }}>
              ✏️ Edit Levels
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {tierSettings.map(t => (
              <div key={t.key} style={{ flexShrink: 0, minWidth: 110, padding: '10px 12px', borderRadius: 12, background: 'var(--viro-bgDeep)', textAlign: 'center' }}>
                <p style={{ fontSize: 18, margin: 0 }}>{t.icon}</p>
                <p style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--viro-text)', margin: '3px 0 0' }}>{t.label}</p>
                <p style={{ fontSize: 10, color: 'var(--viro-textSub)', margin: '1px 0 0' }}>{t.at}+ orders</p>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B', margin: '1px 0 0' }}>{t.multiplier}x commission</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* This month's leaderboard — quick pulse-check on who's actually
          driving sales right now, without opening each partner one by one. */}
      {leaderboard.length > 0 && (
        <div style={{ ...cardStyle, padding: 14, marginBottom: 18 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--viro-textSub)', textTransform: 'uppercase', marginBottom: 10 }}>🏆 This Month's Leaderboard</p>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {leaderboard.slice(0, 5).map(p => (
              <div key={p.rank} style={{ flexShrink: 0, minWidth: 120, padding: '10px 12px', borderRadius: 12, background: 'var(--viro-bgDeep)', textAlign: 'center' }}>
                <p style={{ fontSize: 16, margin: 0 }}>{p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`}</p>
                <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--viro-text)', margin: '4px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</p>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#10B981', margin: '2px 0 0' }}>Rs.{p.revenue.toLocaleString()}</p>
                <p style={{ fontSize: 9.5, color: 'var(--viro-textSub)', margin: '1px 0 0' }}>{p.orders} order{p.orders !== 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs + search */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['pending', `⏳ Pending (${pending.length})`], ['approved', `✅ Active (${approved.length})`], ['rejected', `✕ Rejected (${rejected.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{
              padding: '8px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 700,
              background: tab === k ? '#8B5CF6' : 'var(--viro-bgCard, #1E293B)',
              color: tab === k ? '#fff' : 'var(--viro-textSub, #94A3B8)',
              border: '1px solid ' + (tab === k ? '#8B5CF6' : 'var(--viro-border, #334155)'),
              cursor: 'pointer',
            }}>
            {l}
          </button>
        ))}
        <input type="text" placeholder="🔍 Search name, email, coupon…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, marginLeft: 'auto' }} />
        {tab === 'approved' && (
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: 'auto' }}>
            <option value="balance">Sort: Highest Balance</option>
            <option value="pending">Sort: Highest Pending</option>
            <option value="newest">Sort: Newest</option>
            <option value="name">Sort: Name A–Z</option>
          </select>
        )}
        {list.length > 0 && (
          <button onClick={exportPartnersCSV}
            style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: 'var(--viro-bgCard)', color: 'var(--viro-textSub)', border: '1px solid var(--viro-border)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            ⬇ Export CSV
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color: 'var(--viro-textSub)', fontSize: 13 }}>Loading…</p>
      ) : list.length === 0 ? (
        <div style={{ ...cardStyle, padding: 32, textAlign: 'center' }}>
          <p style={{ color: 'var(--viro-textSub)', fontSize: 13 }}>
            {search.trim() ? 'No matches.' : tab === 'pending' ? 'No pending requests right now.' : tab === 'approved' ? 'No active partners yet.' : 'Nothing rejected.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map(row => (
            <div key={row.id} style={{ ...cardStyle, padding: 14, cursor: tab === 'approved' ? 'pointer' : 'default', transition: 'border-color 0.15s' }}
              onClick={() => tab === 'approved' && openDetail(row.id)}
              onMouseEnter={e => tab === 'approved' && (e.currentTarget.style.borderColor = '#8B5CF6')}
              onMouseLeave={e => tab === 'approved' && (e.currentTarget.style.borderColor = 'var(--viro-border, #334155)')}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14,
                  }}>
                    {(row.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--viro-text)', margin: 0 }}>
                      {row.name}
                      {row.id === topPerformerId && (
                        <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 20, background: '#F59E0B15', color: '#F59E0B', border: '1px solid #F59E0B40' }}>🏆 Top Performer</span>
                      )}
                      {row.coupons?.enabled === false && (
                        <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 20, background: '#EF444415', color: '#EF4444', border: '1px solid #EF444440' }}>⏸️ Suspended</span>
                      )}
                      {tab === 'approved' && <span style={{ marginLeft: 6, fontSize: 11, color: '#8B5CF6', fontWeight: 600 }}>→ view details</span>}
                    </p>
                    <p style={{ fontSize: 11.5, color: 'var(--viro-textSub)', margin: '2px 0 0' }}>{row.google_email}</p>
                    <p style={{ fontSize: 11.5, color: 'var(--viro-textSub)', margin: '2px 0 0' }}>
                      {row.social_platform || '—'} {row.social_handle ? `· ${row.social_handle}` : ''} {row.followers_estimate ? `· ~${row.followers_estimate} followers` : ''}
                    </p>
                    {row.phone && <p style={{ fontSize: 11.5, color: 'var(--viro-textSub)', margin: '2px 0 0' }}>📞 {row.phone}</p>}
                  </div>
                </div>

                {tab === 'pending' && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => openApprove(row)}
                      style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer' }}>
                      ✓ Approve
                    </button>
                    <button onClick={() => setRejecting(row)}
                      style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, background: 'transparent', color: '#EF4444', border: '1px solid #EF4444', cursor: 'pointer' }}>
                      ✕ Reject
                    </button>
                  </div>
                )}
                {tab === 'approved' && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={e => { e.stopPropagation(); copyReferralLink(row.coupons?.code) }} title="Copy referral link"
                      style={{ padding: '6px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, background: 'transparent', color: '#7C3AED', border: '1px solid #8B5CF6', cursor: 'pointer' }}>
                      🔗
                    </button>
                    <button onClick={e => { e.stopPropagation(); setEditing(row); setEditCommission(String(row.commission_percent || '')) }}
                      style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, background: 'transparent', color: '#8B5CF6', border: '1px solid #8B5CF6', cursor: 'pointer' }}>
                      Edit
                    </button>
                  </div>
                )}
              </div>

              {tab === 'approved' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--viro-border)' }}>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--viro-textSub)', margin: 0, fontWeight: 700, textTransform: 'uppercase' }}>Coupon</p>
                    <p style={{ fontSize: 12.5, fontWeight: 800, color: '#7C3AED', margin: '2px 0 0' }}>{row.coupons?.code || '—'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--viro-textSub)', margin: 0, fontWeight: 700, textTransform: 'uppercase' }}>Commission</p>
                    <p style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--viro-text)', margin: '2px 0 0' }}>{row.commission_percent}%</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--viro-textSub)', margin: 0, fontWeight: 700, textTransform: 'uppercase' }}>Balance</p>
                    <p style={{ fontSize: 12.5, fontWeight: 800, color: '#10B981', margin: '2px 0 0' }}>Rs.{Number(row.store_credit_balance || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--viro-textSub)', margin: 0, fontWeight: 700, textTransform: 'uppercase' }}>Pending</p>
                    <p style={{ fontSize: 12.5, fontWeight: 800, color: '#F59E0B', margin: '2px 0 0' }}>Rs.{Number(row.pending_commission || 0).toLocaleString()}</p>
                  </div>
                </div>
              )}
              {tab === 'rejected' && row.rejected_reason && (
                <p style={{ fontSize: 11.5, color: '#EF4444', marginTop: 8 }}>Reason: {row.rejected_reason}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Detail drawer — full profile + performance dashboard ── */}
      {detailId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'flex-end' }}
          onClick={() => { setDetailId(null); setDetail(null) }}>
          <div style={{ ...cardStyle, borderRadius: '16px 0 0 16px', width: '100%', maxWidth: 480, height: '100%', overflowY: 'auto', padding: 20 }}
            onClick={e => e.stopPropagation()}>
            {detailLoading || !detail ? (
              <div style={{ textAlign: 'center', paddingTop: 60 }}>
                <div style={{ width: 32, height: 32, margin: '0 auto', borderRadius: '50%', border: '3px solid #8B5CF6', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%',
                      background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18,
                    }}>
                      {(detail.influencer.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontWeight: 800, fontSize: 16, color: 'var(--viro-text)', margin: 0 }}>{detail.influencer.name}</p>
                      <p style={{ fontSize: 12, color: 'var(--viro-textSub)', margin: '1px 0 0' }}>{detail.influencer.google_email}</p>
                    </div>
                  </div>
                  <button onClick={() => { setDetailId(null); setDetail(null) }}
                    style={{ background: 'transparent', border: 'none', fontSize: 20, color: 'var(--viro-textSub)', cursor: 'pointer', lineHeight: 1 }}>✕</button>
                </div>

                {/* Profile info */}
                <div style={{ background: 'var(--viro-bgDeep)', borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 12.5 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div><span style={{ color: 'var(--viro-textSub)' }}>Platform: </span><span style={{ color: 'var(--viro-text)', fontWeight: 700 }}>{detail.influencer.social_platform || '—'}</span></div>
                    <div><span style={{ color: 'var(--viro-textSub)' }}>Handle: </span><span style={{ color: 'var(--viro-text)', fontWeight: 700 }}>{detail.influencer.social_handle || '—'}</span></div>
                    <div><span style={{ color: 'var(--viro-textSub)' }}>Followers: </span><span style={{ color: 'var(--viro-text)', fontWeight: 700 }}>{detail.influencer.followers_estimate || '—'}</span></div>
                    <div><span style={{ color: 'var(--viro-textSub)' }}>Phone: </span><span style={{ color: 'var(--viro-text)', fontWeight: 700 }}>{detail.influencer.phone || '—'}</span></div>
                    <div><span style={{ color: 'var(--viro-textSub)' }}>Joined: </span><span style={{ color: 'var(--viro-text)', fontWeight: 700 }}>{new Date(detail.influencer.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</span></div>
                    <div><span style={{ color: 'var(--viro-textSub)' }}>Approved: </span><span style={{ color: 'var(--viro-text)', fontWeight: 700 }}>{detail.influencer.approved_at ? new Date(detail.influencer.approved_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—'}</span></div>
                    {detail.influencer.approved_by && (
                      <div><span style={{ color: 'var(--viro-textSub)' }}>Approved by: </span><span style={{ color: 'var(--viro-text)', fontWeight: 700 }}>{detail.influencer.approved_by}</span></div>
                    )}
                  </div>
                </div>

                {/* Coupon + commission */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', borderRadius: 12, background: '#8B5CF610', border: '1px solid #8B5CF630' }}>
                    <p style={{ fontSize: 10, color: 'var(--viro-textSub)', margin: 0, fontWeight: 700, textTransform: 'uppercase' }}>Coupon</p>
                    <p style={{ fontSize: 14, fontWeight: 800, color: '#7C3AED', margin: '2px 0 0' }}>{detail.influencer.coupons?.code || '—'}</p>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', borderRadius: 12, background: '#8B5CF610', border: '1px solid #8B5CF630' }}>
                    <p style={{ fontSize: 10, color: 'var(--viro-textSub)', margin: 0, fontWeight: 700, textTransform: 'uppercase' }}>Commission</p>
                    <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--viro-text)', margin: '2px 0 0' }}>{detail.influencer.commission_percent}%</p>
                  </div>
                </div>

                {/* Quick actions */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <button onClick={() => copyReferralLink(detail.influencer.coupons?.code)}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 11.5, fontWeight: 700, background: 'transparent', color: '#7C3AED', border: '1px solid #8B5CF6', cursor: 'pointer' }}>
                    🔗 Copy Link
                  </button>
                  <button onClick={() => { setAdjusting(detail.influencer); setAdjustAmount(''); setAdjustNote('') }}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 11.5, fontWeight: 700, background: 'transparent', color: '#10B981', border: '1px solid #10B981', cursor: 'pointer' }}>
                    💰 Adjust Balance
                  </button>
                  <button onClick={() => toggleSuspend(detail.influencer)}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 11.5, fontWeight: 700,
                      background: 'transparent', color: detail.influencer.coupons?.enabled === false ? '#10B981' : '#EF4444',
                      border: '1px solid ' + (detail.influencer.coupons?.enabled === false ? '#10B981' : '#EF4444'), cursor: 'pointer' }}>
                    {detail.influencer.coupons?.enabled === false ? '▶️ Reactivate' : '⏸️ Suspend'}
                  </button>
                </div>

                {/* Additional coupons — a partner isn't limited to the one
                    primary coupon above; more can be linked here (e.g. a
                    separate rate for a specific campaign), each earning
                    commission the same way. */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--viro-textSub)', textTransform: 'uppercase', margin: 0 }}>🎟️ Additional Coupons</p>
                    <button onClick={() => { setAddingCouponTo(detail.influencer); setNewCouponMode('new'); setNewExtraCoupon({ code: '', type: 'percent', value: '10' }); setExistingExtraCouponId('') }}
                      style={{ padding: '4px 10px', borderRadius: 8, fontSize: 10.5, fontWeight: 700, background: 'transparent', color: '#8B5CF6', border: '1px solid #8B5CF6', cursor: 'pointer' }}>
                      + Add
                    </button>
                  </div>
                  {(detail.extra_coupons || []).length === 0 ? (
                    <p style={{ fontSize: 11.5, color: 'var(--viro-textSub)' }}>No additional coupons linked.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {detail.extra_coupons.map(ec => (
                        <div key={ec.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 10, background: 'var(--viro-bgDeep)' }}>
                          <div>
                            <span style={{ fontSize: 12.5, fontWeight: 800, color: '#7C3AED' }}>{ec.coupons?.code}</span>
                            <span style={{ fontSize: 11, color: 'var(--viro-textSub)', marginLeft: 6 }}>
                              {ec.coupons?.type === 'percent' ? `${ec.coupons.value}%` : `Rs.${ec.coupons?.value}`} off{ec.label ? ` · ${ec.label}` : ''}
                            </span>
                          </div>
                          <button onClick={() => removeExtraCoupon(ec.id)}
                            style={{ background: 'transparent', border: 'none', color: '#EF4444', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Performance dashboard */}
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--viro-textSub)', textTransform: 'uppercase', marginBottom: 8 }}>📊 Performance</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <StatCard icon="📦" label="Total Orders" value={detail.stats.total_orders} />
                  <StatCard icon="✅" label="Completed" value={detail.stats.completed_orders} color="#10B981" />
                  <StatCard icon="💵" label="Revenue Driven" value={`Rs.${detail.stats.total_revenue.toLocaleString()}`} color="#7C3AED" />
                  <StatCard icon="🎯" label="Commission Paid" value={`Rs.${detail.stats.total_commission_released.toLocaleString()}`} color="#10B981" />
                  <StatCard icon="📅" label="Orders (30d)" value={detail.stats.orders_last_30d} />
                  <StatCard icon="🛒" label="Avg Order Value" value={`Rs.${detail.stats.avg_order_value.toLocaleString()}`} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 10, background: 'var(--viro-bgDeep)' }}>
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#10B981', margin: 0 }}>{detail.influencer.store_credit_balance}</p>
                    <p style={{ fontSize: 9.5, color: 'var(--viro-textSub)', margin: '2px 0 0', textTransform: 'uppercase', fontWeight: 700 }}>Balance</p>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 10, background: 'var(--viro-bgDeep)' }}>
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#F59E0B', margin: 0 }}>{detail.influencer.pending_commission}</p>
                    <p style={{ fontSize: 9.5, color: 'var(--viro-textSub)', margin: '2px 0 0', textTransform: 'uppercase', fontWeight: 700 }}>Pending</p>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 10, background: 'var(--viro-bgDeep)' }}>
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#94A3B8', margin: 0 }}>{detail.stats.voided_orders}</p>
                    <p style={{ fontSize: 9.5, color: 'var(--viro-textSub)', margin: '2px 0 0', textTransform: 'uppercase', fontWeight: 700 }}>Voided</p>
                  </div>
                </div>

                {/* Full order history */}
                <div className="flex items-center justify-between mb-2">
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--viro-textSub)', textTransform: 'uppercase' }}>All Transactions</p>
                  {detail.ledger.length > 3 && (
                    <input type="text" placeholder="🔍 Order # or customer…" value={detailSearch} onChange={e => setDetailSearch(e.target.value)}
                      style={{ width: 160, fontSize: 11, padding: '4px 8px' }} />
                  )}
                </div>
                {detail.ledger.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: 'var(--viro-textSub)', textAlign: 'center', padding: '20px 0' }}>No orders yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {detail.ledger
                      .filter(row => !detailSearch.trim() || row.order_short_id?.toLowerCase().includes(detailSearch.toLowerCase()) || row.customer_name?.toLowerCase().includes(detailSearch.toLowerCase()) || (row.is_adjustment && detailSearch.trim() === ''))
                      .map((row, i) => (
                      <div key={row.order_short_id || `${row.order_date}-${i}`} style={{
                        display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 10,
                        background: row.is_adjustment ? '#F59E0B10' : 'var(--viro-bgDeep)',
                        border: row.is_adjustment ? '1px dashed #F59E0B40' : 'none',
                      }}>
                        {row.is_adjustment ? (
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: Number(row.commission_amount) < 0 ? '#EF4444' : '#B45309', margin: 0 }}>
                              {Number(row.commission_amount) < 0 ? '🛒 Coins Spent' : '🎁 Bonus / Adjustment'}
                            </p>
                            <p style={{ fontSize: 10.5, color: 'var(--viro-textSub)', margin: '1px 0 0' }}>
                              {new Date(row.order_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})} · {row.note}{row.admin_username ? ` · by ${row.admin_username}` : ''}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--viro-text)', margin: 0 }}>#{row.order_short_id} {row.customer_name ? `— ${row.customer_name}` : ''}</p>
                            <p style={{ fontSize: 10.5, color: 'var(--viro-textSub)', margin: '1px 0 0' }}>
                              {new Date(row.order_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})} · Rs.{Number(row.order_total).toLocaleString()} · {row.order_status}
                            </p>
                          </div>
                        )}
                        <p style={{ fontSize: 12, fontWeight: 800, margin: 0, alignSelf: 'center',
                          color: Number(row.commission_amount) < 0 ? '#EF4444' : row.commission_status === 'released' ? '#10B981' : row.commission_status === 'voided' ? '#94A3B8' : '#F59E0B' }}>
                          {Number(row.commission_amount) >= 0 ? '+' : ''}Rs.{Number(row.commission_amount).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Adjustment / audit history — the trail left behind by
                    "💰 Adjust Balance", so a manual correction six months
                    ago is never a mystery. */}
                {detail.influencer.admin_note && (
                  <>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--viro-textSub)', textTransform: 'uppercase', margin: '16px 0 8px' }}>📝 Adjustment History</p>
                    <div style={{ background: 'var(--viro-bgDeep)', borderRadius: 10, padding: 10, fontSize: 11, color: 'var(--viro-textSub)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {detail.influencer.admin_note}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Approve modal ── */}
      {approving && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !saving && setApproving(null)}>
          <div style={{ ...cardStyle, padding: 20, width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--viro-text)', marginBottom: 14 }}>Approve {approving.name}</p>

            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--viro-textSub)', textTransform: 'uppercase' }}>Commission %</label>
            <input type="number" min="1" max="100" value={commissionPct} onChange={e => setCommissionPct(e.target.value)}
              style={{ width: '100%', marginBottom: 12 }} />

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button onClick={() => setCouponMode('new')}
                style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                  background: couponMode === 'new' ? '#8B5CF6' : 'transparent', color: couponMode === 'new' ? '#fff' : 'var(--viro-textSub)',
                  border: '1px solid #8B5CF6' }}>
                New Coupon
              </button>
              <button onClick={() => setCouponMode('existing')}
                style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                  background: couponMode === 'existing' ? '#8B5CF6' : 'transparent', color: couponMode === 'existing' ? '#fff' : 'var(--viro-textSub)',
                  border: '1px solid #8B5CF6' }}>
                Use Existing
              </button>
            </div>

            {couponMode === 'new' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input type="text" placeholder="COUPON CODE" value={newCoupon.code}
                  onChange={e => setNewCoupon(c => ({ ...c, code: e.target.value.toUpperCase() }))} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={newCoupon.type} onChange={e => setNewCoupon(c => ({ ...c, type: e.target.value }))} style={{ flex: 1 }}>
                    <option value="percent">% off</option>
                    <option value="fixed">Rs. off</option>
                  </select>
                  <input type="number" placeholder="Value" value={newCoupon.value}
                    onChange={e => setNewCoupon(c => ({ ...c, value: e.target.value }))} style={{ flex: 1 }} />
                </div>
              </div>
            ) : (
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--viro-textSub)', textTransform: 'uppercase' }}>Pick a coupon</label>
                <select value={existingCouponId} onChange={e => setExistingCouponId(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Select…</option>
                  {coupons.map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.type === 'percent' ? `${c.value}%` : `Rs.${c.value}`} {c.enabled ? '' : '(disabled)'}</option>
                  ))}
                </select>
                {coupons.length === 0 && (
                  <p style={{ fontSize: 11, color: 'var(--viro-textSub)', marginTop: 6 }}>No coupons found — use "New Coupon" instead.</p>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setApproving(null)} disabled={saving}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'transparent', color: 'var(--viro-textSub)', border: '1px solid var(--viro-border)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmApprove} disabled={saving}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : '✓ Approve & Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject modal ── */}
      {rejecting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !saving && setRejecting(null)}>
          <div style={{ ...cardStyle, padding: 20, width: '100%', maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--viro-text)', marginBottom: 12 }}>Reject {rejecting.name}?</p>
            <textarea placeholder="Reason (optional, shown to them)" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              rows={3} style={{ width: '100%' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setRejecting(null)} disabled={saving}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'transparent', color: 'var(--viro-textSub)', border: '1px solid var(--viro-border)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmReject} disabled={saving}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit modal ── */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !saving && setEditing(null)}>
          <div style={{ ...cardStyle, padding: 20, width: '100%', maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--viro-text)', marginBottom: 12 }}>Edit {editing.name}</p>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--viro-textSub)', textTransform: 'uppercase' }}>Commission %</label>
            <input type="number" min="1" max="100" value={editCommission} onChange={e => setEditCommission(e.target.value)}
              style={{ width: '100%', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditing(null)} disabled={saving}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'transparent', color: 'var(--viro-textSub)', border: '1px solid var(--viro-border)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={saveEdit} disabled={saving}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: '#8B5CF6', color: '#fff', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Adjust balance modal ── */}
      {adjusting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !saving && setAdjusting(null)}>
          <div style={{ ...cardStyle, padding: 20, width: '100%', maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--viro-text)', marginBottom: 4 }}>Adjust {adjusting.name}'s Balance</p>
            <p style={{ fontSize: 11.5, color: 'var(--viro-textSub)', marginBottom: 12 }}>Current: Rs.{Number(adjusting.store_credit_balance || 0).toLocaleString()}. Use a negative number to deduct.</p>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--viro-textSub)', textTransform: 'uppercase' }}>Amount (Rs.)</label>
            <input type="number" placeholder="e.g. 500 or -200" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)}
              style={{ width: '100%', marginBottom: 10 }} />
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--viro-textSub)', textTransform: 'uppercase' }}>Reason (optional)</label>
            <input type="text" placeholder="e.g. Bonus for hitting 20 orders" value={adjustNote} onChange={e => setAdjustNote(e.target.value)}
              style={{ width: '100%', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setAdjusting(null)} disabled={saving}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'transparent', color: 'var(--viro-textSub)', border: '1px solid var(--viro-border)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmAdjust} disabled={saving}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add additional coupon modal ── */}
      {addingCouponTo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !extraCouponSaving && setAddingCouponTo(null)}>
          <div style={{ ...cardStyle, padding: 20, width: '100%', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--viro-text)', marginBottom: 4 }}>Link Another Coupon</p>
            <p style={{ fontSize: 11.5, color: 'var(--viro-textSub)', marginBottom: 12 }}>
              For {addingCouponTo.name} — sales on this coupon earn commission the same way as their main one.
            </p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button onClick={() => setNewCouponMode('new')}
                style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                  background: newCouponMode === 'new' ? '#8B5CF6' : 'transparent', color: newCouponMode === 'new' ? '#fff' : 'var(--viro-textSub)',
                  border: '1px solid #8B5CF6' }}>
                New Coupon
              </button>
              <button onClick={() => setNewCouponMode('existing')}
                style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                  background: newCouponMode === 'existing' ? '#8B5CF6' : 'transparent', color: newCouponMode === 'existing' ? '#fff' : 'var(--viro-textSub)',
                  border: '1px solid #8B5CF6' }}>
                Use Existing
              </button>
            </div>

            {newCouponMode === 'new' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input type="text" placeholder="COUPON CODE" value={newExtraCoupon.code}
                  onChange={e => setNewExtraCoupon(c => ({ ...c, code: e.target.value.toUpperCase() }))} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={newExtraCoupon.type} onChange={e => setNewExtraCoupon(c => ({ ...c, type: e.target.value }))} style={{ flex: 1 }}>
                    <option value="percent">% off</option>
                    <option value="fixed">Rs. off</option>
                  </select>
                  <input type="number" placeholder="Value" value={newExtraCoupon.value}
                    onChange={e => setNewExtraCoupon(c => ({ ...c, value: e.target.value }))} style={{ flex: 1 }} />
                </div>
              </div>
            ) : (
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--viro-textSub)', textTransform: 'uppercase' }}>Pick a coupon</label>
                <select value={existingExtraCouponId} onChange={e => setExistingExtraCouponId(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Select…</option>
                  {coupons.map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.type === 'percent' ? `${c.value}%` : `Rs.${c.value}`} {c.enabled ? '' : '(disabled)'}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setAddingCouponTo(null)} disabled={extraCouponSaving}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'transparent', color: 'var(--viro-textSub)', border: '1px solid var(--viro-border)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmAddExtraCoupon} disabled={extraCouponSaving}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: '#8B5CF6', color: '#fff', border: 'none', cursor: 'pointer', opacity: extraCouponSaving ? 0.6 : 1 }}>
                {extraCouponSaving ? 'Linking…' : 'Link Coupon'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Tier levels editor ── */}
      {showTierEditor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !tierSaving && setShowTierEditor(false)}>
          <div style={{ ...cardStyle, padding: 20, width: '100%', maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--viro-text)', marginBottom: 4 }}>Edit Partner Tier Levels</p>
            <p style={{ fontSize: 11.5, color: 'var(--viro-textSub)', marginBottom: 14 }}>
              Order threshold = how many completed orders unlocks this tier. Commission multiplier applies on top of a partner's own base rate.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tierDraft.map((t, i) => (
                <div key={t.key} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', borderRadius: 10, background: 'var(--viro-bgDeep)' }}>
                  <span style={{ fontSize: 18, width: 26, textAlign: 'center', flexShrink: 0 }}>{t.icon}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--viro-text)', width: 92, flexShrink: 0 }}>{t.label}</span>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <label style={{ fontSize: 9, color: 'var(--viro-textSub)', fontWeight: 700, textTransform: 'uppercase' }}>Orders</label>
                    <input type="number" min="0" value={t.at}
                      onChange={e => setTierDraft(d => d.map((x, j) => j === i ? { ...x, at: Number(e.target.value) } : x))}
                      style={{ padding: '5px 8px', fontSize: 12 }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <label style={{ fontSize: 9, color: 'var(--viro-textSub)', fontWeight: 700, textTransform: 'uppercase' }}>Multiplier</label>
                    <input type="number" min="1" step="0.05" value={t.multiplier}
                      onChange={e => setTierDraft(d => d.map((x, j) => j === i ? { ...x, multiplier: Number(e.target.value) } : x))}
                      style={{ padding: '5px 8px', fontSize: 12 }} />
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 10.5, color: 'var(--viro-textSub)', marginTop: 10 }}>
              💡 The Starter tier's threshold should stay at 0 (everyone starts there) — thresholds must increase down the list.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowTierEditor(false)} disabled={tierSaving}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'transparent', color: 'var(--viro-textSub)', border: '1px solid var(--viro-border)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={saveTiers} disabled={tierSaving}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: '#8B5CF6', color: '#fff', border: 'none', cursor: 'pointer', opacity: tierSaving ? 0.6 : 1 }}>
                {tierSaving ? 'Saving…' : 'Save Tier Levels'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InfluencersTab
