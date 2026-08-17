'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePartner } from '../../context/PartnerContext'

function getTier(orderCount) {
  if (orderCount >= 50) return { label: 'Elite Partner', icon: '💎' }
  if (orderCount >= 20) return { label: 'Star Partner', icon: '🥇' }
  if (orderCount >= 5) return { label: 'Rising Star', icon: '🥈' }
  return { label: 'Starter', icon: '🥉' }
}

const DEFAULT_TIERS = [
  { key: 'starter', icon: '🥉', label: 'Starter',       at: 0,  color: '#B45309' },
  { key: 'rising',  icon: '🥈', label: 'Rising Star',   at: 5,  color: '#64748B' },
  { key: 'star',    icon: '🥇', label: 'Star Partner',  at: 20, color: '#F59E0B' },
  { key: 'elite',   icon: '💎', label: 'Elite Partner', at: 50, color: '#22D3EE' },
]
const TIER_COLOR_PALETTE = ['#B45309', '#64748B', '#F59E0B', '#22D3EE', '#8B5CF6', '#EC4899']

// A visual ladder — starter → silver-ish → gold → diamond — instead of a
// single badge, so it's obvious at a glance where someone stands AND what
// getting to the next rung actually takes. The whole point is to make
// "one more sale" feel like visible progress, not an abstract number.
// `tiers` comes from the API (admin-configurable via the Partners tab) —
// falls back to sensible defaults only if that's ever missing.
function TierLadder({ orderCount, tiers }) {
  const TIERS = (tiers && tiers.length ? tiers : DEFAULT_TIERS).map((t, i) => ({ ...t, color: t.color || TIER_COLOR_PALETTE[i % TIER_COLOR_PALETTE.length] }))
  const currentIdx = TIERS.reduce((acc, t, i) => (orderCount >= t.at ? i : acc), 0)
  const next = TIERS[currentIdx + 1]
  const progressPct = next ? Math.min(100, Math.round(((orderCount - TIERS[currentIdx].at) / (next.at - TIERS[currentIdx].at)) * 100)) : 100
  const linePct = TIERS.length > 1 ? (currentIdx / (TIERS.length - 1)) * 100 : 100

  return (
    <div className="p-4 rounded-2xl mb-4" style={CARD}>
      <div style={{ position: 'relative', padding: '0 18px' }}>
        <div style={{ position: 'absolute', top: 17, left: 18, right: 18, height: 3, background: 'var(--viro-border)', borderRadius: 3 }} />
        <div style={{ position: 'absolute', top: 17, left: 18, height: 3, borderRadius: 3, width: `calc((100% - 36px) * ${linePct / 100})`, background: 'linear-gradient(90deg,#B45309,#F59E0B,#22D3EE)', transition: 'width 0.5s' }} />
        <div className="flex justify-between relative">
          {TIERS.map((t, i) => {
            const reached = i <= currentIdx
            const isCurrent = i === currentIdx
            return (
              <div key={t.key} className="flex flex-col items-center" style={{ width: 60 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, background: reached ? `${t.color}22` : 'var(--viro-bgDeep)',
                  border: `2.5px solid ${reached ? t.color : 'var(--viro-border)'}`,
                  boxShadow: isCurrent ? `0 0 0 5px ${t.color}22` : 'none', transition: 'all 0.3s',
                }}>
                  {t.icon}
                </div>
                <p className="text-center" style={{ fontSize: 9.5, fontWeight: 800, marginTop: 5, color: reached ? t.color : 'var(--viro-textSub)', lineHeight: 1.2 }}>{t.label}</p>
                <p style={{ fontSize: 8.5, color: 'var(--viro-textSub)' }}>{t.at}+ orders</p>
              </div>
            )
          })}
        </div>
      </div>
      {next && (
        <div style={{ marginTop: 14 }}>
          <div style={{ height: 6, borderRadius: 4, background: 'var(--viro-bgDeep)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg,#8B5CF6,#7C3AED)', borderRadius: 4, transition: 'width 0.5s' }} />
          </div>
          <p className="text-center" style={{ fontSize: 11, marginTop: 7, color: 'var(--viro-textSub)' }}>
            <b style={{ color: 'var(--viro-text)' }}>{next.at - orderCount}</b> more order{next.at - orderCount !== 1 ? 's' : ''} to unlock <b style={{ color: next.color }}>{next.icon} {next.label}</b>
          </p>
        </div>
      )}
      {!next && (
        <p className="text-center mt-3" style={{ fontSize: 11, color: '#22D3EE', fontWeight: 700 }}>💎 You've reached the top tier — thank you for being a top partner!</p>
      )}
    </div>
  )
}

