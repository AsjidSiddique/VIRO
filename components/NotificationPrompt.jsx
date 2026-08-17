'use client'
// ── NotificationPrompt ───────────────────────────────────────────────────────
// Shows notification permission request.
//
// Show rules:
//  - Never shows if Notification.permission is already 'granted' or 'denied'
//  - Never shows if user has already interacted with this prompt (LS_DONE = '1')
//  - Shows 3s after first visit
//  - "Later": snoozes 3 visits, max 2 snoozes before permanently gone
//  - Clicking "Yes, Notify Me!" sets LS_DONE immediately — never asks again
//    regardless of whether the browser dialog was accepted or dismissed
//
// Mobile (<640px): bottom sheet
// Desktop (≥640px): centered modal overlay
// ─────────────────────────────────────────────────────────────────────────────
import Image from 'next/image'
import React, { useEffect, useState } from 'react'
import { tagOneSignalSession } from '../lib/tagOneSignalSession'

const LS_DONE        = 'viro_notif_done'       // '1' = never show again
const LS_LATER_AT    = 'viro_notif_later_at'   // visit count to show next time
const LS_VISIT_COUNT = 'viro_notif_visits'
const LS_SNOOZE_COUNT = 'viro_notif_snoozes'
const LS_LAST_SHOWN   = 'viro_notif_last_shown' // timestamp — prevents re-showing on every refresh if ignored
const SHOWN_COOLDOWN_HOURS = 20 // don't re-show for this long after being shown, even if never explicitly dismissed

