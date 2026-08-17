'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSite } from '../context/SiteSettingsContext'

const LS_LAST_SHOWN = 'viro_exit_popup_last_shown'
const LS_DISMISSED_FOREVER = 'viro_exit_popup_dismissed_forever'
const SS_SHOWN_THIS_SESSION = 'viro_exit_popup_shown_session'

export default function ExitIntentPopup() {
  const { exitPopup, loaded } = useSite()
  const pathname = usePathname()
  const router = useRouter()
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)
  const firedRef = useRef(false)

  const isEligiblePage = pathname && !pathname.startsWith('/adm') &&
    pathname !== '/checkout' && pathname !== '/cart'

  useEffect(() => {
    if (!loaded || !exitPopup?.enabled || !isEligiblePage) return
    if (!exitPopup.headline && !exitPopup.images?.length) return
    // Desktop only — exit intent (mouse leaving toward the top of the
    // screen) isn't a meaningful signal on touch devices, there's no cursor.
    const isDesktop = window.matchMedia('(pointer: fine)').matches && window.innerWidth >= 768
    if (!isDesktop) return
    if (localStorage.getItem(LS_DISMISSED_FOREVER) === '1') return
    if (sessionStorage.getItem(SS_SHOWN_THIS_SESSION) === '1') return

    const lastShown = parseInt(localStorage.getItem(LS_LAST_SHOWN) || '0', 10)
    const hoursSince = (Date.now() - lastShown) / 36e5
    if (lastShown && hoursSince < (exitPopup.frequencyHours ?? 24)) return

    function onMouseLeave(e) {
      if (firedRef.current) return
      // clientY <= 0 means the cursor left through the TOP of the viewport —
      // i.e. heading toward the tab bar, address bar, or browser close button.
      if (e.clientY > 0) return
      firedRef.current = true
      setShow(true)
      localStorage.setItem(LS_LAST_SHOWN, String(Date.now()))
      sessionStorage.setItem(SS_SHOWN_THIS_SESSION, '1')
    }

    document.addEventListener('mouseleave', onMouseLeave)
    return () => document.removeEventListener('mouseleave', onMouseLeave)
  }, [loaded, exitPopup, isEligiblePage])

  function dismiss(forever = false) {
    setShow(false)
    if (forever) localStorage.setItem(LS_DISMISSED_FOREVER, '1')
  }

  function handleCta() {
    setShow(false)
    if (exitPopup.ctaLink) router.push(exitPopup.ctaLink)
  }

  function copyCode() {
    if (!exitPopup.discountCode) return
    navigator.clipboard?.writeText(exitPopup.discountCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  if (!show || !exitPopup) return null

  return (
    <div
      onClick={() => dismiss(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 9991,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, animation: 'vroExitFade 0.2s ease',
      }}>
      <style>{`
        @keyframes vroExitFade { from { opacity:0 } to { opacity:1 } }
        @keyframes vroExitPop { from { opacity:0; transform:scale(0.9) } to { opacity:1; transform:scale(1) } }
        .vro-exit-card { animation: vroExitPop 0.28s cubic-bezier(.34,1.56,.64,1) both; }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        className="vro-exit-card"
        style={{
          width: '100%', maxWidth: 420, background: '#fff', borderRadius: 18,
          overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', position: 'relative',
          border: '2px solid #F97316',
        }}>
        <button onClick={() => dismiss(false)} aria-label="Close" style={{
          position: 'absolute', top: 10, right: 10, zIndex: 2,
          width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 15, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>

        {exitPopup.images?.[0] && (
          <div style={{ width: '100%', aspectRatio: '16/9', overflow: 'hidden', background: '#111' }}>
            <img src={exitPopup.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        <div style={{ padding: '22px 22px 24px', textAlign: 'center' }}>
          {exitPopup.headline && (
            <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 900, color: '#111', letterSpacing: '-0.02em' }}>
              {exitPopup.headline}
            </h3>
          )}
          {exitPopup.subtext && (
            <p style={{ margin: '0 0 14px', fontSize: 13.5, color: '#555' }}>{exitPopup.subtext}</p>
          )}

          {exitPopup.discountCode && (
            <button onClick={copyCode} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, margin: '0 0 14px',
              padding: '9px 16px', borderRadius: 10, border: '1.5px dashed #F97316',
              background: '#FFF7ED', cursor: 'pointer',
            }}>
              <span style={{ fontWeight: 900, fontSize: 15, letterSpacing: '0.05em', color: '#EA580C' }}>
                {exitPopup.discountCode}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#EA580C' }}>{copied ? '✓ Copied' : 'Tap to copy'}</span>
            </button>
          )}

          <button onClick={handleCta} style={{
            width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#F97316,#EA580C)', color: '#fff',
            fontSize: 14, fontWeight: 800,
          }}>{exitPopup.ctaText || 'Claim Offer'}</button>

          <button onClick={() => dismiss(true)} style={{
            display: 'block', margin: '12px auto 0', background: 'none', border: 'none',
            color: '#999', fontSize: 12, textDecoration: 'underline', cursor: 'pointer',
          }}>No thanks, I'll pay full price</button>
        </div>
      </div>
    </div>
  )
}
