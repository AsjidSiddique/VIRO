'use client'
import { useEffect, useState } from 'react'

export default function SplashScreen() {
  const [phase, setPhase] = useState('hidden')

  useEffect(() => {
    // Only show splash when app is launched from home screen (PWA mode).
    // Regular browser visits skip it — 1.7s blocked on every web visit is bad UX.
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||  // iOS Safari PWA
      document.referrer.includes('android-app://')

    if (!isPWA) return  // normal browser visit → skip splash entirely
    if (sessionStorage.getItem('viro_splashed')) return  // already shown this session
    sessionStorage.setItem('viro_splashed', '1')
    setPhase('show')
    const t1 = setTimeout(() => setPhase('fadeout'), 1400)
    const t2 = setTimeout(() => setPhase('hidden'),  1700)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (phase === 'hidden') return null
  const fading = phase === 'fadeout'

  return (
    <>
      <style>{`
        .viro-splash-desktop { display: flex; }
        .viro-splash-mobile  { display: none; }
        @media (max-width: 768px) {
          .viro-splash-desktop { display: none; }
          .viro-splash-mobile  { display: flex; }
        }
        @keyframes viroGlow {
          0%,100% { filter:drop-shadow(0 0 20px #8B5CF670) drop-shadow(0 0 40px #F9731640); transform:scale(1); }
          50%      { filter:drop-shadow(0 0 40px #8B5CF6AA) drop-shadow(0 0 80px #F97316AA); transform:scale(1.07); }
        }
        @keyframes ringExpand {
          0%   { transform:translate(-50%,-50%) scale(0.4); opacity:0.7; }
          100% { transform:translate(-50%,-50%) scale(2.4); opacity:0; }
        }
        @keyframes splashTextIn {
          from { opacity:0; letter-spacing:0.35em; }
          to   { opacity:0.5; letter-spacing:0.22em; }
        }
        @keyframes mobileLogoIn {
          0%   { opacity:0; transform:scale(0.82); }
          65%  { opacity:1; transform:scale(1.04); }
          100% { opacity:1; transform:scale(1); }
        }
        @keyframes dotPulse {
          0%,80%,100% { transform:scale(0.55); opacity:0.35; }
          40%          { transform:scale(1);    opacity:1; }
        }
      `}</style>

      {/* DESKTOP — dark bg, glow rings */}
      <div className="viro-splash-desktop" style={{
        position:'fixed', inset:0, zIndex:99999,
        background:'#00071A',
        alignItems:'center', justifyContent:'center', flexDirection:'column',
        opacity: fading ? 0 : 1,
        transform: fading ? 'scale(1.03)' : 'scale(1)',
        transition:'opacity 0.3s ease, transform 0.3s ease',
        pointerEvents:'none', userSelect:'none',
      }}>
        <div style={{ position:'relative', width:140, height:140, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {[0, 0.6, 1.2].map((delay, i) => (
            <div key={i} style={{
              position:'absolute', top:'50%', left:'50%',
              width:130, height:130, borderRadius:'50%',
              border:`1.5px solid ${['#8B5CF650','#F9731630','#06B6D425'][i]}`,
              animation:`ringExpand 2s ease-out ${delay}s infinite`,
            }} />
          ))}
          <img src="/splash-icon.png" alt="Viro" width={118} height={118}
            style={{ animation:'viroGlow 2s ease-in-out infinite', position:'relative', zIndex:1 }} />
        </div>
        <p style={{
          marginTop:26, fontSize:11, letterSpacing:'0.22em',
          textTransform:'uppercase', color:'#94A3B8',
          fontFamily:'var(--font-outfit, system-ui, sans-serif)', fontWeight:500,
          animation:'splashTextIn 0.8s ease 0.3s both',
        }}>
          Value · Variety · Vision
        </p>
      </div>

      {/* MOBILE — full white screen, rounded icon, dots */}
      <div className="viro-splash-mobile" style={{
        position:'fixed', inset:0, zIndex:99999,
        background:'#FFFFFF',
        alignItems:'center', justifyContent:'center', flexDirection:'column',
        opacity: fading ? 0 : 1,
        transition:'opacity 0.3s ease',
        pointerEvents:'none', userSelect:'none',
      }}>
        {/*
          splash-icon-mobile.png = solid white background + V logo fills 82%.
          CSS border-radius clips the white square corners into a rounded shape.
          NO box-shadow, NO wrapper div = zero black border artifact on any phone.
        */}
        <img
          src="/splash-icon-mobile.png"
          alt="Viro"
          width={128}
          height={128}
          style={{
            display:'block',
            borderRadius:28,
            animation:'mobileLogoIn 0.45s cubic-bezier(.34,1.56,.64,1) both',
          }}
        />

        {/* Instagram-style 3-dot loader */}
        <div style={{ position:'absolute', bottom:60, display:'flex', alignItems:'center', gap:8 }}>
          {[0, 0.18, 0.36].map((delay, i) => (
            <div key={i} style={{
              width:8, height:8, borderRadius:'50%',
              background:'linear-gradient(135deg,#8B5CF6,#F97316)',
              animation:`dotPulse 1.1s ease-in-out ${delay}s infinite`,
            }} />
          ))}
        </div>
      </div>
    </>
  )
}
