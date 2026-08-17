'use client'
import { useState, useEffect } from 'react'

/**
 * useImageFallback — try next/image optimization first, fall back to the
 * raw unoptimized file on any first error (402 quota exceeded, 404, etc).
 *
 * Previous version did a secondary /_next/image fetch to detect 402 —
 * that secondary fetch ALSO got a 402, ALSO counted against quota, and
 * added latency before the image appeared. Simpler and faster: go straight
 * to unoptimized on first error. Works for both failure modes:
 *   • 402 quota exceeded → raw file bypasses quota, loads immediately
 *   • Genuine broken/missing image → raw also fails → show placeholder
 *
 * Usage:
 *   const { src, unoptimized, failed, handleError } = useImageFallback(rawUrl)
 *   <Image src={src} unoptimized={unoptimized} onError={handleError} ... />
 */
export function useImageFallback(rawSrc, _options = {}) {
  const [failed,      setFailed]      = useState(false)
  const [unoptimized, setUnoptimized] = useState(false)
  const [src,         setSrc]         = useState(rawSrc)

  // Reset when the source image changes (variant switch, product change, etc.)
  useEffect(() => {
    setFailed(false)
    setUnoptimized(false)
    setSrc(rawSrc)
  }, [rawSrc])

  function handleError() {
    if (unoptimized) {
      // Already on the raw file and it STILL failed — genuinely broken.
      setFailed(true)
      return
    }
    // First failure: immediately switch to unoptimized.
    // No secondary fetch needed — unoptimized solves both 402 and broken-link.
    setUnoptimized(true)
    setSrc(rawSrc)
  }

  return { src, unoptimized, failed, handleError }
}
