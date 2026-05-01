import React, { useEffect, useState } from 'react'

// Simple global toast — rendered once in App, triggered via window event
export function showToast(msg, type = 'success') {
  window.dispatchEvent(new CustomEvent('viro-toast', { detail: { msg, type } }))
}

export default function Toast() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    function handler(e) {
      const id = Date.now()
      setToasts(prev => [...prev, { id, ...e.detail }])
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2800)
    }
    window.addEventListener('viro-toast', handler)
    return () => window.removeEventListener('viro-toast', handler)
  }, [])

  return (
    <div className="fixed top-12 left-0 right-0 z-[999] flex flex-col items-center gap-2 pointer-events-none px-4">
      {toasts.map(t => (
        <div key={t.id}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl text-sm font-semibold text-white max-w-xs w-full pointer-events-auto"
          style={{
            background: t.type === 'success'
              ? 'linear-gradient(135deg,#10B981,#059669)'
              : t.type === 'error'
              ? 'linear-gradient(135deg,#EF4444,#DC2626)'
              : 'linear-gradient(135deg,#8B5CF6,#7C3AED)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
            animation: 'toastIn 0.35s cubic-bezier(.4,0,.2,1)',
          }}>
          <span className="text-xl flex-shrink-0">
            {t.type === 'success' ? '🛒' : t.type === 'error' ? '❌' : 'ℹ️'}
          </span>
          <span className="flex-1 leading-tight">{t.msg}</span>
        </div>
      ))}
      <style>{`
        @keyframes toastIn {
          from { opacity:0; transform:translateY(-12px) scale(0.95); }
          to   { opacity:1; transform:translateY(0)     scale(1); }
        }
      `}</style>
    </div>
  )
}
