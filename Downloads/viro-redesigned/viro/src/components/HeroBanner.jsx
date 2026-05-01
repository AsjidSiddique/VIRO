import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

// Banner slides — images pulled from your header_ads_imgs Supabase bucket
// The URLs are built from VITE_SUPABASE_URL at runtime
function getBucketUrl(filename) {
  const base = import.meta.env.VITE_SUPABASE_URL
  return `${base}/storage/v1/object/public/header_ads_imgs/${filename}`
}

const SLIDES = [
  {
    img: getBucketUrl('img1.png'),
    tag: 'New Arrivals',
    headline: 'Trendy. Quality.\nAffordable.',
    sub: 'Everything you love, in one place!',
    cta: 'Shop Now',
    ctaLink: '/shop',
    accent: '#00BFFF',
  },
  {
    img: getBucketUrl('img2.png'),
    tag: 'Best Deals',
    headline: 'Smart Shopping,\nBetter Living.',
    sub: 'Electronics, fashion, household & more.',
    cta: 'Explore',
    ctaLink: '/shop',
    accent: '#8B5CF6',
  },
  {
    img: getBucketUrl('logo.jpeg'),
    tag: 'Viro.pk',
    headline: 'Your Trusted\nLocal Store.',
    sub: 'Burewala & nearby — fast delivery guaranteed.',
    cta: 'Order Now',
    ctaLink: '/shop',
    accent: '#F97316',
  },
]

export default function HeroBanner() {
  const [active, setActive]   = useState(0)
  const [prev, setPrev]       = useState(null)
  const [animating, setAnimating] = useState(false)
  const timerRef              = useRef(null)

  function goTo(idx) {
    if (animating || idx === active) return
    setAnimating(true)
    setPrev(active)
    setActive(idx)
    setTimeout(() => { setPrev(null); setAnimating(false) }, 600)
  }

  function next() { goTo((active + 1) % SLIDES.length) }
  function prev2() { goTo((active - 1 + SLIDES.length) % SLIDES.length) }

  useEffect(() => {
    timerRef.current = setInterval(next, 4500)
    return () => clearInterval(timerRef.current)
  }, [active, animating])

  return (
    <div className="relative w-full overflow-hidden"
      style={{ borderRadius: '0 0 28px 28px', minHeight: 260, background: '#080C18' }}>

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes slideOutLeft {
          from { opacity: 1; transform: translateX(0) scale(1); }
          to   { opacity: 0; transform: translateX(-40px) scale(0.97); }
        }
        @keyframes floatY {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-8px); }
        }
        .slide-in  { animation: slideInRight 0.6s cubic-bezier(.4,0,.2,1) forwards; }
        .slide-out { animation: slideOutLeft  0.6s cubic-bezier(.4,0,.2,1) forwards; }
        .float-img { animation: floatY 3.5s ease-in-out infinite; }
      `}</style>

      {/* Slides */}
      {SLIDES.map((slide, i) => {
        const isActive = i === active
        const isPrev   = i === prev
        if (!isActive && !isPrev) return null
        return (
          <div key={i}
            className={`absolute inset-0 flex items-center ${isActive ? 'slide-in z-10' : 'slide-out z-0'}`}
            style={{ position: isActive ? 'relative' : 'absolute' }}>

            {/* Gradient bg */}
            <div className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse at 70% 50%, ${slide.accent}22 0%, transparent 65%), #080C18`
              }} />

            {/* Content */}
            <div className="relative z-10 flex items-center w-full px-5 py-8 gap-4"
              style={{ minHeight: 260 }}>
              {/* Text side */}
              <div className="flex-1 min-w-0">
                <span className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-3"
                  style={{ background: slide.accent + '25', color: slide.accent, border: `1px solid ${slide.accent}50` }}>
                  {slide.tag}
                </span>
                <h2 className="font-display font-extrabold text-white leading-tight mb-2"
                  style={{ fontSize: 'clamp(20px, 6vw, 30px)', whiteSpace: 'pre-line' }}>
                  {slide.headline}
                </h2>
                <p className="text-slate-400 text-xs mb-5 leading-relaxed">{slide.sub}</p>
                <Link to={slide.ctaLink}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-transform active:scale-95"
                  style={{ background: `linear-gradient(135deg, ${slide.accent}, #8B5CF6)` }}>
                  {slide.cta} →
                </Link>
              </div>

              {/* Image side */}
              <div className="flex-shrink-0 float-img"
                style={{ width: 'clamp(120px, 38vw, 180px)', height: 'clamp(120px, 38vw, 180px)' }}>
                <img src={slide.img} alt={slide.headline}
                  className="w-full h-full object-cover rounded-2xl shadow-2xl"
                  style={{ boxShadow: `0 12px 40px ${slide.accent}40` }}
                  onError={e => { e.target.src = '/logo.jpg' }} />
              </div>
            </div>
          </div>
        )
      })}

      {/* Dots + arrows */}
      <div className="absolute bottom-4 left-0 right-0 z-20 flex items-center justify-center gap-2">
        <button onClick={prev2}
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs transition-all"
          style={{ background: 'rgba(255,255,255,0.1)' }}>‹</button>

        {SLIDES.map((_, i) => (
          <button key={i} onClick={() => goTo(i)}
            className="rounded-full transition-all duration-300"
            style={{
              width:  i === active ? '24px' : '8px',
              height: '8px',
              background: i === active
                ? `linear-gradient(90deg, #00BFFF, #8B5CF6)`
                : 'rgba(255,255,255,0.25)',
            }} />
        ))}

        <button onClick={next}
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs transition-all"
          style={{ background: 'rgba(255,255,255,0.1)' }}>›</button>
      </div>
    </div>
  )
}
