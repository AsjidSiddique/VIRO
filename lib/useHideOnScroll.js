'use client'
// ── useHideOnScroll ───────────────────────────────────────────────────────
// Fixed floating buttons (WhatsApp chat, Reviews tab) sit at a constant
// screen position, so whatever product card happens to be scrolled under
// them at any given moment gets partially covered — a badge or heart icon
// clipped behind an opaque circle. Auto-hiding the button while the user
// is actively scrolling (then bringing it back the moment they pause or
// scroll back up) means it's only ever covering content while the person
// is mid-scroll and not looking at that spot anyway — the same pattern
// used by most shopping apps for their floating action buttons.
// ──────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'

export function useHideOnScroll({ threshold = 8, revealAtTop = 80 } = {}) {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    lastY.current = window.scrollY
    let ticking = false
    let idleTimer = null

    function onScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        const diff = y - lastY.current

        if (y <= revealAtTop) {
          setHidden(false)
        } else if (diff > threshold) {
          setHidden(true)   // scrolling down — out of the way
        } else if (diff < -threshold) {
          setHidden(false)  // scrolling up — bring it back
        }

        lastY.current = y
        ticking = false

        // Also reveal once scrolling settles, so it's never stuck hidden
        // just because the last recorded direction was "down".
        clearTimeout(idleTimer)
        idleTimer = setTimeout(() => setHidden(false), 600)
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      clearTimeout(idleTimer)
    }
  }, [threshold, revealAtTop])

  return hidden
}
