'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUserAuth } from '../context/UserAuthContext'
import { usePartner } from '../context/PartnerContext'
import GoogleSignInButton from './GoogleSignInButton'

const PARTNER_NAV = [
  { href: '/partner',              icon: '🏠', label: 'Dashboard',    exact: true },
  { href: '/partner/transactions', icon: '📊', label: 'Transactions' },
  { href: '/partner/edit',         icon: '✏️', label: 'Edit Info'    },
]

const PLATFORMS = ['Instagram', 'TikTok', 'Facebook', 'YouTube', 'WhatsApp Group', "None — I'm just a loyal customer", 'Other']

function RequestForm() {
  const { user } = useUserAuth()
  const { reload } = usePartner()
  const [form, setForm] = useState({ phone: '', platform: 'Instagram', handle: '', followers: '' })
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
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
      setTimeout(reload, 600)
    } catch {
      showToast('Network error — please try again', 'error')
    }
    setSubmitting(false)
  }

  const CARD = { background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)', borderRadius: 16 }

  return (
    <div className="max-w-lg mx-auto px-4">
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg text-center"
          style={{ background: toast.type === 'error' ? '#EF4444' : '#10B981', color: '#fff', top: 'calc(env(safe-area-inset-top, 0px) + 60px)', maxWidth: '85vw', width: 'max-content' }}>
          {toast.msg}
        </div>
      )}
      <form onSubmit={submitRequest} className="p-5 space-y-3.5" style={CARD}>
        <p className="text-sm font-bold" style={{ color: 'var(--viro-text)' }}>Apply to join</p>
        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--viro-bgDeep)', color: 'var(--viro-textSub)' }}>
          Signed in as <b style={{ color: 'var(--viro-text)' }}>{user?.email}</b>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--viro-textSub)' }}>Phone (optional)</label>
          <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="03XX XXXXXXX" />
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
            disabled={form.platform.startsWith('None')} required={!form.platform.startsWith('None')} />
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
    </div>
  )
}

