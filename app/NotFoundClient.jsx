'use client'
import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function NotFoundClient() {
  const router = useRouter()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 pb-28 text-center"
      style={{ background: 'var(--viro-sectionBg)' }}>
      <div style={{ position:'relative', marginBottom:24 }}>
        <div style={{ fontSize:96, lineHeight:1, fontWeight:900, letterSpacing:-4,
          background:'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
          backgroundClip:'text', userSelect:'none' }}>
          404
        </div>
        <div style={{ position:'absolute', top:0, right:-8, fontSize:36,
          animation:'bounce 1.6s ease-in-out infinite' }}>📦</div>
      </div>
      <h1 className="font-display text-xl font-extrabold mb-2" style={{ color:'var(--viro-text)' }}>
        Page Not Found
      </h1>
      <p className="text-sm mb-8 max-w-xs" style={{ color:'var(--viro-textSub)', lineHeight:1.6 }}>
        The link you followed may be broken, or the page may have been removed.
        No worries — there's plenty to explore!
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link href="/shop"
          className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white"
          style={{ background:'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)', boxShadow:'0 4px 20px #8B5CF640' }}>
          🛍️ Browse Products
        </Link>
        <Link href="/"
          className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm"
          style={{ background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)', color:'var(--viro-text)' }}>
          🏠 Go to Home
        </Link>
        <button onClick={() => router.back()}
          className="flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-medium"
          style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--viro-textSub)' }}>
          ← Go Back
        </button>
      </div>
    </div>
  )
}
