'use client'
import { supabase } from '../lib/supabase'
import Image from 'next/image'
import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useImageFallback } from '../lib/useImageFallback'

const HERO_BUCKET   = 'hero_section'

const DEFAULT_CONFIG = {
  enabled: true,
  title: 'Smart Shopping, Better Living.',
  subtitle: 'Quality products delivered fast in Burewala & across Pakistan.',
  cta_text: 'Shop Now',
  overlay_opacity: 0.55,
  slide_speed: 3000,
  hero_height: 'md',
  strip_speed: 22,
  paused_images: [],
}
const HEIGHT_MAP = {
  sm: 'clamp(160px,30vw,240px)',
  md: 'clamp(200px,38vw,300px)',
  lg: 'clamp(240px,46vw,380px)',
  xl: 'clamp(280px,55vw,460px)',
}

function getBucketImages(bucket, data) {
  if (!supabase) return []
  return (data || [])
    .filter(f => f.name && /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name))
    .map(f => {
      try {
        const { data: pd } = supabase.storage.from(bucket).getPublicUrl(f.name)
        return { url: pd?.publicUrl || '', name: f.name }
      } catch { return { url: '', name: f.name } }
    })
    .filter(f => f.url)
}

const BLUR_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg=='

export default function HeroBanner() {
  const [slides,    setSlides]   = useState([])
  const [active,    setActive]   = useState(0)
  const [loaded,    setLoaded]   = useState(false)
  const [config,    setConfig]   = useState(DEFAULT_CONFIG)
  const timerRef = useRef(null)

  // Try Vercel's optimized image first; if the monthly optimization quota is
  // exhausted (402), automatically falls back to the raw file — see lib/useImageFallback.js
  const { src: mainHeroSrc, unoptimized: mainHeroUnoptimized, handleError: mainHeroError } =
    useImageFallback(slides[active]?.url || '/logo.jpg', { width: 1200, quality: 80 })

  useEffect(() => {
    async function load() {
      // Guard: supabase is null when env vars are missing (dev without .env.local)
      if (!supabase) { setLoaded(true); return }

      let cfg = { ...DEFAULT_CONFIG }
      try {
        const { data } = await supabase.from('site_settings').select('value').eq('key','hero').maybeSingle()
        if (data?.value) cfg = { ...cfg, ...data.value }
      } catch {}
      setConfig(cfg)

      // Hero section bucket images
      try {
        const { data } = await supabase.storage.from(HERO_BUCKET).list('', { limit: 50 })
        const imgs = getBucketImages(HERO_BUCKET, data)
        const paused = cfg.paused_images || []
        const active_slides = imgs.filter(i => !paused.includes(i.name))
        setSlides(active_slides.length ? active_slides : (imgs.length ? imgs : []))
      } catch {}

      // Removed: the small promo thumbnail strip below the hero (fetched from
      // header_ads_imgs) — cut entirely per feedback that it added scroll
      // friction before shoppers reach products, plus an extra storage.list()
      // round-trip on every homepage load for a section barely anyone used.

      setLoaded(true)
    }
    load()
  }, [])

  useEffect(() => {
    if (!slides.length) return
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setActive(a => (a + 1) % slides.length), config.slide_speed || 3000)
    return () => clearInterval(timerRef.current)
  }, [slides, config.slide_speed])

  function goTo(idx) {
    setActive(idx)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setActive(a => (a + 1) % slides.length), config.slide_speed || 3000)
  }

  if (loaded && !config.enabled) return null

  const opa = config.overlay_opacity ?? 0.55
  const h   = HEIGHT_MAP[config.hero_height] || HEIGHT_MAP.md

  return (
    <>
      <style>{`
        .hero-img { animation: kenBurns 9s ease-in-out infinite; object-fit:cover; object-position:center; width:100%; height:100%; }
        .hero-fade { animation: fadeIn 0.5s ease; }
        .headline-anim { animation: headlineSlide 0.5s cubic-bezier(.4,0,.2,1) both; }
        .cta-anim  { animation: headlineSlide 0.5s 0.18s cubic-bezier(.4,0,.2,1) both; }
      `}</style>

      {/* ── Main Hero ── */}
      <div className="relative w-full overflow-hidden select-none"
        style={{ height: h, background: 'var(--viro-bgDeep)', borderRadius: '0 0 20px 20px' }}>

        {loaded && slides.length > 0 ? (
          <Image key={slides[active]?.url}
            src={mainHeroSrc}
            alt="Viro banner"
            fill
            priority={true}
            sizes="100vw"
            style={{ objectFit:'cover' }}
            className="hero-img hero-fade"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            quality={80}
            unoptimized={mainHeroUnoptimized}
            onError={mainHeroError}
          />
        ) : (
          // Fallback: beautiful gradient hero when no image is uploaded yet
          // Upload images via Admin → Site Settings → Hero Images to replace this
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg,#0F172A 0%,#1E1B4B 40%,#312E81 70%,#1E293B 100%)' }}>
            {/* Animated glow orbs */}
            <div style={{ position:'absolute', top:'20%', left:'15%', width:180, height:180,
              borderRadius:'50%', background:'radial-gradient(circle,#8B5CF640,transparent 70%)', filter:'blur(30px)' }} />
            <div style={{ position:'absolute', bottom:'25%', right:'20%', width:140, height:140,
              borderRadius:'50%', background:'radial-gradient(circle,#F9731640,transparent 70%)', filter:'blur(25px)' }} />
          </div>
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-0" style={{ background: `linear-gradient(90deg,rgba(8,14,28,${opa}) 0%,rgba(8,14,28,${opa*0.35}) 55%,transparent 100%)` }} />
        <div className="absolute inset-0" style={{ background: `linear-gradient(0deg,rgba(8,14,28,${opa*0.9}) 0%,transparent 50%)` }} />

        {/* Text — headline + CTA only, kept lean so the smaller hero still
            has room to breathe (extra badge/subtitle text removed) */}
        <div className="absolute inset-0 flex flex-col justify-center px-4 md:px-10 pb-6">
          <h2 className="headline-anim font-extrabold text-white leading-tight drop-shadow-lg"
            style={{ fontSize:'clamp(18px,4.6vw,36px)', textShadow:'0 2px 16px rgba(0,0,0,0.6)', marginBottom:'12px', maxWidth:'85%' }}>
            {config.title}
          </h2>
          <Link href="/shop"
            className="cta-anim inline-flex items-center gap-2 font-bold text-white w-fit rounded-xl active:scale-95"
            style={{ background:'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)',
              boxShadow:'0 4px 22px #8B5CF660',
              padding:'clamp(8px,1.8vw,12px) clamp(16px,3.5vw,24px)',
              fontSize:'clamp(13px,2.3vw,15px)', transition:'opacity 0.2s' }}>
            {config.cta_text} →
          </Link>
        </div>

        {/* Dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
            {slides.map((_, i) => (
              <button key={i} onClick={() => goTo(i)}
                className="rounded-full transition-all duration-300"
                style={{ width: i===active?'24px':'7px', height:'7px',
                  background: i===active ? 'linear-gradient(90deg,#00BFFF,#8B5CF6)' : 'rgba(255,255,255,0.3)' }} />
            ))}
          </div>
        )}

        {/* Arrows */}
        {slides.length > 1 && (
          <>
            <button onClick={() => goTo((active-1+slides.length)%slides.length)}
              className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full items-center justify-center text-white text-lg"
              style={{ background:'rgba(255,255,255,0.12)', backdropFilter:'blur(6px)' }}>‹</button>
            <button onClick={() => goTo((active+1)%slides.length)}
              className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full items-center justify-center text-white text-lg"
              style={{ background:'rgba(255,255,255,0.12)', backdropFilter:'blur(6px)' }}>›</button>
          </>
        )}
      </div>
    </>
  )
}
