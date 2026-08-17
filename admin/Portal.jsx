'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renders children directly on document.body via a portal.
 * This means position:fixed modals always center relative to the
 * actual viewport — not any overflow/transform/sticky parent.
 */
export default function Portal({ children }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true); return () => setMounted(false) }, [])
  if (!mounted) return null
  return createPortal(children, document.body)
}
