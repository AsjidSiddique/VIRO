'use client'
import React, { useState, useEffect } from 'react'
import { useUserAuth } from '../../context/UserAuthContext'
import GoogleSignInButton from '../../components/GoogleSignInButton'

const PLATFORMS = ['Instagram', 'TikTok', 'Facebook', 'YouTube', 'WhatsApp Group', 'None — I\'m just a loyal customer', 'Other']

function Toast({ msg, type }) {
  if (!msg) return null
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg"
      style={{
        background: type === 'error' ? '#EF4444' : '#10B981',
        color: '#fff',
      }}>
      {msg}
    </div>
  )
}

export default function InfluencerClient() {
  const { user, ready, signIn } = useUserAuth()
  const [state, setState] = useState('loading') // loading | not_registered | pending | rejected | approved
  const [data, setData]   = useState(null)       // { influencer, coupon, ledger } — only when approved
  const [rejectedReason, setRejectedReason] = useState('')
  const [toast, setToast] = useState(null)

  // ── Request form state ──────────────────────────────────────────────────
  const [form, setForm] = useState({ phone: '', platform: 'Instagram', handle: '', followers: '' })
  const [submitting, setSubmitting] = useState(false)

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    if (!ready) return
    if (!user?.email) { setState('logged_out'); return }
    loadDashboard()
  }, [ready, user]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadDashboard() {
    setState('loading')
    try {
      const res = await fetch('/api/influencer-dashboard', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      })
      const json = await res.json()
      if (!json.ok) { setState('not_registered'); return }
      if (json.status === 'not_registered') { setState('not_registered'); return }
      if (json.status === 'pending')  { setState('pending'); return }
      if (json.status === 'rejected') { setRejectedReason(json.rejected_reason || ''); setState('rejected'); return }
      if (json.status === 'approved') {
        setData({
          influencer: json.influencer, coupon: json.coupon, ledger: json.ledger || [],
          tier: json.tier, orderCount: json.order_count ?? json.ledger?.length ?? 0,
          newSinceLastVisit: json.new_since_last_visit || 0,
        })
        setState('approved')
        return
      }
      setState('not_registered')
    } catch {
      setState('not_registered')
    }
  }

  async function submitRequest(e) {
    e.preventDefault()
    const isCustomerOnly = form.platform.startsWith('None')
    if (!isCustomerOnly && !form.handle.trim()) { showToast('Please enter your social handle/username', 'error'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/influencer-signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email, name: user.name || user.email,
          phone: form.phone, platform: form.platform, handle: form.handle, followers: form.followers,
        }),
      })
      const json = await res.json()
      if (!json.ok) { showToast(json.error || 'Something went wrong', 'error'); setSubmitting(false); return }
      showToast('✅ Request sent! We\'ll review it shortly.')
      setState(json.status === 'approved' ? 'approved' : json.status === 'rejected' ? 'rejected' : 'pending')
    } catch {
      showToast('Network error — please try again', 'error')
    }
    setSubmitting(false)
  }

  function copyReferralLink(code) {
    const link = `https://viro.pk/shop?coupon=${encodeURIComponent(code)}`
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => showToast('🔗 Referral link copied!'))
    }
  }

  function copyCoupon(code) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => showToast('📋 Coupon code copied!'))
    }
  }

  function shareOnWhatsApp(code) {
    const link = `https://viro.pk/shop?coupon=${encodeURIComponent(code)}`
    const msg = `Hey! Use my code ${code} for a discount at Viro 🛍️ ${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function getTier(orderCount) {
    if (orderCount >= 50) return { label: 'Elite Partner', icon: '💎', color: '#22D3EE' }
    if (orderCount >= 20) return { label: 'Star Partner',  icon: '🥇', color: '#F59E0B' }
    if (orderCount >= 5)  return { label: 'Rising Star',   icon: '🥈', color: '#94A3B8' }
    return { label: 'Starter', icon: '🥉', color: '#B45309' }
  }

  const [rank, setRank] = useState(null) // { rank, revenue, orders, total_partners } | null
  useEffect(() => {
    if (state !== 'approved' || !user?.email) return
    fetch('/api/influencer-leaderboard', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email }),
    }).then(r => r.json()).then(json => { if (json?.your_rank) setRank(json.your_rank) }).catch(() => {})
  }, [state, user?.email])

  // ── Order filter (client-side, cheap — ledger is already fully loaded) ──
  const [orderFilter, setOrderFilter] = useState('all')
  const filteredLedger = data ? data.ledger.filter(r => orderFilter === 'all' || r.commission_status === orderFilter) : []

  // ── Downloadable earnings statement ──
  function downloadStatement() {
    if (!data) return
    const headers = ['Order ID', 'Date', 'Order Total', 'Commission', 'Status']
    const rows = data.ledger.map(r => [
      r.order_short_id || '', r.order_date ? new Date(r.order_date).toISOString().slice(0, 10) : '',
      r.order_total, r.commission_amount, r.commission_status,
    ])
    const csv = [headers, ...rows].map(row => row.map(f => {
      const str = String(f ?? '')
      return str.includes(',') ? `"${str}"` : str
    }).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `viro-partner-statement-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  // ── Self-service profile edit ──
  const [editingProfile, setEditingProfile] = useState(false)
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [profileForm, setProfileForm] = useState({ phone: '', platform: 'Instagram', handle: '', followers: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  useEffect(() => {
    if (data?.influencer) {
      setProfileForm({
        phone: data.influencer.phone || '', platform: data.influencer.social_platform || 'Instagram',
        handle: data.influencer.social_handle || '', followers: data.influencer.followers_estimate || '',
      })
    }
  }, [data?.influencer])

  async function saveProfile() {
    setSavingProfile(true)
    try {
      const res = await fetch('/api/influencer-update-profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, ...profileForm }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Failed to save')
      showToast('✅ Profile updated')
      setEditingProfile(false)
    } catch (e) {
      showToast(e.message || 'Something went wrong', 'error')
    }
    setSavingProfile(false)
  }

  const CARD = { background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)', borderRadius: 16 }

  return (
    <div className="pb-10" style={{ minHeight: '100vh', background: 'var(--viro-sectionBg)' }}>
      <Toast msg={toast?.msg} type={toast?.type} />

      <div className="max-w-5xl mx-auto px-4 pt-6">
        {/* ── Hero / intro — shown in every state. Kept at a readable text
            width even though the outer container is now wide enough for a
            proper desktop dashboard layout below. */}
        <div className="text-center mb-6 max-w-lg mx-auto">
          <div className="text-4xl mb-2">🤝</div>
          <h1 className="font-display text-2xl font-bold mb-1.5" style={{ color: 'var(--viro-text)' }}>
            Viro Partner Program
          </h1>
          <p className="text-sm" style={{ color: 'var(--viro-textSub)' }}>
            For content creators <b>and</b> loyal customers alike — get your own discount coupon, share it, and earn commission on every order that completes.
          </p>
        </div>

        {/* ── Logged out ── */}
        {state === 'logged_out' && (
          <div className="p-5 text-center max-w-lg mx-auto" style={CARD}>
            <p className="text-sm mb-4" style={{ color: 'var(--viro-textSub)' }}>
              Sign in with Google to apply, or check your existing partner status.
            </p>
            <div className="flex justify-center">
              <GoogleSignInButton onSignIn={() => signIn('/partner')} label="Sign in with Google" size="md" />
            </div>
          </div>
        )}

        {state === 'loading' && (
          <div className="p-8 text-center">
            <div style={{ width: 32, height: 32, margin: '0 auto', borderRadius: '50%', border: '3px solid #8B5CF6', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}

        {/* ── Not registered → show request form ── */}
        {state === 'not_registered' && (
          <form onSubmit={submitRequest} className="p-5 space-y-3.5 max-w-lg mx-auto" style={CARD}>
            <p className="text-sm font-bold" style={{ color: 'var(--viro-text)' }}>Apply to join</p>
            <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--viro-bgDeep)', color: 'var(--viro-textSub)' }}>
              Signed in as <b style={{ color: 'var(--viro-text)' }}>{user?.email}</b>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--viro-textSub)' }}>Phone (optional)</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="03XX XXXXXXX" />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--viro-textSub)' }}>Platform</label>
              <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--viro-textSub)' }}>
                Handle / Username {!form.platform.startsWith('None') && <span style={{ color: '#EF4444' }}>*</span>}
              </label>
              <input type="text" value={form.handle} onChange={e => setForm(f => ({ ...f, handle: e.target.value }))}
                placeholder={form.platform.startsWith('None') ? 'Not applicable' : '@yourusername'}
                disabled={form.platform.startsWith('None')}
                required={!form.platform.startsWith('None')} />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--viro-textSub)' }}>Rough follower count (if applicable)</label>
              <input type="text" value={form.followers} onChange={e => setForm(f => ({ ...f, followers: e.target.value }))}
                placeholder="e.g. 5k-10k" disabled={form.platform.startsWith('None')} />
            </div>

            <button type="submit" disabled={submitting}
              className="w-full py-3 rounded-xl font-bold text-white text-sm"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Sending…' : 'Send Request'}
            </button>
          </form>
        )}

        {/* ── Pending review ── */}
        {state === 'pending' && (
          <div className="p-6 text-center max-w-lg mx-auto" style={CARD}>
            <div className="text-3xl mb-2">⏳</div>
            <p className="font-bold text-sm mb-1" style={{ color: 'var(--viro-text)' }}>Your request is under review</p>
            <p className="text-xs" style={{ color: 'var(--viro-textSub)' }}>
              We'll approve your account and set up your coupon soon. Check back here anytime.
            </p>
          </div>
        )}

        {/* ── Rejected ── */}
        {state === 'rejected' && (
          <div className="p-6 text-center max-w-lg mx-auto" style={CARD}>
            <div className="text-3xl mb-2">😕</div>
            <p className="font-bold text-sm mb-1" style={{ color: 'var(--viro-text)' }}>Request not approved</p>
            {rejectedReason && (
              <p className="text-xs" style={{ color: 'var(--viro-textSub)' }}>{rejectedReason}</p>
            )}
          </div>
        )}

        {/* ── Approved → full dashboard ── */}
        {state === 'approved' && data && (
          <div>
            {/* New earnings since last visit — makes the dashboard feel alive */}
            {data.newSinceLastVisit > 0 && (
              <div className="text-center py-2 px-3 rounded-xl fade-in mb-4 max-w-lg mx-auto" style={{ background: '#10B98115', border: '1px solid #10B98140' }}>
                <p className="text-sm font-extrabold" style={{ color: '#10B981' }}>
                  🎉 You earned Rs.{data.newSinceLastVisit.toLocaleString()} since your last visit!
                </p>
              </div>
            )}

            {/* Tier badge — from the server, so the multiplier shown here is
                the exact one used in the actual commission math, not a
                client-side guess. */}
            {(() => {
              const tier = data.tier || getTier(data.orderCount)
              return (
                <div className="text-center py-1 mb-4">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm font-extrabold px-3 py-1 rounded-full" style={{ background: '#8B5CF615', color: '#7C3AED', border: '1px solid #8B5CF640' }}>
                      {tier.icon} {tier.label} {tier.multiplier > 1 && <span style={{ opacity: 0.8 }}>· {tier.multiplier}x commission</span>}
                    </span>
                    {rank?.rank && (
                      <span className="text-sm font-extrabold px-3 py-1 rounded-full" style={{ background: '#F59E0B15', color: '#F59E0B', border: '1px solid #F59E0B40' }}>
                        🏆 #{rank.rank} this month
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--viro-textSub)' }}>
                    {data.orderCount} order{data.orderCount !== 1 ? 's' : ''} so far
                    {tier.next && ` · ${tier.next.at - data.orderCount} more to reach ${tier.next.label}`}
                  </p>
                </div>
              )
            })()}

            {/* Desktop: coupon/balance on the left, orders/profile/help on
                the right — makes proper use of a wide screen instead of a
                narrow centred column with acres of empty space either side.
                Mobile: unchanged, everything simply stacks in order. */}
            <div className="md:grid md:grid-cols-5 md:gap-5 md:items-start">
            <div className="md:col-span-2 space-y-4">
            {/* Coupon */}
            <div className="p-5 text-center" style={{ ...CARD, background: 'linear-gradient(135deg,#8B5CF615,#7C3AED08)' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--viro-textSub)' }}>Your Coupon Code</p>
              <button onClick={() => copyCoupon(data.coupon?.code)}
                className="text-2xl font-extrabold tracking-wider px-5 py-2.5 rounded-xl mb-1"
                style={{ background: 'var(--viro-bgCard)', border: '2px dashed #8B5CF6', color: '#7C3AED', cursor: 'pointer' }}>
                {data.coupon?.code || '—'} 📋
              </button>
              <p className="text-xs mb-3" style={{ color: 'var(--viro-textSub)' }}>
                {data.coupon?.type === 'percent' ? `${data.coupon.value}% off` : `Rs.${data.coupon?.value} off`} for anyone who uses it · Tap to copy
              </p>
              <div className="flex gap-2 mb-3">
                <button onClick={() => copyReferralLink(data.coupon?.code)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold"
                  style={{ background: 'var(--viro-bgCard)', border: '1.5px solid #8B5CF6', color: '#7C3AED' }}>
                  🔗 Copy Link
                </button>
                <button onClick={() => shareOnWhatsApp(data.coupon?.code)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold text-white"
                  style={{ background: '#25D366' }}>
                  💬 Share on WhatsApp
                </button>
              </div>

              {/* QR code — for offline sharing (business cards, in-person,
                  a stall/counter sign) where a tappable link doesn't help.
                  Generated via a free public API, no extra dependency. */}
              <button onClick={() => setShowQR(v => !v)} className="text-[11px] font-bold" style={{ color: '#8B5CF6' }}>
                {showQR ? '▲ Hide QR Code' : '▼ Show QR Code (for offline sharing)'}
              </button>
              {showQR && data.coupon?.code && (
                <div className="mt-3 flex flex-col items-center fade-in">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`https://viro.pk/shop?coupon=${data.coupon.code}`)}`}
                    alt="QR code for your referral link" width={140} height={140}
                    style={{ borderRadius: 12, background: '#fff', padding: 8 }} />
                  <p className="text-[10.5px] mt-2" style={{ color: 'var(--viro-textSub)' }}>Scan to shop with your code</p>
                </div>
              )}
            </div>

            {/* Balances */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 text-center" style={CARD}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--viro-textSub)' }}>Available Balance</p>
                <p className="text-xl font-extrabold" style={{ color: '#10B981' }}>Rs.{Number(data.influencer.store_credit_balance || 0).toLocaleString()}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--viro-textSub)' }}>Spend in-store anytime</p>
              </div>
              <div className="p-4 text-center" style={CARD}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--viro-textSub)' }}>Pending</p>
                <p className="text-xl font-extrabold" style={{ color: '#F59E0B' }}>Rs.{Number(data.influencer.pending_commission || 0).toLocaleString()}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--viro-textSub)' }}>Releases when delivered</p>
              </div>
            </div>

            <div className="px-4 py-2.5 rounded-xl text-xs text-center" style={{ background: '#8B5CF610', color: 'var(--viro-textSub)' }}>
              💰 Commission rate: <b style={{ color: 'var(--viro-text)' }}>{data.influencer.commission_percent}%</b> per completed order · Paid as store credit to spend on viro.pk
            </div>
            </div>{/* end left column */}

            <div className="md:col-span-3 space-y-4 mt-4 md:mt-0">
            {/* Orders */}
            <div className="p-4" style={CARD}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--viro-textSub)' }}>Orders Using Your Coupon</p>
                {data.ledger.length > 0 && (
                  <button onClick={downloadStatement} className="text-[11px] font-bold" style={{ color: '#8B5CF6' }}>⬇ Statement</button>
                )}
              </div>
              {data.ledger.length > 0 && (
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {[['all','All'],['released','✅ Released'],['pending','⏳ Pending'],['voided','✕ Voided']].map(([k,l]) => (
                    <button key={k} onClick={() => setOrderFilter(k)}
                      className="text-[10.5px] font-bold px-2.5 py-1 rounded-full"
                      style={{
                        background: orderFilter === k ? '#8B5CF6' : 'var(--viro-bgDeep)',
                        color: orderFilter === k ? '#fff' : 'var(--viro-textSub)',
                      }}>
                      {l}
                    </button>
                  ))}
                </div>
              )}
              {data.ledger.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: 'var(--viro-textSub)' }}>No orders yet — share your coupon to get started!</p>
              ) : filteredLedger.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: 'var(--viro-textSub)' }}>No orders match this filter.</p>
              ) : (
                <div className="space-y-2">
                  {filteredLedger.map(row => (
                    <div key={row.order_short_id || row.order_date} className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: 'var(--viro-bgDeep)' }}>
                      <div>
                        <p className="text-xs font-bold" style={{ color: 'var(--viro-text)' }}>#{row.order_short_id || '—'}</p>
                        <p className="text-[11px]" style={{ color: 'var(--viro-textSub)' }}>
                          {row.order_date ? new Date(row.order_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'} · Rs.{Number(row.order_total || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-extrabold" style={{ color: row.commission_status === 'released' ? '#10B981' : row.commission_status === 'voided' ? '#94A3B8' : '#F59E0B' }}>
                          +Rs.{Number(row.commission_amount || 0).toLocaleString()}
                        </p>
                        <p className="text-[10px] font-semibold" style={{
                          color: row.commission_status === 'released' ? '#10B981' : row.commission_status === 'voided' ? '#94A3B8' : '#F59E0B'
                        }}>
                          {row.commission_status === 'released' ? '✅ Released' : row.commission_status === 'voided' ? '✕ Voided' : `⏳ ${row.order_status || 'Pending'}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Edit profile — self-service, no need to ask admin for a
                simple phone/handle change. Commission % and coupon stay
                admin-only (not editable here). */}
            <div className="p-4" style={CARD}>
              <button onClick={() => setEditingProfile(v => !v)} className="w-full flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--viro-textSub)' }}>✏️ Edit My Info</p>
                <span style={{ color: 'var(--viro-textSub)', fontSize: 12 }}>{editingProfile ? '▲' : '▼'}</span>
              </button>
              {editingProfile && (
                <div className="mt-3 space-y-2.5">
                  <div>
                    <label className="text-[10.5px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--viro-textSub)' }}>Phone</label>
                    <input type="tel" value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} placeholder="03XX XXXXXXX" />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--viro-textSub)' }}>Platform</label>
                    <select value={profileForm.platform} onChange={e => setProfileForm(f => ({ ...f, platform: e.target.value }))}>
                      {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--viro-textSub)' }}>Handle</label>
                    <input type="text" value={profileForm.handle} onChange={e => setProfileForm(f => ({ ...f, handle: e.target.value }))} placeholder="@yourusername" />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--viro-textSub)' }}>Followers</label>
                    <input type="text" value={profileForm.followers} onChange={e => setProfileForm(f => ({ ...f, followers: e.target.value }))} placeholder="e.g. 5k-10k" />
                  </div>
                  <button onClick={saveProfile} disabled={savingProfile}
                    className="w-full py-2.5 rounded-xl font-bold text-white text-xs"
                    style={{ background: '#8B5CF6', opacity: savingProfile ? 0.6 : 1 }}>
                    {savingProfile ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>

            {/* How it works — quick reference so a partner doesn't need to
                ask "how does this actually work" every time. */}
            <div className="p-4" style={CARD}>
              <button onClick={() => setShowHowItWorks(v => !v)} className="w-full flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--viro-textSub)' }}>❓ How This Works</p>
                <span style={{ color: 'var(--viro-textSub)', fontSize: 12 }}>{showHowItWorks ? '▲' : '▼'}</span>
              </button>
              {showHowItWorks && (
                <div className="mt-3 space-y-2.5 text-xs" style={{ color: 'var(--viro-textSub)' }}>
                  <p>🔗 <b style={{ color: 'var(--viro-text)' }}>Share your link or code</b> — anyone who uses it gets a discount automatically.</p>
                  <p>⏳ <b style={{ color: 'var(--viro-text)' }}>Commission stays "Pending"</b> until that order is actually delivered — never before, so it's always real money.</p>
                  <p>🪙 <b style={{ color: 'var(--viro-text)' }}>Released commission</b> becomes spendable "Partner Coins" you can use on your own Viro orders at checkout.</p>
                  <p>📈 <b style={{ color: 'var(--viro-text)' }}>Tiers pay more</b> — the more orders you drive, the higher your commission multiplier climbs automatically.</p>
                </div>
              )}
            </div>
            </div>{/* end right column */}
            </div>{/* end grid */}
          </div>
        )}
      </div>
    </div>
  )
}
