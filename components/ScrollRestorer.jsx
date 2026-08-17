'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

const pos = {}

export default function ScrollRestorer() {
  const pathname = usePathname()
  const prev = useRef(null)

  useEffect(() => {
    if (prev.current && prev.current !== pathname) {
      pos[prev.current] = window.scrollY
    }
    prev.current = pathname
    const y = pos[pathname]
    const t = setTimeout(() => window.scrollTo({ top: y || 0, behavior: 'instant' }), 50)
    return () => clearTimeout(t)
  }, [pathname])

  return null
}
