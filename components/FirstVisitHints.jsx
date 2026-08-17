'use client'
import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const LS_KEY = 'viro_first_visit_hints_v1'

// Two friendly, dismissible speech-bubble tooltips that point at the
// Wishlist and Cart tabs in the bottom nav — shown ONCE ever, only to
// brand-new visitors on their very first Home page load, so they learn the
// core mechanics (saving items, unlocking free delivery) without having to
// stumble onto them by trial and error. Mobile-only (the bottom nav layout
// this points at doesn't exist on desktop's sidebar).
export default function FirstVisitHints() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0) // 0 = wishlist hint, 1 = cart hint

  useEffect(() => {
    if (pathname !== '/') return
    try {
      if (localStorage.getItem(LS_KEY)) return
    } catch { return }

    // Small delay so it doesn't compete with the page's own entrance
    // animations — feels like a natural next beat, not a jump-scare.
    const showTimer = setTimeout(() => setVisible(true), 1400)
    return () => clearTimeout(showTimer)
  }, [pathname])

  useEffect(() => {
    if (!visible) return
    // Auto-advance from hint 1 to hint 2, then auto-dismiss — so a visitor
    // who never taps anything still isn't stuck looking at it forever.
    const t = setTimeout(() => {
      if (step === 0) setStep(1)
      else dismiss()
    }, 3600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, step])

  function dismiss() {
    setVisible(false)
    try { localStorage.setItem(LS_KEY, '1') } catch {}
  }

  if (!visible || pathname !== '/') return null

  const hints = [
    {
      // Wishlist tab is the 4th of 6 mobile bottom-nav tabs (Home, Shop,
      // Search, Wishlist, Cart, Account/Orders) — centered at 3.5/6.
      leftPct: 58.33,
      emoji: '❤️',
      title: 'Tap the heart to save for later',
      sub: "Found something you love? Tap ❤️ on any product — it'll be waiting for you here.",
      color: '#F43F5E',
    },
    {
      // Cart tab is the 5th of 6 — centered at 4.5/6.
      leftPct: 75,
      emoji: '🛍️',
      title: 'Add a few more to unlock free delivery',
      sub: 'Keep adding items — once your cart crosses the threshold, delivery is on us!',
      color: '#8B5CF6',
    },
  ]
  const h = hints[step]

  return (
    <div className="md:hidden" style={{ position: 'fixed', inset: 0, zIndex: 60, pointerEvents: 'none' }}>
      {/* Dim backdrop — tap anywhere to dismiss both hints early */}
      <div onClick={dismiss}
        style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.25)', pointerEvents: 'auto',
          animation: 'fvh-fade-in 0.25s ease' }} />

      {/* Speech bubble, positioned above its target nav tab */}
      <div
        key={step}
        style={{
          position: 'absolute',
          left: `${h.leftPct}%`,
          transform: 'translateX(-50%)',
          bottom: 'calc(72px + env(safe-area-inset-bottom))',
          width: 240,
          maxWidth: '78vw',
          pointerEvents: 'auto',
          animation: 'fvh-pop-in 0.3s cubic-bezier(.34,1.56,.64,1)',
        }}>
        <div style={{
          background: '#fff', borderRadius: 16, padding: '12px 14px',
          boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
          border: `1.5px solid ${h.color}30`,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{h.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: '#0F172A' }}>{h.title}</p>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: '#64748B', lineHeight: 1.4 }}>{h.sub}</p>
            </div>
            <button onClick={dismiss} aria-label="Dismiss"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8',
                fontSize: 14, lineHeight: 1, padding: 2, flexShrink: 0 }}>✕</button>
          </div>
          {/* Progress dots + skip */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {hints.map((_, i) => (
                <span key={i} style={{
                  width: i === step ? 14 : 5, height: 5, borderRadius: 999,
                  background: i === step ? h.color : `${h.color}30`,
                  transition: 'all 0.2s',
                }} />
              ))}
            </div>
            {step < hints.length - 1 ? (
              <button onClick={() => setStep(step + 1)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: h.color, padding: 0 }}>
                Next →
              </button>
            ) : (
              <button onClick={dismiss}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: h.color, padding: 0 }}>
                Got it ✓
              </button>
            )}
          </div>
        </div>
        {/* Little pointer triangle aiming down at the nav tab */}
        <div style={{
          position: 'absolute', bottom: -7, left: '50%', transform: 'translateX(-50%) rotate(45deg)',
          width: 14, height: 14, background: '#fff',
          borderRight: `1.5px solid ${h.color}30`, borderBottom: `1.5px solid ${h.color}30`,
        }} />
      </div>

      <style jsx>{`
        @keyframes fvh-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fvh-pop-in {
          from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.92); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
