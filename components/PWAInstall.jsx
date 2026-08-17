'use client'
// ── PWAInstall ───────────────────────────────────────────────────────────────
// Shows install prompt when browser fires beforeinstallprompt.
// - "Later": hides for 3 days (localStorage timestamp)
// - "Never" (3rd+ dismiss): permanently hidden
// - Already installed (standalone mode): never shows
// Desktop: bigger card (420px), bottom-right corner
// Mobile: bottom sheet above nav bar
// ─────────────────────────────────────────────────────────────────────────────
import Image from 'next/image'
import React, { useEffect, useState } from 'react'

const LS_INSTALL_SNOOZED  = 'viro_install_snoozed_until'
const LS_INSTALL_DECLINED = 'viro_install_declined'
const LS_INSTALL_DISMISS_COUNT = 'viro_install_dismiss_count'

export default function PWAInstall() {
  const [prompt,    setPrompt]    = useState(null)
  const [show,      setShow]      = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true); return
    }
    // Permanently declined
    if (localStorage.getItem(LS_INSTALL_DECLINED) === '1') return
    // Snoozed
    const snoozedUntil = parseInt(localStorage.getItem(LS_INSTALL_SNOOZED) || '0', 10)
    if (snoozedUntil > Date.now()) return

    const handler = e => {
      e.preventDefault()
      setPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => { setInstalled(true); setShow(false) })
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function install() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setShow(false)
  }

  function handleLater() {
    const count = parseInt(localStorage.getItem(LS_INSTALL_DISMISS_COUNT) || '0', 10) + 1
    localStorage.setItem(LS_INSTALL_DISMISS_COUNT, String(count))
    if (count >= 3) {
      localStorage.setItem(LS_INSTALL_DECLINED, '1')
    } else {
      // Snooze 3 days
      localStorage.setItem(LS_INSTALL_SNOOZED, String(Date.now() + 3 * 24 * 60 * 60 * 1000))
    }
    setShow(false)
  }

  if (!show || installed) return null

  return (
    <>
      <style>{`
        @keyframes pwaSlideUp {
          from { opacity:0; transform:translateY(20px) }
          to   { opacity:1; transform:translateY(0) }
        }
        .pwa-install-card { animation: pwaSlideUp 0.35s cubic-bezier(.4,0,.2,1) both; }
        @media (min-width: 640px) {
          .pwa-install-card {
            left: auto !important;
            right: 24px !important;
            bottom: 24px !important;
            width: 420px !important;
            max-width: 420px !important;
            border-radius: 20px !important;
          }
        }
      `}</style>

      <div className="pwa-install-card" style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
        left: 12, right: 12,
        zIndex: 9980,
        maxWidth: 340, marginLeft: 'auto',
        background: 'var(--viro-bgCard)',
        border: '1px solid var(--viro-border)',
        borderRadius: 18,
        boxShadow: '0 8px 40px rgba(139,92,246,0.25)',
        overflow: 'hidden',
      }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg,#00BFFF,#8B5CF6,#F97316)' }} />

        <div style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <Image src="/icon-192.png" alt="Viro" width={52} height={52}
              style={{ width: 52, height: 52, borderRadius: 13, objectFit: 'cover', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: 'var(--viro-text)', fontWeight: 800, fontSize: 15, margin: '0 0 3px' }}>
                Install Viro App
              </p>
              <p style={{ color: 'var(--viro-textSub)', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                Fast access, offline browsing &amp; order alerts
              </p>
            </div>
            <button onClick={handleLater} aria-label="Dismiss install prompt" style={{
              color: 'var(--viro-textSub)', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 18, padding: '4px 6px', lineHeight: 1, flexShrink: 0,
            }}>✕</button>
          </div>

          {/* Feature pills */}
          <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
            {['⚡ Instant open','📦 Order updates','🔔 Deal alerts'].map(t => (
              <span key={t} style={{
                fontSize: 11, fontWeight: 600, color: 'var(--viro-textSub)',
                background: 'var(--viro-bgDeep)', border: '1px solid var(--viro-border)',
                borderRadius: 20, padding: '3px 9px',
              }}>{t}</span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleLater} style={{
              flex: 1, padding: '10px 0', borderRadius: 11, fontSize: 13, fontWeight: 600,
              background: 'var(--viro-bgDeep)', color: 'var(--viro-textSub)',
              border: '1px solid var(--viro-border)', cursor: 'pointer',
            }}>Later</button>
            <button onClick={install} style={{
              flex: 2, padding: '10px 0', borderRadius: 11, fontSize: 13, fontWeight: 700,
              background: 'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)',
              color: '#fff', border: 'none', cursor: 'pointer',
            }}>📲 Install App</button>
          </div>
        </div>
      </div>
    </>
  )
}