export default function PartnerShell({ children }) {
  const { user, signIn, ready: authReady } = useUserAuth()
  const { state, data, rejectedReason } = usePartner()
  const pathname = usePathname()
  const [showHelp, setShowHelp] = useState(false)

  const CARD = { background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)', borderRadius: 16 }

  // ── Not signed in ──
  if (authReady && !user) {
    return (
      <div style={{ minHeight: '60vh', background: 'var(--viro-sectionBg)', paddingBottom: 60 }}>
        <div style={{ background: 'linear-gradient(160deg,#1e1b4b,#0f172a)', padding: '52px 24px 44px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,#8B5CF640,transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ fontSize: 44, marginBottom: 12 }}>🤝</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: '0 0 10px' }}>Viro Partner Program</h1>
          <p style={{ fontSize: 14, color: '#94A3B8', margin: '0 0 30px', lineHeight: 1.7 }}>
            For content creators and loyal customers alike —<br />earn commission on every order that completes.
          </p>
          <div style={{ maxWidth: 340, margin: '0 auto 12px' }}>
            <GoogleSignInButton onSignIn={() => signIn(pathname || '/partner')} size="lg" />
          </div>
        </div>

        {/* BUGFIX: this used to be a huge blank gray area between the sign-in
            button and the footer — nothing here explained why someone should
            actually bother signing in. Filled with the real pitch: how it
            works, the tier ladder, and concrete numbers, so a first-time
            visitor has a reason to tap "Continue with Google" instead of
            just leaving. */}
        <div style={{ maxWidth: 480, margin: '32px auto 0', padding: '0 20px' }}>
          <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--viro-textSub)', textAlign: 'center', marginBottom: 14 }}>
            How It Works
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {[
              ['🔗', 'Get your own code', 'Sign in and get a personal discount coupon in seconds — free to join.'],
              ['📤', 'Share it anywhere', 'WhatsApp, Instagram, TikTok — or just tell friends. Anyone who uses it gets a discount.'],
              ['💰', 'Earn real commission', 'Every completed order earns you a %, paid out as spendable Partner Coins.'],
              ['📈', 'Level up, earn more', 'The more you refer, the higher your commission multiplier climbs automatically.'],
            ].map(([icon, title, desc]) => (
              <div key={title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)', borderRadius: 14, padding: 14 }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--viro-text)', margin: 0 }}>{title}</p>
                  <p style={{ fontSize: 12, color: 'var(--viro-textSub)', margin: '2px 0 0', lineHeight: 1.5 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--viro-textSub)', textAlign: 'center', marginBottom: 14 }}>
            Earn More As You Grow
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)', borderRadius: 16, padding: '18px 12px', marginBottom: 24 }}>
            {[
              ['🥉', 'Starter', '0+ orders'],
              ['🥈', 'Rising Star', '5+ orders'],
              ['🥇', 'Star Partner', '20+ orders'],
              ['💎', 'Elite Partner', '50+ orders'],
            ].map(([icon, label, sub]) => (
              <div key={label} style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 22 }}>{icon}</div>
                <p style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--viro-text)', margin: '4px 0 0' }}>{label}</p>
                <p style={{ fontSize: 9, color: 'var(--viro-textSub)', margin: '1px 0 0' }}>{sub}</p>
              </div>
            ))}
          </div>

          <div style={{ maxWidth: 300, margin: '0 auto' }}>
            <GoogleSignInButton onSignIn={() => signIn(pathname || '/partner')} label="Join Free — Sign in with Google" size="md" />
          </div>
        </div>
      </div>
    )
  }

  if (!authReady || state === 'loading') {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #8B5CF6', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (state === 'not_registered') {
    return (
      <div style={{ background: 'var(--viro-sectionBg)', minHeight: '60vh', paddingTop: 24, paddingBottom: 40 }}>
        <div className="text-center mb-6 max-w-lg mx-auto px-4">
          <div className="text-4xl mb-2">🤝</div>
          <h1 className="font-display text-2xl font-bold mb-1.5" style={{ color: 'var(--viro-text)' }}>Viro Partner Program</h1>
          <p className="text-sm" style={{ color: 'var(--viro-textSub)' }}>
            For content creators <b>and</b> loyal customers alike — get your own discount coupon, share it, and earn commission on every order that completes.
          </p>
        </div>
        <RequestForm />
      </div>
    )
  }

  if (state === 'pending') {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="p-6 text-center max-w-lg" style={CARD}>
          <div className="text-3xl mb-2">⏳</div>
          <p className="font-bold text-sm mb-1" style={{ color: 'var(--viro-text)' }}>Your request is under review</p>
          <p className="text-xs" style={{ color: 'var(--viro-textSub)' }}>We'll approve your account and set up your coupon soon. Check back here anytime.</p>
        </div>
      </div>
    )
  }

  if (state === 'rejected') {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="p-6 text-center max-w-lg" style={CARD}>
          <div className="text-3xl mb-2">😕</div>
          <p className="font-bold text-sm mb-1" style={{ color: 'var(--viro-text)' }}>Request not approved</p>
          {rejectedReason && <p className="text-xs" style={{ color: 'var(--viro-textSub)' }}>{rejectedReason}</p>}
        </div>
      </div>
    )
  }

  // ── Approved: real app shell with header + tab nav, mirrors AccountShell ──
  return (
    <div style={{ background: 'var(--viro-sectionBg)', minHeight: '60vh' }}>
      <div style={{ background: 'linear-gradient(160deg,#1e1b4b,#0f172a)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle,#8B5CF620,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
            {user?.avatar
              ? <img src={user.avatar} alt="" style={{ width: 38, height: 38, borderRadius: '50%', border: '2px solid #8B5CF6', flexShrink: 0 }} />
              : <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#8B5CF6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                  {(user?.name || user?.email || 'P')[0].toUpperCase()}
                </div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                🤝 {data?.influencer?.name || 'Partner'}
              </p>
              <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>Viro Partner Program</p>
            </div>
            {data?.influencer && (
              <Link href="/partner/transactions" style={{ textAlign: 'right', flexShrink: 0, textDecoration: 'none', display: 'block' }} title="View transaction history">
                <p style={{ fontSize: 15, fontWeight: 900, color: '#10B981', margin: 0 }}>Rs.{Number(data.influencer.store_credit_balance || 0).toLocaleString()}</p>
                <p style={{ fontSize: 9.5, color: '#64748B', margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>Balance</p>
                {data.influencer.pending_commission > 0 && (
                  <p style={{ fontSize: 10, color: '#F59E0B', margin: '1px 0 0', fontWeight: 700 }}>
                    +Rs.{Number(data.influencer.pending_commission).toLocaleString()} pending
                  </p>
                )}
              </Link>
            )}
            {/* Reachable from every /partner/* page, not just the dashboard —
                so "how does this actually work" is never more than one tap
                away regardless of which tab someone's currently on. */}
            <button onClick={() => setShowHelp(true)}
              style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', color: '#A78BFA', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
              aria-label="How this works">
              ?
            </button>
          </div>
          <div style={{ display: 'flex', overflowX: 'auto', gap: 0, scrollbarWidth: 'none', marginTop: 2 }}>
            {PARTNER_NAV.map(n => {
              const isActive = n.exact ? pathname === n.href : pathname.startsWith(n.href)
              return (
                <Link key={n.href} href={n.href} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  padding: '8px 14px', flexShrink: 0, textDecoration: 'none',
                  borderBottom: `2.5px solid ${isActive ? '#8B5CF6' : 'transparent'}`,
                  transition: 'all 0.15s',
                }}>
                  <span style={{ fontSize: 15 }}>{n.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: isActive ? '#A78BFA' : '#475569', whiteSpace: 'nowrap' }}>{n.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px 60px' }}>
        {children}
      </div>

      {/* Reachable from any /partner/* page via the "?" button in the header */}
      {showHelp && (
        <div onClick={() => setShowHelp(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            ...CARD, width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0',
            padding: 20, maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--viro-text)', margin: 0 }}>❓ How This Works</p>
              <button onClick={() => setShowHelp(false)} style={{ background: 'transparent', border: 'none', fontSize: 20, color: 'var(--viro-textSub)', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, color: 'var(--viro-textSub)', lineHeight: 1.6 }}>
              <p>🔗 <b style={{ color: 'var(--viro-text)' }}>Share your link or code</b> — anyone who uses it gets a discount automatically, on any order they place.</p>
              <p>⏳ <b style={{ color: 'var(--viro-text)' }}>Commission stays "Pending"</b> until that order is actually delivered — never before, so what you see is always real, earned money.</p>
              <p>🪙 <b style={{ color: 'var(--viro-text)' }}>Released commission</b> becomes spendable "Partner Coins" you can use on your own Viro orders at checkout, or leave to build up.</p>
              <p>📈 <b style={{ color: 'var(--viro-text)' }}>Tiers pay more</b> — the more orders you drive, the higher your commission multiplier climbs automatically. Check your progress on the Dashboard.</p>
              <p>🎁 <b style={{ color: 'var(--viro-text)' }}>Bonuses</b> — Viro can also add a bonus to your balance directly (e.g. a joining gift). These show up in your Transaction History tagged "🎁 Bonus", separate from order commissions.</p>
              <p>📊 <b style={{ color: 'var(--viro-text)' }}>Not sure where a balance came from?</b> Every rupee — order or bonus — has its own line in <Link href="/partner/transactions" onClick={() => setShowHelp(false)} style={{ color: '#8B5CF6', fontWeight: 700 }}>Transaction History</Link>.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
