'use client'
import React, { useState, useEffect } from 'react'
import { useUserAuth } from '../../context/UserAuthContext'
import GoogleSignInButton from '../../components/GoogleSignInButton'

const PLATFORMS = ['Instagram', 'TikTok', 'Facebook', 'YouTube', 'WhatsApp Group', 'Other']

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
        setData({ influencer: json.influencer, coupon: json.coupon, ledger: json.ledger || [] })
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
    if (!form.handle.trim()) { showToast('Please enter your social handle/username', 'error'); return }
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

  function copyCoupon(code) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => showToast('📋 Coupon code copied!'))
    }
  }

  const CARD = { background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)', borderRadius: 16 }

  return (
    <div className="pb-10" style={{ minHeight: '100vh', background: 'var(--viro-sectionBg)' }}>
      <Toast msg={toast?.msg} type={toast?.type} />

      <div className="max-w-lg mx-auto px-4 pt-6">
        {/* ── Hero / intro — shown in every state ── */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🤝</div>
          <h1 className="font-display text-2xl font-bold mb-1.5" style={{ color: 'var(--viro-text)' }}>
            Viro Partner Program
          </h1>
          <p className="text-sm" style={{ color: 'var(--viro-textSub)' }}>
            Get your own discount coupon, share it with your audience, and earn commission on every order that completes.
          </p>
        </div>

        {/* ── Logged out ── */}
        {state === 'logged_out' && (
          <div className="p-5 text-center" style={CARD}>
            <p className="text-sm mb-4" style={{ color: 'var(--viro-textSub)' }}>
              Sign in with Google to apply, or check your existing partner status.
            </p>
            <div className="flex justify-center">
              <GoogleSignInButton onSignIn={() => signIn('/influencer')} label="Sign in with Google" size="md" />
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
          <form onSubmit={submitRequest} className="p-5 space-y-3.5" style={CARD}>
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
                Handle / Username <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input type="text" value={form.handle} onChange={e => setForm(f => ({ ...f, handle: e.target.value }))}
                placeholder="@yourusername" required />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--viro-textSub)' }}>Rough follower count</label>
              <input type="text" value={form.followers} onChange={e => setForm(f => ({ ...f, followers: e.target.value }))}
                placeholder="e.g. 5k-10k" />
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
          <div className="p-6 text-center" style={CARD}>
            <div className="text-3xl mb-2">⏳</div>
            <p className="font-bold text-sm mb-1" style={{ color: 'var(--viro-text)' }}>Your request is under review</p>
            <p className="text-xs" style={{ color: 'var(--viro-textSub)' }}>
              We'll approve your account and set up your coupon soon. Check back here anytime.
            </p>
          </div>
        )}

        {/* ── Rejected ── */}
        {state === 'rejected' && (
          <div className="p-6 text-center" style={CARD}>
            <div className="text-3xl mb-2">😕</div>
            <p className="font-bold text-sm mb-1" style={{ color: 'var(--viro-text)' }}>Request not approved</p>
            {rejectedReason && (
              <p className="text-xs" style={{ color: 'var(--viro-textSub)' }}>{rejectedReason}</p>
            )}
          </div>
        )}

        {/* ── Approved → full dashboard ── */}
        {state === 'approved' && data && (
          <div className="space-y-4">
            {/* Coupon */}
            <div className="p-5 text-center" style={{ ...CARD, background: 'linear-gradient(135deg,#8B5CF615,#7C3AED08)' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--viro-textSub)' }}>Your Coupon Code</p>
              <button onClick={() => copyCoupon(data.coupon?.code)}
                className="text-2xl font-extrabold tracking-wider px-5 py-2.5 rounded-xl mb-1"
                style={{ background: 'var(--viro-bgCard)', border: '2px dashed #8B5CF6', color: '#7C3AED', cursor: 'pointer' }}>
                {data.coupon?.code || '—'} 📋
              </button>
              <p className="text-xs" style={{ color: 'var(--viro-textSub)' }}>
                {data.coupon?.type === 'percent' ? `${data.coupon.value}% off` : `Rs.${data.coupon?.value} off`} for anyone who uses it · Tap to copy
              </p>
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

            {/* Orders */}
            <div className="p-4" style={CARD}>
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--viro-textSub)' }}>Orders Using Your Coupon</p>
              {data.ledger.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: 'var(--viro-textSub)' }}>No orders yet — share your coupon to get started!</p>
              ) : (
                <div className="space-y-2">
                  {data.ledger.map(row => (
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
          </div>
        )}
      </div>
    </div>
  )
}
