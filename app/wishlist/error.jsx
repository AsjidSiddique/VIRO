'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function WishlistError({ error, reset }) {
  useEffect(() => {
    console.error('[Viro] Wishlist error:', error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '2rem',
      textAlign: 'center', background: 'var(--viro-sectionBg)',
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: 'var(--viro-text)' }}>
        Something went wrong
      </h2>
      <p style={{ color: 'var(--viro-textSub)', fontSize: 14, marginBottom: 24, maxWidth: 320 }}>
        We hit an unexpected error loading this page.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={reset}
          style={{
            padding: '10px 24px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)',
            color: '#fff', fontWeight: 700, fontSize: 14,
          }}>
          Try Again
        </button>
        <Link
          href="/"
          style={{
            padding: '10px 24px', borderRadius: 12, textDecoration: 'none',
            border: '1px solid var(--viro-border)',
            color: 'var(--viro-text)', fontWeight: 600, fontSize: 14,
            background: 'var(--viro-bgCard)',
          }}>
          Go Home
        </Link>
      </div>
    </div>
  )
}
