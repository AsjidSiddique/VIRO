'use client'
// ── NavProgress ────────────────────────────────────────────────────────────
// Shows a purple top loading bar when navigating between pages.
// Eliminates the "nothing happening" feeling after clicking a nav link.
// Pure CSS animation — zero dependencies, zero performance impact.

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function Bar() {
  const pathname    = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)
  const [visible,  setVisible]  = useState(false)
  const timer  = useRef(null)
  const prevKey = useRef(null)
  const key = pathname + searchParams.toString()

  useEffect(() => {
    if (prevKey.current === null) { prevKey.current = key; return }
    if (prevKey.current === key)  { return }

    // New navigation started — show bar
    setVisible(true)
    setProgress(20)

    // Animate to 80% quickly
    timer.current = setTimeout(() => setProgress(60), 100)
    const t2 = setTimeout(() => setProgress(80), 400)

    prevKey.current = key

    // Complete
    const t3 = setTimeout(() => {
      setProgress(100)
      setTimeout(() => { setVisible(false); setProgress(0) }, 300)
    }, 100)

    return () => {
      clearTimeout(timer.current)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [key])

  if (!visible && progress === 0) return null

  return (
    <div style={{
      position:   'fixed',
      top:        0,
      left:       0,
      height:     3,
      width:      `${progress}%`,
      background: 'linear-gradient(90deg, #7C3AED, #A78BFA)',
      zIndex:     99999,
      transition: progress === 100 ? 'width 0.1s ease, opacity 0.3s ease' : 'width 0.4s ease',
      opacity:    progress === 100 ? 0 : 1,
      borderRadius: '0 2px 2px 0',
      boxShadow:  '0 0 10px #7C3AED80',
    }} />
  )
}

export default function NavProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  )
}
