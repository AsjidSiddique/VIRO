import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const BUCKET = 'header_ads_imgs'

export default function HeroBanner() {
  const [slides, setSlides]     = useState([])
  const [active, setActive]     = useState(0)
  const [loaded, setLoaded]     = useState(false)
  const timerRef                = useRef(null)

  // Load all images from the bucket dynamically
  useEffect(() => {
    async function loadBanners() {
      try {
        const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: 20, sortBy: { column: 'name', order: 'asc' } })
        if (error || !data?.length) {
          // fallback to logo
          setSlides([{ url: '/logo.jpg', name: 'viro' }])
          setLoaded(true)
          return
        }
        const imgs = data
          .filter(f => f.name.match(/\.(png|jpg|jpeg|webp|gif)$/i))
          .map(f => {
            const { data: pd } = supabase.storage.from(BUCKET).getPublicUrl(f.name)
            return { url: pd.publicUrl, name: f.name }
          })
        setSlides(imgs.length ? imgs : [{ url: '/logo.jpg', name: 'viro' }])
      } catch {
        setSlides([{ url: '/logo.jpg', name: 'viro' }])
      }
      setLoaded(true)
    }
    loadBanners()
  }, [])

  function goTo(idx) {
    setActive(idx)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setActive(a => (a + 1) % slides.length), 4500)
  }

  useEffect(() => {
    if (!slides.length) return
    timerRef.current = setInterval(() => setActive(a => (a + 1) % slides.length), 4500)
    return () => clearInterval(timerRef.current)
  }, [slides])

  if (!loaded) return (
    <div className="w-full animate-pulse" style={{ height: 'clamp(200px, 55vw, 500px)', background: '#1E293B', borderRadius: '0 0 24px 24px' }} />
  )

  const slide = slides[active] || slides[0]

  return (
    <div className="relative w-full overflow-hidden select-none"
      style={{ borderRadius: '0 0 24px 24px', height: 'clamp(220px, 56vw, 520px)', background: '#080E1C' }}>

      <style>{`
        @keyframes kenBurns {
          0%   { transform: scale(1)    translateX(0); }
          50%  { transform: scale(1.05) translateX(-1%); }
          100% { transform: scale(1)    translateX(0); }
        }
        @keyframes bannerFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .banner-img { animation: kenBurns 8s ease-in-out infinite, bannerFade 0.6s ease; }
        @keyframes headlinePulse {
          0%,100% { opacity:.85; transform:scale(1); }
          50%     { opacity:1;   transform:scale(1.01); }
        }
        .headline-pulse { animation: headlinePulse 4s ease-in-out infinite; }
      `}</style>

      {/* Full-bleed image */}
      <img
        key={slide.url}
        src={slide.url}
        alt="Viro banner"
        className="banner-img absolute inset-0 w-full h-full object-cover object-center"
        onError={e => { e.target.src = '/logo.jpg' }}
      />

      {/* Gradient overlay — stronger on left for text readability */}
      <div className="absolute inset-0"
        style={{ background: 'linear-gradient(90deg, rgba(8,14,28,0.72) 0%, rgba(8,14,28,0.25) 55%, transparent 100%)' }} />
      <div className="absolute inset-0"
        style={{ background: 'linear-gradient(0deg, rgba(8,14,28,0.55) 0%, transparent 60%)' }} />

      {/* Text overlay */}
      <div className="absolute inset-0 flex flex-col justify-center px-5 md:px-10 pb-10">
        <span className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-3 w-fit"
          style={{ background: '#00BFFF25', color: '#00BFFF', border: '1px solid #00BFFF50' }}>
          🛍️ viro.pk
        </span>
        <h2 className="headline-pulse font-display font-extrabold text-white leading-tight mb-2 drop-shadow-lg"
          style={{ fontSize: 'clamp(22px, 5.5vw, 44px)', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
          Smart Shopping,<br />Better Living.
        </h2>
        <p className="text-xs md:text-sm mb-5 max-w-xs leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.75)', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
          Quality products delivered fast in Burewala & across Pakistan.
        </p>
        <Link to="/shop"
          className="inline-flex items-center gap-2 font-bold text-white w-fit px-5 py-2.5 rounded-xl transition-all active:scale-95 text-sm md:text-base"
          style={{ background: 'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)', boxShadow: '0 4px 20px #8B5CF660' }}>
          Shop Now →
        </Link>
      </div>

      {/* Dot indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
          {slides.map((_, i) => (
            <button key={i} onClick={() => goTo(i)}
              className="rounded-full transition-all duration-400"
              style={{
                width:  i === active ? '28px' : '8px',
                height: '8px',
                background: i === active ? 'linear-gradient(90deg,#00BFFF,#8B5CF6)' : 'rgba(255,255,255,0.35)',
              }} />
          ))}
        </div>
      )}

      {/* Left/right arrows — desktop only */}
      {slides.length > 1 && (
        <>
          <button onClick={() => goTo((active - 1 + slides.length) % slides.length)}
            className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full items-center justify-center text-white transition-all hover:bg-white/20"
            style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)' }}>‹</button>
          <button onClick={() => goTo((active + 1) % slides.length)}
            className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full items-center justify-center text-white transition-all hover:bg-white/20"
            style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)' }}>›</button>
        </>
      )}
    </div>
  )
}
