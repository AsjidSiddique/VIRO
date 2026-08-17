'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSite } from '../context/SiteSettingsContext'
import { SOCIAL_LINKS } from './socialLinks'

const LS_LAST_SHOWN = 'viro_promo_popup_last_shown'
const LS_DISMISSED_FOREVER = 'viro_promo_popup_dismissed_forever'
const IMAGE_CYCLE_MS = 3500

export default function PromoPopup() {
  const { promoPopup, loaded, contact } = useSite()
  const pathname = usePathname()
  const router = useRouter()
  const [show, setShow] = useState(false)
  const [imgIdx, setImgIdx] = useState(0)
  const firedRef = useRef(false)

  const images = promoPopup?.images?.length ? promoPopup.images : []

  const isEligiblePage = pathname && !pathname.startsWith('/adm') &&
    pathname !== '/checkout' && pathname !== '/cart'

  useEffect(() => {
    firedRef.current = false
    setShow(false)
  }, [pathname])

  useEffect(() => {
    if (!loaded || !promoPopup?.enabled || !isEligiblePage) return
    if (!promoPopup.headline && images.length === 0) return
    if (localStorage.getItem(LS_DISMISSED_FOREVER) === '1') return

    const lastShown = parseInt(localStorage.getItem(LS_LAST_SHOWN) || '0', 10)
    const hoursSince = (Date.now() - lastShown) / 36e5
    if (lastShown && hoursSince < (promoPopup.frequencyHours ?? 24)) return

    const reveal = () => {
      if (firedRef.current) return
      firedRef.current = true
      setImgIdx(0)
      setShow(true)
      localStorage.setItem(LS_LAST_SHOWN, String(Date.now()))
    }

    if (promoPopup.trigger === 'scroll') {
      const pct = Math.max(1, Math.min(100, promoPopup.triggerValue || 40))
      const onScroll = () => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight
        if (scrollable <= 0) return
        const scrolled = (window.scrollY / scrollable) * 100
        if (scrolled >= pct) reveal()
      }
      window.addEventListener('scroll', onScroll, { passive: true })
      return () => window.removeEventListener('scroll', onScroll)
    } else {
      const seconds = Math.max(1, promoPopup.triggerValue || 8)
      const t = setTimeout(reveal, seconds * 1000)
      return () => clearTimeout(t)
    }
  }, [loaded, promoPopup, isEligiblePage]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-cycle through multiple images while the popup is open
  useEffect(() => {
    if (!show || images.length < 2) return
    const t = setInterval(() => setImgIdx(i => (i + 1) % images.length), IMAGE_CYCLE_MS)
    return () => clearInterval(t)
  }, [show, images.length])

  function dismiss(forever = false) {
    setShow(false)
    if (forever) localStorage.setItem(LS_DISMISSED_FOREVER, '1')
  }

  function handleCta() {
    setShow(false)
    localStorage.setItem(LS_LAST_SHOWN, String(Date.now()))
    if (promoPopup.ctaLink) router.push(promoPopup.ctaLink)
  }

  if (!show || !promoPopup) return null

  return (
    <div
      onClick={() => dismiss(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 9990,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, animation: 'vroPromoFade 0.25s ease',
      }}>
      <style>{`
        @keyframes vroPromoFade { from { opacity:0 } to { opacity:1 } }

        /* "Book opening" entrance — two panels swing open from a center spine */
        @keyframes vroBookLeft   { from { transform: rotateY(-100deg); opacity:0.2 } to { transform: rotateY(0deg); opacity:1 } }
        @keyframes vroBookRight  { from { transform: rotateY(100deg);  opacity:0.2 } to { transform: rotateY(0deg); opacity:1 } }
        @keyframes vroBookTop    { from { transform: rotateX(-100deg); opacity:0.2 } to { transform: rotateX(0deg); opacity:1 } }
        @keyframes vroBookBottom { from { transform: rotateX(100deg);  opacity:0.2 } to { transform: rotateX(0deg); opacity:1 } }

        .vro-promo-outer { perspective: 1600px; width: 100%; display: flex; justify-content: center; }
        .vro-promo-card {
          display: flex; flex-direction: column;
          width: 100%; max-width: 360px; background: #fff; border-radius: 18px;
          overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.45); position: relative;
          max-height: 85vh; overflow-y: auto;
        }

        .vro-promo-image   { width:100%; aspect-ratio: 16/10; transform-origin: top center; animation: vroBookTop 0.6s cubic-bezier(.3,.9,.4,1) both; backface-visibility:hidden; }
        .vro-promo-content { transform-origin: bottom center; animation: vroBookBottom 0.6s cubic-bezier(.3,.9,.4,1) both; backface-visibility:hidden; }

        /* Tablet and up — switch to side-by-side, noticeably bigger card */
        @media (min-width: 640px) {
          .vro-promo-card { flex-direction:row !important; max-width: 760px; min-height: 480px; max-height: 90vh; }
          .vro-promo-image { width:46% !important; aspect-ratio:auto !important; height:auto !important;
            transform-origin: right center !important; animation-name: vroBookLeft !important; }
          .vro-promo-content { transform-origin: left center !important; animation-name: vroBookRight !important; }
        }
        @media (min-width: 1024px) {
          .vro-promo-card { max-width: 880px; min-height: 560px; }
          .vro-promo-content { padding: 40px 44px !important; }
          .vro-promo-headline { font-size: 30px !important; max-width: 420px !important; }
          .vro-promo-subtext { font-size: 16px !important; max-width: 420px !important; margin-bottom: 22px !important; }
          .vro-promo-cta { max-width: 340px !important; padding: 15px 0 !important; font-size: 16px !important; }
          .vro-promo-social a { width: 40px !important; height: 40px !important; }
          .vro-promo-social span { width: 19px !important; height: 19px !important; }
        }

        .vro-promo-social a:hover { transform: scale(1.08); }
        .vro-promo-img-fade { animation: vroImgFade 0.5s ease both; }
        @keyframes vroImgFade { from { opacity:0 } to { opacity:1 } }
      `}</style>
      <div className="vro-promo-outer" onClick={e => e.stopPropagation()}>
        <div className="vro-promo-card">
          <button onClick={() => dismiss(false)} aria-label="Close" style={{
            position: 'absolute', top: 10, right: 10, zIndex: 2,
            width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 15, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>

          {/* LEFT/TOP — banner image(s), auto-cycling if more than one uploaded.
              object-fit:contain so the WHOLE image always shows — never
              cropped, whatever its aspect ratio. Dark bg matches typical
              promo-graphic backdrops so any letterboxing blends in. */}
          {images.length > 0 && (
            <div className="vro-promo-image" style={{ flexShrink: 0, overflow: 'hidden', background: '#0a0a0a', position: 'relative' }}>
              <img key={imgIdx} src={images[imgIdx]} alt="" className="vro-promo-img-fade"
                style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', position: 'absolute', inset: 0 }} />
              {images.length > 1 && (
                <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, zIndex: 1 }}>
                  {images.map((_, i) => (
                    <span key={i} style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: i === imgIdx ? '#fff' : 'rgba(255,255,255,0.45)',
                      transition: 'background 0.3s',
                    }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* RIGHT/BOTTOM — offer text + social, soft brand-tinted background instead of flat white */}
          <div className="vro-promo-content" style={{
            flex: 1, padding: '20px 22px', textAlign: 'center', display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center', minWidth: 0,
            background: 'radial-gradient(circle at 50% 0%, rgba(139,92,246,0.07), transparent 65%), linear-gradient(180deg, #fff, #fdfcff)',
          }}>
            {promoPopup.headline && (
              <h3 className="vro-promo-headline" style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 900, color: '#111', letterSpacing: '-0.02em', maxWidth: 320 }}>
                {promoPopup.headline}
              </h3>
            )}
            {promoPopup.subtext && (
              <p className="vro-promo-subtext" style={{ margin: '0 0 14px', fontSize: 13, color: '#555', maxWidth: 320 }}>{promoPopup.subtext}</p>
            )}
            <button onClick={handleCta} className="vro-promo-cta" style={{
              width: '100%', maxWidth: 280, padding: '12px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#8B5CF6,#F97316)', color: '#fff',
              fontSize: 14, fontWeight: 800, boxShadow: '0 8px 20px rgba(139,92,246,0.3)',
            }}>{promoPopup.ctaText || 'Shop Now'}</button>

            {/* Social media row */}
            <div className="vro-promo-social" style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 16 }}>
              {SOCIAL_LINKS.filter(s => s.name !== 'LinkedIn').map(s => {
                const href = s.name === 'WhatsApp' ? `https://wa.me/${contact?.whatsapp || ''}` : s.href
                return (
                  <a key={s.name} href={href} target="_blank" rel="noopener noreferrer"
                    aria-label={s.name}
                    style={{
                      width: 32, height: 32, borderRadius: '50%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', color: '#fff',
                      background: s.gradient, transition: 'transform 0.15s', flexShrink: 0,
                    }}>
                    <span style={{ width: 16, height: 16 }}>{s.icon}</span>
                  </a>
                )
              })}
            </div>

            <button onClick={() => dismiss(true)} style={{
              display: 'block', margin: '18px auto 0', background: 'none', border: 'none',
              color: '#999', fontSize: 12, textDecoration: 'underline', cursor: 'pointer',
            }}>No, thanks</button>
          </div>
        </div>
      </div>
    </div>
  )
}
