'use client'
import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Dual-handle price range slider.
 * - Drag either dot to set min/max by touch or mouse.
 * - Numeric fields stay in sync for exact entry.
 * - `min`/`max` are the absolute bounds (e.g. cheapest/priciest product);
 *   `value` is [minPrice, maxPrice] as numbers within that range (or '' for "no limit").
 */
export default function PriceRangeSlider({ bounds, minPrice, maxPrice, onChange }) {
  const [floor, ceiling] = bounds
  const trackRef = useRef(null)
  const [dragging, setDragging] = useState(null) // 'min' | 'max' | null

  const curMin = minPrice === '' ? floor : Math.max(floor, Number(minPrice))
  const curMax = maxPrice === '' ? ceiling : Math.min(ceiling, Number(maxPrice))
  const span = Math.max(ceiling - floor, 1)
  const pctMin = ((curMin - floor) / span) * 100
  const pctMax = ((curMax - floor) / span) * 100

  const valueFromClientX = useCallback((clientX) => {
    const el = trackRef.current
    if (!el) return floor
    const rect = el.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    // Snap to nice Rs.10 steps so the number doesn't jitter to odd values
    const raw = floor + ratio * span
    return Math.round(raw / 10) * 10
  }, [floor, span])

  const handleMove = useCallback((clientX) => {
    if (!dragging) return
    const v = valueFromClientX(clientX)
    if (dragging === 'min') {
      const next = Math.min(v, curMax - 10)
      onChange(next <= floor ? '' : String(Math.max(floor, next)), maxPrice)
    } else {
      const next = Math.max(v, curMin + 10)
      onChange(minPrice, next >= ceiling ? '' : String(Math.min(ceiling, next)))
    }
  }, [dragging, valueFromClientX, curMin, curMax, minPrice, maxPrice, floor, ceiling, onChange])

  useEffect(() => {
    if (!dragging) return
    const onMouseMove = e => handleMove(e.clientX)
    const onTouchMove = e => { if (e.touches?.[0]) handleMove(e.touches[0].clientX) }
    const stop = () => setDragging(null)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('mouseup', stop)
    window.addEventListener('touchend', stop)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('mouseup', stop)
      window.removeEventListener('touchend', stop)
    }
  }, [dragging, handleMove])

  const startDrag = (which) => (e) => {
    e.preventDefault()
    setDragging(which)
  }

  return (
    <div>
      <div className="relative" style={{ height: 36 }}>
        <div ref={trackRef} className="absolute left-0 right-0 top-1/2 -translate-y-1/2"
          style={{ height: 5, borderRadius: 3, background: 'var(--viro-border)' }}
          onClick={(e) => {
            // Clicking the bare track jumps the nearer handle to that point
            const v = valueFromClientX(e.clientX)
            const distToMin = Math.abs(v - curMin), distToMax = Math.abs(v - curMax)
            if (distToMin <= distToMax) {
              const next = Math.min(v, curMax - 10)
              onChange(next <= floor ? '' : String(Math.max(floor, next)), maxPrice)
            } else {
              const next = Math.max(v, curMin + 10)
              onChange(minPrice, next >= ceiling ? '' : String(Math.min(ceiling, next)))
            }
          }}>
          {/* Filled segment between the two handles */}
          <div className="absolute top-0 bottom-0"
            style={{ left: `${pctMin}%`, right: `${100 - pctMax}%`, borderRadius: 3,
              background: 'linear-gradient(90deg,#8B5CF6,#7C3AED)' }} />
        </div>

        {/* Min handle */}
        <div
          role="slider" aria-label="Minimum price" aria-valuemin={floor} aria-valuemax={ceiling} aria-valuenow={curMin}
          tabIndex={0}
          onMouseDown={startDrag('min')} onTouchStart={startDrag('min')}
          onKeyDown={e => {
            if (e.key === 'ArrowLeft')  { const n = Math.max(floor, curMin - 50); onChange(n <= floor ? '' : String(n), maxPrice) }
            if (e.key === 'ArrowRight') { const n = Math.min(curMax - 10, curMin + 50); onChange(n <= floor ? '' : String(n), maxPrice) }
          }}
          className="absolute top-1/2 active:scale-110 transition-transform"
          style={{
            left: `${pctMin}%`, transform: 'translate(-50%,-50%)', top: '50%',
            width: 18, height: 18, borderRadius: "50%", background: "#fff",
            border: '3px solid #8B5CF6', boxShadow: '0 2px 8px rgba(139,92,246,0.5)',
            cursor: 'grab', zIndex: dragging === 'min' ? 3 : 2, touchAction: 'none',
          }} />

        {/* Max handle */}
        <div
          role="slider" aria-label="Maximum price" aria-valuemin={floor} aria-valuemax={ceiling} aria-valuenow={curMax}
          tabIndex={0}
          onMouseDown={startDrag('max')} onTouchStart={startDrag('max')}
          onKeyDown={e => {
            if (e.key === 'ArrowLeft')  { const n = Math.max(curMin + 10, curMax - 50); onChange(minPrice, n >= ceiling ? '' : String(n)) }
            if (e.key === 'ArrowRight') { const n = Math.min(ceiling, curMax + 50); onChange(minPrice, n >= ceiling ? '' : String(n)) }
          }}
          className="absolute top-1/2 active:scale-110 transition-transform"
          style={{
            left: `${pctMax}%`, transform: 'translate(-50%,-50%)', top: '50%',
            width: 18, height: 18, borderRadius: "50%", background: "#fff",
            border: '3px solid #8B5CF6', boxShadow: '0 2px 8px rgba(139,92,246,0.5)',
            cursor: 'grab', zIndex: dragging === 'max' ? 3 : 2, touchAction: 'none',
          }} />
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className="text-xs font-bold" style={{ color: '#8B5CF6' }}>Rs.{curMin.toLocaleString()}</span>
        <span className="text-xs font-bold" style={{ color: '#8B5CF6' }}>{maxPrice === '' ? `Rs.${ceiling.toLocaleString()}+` : `Rs.${curMax.toLocaleString()}`}</span>
      </div>
    </div>
  )
}
