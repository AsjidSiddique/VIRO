'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function ScrollToTop() {
  const pathname = usePathname()
  useEffect(() => {
    // Scroll both window and any scrollable containers
    window.scrollTo(0, 0)
    document.documentElement.scrollTo(0, 0)
    document.body.scrollTo(0, 0)
  }, [pathname])
  return null
}