export default function NotificationPrompt() {
  const [show,   setShow]   = useState(false)
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) return

    // Already decided (yes or previously clicked "Yes") — never show
    if (localStorage.getItem(LS_DONE) === '1') return
    // Browser already granted or denied — respect browser state, never re-ask
    if (Notification.permission !== 'default') {
      localStorage.setItem(LS_DONE, '1')
      return
    }

    // Shown recently and ignored (no explicit Later/Yes click, e.g. tab closed
    // or page refreshed) — don't spam it again on every reload, wait out the
    // cooldown just like a real dismissal would.
    const lastShown = parseInt(localStorage.getItem(LS_LAST_SHOWN) || '0', 10)
    if (lastShown && (Date.now() - lastShown) / 36e5 < SHOWN_COOLDOWN_HOURS) return

    // Increment visit count
    const visits = parseInt(localStorage.getItem(LS_VISIT_COUNT) || '0', 10) + 1
    localStorage.setItem(LS_VISIT_COUNT, String(visits))

    // Check snooze
    const laterAt = parseInt(localStorage.getItem(LS_LATER_AT) || '0', 10)
    if (laterAt > 0 && visits < laterAt) return

    const timer = setTimeout(() => {
      // Re-check in case another tab updated state
      if (localStorage.getItem(LS_DONE) === '1') return
      if (Notification.permission !== 'default') {
        localStorage.setItem(LS_DONE, '1')
        return
      }
      localStorage.setItem(LS_LAST_SHOWN, String(Date.now()))
      setShow(true)
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  async function handleYes() {
    // Mark done IMMEDIATELY — even if browser dialog is dismissed, never ask again
    localStorage.setItem(LS_DONE, '1')
    setAsking(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted' && window.OneSignalDeferred) {
        window.OneSignalDeferred.push(async (os) => {
          try { await os.User?.PushSubscription?.optIn?.() } catch {}
        })
        // Tag this subscription with the cart session — this is what lets us
        // send a cart-recovery push later even to visitors who never gave us
        // a phone number or email (e.g. anonymous Instagram traffic).
        tagOneSignalSession()
      }
    } catch {}
    setShow(false)
    setAsking(false)
  }

  function handleLater() {
    const snoozes = parseInt(localStorage.getItem(LS_SNOOZE_COUNT) || '0', 10) + 1
    localStorage.setItem(LS_SNOOZE_COUNT, String(snoozes))
    if (snoozes >= 2) {
      // 2 snoozes = permanently done
      localStorage.setItem(LS_DONE, '1')
    } else {
      const visits = parseInt(localStorage.getItem(LS_VISIT_COUNT) || '1', 10)
      localStorage.setItem(LS_LATER_AT, String(visits + 3))
    }
    setShow(false)
  }

  if (!show) return null

  const actionRow = (
    <div style={{ display:'flex', gap:8 }}>
      <button onClick={handleLater} style={{
        flex:1, padding:'11px 0', borderRadius:11, fontSize:13, fontWeight:600,
        background:'transparent', color:'var(--viro-textSub)',
        border:'1px solid var(--viro-border)', cursor:'pointer',
      }}>Later</button>
      <button onClick={handleYes} disabled={asking} style={{
        flex:2, padding:'11px 0', borderRadius:11, fontSize:13, fontWeight:700,
        background: asking ? 'var(--viro-bgDeep)' : 'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)',
        color: asking ? 'var(--viro-textSub)' : '#fff',
        border:'none', cursor: asking ? 'not-allowed' : 'pointer',
      }}>{asking ? '⏳ Enabling...' : '🔔 Yes, Notify Me!'}</button>
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes notifSlideUp {
          from { opacity:0; transform:translateY(100%) }
          to   { opacity:1; transform:translateY(0) }
        }
        @keyframes notifFadeIn {
          from { opacity:0; transform:scale(0.96) }
          to   { opacity:1; transform:scale(1) }
        }
        .notif-sheet { animation: notifSlideUp 0.3s cubic-bezier(.4,0,.2,1) both; }
        .notif-card  { animation: notifFadeIn  0.28s cubic-bezier(.34,1.1,.64,1) both; }
      `}</style>

      {/* ── MOBILE: Backdrop + bottom sheet ──────────────────────────────────── */}
      <div onClick={handleLater} className="sm:hidden" style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.45)',
        zIndex:9995, backdropFilter:'blur(2px)',
      }} />

      <div className="notif-sheet block sm:hidden" style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:9996,
        background:'var(--viro-bgCard)', borderTop:'1px solid var(--viro-border)',
        borderRadius:'20px 20px 0 0', boxShadow:'0 -8px 40px rgba(0,0,0,0.35)',
        paddingBottom:'env(safe-area-inset-bottom, 8px)', overflow:'hidden',
      }}>
        <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 4px' }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'var(--viro-border)' }} />
        </div>
        <div style={{ height:3, background:'linear-gradient(90deg,#00BFFF,#8B5CF6,#F97316)', margin:'6px 0 0' }} />
        <div style={{ padding:'14px 20px 16px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <div style={{ position:'relative', flexShrink:0 }}>
              <Image src="/icon-192.png" alt="Viro" width={50} height={50}
                style={{ width:50, height:50, borderRadius:13, objectFit:'cover' }} />
              <span style={{
                position:'absolute', bottom:-5, right:-5,
                fontSize:15, background:'var(--viro-bgCard)',
                borderRadius:'50%', padding:2, boxShadow:'0 1px 5px rgba(0,0,0,0.3)',
              }}>🔔</span>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ color:'var(--viro-text)', fontWeight:800, fontSize:15, margin:'0 0 3px' }}>
                Stay Updated with Viro
              </p>
              <p style={{ color:'var(--viro-textSub)', fontSize:12, margin:0, lineHeight:1.5 }}>
                Order alerts, new arrivals &amp; exclusive deals 🎁
              </p>
            </div>
          </div>
          <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
            {['📦 Orders','🆕 New Arrivals','💰 Deals'].map(t => (
              <span key={t} style={{
                fontSize:10, fontWeight:600, color:'var(--viro-textSub)',
                background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)',
                borderRadius:20, padding:'3px 8px',
              }}>{t}</span>
            ))}
          </div>
          {actionRow}
        </div>
      </div>

      {/* ── DESKTOP: Centered modal (≥sm) ─────────────────────────────────── */}
      <div onClick={handleLater} className="notif-card hidden sm:flex" style={{
        position:'fixed', inset:0, zIndex:9996,
        alignItems:'center', justifyContent:'center',
        background:'rgba(0,0,0,0.45)', backdropFilter:'blur(4px)',
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          width:420, background:'var(--viro-bgCard)',
          border:'1px solid var(--viro-border)', borderRadius:22,
          boxShadow:'0 16px 48px rgba(0,0,0,0.35)', overflow:'hidden',
        }}>
          <div style={{ height:4, background:'linear-gradient(90deg,#00BFFF,#8B5CF6,#F97316)' }} />
          <div style={{ padding:'22px 22px 20px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
              <div style={{ position:'relative', flexShrink:0 }}>
                <Image src="/icon-192.png" alt="Viro" width={54} height={54}
                  style={{ width:54, height:54, borderRadius:14, objectFit:'cover' }} />
                <span style={{
                  position:'absolute', bottom:-5, right:-5,
                  fontSize:16, background:'var(--viro-bgCard)',
                  borderRadius:'50%', padding:2, boxShadow:'0 1px 6px rgba(0,0,0,0.25)',
                }}>🔔</span>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ color:'var(--viro-text)', fontWeight:800, fontSize:16, margin:'0 0 4px' }}>
                  Stay Updated with Viro
                </p>
                <p style={{ color:'var(--viro-textSub)', fontSize:13, margin:0, lineHeight:1.5 }}>
                  Get instant alerts for orders, new arrivals &amp; deals 🎁
                </p>
              </div>
              <button onClick={handleLater} aria-label="Dismiss" style={{
                color:'var(--viro-textSub)', background:'none', border:'none',
                cursor:'pointer', fontSize:20, padding:'4px 6px', lineHeight:1, flexShrink:0,
              }}>✕</button>
            </div>
            <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
              {['📦 Orders','🆕 New Arrivals','💰 Deals'].map(t => (
                <span key={t} style={{
                  fontSize:11, fontWeight:600, color:'var(--viro-textSub)',
                  background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)',
                  borderRadius:20, padding:'4px 10px',
                }}>{t}</span>
              ))}
            </div>
            {actionRow}
          </div>
        </div>
      </div>
    </>
  )
}
