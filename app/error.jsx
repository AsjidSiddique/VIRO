'use client'
// Route-segment error boundary — catches errors thrown inside page.jsx children.
// Does NOT catch layout.jsx errors (that's global-error.jsx).
// Shown when a Server Component inside this route segment throws.
import { useEffect } from 'react'

export default function Error({ error, reset }) {
  useEffect(() => {
    const msg = error?.message || String(error || '')
    const isChunk = msg.includes('ChunkLoadError') ||
                    msg.includes('Loading chunk') ||
                    msg.includes('Failed to fetch dynamically')
    if (isChunk) {
      const key = 'viro_err_46'
      try {
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1')
          location.reload(true)
          return
        }
      } catch {}
    }
    console.error('[Viro] Route error:', error)
  }, [error])

  return (
    <div style={{
      minHeight: '60vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '32px 16px',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>⚡</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: 'var(--viro-text, #F1F5F9)' }}>
          Something went wrong
        </h2>
        <p style={{ fontSize: 13, color: 'var(--viro-textSub, #94A3B8)', lineHeight: 1.6, marginBottom: 24 }}>
          This can happen after an update. Please refresh the page.
        </p>
        <button
          onClick={() => { try { sessionStorage.clear() } catch {} reset() }}
          style={{
            background: 'linear-gradient(135deg, #8B5CF6, #F97316)',
            color: '#fff', border: 'none', borderRadius: 14,
            padding: '13px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>
          🔄 Refresh Page
        </button>
      </div>
    </div>
  )
}