const CARD = { background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)', borderRadius: 16 }

export default function PartnerDashboardClient() {
  const { data, rank } = usePartner()
  const [showQR, setShowQR] = useState(false)
  const [qrFailed, setQrFailed] = useState(false)
  const [toast, setToast] = useState(null)
  const [canNativeShare, setCanNativeShare] = useState(false)

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.share) setCanNativeShare(true)
  }, [])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  if (!data) return null // shell already guarantees approved+data by the time this renders

  function copyReferralLink() {
    const link = `https://viro.pk/shop?coupon=${encodeURIComponent(data.coupon?.code)}`
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => showToast('🔗 Referral link copied!'))
  }
  // BUGFIX: this used to copy just the bare code ("D10") — pasted anywhere
  // (Instagram bio, a text message, a WhatsApp chat outside the built-in
  // share button) that means nothing on its own to whoever receives it. Now
  // copies the exact same ready-to-send message the WhatsApp button sends,
  // so tapping the code and pasting it ANYWHERE gives a complete, useful
  // message — not a code with no context.
  function shareMessage() {
    const link = `https://viro.pk/shop?coupon=${encodeURIComponent(data.coupon?.code)}`
    return `Hey! Use my code ${data.coupon?.code} for a discount at Viro 🛍️ ${link}`
  }
  function copyCoupon() {
    if (navigator.clipboard) navigator.clipboard.writeText(shareMessage()).then(() => showToast('📋 Message copied — ready to paste and send!'))
  }
  function shareOnWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage())}`, '_blank')
  }
  // Native share sheet — on mobile this surfaces Instagram, Messages, Mail,
  // and every other app the person has installed, not just WhatsApp. Only
  // shown when the browser actually supports it (mostly mobile Safari/Chrome).
  function shareNative() {
    const link = `https://viro.pk/shop?coupon=${encodeURIComponent(data.coupon?.code)}`
    navigator.share({ title: 'Shop at Viro', text: `Use my code ${data.coupon?.code} for a discount at Viro 🛍️`, url: link }).catch(() => {})
  }

  return (
    <div className="max-w-5xl mx-auto">
      {toast && (
        // BUGFIX: this was fixed at top-4 (16px from the viewport top) —
        // fine on a page with no header, but /partner has its own header
        // (avatar, name, balance, nav tabs) sitting right at the top of the
        // page too, so the toast was landing directly on top of it,
        // covering the name/balance instead of appearing as a clean,
        // separate notification. Pushed below that header's typical height
        // instead, with a max-width so it reads as a pill, not a banner
        // stretching edge-to-edge over the header.
        <div className="fixed left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg text-white text-center"
          style={{ background: '#10B981', top: 'calc(env(safe-area-inset-top, 0px) + 190px)', maxWidth: '85vw', width: 'max-content' }}>
          {toast}
        </div>
      )}

      {data.newSinceLastVisit > 0 && (
        <div className="text-center py-2 px-3 rounded-xl fade-in mb-4" style={{ background: '#10B98115', border: '1px solid #10B98140' }}>
          <p className="text-sm font-extrabold" style={{ color: '#10B981' }}>
            🎉 You earned Rs.{data.newSinceLastVisit.toLocaleString()} since your last visit!
          </p>
        </div>
      )}

      <div className="text-center py-1 mb-1">
        {rank?.rank && (
          <span className="text-sm font-extrabold px-3 py-1 rounded-full inline-block mb-2" style={{ background: '#F59E0B15', color: '#F59E0B', border: '1px solid #F59E0B40' }}>
            🏆 #{rank.rank} this month
          </span>
        )}
      </div>

      <TierLadder orderCount={data.orderCount} tiers={data.allTiers} />

      <div className="md:grid md:grid-cols-5 md:gap-5 md:items-start">
        <div className="md:col-span-2 space-y-4">
          {/* Coupon — the whole point of this card is to make sharing feel
              exciting, not like filling out a form. Bigger, bolder, glowing
              border, and a clear "you earn X per order" hook right up top. */}
          <div className="p-5 text-center relative overflow-hidden" style={{ borderRadius: 20, background: 'linear-gradient(160deg,#1e1b4b,#0f172a)', border: '1.5px solid #8B5CF640' }}>
            <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle,#8B5CF640,transparent 70%)', pointerEvents: 'none' }} />
            <p className="text-xs font-bold" style={{ color: '#A78BFA' }}>
              💰 Earn {data.influencer.commission_percent}% on every order — share now!
            </p>
            <p className="text-[10.5px] font-bold uppercase tracking-wider mt-3 mb-2" style={{ color: '#64748B' }}>Your Coupon Code</p>
            <button onClick={copyCoupon}
              className="text-2xl font-extrabold tracking-wider px-5 py-2.5 rounded-xl mb-1"
              style={{ background: 'rgba(139,92,246,0.12)', border: '2px dashed #8B5CF6', color: '#C4B5FD', cursor: 'pointer' }}>
              {data.coupon?.code || '—'} 📋
            </button>
            <p className="text-xs mb-4" style={{ color: '#94A3B8' }}>
              {data.coupon?.type === 'percent' ? `${data.coupon.value}% off` : `Rs.${data.coupon?.value} off`} for anyone who uses it · Tap to copy
            </p>
            <div className="flex gap-2 mb-3">
              <button onClick={shareOnWhatsApp} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5" style={{ background: '#25D366' }}>
                💬 WhatsApp
              </button>
              {canNativeShare ? (
                <button onClick={shareNative} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5" style={{ background: 'linear-gradient(135deg,#8B5CF6,#EC4899)' }}>
                  📤 Share
                </button>
              ) : (
                <button onClick={copyReferralLink} className="flex-1 py-2.5 rounded-xl text-xs font-bold" style={{ background: 'rgba(139,92,246,0.12)', border: '1.5px solid #8B5CF6', color: '#C4B5FD' }}>
                  🔗 Copy Link
                </button>
              )}
            </div>
            {canNativeShare && (
              <button onClick={copyReferralLink} className="text-[10.5px] font-bold mb-2 block mx-auto" style={{ color: '#8B5CF6' }}>🔗 or just copy the link</button>
            )}
            <button onClick={() => setShowQR(v => !v)} className="text-[11px] font-bold" style={{ color: '#8B5CF6' }}>
              {showQR ? '▲ Hide QR Code' : '▼ Show QR Code (for offline sharing)'}
            </button>
            {showQR && data.coupon?.code && (
              <div className="mt-3 flex flex-col items-center fade-in">
                {qrFailed ? (
                  <p className="text-[10.5px] py-4" style={{ color: '#94A3B8' }}>
                    QR code couldn't load right now — use Copy Link or WhatsApp above instead.
                  </p>
                ) : (
                  <>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`https://viro.pk/shop?coupon=${data.coupon.code}`)}`}
                      alt="QR code for your referral link" width={140} height={140} style={{ borderRadius: 12, background: '#fff', padding: 8 }}
                      onError={() => setQrFailed(true)} />
                    <p className="text-[10.5px] mt-2" style={{ color: '#94A3B8' }}>Scan to shop with your code</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Other coupons — a partner can have more than one linked (admin
              sets these up, e.g. a separate rate for a specific campaign).
              Each one is independently copyable, so it's obvious which
              code is which without opening the main one every time. */}
          {data.extraCoupons && data.extraCoupons.length > 0 && (
            <div className="p-4 rounded-2xl" style={CARD}>
              <p className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: 'var(--viro-textSub)' }}>🎟️ Your Other Coupons</p>
              <div className="space-y-2">
                {data.extraCoupons.map(ec => (
                  <div key={ec.code} className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: 'var(--viro-bgDeep)' }}>
                    <div>
                      <button onClick={() => {
                          if (navigator.clipboard) navigator.clipboard.writeText(`Hey! Use my code ${ec.code} for a discount at Viro 🛍️ https://viro.pk/shop?coupon=${ec.code}`).then(() => showToast('📋 Message copied!'))
                        }}
                        className="text-sm font-extrabold" style={{ color: '#7C3AED', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        {ec.code} 📋
                      </button>
                      <p className="text-[11px]" style={{ color: 'var(--viro-textSub)' }}>
                        {ec.type === 'percent' ? `${ec.value}% off` : `Rs.${ec.value} off`}{ec.label ? ` · ${ec.label}` : ''}
                      </p>
                    </div>
                    <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Hey! Use my code ${ec.code} for a discount at Viro 🛍️ https://viro.pk/shop?coupon=${ec.code}`)}`, '_blank')}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg text-white flex-shrink-0" style={{ background: '#25D366' }}>
                      💬
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
        </div>

        <div className="md:col-span-3 space-y-3 mt-4 md:mt-0">
          {/* Nav cards → dedicated pages, instead of everything crammed onto one long scroll */}
          <Link href="/partner/transactions" className="flex items-center gap-3 p-4 rounded-2xl" style={{ ...CARD, textDecoration: 'none' }}>
            <span className="text-2xl">📊</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: 'var(--viro-text)' }}>Transaction History</p>
              <p className="text-xs" style={{ color: 'var(--viro-textSub)' }}>
                {data.ledger.length === 0 ? 'No orders yet' : `${data.ledger.length} order${data.ledger.length !== 1 ? 's' : ''} using your coupon`}
              </p>
            </div>
            <span style={{ color: '#8B5CF6', fontSize: 18 }}>→</span>
          </Link>

          <Link href="/partner/edit" className="flex items-center gap-3 p-4 rounded-2xl" style={{ ...CARD, textDecoration: 'none' }}>
            <span className="text-2xl">✏️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: 'var(--viro-text)' }}>Edit My Info</p>
              <p className="text-xs" style={{ color: 'var(--viro-textSub)' }}>Phone, platform, handle, followers</p>
            </div>
            <span style={{ color: '#8B5CF6', fontSize: 18 }}>→</span>
          </Link>

          {/* Recent activity preview — the full list lives on /partner/transactions,
              this is just a taste so the dashboard isn't a dead end */}
          <div className="p-4" style={CARD}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--viro-textSub)' }}>Recent Activity</p>
              {data.ledger.length > 3 && (
                <Link href="/partner/transactions" className="text-[11px] font-bold" style={{ color: '#8B5CF6' }}>View All →</Link>
              )}
            </div>
            {data.ledger.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: 'var(--viro-textSub)' }}>No orders yet — share your coupon to get started!</p>
            ) : (
              <div className="space-y-2">
                {data.ledger.slice(0, 3).map((row, i) => (
                  <div key={row.order_short_id || `${row.order_date}-${i}`} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                    style={{ background: row.is_adjustment ? '#F59E0B10' : 'var(--viro-bgDeep)', border: row.is_adjustment ? '1px dashed #F59E0B40' : 'none' }}>
                    <div>
                      <p className="text-xs font-bold" style={{ color: row.is_adjustment ? (Number(row.commission_amount) < 0 ? '#EF4444' : '#B45309') : 'var(--viro-text)' }}>
                        {row.is_adjustment ? `${Number(row.commission_amount) < 0 ? '🛒' : '🎁'} ${row.note || 'Bonus'}` : `#${row.order_short_id || '—'}`}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--viro-textSub)' }}>
                        {row.order_date ? new Date(row.order_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        {!row.is_adjustment && ` · Rs.${Number(row.order_total || 0).toLocaleString()}`}
                      </p>
                    </div>
                    <p className="text-xs font-extrabold" style={{ color: Number(row.commission_amount) < 0 ? '#EF4444' : row.commission_status === 'released' ? '#10B981' : row.commission_status === 'voided' ? '#94A3B8' : '#F59E0B' }}>
                      {Number(row.commission_amount) >= 0 ? '+' : ''}Rs.{Number(row.commission_amount || 0).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* How it works */}
          <details className="p-4 rounded-2xl" style={CARD}>
            <summary className="text-xs font-bold uppercase tracking-wider cursor-pointer" style={{ color: 'var(--viro-textSub)' }}>❓ How This Works</summary>
            <div className="mt-3 space-y-2.5 text-xs" style={{ color: 'var(--viro-textSub)' }}>
              <p>🔗 <b style={{ color: 'var(--viro-text)' }}>Share your link or code</b> — anyone who uses it gets a discount automatically.</p>
              <p>⏳ <b style={{ color: 'var(--viro-text)' }}>Commission stays "Pending"</b> until that order is actually delivered — never before, so it's always real money.</p>
              <p>🪙 <b style={{ color: 'var(--viro-text)' }}>Released commission</b> becomes spendable "Partner Coins" you can use on your own Viro orders at checkout.</p>
              <p>📈 <b style={{ color: 'var(--viro-text)' }}>Tiers pay more</b> — the more orders you drive, the higher your commission multiplier climbs automatically.</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}
